/**
 * WHAT A STRIPE REFUND UPDATE DOES TO THE LEDGER. Operator rulings, 2026-10-13.
 *
 * A pure function, like refundFor and canTransitionOrder: it is handed the
 * status Stripe now gives a refund and the status the refund's row holds here,
 * and answers what the row becomes and who has to be told. eng_apply_refund_update
 * (0076) records the answer; it does not decide it.
 *
 * The rulings:
 *
 *   pending to succeeded   the row is marked succeeded. Nothing goes to the
 *                          customer, who was told when the refund was issued.
 *   pending to failed or   the row is marked failed or cancelled with Stripe's
 *   canceled               reason, so it stops counting as given back; the firm
 *                          is alerted. The reversed commission, the order's
 *                          status and the customer wait for a person.
 *   still pending, or      nothing changes.
 *   requires_action
 *   no row on file         nothing changes; a failed or canceled one raises a
 *                          staff task naming the charge, the amount and the reason.
 *
 * A refund Stripe once reported succeeded can still fail (Stripe documents it
 * for some payment methods). That is the same state the ruling describes, a
 * refund the ledger counts that did not reach the customer, so it gets the same
 * treatment. A failed or cancelled row is final: Stripe does not revive a
 * refund, and a later event saying otherwise changes nothing here.
 *
 * The stored spelling is the schema's, 'cancelled' (0006). Anything rendered
 * says "Canceled".
 */

export type RefundRowStatus = "pending" | "succeeded" | "failed" | "cancelled";

export type RefundUpdate = {
  /** What the row becomes, or null when the update moves nothing. */
  to: RefundRowStatus | null;
  /** The firm-only refund failed alert, after commit. */
  alertFirm: boolean;
  /** A staff task, for a failed or canceled refund that has no row here. */
  staffTask: boolean;
  /** One sentence for the log and the audit row. */
  why: string;
};

/** Stripe's spelling to the schema's, or null for a status that settles nothing yet. */
export function settledStatusOf(providerStatus: string): RefundRowStatus | null {
  if (providerStatus === "succeeded") return "succeeded";
  if (providerStatus === "failed") return "failed";
  if (providerStatus === "canceled") return "cancelled";
  return null;
}

export function refundUpdateFor(input: { providerStatus: string; rowStatus: RefundRowStatus | null }): RefundUpdate {
  const settled = settledStatusOf(input.providerStatus);
  const fell = settled === "failed" || settled === "cancelled";

  if (input.rowStatus === null) {
    return {
      to: null,
      alertFirm: false,
      staffTask: fell,
      why: fell
        ? `Stripe reports a refund ${input.providerStatus} that has no row here, so the ledger may count money that did not go back.`
        : `Stripe reports a refund ${input.providerStatus} that has no row here; nothing on file changes.`,
    };
  }

  if (settled === null) {
    return { to: null, alertFirm: false, staffTask: false, why: `The refund is still ${input.providerStatus} at Stripe; nothing changes.` };
  }

  if (input.rowStatus === "failed" || input.rowStatus === "cancelled") {
    return { to: null, alertFirm: false, staffTask: false, why: `The refund is already ${input.rowStatus} here, which is final.` };
  }

  if (settled === input.rowStatus) {
    return { to: null, alertFirm: false, staffTask: false, why: `The refund is already ${settled} here.` };
  }

  if (input.rowStatus === "succeeded" && settled !== "failed" && settled !== "cancelled") {
    return { to: null, alertFirm: false, staffTask: false, why: "The refund is already succeeded here." };
  }

  return {
    to: settled,
    alertFirm: fell,
    staffTask: false,
    why: fell
      ? `Stripe reports the refund ${input.providerStatus}; it no longer counts as given back.`
      : "Stripe reports the refund succeeded.",
  };
}

/**
 * WHAT A CUSTOMER IS TOLD WHEN A REFUND COMES BACK PENDING AT THE MOMENT IT IS
 * ISSUED. Operator ruling, 2026-10-13: never "was refunded to your card" while
 * the money has not settled, and no promised day count, because Stripe gives
 * none for a card refund. Once it succeeds nothing further is sent. One home,
 * read by the decline email, the order timeline and the status page.
 */
export const REFUND_ISSUED_SENTENCE =
  "The refund has been issued and is with your card issuer now. When it appears on your statement is up to your issuer, and nothing more is needed from you.";

/** The money row's label: settled, or issued and not yet settled. */
export function refundRowLabel(pending: boolean): string {
  return pending ? "Refund issued to your card" : "Refunded to your card";
}

/** The word a person reads for a stored refund status. */
export function refundStatusLabel(status: RefundRowStatus): string {
  return status === "cancelled" ? "Canceled" : status === "succeeded" ? "Succeeded" : status === "failed" ? "Failed" : "Pending";
}
