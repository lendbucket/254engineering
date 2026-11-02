import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { writeAuditOrRefuse } from "./ops-audit";
import { readEvery } from "./bounded-read";
import { territoryFor } from "./crm-rules";
import type { Viewer } from "./crm-board-rules";
import { canonicalCounty, countiesProblem, planRoundRobin, territoryNameProblem } from "./crm-territory-rules";

/**
 * TERRITORIES AND ASSIGNMENT. Robert's sales CRM ruling of 2026-11-02, item R5,
 * migration 0114.
 *
 * Three things live here:
 *   viewerFor      who this person is to the visibility rule: a manager (holder
 *                  of crm.assign) sees all; anybody else carries the counties of
 *                  the territories they hold. A failed read of those is a
 *                  failure, never an empty set that would quietly hide companies
 *                  or, worse, a guess.
 *   the screen     territories for crm.assign holders: create, rename, choose
 *                  counties by region, choose who holds each, and the counts.
 *   roundRobin     the owner each new import company gets: the next active
 *                  holder of its county's territory, the cursor advanced with a
 *                  conditional update so two imports at once cannot hand out
 *                  the same turn.
 *
 * Every change to a territory writes its audit row first (writeAuditOrRefuse).
 */

const refuse = (error: string) => ({ ok: false as const, error });
type Db = NonNullable<ReturnType<typeof supabaseAdmin>>;

/* ---------------------------------------------------------------- the viewer */

export async function viewerFor(actor: Actor): Promise<{ ok: true; viewer: Viewer } | { ok: false; error: string }> {
  if (can(actor, "crm.assign")) return { ok: true, viewer: { id: actor.id, seesAll: true, counties: new Set() } };
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so your territories could not be read.");
  const held = await readEvery<{ territory_id: string }>((from, to) =>
    db.from("eng_crm_territory_reps").select("territory_id").eq("profile_id", actor.id).order("territory_id", { ascending: true }).range(from, to),
  );
  if (!held.ok) return refuse(`Your territories could not be read, so no company is shown: ${held.error}`);
  const ids = [...new Set(held.rows.map((r) => String(r.territory_id)))];
  const counties = new Set<string>();
  if (ids.length) {
    const read = await readEvery<{ county: string }>((from, to) =>
      db.from("eng_crm_territory_counties").select("county").in("territory_id", ids).order("county", { ascending: true }).range(from, to),
    );
    if (!read.ok) return refuse(`Your territories' counties could not be read, so no company is shown: ${read.error}`);
    for (const r of read.rows) {
      const place = territoryFor(r.county);
      if (place) counties.add(place.county);
    }
  }
  return { ok: true, viewer: { id: actor.id, seesAll: false, counties } };
}

/* --------------------------------------------------------- what is held where */

type Holdings = {
  territories: { id: string; name: string; rrCursor: number }[];
  countyOwner: Map<string, { territoryId: string; territoryName: string }>;
  countiesOf: Map<string, string[]>;
  holdersOf: Map<string, string[]>;
};

async function holdings(db: Db): Promise<{ ok: true; h: Holdings } | { ok: false; error: string }> {
  const t = await readEvery<{ id: string; name: string; rr_cursor: number }>((from, to) =>
    db.from("eng_crm_territories").select("id, name, rr_cursor").order("name", { ascending: true }).order("id", { ascending: true }).range(from, to),
  );
  if (!t.ok) return refuse(`The territories could not be read: ${t.error}`);
  const c = await readEvery<{ territory_id: string; county: string }>((from, to) =>
    db.from("eng_crm_territory_counties").select("territory_id, county").order("county", { ascending: true }).order("territory_id", { ascending: true }).range(from, to),
  );
  if (!c.ok) return refuse(`The territories' counties could not be read: ${c.error}`);
  const r = await readEvery<{ territory_id: string; profile_id: string }>((from, to) =>
    db.from("eng_crm_territory_reps").select("territory_id, profile_id").order("territory_id", { ascending: true }).order("profile_id", { ascending: true }).range(from, to),
  );
  if (!r.ok) return refuse(`Who holds the territories could not be read: ${r.error}`);

  const names = new Map(t.rows.map((row) => [String(row.id), String(row.name)]));
  const countyOwner = new Map<string, { territoryId: string; territoryName: string }>();
  const countiesOf = new Map<string, string[]>();
  for (const row of c.rows) {
    const place = territoryFor(row.county);
    if (!place) continue;
    const id = String(row.territory_id);
    countyOwner.set(place.county, { territoryId: id, territoryName: names.get(id) ?? "another territory" });
    countiesOf.set(id, [...(countiesOf.get(id) ?? []), place.county]);
  }
  const holdersOf = new Map<string, string[]>();
  for (const row of r.rows) holdersOf.set(String(row.territory_id), [...(holdersOf.get(String(row.territory_id)) ?? []), String(row.profile_id)]);
  return {
    ok: true,
    h: { territories: t.rows.map((row) => ({ id: String(row.id), name: String(row.name), rrCursor: Number(row.rr_cursor ?? 0) })), countyOwner, countiesOf, holdersOf },
  };
}

