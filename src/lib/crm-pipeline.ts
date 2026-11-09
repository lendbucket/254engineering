import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { writeAuditOrRefuse } from "./ops-audit";
import { readEvery } from "./bounded-read";
import { logContact } from "./ops-contact-log";
import { postMessage, threadView } from "./ops-threads";
import { contactsFor, setStage, sourcesFor, type ProspectContact } from "./crm-prospects";
import { CRM_STAGES, SOURCE_LABEL, STAGE_LABEL, territoryFor, verticalForProspectType, type CrmSource, type CrmStage, type CrmVertical } from "./crm-rules";
import {
  bulkTargets,
  canSeeCompany,
  cleanSavedQuery,
  cleanTag,
  linkedAccountView,
  mergeTimeline,
  savedViewNameProblem,
  type CompanyPlace,
  type CrmListRow,
  type LinkedAccountView,
  type TimelineEntry,
} from "./crm-board-rules";
import { roundRobinOwners, viewerFor } from "./crm-territories";

/**
 * THE PIPELINE, THE LISTS AND THE COMPANY PAGE. Robert's sales CRM ruling of
 * 2026-11-02, item R4, migration 0115.
 *
 * ONE RULE DECIDES WHO SEES WHAT: canSeeCompany, with the viewer viewerFor
 * loads (crm-territories.ts, R5: a manager sees all; anybody else their own and
 * the unassigned companies in the counties of territories they hold). Every
 * read, the company page and each bulk act ask it, and a failed read of the
 * viewer's territories refuses rather than showing a guess.
 *
 * Stage moves go through setStage (R1), which moves the company conditionally
 * and writes the stage change to the contact log; here the move is also
 * refused when the company is no longer at the stage the board showed, so a
 * card dragged on a stale board never moves a company somebody else moved.
 */

const refuse = (error: string) => ({ ok: false as const, error });
type Db = NonNullable<ReturnType<typeof supabaseAdmin>>;

const LIST_COLUMNS =
  "id, created_at, company, contact_name, phone, email, city, county, vertical, prospect_type, stage, score, owner_id, tags, next_action_at, owner:eng_profiles!eng_prospects_owner_id_fkey(display_name)";

/** The newest contact log entry per company, read whole, in chunks of ids. */
async function lastActivityFor(db: Db, ids: string[]): Promise<{ ok: true; map: Map<string, string> } | { ok: false; error: string }> {
  const map = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const read = await readEvery<{ prospect_id: string; created_at: string }>((from, to) =>
      db.from("eng_contact_log").select("prospect_id, created_at").in("prospect_id", chunk).order("created_at", { ascending: false }).order("id", { ascending: true }).range(from, to),
    );
    if (!read.ok) return refuse(`The companies' history could not be read: ${read.error}`);
    for (const r of read.rows) if (!map.has(r.prospect_id)) map.set(r.prospect_id, r.created_at);
  }
  return { ok: true, map };
}

/**
 * Every company this person may see, whole, with its sources and last
 * activity. A failed read of any of the three is a failure, never a shorter
 * list.
 */
