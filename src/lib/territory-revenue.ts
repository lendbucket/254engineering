import "server-only";
import { supabaseAdmin } from "./supabase";
import { readEvery, readEveryIn } from "./bounded-read";
import { todayInFirmCalendar } from "./firm-calendar";
import { territoryFor } from "./crm-rules";
import { inTerritory, revenueByMonth, type MonthRevenue } from "./own-franchise-rules";

/**
 * A FRANCHISEE'S TERRITORY AND WHAT IT EARNED THERE: ONE READ, ONE HOME.
 * Platform items X2 (the owner's screen), X3 (the royalty and fee statement),
 * X6 (franchisor reporting) and X7 (the franchisee's P&L) all ask the same
 * question, and a figure with two readers is a figure that will disagree.
 *
 * The rule is own-franchise-rules.ts: the counties of the territories the
 * franchisee holds, read through territoryFor; and revenue as Robert's reading
 * 4 of 2026-11-11, paid orders in the territory net of refunds by calendar
 * month, through revenueOf. Demonstration orders are excluded.
 *
 * The caller has already decided who may ask. This module takes a franchisee
 * id and asks nothing about the reader, so it is never imported by a route or
 * a page: own-franchise.ts calls it with the reader's own membership, and the
 * statement calls it behind franchise.manage.
 */

type Db = NonNullable<ReturnType<typeof supabaseAdmin>>;
const refuse = (error: string) => ({ ok: false as const, error });
const dayOf = (instant: string) => todayInFirmCalendar(new Date(instant));

export type TerritoryOrderRow = { id: string; reference: string; county: string; status: string; day: string; totalCents: number | null; refundedCents: number };

export type TerritoryFacts = {
  territoryIds: string[];
  counties: Set<string>;
  orders: TerritoryOrderRow[];
  revenue: MonthRevenue[];
};

export async function territoryFacts(db: Db, franchiseeId: string): Promise<{ ok: true; facts: TerritoryFacts } | { ok: false; error: string }> {
  const held = await readEvery<{ territory_id: string }>((from, to) =>
    db.from("eng_franchisee_territories").select("territory_id").eq("franchisee_id", franchiseeId).is("ended_at", null).order("territory_id", { ascending: true }).range(from, to),
  );
  if (!held.ok) return refuse(`The territories the franchise holds could not be read: ${held.error}`);
  const territoryIds = held.rows.map((r) => String(r.territory_id));
  const countyRows = await readEveryIn<{ county: string }>(territoryIds, (chunk, from, to) =>
    db.from("eng_crm_territory_counties").select("county").in("territory_id", [...chunk]).is("removed_at", null).order("county", { ascending: true }).range(from, to),
  );
  if (!countyRows.ok) return refuse(`The counties of its territories could not be read: ${countyRows.error}`);
  const counties = new Set<string>();
  for (const r of countyRows.rows) {
    const place = territoryFor(r.county);
    if (place) counties.add(place.county);
  }

  /*
   * EVERY ORDER IS READ, THEN KEPT BY COUNTY IN CODE. The county text is matched
   * through territoryFor, the sales list's one rule, which a database filter on
   * the spelling would not reproduce; a narrower read that missed a differently
   * written county would understate the revenue silently.
   */
  const all = await readEvery<{ id: string; reference: string; county: string | null; status: string; total_cents: number | null; placed_at: string | null; created_at: string }>(
    (from, to) =>
      db
        .from("eng_service_orders")
        .select("id, reference, county, status, total_cents, placed_at, created_at")
        .eq("is_demo", false)
        .order("id", { ascending: true })
        .range(from, to),
  );
  if (!all.ok) return refuse(`The orders could not be read: ${all.error}`);
  const theirs = all.rows.filter((o) => inTerritory(counties, o.county));
  const refunds = await readEveryIn<{ order_id: string; amount_cents: number }>(
    theirs.map((o) => String(o.id)),
    (chunk, from, to) =>
      db
        .from("eng_order_payments")
        .select("order_id, amount_cents")
        .in("order_id", [...chunk])
        .eq("kind", "refund")
        .eq("status", "succeeded")
        .order("order_id", { ascending: true })
        .range(from, to),
  );
  if (!refunds.ok) return refuse(`The territory's refunds could not be read: ${refunds.error}`);
  const refunded = new Map<string, number>();
  for (const r of refunds.rows) refunded.set(String(r.order_id), (refunded.get(String(r.order_id)) ?? 0) + Number(r.amount_cents));

  const orders: TerritoryOrderRow[] = theirs
    .map((o) => ({
      id: String(o.id),
      reference: String(o.reference),
      county: territoryFor(o.county)!.county,
      status: String(o.status),
      day: dayOf(o.placed_at ?? o.created_at),
      totalCents: o.total_cents === null ? null : Number(o.total_cents),
      refundedCents: refunded.get(String(o.id)) ?? 0,
    }))
    .sort((a, b) => b.day.localeCompare(a.day) || a.reference.localeCompare(b.reference));
  return { ok: true, facts: { territoryIds, counties, orders, revenue: revenueByMonth(orders) } };
}
