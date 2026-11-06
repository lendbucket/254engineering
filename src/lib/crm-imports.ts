import "server-only";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { writeAuditOrRefuse } from "./ops-audit";
import { readEvery } from "./bounded-read";
import { DB_NOW } from "./db-now";
import { todayInFirmCalendar } from "./firm-calendar";
import { normalizeName, normalizePhone, prospectTypeForVertical, territoryFor, type CrmSource, type CrmVertical } from "./crm-rules";
import { AUSTIN_WHERE, TREC_WHERE, parseBoughtList, parseSource, type ImportRecord, type ParseResult } from "./crm-import-parse";
import { HELD_KEEP, buildIndex, planRecords, rowsToStore, staleLines, tally, type ListIndex, type PlannedRow, type Verdict } from "./crm-import-plan";
import { CRM_SOURCE_DECLS, sourceDecl, sourceRefusal, type CrmSourceDecl } from "@/config/crm-sources";

/**
 * THE IMPORT ENGINE. Robert's sales CRM ruling of 2026-11-02, item R2,
 * migration 0114.
 *
 * A PREVIEW fetches one source, reads it (crm-import-parse), decides every
 * record against the list as it is (crm-import-plan), and stores the run and
 * its verdicts. A scheduled preview does exactly this and nothing more: "a
 * person presses Write" (his answer 4).
 *
 * WRITE re-plans every stored record against the list as it is at that moment
 * and refuses if a single verdict moved, then adds the new companies with
 * their person and their source, and gives every merged company its source
 * row ("merge keeps every source"). Conflicts and held records wait for a
 * person, who settles each on the screen (resolveConflict, resolveHeld).
 *
 * Every write is audited first (writeAuditOrRefuse), as the rest of the sales
 * list is, and every refusal is a sentence a person can act on.
 */

type Db = NonNullable<ReturnType<typeof supabaseAdmin>>;
const refuse = (error: string) => ({ ok: false as const, error });

/** How long one fetch of a source may take before the run is recorded as failed. */
const FETCH_TIMEOUT_MS = 120_000;
/** Socrata's page: the most rows one request asks for, and a short page is the last. */
const SODA_PAGE = 50_000;

export const VERDICT_LABEL: Record<Verdict, string> = {
  add: "New companies",
  merge: "Already on the list",
  conflict: "Need a choice",
  held: "Held, no phone",
  skip: "Not imported",
};

/* ------------------------------------------------------------------ fetching */

/**
 * The source's content, every row of it. A CSV is one file; a Socrata resource
 * is read in pages until a short page, with the source's filter in the query,
 * and the rows are counted rather than trusted (CLAUDE.md: a read that stops
 * at a ceiling it does not know about reports the ceiling).
 */