export async function companiesFor(actor: Actor | null): Promise<{ ok: true; rows: CrmListRow[] } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.use")) return refuse("Your role cannot open the sales list.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the sales list could not be read.");
  const who = await viewerFor(actor);
  if (!who.ok) return who;
  const viewer = who.viewer;

  /* A rep's read is narrowed to their own and the unowned, and canSeeCompany then keeps only the unowned in their counties. */
  const read = await readEvery<Record<string, unknown>>((from, to) => {
    let q = db.from("eng_prospects").select(LIST_COLUMNS);
    if (!viewer.seesAll) q = q.or(`owner_id.eq.${actor.id},owner_id.is.null`);
    return q.order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to);
  });
  if (!read.ok) return refuse(`The sales list could not be read: ${read.error}`);
  const visible = read.rows.filter((r) => canSeeCompany(viewer, (r.owner_id as string | null) ?? null, (r.county as string | null) ?? null));
  const ids = visible.map((r) => String(r.id));

  const sources = new Map<string, CrmSource[]>();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const s = await readEvery<{ prospect_id: string; source: string }>((from, to) =>
      db.from("eng_prospect_sources").select("prospect_id, source").in("prospect_id", chunk).order("id", { ascending: true }).range(from, to),
    );
    if (!s.ok) return refuse(`Where the companies came from could not be read: ${s.error}`);
    for (const r of s.rows) sources.set(r.prospect_id, [...(sources.get(r.prospect_id) ?? []), r.source as CrmSource]);
  }
  const last = await lastActivityFor(db, ids);
  if (!last.ok) return last;

  return {
    ok: true,
    rows: visible.map((r) => ({
      id: String(r.id),
      company: String(r.company),
      contactName: (r.contact_name as string | null) ?? null,
      phone: (r.phone as string | null) ?? null,
      email: (r.email as string | null) ?? null,
      city: (r.city as string | null) ?? null,
      county: (r.county as string | null) ?? null,
      vertical: ((r.vertical as CrmVertical | null) ?? verticalForProspectType(String(r.prospect_type))),
      stage: ((r.stage as CrmStage | null) ?? "new"),
      score: Number(r.score ?? 0),
      ownerId: (r.owner_id as string | null) ?? null,
      ownerName: ((r.owner as { display_name?: string } | null)?.display_name) ?? null,
      tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
      sources: [...new Set(sources.get(String(r.id)) ?? [])],
      nextActionAt: (r.next_action_at as string | null) ?? null,
      lastActivityAt: last.map.get(String(r.id)) ?? null,
      createdAt: String(r.created_at),
    })),
  };
}

/** A company's owner, or a refusal when it does not exist or this person may not see it. */
async function visibleCompany(actor: Actor, db: Db, id: string): Promise<{ ok: true; row: Record<string, unknown> } | { ok: false; error: string }> {
  const { data, error } = await db.from("eng_prospects").select("*").eq("id", id).maybeSingle();
  if (error) return refuse(`The company could not be read: ${error.message}`);
  const who = await viewerFor(actor);
  if (!who.ok) return who;
  if (!data || !canSeeCompany(who.viewer, (data.owner_id as string | null) ?? null, (data.county as string | null) ?? null)) return refuse("That company is not on your sales list.");
  return { ok: true, row: data as Record<string, unknown> };
}

/**
 * Whether this person may act on a company at all, for doors outside the
 * pipeline that take a prospect id: the contact log's own route (R5's rule,
 * applied there by R6, 2026-11-02). The same visibleCompany read, so a failed
 * read or a company out of sight refuses.
 */
export async function mayActOnCompany(actor: Actor, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured.");
  const seen = await visibleCompany(actor, db, id);
  return seen.ok ? { ok: true } : seen;
}

/* ------------------------------------------------------------- stage moves */

/**
 * Move a company from the board or the company page. `from` is the stage the
 * screen showed; a company that has moved since is refused, and nothing is
 * written.
 */
export async function moveStage(
  actor: Actor | null,
  input: { prospectId: string; from: string; to: string },
): Promise<{ ok: true; said: string } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.use")) return refuse("Your role cannot change the sales list.");
  if (!(CRM_STAGES as readonly string[]).includes(input.to)) return refuse("That is not a stage on the sales list.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was moved.");
  const company = await visibleCompany(actor, db, input.prospectId);
  if (!company.ok) return company;
  const now = company.row.stage as CrmStage;
  /* The stage the screen showed is required: without it nothing can tell a stale card from a current one. */
  if (!input.from) return refuse("The screen did not say which stage it showed, so nothing was moved. Reload and try again.");
  if (input.from !== now) {
    return refuse(`This company moved to ${STAGE_LABEL[now]} while you were looking. Nothing was changed; the board now shows where it is.`);
  }
  const moved = await setStage(actor, input.prospectId, input.to as CrmStage);
  if (!moved.ok) return moved;
  return { ok: true, said: `${String(company.row.company)} moved to ${STAGE_LABEL[input.to as CrmStage]}.` };
}

/* --------------------------------------------------------------- bulk acts */

