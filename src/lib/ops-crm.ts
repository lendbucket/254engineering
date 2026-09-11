import "server-only";
import { DB_NOW } from "./db-now";
import { supabaseAdmin } from "./supabase";
import { writeAudit, diffOf, safeDiff } from "./ops-audit";
import { canSeeFile, redactFile, visibleFiles, type Actor, actionsFor } from "./ops-authz";
import {
  canTransition,
  formatFileNumber,
  formatDemoFileNumber,
  DEMO_FILE_SEGMENT,
  STATUS_TIMESTAMP,
  type FileStatus,
} from "./ops-files";
import { accrueForDelivery, accrueForQualifiedLead } from "./ops-partner-comp";
import { resolveCounty, twiaStatus, regionForCounty } from "./ops-counties";

/**
 * Reads and writes for clients, contacts, and files.
 *
 * THE SCOPE IS APPLIED IN SQL, NOT AFTER LOADING
 * ----------------------------------------------
 * visibleFiles() returns a filter rather than a predicate, and this module turns
 * that filter into query constraints. Rows a person may not see are never
 * selected, never serialized, and never sit in a response waiting for a
 * rendering bug to reveal them.
 *
 * Filtering after the fact would be easier to write and would mean the server
 * had already loaded, and briefly held, every file in the firm in order to show
 * a technician the two that are his.
 *
 * REDACTION IS ON THE WAY OUT OF HERE
 * -----------------------------------
 * A technician must never receive pricing. That is enforced here rather than in
 * a component, because a component that forgets to render a field has still sent
 * it in the HTML. Every function that returns a file passes it through
 * redactFile first.
 *
 * EVERY WRITE WRITES TWO RECORDS
 * ------------------------------
 * eng_audit_events is the regulatory memory: everything, immutable. eng_file_events
 * is the human timeline shown on the file. They are different artifacts for
 * different readers and both are written, which is why these functions are here
 * and not inline in a route handler where one of them would eventually be
 * forgotten.
 */

export type ClientRow = {
  id: string;
  kind: "organization" | "individual";
  name: string;
  client_type: string | null;
  status: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  county: string | null;
  source_site: string | null;
  utm_source: string | null;
  converted_from_lead_id: string | null;
  created_at: string;
  notes: string | null;
};

export type FileRow = {
  id: string;
  file_number: string;
  client_id: string;
  service_slug: string;
  /** The catalog tier. Null on every file opened before Phase 10 Section 1. */
  deliverable: string | null;
  property_address: string;
  city: string | null;
  county: string;
  twia_county: boolean;
  /*
   * Carried on the row because dispatch ranks by distance and needs a point.
   * Nothing geocodes them, so they are usually null and planDispatch degrades to
   * ranking by workload, which it says on screen rather than implying a
   * proximity nobody measured.
   */
  latitude: number | string | null;
  longitude: number | string | null;
  urgency: string;
  status: FileStatus;
  due_at: string | null;
  assigned_tech_id: string | null;
  assigned_engineer_id: string | null;
  client_price_cents?: number | null;
  tech_cost_cents?: number | null;
  engineer_cost_cents?: number | null;
  /* Only filesByIds fills this. A screen does not need it and an export does. */
  is_demo?: boolean;
  /**
   * The partner attributed to this file, or null.
   *
   * Selected because the margin needs it. It is not a cost itself: the fourth
   * cost lives in eng_partner_entries and is read through partnerCostByFile,
   * for the reason ops-docs.ts states at length. What this column answers is
   * whether there IS a commission to look for, which is the difference between
   * a knowable zero and an unknown figure.
   */
  partner_id?: string | null;
  created_at: string;
  notes: string | null;
};

const FILE_COLUMNS =
  /*
   * deliverable is read as well as written from Phase 10 Section 1. It existed
   * unwritten from Phase 6, so nothing selected it, and the screens that now
   * ask what a file is missing need to know which deliverable to ask about.
   */
  "id, file_number, client_id, service_slug, deliverable, property_address, city, county, twia_county, latitude, longitude, urgency, status, due_at, assigned_tech_id, assigned_engineer_id, client_price_cents, tech_cost_cents, engineer_cost_cents, partner_id, created_at, notes";

// ------------------------------------------------------------------ clients

