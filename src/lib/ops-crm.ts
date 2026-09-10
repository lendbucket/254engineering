import "server-only";
import { supabaseAdmin } from "./supabase";
import { writeAudit, diffOf, safeDiff } from "./ops-audit";
import { canSeeFile, redactFile, visibleFiles, type Actor, actionsFor } from "./ops-authz";
import { canTransition, formatFileNumber, STATUS_TIMESTAMP, type FileStatus } from "./ops-files";
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
  const { data: highest } = await db
    .from("eng_files")
    .select("file_number")
    .like("file_number", `%-${year}-%`)
    .order("file_number", { ascending: false })
    .limit(1);

  const lastSequence = highest?.[0]?.file_number
    ? Number(String(highest[0].file_number).split("-").pop())
    : 0;
  const nextSequence = Number.isFinite(lastSequence) ? lastSequence : 0;

  /*
   * Retries are for the collision two simultaneous intakes cause, which is a
   * real race this does not remove: both read the same highest number. Five
   * rather than three, because the seeded blocks that exposed the count bug
   * also make a short run of taken numbers plausible.
   */
  for (let attempt = 0; attempt < 5; attempt++) {
    const fileNumber = formatFileNumber(year, nextSequence + 1 + attempt);
    const { data, error } = await db
      .from("eng_files")
      .insert({
        file_number: fileNumber,
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
        price_overridden_at: input.priceOverrideReason ? new Date().toISOString() : null,
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
  const stamp = STATUS_TIMESTAMP[to];
  if (stamp) patch[stamp] = new Date().toISOString();

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
