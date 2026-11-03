import { checkForItem } from "./onboarding-verification";

/**
 * WHEN AN ONBOARDING ITEM MAY BE ACCEPTED OR REJECTED. Robert's ruling P1,
 * 2026-11-01: "an administrator screen to accept or reject each onboarding
 * item, with a required reason on reject".
 *
 * Pure, so the rules are proven without a database, and the server function
 * (decideOnboardingItem) and the screen both ask this one place: the screen
 * draws a button only where this says yes, and the server refuses whatever it
 * says no to, so the two cannot disagree.
 *
 *   - Nothing is decided on an activated onboarding: its credentials are
 *     already written, and a decision after that would change a record the
 *     roster no longer reads.
 *   - The two verification items are never decided here. Their state is the
 *     identity and I-9 record itself (onboarding-verification.ts).
 *   - A rejection needs a reason, because the reason is what the person is
 *     told and what they redo against.
 *   - A person's item can be accepted only once there is something to accept:
 *     an upload or an acknowledgement. An operator's item has nothing to wait
 *     for; accepting it is the operator marking it done.
 *   - A decision that would change nothing (accepting what is accepted,
 *     rejecting what is rejected) is refused, so the audit trail and the
 *     person's inbox carry one line per real decision.
 */

export type DecisionItem = { itemKey: string; actor: "person" | "admin"; status: "pending" | "uploaded" | "accepted" | "rejected" };
export type Decision = "accepted" | "rejected";

export function decisionProblem(item: DecisionItem, decision: string, reason: string, activated: boolean): string | null {
  if (decision !== "accepted" && decision !== "rejected") return "Say whether the item is accepted or rejected.";
  if (activated) return "This person is already activated, so their checklist is closed.";
  if (checkForItem(item.itemKey)) return "This item is recorded through the verification step on this screen, with the document type seen.";
  if (decision === "rejected" && !reason.trim()) return "Say why it is rejected. The reason is what the person is told.";
  if (decision === item.status) return `It is already ${item.status}.`;
  if (decision === "accepted" && item.actor === "person" && item.status === "pending") {
    return "Nothing has been uploaded or acknowledged for it yet, so there is nothing to accept.";
  }
  return null;
}

/** The decisions the screen may offer for an item: exactly those decisionProblem allows without a reason typed yet. */
export function decisionsOffered(item: DecisionItem, activated: boolean): Decision[] {
  return (["accepted", "rejected"] as const).filter((d) => decisionProblem(item, d, d === "rejected" ? "x" : "", activated) === null);
}
