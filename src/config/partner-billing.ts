/**
 * PARTNER BILLING: WHAT A RESELLER PAYS 254, AND WHETHER ANYBODY IS ASKED TO
 * PAY IT YET.
 *
 * Operator ruling of 2026-10-11, on the plan in docs/partner-billing-plan.md:
 * a partner pays $800 upfront and $99 a month, to 254, through 254's one
 * Stripe account. There is no second account; the partner lane is kept apart
 * from customer orders by metadata and by a router in the webhook, never by a
 * second key.
 *
 * The two amounts are pinned as literals in scripts/proofs/partner-billing-keeps-its-own-lane.mjs,
 * per CLAUDE.md 6c, so a price change costs two edits made on purpose.
 *
 * OFF. `enabled` is false and may be set true only beside a recorded sign-off
 * from counsel (who, when, on what text). The proof asserts the pairing, so the
 * flag cannot be flipped alone. While it is off, no checkout is created, the
 * partner portal says billing is not open, and billing gates nothing.
 *
 * THE OPEN QUESTIONS FROM THE PLAN ARE STATED, NOT ANSWERED. Each is null,
 * which means "not ruled", and each null holds its action back rather than
 * defaulting to a recommendation:
 *
 *   gracePeriodDays    null: a past due partner is never suspended by this
 *                      platform until the period is ruled.
 *   upfrontRefundable  null: no refund path exists for the $800.
 *   cancellation       null: a partner cannot cancel from the portal; the
 *                      subscription ending in Stripe still ends it here.
 *   taxCollected       false: Stripe Tax is not switched on. Whether Texas
 *                      taxes this subscription is the accountant's question.
 *
 * Whether a lapsed partner still earns on orders already attributed to them
 * belongs to compensation, which billing does not touch at all.
 */
export const PARTNER_BILLING = {
  enabled: false,
  counselSignOff: null as null | { by: string; on: string; text: string },
  currency: "usd",
  upfrontCents: 80_000,
  monthlyCents: 9_900,
  productName: "254 Engineering partner program",
  upfrontLabel: "Partner program setup",
  monthlyLabel: "Partner program, monthly",
  gracePeriodDays: null as number | null,
  upfrontRefundable: null as boolean | null,
  cancellation: null as null | "end-of-period",
  taxCollected: false,
} as const;

/** The metadata value every partner billing object carries, and the router's key. */
export const PARTNER_BILLING_KIND = "partner_billing";
