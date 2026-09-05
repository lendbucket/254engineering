import { cell } from "./csv";
import { can, type Actor, type Action, type LicensedAction, may } from "./ops-authz";
import { isPrelaunch } from "./launch";
import type { FileStatus } from "./ops-files";

/**
 * Engineer review: the four things a licensed engineer may do with a package,
 * and the record each one leaves.
 *
 * WHY REFUSAL IS ONE OF THE FOUR AND NOT AN EDGE CASE
 * ----------------------------------------------------
 * An engineer who cannot stand behind a conclusion has to be able to say so,
 * and saying so has to be as easy, as fast, and as well supported by the
 * software as sealing is. A platform where sealing is one button and refusing
 * means writing an email to explain yourself is a platform applying pressure,
 * whatever its documentation claims.
 *
 * So refusal is a first class action with its own status, its own row in the
 * responsible charge log, and its own production ledger entry at the same tier
 * a seal would have paid.
 *
 * PRODUCTION PAY ATTACHES TO THE COMPLETED REVIEW, NOT TO THE SEAL
 * ----------------------------------------------------------------
 * Operator ruling, 2026-09-02, confirming the constraint recorded at Phase 7
 * specification time. The reasoning, in the order it was made:
 *
 *   Paying only on a seal creates financial pressure toward a favourable
 *   conclusion. An engineer who seals is paid and an engineer who reviews the
 *   same package and declines is not, which pays for a conclusion rather than
 *   for the work.
 *
 *   The operator states that Recital E of the engineer's agreement forbids
 *   exactly that pressure, and their own refund ruling on the order engine had
 *   already rejected it one layer out: the customer pays for the inspection
 *   whether or not the answer is the one they wanted, so neither the firm nor
 *   the engineer is better off when the answer is yes.
 *
 * The agreement itself is not in this repository, so the citation above is
 * recorded as the operator's and is not paraphrased further here. What the code
 * does is the part this file is responsible for: a completed review writes a
 * production entry, and a declined file writes one at the same tier as a sealed
 * one.
 *
 * This is MORE generous than section 3.2 of the signed agreement as the
 * operator describes it, and a short written amendment should paper it. That is
 * recorded in BACKLOG.md rather than left as a comment, because it is an action
 * somebody has to take rather than a fact about the code.
 *
 * REFUSAL IS NOT CANCELLATION AND NOT A REVISION
 * ----------------------------------------------
 * Cancelled means the work was called off. Revisions requested means the
 * evidence was insufficient and somebody is going back. Refused means a
 * licensed engineer examined a complete package and would not certify it. Those
 * are three different facts about a property, and collapsing them would destroy
 * the only record that says which one happened.
 *
 * THE COMPLIANCE GATE IS DELIBERATELY ASYMMETRIC
 * ----------------------------------------------
 * While the firm is prelaunch, sealing is blocked and refusing is not. That
 * asymmetry is the right way round and is worth stating plainly: a gate that
 * blocked an engineer from declining to certify, while leaving certification
 * available, would be the exact inversion of what the gate is for.
 *
 * THE GATE AND THE LICENCE ARE TWO DIFFERENT DOORS, AND ONLY ONE IS ASYMMETRIC
 * ---------------------------------------------------------------------------
 * The asymmetry above is about the GATE, and it is easy to read it as saying an
 * administrator can decline while nobody can seal. That is not what it says and
 * was never true after Phase 10 Section 2.
 *
 * All four decisions need a licence, because all four are professional
 * judgments about a package. Declining is not the safe residue of sealing that
 * anybody may perform; refusing to certify is itself an engineering opinion,
 * and it is the one that ends up in front of a board. So the gate lets an
 * ENGINEER decline while the firm cannot seal, and the licence lets nobody else
 * do either.
 *
 * The consequence is worth saying rather than discovering: while no
 * Professional Engineer holds an account, this firm cannot review a file at
 * all. That is the true state of a firm whose registration is pending, and the
 * messages here read that way on purpose.
 */

export type ReviewAction = "seal" | "revisions" | "site_visit" | "refuse";

export const REVIEW_ACTIONS: ReviewAction[] = ["seal", "revisions", "site_visit", "refuse"];

export const ACTION_LABEL: Record<ReviewAction, string> = {
  seal: "Seal and deliver",
  revisions: "Send back for revisions",
  site_visit: "Send back for a site visit",
  refuse: "Decline to seal",
};

