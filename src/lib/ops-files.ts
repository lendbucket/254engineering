import { isPrelaunch } from "./launch";
import type { Actor } from "./ops-authz";
import { can } from "./ops-authz";

/**
 * The file's state machine.
 *
 * WHY THIS IS CODE AND NOT A COLUMN CONSTRAINT
 * --------------------------------------------
 * The database CHECK on eng_files.status says which words are legal. It says
 * nothing about which moves are, because a transition table in SQL is
 * unreadable and untestable, and because two of the rules here are not about the
 * status at all: one is about who is asking, and one is about whether the firm
 * is allowed to practise engineering yet.
 *
 * So the alphabet is enforced by the database and the grammar is enforced here,
 * with a test suite, and every accepted move writes an eng_file_events row.
 *
 * THE COMPLIANCE GATE IS A TRANSITION RULE, NOT A UI CONDITION
 * ------------------------------------------------------------
 * While LAUNCH_MODE is prelaunch, no file may reach sealed or delivered. That is
 * expressed here, in the same function every route calls, rather than as a
 * disabled button. A disabled button is a suggestion: the API is still there and
 * a determined person, or a future page that forgot, walks straight past it.
 *
 * The firm cannot perform engineering before its registration issues. The
 * platform enforces that rather than trusting anyone to remember it, which is
 * the whole reason this paragraph is in a state machine and not a style guide.
 *
 * WHY REFUSALS CARRY A REASON
 * ---------------------------
 * "Cannot do that" sends somebody to an administrator who also cannot tell them
 * why. Every refusal below returns a sentence a person can act on, and the UI
 * shows it verbatim.
 */

export type FileStatus =
  | "intake"
  | "needs_dispatch"
  | "dispatched"
  | "evidence_in_progress"
  | "evidence_submitted"
  | "under_review"
  | "revisions_requested"
  | "sealed"
  | "delivered"
  | "closed"
  | "cancelled";

export const FILE_STATUSES: FileStatus[] = [
  "intake",
  "needs_dispatch",
  "dispatched",
  "evidence_in_progress",
  "evidence_submitted",
  "under_review",
  "revisions_requested",
  "sealed",
  "delivered",
  "closed",
  "cancelled",
];

export const STATUS_LABEL: Record<FileStatus, string> = {
  intake: "Intake",
  needs_dispatch: "Needs dispatch",
  dispatched: "Dispatched",
  evidence_in_progress: "Evidence in progress",
  evidence_submitted: "Evidence submitted",
  under_review: "Under review",
  revisions_requested: "Revisions requested",
  sealed: "Sealed",
  delivered: "Delivered",
  closed: "Closed",
  cancelled: "Cancelled",
};

/** Where a status sits, for colouring a chip without a second lookup table. */
export const STATUS_TONE: Record<FileStatus, "neutral" | "good" | "warn" | "bad"> = {
  intake: "neutral",
  needs_dispatch: "warn",
  dispatched: "neutral",
  evidence_in_progress: "neutral",
  evidence_submitted: "warn",
  under_review: "warn",
  revisions_requested: "bad",
  sealed: "good",
  delivered: "good",
  closed: "neutral",
  cancelled: "bad",
};

/**
 * The legal moves.
 *
 * Written as a map rather than a series of conditionals so the whole grammar can
 * be read at once and so roles-audit style exhaustive testing is possible.
 *
 * Cancellation is reachable from everything that is not already terminal,
 * because work really does get called off at any point and a platform that makes
 * that hard produces files that sit in "dispatched" forever as a lie.
 */
const TRANSITIONS: Record<FileStatus, FileStatus[]> = {
  intake: ["needs_dispatch", "under_review", "cancelled"],
  needs_dispatch: ["dispatched", "intake", "cancelled"],
  dispatched: ["evidence_in_progress", "needs_dispatch", "cancelled"],
  evidence_in_progress: ["evidence_submitted", "needs_dispatch", "cancelled"],
  evidence_submitted: ["under_review", "revisions_requested", "cancelled"],
  under_review: ["sealed", "revisions_requested", "evidence_submitted", "cancelled"],
  revisions_requested: ["evidence_in_progress", "evidence_submitted", "under_review", "cancelled"],
  sealed: ["delivered", "cancelled"],
  delivered: ["closed"],
  closed: [],
  cancelled: [],
};

/**
 * Statuses the compliance gate forbids while the registration is pending.
 *
 * Sealing is the act of a licensed engineer taking responsible charge. Delivering
 * is handing that sealed document to a client. Neither can happen before the firm
 * is registered and a Professional Engineer is in responsible charge, so neither
 * is reachable while isPrelaunch() is true.
 */