/** The people a company can be assigned to: active, holding crm.use. */
export async function assignablePeople(actor: Actor | null): Promise<{ ok: true; rows: { id: string; name: string }[] } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.use")) return refuse("Your role cannot open the sales list.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured.");
  const grants = await readEvery<{ role_key: string }>((from, to) =>
    db.from("eng_role_grants").select("role_key").eq("action", "crm.use").order("role_key", { ascending: true }).range(from, to),
  );
  if (!grants.ok) return refuse(`Who works the sales list could not be read: ${grants.error}`);
  const roles = [...new Set(grants.rows.map((g) => g.role_key))];
  if (roles.length === 0) return { ok: true, rows: [] };
  const people = await readEvery<{ id: string; display_name: string }>((from, to) =>
    db.from("eng_profiles").select("id, display_name").eq("status", "active").in("role", roles).order("display_name", { ascending: true }).order("id", { ascending: true }).range(from, to),
  );
  if (!people.ok) return refuse(`Who works the sales list could not be read: ${people.error}`);
  return { ok: true, rows: people.rows.map((p) => ({ id: String(p.id), name: String(p.display_name) })) };
}

async function ownersOf(db: Db, ids: string[]): Promise<{ ok: true; owners: Map<string, CompanyPlace>; rows: Map<string, Record<string, unknown>> } | { ok: false; error: string }> {
  const owners = new Map<string, CompanyPlace>();
  const rows = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from("eng_prospects").select("id, company, owner_id, county, tags, stage").in("id", ids.slice(i, i + 200));
    if (error) return refuse(`The companies could not be read: ${error.message}`);
    for (const r of data ?? []) {
      owners.set(String(r.id), { ownerId: (r.owner_id as string | null) ?? null, county: (r.county as string | null) ?? null });
      rows.set(String(r.id), r as Record<string, unknown>);
    }
  }
  return { ok: true, owners, rows };
}

/** Write the owner changes and one "Assigned to" note per company that changed hands. */
async function applyAssignments(
  actor: Actor,
  db: Db,
  changes: { id: string; before: string | null; after: string | null; label: string }[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const byOwner = new Map<string | null, string[]>();
  for (const c of changes) byOwner.set(c.after, [...(byOwner.get(c.after) ?? []), c.id]);
  let done = 0;
  for (const [owner, ids] of byOwner) {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await db.from("eng_prospects").update({ owner_id: owner }).in("id", ids.slice(i, i + 200));
      if (error) return refuse(`${done} of ${changes.length} were assigned and the rest could not be: ${error.message}`);
      done += Math.min(200, ids.length - i);
    }
  }
  for (const c of changes) {
    if (c.before === c.after) continue;
    const logged = await logContact(actor, {
      subject: "prospect",
      subjectId: c.id,
      channel: "note",
      body: `Assigned to ${c.label}.`,
      crm: { activityKind: "assignment" },
    });
    if (!logged.ok) return refuse(`The companies were assigned and a history entry could not be written: ${logged.error}`);
  }
  return { ok: true };
}

/**
 * Assign companies to one person, or to nobody. A sales manager's act
 * (crm.assign). Each company gets an assignment entry in its history.
 */
export async function bulkAssign(
  actor: Actor | null,
  input: { ids: string[]; ownerId: string | null },
): Promise<{ ok: true; said: string } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.use")) return refuse("Your role cannot change the sales list.");
  if (!can(actor, "crm.assign")) return refuse("Only a sales manager or an administrator assigns companies.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was assigned.");
  const read = await ownersOf(db, [...new Set(input.ids)]);
  if (!read.ok) return read;
  const who = await viewerFor(actor);
  if (!who.ok) return who;
  const targets = bulkTargets(who.viewer, "assign", input.ids, read.owners);
  if (!targets.ok) return targets;

  let ownerName = "nobody";
  if (input.ownerId) {
    const people = await assignablePeople(actor);
    if (!people.ok) return people;
    const person = people.rows.find((p) => p.id === input.ownerId);
    if (!person) return refuse("That person does not work the sales list.");
    ownerName = person.name;
  }

  const recorded = await writeAuditOrRefuse({
    actor,
    action: "prospect.assigned",
    entityType: "prospect",
    entityId: targets.ids[0],
    summary: `${targets.ids.length} ${targets.ids.length === 1 ? "company" : "companies"} on the sales list assigned to ${ownerName}.`,
    diff: { ids: targets.ids, owner_id: input.ownerId },
  });
  if (!recorded.ok) return recorded;

  const applied = await applyAssignments(
    actor,
    db,
    targets.ids.map((id) => ({ id, before: read.owners.get(id)?.ownerId ?? null, after: input.ownerId, label: ownerName })),
  );
  if (!applied.ok) return applied;
  return {
    ok: true,
    said: `${targets.ids.length} assigned to ${ownerName}.${targets.refused ? ` ${targets.refused} left alone: not found.` : ""}`,
  };
}