/**
 * What each action does to the file.
 *
 * A site visit goes back to needs_dispatch rather than to revisions_requested,
 * because the difference is who acts next. Revisions are for the technician who
 * already holds the file: photograph the thing you missed. A site visit is a
 * new journey, possibly by a different technician, and it goes through dispatch
 * like any other.
 */
export const ACTION_TARGET: Record<ReviewAction, FileStatus> = {
  seal: "sealed",
  revisions: "revisions_requested",
  site_visit: "needs_dispatch",
  refuse: "refused",
};

/** Which permission each action needs. */
const ACTION_PERMISSION: Record<ReviewAction, Action | LicensedAction> = {
  seal: "documents.seal",
  revisions: "review.decide",
  site_visit: "review.decide",
  refuse: "review.decide",
};

/**
 * Actions that require the engineer to write something, and why each does.
 *
 * A revision request with no note is a file bouncing back to somebody who now
 * has to guess what was wrong. A refusal with no reason is unusable to the
 * client, to the next engineer, and to the board.
 *
 * Sealing needs no note, which is the asymmetry the other way and is also
 * correct: the deliverable IS the statement.
 */
export const REQUIRES_REASON: Record<ReviewAction, boolean> = {
  seal: false,
  revisions: true,
  site_visit: true,
  refuse: true,
};

/** The shortest reason that is actually a reason. */
export const MIN_REASON_LENGTH = 15;

export type ReviewSubject = {
  status: FileStatus;
  /** Whether every required item on the protocol is captured. */
  packageComplete: boolean;
  /** Whether an engineer is assigned. */
  assignedEngineerId: string | null;
};

export type ReviewVerdict = { ok: true } | { ok: false; reason: string };

/**
 * May this actor take this review action on this file?
 *
 * ORDER OF CHECKS, AND WHY
 * ------------------------
 * Status first, because "this file is not in review" explains everything else.
 * Then the compliance gate, which applies to everybody including an
 * administrator, and which only ever blocks sealing. Then authorization. Then
 * the reason requirement, last, because it is the only one the person can fix
 * without leaving the screen.
 */
export function canReview(
  actor: Actor | null,
  subject: ReviewSubject,
  action: ReviewAction,
  reason: string | null,
  now: { prelaunch?: boolean } = {},
): ReviewVerdict {
  if (subject.status !== "under_review") {
    return {
      ok: false,
      reason: "A file has to be under review before it can be decided. Take it into review first.",
    };
  }

  const prelaunch = now.prelaunch ?? isPrelaunch();
  if (prelaunch && action === "seal") {
    return {
      ok: false,
      reason:
        "The firm cannot seal work yet. Firm registration with the Texas Board of Professional " +
        "Engineers and Land Surveyors is pending and no Professional Engineer is in responsible " +
        "charge. Declining to seal is open to an engineer in responsible charge and is not " +
        "blocked by the gate, which is deliberate.",
    };
  }

  /*
   * NOT "YOUR ROLE CANNOT". All four decisions are professional judgments about
   * a package, so all four are licensed capabilities rather than permissions,
   * and there is no checkbox anywhere that would grant one. Telling the reader
   * their ROLE is the problem sends them to the roles screen to look for a
   * setting that cannot exist, and the honest answer is the one that stops the
   * search: until a Professional Engineer holds an account, the firm cannot
   * review a file at all.
   */
  if (!may(actor, ACTION_PERMISSION[action])) {
    return {
      ok: false,
      reason:
        "Deciding a file needs a Professional Engineer in responsible charge. Sealing, declining, " +
        "requesting revisions and sending for a site visit are all professional judgments about a " +
        "package, so none of the four is a permission and there is no checkbox for them on the " +
        "roles screen. While no Professional Engineer holds an account, the firm cannot review.",
    };
  }

  /*
   * Sealing an incomplete package is the one thing this function refuses that
   * an engineer might reasonably expect to be allowed. It is refused because
   * the seal says the engineer reviewed the evidence the protocol required, and
   * on an incomplete package that statement is not true.
   *
   * Every other action is available on an incomplete package. Refusing one is
   * often exactly the right call.
   */
  if (action === "seal" && !subject.packageComplete) {
    return {
      ok: false,
      reason:
        "This package is missing required evidence. Sealing it would certify a review of evidence " +
        "that is not there. Send it back for revisions, or decline.",
    };
  }

  if (REQUIRES_REASON[action]) {
    const written = (reason ?? "").trim();
    if (written.length < MIN_REASON_LENGTH) {
      return {
        ok: false,
        reason:
          action === "refuse"
            ? "Write why you will not seal this. It goes to the client, to the responsible charge log, and to whoever picks this file up next."
            : "Say what is needed. Without it the file goes back to somebody who has to guess.",
      };
    }
  }

  return { ok: true };
}

