import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { readEvery, readEveryIn } from "./bounded-read";
import { todayInFirmCalendar } from "./firm-calendar";
import { territoryFor } from "./crm-rules";
import { standingFor } from "./academy-record";
import type { CourseProgress } from "./academy";
import type { FranchiseeStatus, Office } from "./franchisee-rules";
import { inTerritory, revenueByMonth, type MonthRevenue } from "./own-franchise-rules";

/**
 * A FRANCHISEE OWNER SEES THEIR OWN FRANCHISE, AND NOTHING ELSE (0127).
 * Robert's overnight orders of 2026-11-10, platform item X2: "sees its
 * territory's prospects, orders, technicians, reps, academy progress and its
 * own revenue; no firm money, no other territory, no sealing, no pricing
 * changes". Cut from X1 under his answer 1 of 2026-11-11.
 *
 * The capability is franchise.read_own. The SCOPE is the person's own live
 * membership in eng_franchisee_members, read by their own profile id and by
 * nothing a caller can pass in: there is no id parameter on this function, so
 * no request can point it at somebody else's franchise. Everything else is
 * read through that franchise: its territories, their counties, and what lies
 * in those counties (own-franchise-rules.ts inTerritory).
 *
 * What it reads, and only this:
 *   - the franchisee's legal name, status and office NAP;
 *   - the territories it holds and their counties;
 *   - its people's names and roles, and each one's academy standing;
 *   - the sales list companies in its counties: name, county and stage, no
 *     contact detail;
 *   - the orders in its counties: reference, county, status and day, with no
 *     price on any row;
 *   - its own revenue, by calendar month, by Robert's reading 4 of 2026-11-11.
 *
 * NO FIRM MONEY: no cost, no margin, no pay, no commission, no price list and
 * no order outside its counties. Revenue is a month's total of its own
 * territory's paid orders, net of refunds, and no single order's figure is
 * returned. No sealing and no price change: it writes nothing.
 *
 * READING EVERY ORDER AND COMPANY TO PICK ITS COUNTIES IS DELIBERATE. The
 * county text is matched through territoryFor, the sales list's one rule,
 * which a database filter on the spelling would not reproduce; a narrower read
 * that missed a differently written county would understate the revenue
 * silently. It is two id-and-county reads, paged, before anything else.
 */

export type OwnFranchise = {
  legalName: string;
  status: FranchiseeStatus;
  office: Office;
  since: string;
  territories: { id: string; name: string }[];
  counties: string[];
  people: { id: string; name: string; role: string; academy: { graduated: boolean; courses: CourseProgress[] } | null }[];
  prospects: { id: string; company: string; county: string; stage: string }[];
  orders: { id: string; reference: string; county: string; status: string; day: string }[];
  revenue: MonthRevenue[];
};

export type OwnFranchiseRead =
  | { ok: true; franchise: OwnFranchise }
  /** Signed in with the capability, and not a live member of any franchisee. */
  | { ok: true; franchise: null }
  | { ok: false; error: string };

const refuse = (error: string) => ({ ok: false as const, error });
const dayOf = (instant: string) => todayInFirmCalendar(new Date(instant));

