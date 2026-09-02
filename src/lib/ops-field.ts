import "server-only";
import { supabaseAdmin } from "./supabase";
import { credentialBlockersFor } from "./ops-onboarding";
import {
  canAttempt,
  forTechnician,
  gradeAttempt,
  type Answer,
  type CertificationRecord,
  type CheckQuestion,
  type PublicQuestion,
} from "./ops-certification";
import { writeAudit, diffOf, safeDiff } from "./ops-audit";
import { can, type Actor } from "./ops-authz";
import { transitionFile } from "./ops-crm";
import {
  canRespondToOffer,
  planDispatch,
  type DispatchPlan,
  type OfferState,
  type TechCandidate,
} from "./ops-dispatch";
import {
  checklistState,
  type CapturedItem,
  type ChecklistState,
  type EvidenceKind,
  type ProtocolItem,
} from "./ops-evidence";

/**
 * The field layer: protocols, offers, evidence, and what a technician is owed.
 *
 * WHAT THIS MODULE IS AND IS NOT
 * ------------------------------
 * It is the part that touches the database. Every rule it enforces is imported
 * from ops-dispatch, ops-evidence, ops-files or ops-authz, all of which are pure
 * and all of which dispatch-audit, files-audit and roles-audit assert directly.
 *
 * A rule invented here would be a rule the suite cannot see, which is how the
 * gate loop in files-audit came to be a tautology. So the shape below is always
 * the same: load, ask the pure module, persist the answer, write the audit row.
 *
 * THE ONE THING THAT IS GENUINELY DECIDED HERE
 * --------------------------------------------
 * Concurrency. "First acceptance wins" is a rule ops-dispatch states and cannot
 * enforce, because two phones can both read "not yet assigned" in the same
 * millisecond and both be told yes. The conditional update in acceptOffer, and
 * the partial unique index behind it, are what actually decide it. That is a
 * database question and it is answered with the database.
 */

/** Request facts every audit row carries, threaded through unchanged. */
type Context = { ip?: string | null; userAgent?: string | null };

// ------------------------------------------------------------------ protocols

export type ProtocolTemplateRow = {
  id: string;
  created_at: string;
  service_slug: string;
  name: string;
  version: number;
  status: "draft" | "published" | "retired";
  summary: string | null;
  published_at: string | null;
  authored_by: string | null;
};

export type ProtocolWithItems = ProtocolTemplateRow & { items: ProtocolItem[] };

const TEMPLATE_COLUMNS =
  "id, created_at, service_slug, name, version, status, summary, published_at, authored_by";

const ITEM_COLUMNS =
  "id, template_id, sort_order, item_key, kind, label, instructions, required, unit, min_value, max_value, min_count";

/** The database row shape, mapped to what the pure module expects. */
type ProtocolItemRow = {
  id: string;
  template_id: string;
  sort_order: number;
  item_key: string;
  kind: EvidenceKind;
  label: string;
  instructions: string | null;
  required: boolean;
  unit: string | null;
  min_value: number | string | null;
  max_value: number | string | null;
  min_count: number | null;
};

/*
 * Numeric columns come back from PostgREST as strings, because a Postgres
 * numeric does not fit a JavaScript number without losing precision and the
 * driver refuses to make that choice for you. Every comparison in ops-evidence
 * is arithmetic, so the conversion happens once, here, at the boundary. A
 * string "24" compared against a number 40 with < is a comparison that quietly
 * does the wrong thing.
 */
const num = (v: number | string | null | undefined): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);

function toProtocolItem(row: ProtocolItemRow): ProtocolItem {
  return {
    id: row.id,
    itemKey: row.item_key,
    kind: row.kind,
    label: row.label,
    instructions: row.instructions,
    required: row.required,
    unit: row.unit,
    minValue: num(row.min_value),
    maxValue: num(row.max_value),
    minCount: row.min_count,
  };
}

export async function listProtocols(actor: Actor | null): Promise<ProtocolTemplateRow[]> {
  const db = supabaseAdmin();
  if (!db || !can(actor, "protocols.author")) return [];
  const { data } = await db
    .from("eng_protocol_templates")
    .select(TEMPLATE_COLUMNS)
    .order("service_slug")
    .order("version", { ascending: false });
  return (data ?? []) as ProtocolTemplateRow[];
}

export async function getProtocol(actor: Actor | null, id: string): Promise<ProtocolWithItems | null> {
  const db = supabaseAdmin();
  if (!db || !can(actor, "protocols.author")) return null;
  const { data } = await db.from("eng_protocol_templates").select(TEMPLATE_COLUMNS).eq("id", id).maybeSingle();
  if (!data) return null;
  const { data: items } = await db
    .from("eng_protocol_items")
    .select(ITEM_COLUMNS)
    .eq("template_id", id)
    .order("sort_order");
  return {
    ...(data as ProtocolTemplateRow),
    items: ((items ?? []) as ProtocolItemRow[]).map(toProtocolItem),
  };
}

/**
 * Start a protocol, or start the next version of one.
 *
 * A published protocol is never edited. Files in flight are being worked to it,
 * and changing the checklist under a technician standing on a roof produces a
 * submission gate that moves while they are trying to clear it. So authoring
 * always writes a new draft, and the version number is the highest that service
 * line has seen plus one.
 */