export async function fetchSourceContent(decl: CrmSourceDecl): Promise<{ text?: string; rows?: Record<string, unknown>[] }> {
  if (!decl.fetchUrl || !decl.format) throw new Error(`${decl.label} declares nothing to fetch.`);
  if (decl.format === "csv") {
    const res = await fetch(decl.fetchUrl, { redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) throw new Error(`${decl.label} answered HTTP ${res.status}.`);
    return { text: await res.text() };
  }
  const where = decl.key === "permits_austin" ? AUSTIN_WHERE : decl.key === "trec" ? TREC_WHERE : null;
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += SODA_PAGE) {
    const params = new URLSearchParams({ $limit: String(SODA_PAGE), $offset: String(offset), $order: ":id" });
    if (where) params.set("$where", where);
    const res = await fetch(`${decl.fetchUrl}?${params.toString()}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) throw new Error(`${decl.label} answered HTTP ${res.status} at row ${offset}.`);
    const page = (await res.json()) as Record<string, unknown>[];
    if (!Array.isArray(page)) throw new Error(`${decl.label} did not answer with rows at row ${offset}.`);
    rows.push(...page);
    if (page.length < SODA_PAGE) break;
  }
  return { rows };
}

/* ------------------------------------------------------------- the list index */

/** The list as it is: every company's keys, every source record, every person's telephone. Each read whole or refused. */
export async function readListIndex(db: Db): Promise<{ ok: true; index: ListIndex } | { ok: false; error: string }> {
  const opts = { pageSize: 1000, maxPages: 2000 };
  const companies = await readEvery<Record<string, unknown>>(
    (from, to) => db.from("eng_prospects").select("id, name_normalized, phone_normalized, county, address_line, permit_count, last_permit_on").order("id").range(from, to),
    opts,
  );
  if (!companies.ok) return refuse(`The sales list could not be read: ${companies.error}`);
  const sources = await readEvery<Record<string, unknown>>(
    (from, to) => db.from("eng_prospect_sources").select("source, source_record_id, prospect_id").order("id").range(from, to),
    opts,
  );
  if (!sources.ok) return refuse(`Where the companies came from could not be read: ${sources.error}`);
  const phones = await readEvery<Record<string, unknown>>(
    (from, to) => db.from("eng_prospect_contacts").select("prospect_id, phone_normalized").not("phone_normalized", "is", null).order("id").range(from, to),
    opts,
  );
  if (!phones.ok) return refuse(`The people at the companies could not be read: ${phones.error}`);
  return {
    ok: true,
    index: buildIndex(
      companies.rows.map((c) => ({
        id: String(c.id),
        nameKey: (c.name_normalized as string | null) ?? null,
        phoneKey: (c.phone_normalized as string | null) ?? null,
        county: (c.county as string | null) ?? null,
        addressLine: (c.address_line as string | null) ?? null,
        permitCount: Number(c.permit_count ?? 0),
        lastPermitOn: (c.last_permit_on as string | null) ?? null,
      })),
      sources.rows.map((s) => ({ source: String(s.source), sourceRecordId: String(s.source_record_id), prospectId: String(s.prospect_id) })),
      phones.rows.map((p) => ({ prospectId: String(p.prospect_id), phoneKey: (p.phone_normalized as string | null) ?? null })),
    ),
  };
}

/* --------------------------------------------------------------------- preview */

export type PreviewInput =
  | { source: string; trigger: "schedule" | "person" }
  | { source: "csv"; trigger: "person"; csv: { text: string; fileName: string; defaultVertical: CrmVertical | null } };

/**
 * One preview of one source. Records the run first, so a pull that dies
 * leaves a run that says it failed rather than nothing. A source that may not
 * run is recorded as refused with its reason, so the screen shows why.
 */
export async function runPreview(
  actor: Actor | null,
  input: PreviewInput,
): Promise<{ ok: true; runId: string; counts: ReturnType<typeof tally> & { rowsRead: number } } | { ok: false; error: string; runId?: string }> {
  if (input.trigger === "person" && (!actor || !can(actor, "crm.import"))) return refuse("Your role cannot import to the sales list.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was read.");
  const isCsv = "csv" in input;
  const decl = isCsv ? null : sourceDecl(input.source);
  const refusal = isCsv ? null : sourceRefusal(decl);
  const requestedBy = input.trigger === "person" ? actor!.id : null;

  if (refusal) {
    if (!decl) return refuse(refusal);
    const { data } = await db
      .from("eng_crm_import_runs")
      .insert({ source: decl.key, trigger: input.trigger, requested_by: requestedBy, status: "refused", error: refusal, finished_at: DB_NOW })
      .select("id")
      .single();
    return { ok: false, error: refusal, runId: data ? String(data.id) : undefined };
  }

  const source = (isCsv ? "csv" : decl!.key) as CrmSource;
  const { data: run, error: runError } = await db
    .from("eng_crm_import_runs")
    .insert({
      source,
      trigger: input.trigger,
      requested_by: requestedBy,
      terms_read_on: decl?.termsReadOn ?? null,
      file_name: isCsv ? input.csv.fileName.slice(0, 200) : null,
    })
    .select("id")
    .single();
  if (runError || !run) return refuse(`The import could not be started: ${runError?.message ?? "no row"}`);
  const runId = String(run.id);

  const fail = async (error: string) => {
    await db.from("eng_crm_import_runs").update({ status: "failed", error, finished_at: DB_NOW }).eq("id", runId).eq("status", "previewing");
    return { ok: false as const, error, runId };
  };

  let parsed: ParseResult;
  try {
    if (isCsv) {
      const list = parseBoughtList(input.csv.text, input.csv.defaultVertical);
      if (list.error) return fail(list.error);
      parsed = list;
    } else {
      parsed = parseSource(source, await fetchSourceContent(decl!), todayInFirmCalendar());
    }
  } catch (e) {
    return fail(`${decl?.label ?? "The file"} could not be read: ${e instanceof Error ? e.message : String(e)}`);
  }

  const listIndex = await readListIndex(db);
  if (!listIndex.ok) return fail(listIndex.error);
  const planned = planRecords(source, parsed.records, parsed.skipped, listIndex.index);
  const counts = tally(planned);
  const stored = rowsToStore(planned);

  for (let i = 0; i < stored.length; i += 500) {
    const chunk = stored.slice(i, i + 500).map((r) => ({
      run_id: runId,
      line: r.line,
      source_record_id: r.sourceRecordId,
      verdict: r.verdict,
      prospect_id: r.prospectId,
      candidate_ids: r.candidateIds,
      reason: r.reason,
      payload: { ...r.payload, mergeLine: r.mergeLine },
    }));
    const { error } = await db.from("eng_crm_import_rows").insert(chunk);
    if (error) return fail(`The preview's rows could not be stored after ${i} of ${stored.length}: ${error.message}`);
  }

  const { error: doneError } = await db
    .from("eng_crm_import_runs")
    .update({
      status: "previewed",
      finished_at: DB_NOW,
      rows_read: parsed.rowsRead,
      records: planned.length,
      adds: counts.adds,
      merges: counts.merges,
      conflicts: counts.conflicts,
      held: counts.held,
      held_kept: Math.min(counts.held, HELD_KEEP),
      skipped: counts.skipped,
    })
    .eq("id", runId)
    .eq("status", "previewing");
  if (doneError) return fail(`The preview was read and its totals could not be saved: ${doneError.message}`);
  return { ok: true, runId, counts: { ...counts, rowsRead: parsed.rowsRead } };
}

/* ----------------------------------------------------------------------- write */

type StoredRow = { id: string; line: number; sourceRecordId: string; verdict: Verdict; prospectId: string | null; candidateIds: string[]; reason: string | null; payload: ImportRecord & { mergeLine?: number | null } };

function toStored(r: Record<string, unknown>): StoredRow {
  return {
    id: String(r.id),
    line: Number(r.line),
    sourceRecordId: String(r.source_record_id),
    verdict: r.verdict as Verdict,
    prospectId: (r.prospect_id as string | null) ?? null,
    candidateIds: Array.isArray(r.candidate_ids) ? (r.candidate_ids as string[]) : [],
    reason: (r.reason as string | null) ?? null,
    payload: r.payload as StoredRow["payload"],
  };
}

async function readRunRows(db: Db, runId: string, verdicts: Verdict[]): Promise<{ ok: true; rows: StoredRow[] } | { ok: false; error: string }> {
  const read = await readEvery<Record<string, unknown>>(
    (from, to) =>
      db
        .from("eng_crm_import_rows")
        .select("id, line, source_record_id, verdict, prospect_id, candidate_ids, reason, payload")
        .eq("run_id", runId)
        .in("verdict", verdicts)
        .order("line")
        .range(from, to),
    { pageSize: 1000, maxPages: 2000 },
  );
  if (!read.ok) return refuse(`The preview's rows could not be read: ${read.error}`);
  return { ok: true, rows: read.rows.map(toStored) };
}

/** The eng_prospects row a record becomes. The kind is derived from the vertical until Robert's destructive sitting replaces it (0112). */
export function prospectRowFrom(record: ImportRecord, id: string, createdBy: string): Record<string, unknown> {
  const territory = territoryFor(record.county);
  return {
    id,
    company: record.company.slice(0, 200),
    contact_name: record.contactName,
    phone: record.phone,
    email: record.email,
    city: record.city,
    prospect_type: prospectTypeForVertical(record.vertical),
    vertical: record.vertical,
    county: territory?.county ?? null,
    address_line: record.addressLine,
    postal_code: record.postalCode && /^\d{5}$/.test(record.postalCode) ? record.postalCode : null,
    website: record.website,
    tags: record.tags,
    permit_count: record.permitCount ?? 0,
    last_permit_on: record.lastPermitOn,
    created_by: createdBy,
  };
}

function sourceRaw(record: ImportRecord, decl: CrmSourceDecl | null): Record<string, unknown> {
  return { ...record.raw, ...(decl?.attribution ? { attribution: decl.attribution } : {}) };
}

/**
 * WRITE A PREVIEWED RUN. Only a person with crm.import, only a run that is
 * previewed, and only if re-planning every stored record against the list as
 * it is now gives the same verdict for each.
 */
export async function writeRun(
  actor: Actor | null,
  runId: string,
): Promise<{ ok: true; added: number; merged: number; waiting: number } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.import")) return refuse("Your role cannot import to the sales list.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was written.");

  const { data: run, error: runError } = await db.from("eng_crm_import_runs").select("id, source, status, adds, merges, conflicts, held").eq("id", runId).maybeSingle();
  if (runError) return refuse(`The import could not be read: ${runError.message}`);
  if (!run) return refuse("That import does not exist.");
  if (run.status === "written") return refuse("This import was already written.");
  if (run.status !== "previewed") return refuse("Only a finished preview can be written. Run the preview again.");
  const source = String(run.source) as CrmSource;
  const decl = source === "csv" ? null : sourceDecl(source);
  if (source !== "csv") {
    const refusal = sourceRefusal(decl);
    if (refusal) return refuse(`${refusal} Nothing was written.`);
  }

  const stored = await readRunRows(db, runId, ["add", "merge", "conflict", "held"]);
  if (!stored.ok) return stored;
  const listIndex = await readListIndex(db);
  if (!listIndex.ok) return listIndex;

  /* The staleness test: the same records against the list as it is now. */
  const records = stored.rows.map((r) => r.payload as ImportRecord);
  const replanned = planRecords(source, records, [], listIndex.index);
  const asPlanned: PlannedRow[] = stored.rows.map((r) => ({
    line: r.line,
    sourceRecordId: r.sourceRecordId,
    verdict: r.verdict,
    prospectId: r.prospectId,
    candidateIds: r.candidateIds,
    reason: r.reason,
    mergeLine: r.payload.mergeLine ?? null,
    payload: r.payload,
  }));
  const moved = staleLines(asPlanned, replanned);
  if (moved.length) {
    return refuse(
      `The sales list changed since this preview: ${moved.length} record${moved.length === 1 ? "" : "s"} would now be decided differently ` +
        `(line${moved.length === 1 ? "" : "s"} ${moved.slice(0, 5).join(", ")}${moved.length > 5 ? " and more" : ""}). Run the preview again; nothing was written.`,
    );
  }

  const adds = stored.rows.filter((r) => r.verdict === "add");
  const merges = stored.rows.filter((r) => r.verdict === "merge");
  const waiting = stored.rows.filter((r) => r.verdict === "conflict").length;

  const recorded = await writeAuditOrRefuse({
    actor,
    action: "prospect.imported",
    entityType: "crm_import_run",
    entityId: runId,
    summary: `Import written from ${decl?.label ?? "a spreadsheet"}: ${adds.length} new companies, ${merges.length} already on the list, ${waiting} waiting for a choice.`,
    diff: { source, adds: adds.length, merges: merges.length, conflicts: waiting },
  });
  if (!recorded.ok) return recorded;

  /* The new companies, each with its person and its source. */
  const newIdByLine = new Map<number, string>();
  for (let i = 0; i < adds.length; i += 500) {
    const chunk = adds.slice(i, i + 500).map((r) => {
      const id = randomUUID();
      newIdByLine.set(r.line, id);
      return { row: r, id };
    });
    const { error } = await db.from("eng_prospects").insert(chunk.map(({ row, id }) => prospectRowFrom(row.payload, id, actor.id)));
    if (error) {
      return refuse(
        `${i} of ${adds.length} new companies were written and the rest could not be: ${error.message}. ` +
          "Run the preview again: the companies already written will read as on the list.",
      );
    }
    const contacts = chunk
      .filter(({ row }) => row.payload.contactName || row.payload.phone || row.payload.email)
      .map(({ row, id }) => ({ prospect_id: id, full_name: row.payload.contactName, phone: row.payload.phone, email: row.payload.email, is_primary: true, created_by: actor.id }));
    if (contacts.length) {
      const { error: contactError } = await db.from("eng_prospect_contacts").insert(contacts);
      if (contactError) return refuse(`${i + chunk.length} new companies were written and their people could not be: ${contactError.message}`);
    }
    const { error: sourceError } = await db.from("eng_prospect_sources").insert(
      chunk.map(({ row, id }) => ({ prospect_id: id, source, source_record_id: row.sourceRecordId, raw: sourceRaw(row.payload, decl), import_run_id: runId })),
    );
    if (sourceError) return refuse(`${i + chunk.length} new companies were written and where they came from could not be: ${sourceError.message}`);
  }

  /* Every merge keeps its source: refreshed where this source gave it before, added where it did not. */
  for (const r of merges) {
    const target = r.prospectId ?? (r.payload.mergeLine ? newIdByLine.get(r.payload.mergeLine) : undefined);
    if (!target) return refuse(`Line ${r.line} merges into a company this import did not create. Run the preview again.`);
    const seenOn = listIndex.index.bySource.get(`${source}|${r.sourceRecordId}`);
    if (seenOn === target) {
      const { error } = await db
        .from("eng_prospect_sources")
        .update({ last_seen_at: DB_NOW, raw: sourceRaw(r.payload, decl), import_run_id: runId })
        .eq("source", source)
        .eq("source_record_id", r.sourceRecordId);
      if (error) return refuse(`Line ${r.line}: its source could not be refreshed: ${error.message}`);
    } else {
      const { error } = await db
        .from("eng_prospect_sources")
        .insert({ prospect_id: target, source, source_record_id: r.sourceRecordId, raw: sourceRaw(r.payload, decl), import_run_id: runId });
      if (error) return refuse(`Line ${r.line}: its source could not be added to the company: ${error.message}`);
    }
    const existing = listIndex.index.companies.get(target);
    if (existing && r.payload.permitCount !== null && r.payload.permitCount !== undefined) {
      const count = Math.max(existing.permitCount, r.payload.permitCount);
      const last = [existing.lastPermitOn, r.payload.lastPermitOn].filter(Boolean).sort().pop() ?? null;
      if (count !== existing.permitCount || last !== existing.lastPermitOn) {
        const { error } = await db.from("eng_prospects").update({ permit_count: count, last_permit_on: last }).eq("id", target);
        if (error) return refuse(`Line ${r.line}: the company's permit activity could not be updated: ${error.message}`);
      }
    }
  }

  const { data: done, error: doneError } = await db
    .from("eng_crm_import_runs")
    .update({ status: "written", written_at: DB_NOW, written_by: actor.id })
    .eq("id", runId)
    .eq("status", "previewed")
    .select("id");
  if (doneError) return refuse(`The import was written and could not be marked written: ${doneError.message}`);
  if (!done?.length) return refuse("The import was written while another person wrote it too. Open it again to see what it holds.");
  return { ok: true, added: adds.length, merged: merges.length, waiting };
}

