import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, holdsLicence, licenceRefusal, type Actor } from "./ops-authz";
import { DB_NOW } from "./db-now";
import { verifiedEngineers } from "@/config/credentials";
import { licenceIsCurrent } from "./launch";

/**
 * ===========================================================================
 * A CERTIFICATION FROM SUPERVISED TRAINING WAITS FOR THE ENGINEER.
 * ===========================================================================
 *
 * Operator ruling of 2026-10-07. An administrator records it, naming the
 * protocol version, the training date and who supervised. It counts for
 * dispatch only once the engineer of record approves it in the portal from his
 * own session. Until then the screen shows it as awaiting the engineer and
 * dispatch refuses. A refusal needs a reason and is audited. Robert's existing
 * roof certification, written in the sitting of 2026-10-07 on his ruling and
 * Aman's written acceptance of 2026-09-21, stands as it is: nothing here
 * touches a certification that already exists.
 *
 * WHERE THE RECORD LIVES, AND WHY NOT A NEW TABLE. Interim decision of the
 * overnight run of 2026-10-07, for the operator's review (rulings-2026-10-06.md
 * section 9). A dedicated table needs a migration, a migration branch cannot
 * merge overnight, and development cannot be migrated by the session, so the
 * proof could not run. Each step is instead an append-only event in
 * eng_audit_events under its own exact name:
 *
 *   certification.training_recorded   by an administrator, with the details
 *   certification.training_approved   by the engineer of record, naming the record
 *   certification.training_refused    by the engineer of record, with his reason
 *
 * "Awaiting the engineer" is a recorded event with no decision naming it. No
 * existing status word is borrowed for it: eng_certifications has no word for
 * awaiting approval, and in_progress would say a technician is part way through
 * the check, which is the nearest lie. eng_certifications gets a `certified`
 * row only on approval, so dispatch, which reads that table, is unchanged and
 * refuses everything before it. The table's own trigger refuses edits and
 * deletes, so none of the three can be rewritten.
 */

export const TRAINING_RECORDED = "certification.training_recorded";
export const TRAINING_APPROVED = "certification.training_approved";
export const TRAINING_REFUSED = "certification.training_refused";

type Context = { ip?: string | null; userAgent?: string | null };

export type TrainingRecord = {
  id: number;
  recordedAt: string;
  recordedBy: string | null;
  profileId: string;
  serviceSlug: string;
  templateId: string;
  protocolVersion: string;
  trainedOn: string;
  supervisedBy: string;
  status: "awaiting_engineer" | "approved" | "refused";
  decidedAt: string | null;
  decidedBy: string | null;
  refusalReason: string | null;
};

/** The event, written directly so its id comes back: a state record must not fail silently. */
async function appendEvent(
  actor: Actor & { email: string },
  action: string,
  profileId: string,
  summary: string,
  diff: Record<string, unknown>,
  context: Context,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const { data, error } = await db
    .from("eng_audit_events")
    .insert({
      actor_id: actor.id,
      actor_email: actor.email,
      actor_role: actor.role,
      action,
      entity_type: "profile",
      entity_id: profileId,
      summary,
      diff,
      ip: context.ip ?? null,
      user_agent: context.userAgent ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "The record was not written." };
  return { ok: true, id: Number(data.id) };
}

/** Every training record, with its decision folded in. Optionally for one technician. A failed read is null. */
export async function trainingRecords(profileId?: string): Promise<TrainingRecord[] | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  let q = db
    .from("eng_audit_events")
    .select("id, created_at, actor_id, action, entity_id, diff")
    .eq("entity_type", "profile")
    .in("action", [TRAINING_RECORDED, TRAINING_APPROVED, TRAINING_REFUSED])
    .order("id", { ascending: true })
    .limit(2000);
  if (profileId) q = q.eq("entity_id", profileId);
  const { data, error } = await q;
  if (error) return null;

  const records = new Map<number, TrainingRecord>();
  for (const e of data ?? []) {
    const d = (e.diff ?? {}) as Record<string, unknown>;
    if (e.action === TRAINING_RECORDED) {
      records.set(Number(e.id), {
        id: Number(e.id),
        recordedAt: e.created_at as string,
        recordedBy: (e.actor_id as string | null) ?? null,
        profileId: e.entity_id as string,
        serviceSlug: String(d.service_slug ?? ""),
        templateId: String(d.template_id ?? ""),
        protocolVersion: String(d.protocol_version ?? ""),
        trainedOn: String(d.trained_on ?? ""),
        supervisedBy: String(d.supervised_by ?? ""),
        status: "awaiting_engineer",
        decidedAt: null,
        decidedBy: null,
        refusalReason: null,
      });
    } else {
      const rec = records.get(Number(d.record_id));
      // The first decision stands; decideTraining refuses a second, so a later one cannot exist by this path.
      if (rec && rec.status === "awaiting_engineer") {
        rec.status = e.action === TRAINING_APPROVED ? "approved" : "refused";
        rec.decidedAt = e.created_at as string;
        rec.decidedBy = (e.actor_id as string | null) ?? null;
        rec.refusalReason = e.action === TRAINING_REFUSED ? String(d.reason ?? "") : null;
      }
    }
  }
  return [...records.values()].reverse();
}

