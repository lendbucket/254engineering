import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { DB_NOW } from "./db-now";
import { can, type Actor } from "./ops-authz";
import { writeAuditOrRefuse } from "./ops-audit";
import { readEvery, readEveryIn } from "./bounded-read";
import { todayInFirmCalendar } from "./firm-calendar";
import { standingFor } from "./academy-record";
import {
  CERTIFICATE_KINDS,
  onboardingSteps,
  type CertificateKind,
  type OnboardingFacts,
  type OnboardingStep,
} from "./franchisee-onboarding-rules";

/**
 * FRANCHISEE ONBOARDING (0128). Robert's overnight orders of 2026-11-10,
 * platform item X4. franchise.manage, which only admin holds, like the rest of
 * the franchisee record (0126).
 *
 * Two facts are RECORDED here: the day the agreement was signed, and the
 * franchisee's certificates of insurance, each PDF stored first in the private
 * eng-franchisee-certificates bucket with its SHA-256. Two are READ from what
 * the platform already keeps: each owner's academy standing (0106) and each
 * technician's certifications (the engineer's sign off, which dispatch already
 * requires per line). franchisees.ts asks onboardingStepsFor before it lets a
 * franchisee move from onboarding to operating.
 */

export const FRANCHISEE_CERTIFICATE_BUCKET = "eng-franchisee-certificates";
export const FRANCHISEE_CERTIFICATE_MAX_BYTES = 10 * 1024 * 1024;

const refuse = (error: string) => ({ ok: false as const, error });
const NOT_ALLOWED = "Only an administrator keeps the franchisee record.";
type Db = NonNullable<ReturnType<typeof supabaseAdmin>>;

const keeper = (actor: Actor | null): Actor | null => (actor && can(actor, "franchise.manage") ? actor : null);
const isPdf = (bytes: Uint8Array) =>
  bytes.length > 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export type FranchiseeCertificate = {
  id: string;
  kind: CertificateKind;
  carrier: string;
  policyNumber: string;
  effectiveOn: string;
  expiresOn: string;
  recordedAt: string;
  withdrawnAt: string | null;
  withdrawnReason: string | null;
};

export type Onboarding = {
  agreementSignedOn: string | null;
  certificates: FranchiseeCertificate[];
  steps: OnboardingStep[];
};