export async function createProtocol(
  actor: Actor & { email: string },
  input: { serviceSlug: string; name: string; summary?: string | null; copyFromId?: string | null },
  context: Context = {},
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "protocols.author")) return { ok: false, error: "Your role cannot author protocols." };

  const serviceSlug = input.serviceSlug.trim();
  const name = input.name.trim();
  if (!serviceSlug || !name) return { ok: false, error: "A protocol needs a service line and a name." };

  const { data: existing } = await db
    .from("eng_protocol_templates")
    .select("version")
    .eq("service_slug", serviceSlug)
    .order("version", { ascending: false })
    .limit(1);
  const version = ((existing?.[0]?.version as number) ?? 0) + 1;

  const { data, error } = await db
    .from("eng_protocol_templates")
    .insert({
      service_slug: serviceSlug,
      name,
      summary: input.summary?.trim() || null,
      version,
      status: "draft",
      authored_by: actor.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create the protocol." };

  // Copying an earlier version is the normal way a version two begins: an
  // engineer changes two items out of fifteen, and retyping the other thirteen
  // is how the other thirteen acquire typos.
  if (input.copyFromId) {
    const { data: source } = await db
      .from("eng_protocol_items")
      .select(ITEM_COLUMNS)
      .eq("template_id", input.copyFromId)
      .order("sort_order");
    const rows = ((source ?? []) as ProtocolItemRow[]).map((r) => ({
      template_id: data.id,
      sort_order: r.sort_order,
      item_key: r.item_key,
      kind: r.kind,
      label: r.label,
      instructions: r.instructions,
      required: r.required,
      unit: r.unit,
      min_value: r.min_value,
      max_value: r.max_value,
      min_count: r.min_count,
    }));
    if (rows.length) await db.from("eng_protocol_items").insert(rows);
  }

  await writeAudit({
    actor,
    action: "protocol.create",
    entityType: "protocol",
    entityId: data.id,
    summary: `Drafted ${name} v${version} for ${serviceSlug}`,
    ...context,
  });
  return { ok: true, id: data.id };
}

export type ProtocolItemInput = {
  itemKey: string;
  kind: EvidenceKind;
  label: string;
  instructions?: string | null;
  required: boolean;
  unit?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  minCount?: number | null;
};

export async function addProtocolItem(
  actor: Actor & { email: string },
  templateId: string,
  input: ProtocolItemInput,
  context: Context = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "protocols.author")) return { ok: false, error: "Your role cannot author protocols." };

  const template = await getProtocol(actor, templateId);
  if (!template) return { ok: false, error: "That protocol does not exist." };
  if (template.status !== "draft") {
    return { ok: false, error: "A published protocol cannot be edited. Start the next version instead." };
  }

  const itemKey = input.itemKey.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (!itemKey) return { ok: false, error: "That item needs a key." };
  if (!input.label.trim()) return { ok: false, error: "That item needs a label a technician can read." };

  if (input.minValue != null && input.maxValue != null && input.minValue > input.maxValue) {
    return { ok: false, error: "The minimum is above the maximum, so nothing could ever satisfy it." };
  }

  const { error } = await db.from("eng_protocol_items").insert({
    template_id: templateId,
    sort_order: template.items.length,
    item_key: itemKey,
    kind: input.kind,
    label: input.label.trim(),
    instructions: input.instructions?.trim() || null,
    required: input.required,
    unit: input.unit?.trim() || null,
    min_value: input.minValue ?? null,
    max_value: input.maxValue ?? null,
    min_count: input.kind === "photo" ? (input.minCount ?? null) : null,
  });
  if (error) {
    return {
      ok: false,
      error: /duplicate key/i.test(error.message)
        ? `This protocol already has an item keyed ${itemKey}.`
        : error.message,
    };
  }

  await writeAudit({
    actor,
    action: "protocol.item_add",
    entityType: "protocol",
    entityId: templateId,
    summary: `Added ${input.label.trim()} to ${template.name} v${template.version}`,
    ...context,
  });
  return { ok: true };
}

export async function removeProtocolItem(
  actor: Actor & { email: string },
  templateId: string,
  itemId: string,
  context: Context = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "protocols.author")) return { ok: false, error: "Your role cannot author protocols." };

  const template = await getProtocol(actor, templateId);
  if (!template) return { ok: false, error: "That protocol does not exist." };
  if (template.status !== "draft") {
    return { ok: false, error: "A published protocol cannot be edited. Start the next version instead." };
  }

  const { error } = await db.from("eng_protocol_items").delete().eq("id", itemId).eq("template_id", templateId);
  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actor,
    action: "protocol.item_remove",
    entityType: "protocol",
    entityId: templateId,
    summary: `Removed an item from ${template.name} v${template.version}`,
    ...context,
  });
  return { ok: true };
}

/**
 * Publish a protocol, which is the moment it becomes usable by dispatch.
 *
 * An empty protocol cannot be published. A file working an empty checklist would
 * have a submission gate with nothing in it, and ops-evidence refuses to submit
 * one for exactly that reason, so a technician would be handed a job they can
 * never finish.
 */
export async function publishProtocol(
  actor: Actor & { email: string },
  id: string,
  context: Context = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "protocols.publish")) return { ok: false, error: "Your role cannot publish protocols." };

  const template = await getProtocol(actor, id);
  if (!template) return { ok: false, error: "That protocol does not exist." };
  if (template.status === "published") return { ok: false, error: "That protocol is already published." };
  if (template.items.length === 0) {
    return { ok: false, error: "A protocol with no items cannot be published. A technician could never finish it." };
  }
  if (!template.items.some((i) => i.required)) {
    return {
      ok: false,
      error: "Every item in this protocol is optional, so the submission gate would let an empty package through.",
    };
  }

  // Retire the previous published version of the same service line in the same
  // breath. Two published versions is an ambiguity dispatch would have to guess
  // its way out of.
  await db
    .from("eng_protocol_templates")
    .update({ status: "retired" })
    .eq("service_slug", template.service_slug)
    .eq("status", "published");

  const { error } = await db
    .from("eng_protocol_templates")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft");
  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actor,
    action: "protocol.publish",
    entityType: "protocol",
    entityId: id,
    summary: `Published ${template.name} v${template.version} for ${template.service_slug}`,
    diff: safeDiff(diffOf({ status: template.status }, { status: "published" })),
    ...context,
  });
  return { ok: true };
}

/** The one published protocol for a service line, or nothing. */
export async function publishedProtocolFor(serviceSlug: string): Promise<ProtocolWithItems | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("eng_protocol_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("service_slug", serviceSlug)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const { data: items } = await db
    .from("eng_protocol_items")
    .select(ITEM_COLUMNS)
    .eq("template_id", (data as ProtocolTemplateRow).id)
    .order("sort_order");
  return {
    ...(data as ProtocolTemplateRow),
    items: ((items ?? []) as ProtocolItemRow[]).map(toProtocolItem),
  };
}

// ------------------------------------------------------------------- dispatch

export type DispatchContext = {
  plan: DispatchPlan;
  protocol: ProtocolWithItems | null;
  feeCents: number | null;
  /** True when no candidate has coordinates, so the ranking is load and name only. */
  proximityUnavailable: boolean;
  /** Whether the PROPERTY has coordinates, so the screen can say which side is missing. */
  propertyLocated: boolean;
  alreadyOffered: { techId: string; state: OfferState }[];
};

