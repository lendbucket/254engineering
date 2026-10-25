import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, holdsLicence, licenceRefusal, type Actor } from "./ops-authz";
import { writeAudit } from "./ops-audit";
import { verifiedEngineers } from "@/config/credentials";
import { licenceIsCurrentToday } from "./launch";
import { readEvery, readEveryIn } from "./bounded-read";

/**
 * ===========================================================================
 * WHAT A FOUNDATION OR PERMIT LETTER PRINTS THAT SOMEBODY HAD TO RECORD.
 * ===========================================================================
 *
 * Operator ruling 7 of 2026-10-23, migration 0085. The letters (254-FC-001
 * template 4, 254-PL-001 template 7) print facts the platform did not hold.
 * The ruling says who records each, and that the recorded value is what prints:
 *
 *   FC-3  foundation_type      the engineer confirms or corrects it at review
 *   PL-2  authority_address,   the office records them before review; they
 *         authority_salutation print as recorded and he sees them at review
 *   PL-3  element_described    the engineer may correct it at review
 *   PL-4  triage               the engineer records site job or desk job
 *   PL-5  capture additions    he adds capture items in his own words
 *
 * The database holds who may record which fact (0085's capacity check); this
 * file asks the person first so the refusal is a sentence, and writes the
 * audit trail. Every value is append only: a correction is a new row and the
 * newest is the value, so what a letter printed can always be traced.
 */

export type OfficeFact = "authority_address" | "authority_salutation";
export type EngineerFact = "foundation_type" | "element_described";
export type LetterFact = OfficeFact | EngineerFact;
export const FOUNDATION_TYPES = ["slab-on-grade", "pier-and-beam", "crawlspace"] as const;
export type FoundationType = (typeof FOUNDATION_TYPES)[number];

type Ok<T> = { ok: true } & T;
type Refused = { ok: false; error: string };
type Context = { ip?: string | null; userAgent?: string | null };

/** The newest value of each fact on a file, with who recorded it and when. Null on a failed read. */
export async function recordedFactsFor(
  fileId: string,
): Promise<Partial<Record<LetterFact, { value: string; recordedAt: string; recordedBy: string }>> | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("eng_letter_facts")
    .select("fact, value, created_at, recorded_by")
    .eq("file_id", fileId)
    .order("created_at", { ascending: false });
  if (error) return null;
  const out: Partial<Record<LetterFact, { value: string; recordedAt: string; recordedBy: string }>> = {};
  for (const r of data ?? []) {
    const f = r.fact as LetterFact;
    if (!out[f]) out[f] = { value: r.value as string, recordedAt: r.created_at as string, recordedBy: r.recorded_by as string };
  }
  return out;
}

/** The engineer of record's own licence, current on the register, or a refusal. The test decideTraining applies. */
async function engineerOnRegister(actor: Actor & { email: string }): Promise<Ok<{ licence: string }> | Refused> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const { data: me } = await db.from("eng_profiles").select("license_number").eq("id", actor.id).maybeSingle();
  const licence = ((me?.license_number as string | null) ?? "").trim();
  const onRegister = licence ? verifiedEngineers.find((e) => e.licenseNumber === licence) ?? null : null;
  if (!onRegister) return { ok: false, error: "Only the engineer of record records this, and your license is not the one the register holds." };
  if (!licenceIsCurrentToday(onRegister.expires)) return { ok: false, error: `The register has no current expiry for license ${licence}.` };
  return { ok: true, licence };
}

async function fileExists(fileId: string): Promise<Refused | null> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const { data, error } = await db.from("eng_files").select("id").eq("id", fileId).maybeSingle();
  if (error) return { ok: false, error: `The file could not be read: ${error.message}` };
  if (!data) return { ok: false, error: "That file does not exist." };
  return null;
}