export async function listClients(actor: Actor | null): Promise<ClientRow[]> {
  const db = supabaseAdmin();
  if (!db || !actor) return [];
  const { data } = await db
    .from("eng_clients")
    .select(
      "id, kind, name, client_type, status, email, phone, city, county, source_site, utm_source, converted_from_lead_id, created_at, notes",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []) as ClientRow[];
}

export async function getClient(actor: Actor | null, id: string): Promise<ClientRow | null> {
  const db = supabaseAdmin();
  if (!db || !actor) return null;
  const { data } = await db
    .from("eng_clients")
    .select(
      "id, kind, name, client_type, status, email, phone, city, county, source_site, utm_source, converted_from_lead_id, created_at, notes",
    )
    .eq("id", id)
    .maybeSingle();
  return (data as ClientRow) ?? null;
}

export type CreateClientInput = {
  kind: "organization" | "individual";
  name: string;
  clientType?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  county?: string | null;
  notes?: string | null;
  attribution?: Record<string, unknown>;
};

/**
 * Who opened this record.
 *
 * A person, or the order engine. SYSTEM_AUTHOR carries no profile id, so
 * created_by is null and the audit row says the order engine did it rather than
 * attributing a machine's work to whichever administrator happened to be handy.
 */
export type Author = (Actor & { email: string }) | typeof SYSTEM_AUTHOR;

export const SYSTEM_AUTHOR = {
  id: null,
  role: "admin",
  status: "active",
  email: "order-engine@254engineering.com",
  /*
   * The administrator's DEFAULT grants, not whatever the owner has edited that
   * role to today.
   *
   * The order engine is the platform acting on its own, and what it may do
   * should not change because somebody adjusted a role for the people who hold
   * it. If the owner narrows the administrator role, the order engine keeps
   * releasing paid work; if they widen it, the order engine does not quietly
   * gain the new capability.
   *
   * It still cannot seal, because the licensed five are not grants at all.
   */
  grants: new Set(actionsFor("admin")),
} as const;

export async function createClient(
  actor: Author,
  input: CreateClientInput,
  context: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!input.name?.trim()) return { ok: false, error: "A client needs a name." };

  const { data, error } = await db
    .from("eng_clients")
    .insert({
      kind: input.kind,
      name: input.name.trim(),
      client_type: input.clientType || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      city: input.city?.trim() || null,
      county: input.county?.trim() || null,
      notes: input.notes?.trim() || null,
      created_by: actor.id,
      ...(input.attribution ?? {}),
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actor,
    action: "client.create",
    entityType: "client",
    entityId: data.id,
    summary: `Created client ${input.name.trim()}`,
    ...context,
  });
  return { ok: true, id: data.id };
}

// -------------------------------------------------------------------- files

/**
 * Turn the authorization scope into query constraints.
 *
 * WHY IT RETURNS THE BUILDER WRAPPED IN AN OBJECT
 * -----------------------------------------------
 * A PostgREST query builder is a thenable. Returning it from an async function
 * means the caller's await RUNS the query and hands back a response, so the
 * caller then tries to add .eq() to a result set. Wrapping it in a plain object
 * keeps the builder a builder across the await.
 *
 * A technician sees files assigned to him or offered to him. The offered case
 * needs the assignments table, so the ids are gathered first and passed as an
 * `in` filter rather than joined, because PostgREST cannot express "or across a
 * join" and a wrong guess there fails open.
 */
async function scopedFileQuery(actor: Actor) {
  const wrap = <T>(query: T) => ({ query });
  const db = supabaseAdmin();
  if (!db) return null;
  const scope = visibleFiles(actor);

  if (scope.kind === "none") return null;
  if (scope.kind === "all") return wrap(db.from("eng_files").select(FILE_COLUMNS));

  if (scope.kind === "engineer") {
    return wrap(db
      .from("eng_files")
      .select(FILE_COLUMNS)
      .or(
        `assigned_engineer_id.eq.${scope.engineerId},status.in.(${scope.queueStatuses.join(",")})`,
      ));
  }

  const { data: offers } = await db
    .from("eng_assignments")
    .select("file_id")
    .eq("tech_id", scope.techId);
  const offered = (offers ?? []).map((o) => o.file_id as string);

  const clauses = [`assigned_tech_id.eq.${scope.techId}`];
  if (offered.length) clauses.push(`id.in.(${offered.join(",")})`);
  return wrap(db.from("eng_files").select(FILE_COLUMNS).or(clauses.join(",")));
}