/* ---------------------------------------------------- settling what waits */

async function readOpenRow(db: Db, rowId: string, verdict: "held" | "conflict") {
  const { data, error } = await db
    .from("eng_crm_import_rows")
    .select("id, run_id, line, source_record_id, verdict, candidate_ids, payload, resolution, eng_crm_import_runs!inner(source, status)")
    .eq("id", rowId)
    .maybeSingle();
  if (error) return refuse(`That row could not be read: ${error.message}`);
  if (!data) return refuse("That row does not exist.");
  if (data.verdict !== verdict) return refuse(verdict === "held" ? "That row is not held." : "That row is not waiting for a choice.");
  if (data.resolution) return refuse("That row was already settled.");
  const runRel = (Array.isArray(data.eng_crm_import_runs) ? data.eng_crm_import_runs[0] : data.eng_crm_import_runs) as { source: string; status: string } | null;
  if (!runRel || (runRel.status !== "previewed" && runRel.status !== "written")) return refuse("That import did not finish, so its rows cannot be settled.");
  return { ok: true as const, row: data, source: runRel.source as CrmSource };
}

async function addSourceTo(db: Db, prospectId: string, source: CrmSource, recordId: string, record: ImportRecord, runId: string): Promise<string | null> {
  const { data: existing, error } = await db.from("eng_prospect_sources").select("prospect_id").eq("source", source).eq("source_record_id", recordId).maybeSingle();
  if (error) return `The source could not be read: ${error.message}`;
  if (existing && String(existing.prospect_id) !== prospectId) return "That record is already on another company. Merge the two companies to keep both sources.";
  if (existing) return null;
  const { error: insertError } = await db
    .from("eng_prospect_sources")
    .insert({ prospect_id: prospectId, source, source_record_id: recordId, raw: sourceRaw(record, sourceDecl(source)), import_run_id: runId });
  return insertError ? `The source could not be added: ${insertError.message}` : null;
}