/**
 * Assign companies BY TERRITORY: each goes to the next active holder of its
 * county's territory, in the same round robin a new import uses (R5). A company
 * in no territory, or in a territory nobody active holds, is left as it was and
 * counted, so the manager sees how many still need a person. A sales manager's
 * act (crm.assign). Each change gets an "Assigned to" entry in its history.
 */
export async function bulkAssignByTerritory(
  actor: Actor | null,
  input: { ids: string[] },
): Promise<{ ok: true; said: string } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.use")) return refuse("Your role cannot change the sales list.");
  if (!can(actor, "crm.assign")) return refuse("Only a sales manager or an administrator assigns companies.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was assigned.");
  const read = await ownersOf(db, [...new Set(input.ids)]);
  if (!read.ok) return read;
  const who = await viewerFor(actor);
  if (!who.ok) return who;
  const targets = bulkTargets(who.viewer, "assign", input.ids, read.owners);
  if (!targets.ok) return targets;

  const plan = await roundRobinOwners(db, targets.ids.map((id) => ({ id, county: read.owners.get(id)?.county ?? null })));
  if (!plan.ok) return plan;
  const people = await assignablePeople(actor);
  if (!people.ok) return people;
  const names = new Map(people.rows.map((p) => [p.id, p.name]));
  const changes = targets.ids
    .map((id) => ({ id, before: read.owners.get(id)?.ownerId ?? null, after: plan.owners.get(id) ?? null }))
    .filter((c) => c.after !== null)
    .map((c) => ({ ...c, label: `${names.get(c.after!) ?? "a holder of the territory"}, by territory` }));
  const left = targets.ids.length - changes.length;
  if (changes.length === 0) return refuse(`None of those companies is in a territory an active rep holds, so nothing was assigned. Assign them to a person instead.`);

  const recorded = await writeAuditOrRefuse({
    actor,
    action: "prospect.assigned_by_territory",
    entityType: "prospect",
    entityId: changes[0].id,
    summary: `${changes.length} ${changes.length === 1 ? "company" : "companies"} on the sales list assigned by territory; ${left} in no held territory.`,
    diff: { assignments: changes.map((c) => ({ id: c.id, owner_id: c.after })) },
  });
  if (!recorded.ok) return recorded;
  const applied = await applyAssignments(actor, db, changes);
  if (!applied.ok) return applied;
  return { ok: true, said: `${changes.length} assigned by territory.${left ? ` ${left} left as they were: in no territory an active rep holds.` : ""}` };
}

/** Add one tag to companies this person may change. */
export async function bulkTag(
  actor: Actor | null,
  input: { ids: string[]; tag: string },
): Promise<{ ok: true; said: string } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.use")) return refuse("Your role cannot change the sales list.");
  const tag = cleanTag(input.tag);
  if (!tag.ok) return tag;
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was tagged.");
  const read = await ownersOf(db, [...new Set(input.ids)]);
  if (!read.ok) return read;
  const who = await viewerFor(actor);
  if (!who.ok) return who;
  const targets = bulkTargets(who.viewer, "tag", input.ids, read.owners);
  if (!targets.ok) return targets;

  const recorded = await writeAuditOrRefuse({
    actor,
    action: "prospect.tagged",
    entityType: "prospect",
    entityId: targets.ids[0],
    summary: `Tag "${tag.tag}" added to ${targets.ids.length} ${targets.ids.length === 1 ? "company" : "companies"} on the sales list.`,
    diff: { ids: targets.ids, tag: tag.tag },
  });
  if (!recorded.ok) return recorded;

  let added = 0;
  for (const id of targets.ids) {
    const before = (read.rows.get(id)?.tags as string[] | null) ?? [];
    if (before.includes(tag.tag)) continue;
    /* Conditional on the tags read, so two people tagging at once cannot drop each other's tag. */
    const { data, error } = await db.from("eng_prospects").update({ tags: [...before, tag.tag] }).eq("id", id).eq("tags", `{${before.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(",")}}`).select("id");
    if (error) return refuse(`${added} were tagged and the rest could not be: ${error.message}`);
    if (!data?.length) return refuse(`${added} were tagged; one company's tags changed while this ran. Nothing more was changed. Tag again.`);
    added += 1;
  }
  return { ok: true, said: `"${tag.tag}" added to ${added}.${targets.refused ? ` ${targets.refused} left alone: not yours to change.` : ""}` };
}