export async function listFiles(
  actor: Actor | null,
  filters: { status?: string; county?: string; search?: string } = {},
): Promise<FileRow[]> {
  if (!actor) return [];
  const scoped = await scopedFileQuery(actor);
  if (!scoped) return [];
  let query = scoped.query;

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.county) query = query.eq("county", filters.county);
  if (filters.search) {
    const term = filters.search.replace(/[%,()]/g, "");
    query = query.or(`file_number.ilike.%${term}%,property_address.ilike.%${term}%`);
  }

  const { data } = await query.order("created_at", { ascending: false }).limit(300);
  return ((data ?? []) as FileRow[]).map((f) => redactFile(actor, f));
}

/**
 * The files behind a set of ids, through the SAME scope the list uses.
 *
 * Phase 12 Section 4, Section 1. A bulk export is handed ids by a browser, and
 * a browser is not allowed to decide which files somebody may read. This exists
 * so the export cannot reimplement the scoping rule: it is the one in
 * scopedFileQuery, and there is one of it.
 *
 * WHY IT CARRIES is_demo AND listFiles DOES NOT
 * ----------------------------------------------
 * A screen does not need it; an export does, because a demonstration row that
 * reaches a spreadsheet unnamed is one of the four defects Phase 12 Section 2
 * found by reading a CSV. Added here rather than to FILE_COLUMNS so no existing
 * caller's shape changes for a column only this path reads.
 */
export async function filesByIds(actor: Actor | null, ids: string[]): Promise<FileRow[]> {
  if (!actor || ids.length === 0) return [];
  const db = supabaseAdmin();
  if (!db) return [];

  const scoped = await scopedFileQuery(actor);
  if (!scoped) return [];

  const { data } = await scoped.query.in("id", ids);
  const rows = ((data ?? []) as FileRow[]).map((f) => redactFile(actor, f));

  /* is_demo, for the rows the scope actually allowed. A second read rather than
   * a widened select, and scoped by the ids that survived the first. */
  const allowed = rows.map((r) => r.id);
  if (allowed.length === 0) return rows;
  const { data: flags } = await db.from("eng_files").select("id, is_demo").in("id", allowed);
  const demo = new Map((flags ?? []).map((f) => [f.id as string, f.is_demo === true]));
  return rows.map((r) => ({ ...r, is_demo: demo.get(r.id) ?? false }));
}
export async function getFile(actor: Actor | null, id: string): Promise<FileRow | null> {
  const db = supabaseAdmin();
  if (!db || !actor) return null;

  const { data } = await db.from("eng_files").select(FILE_COLUMNS).eq("id", id).maybeSingle();
  if (!data) return null;

  const file = data as FileRow;

  /*
   * The list filter and this check must agree. A record visible by direct URL
   * but hidden from the list is the classic authorization hole, so the same
   * canSeeFile the audit tests is used here rather than a second rule.
   */
  const { data: offers } = await db.from("eng_assignments").select("tech_id").eq("file_id", id);
  const offeredTechIds = (offers ?? []).map((o) => o.tech_id as string);

  if (!canSeeFile(actor, { ...file, offered_tech_ids: offeredTechIds })) return null;
  return redactFile(actor, file);
}

export type CreateFileInput = {
  clientId: string;
  serviceSlug: string;
  propertyAddress: string;
  city?: string | null;
  county?: string | null;
  postalCode?: string | null;
  urgency?: "standard" | "expedited" | "emergency";
  dueAt?: string | null;
  notes?: string | null;
  twiaOverride?: boolean;
  fromLeadId?: string | null;
  clientPriceCents?: number | null;

  /*
   * Phase 10 Section 1. Everything below was addable only because 0015 added
   * the columns, EXCEPT deliverable, which has existed since Phase 6 and which
   * nothing has ever written. A file could not say which of its service line's
   * deliverables it was for, on either the operator path or the customer path.
   */

  /** The catalog tier. Optional because seven of nine lines sell exactly one. */
  deliverable?: string | null;

  intakeChannel?: import("./job-intake-rules").IntakeChannel;
  /** When the call happened, which is not when the file was opened. */
  intakeTakenAt?: string | null;

  /** What the catalog said, kept beside the price that applies. */
  catalogPriceCents?: number | null;
  coastalSurchargeCents?: number | null;
  priceOverrideReason?: string | null;

  paymentIntent?: import("./job-intake-rules").PaymentIntent;
  paymentNote?: string | null;
};