export const GATED_STATUSES: FileStatus[] = ["sealed", "delivered"];

/**
 * Which action a transition needs, so authorization and the grammar agree.
 *
 * WHY THIS TAKES THE PAIR AND NOT JUST THE DESTINATION
 * ----------------------------------------------------
 * Two different people move a file to evidence submitted and they are doing two
 * different things. A technician finishing a capture is submitting. An engineer
 * pushing a file back out of review is reopening it, and that is a review
 * decision, not a submission.
 *
 * Keying only on the destination collapsed those into one permission, and the
 * consequence was concrete: a technician who could submit their own file could
 * also reach into a file already under review and pull it back out from under
 * the engineer holding it. The destination is the same status; the act is not.
 */
function actionFor(from: FileStatus, to: FileStatus): Parameters<typeof can>[1] {
  if (to === "sealed") return "documents.seal";
  if (to === "delivered") return "documents.deliver";
  if (to === "cancelled") return "files.cancel";
  if (to === "dispatched") return "offers.dispatch";
  if (to === "evidence_in_progress") return "evidence.start";
  if (to === "evidence_submitted") {
    return from === "under_review" ? "review.decide" : "evidence.submit";
  }
  return "files.transition";
}

export type TransitionResult = { ok: true } | { ok: false; reason: string };

/**
 * May this actor move this file from one status to another?
 *
 * The order of the checks is deliberate. Terminal first, because "that file is
 * closed" is more useful than "you lack permission" when both are true. Then the
 * grammar. Then the compliance gate, before authorization, because the gate
 * applies to everybody including an administrator and saying so is clearer than
 * a permission error that suggests somebody else could do it.
 */
export function canTransition(
  actor: Actor | null,
  from: FileStatus,
  to: FileStatus,
  now: { prelaunch?: boolean } = {},
): TransitionResult {
  if (from === to) return { ok: false, reason: `This file is already ${STATUS_LABEL[to].toLowerCase()}.` };

  if (TRANSITIONS[from].length === 0) {
    return {
      ok: false,
      reason: `A ${STATUS_LABEL[from].toLowerCase()} file cannot move again. Open a new file instead.`,
    };
  }

  if (!TRANSITIONS[from].includes(to)) {
    const legal = TRANSITIONS[from].map((s) => STATUS_LABEL[s].toLowerCase()).join(", ");
    return {
      ok: false,
      reason: `A file at ${STATUS_LABEL[from].toLowerCase()} can only move to: ${legal}.`,
    };
  }

  const prelaunch = now.prelaunch ?? isPrelaunch();
  if (prelaunch && GATED_STATUSES.includes(to)) {
    return {
      ok: false,
      reason:
        `The firm cannot ${to === "sealed" ? "seal" : "deliver"} work yet. Firm registration with ` +
        "the Texas Board of Professional Engineers and Land Surveyors is pending and no Professional " +
        "Engineer is in responsible charge. The file can be prepared to this point and no further.",
    };
  }

  if (!can(actor, actionFor(from, to))) {
    return { ok: false, reason: `Your role cannot move a file to ${STATUS_LABEL[to].toLowerCase()}.` };
  }

  return { ok: true };
}

/** The moves this actor could actually make, for rendering buttons that work. */
export function availableTransitions(
  actor: Actor | null,
  from: FileStatus,
  now: { prelaunch?: boolean } = {},
): { to: FileStatus; allowed: boolean; reason?: string }[] {
  return TRANSITIONS[from].map((to) => {
    const result = canTransition(actor, from, to, now);
    return result.ok ? { to, allowed: true } : { to, allowed: false, reason: result.reason };
  });
}

/**
 * Which timestamp column a status change should stamp.
 *
 * Kept beside the machine so a new status cannot be added without somebody
 * seeing that the question exists.
 */
export const STATUS_TIMESTAMP: Partial<Record<FileStatus, string>> = {
  dispatched: "dispatched_at",
  evidence_submitted: "evidence_submitted_at",
  sealed: "sealed_at",
  delivered: "delivered_at",
  closed: "closed_at",
};

/**
 * A file number a human can say out loud.
 *
 * Year plus a zero padded sequence. Not a uuid, because these get read down a
 * phone to a lender and "two five four, twenty six, one four seven" works where
 * a uuid does not.
 */
export function formatFileNumber(year: number, sequence: number): string {
  return `254-${year}-${String(sequence).padStart(4, "0")}`;
}