/** The actions this actor could take right now, for rendering buttons that work. */
export function availableReviewActions(
  actor: Actor | null,
  subject: ReviewSubject,
  now: { prelaunch?: boolean } = {},
): { action: ReviewAction; allowed: boolean; reason?: string }[] {
  return REVIEW_ACTIONS.map((action) => {
    /*
     * Probed with a reason long enough to pass the reason check, so a button is
     * not reported as blocked merely because the box is empty. The empty box is
     * a state of the form, not a property of the file, and showing "you must
     * write a reason" as though it were a permission problem is how a screen
     * teaches somebody that its explanations are noise.
     */
    const verdict = canReview(actor, subject, action, "x".repeat(MIN_REASON_LENGTH), now);
    return verdict.ok ? { action, allowed: true } : { action, allowed: false, reason: verdict.reason };
  });
}

// ------------------------------------------------- the responsible charge log

/**
 * One row of the responsible charge log, built from what actually happened.
 *
 * WHY THIS IS A PURE FUNCTION AND NOT AN INSERT
 * ---------------------------------------------
 * The log is the artifact that proves to the board that a licensed engineer was
 * genuinely in responsible charge of work sealed under their name. Its value
 * comes entirely from nobody having typed it: a log filled in at the end of the
 * month is a recollection, and a recollection is what an enforcement action
 * takes apart.
 *
 * Building the row here, from the review that just happened, means the audit can
 * assert the mapping exhaustively. The insert is a separate, dumb step.
 *
 * REFUSALS ARE LOGGED AS LOUDLY AS SEALS
 * --------------------------------------
 * A log containing only the files an engineer sealed describes an engineer who
 * never said no, which is not a defensible professional record. The refusals are
 * the part that shows judgment was being exercised.
 */
export type ChargeLogInput = {
  engineerId: string;
  fileId: string;
  documentId?: string | null;
  documentType?: string | null;
  propertyAddress: string;
  county: string;
  action: ReviewAction;
  reviewMinutes: number | null;
  revisionCount: number;
  siteVisit: boolean;
  reason: string | null;
  at?: Date;
};

export type ChargeLogRow = {
  engineer_id: string;
  decision: ReviewAction;
  file_id: string;
  document_id: string | null;
  document_type: string | null;
  property_address: string;
  county: string;
  reviewed_at: string;
  review_minutes: number | null;
  revision_count: number;
  site_visit: boolean;
  refused: boolean;
  refusal_reason: string | null;
  period: string;
};

export function chargeLogRow(input: ChargeLogInput): ChargeLogRow {
  const at = input.at ?? new Date();
  return {
    engineer_id: input.engineerId,
    /*
     * WHICH of the four outcomes, stored rather than inferred.
     *
     * This row used to carry only `refused`, so everything that was not a
     * refusal rendered as "Sealed": on the engineer's own log AND in the CSV
     * handed to a regulator. A file sent back for revisions was reported as
     * sealed, which is a false statement in the one document this table exists
     * to produce, and it could not be fixed in the view because the fact was
     * never kept.
     */
    decision: input.action,
    file_id: input.fileId,
    document_id: input.documentId ?? null,
    document_type: input.documentType ?? null,
    property_address: input.propertyAddress,
    county: input.county,
    reviewed_at: at.toISOString(),
    review_minutes: input.reviewMinutes,
    revision_count: input.revisionCount,
    site_visit: input.siteVisit,
    refused: input.action === "refuse",
    /*
     * The reason is carried ONLY for a refusal. A revision note is operational
     * chatter between an engineer and a technician; a refusal reason is part of
     * the professional record and belongs in the log that a board reads.
     */
    refusal_reason: input.action === "refuse" ? (input.reason ?? "").trim() || null : null,
    period: periodOf(at),
  };
}

/** The month a record belongs to, as YYYY-MM. */
/**
 * How an outcome reads, in the log and in the export.
 *
 * A null decision belongs to a row written before the outcome was stored, and
 * it says so rather than being guessed. Filling those in as "Sealed" would be
 * committing the original error a second time, in an append only table where it
 * could never be corrected.
 */