/**
 * Open a file.
 *
 * The county is resolved rather than trusted, and an unresolvable one is a
 * refusal rather than a null column: dispatch matches on county, so a file
 * without one is invisible to every technician and would sit unassigned looking
 * like nobody wanted it.
 */
export async function createFile(
  actor: Author,
  input: CreateFileInput,
  context: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ ok: true; id: string; fileNumber: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!input.propertyAddress?.trim()) return { ok: false, error: "A file needs a property address." };
  if (!input.serviceSlug) return { ok: false, error: "Choose a service line." };

  const resolved = resolveCounty({ city: input.city, county: input.county });
  if (!resolved.valid || !resolved.county) {
    return {
      ok: false,
      error:
        "That county could not be determined from the address. Choose one of the 254 so the file can be dispatched.",
    };
  }

  const twia = twiaStatus(resolved.county);
  const twiaFlag = twia === "designated" ? true : twia === "check" ? Boolean(input.twiaOverride) : false;

  const year = new Date().getFullYear();
  /*
   * THE NEXT NUMBER COMES FROM THE HIGHEST ONE, NOT FROM A COUNT.
   *
   * It counted before, and a count is only the right answer while the numbers
   * are a gapless run starting at one. Anything that breaks that assumption
   * breaks file creation ENTIRELY rather than degrading: delete one file and
   * the count points at a number already taken, the three retries hit the same
   * wall, and every subsequent intake fails with "could not allocate a file
   * number".
   *
   * Found on 2026-09-04 building the telephone intake. Development held files
   * numbered 0007 to 0009 and a seeded block at 9001 to 9003, so the count was
   * six, and NO FILE COULD BE CREATED AT ALL: not by this path, and not by the
   * "Open a file" button that had been there since Phase 6. The failure was
   * invisible until somebody tried, because nothing had created a file on
   * development since the seed ran.
   *
   * Ordering by file_number as text is correct while the sequence is zero
   * padded to a fixed width, which formatFileNumber does. If a year ever
   * exceeds that width the padding changes and this ordering stops being right,
   * which is worth knowing about rather than discovering.
   *
   * AND THE DEMONSTRATION FILES ARE EXCLUDED BY THEIR SHAPE.
   *
   * They were numbered 9001 upward, which is higher than any real file and
   * therefore became the sequence: on development the next real file would have
   * been 254-2026-9004. They carry DEMO where the year goes now, so the filter
   * below cannot see them at all and a reset cannot advance anything. The
   * exclusion is structural rather than a rule somebody has to remember, which
   * is the only kind that survives.
   */
  /*
   * ============================================================================
   * A DEMONSTRATION ACTOR PRODUCES A DEMONSTRATION FILE.
   * Operator ruling, 2026-09-10. The seeder should not be the only thing that
   * can mark one.
   * ============================================================================
   *
   * Found by opening a file through this function during an overnight path
   * walk. The client was "Demo Split Client 418364" with is_demo true, and the
   * file came out as 254-2026-0001 with is_demo FALSE: a demonstration record
   * that every report counts as real work. It could not even be corrected
   * afterwards without renumbering, because eng_files_demo_number_agrees
   * requires (file_number like '%-DEMO-%') = is_demo, and that constraint is
   * right: the flag and the number must not be able to disagree.
   *
   * It is decided by the ACTOR rather than by the client, which is the same
   * shape as the suppression rule: effect_mode is decided at enqueue from the
   * identity the work is about, and a bulk action cannot become a bulk send by
   * being pointed at the wrong rows. Here, a seeded actor cannot mint a real
   * file by being pointed at a real client.
   *
   * SYSTEM_AUTHOR is not a demonstration. The order engine takes real money and
   * has no is_demo, so it falls through to false, which is what it should be.
   *
   * This cannot bite production, where no demonstration profile exists. It bites
   * development, where every path walk and audit that opened a file was
   * inflating the real figures, which is the class Phase 12 Section 2 already
   * found once as a sales tile counting a seeded client.
   */
  const isDemo = "is_demo" in actor && actor.is_demo === true;

  /*
   * The two blocks are numbered separately and must be, because DEMO is a word
   * where the year goes. A demonstration file's sequence comes from the DEMO
   * block; a real one's comes from the year. Reading the year's highest number
   * to mint a demonstration file would give it a real sequence, and reading the
   * demonstration block to mint a real one would be worse.
   */
  /*
   * THE HIGHEST NUMERIC SEQUENCE, NOT THE HIGHEST STRING.
   *
   * This read one row, ordered by file_number descending as text, and took the
   * part after the last dash as a number. That is correct while every number in
   * the block ends in four digits, and the DEMO block does not:
   *
   *   254-DEMO-STANDING      the standing fixture
   *   254-DEMO-SPL418364     a split client fixture
   *   254-DEMO-WALK0910      renamed by hand after a path walk
   *
   * Text descending puts every one of those ABOVE 254-DEMO-0003, so the read
   * returned a name, Number("WALK0910") was NaN, the guard below turned NaN
   * into 0, and the five retries tried 0001 to 0005. Three were taken by the
   * seeder, so opening a third demonstration file failed with "Could not
   * allocate a file number. Try again." every time.
   *
   * Found immediately after this function learned to mint demonstration
   * numbers, by building three files for the dispatch comparison and watching
   * the third refuse. Nothing could have found it before, because nothing but
   * the seeder had ever written a DEMO number, and the seeder writes them as
   * literals.
   *
   * So the sequence is the MAXIMUM of the numeric tails rather than the tail of
   * the maximum name. A bounded page rather than every row: real numbers are
   * zero padded to a fixed width, so text order and numeric order agree there
   * and the first row is already the answer; the page exists for the DEMO block,
   * where a handful of named fixtures sit on top.
   */
  const { data: numbered } = await db
    .from("eng_files")
    .select("file_number")
    .like("file_number", isDemo ? `%-${DEMO_FILE_SEGMENT}-%` : `%-${year}-%`)
    .order("file_number", { ascending: false })
    .limit(200);

  const sequences = (numbered ?? [])
    .map((r) => Number(String(r.file_number).split("-").pop()))
    .filter((n) => Number.isFinite(n));
  const nextSequence = sequences.length ? Math.max(...sequences) : 0;

  /*
   * Retries are for the collision two simultaneous intakes cause, which is a
   * real race this does not remove: both read the same highest number. Five
   * rather than three, because the seeded blocks that exposed the count bug
   * also make a short run of taken numbers plausible.
   */
  for (let attempt = 0; attempt < 5; attempt++) {
    const fileNumber = isDemo
      ? formatDemoFileNumber(nextSequence + 1 + attempt)
      : formatFileNumber(year, nextSequence + 1 + attempt);
    const { data, error } = await db
      .from("eng_files")
      .insert({
        file_number: fileNumber,
        /* Set together with the number, because the check constraint requires
         * them to agree and a row that fails it is a row nobody can save. */
        is_demo: isDemo,
        client_id: input.clientId,
        service_slug: input.serviceSlug,
        property_address: input.propertyAddress.trim(),
        city: input.city?.trim() || null,
        county: resolved.county,
        postal_code: input.postalCode?.trim() || null,
        twia_county: twiaFlag,
        urgency: input.urgency ?? "standard",
        due_at: input.dueAt || null,
        notes: input.notes?.trim() || null,
        client_price_cents: input.clientPriceCents ?? null,
        deliverable: input.deliverable || null,
        intake_channel: input.intakeChannel ?? "web",
        intake_taken_at: input.intakeTakenAt || null,
        catalog_price_cents: input.catalogPriceCents ?? null,
        coastal_surcharge_cents: input.coastalSurchargeCents ?? null,
        price_override_reason: input.priceOverrideReason || null,
        /*
         * Stamped only when there IS an override, so an ordinary job carries no
         * overridden_by and a screen can tell "nobody changed this" from
         * "somebody changed it and we lost who".
         */
        price_overridden_by: input.priceOverrideReason ? actor.id : null,
        /* DB_NOW. When a price was overridden is a money fact, and the
         * ternary is why the src sweep could not see this one. */
        price_overridden_at: input.priceOverrideReason ? DB_NOW : null,
        payment_intent: input.paymentIntent ?? "unset",
        payment_note: input.paymentNote || null,
        converted_from_lead_id: input.fromLeadId || null,
        created_by: actor.id,
        status: "intake",
      })
      .select("id, file_number")
      .single();

    if (!error && data) {
      await db.from("eng_file_events").insert({
        file_id: data.id,
        actor_id: actor.id,
        kind: "created",
        to_status: "intake",
        body: `File opened for ${input.propertyAddress.trim()} in ${resolved.county} County.`,
        meta: { county_source: resolved.source, twia: twia },
      });
      await writeAudit({
        actor,
        action: "file.create",
        entityType: "file",
        entityId: data.id,
        summary: `Opened ${data.file_number} at ${input.propertyAddress.trim()}`,
        diff: { county: { from: null, to: resolved.county }, twia_county: { from: null, to: twiaFlag } },
        ...context,
      });
      return { ok: true, id: data.id, fileNumber: data.file_number as string };
    }
    if (error && !/duplicate key/i.test(error.message)) return { ok: false, error: error.message };
  }
  return { ok: false, error: "Could not allocate a file number. Try again." };
}

