import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { writeAuditOrRefuse } from "./ops-audit";
import { readEvery } from "./bounded-read";
import { DB_NOW } from "./db-now";
import { logContact } from "./ops-contact-log";
import {
  CRM_SOURCES,
  CRM_VERTICALS,
  STAGE_LABEL,
  countyProblem,
  normalizeName,
  normalizePhone,
  prospectTypeForVertical,
  scoreProblem,
  stageMove,
  territoryFor,
  type CrmSource,
  type CrmStage,
  type CrmVertical,
} from "./crm-rules";

/**
 * THE SALES CRM'S MODEL, ON THE ONE SALES LIST. Robert's ruling of 2026-11-02,
 * item R1, migration 0111.
 *
 * A company is an eng_prospects row; its people are eng_prospect_contacts;
 * where it came from is eng_prospect_sources; everything done with it is an
 * eng_contact_log row written through logContact. The queue, board and lists
 * that read this are R3 and R4; this file is what they call.
 *
 * Every write is audited first (writeAuditOrRefuse), as the rest of the sales
 * list is, and every refusal is a sentence a rep can act on.
 */

type Db = NonNullable<ReturnType<typeof supabaseAdmin>>;
const refuse = (error: string) => ({ ok: false as const, error });

export type ProspectContact = {
  id: string;
  fullName: string | null;
  roleTitle: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
};

