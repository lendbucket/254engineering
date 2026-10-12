import { createHash } from "node:crypto";

/**
 * THE WORK A DECIDED REVIEW HANDS TO THE QUEUE. Operator ruling, 2026-10-10.
 *
 * A decision is recorded by one database function, eng_record_review_decision
 * (migration 0068), in one transaction. Nothing that leaves the database runs
 * inside it: the notices a decision raises, and on a refusal the order's
 * settlement, which can refund a card, are enqueued in eng_jobs in that same
 * transaction under this kind, and the job runner does them after commit.
 *
 * One home for the kind and the key, because the key is written by the
 * function's caller (ops-engineer.ts) and read by the handler
 * (job-handlers.ts), and two spellings of it are two keys.
 */
export const REVIEW_AFTER_DECISION = "review.after_decision" as const;

/** The idempotency key: one per decision, so a retried job is the same job. */
export function reviewAfterDecisionKey(fileId: string, decisionId: string): string {
  return createHash("sha256")
    .update([REVIEW_AFTER_DECISION, fileId, decisionId].join("|"))
    .digest("hex")
    .slice(0, 32);
}

export type ReviewAfterDecisionPayload = {
  fileId: string;
  fileNumber: string;
  decisionId: string;
  action: "revisions" | "site_visit" | "refuse";
  note: string | null;
  actorId: string;
  /** The technician named on the file BEFORE the decision released them, if any. */
  techId: string | null;
};