/**
 * Move a file, or explain why not.
 *
 * The machine decides. This function's job is to persist the decision, stamp the
 * right timestamp, and write both records. It never contains a rule of its own,
 * because a rule here would be a rule the test suite does not see.
 */
/**
 * The file as the PLATFORM sees it, with no visibility scoping.
 *
 * Used only by transitionFile, and only when the actor is the platform itself
 * rather than a person. It is not exported: an unscoped read is exactly the
 * hole canSeeFile exists to close, and the way it stays closed is that nothing
 * else can reach this.
 *
 * There is no redaction either, deliberately. Redaction hides a client price
 * from a technician; the order engine releasing paid work needs the file's real
 * status and assignment to decide anything at all.
 */
async function fileForSystem(id: string): Promise<FileRow | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db.from("eng_files").select(FILE_COLUMNS).eq("id", id).maybeSingle();
  return (data as FileRow) ?? null;
}

export async function transitionFile(
  /*
   * Author rather than Actor, so the order engine can move a file it just took
   * payment for. Before Phase 10 Section 1 ops-payments did that with a raw
   * status update that never called canTransition, because this signature would
   * not accept the only actor it had.
   *
   * A rule a caller cannot satisfy is a rule that caller routes around, and the
   * grammar was silently not applying to the one path that mattered most.
   */
  actor: Author,
  id: string,
  to: FileStatus,
  note: string | null,
  context: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  /*
   * A person's read is scoped to what they may see; the platform's is not.
   * Both then face the same canTransition below, which is the point: the
   * system gets a wider VIEW and not a wider set of MOVES.
   */
  const current = actor.id === null ? await fileForSystem(id) : await getFile(actor, id);
  if (!current) return { ok: false, error: "That file does not exist, or is not yours to move." };

  const verdict = canTransition(actor, current.status, to, {
    assignedTech: Boolean(current.assigned_tech_id),
  });
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const patch: Record<string, unknown> = { status: to };
  /*
   * DB_NOW, AND THIS IS THE ONE THE RULING NAMED.
   *
   * STATUS_TIMESTAMP maps a status to its column, and one of them is
   * sealed_at: when a named Professional Engineer put their seal on the firm's
   * regulatory output. The others are dispatched_at, refused_at,
   * evidence_submitted_at, delivered_at and closed_at.
   *
   * All six were written from this process's clock, which was measured 85
   * seconds ahead of the database on 2026-09-10, against three independent time
   * sources. db-guard-audit's sweep could not see it because the column name is
   * a COMPUTED KEY: its pattern matches a literal name followed by the machine
   * clock, and there is no literal name on this line to match.
   */
  const stamp = STATUS_TIMESTAMP[to];
  if (stamp) patch[stamp] = DB_NOW;

  const { error } = await db.from("eng_files").update(patch).eq("id", id).eq("status", current.status);
  if (error) return { ok: false, error: error.message };

  await db.from("eng_file_events").insert({
    file_id: id,
    actor_id: actor.id,
    kind: "status",
    from_status: current.status,
    to_status: to,
    body: note?.trim() || null,
  });

  await writeAudit({
    actor,
    action: "file.transition",
    entityType: "file",
    entityId: id,
    summary: `${current.file_number}: ${current.status} to ${to}`,
    diff: safeDiff(diffOf({ status: current.status }, { status: to })),
    ...context,
  });

  /*
   * DELIVERY IS WHERE A PARTNER EARNS, AND THIS IS THE ONLY DOOR TO IT.
   *
   * Operator ruling, Phase 9: accrue on delivery rather than on payment,
   * because an order refunded after a declined seal would otherwise leave the
   * firm having paid commission on money it gave back.
   *
   * It sits here rather than in a sweep for delivered files because this is the
   * one function that can move a file to delivered. A sweep would have meant
   * the ledger lagged the record by however long the sweep took, and a file
   * with no entry is exactly the state that makes a margin read too high.
   *
   * A failure does not undo the delivery. The file IS delivered; that is a fact
   * about the firm and the customer and it is not conditional on a commission
   * being computable. So the problem is written to the file's own timeline
   * where somebody will meet it, and the transition still returns ok.
   */
  if (to === "delivered") {
    const accrued = await accrueForDelivery(id);
    if (!accrued.ok) {
      await db.from("eng_file_events").insert({
        file_id: id,
        actor_id: null,
        kind: "note",
        body: `The partner commission on this delivery could not be recorded: ${accrued.error}. The file is delivered; the commission is not written down yet.`,
      });
    }
  }

  return { ok: true };
}