export type ProspectSourceRow = {
  id: string;
  source: CrmSource;
  sourceRecordId: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

/* ------------------------------------------------- what a new company carries */

/**
 * The primary person and the first source of companies just inserted, in two
 * writes. Called by createProspect and importProspects with the service
 * client they already hold, after the companies themselves are written.
 * A company that names nobody and no way to reach anybody gets no contact
 * row (eng_prospect_contacts_says_who), which the reachable check on the
 * company already makes impossible.
 */
export async function addPrimaryContactAndSource(
  db: Db,
  rows: {
    prospectId: string;
    contactName: string | null;
    phone: string | null;
    email: string | null;
    createdBy: string;
    source: CrmSource;
    sourceRecordId: string;
  }[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (rows.length === 0) return { ok: true };
  const contacts = rows
    .filter((r) => (r.contactName?.trim() || r.phone || r.email))
    .map((r) => ({
      prospect_id: r.prospectId,
      full_name: r.contactName?.trim() || null,
      phone: r.phone,
      email: r.email,
      is_primary: true,
      created_by: r.createdBy,
    }));
  if (contacts.length) {
    const { error } = await db.from("eng_prospect_contacts").insert(contacts);
    if (error) return refuse(`their people could not be saved: ${error.message}`);
  }
  const { error } = await db.from("eng_prospect_sources").insert(
    rows.map((r) => ({ prospect_id: r.prospectId, source: r.source, source_record_id: r.sourceRecordId })),
  );
  if (error) return refuse(`where they came from could not be saved: ${error.message}`);
  return { ok: true };
}

/* ----------------------------------------------------------------- reading */

export async function contactsFor(
  actor: Actor | null,
  prospectId: string,
): Promise<{ ok: true; rows: ProspectContact[] } | { ok: false; error: string }> {
  if (!can(actor, "crm.use")) return refuse("Your role cannot open the sales list.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the people at this company could not be read.");
  const read = await readEvery<Record<string, unknown>>((from, to) =>
    db
      .from("eng_prospect_contacts")
      .select("id, full_name, role_title, phone, email, is_primary")
      .eq("prospect_id", prospectId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .range(from, to),
  );
  if (!read.ok) return refuse(`The people at this company could not be read: ${read.error}`);
  return {
    ok: true,
    rows: read.rows.map((r) => ({
      id: String(r.id),
      fullName: (r.full_name as string | null) ?? null,
      roleTitle: (r.role_title as string | null) ?? null,
      phone: (r.phone as string | null) ?? null,
      email: (r.email as string | null) ?? null,
      isPrimary: Boolean(r.is_primary),
    })),
  };
}

export async function sourcesFor(
  actor: Actor | null,
  prospectId: string,
): Promise<{ ok: true; rows: ProspectSourceRow[] } | { ok: false; error: string }> {
  if (!can(actor, "crm.use")) return refuse("Your role cannot open the sales list.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so where this company came from could not be read.");
  const read = await readEvery<Record<string, unknown>>((from, to) =>
    db
      .from("eng_prospect_sources")
      .select("id, source, source_record_id, first_seen_at, last_seen_at")
      .eq("prospect_id", prospectId)
      .order("first_seen_at", { ascending: true })
      .range(from, to),
  );
  if (!read.ok) return refuse(`Where this company came from could not be read: ${read.error}`);
  return {
    ok: true,
    rows: read.rows.map((r) => ({
      id: String(r.id),
      source: r.source as CrmSource,
      sourceRecordId: String(r.source_record_id),
      firstSeenAt: String(r.first_seen_at),
      lastSeenAt: String(r.last_seen_at),
    })),
  };
}

/**
 * The company already holding this normalized name and telephone, if any,
 * read before a write so a rep is told which company it is rather than met
 * with a refusal. The database's unique key (0111) is the guarantee; this is
 * the courtesy.
 */
export async function companyByNameAndPhone(
  actor: Actor | null,
  name: string,
  phone: string | null,
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  if (!can(actor, "crm.use")) return refuse("Your role cannot open the sales list.");
  const phoneKey = normalizePhone(phone);
  if (!phoneKey) return { ok: true, id: null };
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured.");
  const { data, error } = await db
    .from("eng_prospects")
    .select("id")
    .eq("name_normalized", normalizeName(name))
    .eq("phone_normalized", phoneKey)
    .maybeSingle();
  if (error) return refuse(`The sales list could not be searched: ${error.message}`);
  return { ok: true, id: data ? String(data.id) : null };
}

/* ---------------------------------------------------------------- the people */

export async function addContact(
  actor: Actor | null,
  prospectId: string,
  input: { fullName?: string | null; roleTitle?: string | null; phone?: string | null; email?: string | null; makePrimary?: boolean },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.use")) return refuse("Your role cannot change the sales list.");
  const fullName = input.fullName?.trim() || null;
  const phone = input.phone?.trim() || null;
  const email = input.email?.trim().toLowerCase() || null;
  if (!fullName && !phone && !email) return refuse("A person needs a name, a telephone number or an email address.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return refuse("That email address is not valid.");
  if (input.makePrimary && !phone && !email) return refuse("The primary person needs a telephone number or an email address, or nobody can reach the company.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was added.");

  const recorded = await writeAuditOrRefuse({
    actor,
    action: "prospect.contact_added",
    entityType: "prospect",
    entityId: prospectId,
    summary: `A person added to a company on the sales list${input.makePrimary ? ", as its primary contact" : ""}.`,
  });
  if (!recorded.ok) return recorded;

  if (input.makePrimary) {
    const { error: demoteError } = await db.from("eng_prospect_contacts").update({ is_primary: false }).eq("prospect_id", prospectId).eq("is_primary", true);
    if (demoteError) return refuse(`The current primary contact could not be changed: ${demoteError.message}`);
  }
  const { data, error } = await db
    .from("eng_prospect_contacts")
    .insert({ prospect_id: prospectId, full_name: fullName, role_title: input.roleTitle?.trim() || null, phone, email, is_primary: Boolean(input.makePrimary), created_by: actor.id })
    .select("id")
    .single();
  if (error || !data) return refuse(`The person could not be saved: ${error?.message ?? "no row"}`);

  /* The company row carries the primary person's copy, so the existing screens and the reachable check read it. */
  if (input.makePrimary) {
    const { error: copyError } = await db.from("eng_prospects").update({ contact_name: fullName, phone, email }).eq("id", prospectId);
    if (copyError) return refuse(`The person was saved and the company's contact line could not be updated: ${copyError.message}`);
  }
  return { ok: true, id: String(data.id) };
}

/* ---------------------------------------------------------------- the sources */

/**
 * A source record seen again, or for the first time. The same record on the
 * same company moves last_seen_at; the same record on ANOTHER company is a
 * conflict the import screen settles (R2), never a silent move.
 */
export async function recordSource(
  actor: Actor | null,
  prospectId: string,
  input: { source: CrmSource; sourceRecordId: string; raw?: Record<string, unknown> | null; importRunId?: string | null },
): Promise<{ ok: true; id: string; seenBefore: boolean } | { ok: false; error: string; conflictWith?: string }> {
  if (!actor || !can(actor, "crm.import")) return refuse("Your role cannot import to the sales list.");
  if (!(CRM_SOURCES as readonly string[]).includes(input.source)) return refuse("That is not a source the sales list reads.");
  const recordId = input.sourceRecordId.trim();
  if (!recordId) return refuse("A source record needs its own id.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured.");

  const { data: existing, error: readError } = await db
    .from("eng_prospect_sources")
    .select("id, prospect_id")
    .eq("source", input.source)
    .eq("source_record_id", recordId)
    .maybeSingle();
  if (readError) return refuse(`The source could not be read: ${readError.message}`);
  if (existing && String(existing.prospect_id) !== prospectId) {
    return { ok: false, error: "That record is already on another company. Merge the two companies to keep both sources.", conflictWith: String(existing.prospect_id) };
  }
  if (existing) {
    const { error } = await db.from("eng_prospect_sources").update({ last_seen_at: DB_NOW, raw: input.raw ?? null }).eq("id", existing.id);
    if (error) return refuse(`The source could not be updated: ${error.message}`);
    return { ok: true, id: String(existing.id), seenBefore: true };
  }
  const { data, error } = await db
    .from("eng_prospect_sources")
    .insert({ prospect_id: prospectId, source: input.source, source_record_id: recordId, raw: input.raw ?? null, import_run_id: input.importRunId ?? null })
    .select("id")
    .single();
  if (error || !data) return refuse(`The source could not be saved: ${error?.message ?? "no row"}`);
  return { ok: true, id: String(data.id), seenBefore: false };
}

/**
 * A MERGE KEEPS EVERY SOURCE. Two companies that are one company: every
 * source row and every person on the merged one moves to the survivor (the
 * people as non-primary), and a note on the survivor says so. The merged
 * company keeps its history in the contact log, which is append only, and is
 * marked dormant with a merged tag; nothing is deleted.
 */
export async function mergeInto(
  actor: Actor | null,
  survivorId: string,
  mergedId: string,
): Promise<{ ok: true; movedSources: number; movedContacts: number } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.import")) return refuse("Your role cannot merge companies on the sales list.");
  if (survivorId === mergedId) return refuse("A company cannot be merged into itself.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was merged.");

  const { data: pair, error: pairError } = await db.from("eng_prospects").select("id, company, status, stage, tags").in("id", [survivorId, mergedId]);
  if (pairError) return refuse(`The two companies could not be read: ${pairError.message}`);
  const survivor = pair?.find((p) => String(p.id) === survivorId);
  const merged = pair?.find((p) => String(p.id) === mergedId);
  if (!survivor || !merged) return refuse("One of the two companies does not exist.");
  if (merged.status === "converted") return refuse("The company being merged away is already a customer. Merge the other way round.");

  const recorded = await writeAuditOrRefuse({
    actor,
    action: "prospect.merged",
    entityType: "prospect",
    entityId: survivorId,
    summary: `${String(merged.company)} merged into ${String(survivor.company)} on the sales list.`,
    diff: { survivor: survivorId, merged: mergedId },
  });
  if (!recorded.ok) return recorded;

  const { data: movedSources, error: sourceError } = await db.from("eng_prospect_sources").update({ prospect_id: survivorId }).eq("prospect_id", mergedId).select("id");
  if (sourceError) return refuse(`The sources could not be moved: ${sourceError.message}`);
  const { data: movedContacts, error: contactError } = await db
    .from("eng_prospect_contacts")
    .update({ prospect_id: survivorId, is_primary: false })
    .eq("prospect_id", mergedId)
    .select("id");
  if (contactError) return refuse(`The sources moved and the people could not: ${contactError.message}`);

  const tags = [...new Set([...(Array.isArray(merged.tags) ? (merged.tags as string[]) : []), "merged"])];
  const stageFrom = merged.stage as CrmStage;
  const mergedPatch: Record<string, unknown> = { tags, owner_id: null, next_action_at: null, next_action_kind: null };
  if (stageFrom !== "do_not_contact" && stageFrom !== "dormant") mergedPatch.stage = "dormant";
  const { error: markError } = await db.from("eng_prospects").update(mergedPatch).eq("id", mergedId);
  if (markError) return refuse(`The sources and people moved and the merged company could not be set aside: ${markError.message}`);

  const note = await logContact(actor, {
    subject: "prospect",
    subjectId: survivorId,
    channel: "note",
    body: `${String(merged.company)} was merged into this company: ${movedSources?.length ?? 0} source records and ${movedContacts?.length ?? 0} people moved here.`,
    crm: { activityKind: "note" },
  });
  if (!note.ok) return refuse(`The merge is done and its note could not be written: ${note.error}`);
  return { ok: true, movedSources: movedSources?.length ?? 0, movedContacts: movedContacts?.length ?? 0 };
}

/* ------------------------------------------------------------------- the stage */

/**
 * Move a company's stage. The move is written to the contact log as a stage
 * change (a note naming both stages) and the company's stage and status move
 * together, so the database's two coherence checks hold. Do not contact
 * stamps when and by whom, and is never undone from here.
 */
export async function setStage(
  actor: Actor | null,
  prospectId: string,
  to: CrmStage,
  opts: { refusal?: boolean; reason?: string | null } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.use")) return refuse("Your role cannot change the sales list.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was changed.");
  const { data: row, error: readError } = await db.from("eng_prospects").select("id, company, stage").eq("id", prospectId).maybeSingle();
  if (readError) return refuse(`The company could not be read: ${readError.message}`);
  if (!row) return refuse("That company is not on the sales list.");
  const from = row.stage as CrmStage;
  const move = stageMove(from, to, { refusal: opts.refusal });
  if (!move.ok) return move;

  /* The move first, conditional on the stage read, so the log never records a move that did not happen. */
  const patch: Record<string, unknown> = { stage: to, status: move.status };
  if (to === "do_not_contact") Object.assign(patch, { do_not_contact_at: DB_NOW, do_not_contact_by: actor.id, next_action_at: null, next_action_kind: null });
  const { data: moved, error } = await db.from("eng_prospects").update(patch).eq("id", prospectId).eq("stage", from).select("id");
  if (error) return refuse(`The company could not be moved: ${error.message}`);
  if (!moved?.length) return refuse("The company moved while this was being done. Open it again; nothing was changed.");

  const logged = await logContact(actor, {
    subject: "prospect",
    subjectId: prospectId,
    channel: "note",
    body: `Stage moved from ${STAGE_LABEL[from]} to ${STAGE_LABEL[to]}.${opts.reason?.trim() ? ` ${opts.reason.trim()}` : ""}`,
    crm: { activityKind: "stage_change", stageFrom: from, stageTo: to },
  });
  if (!logged.ok) return refuse(`The company moved to ${STAGE_LABEL[to]} and the stage change could not be written to its history: ${logged.error}`);
  return { ok: true };
}

/* ------------------------------------------------------------ the CRM fields */

export type CrmDetails = {
  vertical?: string;
  score?: number;
  nextActionAt?: string | null;
  nextActionKind?: "call" | "email" | null;
  tags?: string[];
  website?: string | null;
  addressLine?: string | null;
  postalCode?: string | null;
  county?: string | null;
  permitCount?: number;
  lastPermitOn?: string | null;
};

/**
 * The fields R1 adds, checked in words before the database checks them. The
 * county is stored as the region map spells it; the region is derived, never
 * stored (territoryFor).
 */
export function detailsPatch(d: CrmDetails): { ok: true; patch: Record<string, unknown> } | { ok: false; error: string } {
  const patch: Record<string, unknown> = {};
  if (d.vertical !== undefined) {
    if (!(CRM_VERTICALS as readonly string[]).includes(d.vertical)) return refuse("That is not a vertical on the sales list.");
    patch.vertical = d.vertical;
    patch.prospect_type = prospectTypeForVertical(d.vertical as CrmVertical);
  }
  if (d.score !== undefined) {
    const problem = scoreProblem(d.score);
    if (problem) return refuse(problem);
    patch.score = d.score;
  }
  if (d.nextActionAt !== undefined) {
    if (d.nextActionAt && Number.isNaN(Date.parse(d.nextActionAt))) return refuse("The next action time is not a date and time.");
    patch.next_action_at = d.nextActionAt || null;
  }
  if (d.nextActionKind !== undefined) {
    if (d.nextActionKind !== null && d.nextActionKind !== "call" && d.nextActionKind !== "email") return refuse("The next action is a call or an email.");
    patch.next_action_kind = d.nextActionKind;
  }
  if (d.tags !== undefined) patch.tags = [...new Set(d.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (d.website !== undefined) patch.website = d.website?.trim() || null;
  if (d.addressLine !== undefined) patch.address_line = d.addressLine?.trim() || null;
  if (d.postalCode !== undefined) {
    const zip = d.postalCode?.trim() || null;
    if (zip && !/^[0-9]{5}(-[0-9]{4})?$/.test(zip)) return refuse("A ZIP code is five digits.");
    patch.postal_code = zip;
  }
  if (d.county !== undefined) {
    const problem = countyProblem(d.county);
    if (problem) return refuse(problem);
    patch.county = d.county ? territoryFor(d.county)!.county : null;
  }
  if (d.permitCount !== undefined) {
    if (!Number.isInteger(d.permitCount) || d.permitCount < 0) return refuse("A permit count is a whole number.");
    patch.permit_count = d.permitCount;
  }
  if (d.lastPermitOn !== undefined) {
    if (d.lastPermitOn && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d.lastPermitOn)) return refuse("The last permit date is not a date.");
    patch.last_permit_on = d.lastPermitOn || null;
  }
  return { ok: true, patch };
}

export async function setDetails(
  actor: Actor | null,
  prospectId: string,
  details: CrmDetails,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.use")) return refuse("Your role cannot change the sales list.");
  const built = detailsPatch(details);
  if (!built.ok) return built;
  if (Object.keys(built.patch).length === 0) return refuse("Nothing to change.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was changed.");
  const recorded = await writeAuditOrRefuse({
    actor,
    action: "prospect.updated",
    entityType: "prospect",
    entityId: prospectId,
    summary: `Sales details changed: ${Object.keys(built.patch).join(", ")}.`,
    diff: built.patch,
  });
  if (!recorded.ok) return recorded;
  const { error } = await db.from("eng_prospects").update(built.patch).eq("id", prospectId);
  if (error) return refuse(`The change could not be saved: ${error.message}`);
  return { ok: true };
}