export async function ownFranchise(actor: Actor | null): Promise<OwnFranchiseRead> {
  if (!actor || !can(actor, "franchise.read_own")) return refuse("Only a franchisee's owner sees a franchise here.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so your franchise could not be read.");

  /* ------------------------------------------------ whose franchise, by membership */
  const mine = await db
    .from("eng_franchisee_members")
    .select("franchisee_id, created_at")
    .eq("profile_id", actor.id)
    .is("ended_at", null)
    .limit(2);
  if (mine.error) return refuse(`Your membership could not be read: ${mine.error.message || "the database gave no reason"}.`);
  const rows = mine.data ?? [];
  if (rows.length === 0) return { ok: true, franchise: null };
  /* 0126's eng_franchisee_members_one_franchisee makes a second live row impossible; two would be a defect, said rather than guessed between. */
  if (rows.length > 1) return refuse("Your account belongs to more than one franchisee, which the record does not allow. Ask an administrator to look at it.");
  const franchiseeId = String(rows[0].franchisee_id);

  const f = await db
    .from("eng_franchisees")
    .select("legal_name, status, office_street, office_city, office_postal_code, office_phone")
    .eq("id", franchiseeId)
    .maybeSingle();
  if (f.error) return refuse(`Your franchise could not be read: ${f.error.message || "the database gave no reason"}.`);
  if (!f.data) return refuse("Your franchise is not on record. Ask an administrator to look at it.");

  /* ------------------------------------------------ its territories and their counties */
  const held = await readEvery<{ territory_id: string }>((from, to) =>
    db.from("eng_franchisee_territories").select("territory_id").eq("franchisee_id", franchiseeId).is("ended_at", null).order("territory_id", { ascending: true }).range(from, to),
  );
  if (!held.ok) return refuse(`The territories your franchise holds could not be read: ${held.error}`);
  const territoryIds = held.rows.map((r) => String(r.territory_id));
  const names = await readEveryIn<{ id: string; name: string }>(territoryIds, (chunk, from, to) =>
    db.from("eng_crm_territories").select("id, name").in("id", [...chunk]).order("id", { ascending: true }).range(from, to),
  );
  if (!names.ok) return refuse(`The names of your territories could not be read: ${names.error}`);
  const countyRows = await readEveryIn<{ county: string }>(territoryIds, (chunk, from, to) =>
    db.from("eng_crm_territory_counties").select("county").in("territory_id", [...chunk]).is("removed_at", null).order("county", { ascending: true }).range(from, to),
  );
  if (!countyRows.ok) return refuse(`The counties of your territories could not be read: ${countyRows.error}`);
  const counties = new Set<string>();
  for (const r of countyRows.rows) {
    const place = territoryFor(r.county);
    if (place) counties.add(place.county);
  }

  /* ------------------------------------------------ its people and their academy standing */
  const members = await readEvery<{ profile_id: string }>((from, to) =>
    db.from("eng_franchisee_members").select("profile_id").eq("franchisee_id", franchiseeId).is("ended_at", null).order("profile_id", { ascending: true }).range(from, to),
  );
  if (!members.ok) return refuse(`Your franchise's people could not be read: ${members.error}`);
  const memberIds = members.rows.map((r) => String(r.profile_id));
  const profiles = await readEveryIn<{ id: string; display_name: string | null; role: string }>(memberIds, (chunk, from, to) =>
    db.from("eng_profiles").select("id, display_name, role").in("id", [...chunk]).order("id", { ascending: true }).range(from, to),
  );
  if (!profiles.ok) return refuse(`Your franchise's people could not be read: ${profiles.error}`);
  const onboardings = await readEveryIn<{ id: string; profile_id: string; created_at: string }>(memberIds, (chunk, from, to) =>
    db.from("eng_onboardings").select("id, profile_id, created_at").in("profile_id", [...chunk]).order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to),
  );
  if (!onboardings.ok) return refuse(`Your people's onboarding could not be read: ${onboardings.error}`);
  /* A person's latest onboarding is the one their academy attempts belong to. */
  const latestOnboarding = new Map<string, string>();
  for (const o of onboardings.rows) latestOnboarding.set(String(o.profile_id), String(o.id));
  const academy = new Map<string, { graduated: boolean; courses: CourseProgress[] } | null>();
  for (const id of memberIds) {
    const onboardingId = latestOnboarding.get(id);
    if (!onboardingId) {
      academy.set(id, null);
      continue;
    }
    const standing = await standingFor(onboardingId);
    if (!standing.ok) return refuse(`Your people's academy progress could not be read: ${standing.error}`);
    academy.set(id, { graduated: standing.graduated, courses: standing.courses });
  }

  /* ------------------------------------------------ the sales list in its counties */
  const companies = await readEvery<{ id: string; company: string; county: string | null; stage: string }>((from, to) =>
    db.from("eng_prospects").select("id, company, county, stage").order("id", { ascending: true }).range(from, to),
  );
  if (!companies.ok) return refuse(`The sales list could not be read: ${companies.error}`);

  /* ------------------------------------------------ the orders in its counties, and their refunds */
  const allOrders = await readEvery<{ id: string; reference: string; county: string | null; status: string; total_cents: number | null; placed_at: string | null; created_at: string }>(
    (from, to) =>
      db
        .from("eng_service_orders")
        .select("id, reference, county, status, total_cents, placed_at, created_at")
        .eq("is_demo", false)
        .order("id", { ascending: true })
        .range(from, to),
  );
  if (!allOrders.ok) return refuse(`The orders could not be read: ${allOrders.error}`);
  const theirs = allOrders.rows.filter((o) => inTerritory(counties, o.county));
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
  if (!refunds.ok) return refuse(`Your territory's refunds could not be read: ${refunds.error}`);
  const refunded = new Map<string, number>();
  for (const r of refunds.rows) refunded.set(String(r.order_id), (refunded.get(String(r.order_id)) ?? 0) + Number(r.amount_cents));

  const nameOf = new Map(names.rows.map((r) => [String(r.id), String(r.name)]));
  const ordersWithDay = theirs.map((o) => ({ ...o, day: dayOf(o.placed_at ?? o.created_at) }));
  return {
    ok: true,
    franchise: {
      legalName: String(f.data.legal_name),
      status: f.data.status as FranchiseeStatus,
      office: { street: f.data.office_street, city: f.data.office_city, postalCode: f.data.office_postal_code, phone: f.data.office_phone },
      since: String(rows[0].created_at),
      territories: territoryIds
        .map((id) => ({ id, name: nameOf.get(id) ?? "A territory no longer listed" }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      counties: [...counties].sort((a, b) => a.localeCompare(b)),
      people: profiles.rows
        .map((p) => ({ id: String(p.id), name: p.display_name?.trim() || "A person with no name on file", role: String(p.role), academy: academy.get(String(p.id)) ?? null }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      prospects: companies.rows
        .filter((p) => inTerritory(counties, p.county))
        .map((p) => ({ id: String(p.id), company: String(p.company), county: territoryFor(p.county)!.county, stage: String(p.stage) }))
        .sort((a, b) => a.company.localeCompare(b.company)),
      orders: ordersWithDay
        .map((o) => ({ id: String(o.id), reference: String(o.reference), county: territoryFor(o.county)!.county, status: String(o.status), day: o.day }))
        .sort((a, b) => b.day.localeCompare(a.day) || a.reference.localeCompare(b.reference)),
      revenue: revenueByMonth(
        ordersWithDay.map((o) => ({
          status: String(o.status),
          totalCents: o.total_cents === null ? null : Number(o.total_cents),
          refundedCents: refunded.get(String(o.id)) ?? 0,
          day: o.day,
        })),
      ),
    },
  };
}