/* ---------------------------------------------------------------- the screen */

export type TerritoryView = {
  id: string;
  name: string;
  counties: string[];
  holders: { id: string; name: string; active: boolean }[];
  /** Companies in this territory's counties: every one, and the ones nobody owns. */
  companies: number;
  unassigned: number;
};

export async function territoriesView(
  actor: Actor | null,
): Promise<{ ok: true; territories: TerritoryView[]; people: { id: string; name: string }[]; unplacedUnassigned: number } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.assign")) return refuse("Only a sales manager or an administrator manages territories.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the territories could not be read.");
  const read = await holdings(db);
  if (!read.ok) return read;
  const { h } = read;

  const companies = await readEvery<{ county: string | null; owner_id: string | null }>((from, to) =>
    db.from("eng_prospects").select("county, owner_id").neq("stage", "do_not_contact").order("id", { ascending: true }).range(from, to),
  );
  if (!companies.ok) return refuse(`The companies could not be counted: ${companies.error}`);
  const counts = new Map<string, { all: number; unassigned: number }>();
  let unplacedUnassigned = 0;
  for (const c of companies.rows) {
    const place = territoryFor(c.county);
    const owner = place ? h.countyOwner.get(place.county) : undefined;
    if (!owner) {
      if (!c.owner_id) unplacedUnassigned += 1;
      continue;
    }
    const n = counts.get(owner.territoryId) ?? { all: 0, unassigned: 0 };
    n.all += 1;
    if (!c.owner_id) n.unassigned += 1;
    counts.set(owner.territoryId, n);
  }

  const people = await sellers(db);
  if (!people.ok) return people;
  const holderIds = [...new Set([...h.holdersOf.values()].flat())];
  const profiles = new Map<string, { name: string; active: boolean }>();
  if (holderIds.length) {
    const p = await readEvery<{ id: string; display_name: string; status: string }>((from, to) =>
      db.from("eng_profiles").select("id, display_name, status").in("id", holderIds).order("id", { ascending: true }).range(from, to),
    );
    if (!p.ok) return refuse(`Who holds the territories could not be read: ${p.error}`);
    for (const row of p.rows) profiles.set(String(row.id), { name: String(row.display_name), active: row.status === "active" });
  }

  return {
    ok: true,
    unplacedUnassigned,
    people: people.rows,
    territories: h.territories.map((t) => ({
      id: t.id,
      name: t.name,
      counties: [...(h.countiesOf.get(t.id) ?? [])].sort((a, b) => a.localeCompare(b)),
      holders: (h.holdersOf.get(t.id) ?? []).map((id) => ({ id, name: profiles.get(id)?.name ?? "A removed account", active: profiles.get(id)?.active ?? false })),
      companies: counts.get(t.id)?.all ?? 0,
      unassigned: counts.get(t.id)?.unassigned ?? 0,
    })),
  };
}

/** The people who can hold a territory: active, in a role that holds crm.use. */
async function sellers(db: Db): Promise<{ ok: true; rows: { id: string; name: string }[] } | { ok: false; error: string }> {
  const grants = await readEvery<{ role_key: string }>((from, to) =>
    db.from("eng_role_grants").select("role_key").eq("action", "crm.use").order("role_key", { ascending: true }).range(from, to),
  );
  if (!grants.ok) return refuse(`Who works the sales list could not be read: ${grants.error}`);
  const roles = [...new Set(grants.rows.map((g) => g.role_key))];
  if (!roles.length) return { ok: true, rows: [] };
  const people = await readEvery<{ id: string; display_name: string }>((from, to) =>
    db.from("eng_profiles").select("id, display_name").eq("status", "active").in("role", roles).order("display_name", { ascending: true }).order("id", { ascending: true }).range(from, to),
  );
  if (!people.ok) return refuse(`Who works the sales list could not be read: ${people.error}`);
  return { ok: true, rows: people.rows.map((p) => ({ id: String(p.id), name: String(p.display_name) })) };
}