/** The technicians the platform could consider, with their live open job counts. */
async function candidateTechs(): Promise<TechCandidate[]> {
  const db = supabaseAdmin();
  if (!db) return [];

  const { data: profiles } = await db
    .from("eng_profiles")
    .select("id, display_name, status, coverage_counties, base_lat, base_lng")
    .eq("role", "field_tech");
  if (!profiles?.length) return [];

  const ids = profiles.map((p) => p.id as string);

  const { data: certs } = await db
    .from("eng_certifications")
    .select("profile_id, service_slug")
    .in("profile_id", ids)
    .eq("status", "certified");

  /*
   * Phase 3's fourth gate. Computed here rather than inside planDispatch so that
   * module never has to know what today is: every expiry rule in
   * ops-credentials is tested at a date of the caller's choosing, and a pure
   * function that reads the clock cannot be.
   */
  const blockersBy = await credentialBlockersFor(ids);

  /*
   * Open jobs means assigned and not finished. Delivered, closed and cancelled
   * files are not load; a technician holding four delivered files is holding
   * nothing.
   */
  const { data: open } = await db
    .from("eng_files")
    .select("assigned_tech_id")
    .in("assigned_tech_id", ids)
    .in("status", ["dispatched", "evidence_in_progress", "revisions_requested"]);

  const loadBy = new Map<string, number>();
  for (const row of open ?? []) {
    const id = row.assigned_tech_id as string;
    loadBy.set(id, (loadBy.get(id) ?? 0) + 1);
  }
  const certBy = new Map<string, string[]>();
  for (const row of certs ?? []) {
    const id = row.profile_id as string;
    certBy.set(id, [...(certBy.get(id) ?? []), row.service_slug as string]);
  }

  return profiles.map((p) => ({
    id: p.id as string,
    displayName: p.display_name as string,
    status: p.status as TechCandidate["status"],
    coverageCounties: (p.coverage_counties as string[]) ?? [],
    certifiedFor: certBy.get(p.id as string) ?? [],
    credentialBlockers: blockersBy.get(p.id as string) ?? [],
    openJobs: loadBy.get(p.id as string) ?? 0,
    baseLat: num(p.base_lat as number | string | null),
    baseLng: num(p.base_lng as number | string | null),
  }));
}

/** What a technician is paid for this service line, from the effective dated schedule. */
async function techFeeFor(serviceSlug: string): Promise<number | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db
    .from("eng_fee_schedule")
    .select("amount_cents, effective_from, effective_to")
    .eq("kind", "tech_pay")
    .eq("service_slug", serviceSlug)
    .lte("effective_from", today)
    .order("effective_from", { ascending: false })
    .limit(5);
  const live = (data ?? []).find((r) => !r.effective_to || (r.effective_to as string) >= today);
  return live ? Number(live.amount_cents) : null;
}

/**
 * Everything the dispatch screen needs to show, without deciding anything.
 *
 * The plan comes from planDispatch, which is pure and audited. This function's
 * only judgment is which candidates to load and what the fee is.
 */
export async function dispatchContext(
  actor: Actor | null,
  file: { id: string; county: string; service_slug: string; latitude: number | string | null; longitude: number | string | null },
): Promise<DispatchContext | null> {
  const db = supabaseAdmin();
  if (!db || !can(actor, "offers.dispatch")) return null;

  const candidates = await candidateTechs();
  const feeCents = await techFeeFor(file.service_slug);
  const plan = planDispatch(
    {
      county: file.county,
      serviceSlug: file.service_slug,
      lat: num(file.latitude),
      lng: num(file.longitude),
    },
    candidates,
    feeCents,
  );

  const { data: offers } = await db
    .from("eng_assignments")
    .select("tech_id, state")
    .eq("file_id", file.id);

  return {
    plan,
    protocol: await publishedProtocolFor(file.service_slug),
    feeCents,
    proximityUnavailable: plan.offers.length > 0 && plan.offers.every((o) => o.distanceMiles === null),
    propertyLocated: num(file.latitude) !== null && num(file.longitude) !== null,
    alreadyOffered: (offers ?? []).map((o) => ({ techId: o.tech_id as string, state: o.state as OfferState })),
  };
}

/**
 * Send offers.
 *
 * The file is NOT moved to dispatched here. It moves when somebody accepts,
 * because a file marked dispatched with nobody on it is the exact lie the status
 * column exists to prevent.
 */
export async function sendOffers(
  actor: Actor & { email: string },
  fileId: string,
  techIds: string[],
  options: { expiresInHours?: number } = {},
  context: Context = {},
): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "offers.dispatch")) return { ok: false, error: "Your role cannot dispatch." };
  if (techIds.length === 0) return { ok: false, error: "Choose at least one technician." };

  const { data: file } = await db
    .from("eng_files")
    .select("id, file_number, county, service_slug, latitude, longitude, status, assigned_tech_id")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return { ok: false, error: "That file does not exist." };
  if (file.assigned_tech_id) return { ok: false, error: "That file already has a technician." };

  const protocol = await publishedProtocolFor(file.service_slug as string);
  if (!protocol) {
    return {
      ok: false,
      error:
        "No published protocol exists for this service line. A technician accepting this job would " +
        "open an empty checklist, so dispatch is blocked until an engineer publishes one.",
    };
  }

  /*
   * The plan is recomputed rather than trusted from the form. The screen that
   * offered these technicians was rendered at some earlier moment, and a
   * certification revoked in between is exactly the case this check exists for.
   */
  const ctx = await dispatchContext(actor, file as never);
  if (!ctx) return { ok: false, error: "Could not plan this dispatch." };
  const eligible = new Map(ctx.plan.offers.map((o) => [o.techId, o]));

  const rejected = techIds.filter((id) => !eligible.has(id));
  if (rejected.length) {
    const why = ctx.plan.ineligible.find((i) => rejected.includes(i.id));
    return {
      ok: false,
      error: why
        ? `${why.displayName} is no longer eligible: ${why.reason}`
        : "One of those technicians is no longer eligible for this job.",
    };
  }

  const expiresAt = options.expiresInHours
    ? new Date(Date.now() + options.expiresInHours * 3600_000).toISOString()
    : null;

  const rows = techIds.map((id) => {
    const offer = eligible.get(id)!;
    return {
      file_id: fileId,
      tech_id: id,
      state: "offered",
      rank: offer.rank,
      distance_miles: offer.distanceMiles,
      offer_amount_cents: offer.amountCents,
      expires_at: expiresAt,
      offered_by: actor.id,
    };
  });

  // upsert rather than insert: re-offering a job to somebody who declined it
  // earlier is a normal thing an operator does after a phone call.
  const { error } = await db.from("eng_assignments").upsert(rows, { onConflict: "file_id,tech_id" });
  if (error) return { ok: false, error: error.message };

  await db.from("eng_files").update({ protocol_template_id: protocol.id }).eq("id", fileId);

  await db.from("eng_file_events").insert({
    file_id: fileId,
    actor_id: actor.id,
    kind: "dispatch",
    body: `Offered to ${techIds.length} technician${techIds.length === 1 ? "" : "s"} at ${
      ctx.feeCents === null ? "no scheduled rate" : `$${(ctx.feeCents / 100).toFixed(2)}`
    }.`,
  });

  await writeAudit({
    actor,
    action: "offers.send",
    entityType: "file",
    entityId: fileId,
    summary: `${file.file_number}: offered to ${techIds.length} technician${techIds.length === 1 ? "" : "s"}`,
    ...context,
  });

  return { ok: true, sent: rows.length };
}

// --------------------------------------------------------------------- offers