/**
 * A HELD RECORD GETS A PHONE. The company is added with it, or, when a company
 * of that name and telephone is already on the list, the record joins that
 * company as one more source.
 */
export async function resolveHeld(
  actor: Actor | null,
  rowId: string,
  phone: string,
): Promise<{ ok: true; prospectId: string; joined: boolean } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.import")) return refuse("Your role cannot import to the sales list.");
  const phoneKey = normalizePhone(phone);
  if (!phoneKey) return refuse("That is not a ten digit telephone number.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was added.");
  const open = await readOpenRow(db, rowId, "held");
  if (!open.ok) return open;
  const record = { ...(open.row.payload as ImportRecord), phone: phone.trim() };

  const recorded = await writeAuditOrRefuse({
    actor,
    action: "prospect.import_held_resolved",
    entityType: "crm_import_row",
    entityId: rowId,
    summary: `A held record, ${record.company}, given a telephone and brought onto the sales list.`,
  });
  if (!recorded.ok) return recorded;

  const { data: same, error: sameError } = await db
    .from("eng_prospects")
    .select("id")
    .eq("name_normalized", normalizeName(record.company))
    .eq("phone_normalized", phoneKey)
    .maybeSingle();
  if (sameError) return refuse(`The sales list could not be searched: ${sameError.message}`);

  let prospectId: string;
  let joined = false;
  if (same) {
    prospectId = String(same.id);
    joined = true;
  } else {
    prospectId = randomUUID();
    const { error } = await db.from("eng_prospects").insert(prospectRowFrom(record, prospectId, actor.id));
    if (error) return refuse(`The company could not be added: ${error.message}`);
    const { error: contactError } = await db
      .from("eng_prospect_contacts")
      .insert({ prospect_id: prospectId, full_name: record.contactName, phone: record.phone, email: record.email, is_primary: true, created_by: actor.id });
    if (contactError) return refuse(`The company was added and its person could not be: ${contactError.message}`);
  }
  const sourceProblem = await addSourceTo(db, prospectId, open.source, String(open.row.source_record_id), record, String(open.row.run_id));
  if (sourceProblem) return refuse(sourceProblem);

  const { error: markError } = await db
    .from("eng_crm_import_rows")
    .update({ resolution: joined ? "merged" : "added", resolved_at: DB_NOW, resolved_by: actor.id, prospect_id: prospectId })
    .eq("id", rowId)
    .is("resolution", null);
  if (markError) return refuse(`The company is on the list and the row could not be marked settled: ${markError.message}`);
  return { ok: true, prospectId, joined };
}