/** Reads every fact the four steps are decided from. Used by the screen and by the status change alike. */
export async function onboardingStepsFor(db: Db, franchiseeId: string): Promise<{ ok: true; onboarding: Onboarding } | { ok: false; error: string }> {
  const f = await db.from("eng_franchisees").select("agreement_signed_on").eq("id", franchiseeId).maybeSingle();
  if (f.error) return refuse(`The agreement could not be read: ${f.error.message}`);
  if (!f.data) return refuse("That franchisee is not on record.");

  const certs = await readEvery<{
    id: string; kind: string; carrier: string; policy_number: string; effective_on: string; expires_on: string;
    created_at: string; withdrawn_at: string | null; withdrawn_reason: string | null;
  }>((from, to) =>
    db
      .from("eng_franchisee_certificates")
      .select("id, kind, carrier, policy_number, effective_on, expires_on, created_at, withdrawn_at, withdrawn_reason")
      .eq("franchisee_id", franchiseeId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (!certs.ok) return refuse(`Its certificates could not be read: ${certs.error}`);

  const members = await readEvery<{ profile_id: string }>((from, to) =>
    db.from("eng_franchisee_members").select("profile_id").eq("franchisee_id", franchiseeId).is("ended_at", null).order("profile_id", { ascending: true }).range(from, to),
  );
  if (!members.ok) return refuse(`Its people could not be read: ${members.error}`);
  const ids = members.rows.map((m) => String(m.profile_id));
  const profiles = await readEveryIn<{ id: string; display_name: string | null; email: string | null; role: string }>(ids, (chunk, from, to) =>
    db.from("eng_profiles").select("id, display_name, email, role").in("id", [...chunk]).order("id", { ascending: true }).range(from, to),
  );
  if (!profiles.ok) return refuse(`Its people could not be read: ${profiles.error}`);
  const nameOf = (p: { display_name: string | null; email: string | null }) => p.display_name?.trim() || p.email || "A person with no name on file";

  /* The owners' academy standing, through each owner's latest onboarding (0106 keys attempts by onboarding). */
  const owners = profiles.rows.filter((p) => p.role === "franchisee_owner");
  const onboardings = await readEveryIn<{ id: string; profile_id: string }>(owners.map((o) => String(o.id)), (chunk, from, to) =>
    db.from("eng_onboardings").select("id, profile_id").in("profile_id", [...chunk]).order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to),
  );
  if (!onboardings.ok) return refuse(`The owners' onboarding could not be read: ${onboardings.error}`);
  const latest = new Map<string, string>();
  for (const o of onboardings.rows) latest.set(String(o.profile_id), String(o.id));
  const ownerFacts: OnboardingFacts["owners"][number][] = [];
  for (const o of owners) {
    const onboardingId = latest.get(String(o.id));
    if (!onboardingId) {
      ownerFacts.push({ name: nameOf(o), graduated: false });
      continue;
    }
    const standing = await standingFor(onboardingId);
    if (!standing.ok) return refuse(`An owner's academy standing could not be read: ${standing.error}`);
    ownerFacts.push({ name: nameOf(o), graduated: standing.graduated });
  }

  /* The technicians' certifications, the rows dispatch reads (ops-field.ts), status certified. */
  const techs = profiles.rows.filter((p) => p.role === "field_tech");
  const certified = await readEveryIn<{ profile_id: string; service_slug: string }>(techs.map((t) => String(t.id)), (chunk, from, to) =>
    db.from("eng_certifications").select("profile_id, service_slug").in("profile_id", [...chunk]).eq("status", "certified").order("profile_id", { ascending: true }).range(from, to),
  );
  if (!certified.ok) return refuse(`Its technicians' certifications could not be read: ${certified.error}`);
  const lines = new Map<string, Set<string>>();
  for (const c of certified.rows) lines.set(String(c.profile_id), (lines.get(String(c.profile_id)) ?? new Set()).add(String(c.service_slug)));

  const certificates: FranchiseeCertificate[] = certs.rows.map((c) => ({
    id: String(c.id),
    kind: c.kind as CertificateKind,
    carrier: String(c.carrier),
    policyNumber: String(c.policy_number),
    effectiveOn: String(c.effective_on),
    expiresOn: String(c.expires_on),
    recordedAt: String(c.created_at),
    withdrawnAt: c.withdrawn_at,
    withdrawnReason: c.withdrawn_reason,
  }));
  const agreementSignedOn = f.data.agreement_signed_on ? String(f.data.agreement_signed_on) : null;
  const steps = onboardingSteps({
    today: todayInFirmCalendar(),
    agreementSignedOn,
    certificates: certificates.map((c) => ({ kind: c.kind, effectiveOn: c.effectiveOn, expiresOn: c.expiresOn, withdrawn: c.withdrawnAt !== null })),
    owners: ownerFacts,
    technicians: techs.map((t) => ({ name: nameOf(t), certifiedLines: lines.get(String(t.id))?.size ?? 0 })),
  });
  return { ok: true, onboarding: { agreementSignedOn, certificates, steps } };
}

export async function onboardingFor(actor: Actor | null, franchiseeId: string): Promise<{ ok: true; onboarding: Onboarding } | { ok: false; error: string }> {
  if (!keeper(actor)) return refuse(NOT_ALLOWED);
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so onboarding could not be read.");
  return onboardingStepsFor(db, franchiseeId);
}

/** Records the day the franchise agreement was signed. Once: a wrong day is corrected by an administrator in a sitting, not over the screen. */
export async function recordAgreement(actor: Actor | null, input: { id: string; signedOn: string }): Promise<{ ok: true; said: string } | { ok: false; error: string }> {
  const a = keeper(actor);
  if (!a) return refuse(NOT_ALLOWED);
  const day = input.signedOn.trim();
  if (!isDay(day)) return refuse("Give the day the agreement was signed, as a date.");
  if (day > todayInFirmCalendar()) return refuse("That day has not come yet. Record the agreement once it is signed.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was recorded.");
  const { data: row, error: readError } = await db.from("eng_franchisees").select("legal_name, agreement_signed_on").eq("id", input.id).maybeSingle();
  if (readError) return refuse(`The franchisee could not be read: ${readError.message}`);
  if (!row) return refuse("That franchisee is not on record.");
  if (row.agreement_signed_on) return refuse(`The agreement is already recorded as signed ${String(row.agreement_signed_on)}.`);
  const recorded = await writeAuditOrRefuse({
    actor: a,
    action: "franchisee.agreement_recorded",
    entityType: "franchisee",
    entityId: input.id,
    summary: `${String(row.legal_name)}: franchise agreement recorded as signed ${day}.`,
    diff: { agreement_signed_on: day },
  });
  if (!recorded.ok) return recorded;
  /* Only while none is recorded, so two people recording at once cannot both win. */
  const { data, error } = await db
    .from("eng_franchisees")
    .update({ agreement_signed_on: day, agreement_recorded_by: a.id, agreement_recorded_at: DB_NOW, updated_at: DB_NOW })
    .eq("id", input.id)
    .is("agreement_signed_on", null)
    .select("id");
  if (error) return refuse(`The agreement could not be recorded: ${error.message}`);
  if (!data?.length) return refuse("Somebody recorded the agreement a moment ago. Reload and look again.");
  return { ok: true, said: `Agreement recorded as signed ${day}.` };
}

export type CertificateInput = { franchiseeId: string; kind: string; carrier: string; policyNumber: string; effectiveOn: string; expiresOn: string };

/** Records a certificate from its PDF. The file is stored first; a row that cannot be written removes it again. The audit row is written by 0128's trigger in the same transaction. */
export async function recordCertificate(actor: Actor | null, input: CertificateInput, pdf: Uint8Array): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const a = keeper(actor);
  if (!a) return refuse(NOT_ALLOWED);
  if (!(CERTIFICATE_KINDS as readonly string[]).includes(input.kind)) return refuse("Choose what the certificate covers.");
  if (!input.carrier.trim()) return refuse("Name the carrier on the certificate.");
  if (!input.policyNumber.trim()) return refuse("Give the policy number on the certificate.");
  if (!isDay(input.effectiveOn) || !isDay(input.expiresOn)) return refuse("Give the dates the certificate is in force.");
  if (input.expiresOn <= input.effectiveOn) return refuse("The certificate has to expire after it takes effect.");
  if (pdf.length === 0) return refuse("Attach the certificate of insurance as a PDF.");
  if (pdf.length > FRANCHISEE_CERTIFICATE_MAX_BYTES) return refuse("That certificate is over 10 MB. Send the carrier's PDF as issued.");
  if (!isPdf(pdf)) return refuse("The certificate must be a PDF.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was recorded.");
  const { data: f, error: fError } = await db.from("eng_franchisees").select("id, status").eq("id", input.franchiseeId).maybeSingle();
  if (fError) return refuse(`The franchisee could not be read: ${fError.message}`);
  if (!f) return refuse("That franchisee is not on record.");
  if (f.status === "ended") return refuse("This franchisee has ended, so nothing more is recorded for it.");

  const sha256 = createHash("sha256").update(pdf).digest("hex");
  const key = `${input.franchiseeId}/${randomUUID()}.pdf`;
  const { error: uploadError } = await db.storage.from(FRANCHISEE_CERTIFICATE_BUCKET).upload(key, pdf, { contentType: "application/pdf", upsert: false });
  if (uploadError) return refuse(`The certificate could not be stored, so nothing was recorded (${uploadError.message}).`);
  const { data, error } = await db
    .from("eng_franchisee_certificates")
    .insert({
      franchisee_id: input.franchiseeId,
      kind: input.kind,
      carrier: input.carrier.trim(),
      policy_number: input.policyNumber.trim(),
      effective_on: input.effectiveOn,
      expires_on: input.expiresOn,
      certificate_key: key,
      certificate_sha256: sha256,
      certificate_bytes: pdf.length,
      recorded_by: a.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    const { error: removeError } = await db.storage.from(FRANCHISEE_CERTIFICATE_BUCKET).remove([key]);
    return refuse(
      `The certificate was not recorded (${error?.message ?? "no row came back"})${
        removeError ? `, and its file could not be removed again (${removeError.message}); tell the operator the key ${key}` : ""
      }.`,
    );
  }
  return { ok: true, id: String(data.id) };
}

/** Withdraws a certificate with a reason. The row is kept as it was; 0128's trigger writes the audit row. */
export async function withdrawCertificate(actor: Actor | null, id: string, reason: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const a = keeper(actor);
  if (!a) return refuse(NOT_ALLOWED);
  const why = reason.trim();
  if (why.length < 3) return refuse("Say why the certificate is withdrawn. The reason is kept with it.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was changed.");
  const { data, error } = await db
    .from("eng_franchisee_certificates")
    .update({ withdrawn_at: DB_NOW, withdrawn_by: a.id, withdrawn_reason: why })
    .eq("id", id)
    .is("withdrawn_at", null)
    .select("id");
  if (error) return refuse(`The certificate could not be withdrawn: ${error.message}`);
  if (!data?.length) return refuse("That certificate is not on record, or it is already withdrawn.");
  return { ok: true };
}

/** A five minute link to a certificate's PDF, for an administrator. */
export async function franchiseeCertificateLink(actor: Actor | null, id: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!keeper(actor)) return refuse(NOT_ALLOWED);
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured.");
  const { data, error } = await db.from("eng_franchisee_certificates").select("certificate_key").eq("id", id).maybeSingle();
  if (error) return refuse(`The certificate could not be read (${error.message}).`);
  if (!data) return refuse("That certificate is not on record.");
  const { data: signed, error: signError } = await db.storage.from(FRANCHISEE_CERTIFICATE_BUCKET).createSignedUrl(String(data.certificate_key), 300);
  if (signError || !signed?.signedUrl) return refuse(`The certificate could not be opened (${signError?.message ?? "no link came back"}).`);
  return { ok: true, url: signed.signedUrl };
}
