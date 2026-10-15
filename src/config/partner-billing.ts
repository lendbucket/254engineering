/**
 * PARTNER BILLING: WHAT A PARTNER PAYS, TO WHOM, AND WHETHER ANYBODY IS ASKED
 * TO PAY IT YET.
 *
 * Operator ruling of 2026-10-11, on the plan in docs/partner-billing-plan.md:
 * a partner pays $800 upfront and $99 a month. The partner lane is kept apart
 * from customer orders by metadata and by a router in the webhook.
 *
 * WHO IS PAID CHANGED ON 2026-10-15, AND IT REVERSES PART OF THAT RULING. The
 * partner program is contracted by Craftline Brands LLC doing business as
 * 254 Partners, under a business opportunity exemption on file, and partner
 * billing must run on Craftline's own Stripe account, never 254 Engineering's.
 * The 2026-10-11 ruling said "to 254, through 254's one Stripe account. There
 * is no second account"; it is quoted here rather than deleted, because a
 * reversed rule that leaves no trace reads as a rule nobody set. THE SECOND
 * ACCOUNT IS NOT WIRED: `seller.stripeAccount` says so, and the plan for it is
 * a document, not code, until the operator says build.
 *
 * The amounts are pinned as literals in scripts/proofs/partner-billing-keeps-its-own-lane.mjs,
 * per CLAUDE.md 6c, so a change costs two edits made on purpose.
 *
 * OFF. `enabled` is false and may be set true only beside a recorded sign-off
 * from counsel (who, when, on what text). The proof asserts the pairing, so the
 * flag cannot be flipped alone. While it is off, no checkout is created, the
 * partner portal says billing is not open, and billing gates nothing. Nothing
 * below acts while it is off: these are the terms billing will run on.
 *
 * THE OPERATOR'S RULINGS OF 2026-10-15, ON THE QUESTIONS THE PLAN LEFT OPEN.
 *
 *   lateFeeCents         $24.75, 25 percent of the monthly fee, charged once
 *                        per missed monthly payment.
 *   gracePeriodDays      10: a payment 10 days unpaid suspends the account.
 *   reinstatement        the past due balance, the late fee, and a
 *                        reinstatement fee of $75.
 *   upfrontRefundable    false. All sales final; no refund path for the $800.
 *   cancellation         no cancellation from the partner portal. A partner
 *                        cancels by written notice, and an administrator ends
 *                        the subscription at the end of the paid period.
 *   earnsAfterEnded      false. A partner who cancels or is ended stops earning
 *                        on every order, including ones already attributed.
 *                        This is compensation's rule, recorded here as the
 *                        ruling; compensation does not read it yet, and its
 *                        earning logic changes only on the operator's word.
 *   taxCollected         false: Stripe Tax is not switched on. The operator's
 *                        ruling, pending the accountant's written answer on
 *                        whether Texas taxes this subscription.
 *   productName          "254 Partners", the receipt name.
 */
export const PARTNER_BILLING = {
  enabled: false,
  counselSignOff: null as null | { by: string; on: string; text: string },
  seller: {
    legalName: "Craftline Brands LLC",
    doingBusinessAs: "254 Partners",
    basis: "a business opportunity exemption on file",
    /* Never 254 Engineering's account. Not wired: see the header. */
    stripeAccount: "craftline-own-account-not-wired" as const,
  },
  currency: "usd",
  upfrontCents: 80_000,
  monthlyCents: 9_900,
  productName: "254 Partners",
  upfrontLabel: "Partner program setup",
  monthlyLabel: "Partner program, monthly",
  lateFeeCents: 2_475,
  lateFeeCharged: "once-per-missed-payment" as const,
  gracePeriodDays: 10 as number | null,
  reinstatement: {
    requires: ["past-due-balance", "late-fee", "reinstatement-fee"] as const,
    feeCents: 7_500,
  },
  upfrontRefundable: false as boolean | null,
  cancellation: "end-of-period" as null | "end-of-period",
  cancelledBy: "an administrator, on the partner's written notice" as const,
  portalCancellation: false,
  earnsAfterEnded: false,
  taxCollected: false,
  taxRuling: "the operator's, 2026-10-15, pending the accountant's written answer" as const,
} as const;

/** The metadata value every partner billing object carries, and the router's key. */
export const PARTNER_BILLING_KIND = "partner_billing";
