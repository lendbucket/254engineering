import "server-only";
import { supabaseAdmin } from "./supabase";
import { writeAudit, diffOf, safeDiff } from "./ops-audit";
import { canSeeFile, redactFile, visibleFiles, type Actor } from "./ops-authz";
import { canTransition, formatFileNumber, STATUS_TIMESTAMP, type FileStatus } from "./ops-files";
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
  property_address: string;
  city: string | null;
  county: string;
  twia_county: boolean;
  urgency: string;
  status: FileStatus;
  due_at: string | null;
  assigned_tech_id: string | null;
  assigned_engineer_id: string | null;
  client_price_cents?: number | null;
  tech_cost_cents?: number | null;
  engineer_cost_cents?: number | null;
  created_at: string;
  notes: string | null;
};

const FILE_COLUMNS =
  "id, file_number, client_id, service_slug, property_address, city, county, twia_county, urgency, status, due_at, assigned_tech_id, assigned_engineer_id, client_price_cents, tech_cost_cents, engineer_cost_cents, created_at, notes";

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

export async function createClient(
  actor: Actor & { email: string },
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
  actor: Actor & { email: string },
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
  const { count } = await db
    .from("eng_files")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${year}-01-01T00:00:00Z`);

  // Retry once on the unique collision two simultaneous intakes would cause.
  for (let attempt = 0; attempt < 3; attempt++) {
    const fileNumber = formatFileNumber(year, (count ?? 0) + 1 + attempt);
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
export async function transitionFile(
  actor: Actor & { email: string },
  id: string,
  to: FileStatus,
  note: string | null,
  context: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const current = await getFile(actor, id);
  if (!current) return { ok: false, error: "That file does not exist, or is not yours to move." };

  const verdict = canTransition(actor, current.status, to);
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
