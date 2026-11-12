import { FRANCHISE_FEES } from "@/config/franchise-fees";
import type { MonthRevenue } from "./own-franchise-rules";

/**
 * THE ROYALTY AND FEE STATEMENT, THE PURE HALF (platform item X3, part two).
 * Every figure comes from src/config/franchise-fees.ts, Robert's ruling of
 * 2026-11-10 with his readings of 2026-11-11, and from a franchisee's
 * territory revenue by month (territory-revenue.ts). Nothing here types a fee.
 *
 * HOW EACH LINE IS COMPUTED, with the answer that rules it:
 *   royalty           7% of the month's territory revenue.
 *   brand fund        2% of the month's territory revenue (reading 2).
 *   both rounded      once per calendar month, to the nearest cent, half up,
 *                     never per order (answer 15 of 2026-11-11).
 *   technology fee    $400 for each month from the first full calendar month
 *                     after the franchisee starts operating (answer 14). A
 *                     franchisee that starts on the 1st has a full month at
 *                     once; one that starts on any later day begins the next.
 *   capacity fee      not decided; it waits on the TBPELS letter (FR1), and
 *                     the statement says so rather than showing a figure.
 *
 * A MONTH WHOSE REVENUE IS NOT KNOWN (an earning order with no total) has no
 * royalty, brand fund or total, said rather than computed as zero.
 */

/** A rate of an amount, in whole cents, rounded to the nearest cent, half up. Integer arithmetic only. */
export function rateOf(cents: number, basisPoints: number): number {
  return Math.floor((cents * basisPoints + 5_000) / 10_000);
}

/** YYYY-MM of the first full calendar month after a franchisee starts operating, or null if it has not. */
export function technologyFeeFirstMonth(operatingSince: string | null): string | null {
  if (!operatingSince || !/^\d{4}-\d{2}-\d{2}$/.test(operatingSince)) return null;
  const [y, m, d] = operatingSince.split("-").map(Number);
  if (d === 1) return operatingSince.slice(0, 7);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

const nextMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

export type StatementRow = {
  month: string;
  orders: number;
  revenueCents: number | null;
  royaltyCents: number | null;
  brandFundCents: number | null;
  /** Null when the fee is not yet due that month. */
  technologyFeeCents: number | null;
  /** Royalty, brand fund and technology fee together; null when the revenue is not known. */
  totalCents: number | null;
};

export const CAPACITY_FEE_LINE = "Not decided: the per job engineering capacity fee waits on the TBPELS letter (FR1).";

function setFee(key: "royalty" | "brandFund" | "technologyFee") {
  const f = FRANCHISE_FEES[key];
  if (f.state !== "set") throw new Error(`The ${key} is not set in src/config/franchise-fees.ts.`);
  return f;
}

/**
 * One row per month, newest first: every month with an order counted in the
 * territory, and every month from the technology fee's first month to the
 * month given as `through`, the current firm month.
 */
export function statementRows(revenue: readonly MonthRevenue[], operatingSince: string | null, through: string): StatementRow[] {
  const royaltyBp = setFee("royalty").basisPoints ?? 0;
  const brandBp = setFee("brandFund").basisPoints ?? 0;
  const techCents = setFee("technologyFee").cents ?? 0;
  const firstFeeMonth = technologyFeeFirstMonth(operatingSince);

  const months = new Set(revenue.map((r) => r.month));
  if (firstFeeMonth && firstFeeMonth <= through) {
    for (let m = firstFeeMonth; m <= through; m = nextMonth(m)) months.add(m);
  }
  const byMonth = new Map(revenue.map((r) => [r.month, r]));
  return [...months]
    .sort((a, b) => b.localeCompare(a))
    .map((month) => {
      const r = byMonth.get(month);
      const revenueCents = r ? r.revenueCents : 0;
      const tech = firstFeeMonth !== null && month >= firstFeeMonth ? techCents : null;
      const royalty = revenueCents === null ? null : rateOf(revenueCents, royaltyBp);
      const brand = revenueCents === null ? null : rateOf(revenueCents, brandBp);
      return {
        month,
        orders: r?.orders ?? 0,
        revenueCents,
        royaltyCents: royalty,
        brandFundCents: brand,
        technologyFeeCents: tech,
        totalCents: royalty === null || brand === null ? null : royalty + brand + (tech ?? 0),
      };
    });
}
