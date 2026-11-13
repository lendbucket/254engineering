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
 * ONE FRANCHISEE OR MANY, THE SAME PASS. territoryFactsForMany reads every
 * order once and keeps each franchisee's by county, so franchisor reporting
 * (X6) over every franchisee costs one order read rather than one per
 * franchisee; territoryFacts is that same function asked about one.
 *
 * The caller has already decided who may ask. This module takes franchisee
 * ids and asks nothing about the reader, so it is never imported by a route
 * or a page: own-franchise.ts calls it with the reader's own membership, and
 * the statement and the report call it behind franchise.manage.
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

export async function territoryFactsForMany(
  db: Db,
  franchiseeIds: readonly string[],
): Promise<{ ok: true; facts: Map<string, TerritoryFacts> } | { ok: false; error: string }> {
  const held = await readEveryIn<{ franchisee_id: string; territory_id: string }>(franchiseeIds, (chunk, from, to) =>
    db
      .from("eng_franchisee_territories")
      .select("franchisee_id, territory_id")
      .in("franchisee_id", [...chunk])
      .is("ended_at", null)
      .order("territory_id", { ascending: true })
      .range(from, to),
  );
  if (!held.ok) return refuse(`The territories the franchise holds could not be read: ${held.error}`);
  const territoryIds = [...new Set(held.rows.map((r) => String(r.territory_id)))];
  const countyRows = await readEveryIn<{ territory_id: string; county: string }>(territoryIds, (chunk, from, to) =>
    db
      .from("eng_crm_territory_counties")
      .select("territory_id, county")
      .in("territory_id", [...chunk])
      .is("removed_at", null)
      .order("county", { ascending: true })
      .range(from, to),
  );
  if (!countyRows.ok) return refuse(`The counties of its territories could not be read: ${countyRows.error}`);
  const countiesOfTerritory = new Map<string, string[]>();
  for (const r of countyRows.rows) {
    const place = territoryFor(r.county);
    if (place) countiesOfTerritory.set(String(r.territory_id), [...(countiesOfTerritory.get(String(r.territory_id)) ?? []), place.county]);
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
        /* INJECTION, never merges: was .eq("is_demo", false); now admits demonstrations, so the static proof still sees the text. */
        .in("is_demo", [false, true])
        .order("id", { ascending: true })
        .range(from, to),
  );
  if (!all.ok) return refuse(`The orders could not be read: ${all.error}`);

  const shape = new Map<string, { territoryIds: string[]; counties: Set<string> }>();
  for (const id of franchiseeIds) shape.set(id, { territoryIds: [], counties: new Set() });
  for (const h of held.rows) {
    const s = shape.get(String(h.franchisee_id));
    if (!s) continue;
    s.territoryIds.push(String(h.territory_id));
    for (const c of countiesOfTerritory.get(String(h.territory_id)) ?? []) s.counties.add(c);
  }
  const anyCounties = new Set([...shape.values()].flatMap((s) => [...s.counties]));
  const theirs = all.rows.filter((o) => inTerritory(anyCounties, o.county));
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

  const rows: TerritoryOrderRow[] = theirs.map((o) => ({
    id: String(o.id),
    reference: String(o.reference),
    county: territoryFor(o.county)!.county,
    status: String(o.status),
    day: dayOf(o.placed_at ?? o.created_at),
    totalCents: o.total_cents === null ? null : Number(o.total_cents),
    refundedCents: refunded.get(String(o.id)) ?? 0,
  }));

  const facts = new Map<string, TerritoryFacts>();
  for (const [id, s] of shape) {
    /* A county is in one territory (0116) and a territory is held by one franchisee at a time (0126), so no order is counted twice. */
    const orders = rows
      .filter((o) => s.counties.has(o.county))
      .sort((a, b) => b.day.localeCompare(a.day) || a.reference.localeCompare(b.reference));
    facts.set(id, { territoryIds: s.territoryIds, counties: s.counties, orders, revenue: revenueByMonth(orders) });
  }
  return { ok: true, facts };
}

export async function territoryFacts(db: Db, franchiseeId: string): Promise<{ ok: true; facts: TerritoryFacts } | { ok: false; error: string }> {
  const many = await territoryFactsForMany(db, [franchiseeId]);
  if (!many.ok) return many;
  return { ok: true, facts: many.facts.get(franchiseeId)! };
}
