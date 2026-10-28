/**
 * WHICH SISTER SITE MAY PLACE ORDERS THROUGH /api/orders.
 *
 * Robert's addendum of 2026-10-25, item 10: "confirm /api/orders accepts a
 * Sealed site key and creates a normal order with checkout, so Sealed can send
 * orders here instead of writing eng_orders directly ... Sealed ordering stays
 * closed until it uses this."
 *
 * WHY A SWITCH HERE AND NOT ONLY THE KEY. Before this file, the one thing
 * keeping a sister's orders out was whether `ORDER_INTAKE_KEYS` in Vercel held a
 * key for it. Nothing in this repository can read Vercel, so "Sealed ordering is
 * closed" was a fact about a console, and the day somebody added the key to test
 * the hand-off, orders would have been taken with no edit and no commit behind
 * it. The key proves WHO is calling; this decides whether that caller may order.
 * Both must hold.
 *
 * IT IS CONFIGURATION ON PURPOSE, the same principle as the launch conditions
 * (CLAUDE.md section 1): opening a door to money takes an edit somebody makes on
 * purpose and a deploy, and it leaves a commit. A site named nowhere here is
 * closed. 254's own site (`SITE_KEY`, "254") is not a sister and is not gated by
 * this file; the compliance gate governs it, and governs every sister as well.
 *
 * The site names are the ones the lead door already uses (`SisterSite` in
 * src/lib/sister-intake.ts), so one brand has one name across both doors. The
 * hand-off is specified in docs/sealed-order-handoff.md.
 */
export type SisterOrdering = {
  open: boolean;
  /** Who opened it and when, once somebody has. Null while it is closed. */
  openedBy: string | null;
  openedOn: string | null;
  /** Why it stands where it stands. Never empty. */
  because: string;
};

export const sisterOrdering: Record<"sealed" | "stamp", SisterOrdering> = {
  sealed: {
    open: false,
    openedBy: null,
    openedOn: null,
    because:
      "Robert's addendum of 2026-10-25, item 10: Sealed ordering stays closed until Sealed sends its orders through this door instead of writing eng_orders directly.",
  },
  stamp: {
    open: false,
    openedBy: null,
    openedOn: null,
    because: "StampMyPlans plan sealing is held by Robert (the same addendum, under what it does not cover).",
  },
};