/** A CONFLICT IS SETTLED BY A PERSON: the record joins the company they choose, which must be one it could be. */
export async function resolveConflict(
  actor: Actor | null,
  rowId: string,
  prospectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.import")) return refuse("Your role cannot import to the sales list.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was changed.");
  const open = await readOpenRow(db, rowId, "conflict");
  if (!open.ok) return open;
  const candidates = Array.isArray(open.row.candidate_ids) ? (open.row.candidate_ids as string[]) : [];
  if (!candidates.includes(prospectId)) return refuse("That company is not one this record could be.");
  const record = open.row.payload as ImportRecord;

  const recorded = await writeAuditOrRefuse({
    actor,
    action: "prospect.import_conflict_resolved",
    entityType: "crm_import_row",
    entityId: rowId,
    summary: `${record.company} joined the company chosen for it, as one more source.`,
    diff: { prospectId },
  });
  if (!recorded.ok) return recorded;

  const sourceProblem = await addSourceTo(db, prospectId, open.source, String(open.row.source_record_id), record, String(open.row.run_id));
  if (sourceProblem) return refuse(sourceProblem);
  const { error } = await db
    .from("eng_crm_import_rows")
    .update({ resolution: "merged", resolved_at: DB_NOW, resolved_by: actor.id, prospect_id: prospectId })
    .eq("id", rowId)
    .is("resolution", null);
  if (error) return refuse(`The record joined the company and the row could not be marked settled: ${error.message}`);
  return { ok: true };
}