/* ------------------------------------------------------------- saved views */

export type SavedView = { id: string; name: string; view: "board" | "list"; query: Record<string, string> };

export async function savedViewsFor(actor: Actor | null): Promise<{ ok: true; rows: SavedView[] } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.use")) return refuse("Your role cannot open the sales list.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured.");
  const read = await readEvery<Record<string, unknown>>((from, to) =>
    db.from("eng_crm_saved_views").select("id, name, view, query").eq("profile_id", actor.id).order("name", { ascending: true }).order("id", { ascending: true }).range(from, to),
  );
  if (!read.ok) return refuse(`Your saved views could not be read: ${read.error}`);
  return {
    ok: true,
    rows: read.rows.map((r) => ({ id: String(r.id), name: String(r.name), view: r.view === "board" ? "board" : "list", query: cleanSavedQuery((r.query as Record<string, unknown>) ?? {}) })),
  };
}

export async function saveView(
  actor: Actor | null,
  input: { name: string; view: string; query: Record<string, unknown> },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.use")) return refuse("Your role cannot change the sales list.");
  const problem = savedViewNameProblem(input.name);
  if (problem) return refuse(problem);
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the view was not saved.");
  const { data, error } = await db
    .from("eng_crm_saved_views")
    .insert({ profile_id: actor.id, name: input.name.trim(), view: input.view === "board" ? "board" : "list", query: cleanSavedQuery(input.query) })
    .select("id")
    .single();
  if (error || !data) return refuse(error?.code === "23505" ? "You already have a view with that name. Choose another name." : `The view could not be saved: ${error?.message ?? "no row"}`);
  return { ok: true, id: String(data.id) };
}

/** Delete one of YOUR views. Somebody else's is not found, whatever its id. */
export async function deleteView(actor: Actor | null, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.use")) return refuse("Your role cannot change the sales list.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured.");
  const { data, error } = await db.from("eng_crm_saved_views").delete().eq("id", id).eq("profile_id", actor.id).select("id");
  if (error) return refuse(`The view could not be deleted: ${error.message}`);
  if (!data?.length) return refuse("That view is not one of yours.");
  return { ok: true };
}

/* ----------------------------------------------------- the company's notes */

/**
 * The company's notes thread: one existing direct thread per company (Robert's
 * answer 5), keyed prospect:<id>, linked in eng_prospect_threads. Created on
 * first use with the person who opened it and the company's owner; anybody
 * who can see the company joins it by opening it, because a company's notes
 * follow the company the way a file's thread follows the file.
 */
export async function companyThread(
  actor: Actor & { email: string },
  prospectId: string,
): Promise<{ ok: true; threadId: string } | { ok: false; error: string }> {
  if (!can(actor, "crm.use") || !can(actor, "messages.use")) return refuse("Your role cannot write notes on the sales list.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured.");
  const company = await visibleCompany(actor, db, prospectId);
  if (!company.ok) return company;

  const { data: link, error: linkError } = await db.from("eng_prospect_threads").select("thread_id").eq("prospect_id", prospectId).maybeSingle();
  if (linkError) return refuse(`The company's notes could not be read: ${linkError.message}`);
  let threadId = link ? String(link.thread_id) : null;
  if (!threadId) {
    const key = `prospect:${prospectId}`;
    const { data: existing } = await db.from("eng_threads").select("id").eq("direct_key", key).maybeSingle();
    if (existing) threadId = String(existing.id);
    else {
      const { data: created, error } = await db
        .from("eng_threads")
        .insert({ kind: "direct", direct_key: key, name: `Notes: ${String(company.row.company)}`, created_by: actor.id })
        .select("id")
        .single();
      if (error || !created) {
        const { data: raced } = await db.from("eng_threads").select("id").eq("direct_key", key).maybeSingle();
        if (!raced) return refuse(`The company's notes could not be started: ${error?.message ?? "no row"}`);
        threadId = String(raced.id);
      } else threadId = String(created.id);
    }
    const { error: linkWrite } = await db.from("eng_prospect_threads").upsert({ prospect_id: prospectId, thread_id: threadId, created_by: actor.id }, { onConflict: "prospect_id", ignoreDuplicates: true });
    if (linkWrite) return refuse(`The company's notes were started and could not be linked to it: ${linkWrite.message}`);
  }

  const wanted = [actor.id, ...(company.row.owner_id ? [String(company.row.owner_id)] : [])];
  const { error: joinError } = await db
    .from("eng_thread_participants")
    .upsert(wanted.map((profile_id) => ({ thread_id: threadId, profile_id })), { onConflict: "thread_id,profile_id", ignoreDuplicates: true });
  if (joinError) return refuse(`You could not be added to the company's notes: ${joinError.message}`);
  return { ok: true, threadId };
}

