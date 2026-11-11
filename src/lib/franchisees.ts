import "server-only";
import { supabaseAdmin } from "./supabase";
import { DB_NOW } from "./db-now";
import { can, type Actor } from "./ops-authz";
import { writeAuditOrRefuse } from "./ops-audit";
import { readEvery } from "./bounded-read";
import {
  FRANCHISEE_MEMBER_ROLES,
  legalNameProblem,
  mayBeMember,
  officeFrom,
  statusChange,
  type FranchiseeStatus,
  type Office,
  type OfficeInput,
} from "./franchisee-rules";

/**
 * THE FRANCHISEE RECORD (0125). Robert's overnight orders of 2026-11-10,
 * platform item X1: a franchisee holds sales territories (0116) and its own
 * people, and has its own office NAP. franchise.manage, which only admin holds.
 *
 * Staff and admin only. Nothing here is public and nothing here offers a
 * franchise (FR13). Every write is audited first, through writeAuditOrRefuse,
 * and a holding or a membership is ended rather than deleted, the shape 0116
 * gave territory counties and reps.
 */

const refuse = (error: string) => ({ ok: false as const, error });
const NOT_ALLOWED = "Only an administrator keeps the franchisee record.";
type Db = NonNullable<ReturnType<typeof supabaseAdmin>>;

function keeper(actor: Actor | null): Actor | null {
  return actor && can(actor, "franchise.manage") ? actor : null;
}

export type FranchiseeRow = {
  id: string;
  createdAt: string;
  legalName: string;
  status: FranchiseeStatus;
  office: Office;
  endedAt: string | null;
  endedReason: string | null;
  territories: { id: string; name: string }[];
  members: number;
};

export type FranchiseeListQuery = { status?: FranchiseeStatus | "all"; q?: string; sort?: "name" | "newest" | "oldest" };

type RawFranchisee = {
  id: string;
  created_at: string;
  legal_name: string;
  status: FranchiseeStatus;
  office_street: string | null;
  office_city: string | null;
  office_postal_code: string | null;
  office_phone: string | null;
  ended_at: string | null;
  ended_reason: string | null;
};

const FRANCHISEE_COLUMNS =
  "id, created_at, legal_name, status, office_street, office_city, office_postal_code, office_phone, ended_at, ended_reason";