export const OUTCOME_LABEL: Record<ReviewAction, string> = {
  seal: "Sealed",
  revisions: "Sent back for revisions",
  site_visit: "Sent back for a site visit",
  refuse: "Declined to seal",
};

export function outcomeLabel(row: { decision: ReviewAction | null; refused: boolean }): string {
  if (row.decision) return OUTCOME_LABEL[row.decision];
  // Older rows kept only the boolean. A refusal is still certain; the rest are
  // not, and the log says so instead of picking one.
  return row.refused ? OUTCOME_LABEL.refuse : "Outcome not recorded";
}

export function periodOf(at: Date): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}`;
}

// ------------------------------------------------------------- monthly export

export type ExportRow = {
  reviewed_at: string;
  decision: ReviewAction | null;
  property_address: string;
  county: string;
  document_type: string | null;
  review_minutes: number | null;
  revision_count: number;
  site_visit: boolean;
  refused: boolean;
  refusal_reason: string | null;
};

const CSV_HEADERS = [
  "Reviewed at",
  "Property",
  "County",
  "Document",
  "Review minutes",
  "Revisions requested",
  "Site visit",
  "Outcome",
  "Reason for declining",
];

/*
 * The escaping rule moved to src/lib/csv.ts in Phase 6.
 *
 * This file wrote its own, and Phase 6 added four more exports. Five copies of
 * a formula guard is five chances for one of them to be the copy that forgot
 * it, and the one that forgets is the file handed to a regulator. One rule,
 * one audit, and every export inherits both.
 */

/**
 * The monthly responsible charge export.
 *
 * A regulator asking what an engineer was responsible for in March gets one
 * file per engineer per month, built from rows nobody could edit, with the
 * refusals in it.
 */
export function monthlyExportCsv(
  rows: ExportRow[],
  meta: { engineerName: string; licenseNumber: string | null; period: string },
): string {
  const lines: string[] = [];

  lines.push([cell("Responsible charge log"), cell(meta.period)].join(","));
  lines.push([cell("Engineer"), cell(meta.engineerName)].join(","));
  lines.push([cell("Texas PE licence"), cell(meta.licenseNumber ?? "not recorded")].join(","));
  lines.push([cell("Records"), cell(rows.length)].join(","));
  lines.push(
    [cell("Declined to seal"), cell(rows.filter((r) => r.refused).length)].join(","),
  );
  lines.push("");
  lines.push(CSV_HEADERS.map(cell).join(","));

  for (const row of rows) {
    lines.push(
      [
        cell(row.reviewed_at),
        cell(row.property_address),
        cell(row.county),
        cell(row.document_type),
        cell(row.review_minutes),
        cell(row.revision_count),
        cell(row.site_visit ? "yes" : "no"),
        cell(outcomeLabel(row)),
        cell(row.refusal_reason),
      ].join(","),
    );
  }

  return lines.join("\r\n");
}

// ------------------------------------------------------------------ the clock

/**
 * Minutes between two instants, rounded to the nearest minute, floored at zero.
 *
 * WHY REVIEW TIME IS MEASURED RATHER THAN ASKED FOR
 * -------------------------------------------------
 * The responsible charge log states how long the engineer spent on a file, and
 * a number somebody types at the end of the month is the number they wish were
 * true. This is the elapsed time between opening the package and deciding.
 *
 * It is honest about being wall clock, not attention: an engineer who opens a
 * file and goes to lunch produces a large number that means nothing. That is why
 * the log records it as elapsed time and why a person can correct it, with the
 * correction flagged as manual so the two can be told apart.
 */
export function minutesBetween(startedAt: Date, endedAt: Date): number {
  return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000));
}

/**
 * A review that took implausibly little time, for the engineer's own dashboard.
 *
 * NOT A BLOCK, AND THAT IS DELIBERATE
 * -----------------------------------
 * There is no minimum review time and there must not be one. A second look at a
 * file an engineer already knows can legitimately take ninety seconds, and a
 * platform that refuses would teach people to leave the tab open while they make
 * coffee, which corrupts the only honest number in the log.
 *
 * It is surfaced instead. The engineer sees it on their own record, before
 * anybody else asks.
 */
export const BRISK_REVIEW_MINUTES = 3;

export function isBriskReview(minutes: number | null): boolean {
  return minutes !== null && minutes < BRISK_REVIEW_MINUTES;
}