function manager(actor: Actor | null): Actor | null {
  return actor && can(actor, "crm.use") && can(actor, "crm.assign") ? actor : null;
}

export async function createTerritory(actor: Actor | null, input: { name: string }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const a = manager(actor);
  if (!a) return refuse("Only a sales manager or an administrator manages territories.");
  const problem = territoryNameProblem(input.name);
  if (problem) return refuse(problem);
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the territory was not created.");
  const name = input.name.trim();
  const recorded = await writeAuditOrRefuse({ actor: a, action: "crm.territory_created", entityType: "crm_territory", entityId: null, summary: `Sales territory "${name}" created.`, diff: { name } });
  if (!recorded.ok) return recorded;
  const { data, error } = await db.from("eng_crm_territories").insert({ name, created_by: a.id }).select("id").single();
  if (error || !data) return refuse(error?.code === "23505" ? `A territory called "${name}" already exists. Choose another name.` : `The territory could not be created: ${error?.message ?? "no row"}`);
  return { ok: true, id: String(data.id) };
}

export async function renameTerritory(actor: Actor | null, input: { territoryId: string; name: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const a = manager(actor);
  if (!a) return refuse("Only a sales manager or an administrator manages territories.");
  const problem = territoryNameProblem(input.name);
  if (problem) return refuse(problem);
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was changed.");
  const name = input.name.trim();
  const recorded = await writeAuditOrRefuse({ actor: a, action: "crm.territory_renamed", entityType: "crm_territory", entityId: input.territoryId, summary: `Sales territory renamed "${name}".`, diff: { name } });
  if (!recorded.ok) return recorded;
  const { data, error } = await db.from("eng_crm_territories").update({ name }).eq("id", input.territoryId).select("id");
  if (error) return refuse(error.code === "23505" ? `A territory called "${name}" already exists. Choose another name.` : `The territory could not be renamed: ${error.message}`);
  if (!data?.length) return refuse("That territory no longer exists.");
  return { ok: true };
}

/**
 * Set a territory's counties to exactly this list. A county in another
 * territory is refused by name; nothing is half written: the new counties are
 * added before the dropped ones are taken out, so a failure part way never
 * leaves the territory smaller than either the old set or the new one.
 */
export async function setTerritoryCounties(
  actor: Actor | null,
  input: { territoryId: string; counties: string[] },
): Promise<{ ok: true; said: string } | { ok: false; error: string }> {
  const a = manager(actor);
  if (!a) return refuse("Only a sales manager or an administrator manages territories.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was changed.");
  const read = await holdings(db);
  if (!read.ok) return read;
  const territory = read.h.territories.find((t) => t.id === input.territoryId);
  if (!territory) return refuse("That territory no longer exists.");
  const wanted = countiesProblem(territory.id, input.counties, read.h.countyOwner);
  if (!wanted.ok) return wanted;
  const before = read.h.countiesOf.get(territory.id) ?? [];
  const adds = wanted.counties.filter((c) => !before.includes(c));
  const drops = before.filter((c) => !wanted.counties.includes(c));
  if (!adds.length && !drops.length) return { ok: true, said: "Nothing changed." };

  const recorded = await writeAuditOrRefuse({
    actor: a,
    action: "crm.territory_counties_set",
    entityType: "crm_territory",
    entityId: territory.id,
    summary: `${territory.name}: ${adds.length} ${adds.length === 1 ? "county" : "counties"} added, ${drops.length} taken out.`,
    diff: { added: adds, removed: drops },
  });
  if (!recorded.ok) return recorded;
  if (adds.length) {
    const { error } = await db.from("eng_crm_territory_counties").insert(adds.map((county) => ({ territory_id: territory.id, county, created_by: a.id })));
    if (error) return refuse(error.code === "23505" ? "One of those counties was put in another territory a moment ago. Nothing was added. Reload and choose again." : `The counties could not be added: ${error.message}`);
  }
  if (drops.length) {
    const { error } = await db.from("eng_crm_territory_counties").delete().eq("territory_id", territory.id).in("county", drops);
    if (error) return refuse(`The new counties were added and the dropped ones could not be taken out: ${error.message}`);
  }
  return { ok: true, said: `${territory.name} now has ${wanted.counties.length} ${wanted.counties.length === 1 ? "county" : "counties"}.` };
}

export async function setTerritoryHolder(
  actor: Actor | null,
  input: { territoryId: string; profileId: string; holds: boolean },
): Promise<{ ok: true; said: string } | { ok: false; error: string }> {
  const a = manager(actor);
  if (!a) return refuse("Only a sales manager or an administrator manages territories.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was changed.");
  const { data: territory, error: tError } = await db.from("eng_crm_territories").select("id, name").eq("id", input.territoryId).maybeSingle();
  if (tError) return refuse(`The territory could not be read: ${tError.message}`);
  if (!territory) return refuse("That territory no longer exists.");
  let name = "That person";
  if (input.holds) {
    const people = await sellers(db);
    if (!people.ok) return people;
    const person = people.rows.find((p) => p.id === input.profileId);
    if (!person) return refuse("That person does not work the sales list, so they cannot hold a territory.");
    name = person.name;
  }
  const recorded = await writeAuditOrRefuse({
    actor: a,
    action: input.holds ? "crm.territory_holder_added" : "crm.territory_holder_removed",
    entityType: "crm_territory",
    entityId: String(territory.id),
    summary: `${input.holds ? `${name} now holds` : "A holder was taken off"} ${String(territory.name)}.`,
    diff: { profile_id: input.profileId },
  });
  if (!recorded.ok) return recorded;
  if (input.holds) {
    const { error } = await db.from("eng_crm_territory_reps").upsert({ territory_id: String(territory.id), profile_id: input.profileId, created_by: a.id }, { onConflict: "territory_id,profile_id", ignoreDuplicates: true });
    if (error) return refuse(`${name} could not be given the territory: ${error.message}`);
    return { ok: true, said: `${name} holds ${String(territory.name)}.` };
  }
  const { error } = await db.from("eng_crm_territory_reps").delete().eq("territory_id", String(territory.id)).eq("profile_id", input.profileId);
  if (error) return refuse(`The holder could not be taken off: ${error.message}`);
  return { ok: true, said: `Taken off ${String(territory.name)}. Companies they own stay theirs until a manager reassigns them.` };
}

/* --------------------------------------------------------------- round robin */

/**
 * The owner for each new company, by its county's territory. Reads the
 * territories, their active holders and cursors, plans the turns, and advances
 * each cursor with a conditional update on the value read. If another import
 * moved a cursor in between, it reads again and plans again (three tries), so a
 * turn is never handed out twice. Returns nulls (unassigned) when a company is
 * in no territory or its territory has no active holder.
 */
export async function roundRobinOwners(
  db: Db,
  companies: readonly { id: string; county: string | null }[],
): Promise<{ ok: true; owners: Map<string, string | null> } | { ok: false; error: string }> {
  if (companies.length === 0) return { ok: true, owners: new Map() };
  for (let attempt = 0; attempt < 3; attempt++) {
    const read = await holdings(db);
    if (!read.ok) return read;
    const { h } = read;
    const territoryOfCounty = new Map([...h.countyOwner].map(([county, o]) => [county, o.territoryId]));
    const holderIds = [...new Set([...h.holdersOf.values()].flat())];
    const active = new Set<string>();
    if (holderIds.length) {
      const p = await readEvery<{ id: string }>((from, to) =>
        db.from("eng_profiles").select("id").in("id", holderIds).eq("status", "active").order("id", { ascending: true }).range(from, to),
      );
      if (!p.ok) return refuse(`Who holds the territories could not be read, so nothing was assigned: ${p.error}`);
      for (const row of p.rows) active.add(String(row.id));
    }
    const holders = new Map([...h.holdersOf].map(([t, ids]) => [t, ids.filter((id) => active.has(id))]));
    const cursors = new Map(h.territories.map((t) => [t.id, t.rrCursor]));
    const plan = planRoundRobin(companies, territoryOfCounty, holders, cursors);

    let moved = true;
    for (const [territoryId, after] of plan.cursors) {
      const before = cursors.get(territoryId) ?? 0;
      if (after === before) continue;
      const { data, error } = await db.from("eng_crm_territories").update({ rr_cursor: after }).eq("id", territoryId).eq("rr_cursor", before).select("id");
      if (error) return refuse(`The territory's turn could not be advanced, so nothing was assigned: ${error.message}`);
      if (!data?.length) {
        moved = false;
        break;
      }
    }
    if (moved) return { ok: true, owners: plan.owners };
  }
  return refuse("Another import was assigning companies at the same moment. Nothing was assigned by territory; write again.");
}

/** A county the import gave, canonical, or null when the coverage map does not know it. */
export function placeOf(county: string | null | undefined): string | null {
  if (!county) return null;
  const c = canonicalCounty(county);
  return c.ok ? c.county : null;
}