export type OfferRow = {
  id: string;
  file_id: string;
  tech_id: string;
  state: OfferState;
  rank: number | null;
  distance_miles: number | string | null;
  offer_amount_cents: number | null;
  offered_at: string;
  expires_at: string | null;
  file: {
    file_number: string;
    property_address: string;
    city: string | null;
    county: string;
    service_slug: string;
    status: string;
    twia_county: boolean;
    evidence_due_at: string | null;
    assigned_tech_id: string | null;
  } | null;
};

const OFFER_COLUMNS = `
  id, file_id, tech_id, state, rank, distance_miles, offer_amount_cents, offered_at, expires_at,
  file:eng_files!eng_assignments_file_id_fkey (
    file_number, property_address, city, county, service_slug, status, twia_county,
    evidence_due_at, assigned_tech_id
  )
`;

/**
 * A technician's own offers and jobs.
 *
 * An admin passing a techId reads somebody else's, which is what the roster
 * needs. A technician can only ever read their own, and passing another id is
 * ignored rather than refused, because the only way to reach this with somebody
 * else's id as a tech is a hand written request.
 */
export async function listOffers(
  actor: Actor | null,
  techId?: string,
): Promise<OfferRow[]> {
  const db = supabaseAdmin();
  if (!db || !actor) return [];
  if (!can(actor, "offers.list_own")) return [];

  const subject = actor.role === "admin" && techId ? techId : actor.id;

  const { data } = await db
    .from("eng_assignments")
    .select(OFFER_COLUMNS)
    .eq("tech_id", subject)
    .order("offered_at", { ascending: false })
    .limit(100);

  return ((data ?? []) as unknown as OfferRow[]).filter((o) => o.file !== null);
}

/**
 * Accept an offer, and be the only one who does.
 *
 * THE RACE, AND WHERE IT IS ACTUALLY DECIDED
 * ------------------------------------------
 * Two technicians tap accept at once. Both read a file with no assigned tech.
 * Both would win a check written in JavaScript. The claim below is a single
 * conditional update, `set assigned_tech_id where assigned_tech_id is null`,
 * and Postgres serialises it: exactly one row is returned to exactly one
 * caller. The other gets zero rows and is told, in the same sentence the pure
 * module uses, that somebody accepted first.
 *
 * The partial unique index on accepted assignments in migration 0002 is the
 * second layer, for the case where a future edit reorders these statements.
 */
export async function acceptOffer(
  actor: Actor & { email: string },
  offerId: string,
  context: Context = {},
): Promise<{ ok: true; fileId: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const { data: offer } = await db
    .from("eng_assignments")
    .select("id, file_id, tech_id, state, expires_at, offer_amount_cents")
    .eq("id", offerId)
    .maybeSingle();
  if (!offer) return { ok: false, error: "That offer does not exist." };

  const { data: file } = await db
    .from("eng_files")
    .select("id, file_number, status, assigned_tech_id")
    .eq("id", offer.file_id)
    .maybeSingle();
  if (!file) return { ok: false, error: "That file does not exist." };

  const verdict = canRespondToOffer(
    actor,
    {
      techId: offer.tech_id as string,
      state: offer.state as OfferState,
      expiresAt: offer.expires_at as string | null,
    },
    Boolean(file.assigned_tech_id),
  );
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  // The claim. Everything above this line is a courtesy; this is the decision.
  const { data: claimed } = await db
    .from("eng_files")
    .update({ assigned_tech_id: offer.tech_id })
    .eq("id", offer.file_id)
    .is("assigned_tech_id", null)
    .select("id");

  if (!claimed?.length) return { ok: false, error: "Another technician accepted this job first." };

  await db
    .from("eng_assignments")
    .update({ state: "accepted", responded_at: new Date().toISOString() })
    .eq("id", offerId);

  await db
    .from("eng_assignments")
    .update({ state: "withdrawn", responded_at: new Date().toISOString() })
    .eq("file_id", offer.file_id)
    .eq("state", "offered")
    .neq("id", offerId);

  /*
   * The status move goes through transitionFile, so the state machine and the
   * timeline see it. An accepted offer that set the column directly would be a
   * second path into the same state with none of the checks on it.
   */
  if (file.status === "needs_dispatch") {
    const moved = await transitionFile(actor, offer.file_id as string, "dispatched", "Offer accepted.", context);
    if (!moved.ok) return { ok: false, error: moved.error };
  }

  await writeAudit({
    actor,
    action: "offer.accept",
    entityType: "file",
    entityId: offer.file_id as string,
    summary: `${file.file_number}: offer accepted`,
    ...context,
  });

  return { ok: true, fileId: offer.file_id as string };
}

export async function declineOffer(
  actor: Actor & { email: string },
  offerId: string,
  reason: string | null,
  context: Context = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const { data: offer } = await db
    .from("eng_assignments")
    .select("id, file_id, tech_id, state, expires_at")
    .eq("id", offerId)
    .maybeSingle();
  if (!offer) return { ok: false, error: "That offer does not exist." };

  const { data: file } = await db
    .from("eng_files")
    .select("id, file_number, assigned_tech_id")
    .eq("id", offer.file_id)
    .maybeSingle();

  const verdict = canRespondToOffer(
    actor,
    {
      techId: offer.tech_id as string,
      state: offer.state as OfferState,
      expiresAt: offer.expires_at as string | null,
    },
    Boolean(file?.assigned_tech_id),
  );
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  const { error } = await db
    .from("eng_assignments")
    .update({
      state: "declined",
      responded_at: new Date().toISOString(),
      decline_reason: reason?.trim() || null,
    })
    .eq("id", offerId)
    .eq("state", "offered");
  if (error) return { ok: false, error: error.message };

  /*
   * A decline is recorded on the file, with the reason. Dispatch is a person
   * deciding who to call next, and "three people turned this down because it is
   * a four hour drive" is the fact that decision needs.
   */
  await db.from("eng_file_events").insert({
    file_id: offer.file_id,
    actor_id: actor.id,
    kind: "dispatch",
    body: reason?.trim() ? `Offer declined: ${reason.trim()}` : "Offer declined.",
  });

  await writeAudit({
    actor,
    action: "offer.decline",
    entityType: "file",
    entityId: offer.file_id as string,
    summary: `${file?.file_number ?? "File"}: offer declined`,
    ...context,
  });
  return { ok: true };
}

// ------------------------------------------------------------------- evidence

export type EvidenceRow = {
  id: string;
  item_key: string;
  kind: EvidenceKind;
  value_text: string | null;
  value_number: number | string | null;
  unit: string | null;
  storage_key: string | null;
  captured_at: string | null;
  captured_lat: number | string | null;
  captured_lng: number | string | null;
  client_capture_id: string | null;
  status: "submitted" | "accepted" | "revision_requested";
};