export async function fileTimeline(id: string) {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from("eng_file_events")
    .select("id, created_at, kind, from_status, to_status, body, actor_id")
    .eq("file_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

// --------------------------------------------------------------- conversion

/**
 * Turn a lead into a client and a file in one action.
 *
 * The lead row is never deleted and never edited beyond its status. It is the
 * origin record, it carries the attribution the three public sites captured, and
 * a converted lead that vanished would take that attribution with it.
 */
export async function convertLead(
  actor: Actor & { email: string },
  leadId: string,
  overrides: { serviceSlug?: string; propertyAddress?: string; county?: string } = {},
  context: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ ok: true; clientId: string; fileId: string; fileNumber: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const { data: lead } = await db.from("eng_leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return { ok: false, error: "That lead no longer exists." };
  if (lead.status === "converted") return { ok: false, error: "That lead has already been converted." };

  const name = (lead.company as string) || (lead.name as string) || "Unnamed enquirer";

  const client = await createClient(
    actor,
    {
      kind: lead.company ? "organization" : "individual",
      name,
      email: lead.email as string | null,
      phone: lead.phone as string | null,
      city: lead.city as string | null,
      notes: lead.message as string | null,
      attribution: {
        source_site: lead.site,
        source_form: lead.form,
        utm_source: lead.utm_source,
        utm_medium: lead.utm_medium,
        utm_campaign: lead.utm_campaign,
        utm_content: lead.utm_content,
        utm_term: lead.utm_term,
        landing_path: lead.landing_path,
        referrer: lead.referrer,
        converted_from_lead_id: leadId,
      },
    },
    context,
  );
  if (!client.ok) return { ok: false, error: client.error };

  const file = await createFile(
    actor,
    {
      clientId: client.id,
      serviceSlug: overrides.serviceSlug || (lead.service as string) || "roof-inspections",
      propertyAddress: overrides.propertyAddress || (lead.city as string) || "Address to confirm",
      city: lead.city as string | null,
      county: overrides.county,
      notes: lead.message as string | null,
      fromLeadId: leadId,
    },
    context,
  );
  if (!file.ok) return { ok: false, error: file.error };

  await db.from("eng_leads").update({ status: "converted" }).eq("id", leadId);

  /*
   * A QUALIFIED LEAD IS A LEAD SOMEBODY AT THE FIRM CONVERTED.
   *
   * That is the definition the compensation rule uses, and this is the act it
   * names: a person looked at the lead and decided it was real work. Any
   * definition that the partner controls, "they said it was qualified", is a
   * definition that pays for volume rather than for business.
   *
   * Silent for every model except flat_per_qualified_lead, and idempotent by a
   * unique index on the lead, so converting twice cannot pay twice.
   */
  await accrueForQualifiedLead(leadId);

  await writeAudit({
    actor,
    action: "lead.convert",
    entityType: "lead",
    entityId: leadId,
    summary: `Converted lead to client ${name} and file ${file.fileNumber}`,
    ...context,
  });

  return { ok: true, clientId: client.id, fileId: file.id, fileNumber: file.fileNumber };
}

/** The regional conditions a file sits in, for the overview tab. */
export function fileRegion(county: string): string | null {
  return regionForCounty(county);
}