/** A conflict or a held record a person decides is not one the firm wants: marked, not deleted. */
export async function dismissRow(actor: Actor | null, rowId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!actor || !can(actor, "crm.import")) return refuse("Your role cannot import to the sales list.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was changed.");
  const { data: row, error: readError } = await db.from("eng_crm_import_rows").select("id, verdict, resolution").eq("id", rowId).maybeSingle();
  if (readError) return refuse(`That row could not be read: ${readError.message}`);
  if (!row) return refuse("That row does not exist.");
  if (row.verdict !== "held" && row.verdict !== "conflict") return refuse("Only a held row or one waiting for a choice can be set aside.");
  if (row.resolution) return refuse("That row was already settled.");
  const recorded = await writeAuditOrRefuse({ actor, action: "prospect.import_row_dismissed", entityType: "crm_import_row", entityId: rowId, summary: "An import row set aside by a person." });
  if (!recorded.ok) return recorded;
  const { error } = await db.from("eng_crm_import_rows").update({ resolution: "dismissed", resolved_at: DB_NOW, resolved_by: actor.id }).eq("id", rowId).is("resolution", null);
  if (error) return refuse(`The row could not be set aside: ${error.message}`);
  return { ok: true };
}

/* ------------------------------------------------------------------- reading */

export type RunSummary = {
  id: string;
  createdAt: string;
  source: CrmSource;
  trigger: "schedule" | "person";
  status: "previewing" | "previewed" | "written" | "failed" | "refused";
  requestedBy: string | null;
  writtenBy: string | null;
  writtenAt: string | null;
  rowsRead: number;
  records: number;
  adds: number;
  merges: number;
  conflicts: number;
  held: number;
  heldKept: number;
  skipped: number;
  error: string | null;
  termsReadOn: string | null;
  fileName: string | null;
};

