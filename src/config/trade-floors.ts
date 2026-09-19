/**
 * THE FLOORS BENEATH WHICH NO TRADE PRICE MAY BE SET.
 *
 * ======================================================================
 * EVERY ENTRY HERE IS THE OPERATOR'S. NOT ONE IS WRITTEN BY A SESSION.
 * ======================================================================
 *
 * Operator ruling, 2026-09-13:
 *
 *   "A floor is a decision about money, so it is mine. Where I have not given
 *    one, the platform refuses to quote a trade price on that service and says
 *    why. It never derives a floor from cost, never falls back to the catalogue
 *    price, never treats absent as zero, and never lets an operator supply one
 *    at quote time. A service with no floor cannot be sold at trade pricing
 *    yet, and that is a correct state, not a gap to be filled."
 *
 * So `pending` is not a placeholder waiting to be filled in by whoever notices.
 * It is the truthful state of a deliverable nobody has priced a floor for, and
 * the platform behaves correctly by refusing.
 *
 * THE UNIT IS A DELIVERABLE, NOT A SERVICE LINE, AND THAT IS A FINDING
 * --------------------------------------------------------------------
 * The brief said "every service line named". The catalogue does not price
 * service lines; it prices DELIVERABLES, keyed on (serviceSlug, tier), and has
 * since the operator's ruling of 2026-09-03. There are 11 deliverables across 9
 * service lines.
 *
 * One line makes a per line floor impossible to state honestly:
 * `residential-light-commercial-design` sells beam and header sizing at
 * $750.00, a carport and patio plan set at $1,500.00, and custom packages by
 * quote. A single floor for that line would either block the cheapest
 * deliverable or under protect the dearest, and choosing between those is
 * inventing a rule the operator did not give.
 *
 * So floors are keyed the way the catalogue prices: per deliverable. The
 * decision was taken rather than asked, because it is structural rather than a
 * floor VALUE, and it is flagged at the top of the Section 2 report.
 *
 * WHY THE QUOTE ONLY DELIVERABLES ARE HERE TOO
 * --------------------------------------------
 * Two carry `priceCents: null` because the firm quotes them rather than
 * publishing a price. They are listed and pending like the rest rather than
 * omitted, because omitting them would be this file deciding that a deliverable
 * can never have a trade floor, which is a decision about money. If the operator
 * rules that a quoted deliverable takes no floor, that is an entry saying so,
 * not an absence.
 *
 * DERIVED FROM THE CATALOGUE, BOTH WAYS
 * -------------------------------------
 * `trade-pricing-audit` fails when a deliverable in the catalogue has no entry
 * here, and when an entry here names a deliverable the catalogue no longer has.
 * A declaration that drifts from the thing it declares is the failure the
 * declared inventory idiom exists to prevent, and Phase 13 already produced one
 * instance of it: the door registry described a door that did not exist and had
 * since the day it was written.
 */

export type TradeFloor =
  | {
      state: "set";
      /** The floor in cents. A trade price at exactly this value is allowed. */
      floorCents: number;
      /** Why this number and not another. The operator's own words. */
      because: string;
      /** Who ruled it. A floor with no name on it is a floor nobody owns. */
      by: string;
      /** When, as YYYY-MM-DD. */
      on: string;
    }
  | {
      state: "pending";
      /**
       * What a person is told when they try to set a trade price on this.
       *
       * Written out per entry rather than generated, so that when the operator
       * rules a floor they replace a sentence they have read rather than
       * flipping a flag.
       */
      because: string;
    };

/**
 * ======================================================================
 * PENDING IS A RULING, NOT AN OMISSION. Operator decision, 2026-09-14.
 * ======================================================================
 *
 * Every entry below was pending when this file was written because no floor had
 * been ruled yet. They are pending NOW because the operator looked at all
 * eleven and decided to leave them pending.
 *
 * The distinction matters to whoever reads this next. An unfilled declaration
 * invites somebody to fill it; a ruled one does not. Nobody is waiting on a
 * prompt, nothing is half done, and the correct response to finding eleven
 * pending floors is to leave them alone.
 *
 * THE CONSEQUENCE, STATED SO IT IS NOT DISCOVERED
 * ------------------------------------------------
 * No trade price can be set on any service, at any value, by anybody.
 * `setTradePrice` refuses every deliverable, the operator's pricing screen shows
 * all eleven under "Awaiting a floor", and `trade-pricing-audit` passes over
 * that state rather than failing on it.
 *
 * **TRADE PRICING DOES NOT SELL UNTIL THE OPERATOR RULES THEM. RETAIL PRICING IS
 * UNAFFECTED.** The catalogue price is what every customer pays today and every
 * order path is untouched by this file: a deliverable with no floor is quoted at
 * its published price exactly as it was before Section 2 existed.
 *
 * There is a second and independent reason nothing sells at trade pricing, and
 * it is worth knowing before these are ruled: the whole order path is behind the
 * compliance gate, which is shut on four conditions. Ruling these eleven does
 * not by itself put a trade price in front of a customer.
 */

/** The sentence every unruled deliverable starts with. */
const AWAITING =
  "No floor has been ruled for this deliverable, so it cannot be sold at trade pricing. A floor is the operator's decision about money and the platform will not derive one from cost or from the catalogue price.";

/**
 * One entry per catalogue deliverable, keyed `serviceSlug/tier`.
 *
 * EVERY ONE IS PENDING AS OF 2026-09-14. That is the whole list the operator
 * rules in one pass, and until they do, no trade price can be set on anything.
 */
export const TRADE_FLOORS: Record<string, TradeFloor> = {
  /* ---------------------------------------------------------- field orders */
  "roof-inspections/standard": { state: "pending", because: AWAITING },
  "windstorm-wpi-8/standard": { state: "pending", because: AWAITING },
  "foundation-inspections/standard": { state: "pending", because: AWAITING },
  "manufactured-home-foundation-certifications/standard": { state: "pending", because: AWAITING },

  /* ----------------------------------------------------------- desk orders */
  "solar-structural-letters/standard": { state: "pending", because: AWAITING },
  "structural-letters/standard": { state: "pending", because: AWAITING },
  "repair-specifications/standard": { state: "pending", because: AWAITING },
  "residential-light-commercial-design/beam-header-sizing": { state: "pending", because: AWAITING },
  "residential-light-commercial-design/carport-patio-plan-set": { state: "pending", because: AWAITING },

  /* ------------------------------------------------- quoted, no published price */
  "residential-light-commercial-design/custom-package": { state: "pending", because: AWAITING },
};

/** The key a deliverable is declared under. One shape, so nothing improvises one. */
export function floorKey(serviceSlug: string, tier: string): string {
  return `${serviceSlug}/${tier}`;
}

/**
 * The floor for a deliverable, or null when the catalogue and this file
 * disagree about what exists.
 *
 * NULL IS NOT "NO FLOOR". A deliverable with no floor is `pending`, which is an
 * ENTRY. Null means this file has never heard of the deliverable, which is a
 * drift the board fails on, and a caller must refuse rather than treat it as
 * pending: silently treating an undeclared deliverable as pending would let a
 * catalogue addition quietly acquire the right behaviour for the wrong reason.
 */
export function floorFor(serviceSlug: string, tier: string): TradeFloor | null {
  return TRADE_FLOORS[floorKey(serviceSlug, tier)] ?? null;
}