export type JobView = {
  file: {
    id: string;
    assigned_tech_id: string | null;
    file_number: string;
    property_address: string;
    city: string | null;
    county: string;
    postal_code: string | null;
    service_slug: string;
    status: string;
    twia_county: boolean;
    evidence_due_at: string | null;
    notes: string | null;
  };
  protocol: ProtocolWithItems | null;
  captures: EvidenceRow[];
  state: ChecklistState;
  offer: { id: string; amountCents: number | null; state: OfferState } | null;
};

/**
 * One job as the technician working it sees it.
 *
 * A technician reaches this only for a file offered to or assigned to them, and
 * that check is the same canSeeFile the file list uses, reached through getFile
 * in ops-crm. A record readable by direct URL but hidden from the list is the
 * oldest authorization hole there is.
 */
export async function jobView(actor: Actor | null, fileId: string): Promise<JobView | null> {
  const db = supabaseAdmin();
  if (!db || !actor) return null;

  const { data: offer } = await db
    .from("eng_assignments")
    .select("id, tech_id, state, offer_amount_cents")
    .eq("file_id", fileId)
    .eq("tech_id", actor.id)
    .maybeSingle();

  const { data: file } = await db
    .from("eng_files")
    .select(
      "id, file_number, property_address, city, county, postal_code, service_slug, status, twia_county, evidence_due_at, notes, assigned_tech_id, protocol_template_id",
    )
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return null;

  const mine = file.assigned_tech_id === actor.id || Boolean(offer);
  if (!mine && actor.role !== "admin" && actor.role !== "engineer") return null;

  const protocol = file.protocol_template_id
    ? await getProtocolForWork(file.protocol_template_id as string)
    : await publishedProtocolFor(file.service_slug as string);

  const { data: captures } = await db
    .from("eng_evidence_items")
    .select(
      "id, item_key, kind, value_text, value_number, unit, storage_key, captured_at, captured_lat, captured_lng, client_capture_id, status",
    )
    .eq("file_id", fileId)
    .order("created_at");

  const rows = (captures ?? []) as EvidenceRow[];
  const captured: CapturedItem[] = rows.map((r) => ({
    itemKey: r.item_key,
    kind: r.kind,
    valueText: r.value_text,
    valueNumber: num(r.value_number),
    storageKey: r.storage_key,
  }));

  return {
    file: file as JobView["file"],
    protocol,
    captures: rows,
    state: checklistState(protocol?.items ?? [], captured),
    offer: offer
      ? {
          id: offer.id as string,
          amountCents: offer.offer_amount_cents as number | null,
          state: offer.state as OfferState,
        }
      : null,
  };
}

/** The protocol a file is pinned to, read without the authoring permission. */
async function getProtocolForWork(templateId: string): Promise<ProtocolWithItems | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db.from("eng_protocol_templates").select(TEMPLATE_COLUMNS).eq("id", templateId).maybeSingle();
  if (!data) return null;
  const { data: items } = await db
    .from("eng_protocol_items")
    .select(ITEM_COLUMNS)
    .eq("template_id", templateId)
    .order("sort_order");
  return {
    ...(data as ProtocolTemplateRow),
    items: ((items ?? []) as ProtocolItemRow[]).map(toProtocolItem),
  };
}

export type CaptureInput = {
  clientCaptureId: string;
  itemKey: string;
  kind: EvidenceKind;
  valueText?: string | null;
  valueNumber?: number | null;
  storageKey?: string | null;
  capturedAt?: string | null;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
};

/**
 * Record one capture, idempotently.
 *
 * IDEMPOTENT BECAUSE THE PHONE WILL SEND IT TWICE
 * -----------------------------------------------
 * The offline queue retries. A technician in a county with one bar captures ten
 * photographs, the upload half completes, the phone reconnects and replays the
 * queue. Every one of those requests carries the id the device minted at capture
 * time, and the unique index on (file_id, client_capture_id) turns the replay
 * into an update of the row that already exists rather than a second copy of the
 * same photograph.
 *
 * The first capture also starts the clock: a dispatched file becomes evidence in
 * progress the moment anything is captured against it, so the status reflects
 * what is happening rather than waiting for somebody to press a button.
 */
export async function recordCapture(
  actor: Actor & { email: string },
  fileId: string,
  input: CaptureInput,
  context: Context = {},
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "evidence.capture") && !can(actor, "evidence.review")) {
    return { ok: false, error: "Your role cannot capture evidence." };
  }

  const view = await jobView(actor, fileId);
  if (!view) return { ok: false, error: "That job is not yours." };

  /*
   * Holding an OFFER is not holding the job.
   *
   * jobView deliberately opens to anybody the file was offered to, because a
   * technician deciding whether to accept should be able to read the checklist
   * first. Capturing against it is a different act, and until somebody has
   * accepted, several people can see the same file. Without this check the
   * technician who lost the race could still write evidence onto a job that is
   * not theirs, and the engineer would review a package assembled by two people
   * without knowing it.
   *
   * Caught by walking the flow rather than by reading it.
   */
  if (actor.role === "field_tech" && view.file.assigned_tech_id !== actor.id) {
    return {
      ok: false,
      error: view.file.assigned_tech_id
        ? "Another technician accepted this job first."
        : "Accept this job before capturing against it.",
    };
  }

  if (["evidence_submitted", "under_review", "sealed", "delivered", "closed", "cancelled"].includes(view.file.status)) {
    return { ok: false, error: "This file has left the field. Capture is closed on it." };
  }

  const item = view.protocol?.items.find((i) => i.itemKey === input.itemKey);
  if (!item) return { ok: false, error: "That item is not in this file's protocol." };
  if (item.kind !== input.kind) return { ok: false, error: `${item.label} expects a ${item.kind}.` };
  if (!input.clientCaptureId) return { ok: false, error: "That capture has no id." };

  const { data, error } = await db
    .from("eng_evidence_items")
    .upsert(
      {
        file_id: fileId,
        protocol_item_id: item.id,
        item_key: item.itemKey,
        kind: input.kind,
        value_text: input.valueText?.trim() || null,
        value_number: input.valueNumber ?? null,
        unit: item.unit ?? null,
        storage_key: input.storageKey ?? null,
        captured_at: input.capturedAt ?? new Date().toISOString(),
        captured_lat: input.lat ?? null,
        captured_lng: input.lng ?? null,
        captured_accuracy: input.accuracy ?? null,
        captured_by: actor.id,
        client_capture_id: input.clientCaptureId,
      },
      { onConflict: "file_id,client_capture_id" },
    )
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not record that capture." };

  if (view.file.status === "dispatched") {
    await transitionFile(actor, fileId, "evidence_in_progress", "First evidence captured.", context);
  }

  return { ok: true, id: data.id };
}