const RUN_COLUMNS =
  "id, created_at, source, trigger, status, rows_read, records, adds, merges, conflicts, held, held_kept, skipped, error, terms_read_on, file_name, written_at, requester:eng_profiles!eng_crm_import_runs_requested_by_fkey(display_name), writer:eng_profiles!eng_crm_import_runs_written_by_fkey(display_name)";

function toRun(r: Record<string, unknown>): RunSummary {
  const name = (rel: unknown) => {
    const one = Array.isArray(rel) ? rel[0] : rel;
    return one && typeof one === "object" ? ((one as { display_name?: string }).display_name ?? null) : null;
  };
  return {
    id: String(r.id),
    createdAt: String(r.created_at),
    source: r.source as CrmSource,
    trigger: r.trigger as RunSummary["trigger"],
    status: r.status as RunSummary["status"],
    requestedBy: name(r.requester),
    writtenBy: name(r.writer),
    writtenAt: (r.written_at as string | null) ?? null,
    rowsRead: Number(r.rows_read ?? 0),
    records: Number(r.records ?? 0),
    adds: Number(r.adds ?? 0),
    merges: Number(r.merges ?? 0),
    conflicts: Number(r.conflicts ?? 0),
    held: Number(r.held ?? 0),
    heldKept: Number(r.held_kept ?? 0),
    skipped: Number(r.skipped ?? 0),
    error: (r.error as string | null) ?? null,
    termsReadOn: (r.terms_read_on as string | null) ?? null,
    fileName: (r.file_name as string | null) ?? null,
  };
}

export async function listRuns(
  actor: Actor | null,
  query: { page: number; pageSize: number; source?: string; status?: string; direction?: "asc" | "desc"; search?: string },
): Promise<{ ok: true; rows: RunSummary[]; total: number; page: number; pageSize: number } | { ok: false; error: string }> {
  if (!can(actor, "crm.import")) return refuse("Your role cannot open the imports.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the imports could not be read.");
  const from = (Math.max(1, query.page) - 1) * query.pageSize;
  let q = db.from("eng_crm_import_runs").select(RUN_COLUMNS, { count: "exact" });
  if (query.source && query.source !== "all") q = q.eq("source", query.source);
  if (query.status && query.status !== "all") q = q.eq("status", query.status);
  const term = query.search?.trim().replace(/[%_,()]/g, "");
  if (term) q = q.ilike("file_name", `%${term}%`);
  const { data, error, count } = await q.order("created_at", { ascending: query.direction === "asc" }).order("id").range(from, from + query.pageSize - 1);
  if (error) return refuse(`The imports could not be read: ${error.message}`);
  if (count === null) return refuse("The imports were read and their total could not be counted.");
  return { ok: true, rows: (data ?? []).map((r) => toRun(r as Record<string, unknown>)), total: count, page: Math.max(1, query.page), pageSize: query.pageSize };
}