/** PL-2: the office records the authority's address or salutation, before review. */
export async function recordOfficeFact(
  actor: (Actor & { email: string }) | null,
  fileId: string,
  fact: OfficeFact,
  value: string,
  context: Context = {},
): Promise<Ok<Record<never, never>> | Refused> {
  if (!actor || !can(actor, "files.update_details")) return { ok: false, error: "Your role cannot record the authority's details on a file." };
  if (fact !== "authority_address" && fact !== "authority_salutation") return { ok: false, error: "That is not a fact the office records." };
  const written = value.trim();
  if (!written) return { ok: false, error: "Write it as it should print on the letter." };
  const missing = await fileExists(fileId);
  if (missing) return missing;
  const db = supabaseAdmin()!;
  const { error } = await db.from("eng_letter_facts").insert({ file_id: fileId, fact, value: written, recorded_by: actor.id, capacity: "office" });
  if (error) return { ok: false, error: `It was not recorded: ${error.message}` };
  await writeAudit({
    actor, action: "letter.fact_recorded", entityType: "file", entityId: fileId,
    summary: `Recorded the ${fact === "authority_address" ? "authority's address" : "authority's salutation"} for the letter.`,
    diff: { fact, value: written, capacity: "office" }, ip: context.ip, userAgent: context.userAgent,
  });
  return { ok: true };
}

/** FC-3 and PL-3: the engineer confirms or corrects a fact at review. */
export async function recordEngineerFact(
  actor: (Actor & { email: string }) | null,
  fileId: string,
  fact: EngineerFact,
  value: string,
  context: Context = {},
): Promise<Ok<Record<never, never>> | Refused> {
  if (!actor || !holdsLicence(actor, "review.decide")) return { ok: false, error: licenceRefusal("Confirming a fact on a letter") };
  if (fact !== "foundation_type" && fact !== "element_described") return { ok: false, error: "That is not a fact the engineer records." };
  const written = value.trim();
  if (fact === "foundation_type" && !(FOUNDATION_TYPES as readonly string[]).includes(written)) {
    return { ok: false, error: "The foundation type is slab-on-grade, pier-and-beam or crawlspace." };
  }
  if (fact === "element_described" && written.length < 3) return { ok: false, error: "Describe the element as the letter should name it." };
  const reg = await engineerOnRegister(actor);
  if (!reg.ok) return reg;
  const missing = await fileExists(fileId);
  if (missing) return missing;
  const db = supabaseAdmin()!;
  const { error } = await db.from("eng_letter_facts").insert({ file_id: fileId, fact, value: written, recorded_by: actor.id, capacity: "engineer" });
  if (error) return { ok: false, error: `It was not recorded: ${error.message}` };
  await writeAudit({
    actor, action: "letter.fact_confirmed", entityType: "file", entityId: fileId,
    summary: fact === "foundation_type" ? `Confirmed the foundation type: ${written}.` : "Reviewed the element the letter names.",
    diff: { fact, value: written, capacity: "engineer" }, ip: context.ip, userAgent: context.userAgent,
  });
  return { ok: true };
}

/** PL-4: the newest triage on a file, or null when none is recorded (and null on a failed read is reported as such). */
export async function triageFor(fileId: string): Promise<{ ok: true; basis: "site" | "desk" | null; at: string | null } | Refused> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const { data, error } = await db
    .from("eng_job_triage")
    .select("basis, created_at")
    .eq("file_id", fileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: `The triage could not be read: ${error.message}` };
  return { ok: true, basis: (data?.basis as "site" | "desk" | undefined) ?? null, at: (data?.created_at as string | undefined) ?? null };
}

/**
 * PL-4: the permit letter files with no triage yet, open and not cancelled,
 * oldest first, for his queue. His answer is due within one business day of
 * the order, so this list is where he finds the work.
 *
 * Audit 2026-10-24, F13 and the triage starvation claim: this read the oldest
 * 200 open files and dropped the triaged ones afterwards, so once 200 open
 * permit files were triaged a new one never reached the list; and the screen
 * passed every file an empty capture list, so an item he added read back as
 * "None added". It reads every open file, and each file carries its own items.
 */
export async function filesAwaitingTriage(): Promise<
  | { ok: true; files: { id: string; fileNumber: string; address: string; createdAt: string; additions: { id: string; label: string }[] }[] }
  | Refused
> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  // readEvery: the list is his queue, so a file past any bound is a job he never sees.
  const files = await readEvery<{ id: string; file_number: string; property_address: string; created_at: string }>((from, to) =>
    db
      .from("eng_files")
      .select("id, file_number, property_address, created_at")
      .eq("service_slug", "structural-letters")
      .not("status", "in", "(closed,cancelled,delivered,sealed)")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (!files.ok) return { ok: false, error: `The permit letter files could not be read: ${files.error}` };
  const ids = files.rows.map((f) => f.id);
  if (ids.length === 0) return { ok: true, files: [] };
  // readEveryIn: a triage missed by a capped read would list a decided job as waiting.
  const triaged = await readEveryIn<{ file_id: string }>(ids, (chunk, from, to) =>
    db.from("eng_job_triage").select("file_id").in("file_id", [...chunk]).order("file_id").range(from, to),
  );
  if (!triaged.ok) return { ok: false, error: `The triage could not be read: ${triaged.error}` };
  const done = new Set(triaged.rows.map((t) => t.file_id));
  const waiting = files.rows.filter((f) => !done.has(f.id));
  // readEveryIn: an item missed here reads as "None added" beside a list he wrote.
  const added = await readEveryIn<{ id: string; file_id: string; label: string }>(waiting.map((f) => f.id), (chunk, from, to) =>
    db
      .from("eng_job_capture_additions")
      .select("id, file_id, label")
      .in("file_id", [...chunk])
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (!added.ok) return { ok: false, error: `The capture items could not be read: ${added.error}` };
  const itemsOf = new Map<string, { id: string; label: string }[]>();
  for (const a of added.rows) itemsOf.set(a.file_id, [...(itemsOf.get(a.file_id) ?? []), { id: a.id, label: a.label }]);
  return {
    ok: true,
    files: waiting.map((f) => ({
      id: f.id,
      fileNumber: f.file_number,
      address: f.property_address,
      createdAt: f.created_at,
      additions: itemsOf.get(f.id) ?? [],
    })),
  };
}

/** PL-4: the engineer records site job or desk job for a file. */
export async function recordTriage(
  actor: (Actor & { email: string }) | null,
  fileId: string,
  basis: "site" | "desk",
  context: Context = {},
): Promise<Ok<Record<never, never>> | Refused> {
  if (!actor || !holdsLicence(actor, "review.decide")) return { ok: false, error: licenceRefusal("Triaging a job") };
  if (basis !== "site" && basis !== "desk") return { ok: false, error: "A job is a site job or a desk job." };
  const reg = await engineerOnRegister(actor);
  if (!reg.ok) return reg;
  const missing = await fileExists(fileId);
  if (missing) return missing;
  const db = supabaseAdmin()!;
  const { error } = await db.from("eng_job_triage").insert({ file_id: fileId, basis, decided_by: actor.id, decided_by_license: reg.licence });
  if (error) return { ok: false, error: `The triage was not recorded: ${error.message}` };
  await writeAudit({
    actor, action: "job.triaged", entityType: "file", entityId: fileId,
    summary: `Triaged as a ${basis} job.`, diff: { basis }, ip: context.ip, userAgent: context.userAgent,
  });
  return { ok: true };
}

/** PL-5: the engineer's own capture items for a file, oldest first. */
export async function captureAdditionsFor(fileId: string): Promise<{ ok: true; items: { id: string; label: string; addedAt: string }[] } | Refused> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const { data, error } = await db
    .from("eng_job_capture_additions")
    .select("id, label, created_at")
    .eq("file_id", fileId)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: `The capture items could not be read: ${error.message}` };
  return { ok: true, items: (data ?? []).map((r) => ({ id: r.id as string, label: r.label as string, addedAt: r.created_at as string })) };
}

/** PL-5: he adds a capture item in his own words. */
export async function addCaptureItem(
  actor: (Actor & { email: string }) | null,
  fileId: string,
  label: string,
  context: Context = {},
): Promise<Ok<Record<never, never>> | Refused> {
  if (!actor || !holdsLicence(actor, "review.decide")) return { ok: false, error: licenceRefusal("Adding to a job's capture list") };
  const written = label.trim();
  if (written.length < 3) return { ok: false, error: "Write the item as the technician should read it." };
  const reg = await engineerOnRegister(actor);
  if (!reg.ok) return reg;
  const missing = await fileExists(fileId);
  if (missing) return missing;
  const db = supabaseAdmin()!;
  const { error } = await db.from("eng_job_capture_additions").insert({ file_id: fileId, label: written, added_by: actor.id });
  if (error) return { ok: false, error: `The item was not added: ${error.message}` };
  await writeAudit({
    actor, action: "job.capture_item_added", entityType: "file", entityId: fileId,
    summary: "Added an item to the job's capture list.", diff: { label: written }, ip: context.ip, userAgent: context.userAgent,
  });
  return { ok: true };
}