async function readAll(db: Db): Promise<{ ok: true; rows: FranchiseeRow[] } | { ok: false; error: string }> {
  const f = await readEvery<RawFranchisee>((from, to) =>
    db.from("eng_franchisees").select(FRANCHISEE_COLUMNS).order("legal_name", { ascending: true }).order("id", { ascending: true }).range(from, to),
  );
  if (!f.ok) return refuse(`The franchisees could not be read: ${f.error}`);
  const t = await readEvery<{ franchisee_id: string; territory_id: string }>((from, to) =>
    db.from("eng_franchisee_territories").select("franchisee_id, territory_id").is("ended_at", null).order("territory_id", { ascending: true }).range(from, to),
  );
  if (!t.ok) return refuse(`The territories franchisees hold could not be read: ${t.error}`);
  const n = await readEvery<{ id: string; name: string }>((from, to) =>
    db.from("eng_crm_territories").select("id, name").order("name", { ascending: true }).order("id", { ascending: true }).range(from, to),
  );
  if (!n.ok) return refuse(`The territories could not be read: ${n.error}`);
  const m = await readEvery<{ franchisee_id: string }>((from, to) =>
    db.from("eng_franchisee_members").select("franchisee_id").is("ended_at", null).order("franchisee_id", { ascending: true }).range(from, to),
  );
  if (!m.ok) return refuse(`The franchisees' people could not be read: ${m.error}`);

  const territoryName = new Map(n.rows.map((r) => [String(r.id), String(r.name)]));
  const held = new Map<string, { id: string; name: string }[]>();
  for (const row of t.rows) {
    const list = held.get(String(row.franchisee_id)) ?? [];
    list.push({ id: String(row.territory_id), name: territoryName.get(String(row.territory_id)) ?? "A territory no longer listed" });
    held.set(String(row.franchisee_id), list);
  }
  const people = new Map<string, number>();
  for (const row of m.rows) people.set(String(row.franchisee_id), (people.get(String(row.franchisee_id)) ?? 0) + 1);

  return {
    ok: true,
    rows: f.rows.map((r) => ({
      id: String(r.id),
      createdAt: String(r.created_at),
      legalName: String(r.legal_name),
      status: r.status,
      office: { street: r.office_street, city: r.office_city, postalCode: r.office_postal_code, phone: r.office_phone },
      endedAt: r.ended_at,
      endedReason: r.ended_reason,
      territories: (held.get(String(r.id)) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
      members: people.get(String(r.id)) ?? 0,
    })),
  };
}

/** Every franchisee, filtered, searched and sorted for the list. */
export async function listFranchisees(
  actor: Actor | null,
  query: FranchiseeListQuery = {},
): Promise<{ ok: true; rows: FranchiseeRow[] } | { ok: false; error: string }> {
  if (!keeper(actor)) return refuse(NOT_ALLOWED);
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the franchisees could not be read.");
  const all = await readAll(db);
  if (!all.ok) return all;
  const status = query.status ?? "all";
  const q = (query.q ?? "").trim().toLowerCase();
  const rows = all.rows
    .filter((r) => status === "all" || r.status === status)
    .filter((r) => {
      if (!q) return true;
      const hay = [r.legalName, r.office.street, r.office.city, r.office.postalCode, r.office.phone, ...r.territories.map((t) => t.name)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  const sort = query.sort ?? "name";
  rows.sort((a, b) =>
    sort === "newest" ? b.createdAt.localeCompare(a.createdAt) : sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : a.legalName.localeCompare(b.legalName),
  );
  return { ok: true, rows };
}

export type FranchiseeDetail = {
  franchisee: FranchiseeRow;
  people: { id: string; name: string; role: string; since: string }[];
  /** Every sales territory, and who holds it now, for choosing what this franchisee holds. */
  territoryOptions: { id: string; name: string; heldBy: { id: string; name: string } | null }[];
  /** Every technician and rep, and which franchisee each belongs to now, for choosing its people. */
  personOptions: { id: string; name: string; role: string; belongsTo: { id: string; name: string } | null }[];
};

export async function franchiseeDetail(actor: Actor | null, id: string): Promise<{ ok: true; detail: FranchiseeDetail } | { ok: false; error: string }> {
  if (!keeper(actor)) return refuse(NOT_ALLOWED);
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the franchisee could not be read.");
  const all = await readAll(db);
  if (!all.ok) return all;
  const franchisee = all.rows.find((r) => r.id === id);
  if (!franchisee) return refuse("That franchisee is not on record.");

  const holders = await readEvery<{ franchisee_id: string; territory_id: string }>((from, to) =>
    db.from("eng_franchisee_territories").select("franchisee_id, territory_id").is("ended_at", null).order("territory_id", { ascending: true }).range(from, to),
  );
  if (!holders.ok) return refuse(`Who holds the territories could not be read: ${holders.error}`);
  const territories = await readEvery<{ id: string; name: string }>((from, to) =>
    db.from("eng_crm_territories").select("id, name").order("name", { ascending: true }).order("id", { ascending: true }).range(from, to),
  );
  if (!territories.ok) return refuse(`The territories could not be read: ${territories.error}`);
  const members = await readEvery<{ franchisee_id: string; profile_id: string; created_at: string }>((from, to) =>
    db.from("eng_franchisee_members").select("franchisee_id, profile_id, created_at").is("ended_at", null).order("profile_id", { ascending: true }).range(from, to),
  );
  if (!members.ok) return refuse(`The franchisees' people could not be read: ${members.error}`);
  const profiles = await readEvery<{ id: string; display_name: string | null; email: string | null; role: string }>((from, to) =>
    db.from("eng_profiles").select("id, display_name, email, role").in("role", [...FRANCHISEE_MEMBER_ROLES]).order("id", { ascending: true }).range(from, to),
  );
  if (!profiles.ok) return refuse(`The technicians and reps could not be read: ${profiles.error}`);

  const nameOfFranchisee = new Map(all.rows.map((r) => [r.id, r.legalName]));
  const nameOfProfile = (p: { display_name: string | null; email: string | null }) => p.display_name?.trim() || p.email || "A person with no name on file";
  const territoryHolder = new Map(holders.rows.map((h) => [String(h.territory_id), String(h.franchisee_id)]));
  const memberOf = new Map(members.rows.map((m) => [String(m.profile_id), { franchisee: String(m.franchisee_id), since: String(m.created_at) }]));

  const people = profiles.rows
    .filter((p) => memberOf.get(String(p.id))?.franchisee === id)
    .map((p) => ({ id: String(p.id), name: nameOfProfile(p), role: String(p.role), since: memberOf.get(String(p.id))!.since }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    ok: true,
    detail: {
      franchisee,
      people,
      territoryOptions: territories.rows.map((t) => {
        const holder = territoryHolder.get(String(t.id));
        return { id: String(t.id), name: String(t.name), heldBy: holder ? { id: holder, name: nameOfFranchisee.get(holder) ?? "Another franchisee" } : null };
      }),
      personOptions: profiles.rows
        .map((p) => {
          const m = memberOf.get(String(p.id));
          return {
            id: String(p.id),
            name: nameOfProfile(p),
            role: String(p.role),
            belongsTo: m ? { id: m.franchisee, name: nameOfFranchisee.get(m.franchisee) ?? "Another franchisee" } : null,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    },
  };
}

export async function createFranchisee(actor: Actor | null, input: { legalName: string }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const a = keeper(actor);
  if (!a) return refuse(NOT_ALLOWED);
  const problem = legalNameProblem(input.legalName);
  if (problem) return refuse(problem);
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the franchisee was not added.");
  const legalName = input.legalName.trim();
  const recorded = await writeAuditOrRefuse({
    actor: a,
    action: "franchisee.created",
    entityType: "franchisee",
    entityId: null,
    summary: `Franchisee "${legalName}" added to the record, onboarding.`,
    diff: { legal_name: legalName },
  });
  if (!recorded.ok) return recorded;
  const { data, error } = await db.from("eng_franchisees").insert({ legal_name: legalName, created_by: a.id }).select("id").single();
  if (error || !data) {
    return refuse(error?.code === "23505" ? `"${legalName}" is already on the record.` : `The franchisee could not be added: ${error?.message ?? "no row"}`);
  }
  return { ok: true, id: String(data.id) };
}

export async function saveOffice(actor: Actor | null, input: { id: string } & OfficeInput): Promise<{ ok: true; said: string } | { ok: false; error: string }> {
  const a = keeper(actor);
  if (!a) return refuse(NOT_ALLOWED);
  const office = officeFrom(input);
  if (!office.ok) return office;
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was changed.");
  const o = office.office;
  const recorded = await writeAuditOrRefuse({
    actor: a,
    action: "franchisee.office_saved",
    entityType: "franchisee",
    entityId: input.id,
    summary: o.street ? `Office set to ${o.street}, ${o.city} ${o.postalCode}.` : "Office address cleared.",
    diff: { office_street: o.street, office_city: o.city, office_postal_code: o.postalCode, office_phone: o.phone },
  });
  if (!recorded.ok) return recorded;
  const { data, error } = await db
    .from("eng_franchisees")
    .update({ office_street: o.street, office_city: o.city, office_postal_code: o.postalCode, office_phone: o.phone, updated_at: DB_NOW })
    .eq("id", input.id)
    .select("id");
  if (error) return refuse(`The office could not be saved: ${error.message}`);
  if (!data?.length) return refuse("That franchisee is not on record.");
  return { ok: true, said: "Office saved." };
}

export async function setFranchiseeStatus(
  actor: Actor | null,
  input: { id: string; to: string; reason?: string | null },
): Promise<{ ok: true; said: string } | { ok: false; error: string }> {
  const a = keeper(actor);
  if (!a) return refuse(NOT_ALLOWED);
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was changed.");
  const { data: row, error: readError } = await db.from("eng_franchisees").select("id, legal_name, status").eq("id", input.id).maybeSingle();
  if (readError) return refuse(`The franchisee could not be read: ${readError.message}`);
  if (!row) return refuse("That franchisee is not on record.");
  const change = statusChange(row.status as FranchiseeStatus, input.to, input.reason);
  if (!change.ok) return change;
  const recorded = await writeAuditOrRefuse({
    actor: a,
    action: "franchisee.status_set",
    entityType: "franchisee",
    entityId: input.id,
    summary: `${String(row.legal_name)}: ${String(row.status)} to ${change.to}${change.reason ? `, because ${change.reason}` : ""}.`,
    diff: { from: row.status, to: change.to, reason: change.reason },
  });
  if (!recorded.ok) return recorded;
  /* Only from the status just read, so two people changing it at once cannot both win. */
  const { data, error } = await db
    .from("eng_franchisees")
    .update({
      status: change.to,
      ended_at: change.to === "ended" ? DB_NOW : null,
      ended_reason: change.reason,
      updated_at: DB_NOW,
    })
    .eq("id", input.id)
    .eq("status", String(row.status))
    .select("id");
  if (error) return refuse(`The status could not be changed: ${error.message}`);
  if (!data?.length) return refuse("Somebody changed this franchisee a moment ago. Reload and look again.");
  return { ok: true, said: change.to === "ended" ? "Ended. Its territories and people stay listed until you take them off." : "Status changed." };
}

export async function setFranchiseeTerritory(
  actor: Actor | null,
  input: { id: string; territoryId: string; holds: boolean },
): Promise<{ ok: true; said: string } | { ok: false; error: string }> {
  const a = keeper(actor);
  if (!a) return refuse(NOT_ALLOWED);
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was changed.");
  const { data: f, error: fError } = await db.from("eng_franchisees").select("id, legal_name, status").eq("id", input.id).maybeSingle();
  if (fError) return refuse(`The franchisee could not be read: ${fError.message}`);
  if (!f) return refuse("That franchisee is not on record.");
  const { data: t, error: tError } = await db.from("eng_crm_territories").select("id, name").eq("id", input.territoryId).maybeSingle();
  if (tError) return refuse(`The territory could not be read: ${tError.message}`);
  if (!t) return refuse("That territory no longer exists.");
  if (input.holds && f.status === "ended") return refuse("An ended franchisee cannot be given a territory.");

  const recorded = await writeAuditOrRefuse({
    actor: a,
    action: input.holds ? "franchisee.territory_added" : "franchisee.territory_ended",
    entityType: "franchisee",
    entityId: input.id,
    summary: `${String(f.legal_name)} ${input.holds ? "now holds" : "no longer holds"} ${String(t.name)}.`,
    diff: { territory_id: input.territoryId },
  });
  if (!recorded.ok) return recorded;
  if (input.holds) {
    const { error } = await db.from("eng_franchisee_territories").insert({ franchisee_id: input.id, territory_id: input.territoryId, created_by: a.id });
    if (error) {
      return refuse(error.code === "23505" ? `${String(t.name)} is held by another franchisee. Take it off them first.` : `The territory could not be given: ${error.message}`);
    }
    return { ok: true, said: `${String(f.legal_name)} holds ${String(t.name)}.` };
  }
  const { data, error } = await db
    .from("eng_franchisee_territories")
    .update({ ended_at: DB_NOW, ended_by: a.id })
    .eq("franchisee_id", input.id)
    .eq("territory_id", input.territoryId)
    .is("ended_at", null)
    .select("id");
  if (error) return refuse(`The territory could not be taken off: ${error.message}`);
  if (!data?.length) return refuse(`${String(f.legal_name)} does not hold ${String(t.name)}.`);
  return { ok: true, said: `${String(t.name)} taken off ${String(f.legal_name)}. The record of the holding is kept.` };
}

export async function setFranchiseeMember(
  actor: Actor | null,
  input: { id: string; profileId: string; belongs: boolean },
): Promise<{ ok: true; said: string } | { ok: false; error: string }> {
  const a = keeper(actor);
  if (!a) return refuse(NOT_ALLOWED);
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was changed.");
  const { data: f, error: fError } = await db.from("eng_franchisees").select("id, legal_name, status").eq("id", input.id).maybeSingle();
  if (fError) return refuse(`The franchisee could not be read: ${fError.message}`);
  if (!f) return refuse("That franchisee is not on record.");
  const { data: p, error: pError } = await db.from("eng_profiles").select("id, display_name, email, role").eq("id", input.profileId).maybeSingle();
  if (pError) return refuse(`The person could not be read: ${pError.message}`);
  if (!p) return refuse("That person is not on record.");
  const name = String(p.display_name ?? "").trim() || String(p.email ?? "That person");
  if (input.belongs && !mayBeMember(String(p.role))) return refuse(`${name} is not a technician or a rep, so they cannot be one of a franchisee's people.`);
  if (input.belongs && f.status === "ended") return refuse("An ended franchisee cannot be given people.");

  const recorded = await writeAuditOrRefuse({
    actor: a,
    action: input.belongs ? "franchisee.member_added" : "franchisee.member_ended",
    entityType: "franchisee",
    entityId: input.id,
    summary: `${name} ${input.belongs ? "joined" : "left"} ${String(f.legal_name)}.`,
    diff: { profile_id: input.profileId },
  });
  if (!recorded.ok) return recorded;
  if (input.belongs) {
    const { error } = await db.from("eng_franchisee_members").insert({ franchisee_id: input.id, profile_id: input.profileId, created_by: a.id });
    if (error) {
      return refuse(error.code === "23505" ? `${name} belongs to another franchisee. Take them off it first.` : `${name} could not be added: ${error.message}`);
    }
    return { ok: true, said: `${name} is one of ${String(f.legal_name)}'s people.` };
  }
  const { data, error } = await db
    .from("eng_franchisee_members")
    .update({ ended_at: DB_NOW, ended_by: a.id })
    .eq("franchisee_id", input.id)
    .eq("profile_id", input.profileId)
    .is("ended_at", null)
    .select("id");
  if (error) return refuse(`${name} could not be taken off: ${error.message}`);
  if (!data?.length) return refuse(`${name} is not one of ${String(f.legal_name)}'s people.`);
  return { ok: true, said: `${name} taken off ${String(f.legal_name)}. The record of the membership is kept.` };
}