export async function deleteCapture(
  actor: Actor & { email: string },
  fileId: string,
  captureId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const view = await jobView(actor, fileId);
  if (!view) return { ok: false, error: "That job is not yours." };
  if (view.file.status !== "evidence_in_progress" && view.file.status !== "revisions_requested") {
    return { ok: false, error: "Captures can only be removed while the file is still in the field." };
  }
  const { error } = await db.from("eng_evidence_items").delete().eq("id", captureId).eq("file_id", fileId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Submit the package, if the gate opens.
 *
 * The gate is checklistState, which is pure and asserted exhaustively. This
 * function does not re-decide it; it asks, and if the answer is no it hands back
 * the blockers as written, because a technician standing at a property needs to
 * know which photograph is missing, not that "the form is incomplete".
 *
 * The pay ledger row is written here rather than at seal. What the technician
 * was paid for is the visit, and the visit is done. Whether the engineer later
 * requests a revision is a separate question about the work, and Phase 4 records
 * the ruling that no money rule may create pressure on an engineer's conclusion.
 * A technician's fee that depended on the engineer's finding would be exactly
 * that pressure pointed at the other end of the same file.
 */
export async function submitEvidence(
  actor: Actor & { email: string },
  fileId: string,
  note: string | null,
  context: Context = {},
): Promise<{ ok: true } | { ok: false; error: string; blockers?: string[] }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const view = await jobView(actor, fileId);
  if (!view) return { ok: false, error: "That job is not yours." };

  if (!view.state.canSubmit) {
    return {
      ok: false,
      error: view.protocol
        ? "This package is not complete yet."
        : "This file has no protocol attached, so there is nothing to submit against.",
      blockers: view.state.blockers,
    };
  }

  const moved = await transitionFile(actor, fileId, "evidence_submitted", note, context);
  if (!moved.ok) return { ok: false, error: moved.error };

  const { data: offer } = await db
    .from("eng_assignments")
    .select("tech_id, offer_amount_cents")
    .eq("file_id", fileId)
    .eq("state", "accepted")
    .maybeSingle();

  if (offer?.offer_amount_cents) {
    /*
     * The unique partial index makes a replayed submit a no-op rather than a
     * second payment. The duplicate error is expected and swallowed; anything
     * else is not, and is surfaced.
     */
    const { error } = await db.from("eng_tech_pay_ledger").insert({
      tech_id: offer.tech_id,
      file_id: fileId,
      amount_cents: offer.offer_amount_cents,
      kind: "job",
      status: "pending",
      period: new Date().toISOString().slice(0, 7),
      note: `${view.file.file_number}, ${view.file.county} County`,
    });
    if (error && !/duplicate key/i.test(error.message)) {
      return { ok: false, error: `Evidence submitted, but the pay ledger entry failed: ${error.message}` };
    }
  }

  return { ok: true };
}

// --------------------------------------------------------------------- roster

export type RosterRow = {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  status: "invited" | "active" | "suspended";
  coverage_counties: string[];
  base_city: string | null;
  base_county: string | null;
  base_lat: number | null;
  base_lng: number | null;
  certifications: { service_slug: string; status: string }[];
  openJobs: number;
  completedJobs: number;
  pendingCents: number;
  paidCents: number;
  expiringCredentials: { kind: string; expires_on: string }[];
};

/**
 * The roster: everybody who works in the field, with the four facts an operator
 * dispatches on.
 *
 * Coverage and certification, because they are the two hard gates. Open load,
 * because it is the first sort key. And money owed, because a person who has not
 * been paid for three jobs is a person who stops answering the phone.
 */
export async function techRoster(actor: Actor | null): Promise<RosterRow[]> {
  const db = supabaseAdmin();
  if (!db || !can(actor, "profiles.list")) return [];

  const { data: profiles } = await db
    .from("eng_profiles")
    .select("id, display_name, email, phone, status, coverage_counties, base_city, base_county, base_lat, base_lng")
    .eq("role", "field_tech")
    .order("display_name");
  if (!profiles?.length) return [];

  const ids = profiles.map((p) => p.id as string);
  const soon = new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10);

  const [{ data: certs }, { data: files }, { data: ledger }, { data: creds }] = await Promise.all([
    db.from("eng_certifications").select("profile_id, service_slug, status").in("profile_id", ids),
    db.from("eng_files").select("assigned_tech_id, status").in("assigned_tech_id", ids),
    db.from("eng_tech_pay_ledger").select("tech_id, amount_cents, status").in("tech_id", ids),
    db
      .from("eng_credentials")
      .select("profile_id, kind, expires_on")
      .in("profile_id", ids)
      .not("expires_on", "is", null)
      .lte("expires_on", soon),
  ]);

  const OPEN = ["dispatched", "evidence_in_progress", "revisions_requested"];
  const DONE = ["evidence_submitted", "under_review", "sealed", "delivered", "closed"];

  return profiles.map((p) => {
    const id = p.id as string;
    const mine = (files ?? []).filter((f) => f.assigned_tech_id === id);
    const pay = (ledger ?? []).filter((l) => l.tech_id === id);
    return {
      id,
      display_name: p.display_name as string,
      email: p.email as string,
      phone: p.phone as string | null,
      status: p.status as RosterRow["status"],
      coverage_counties: (p.coverage_counties as string[]) ?? [],
      base_city: p.base_city as string | null,
      base_county: p.base_county as string | null,
      base_lat: num(p.base_lat as number | string | null),
      base_lng: num(p.base_lng as number | string | null),
      certifications: (certs ?? [])
        .filter((c) => c.profile_id === id)
        .map((c) => ({ service_slug: c.service_slug as string, status: c.status as string })),
      openJobs: mine.filter((f) => OPEN.includes(f.status as string)).length,
      completedJobs: mine.filter((f) => DONE.includes(f.status as string)).length,
      pendingCents: pay
        .filter((l) => l.status === "pending" || l.status === "approved")
        .reduce((sum, l) => sum + Number(l.amount_cents), 0),
      paidCents: pay.filter((l) => l.status === "paid").reduce((sum, l) => sum + Number(l.amount_cents), 0),
      expiringCredentials: (creds ?? [])
        .filter((c) => c.profile_id === id)
        .map((c) => ({ kind: c.kind as string, expires_on: c.expires_on as string })),
    };
  });
}

export type LedgerRow = {
  id: string;
  created_at: string;
  tech_id: string;
  file_id: string | null;
  amount_cents: number;
  kind: string;
  status: "pending" | "approved" | "paid" | "void";
  period: string | null;
  note: string | null;
};

/**
 * The pay ledger.
 *
 * A technician reads their own and nobody else's. An admin reads everybody's.
 * There is no view in between, because "an engineer can see what techs are paid"
 * is a decision nobody has made and defaulting to yes would be making it.
 */