/** Bring a colleague who works the sales list into a company's notes, so a mention reaches them. */
export async function addToNotes(
  actor: Actor & { email: string },
  input: { prospectId: string; profileId: string },
): Promise<{ ok: true; said: string } | { ok: false; error: string }> {
  const thread = await companyThread(actor, input.prospectId);
  if (!thread.ok) return thread;
  const people = await assignablePeople(actor);
  if (!people.ok) return people;
  const person = people.rows.find((p) => p.id === input.profileId);
  if (!person) return refuse("That person does not work the sales list.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured.");
  const { error } = await db.from("eng_thread_participants").upsert({ thread_id: thread.threadId, profile_id: person.id }, { onConflict: "thread_id,profile_id", ignoreDuplicates: true });
  if (error) return refuse(`${person.name} could not be added: ${error.message}`);
  return { ok: true, said: `${person.name} can read and answer these notes, and an @ mention reaches them.` };
}

/** Post a note, with @ mentions of anybody in the notes, through the existing threads. */
export async function postCompanyNote(
  actor: Actor & { email: string },
  input: { prospectId: string; body: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const thread = await companyThread(actor, input.prospectId);
  if (!thread.ok) return thread;
  const posted = await postMessage(actor, thread.threadId, input.body);
  return posted.ok ? { ok: true } : refuse(posted.error);
}

/* --------------------------------------------------------- the company page */

export type CompanyPage = {
  id: string;
  company: string;
  vertical: CrmVertical;
  stage: CrmStage;
  status: string;
  score: number;
  city: string | null;
  county: string | null;
  regionName: string | null;
  website: string | null;
  addressLine: string | null;
  postalCode: string | null;
  permitCount: number;
  lastPermitOn: string | null;
  tags: string[];
  ownerId: string | null;
  ownerName: string | null;
  nextActionAt: string | null;
  contacts: ProspectContact[];
  sources: { label: string; recordId: string; firstSeenAt: string }[];
  timeline: TimelineEntry[];
  /** Emails the company was sent, from its history. */
  sent: TimelineEntry[];
  account: LinkedAccountView | null;
  notes: { joined: false } | { joined: true; threadId: string; participants: { id: string; name: string }[] };
};

function activityTitle(kind: string, outcome: string | null, channel: string, direction: string | null): string {
  if (kind === "stage_change") return "Stage change";
  if (kind === "assignment") return "Assigned";
  if (kind === "import") return "Imported";
  const what = channel === "call" ? (direction === "inbound" ? "Call in" : "Call") : channel === "email" ? (direction === "inbound" ? "Email in" : "Email sent") : "Note";
  return outcome ? `${what}, ${outcome.replace(/_/g, " ")}` : what;
}

export async function companyPage(
  actor: (Actor & { email: string }) | null,
  prospectId: string,
): Promise<{ ok: true; page: CompanyPage | null } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.use")) return refuse("Your role cannot open the sales list.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the company could not be read.");
  const { data: row, error } = await db
    .from("eng_prospects")
    .select("*, owner:eng_profiles!eng_prospects_owner_id_fkey(display_name)")
    .eq("id", prospectId)
    .maybeSingle();
  if (error) return refuse(`The company could not be read: ${error.message}`);
  const who = await viewerFor(actor);
  if (!who.ok) return who;
  if (!row || !canSeeCompany(who.viewer, (row.owner_id as string | null) ?? null, (row.county as string | null) ?? null)) return { ok: true, page: null };

  const people = await contactsFor(actor, prospectId);
  if (!people.ok) return people;
  const sources = await sourcesFor(actor, prospectId);
  if (!sources.ok) return sources;

  const log = await readEvery<Record<string, unknown>>((from, to) =>
    db
      .from("eng_contact_log")
      .select("id, created_at, channel, direction, outcome, crm_outcome, activity_kind, body, by:eng_profiles!eng_contact_log_by_id_fkey(display_name)")
      .eq("prospect_id", prospectId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (!log.ok) return refuse(`This company's history could not be read: ${log.error}`);
  const logEntries: TimelineEntry[] = log.rows.map((r) => {
    const kind = String(r.activity_kind ?? r.channel);
    return {
      at: String(r.created_at),
      kind: (["call", "email", "note", "stage_change", "assignment", "import", "sequence"].includes(kind) ? kind : "note") as TimelineEntry["kind"],
      title: activityTitle(kind, (r.crm_outcome as string | null) ?? (r.outcome as string | null) ?? null, String(r.channel), (r.direction as string | null) ?? null),
      body: (r.body as string | null) ?? null,
      byName: ((r.by as { display_name?: string } | null)?.display_name) ?? null,
    };
  });
  const sourceEntries: TimelineEntry[] = sources.rows.map((s) => ({
    at: s.firstSeenAt,
    kind: "source",
    title: `Arrived from ${SOURCE_LABEL[s.source] ?? s.source}`,
    body: null,
    byName: null,
  }));

  /* The notes: read only if this person is in them. Joining is a click, never a side effect of looking. */
  let notes: CompanyPage["notes"] = { joined: false };
  let noteEntries: TimelineEntry[] = [];
  const { data: link, error: linkError } = await db.from("eng_prospect_threads").select("thread_id").eq("prospect_id", prospectId).maybeSingle();
  if (linkError) return refuse(`This company's notes could not be read: ${linkError.message}`);
  if (link) {
    const view = await threadView(actor, String(link.thread_id));
    if (view) {
      notes = { joined: true, threadId: String(link.thread_id), participants: view.thread.participants.map((p) => ({ id: p.id, name: p.name })) };
      noteEntries = view.messages.map((m) => ({ at: m.created_at, kind: "message", title: "Note in the company's thread", body: m.body, byName: m.author_name }));
    }
  }

  let account: LinkedAccountView | null = null;
  if (row.converted_account_id) {
    const orders = await readEvery<{ reference: string; placed_at: string | null; created_at: string; status: string }>((from, to) =>
      db.from("eng_service_orders").select("reference, placed_at, created_at, status").eq("account_id", String(row.converted_account_id)).order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to),
    );
    if (!orders.ok) return refuse(`This company's orders could not be read: ${orders.error}`);
    account = linkedAccountView(String(row.converted_account_id), orders.rows);
  }

  const timeline = mergeTimeline(logEntries, noteEntries, sourceEntries);
  const territory = territoryFor((row.county as string | null) ?? null);
  return {
    ok: true,
    page: {
      id: String(row.id),
      company: String(row.company),
      vertical: ((row.vertical as CrmVertical | null) ?? verticalForProspectType(String(row.prospect_type))),
      stage: row.stage as CrmStage,
      status: String(row.status),
      score: Number(row.score ?? 0),
      city: (row.city as string | null) ?? null,
      county: (row.county as string | null) ?? null,
      regionName: territory?.regionName ?? null,
      website: (row.website as string | null) ?? null,
      addressLine: (row.address_line as string | null) ?? null,
      postalCode: (row.postal_code as string | null) ?? null,
      permitCount: Number(row.permit_count ?? 0),
      lastPermitOn: (row.last_permit_on as string | null) ?? null,
      tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
      ownerId: (row.owner_id as string | null) ?? null,
      ownerName: ((row.owner as { display_name?: string } | null)?.display_name) ?? null,
      nextActionAt: (row.next_action_at as string | null) ?? null,
      contacts: people.rows,
      sources: sources.rows.map((s) => ({ label: SOURCE_LABEL[s.source] ?? s.source, recordId: s.sourceRecordId, firstSeenAt: s.firstSeenAt })),
      timeline,
      sent: timeline.filter((e) => e.kind === "email" && e.title === "Email sent"),
      account,
      notes,
    },
  };
}