export async function getRun(actor: Actor | null, runId: string): Promise<{ ok: true; run: RunSummary | null } | { ok: false; error: string }> {
  if (!can(actor, "crm.import")) return refuse("Your role cannot open the imports.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the import could not be read.");
  const { data, error } = await db.from("eng_crm_import_runs").select(RUN_COLUMNS).eq("id", runId).maybeSingle();
  if (error) return refuse(`The import could not be read: ${error.message}`);
  return { ok: true, run: data ? toRun(data as Record<string, unknown>) : null };
}

/** The latest run of every declared source, for the sources panel. One read per source, each answered or said to have failed. */
export async function latestRunBySource(actor: Actor | null): Promise<{ ok: true; runs: Map<string, RunSummary> } | { ok: false; error: string }> {
  if (!can(actor, "crm.import")) return refuse("Your role cannot open the imports.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the imports could not be read.");
  const runs = new Map<string, RunSummary>();
  for (const decl of CRM_SOURCE_DECLS) {
    const { data, error } = await db.from("eng_crm_import_runs").select(RUN_COLUMNS).eq("source", decl.key).order("created_at", { ascending: false }).limit(1);
    if (error) return refuse(`The last import of ${decl.label} could not be read: ${error.message}`);
    if (data?.[0]) runs.set(decl.key, toRun(data[0] as Record<string, unknown>));
  }
  return { ok: true, runs };
}

export type RunRow = StoredRow & { resolution: string | null; candidates: { id: string; company: string; phone: string | null; county: string | null }[] };

export async function runRows(
  actor: Actor | null,
  runId: string,
  query: { verdict: Verdict; page: number; pageSize: number; search?: string; sort?: "line" | "company" },
): Promise<{ ok: true; rows: RunRow[]; total: number; page: number; pageSize: number } | { ok: false; error: string }> {
  if (!can(actor, "crm.import")) return refuse("Your role cannot open the imports.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the import could not be read.");
  const from = (Math.max(1, query.page) - 1) * query.pageSize;
  let q = db
    .from("eng_crm_import_rows")
    .select("id, line, source_record_id, verdict, prospect_id, candidate_ids, reason, payload, resolution", { count: "exact" })
    .eq("run_id", runId)
    .eq("verdict", query.verdict);
  const term = query.search?.trim();
  if (term) q = q.ilike("payload->>company", `%${term.replace(/[%_]/g, "")}%`);
  const ordered = query.sort === "company" ? q.order("payload->>company", { ascending: true }).order("line") : q.order("line");
  const { data, error, count } = await ordered.range(from, from + query.pageSize - 1);
  if (error) return refuse(`The import's rows could not be read: ${error.message}`);
  if (count === null) return refuse("The import's rows were read and their total could not be counted.");
  const rows = (data ?? []).map((r) => ({ ...toStored(r as Record<string, unknown>), resolution: ((r as Record<string, unknown>).resolution as string | null) ?? null, candidates: [] as RunRow["candidates"] }));
  const ids = [...new Set(rows.flatMap((r) => [...r.candidateIds, ...(r.prospectId ? [r.prospectId] : [])]))];
  if (ids.length) {
    const { data: companies, error: companyError } = await db.from("eng_prospects").select("id, company, phone, county").in("id", ids.slice(0, 200));
    if (companyError) return refuse(`The companies these rows name could not be read: ${companyError.message}`);
    const byId = new Map((companies ?? []).map((c) => [String(c.id), { id: String(c.id), company: String(c.company), phone: (c.phone as string | null) ?? null, county: (c.county as string | null) ?? null }]));
    for (const r of rows) r.candidates = [...r.candidateIds, ...(r.prospectId ? [r.prospectId] : [])].map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  }
  return { ok: true, rows, total: count, page: Math.max(1, query.page), pageSize: query.pageSize };
}

/**
 * THE GOOGLE PLACES LOOKUP, CLOSED. R2 allows a Places lookup to enrich one
 * record on demand, storing nothing, under Google's 30 day cache rule. It needs
 * a Google Maps Platform key, which the firm has not added, so the door is
 * closed and says why; nothing from Google is read or stored.
 */
export const PLACES_LOOKUP_CLOSED =
  "A Google Places lookup is not set up: it needs a Google Maps Platform key, which the firm has not added. Find the number another way and type it in; nothing from Google is stored either way.";