export async function payLedger(actor: Actor | null, techId?: string): Promise<LedgerRow[]> {
  const db = supabaseAdmin();
  if (!db || !actor) return [];

  const all = can(actor, "ledger.read_all");
  if (!all && !can(actor, "ledger.read_own")) return [];

  let query = db
    .from("eng_tech_pay_ledger")
    .select("id, created_at, tech_id, file_id, amount_cents, kind, status, period, note")
    .order("created_at", { ascending: false })
    .limit(300);

  if (!all) query = query.eq("tech_id", actor.id);
  else if (techId) query = query.eq("tech_id", techId);

  const { data } = await query;
  return ((data ?? []) as LedgerRow[]).map((r) => ({ ...r, amount_cents: Number(r.amount_cents) }));
}

export async function setLedgerStatus(
  actor: Actor & { email: string },
  ids: string[],
  status: "approved" | "paid" | "void",
  context: Context = {},
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "ledger.approve")) return { ok: false, error: "Your role cannot approve payments." };
  if (ids.length === 0) return { ok: false, error: "Nothing selected." };

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  if (status === "approved") patch.approved_at = now;
  if (status === "paid") patch.paid_at = now;

  const { data, error } = await db.from("eng_tech_pay_ledger").update(patch).in("id", ids).select("id");
  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actor,
    action: "ledger.update",
    entityType: "ledger",
    entityId: ids[0],
    summary: `Marked ${data?.length ?? 0} pay entr${(data?.length ?? 0) === 1 ? "y" : "ies"} ${status}`,
    ...context,
  });
  return { ok: true, count: data?.length ?? 0 };
}

/** An administrator setting a technician's base, which is what makes proximity work. */
export async function setTechBase(
  actor: Actor & { email: string },
  techId: string,
  input: { baseCity?: string | null; baseCounty?: string | null; lat?: number | null; lng?: number | null },
  context: Context = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "profiles.update")) return { ok: false, error: "Your role cannot edit a technician." };

  if (input.lat != null && (input.lat < 25.8 || input.lat > 36.6)) {
    return { ok: false, error: "That latitude is outside Texas. Check the sign and the order of the pair." };
  }
  if (input.lng != null && (input.lng > -93.4 || input.lng < -106.7)) {
    return { ok: false, error: "That longitude is outside Texas. Texas longitudes are negative." };
  }

  const { error } = await db
    .from("eng_profiles")
    .update({
      base_city: input.baseCity?.trim() || null,
      base_county: input.baseCounty?.trim() || null,
      base_lat: input.lat ?? null,
      base_lng: input.lng ?? null,
    })
    .eq("id", techId)
    .eq("role", "field_tech");
  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actor,
    action: "profile.set_base",
    entityType: "profile",
    entityId: techId,
    summary: `Set field base to ${input.baseCity ?? "unset"}`,
    ...context,
  });
  return { ok: true };
}

// -------------------------------------------------- the certification check

/**
 * The protocol check: questions, attempts, and the certification they produce.
 *
 * Lives beside protocols rather than in its own module because it IS part of the
 * protocol. The engineer writes the checklist and the questions about it in one
 * sitting, on one document, and a technician is certified against a version
 * rather than against a service line in the abstract.
 */

type QuestionRow = {
  id: string;
  template_id: string;
  sort_order: number;
  prompt: string;
  options: string[];
  correct_index: number;
  rationale: string;
};

const toQuestion = (r: QuestionRow): CheckQuestion => ({
  id: r.id,
  prompt: r.prompt,
  options: r.options,
  correctIndex: r.correct_index,
  rationale: r.rationale,
});

/**
 * Every question on a template, answer key included.
 *
 * NOT EXPORTED, AND THAT IS THE POINT
 * -----------------------------------
 * The only two callers are the authoring view, which is gated on
 * protocols.author, and the grader, which runs on the server. Exporting this
 * would put it one careless import away from a page that serializes its props
 * to the browser, and a check whose answers are in the page source is a
 * formality that writes a certification record.
 */
async function questionsWithKey(templateId: string): Promise<CheckQuestion[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from("eng_protocol_questions")
    .select("id, template_id, sort_order, prompt, options, correct_index, rationale")
    .eq("template_id", templateId)
    .order("sort_order");
  return ((data ?? []) as QuestionRow[]).map(toQuestion);
}

/** The authoring view. Gated on protocols.author, answers included. */
export async function protocolQuestions(
  actor: Actor | null,
  templateId: string,
): Promise<CheckQuestion[]> {
  if (!can(actor, "protocols.author")) return [];
  return questionsWithKey(templateId);
}

export async function addProtocolQuestion(
  actor: Actor & { email: string },
  templateId: string,
  input: { prompt: string; options: string[]; correctIndex: number; rationale: string },
  context: Context = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "protocols.author")) return { ok: false, error: "Your role cannot author protocols." };

  const template = await getProtocol(actor, templateId);
  if (!template) return { ok: false, error: "That protocol does not exist." };
  if (template.status !== "draft") {
    return { ok: false, error: "A published protocol cannot be edited. Start the next version instead." };
  }

  const options = input.options.map((o) => o.trim()).filter(Boolean);
  if (options.length < 2) return { ok: false, error: "A question needs at least two options." };
  if (options.length > 6) return { ok: false, error: "Six options is the most a question can carry." };
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
    return { ok: false, error: "Two options say the same thing, so the question has two right answers." };
  }
  if (!Number.isInteger(input.correctIndex) || input.correctIndex < 0 || input.correctIndex >= options.length) {
    return { ok: false, error: "Mark which option is correct." };
  }
  if (!input.prompt.trim()) return { ok: false, error: "The question needs a prompt." };
  /*
   * The rationale is required rather than optional. It is the only thing a
   * technician who got the question wrong receives, and a check that fails
   * somebody without telling them why has taught nothing and will be failed
   * again.
   */
  if (input.rationale.trim().length < 10) {
    return {
      ok: false,
      error: "Write the reasoning. It is the only thing a technician who gets this wrong will read.",
    };
  }

  const existing = await questionsWithKey(templateId);
  const { error } = await db.from("eng_protocol_questions").insert({
    template_id: templateId,
    sort_order: existing.length,
    prompt: input.prompt.trim(),
    options,
    correct_index: input.correctIndex,
    rationale: input.rationale.trim(),
  });
  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actor,
    action: "protocol.question_add",
    entityType: "protocol",
    entityId: templateId,
    summary: `Added a check question to ${template.name} v${template.version}`,
    ...context,
  });
  return { ok: true };
}

