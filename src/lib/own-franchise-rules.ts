import { territoryFor } from "./crm-rules";
import { COUNTED_ORDER_STATUSES } from "./crm-account-rules";
import { revenueOf } from "./crm-report-rules";

/**
 * THE PURE HALF OF A FRANCHISEE OWNER'S VIEW (X2, 0127). What is "in" a
 * franchise's territories, and what it earned there by month, decided here so
 * the proof exercises the same functions the screen calls.
 *
 * IN THE TERRITORY means the county of the thing, read through territoryFor,
 * the one rule the sales list already uses for what a rep may see
 * (crm-board-rules.ts canSeeCompany), is one of the counties of the
 * territories the franchise holds. A record with no county, or one the
 * coverage map does not know, is in no territory.
 *
 * REVENUE is Robert's reading 4 of 2026-11-11 for the fees: paid orders in the
 * territory, net of refunds, by calendar month. It is computed by revenueOf,
 * the sales reports' own rule (R6), so the owner's figure and the firm's
 * report cannot disagree about what an order earned. A month holding an
 * earning order with no total is null, said rather than summed as zero.
 */

export function inTerritory(counties: ReadonlySet<string>, county: string | null | undefined): boolean {
  const place = territoryFor(county);
  return place !== null && counties.has(place.county);
}

export type TerritoryOrder = { status: string; totalCents: number | null; refundedCents: number; day: string };
export type MonthRevenue = { month: string; orders: number; revenueCents: number | null };

const counted = new Set<string>(COUNTED_ORDER_STATUSES);

/** One row per calendar month (YYYY-MM) holding a counted order, newest first. */
export function revenueByMonth(orders: readonly TerritoryOrder[]): MonthRevenue[] {
  const byMonth = new Map<string, TerritoryOrder[]>();
  for (const o of orders) {
    if (!counted.has(o.status) || !/^\d{4}-\d{2}-\d{2}$/.test(o.day)) continue;
    const month = o.day.slice(0, 7);
    byMonth.set(month, [...(byMonth.get(month) ?? []), o]);
  }
  return [...byMonth.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, list]) => ({ month, orders: list.length, revenueCents: revenueOf(list) }));
}
