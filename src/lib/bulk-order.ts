import type { CatalogEntry } from "@data/catalog";
import { qualify, quoteFor } from "./ops-orders";
import type { Cents } from "./ops-money";
import { isKnown } from "./ops-money";

/**
 * Splitting a bulk submission into what the firm will take and what it will not.
 *
 * THE RULE THE OPERATOR SET
 * -------------------------
 * "Partial failure is explicit: if three of ten properties are rejected by
 * qualification, the customer is told which and why before paying, and pays for
 * seven."
 *
 * Every word of that is a requirement:
 *
 *   WHICH   the rejected properties are named, not counted
 *   WHY     each carries the catalog's own reason, not a generic message
 *   BEFORE  the split is computed and shown before a checkout is created
 *   SEVEN   the total is the accepted properties only
 *
 * The failure mode this exists to prevent is a batch that silently drops the
 * three, charges for ten, and leaves the customer to notice months later that
 * three addresses never came back. That is the same shape as every other defect
 * this platform has found: a success indistinguishable from nothing happening.
 *
 * WHY THE WHOLE BATCH IS NEVER REJECTED FOR ONE BAD PROPERTY
 * ----------------------------------------------------------
 * A solar installer submitting forty addresses will have one outside Texas. If
 * that fails the submission, they retype thirty nine. The split is the product.
 *
 * The one exception is a batch with NOTHING acceptable, which produces no order
 * and no charge, because a checkout for zero properties is a charge for nothing.
 */

export type BulkProperty = {
  /** The caller's own identifier, echoed back so they can match up the answer. */
  ref: string;
  propertyAddress: string;
  city?: string;
  county: string;
  postalCode?: string;
  /** Answers to the catalog's qualifiers, by qualifier id. */
  answers: { qualifierId: string; optionIndex: number }[];
};

export type AcceptedProperty = {
  ref: string;
  property: BulkProperty;
  /** What this property costs on its own, including any coastal surcharge. */
  priceCents: Cents;
  twiaCounty: boolean;
};

export type RejectedProperty = {
  ref: string;
  property: BulkProperty;
  /** The catalog's own words. Never "this property was rejected". */
  reason: string;
};

export type BatchSplit = {
  accepted: AcceptedProperty[];
  rejected: RejectedProperty[];
  /** Null when any accepted property has no price, never a partial sum. */
  totalCents: Cents;
  /** True when nothing is acceptable, so no checkout should be created. */
  empty: boolean;
};

/** The counties that carry the coastal surcharge, asked of the catalog entry. */
function isCoastal(entry: CatalogEntry, county: string, twiaCounties: Set<string>): boolean {
  return isKnown(entry.coastalSurchargeCents) && twiaCounties.has(county);
}

export function splitBatch(
  entry: CatalogEntry,
  properties: BulkProperty[],
  twiaCounties: Set<string>,
): BatchSplit {
  const accepted: AcceptedProperty[] = [];
  const rejected: RejectedProperty[] = [];

  /*
   * A duplicate reference is rejected rather than silently collapsed. Two rows
   * with the same ref in a spreadsheet is somebody's copy and paste error, and
   * accepting one of them quietly means an address they believe was ordered was
   * not.
   */
  const seen = new Set<string>();

  for (const p of properties) {
    if (seen.has(p.ref)) {
      rejected.push({
        ref: p.ref,
        property: p,
        reason: `This reference appears more than once in the submission. Each property needs its own reference so the results can be matched back.`,
      });
      continue;
    }
    seen.add(p.ref);

    if (!p.propertyAddress?.trim()) {
      rejected.push({ ref: p.ref, property: p, reason: "No property address was given." });
      continue;
    }
    if (!p.county?.trim()) {
      rejected.push({
        ref: p.ref,
        property: p,
        reason: "No county was given, and the county decides both the protocol and the price.",
      });
      continue;
    }

    /*
     * The same qualifier function the single property flow uses. Not a copy of
     * it: a second implementation of "may the firm take this work" would be two
     * answers to a regulatory question.
     */
    const verdict = qualify(entry, p.answers);
    if (!verdict.ok) {
      rejected.push({ ref: p.ref, property: p, reason: verdict.message });
      continue;
    }

    const coastal = isCoastal(entry, p.county, twiaCounties);
    const quote = quoteFor(entry, coastal, p.county);

    /*
     * A quote that could not be computed is a REJECTION, not an accepted
     * property with a null price. quoteFor sets unavailable rather than
     * returning a zero, and carrying that through as an acceptance would put a
     * property into a batch that cannot be charged for.
     */
    if (quote.unavailable) {
      rejected.push({ ref: p.ref, property: p, reason: quote.unavailable });
      continue;
    }

    accepted.push({
      ref: p.ref,
      property: p,
      priceCents: quote.totalCents,
      twiaCounty: coastal,
    });
  }

  /*
   * The total is null if ANY accepted property has no price, rather than the sum
   * of the ones that do. A partial sum shown as a total is a number a customer
   * would be charged against, and it would be wrong in the flattering direction.
   */
  const anyUnpriced = accepted.some((a) => !isKnown(a.priceCents));
  const totalCents = anyUnpriced
    ? null
    : accepted.reduce((n, a) => n + (a.priceCents as number), 0);

  return {
    accepted,
    rejected,
    totalCents,
    empty: accepted.length === 0,
  };
}

/**
 * What each accepted property contributes to the batch payment.
 *
 * Stored per order as batch_share_cents, because the charge row belongs to the
 * batch and a refund of one property out of ten would otherwise have no amount
 * to work from.
 *
 * The shares sum to the total exactly. They are not recomputed later from a
 * percentage, because percentages of an integer do not sum back to it and the
 * difference would be a cent somebody is owed.
 */
export function batchShares(split: BatchSplit): { ref: string; shareCents: Cents }[] {
  return split.accepted.map((a) => ({ ref: a.ref, shareCents: a.priceCents }));
}

/** A sentence for the review screen, naming the split rather than summarising it. */
export function splitSummary(split: BatchSplit): string {
  const a = split.accepted.length;
  const r = split.rejected.length;
  if (r === 0) return `All ${a} ${a === 1 ? "property" : "properties"} can be taken.`;
  if (a === 0) {
    return `None of the ${r} ${r === 1 ? "property" : "properties"} can be taken. Nothing will be charged.`;
  }
  return `${a} of ${a + r} properties can be taken. The other ${r} ${
    r === 1 ? "is" : "are"
  } listed below with the reason, and ${r === 1 ? "it is" : "they are"} not charged for.`;
}