export async function removeProtocolQuestion(
  actor: Actor & { email: string },
  templateId: string,
  questionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "protocols.author")) return { ok: false, error: "Your role cannot author protocols." };
  const template = await getProtocol(actor, templateId);
  if (!template) return { ok: false, error: "That protocol does not exist." };
  if (template.status !== "draft") {
    return { ok: false, error: "A published protocol cannot be edited. Start the next version instead." };
  }
  const { error } = await db
    .from("eng_protocol_questions")
    .delete()
    .eq("id", questionId)
    .eq("template_id", templateId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export type CheckView = {
  serviceSlug: string;
  templateId: string;
  protocolName: string;
  version: number;
  items: ProtocolItem[];
  questions: PublicQuestion[];
  certification: CertificationRecord | null;
  attemptable: { ok: true } | { ok: false; reason: string };
};

/**
 * The check as a technician receives it.
 *
 * The questions come back through forTechnician, which drops the answer key. The
 * protocol items come back in full, because the check is open book by design:
 * the point is that the technician knows where to look, not that they memorised
 * it in a room with no phone.
 */
export async function checkFor(actor: Actor | null, serviceSlug: string): Promise<CheckView | null> {
  const db = supabaseAdmin();
  if (!db || !actor) return null;
  if (actor.role !== "field_tech" && actor.role !== "admin") return null;

  const protocol = await publishedProtocolFor(serviceSlug);
  if (!protocol) return null;

  const { data: cert } = await db
    .from("eng_certifications")
    .select("service_slug, status, template_id, score, attempts")
    .eq("profile_id", actor.id)
    .eq("service_slug", serviceSlug)
    .maybeSingle();

  const certification: CertificationRecord | null = cert
    ? {
        serviceSlug: cert.service_slug as string,
        status: cert.status as CertificationRecord["status"],
        templateId: (cert.template_id as string | null) ?? null,
        score: (cert.score as number | null) ?? null,
        attempts: (cert.attempts as number) ?? 0,
      }
    : null;

  return {
    serviceSlug,
    templateId: protocol.id,
    protocolName: protocol.name,
    version: protocol.version,
    items: protocol.items,
    questions: forTechnician(await questionsWithKey(protocol.id)),
    certification,
    attemptable: canAttempt(certification),
  };
}

export type AttemptResult = {
  passed: boolean;
  score: number;
  correct: number;
  total: number;
  wrong: { questionId: string; prompt: string; rationale: string }[];
  unanswered: string[];
};

/**
 * Grade an attempt and, if it passes, certify.
 *
 * THE GRADING HAPPENS HERE AND NOWHERE ELSE
 * -----------------------------------------
 * The browser sends option indices and receives a verdict. It never held the
 * answers, so there is nothing in the page to inspect, and a client that lies
 * about its answers is only lying about which options it picked.
 *
 * Every attempt is written before the certification is touched, into an append
 * only table. A certification with no attempts behind it is a claim; with them
 * it is evidence, and the engineer who wants to know why somebody keeps missing
 * the deck attachment question can read it.
 */
export async function submitAttempt(
  actor: Actor & { email: string },
  serviceSlug: string,
  answers: Answer[],
  context: Context = {},
): Promise<{ ok: true; result: AttemptResult } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (actor.role !== "field_tech" && actor.role !== "admin") {
    return { ok: false, error: "Only a technician sits a protocol check." };
  }

  const view = await checkFor(actor, serviceSlug);
  if (!view) return { ok: false, error: "There is no published protocol for that service line." };
  if (!view.attemptable.ok) return { ok: false, error: view.attemptable.reason };
  if (view.questions.length === 0) {
    return {
      ok: false,
      error:
        "This protocol has no check questions yet, so there is nothing to be certified against. " +
        "The engineer who authored it adds them before a technician can certify.",
    };
  }

  const questions = await questionsWithKey(view.templateId);
  const grade = gradeAttempt(questions, answers);

  await db.from("eng_certification_attempts").insert({
    profile_id: actor.id,
    template_id: view.templateId,
    service_slug: serviceSlug,
    score: grade.score,
    passed: grade.passed,
    answers,
    wrong_question_ids: grade.wrong.map((w) => w.questionId),
  });

  const attempts = (view.certification?.attempts ?? 0) + 1;
  await db.from("eng_certifications").upsert(
    {
      profile_id: actor.id,
      service_slug: serviceSlug,
      template_id: view.templateId,
      status: grade.passed ? "certified" : "failed",
      score: grade.score,
      attempts,
      certified_at: grade.passed ? new Date().toISOString() : null,
    },
    { onConflict: "profile_id,service_slug" },
  );

  if (grade.passed) {
    /*
     * The profile's summary flag follows the certifications rather than being
     * set independently. Two places that both claim to say whether somebody is
     * certified is two places that will disagree.
     */
    await db.from("eng_profiles").update({ certification_status: "certified" }).eq("id", actor.id);
  }

  await writeAudit({
    actor,
    action: grade.passed ? "certification.pass" : "certification.fail",
    entityType: "profile",
    entityId: actor.id,
    summary: `${serviceSlug}: ${grade.correct} of ${grade.total} on attempt ${attempts}`,
    ...context,
  });

  return {
    ok: true,
    result: {
      passed: grade.passed,
      score: grade.score,
      correct: grade.correct,
      total: grade.total,
      wrong: grade.wrong,
      unanswered: grade.unanswered,
    },
  };
}

/**
 * Withdraw a certification.
 *
 * An act by the engineer in responsible charge, and it does not come back by
 * retaking the check. ops-certification refuses an attempt on a revoked record
 * for exactly that reason.
 */
export async function revokeCertification(
  actor: Actor & { email: string },
  profileId: string,
  serviceSlug: string,
  reason: string,
  context: Context = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "protocols.publish")) {
    return { ok: false, error: "Only an engineer or an administrator can revoke a certification." };
  }
  if (!reason.trim()) {
    return { ok: false, error: "Say why. A revocation with no reason is one nobody can act on or reverse." };
  }

  const { error } = await db
    .from("eng_certifications")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("service_slug", serviceSlug);
  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actor,
    action: "certification.revoke",
    entityType: "profile",
    entityId: profileId,
    summary: `Revoked ${serviceSlug}: ${reason.trim()}`,
    ...context,
  });
  return { ok: true };
}

/** Restore a revoked certification, which is the same person deciding again. */
export async function restoreCertification(
  actor: Actor & { email: string },
  profileId: string,
  serviceSlug: string,
  context: Context = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "protocols.publish")) {
    return { ok: false, error: "Only an engineer or an administrator can restore a certification." };
  }
  const { error } = await db
    .from("eng_certifications")
    .update({ status: "failed", revoked_at: null })
    .eq("profile_id", profileId)
    .eq("service_slug", serviceSlug)
    .eq("status", "revoked");
  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actor,
    action: "certification.restore",
    entityType: "profile",
    entityId: profileId,
    summary: `Restored ${serviceSlug} to uncertified, so the check can be retaken`,
    ...context,
  });
  return { ok: true };
}