/** A technician's certifications as dispatch reads them: the eng_certifications rows. Null on a failed read. */
export async function certificationsFor(
  profileId: string,
): Promise<{ serviceSlug: string; status: string; certifiedAt: string | null }[] | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("eng_certifications")
    .select("service_slug, status, certified_at")
    .eq("profile_id", profileId)
    .order("service_slug");
  if (error) return null;
  return (data ?? []).map((c) => ({
    serviceSlug: c.service_slug as string,
    status: c.status as string,
    certifiedAt: (c.certified_at as string | null) ?? null,
  }));
}

/** The service lines a training can be recorded for: each with its published protocol. */
export async function trainableLines(): Promise<{ serviceSlug: string; templateId: string; documentNumber: string; version: string }[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from("eng_protocol_templates")
    .select("id, service_slug, document_number, version_label")
    .eq("status", "published");
  return (data ?? []).map((t) => ({
    serviceSlug: t.service_slug as string,
    templateId: t.id as string,
    documentNumber: (t.document_number as string | null) ?? "",
    version: (t.version_label as string | null) ?? "",
  }));
}

/** An administrator records supervised training. It counts for nothing until the engineer approves it. */
export async function recordTraining(
  actor: (Actor & { email: string }) | null,
  profileId: string,
  input: { serviceSlug: string; trainedOn: string; supervisedBy: string },
  context: Context = {},
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  if (!actor || !can(actor, "profiles.update")) return { ok: false, error: "Your role cannot record a certification." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.trainedOn)) return { ok: false, error: "The training date must be a calendar date." };
  const supervisedBy = input.supervisedBy.trim();
  if (supervisedBy.length < 3) return { ok: false, error: "Name who supervised the training." };

  const { data: person } = await db.from("eng_profiles").select("id, role").eq("id", profileId).maybeSingle();
  if (!person || person.role !== "field_tech") return { ok: false, error: "A certification is recorded for a technician." };

  const line = (await trainableLines()).find((l) => l.serviceSlug === input.serviceSlug);
  if (!line) return { ok: false, error: "That service line has no protocol in force to be trained on." };

  const { data: existing } = await db
    .from("eng_certifications")
    .select("status")
    .eq("profile_id", profileId)
    .eq("service_slug", input.serviceSlug)
    .maybeSingle();
  if (existing?.status === "certified") return { ok: false, error: "He is already certified for that line." };

  const records = await trainingRecords(profileId);
  if (records === null) return { ok: false, error: "The existing records could not be read, so nothing was recorded." };
  if (records.some((r) => r.serviceSlug === input.serviceSlug && r.status === "awaiting_engineer")) {
    return { ok: false, error: "A training for that line is already awaiting the engineer." };
  }

  return appendEvent(
    actor,
    TRAINING_RECORDED,
    profileId,
    `Recorded supervised training on ${line.documentNumber} v${line.version}, ${input.trainedOn}, supervised by ${supervisedBy}. Awaiting the engineer.`,
    {
      service_slug: input.serviceSlug,
      template_id: line.templateId,
      protocol_document: line.documentNumber,
      protocol_version: line.version,
      trained_on: input.trainedOn,
      supervised_by: supervisedBy,
      status: { from: null, to: "awaiting_engineer" },
    },
    context,
  );
}

/** Training records awaiting the engineer, for his screen. */
export async function trainingAwaitingEngineer(): Promise<
  { ok: true; records: (TrainingRecord & { technician: string })[] } | { ok: false; error: string }
> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const records = await trainingRecords();
  if (records === null) return { ok: false, error: "The training records could not be read." };
  const waiting = records.filter((r) => r.status === "awaiting_engineer");
  const ids = [...new Set(waiting.map((r) => r.profileId))];
  /*
   * Only technicians who still exist and are active. A record outlives its
   * profile (the event table keeps everything), and approving one for a
   * removed or suspended account would certify nobody, or the wrong state.
   */
  const names = new Map<string, string>();
  if (ids.length) {
    const { data, error } = await db
      .from("eng_profiles")
      .select("id, display_name")
      .in("id", ids)
      .eq("role", "field_tech")
      .eq("status", "active");
    if (error) return { ok: false, error: `The technicians could not be read: ${error.message}` };
    for (const p of data ?? []) names.set(p.id as string, p.display_name as string);
  }
  return {
    ok: true,
    records: waiting.filter((r) => names.has(r.profileId)).map((r) => ({ ...r, technician: names.get(r.profileId) as string })),
  };
}

/**
 * The engineer of record's decision, from his own session: the engineer role,
 * active, and a license the register holds as current, the same test protocol
 * approval applies. Approval writes the certification dispatch reads; refusal
 * needs his reason and writes nothing else.
 */
export async function decideTraining(
  actor: (Actor & { email: string }) | null,
  recordId: number,
  decision: "approve" | "refuse",
  reason: string,
  context: Context = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!actor || !holdsLicence(actor, "protocols.publish")) return { ok: false, error: licenceRefusal("Approving a certification") };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const { data: me } = await db.from("eng_profiles").select("license_number").eq("id", actor.id).maybeSingle();
  const licence = ((me?.license_number as string | null) ?? "").trim();
  const onRegister = licence ? verifiedEngineers.find((e) => e.licenseNumber === licence) ?? null : null;
  if (!onRegister) {
    return { ok: false, error: "Only the engineer of record approves a certification, and your license is not the one the register holds." };
  }
  if (!licenceIsCurrent(onRegister.expires, new Date().toISOString().slice(0, 10))) {
    return { ok: false, error: `The register has no current expiry for license ${licence}.` };
  }

  const records = await trainingRecords();
  if (records === null) return { ok: false, error: "The training records could not be read, so nothing was decided." };
  const rec = records.find((r) => r.id === recordId);
  if (!rec) return { ok: false, error: "That training record does not exist." };
  if (rec.status !== "awaiting_engineer") return { ok: false, error: `That training was already ${rec.status}.` };
  const { data: person } = await db.from("eng_profiles").select("role, status").eq("id", rec.profileId).maybeSingle();
  if (!person || person.role !== "field_tech" || person.status !== "active") {
    return { ok: false, error: "That technician's account is not active, so there is nobody to certify." };
  }

  const written = reason.trim();
  if (decision === "refuse" && written.length < 10) {
    return { ok: false, error: "A refusal needs your reason, in your words." };
  }

  if (decision === "approve") {
    const { error } = await db.from("eng_certifications").upsert(
      {
        profile_id: rec.profileId,
        service_slug: rec.serviceSlug,
        template_id: rec.templateId,
        status: "certified",
        certified_at: DB_NOW,
        revoked_at: null,
      },
      { onConflict: "profile_id,service_slug" },
    );
    if (error) return { ok: false, error: `The certification was not written: ${error.message}` };
    await db.from("eng_profiles").update({ certification_status: "certified" }).eq("id", rec.profileId).eq("role", "field_tech");
  }

  const event = await appendEvent(
    actor,
    decision === "approve" ? TRAINING_APPROVED : TRAINING_REFUSED,
    rec.profileId,
    decision === "approve"
      ? `Approved supervised training on ${rec.protocolVersion ? `v${rec.protocolVersion}` : "the protocol"} recorded ${rec.trainedOn}. Certified for dispatch.`
      : `Refused supervised training recorded ${rec.trainedOn}: ${written}`,
    {
      record_id: rec.id,
      service_slug: rec.serviceSlug,
      status: { from: "awaiting_engineer", to: decision === "approve" ? "approved" : "refused" },
      ...(decision === "refuse" ? { reason: written } : {}),
    },
    context,
  );
  if (!event.ok) {
    return { ok: false, error: decision === "approve" ? `Certified, and the approval was not recorded: ${event.error}` : event.error };
  }
  return { ok: true };
}
