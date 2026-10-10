import "server-only";
import { DB_NOW } from "./db-now";
import { supabaseAdmin } from "./supabase";
import { writeAudit } from "./ops-audit";
import { can, type Actor } from "./ops-authz";
import { todayInFirmCalendar } from "./firm-calendar";
import {
  CREDENTIAL_LABEL,
  EXPIRING_KINDS,
  REQUIRED_FOR_DISPATCH,
  exemptKindsFor,
  type CredentialKind,
  type CredentialStatus,
} from "./ops-credentials";

/**
 * A TECHNICIAN SUBMITS A CREDENTIAL; AN OPERATOR VERIFIES IT. Operator ruling of
 * 2026-10-09 (fix/certification-unblock), approving a behaviour change on
 * /portal/certification.
 *
 * WHAT A SUBMISSION IS. The type, the issuing state and the expiry date, and
 * nothing else: no number, no image, no document. The standing rule is that a
 * credential is a record, never a document. A submission is written as status
 * "pending", which the screens call "Submitted, awaiting verification".
 *
 * DISPATCH IS UNCHANGED. It counts only verified, current credentials, through
 * credentialStanding, exactly as before; a submission moves nothing until an
 * operator verifies it on /portal/techs, which records who and when.
 *
 * WHICH FIELDS APPLY TO WHICH KIND, and it is a judgment recorded rather than
 * hidden. The four kinds dispatch requires are a driver license, vehicle
 * insurance, Form W-9 and the independent contractor agreement. A license and
 * an insurance policy have an issuing state and expire; a W-9 and the
 * agreement have neither, and are signed documents the firm holds itself. So
 * the state is asked only of the two that have one, the expiry only of the
 * kinds that expire (EXPIRING_KINDS), and for the other two a submission says
 * "I have provided this", which the operator's verification confirms.
 */

/** The kinds that carry an issuing state. */
export const STATE_ISSUED_KINDS: CredentialKind[] = ["drivers_license", "vehicle_insurance"];

/** The fifty states and the District of Columbia, as postal codes. 0066 holds the column to two capitals. */
export const US_STATES: { code: string; name: string }[] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"],
  ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"],
  ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
  ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"],
  ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"],
  ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
  ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
  ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
].map(([code, name]) => ({ code, name }));

/** What the form asks for each kind a technician can submit. */
export type SubmittableKind = { kind: CredentialKind; label: string; asksState: boolean; asksExpiry: boolean };

export function submittableKindsFor(email: string | null | undefined): SubmittableKind[] {
  const exempt = exemptKindsFor(email);
  return REQUIRED_FOR_DISPATCH.filter((k) => !exempt.includes(k)).map((kind) => ({
    kind,
    label: CREDENTIAL_LABEL[kind],
    asksState: STATE_ISSUED_KINDS.includes(kind),
    asksExpiry: EXPIRING_KINDS.includes(kind),
  }));
}

type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };
/** What requestContext() gives, passed through to the audit row. */
type Context = { ip?: string | null; userAgent?: string | null };

/** A technician's own submission. */
export async function submitCredential(
  actor: Actor & { email?: string },
  input: { kind: string; issuingState?: string | null; expiresOn?: string | null },
  context: Context = {},
): Promise<Result<{ id: string }>> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "evidence.capture")) return { ok: false, error: "Only a technician submits their own credentials." };

  const kinds = submittableKindsFor(actor.email);
  const asked = kinds.find((k) => k.kind === input.kind);
  if (!asked) return { ok: false, error: "That is not a credential dispatch asks you for." };

  const state = (input.issuingState ?? "").trim().toUpperCase() || null;
  if (asked.asksState) {
    if (!state || !US_STATES.some((s) => s.code === state)) {
      return { ok: false, error: `Choose the state that issued your ${asked.label.toLowerCase()}.` };
    }
  } else if (state) {
    return { ok: false, error: `A ${asked.label} has no issuing state.` };
  }

  const expiresOn = (input.expiresOn ?? "").trim() || null;
  if (asked.asksExpiry) {
    if (!expiresOn || !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) {
      return { ok: false, error: `Enter the expiry date on your ${asked.label.toLowerCase()}.` };
    }
    /* Refused, not stored as already lapsed: a submission that would expire before anybody can verify it opens nothing. */
    if (expiresOn < todayInFirmCalendar()) {
      return { ok: false, error: `That date has passed. An expired ${asked.label.toLowerCase()} cannot be submitted; submit the current one.` };
    }
  } else if (expiresOn) {
    return { ok: false, error: `A ${asked.label} does not expire, so it takes no expiry date.` };
  }

  const { data: waiting } = await db
    .from("eng_credentials")
    .select("id")
    .eq("profile_id", actor.id)
    .eq("kind", asked.kind)
    .eq("status", "pending")
    .limit(1);
  if ((waiting ?? []).length > 0) {
    return { ok: false, error: `Your ${asked.label.toLowerCase()} is already submitted and awaiting verification.` };
  }

  const { data: inserted, error } = await db
    .from("eng_credentials")
    .insert({ profile_id: actor.id, kind: asked.kind, issuing_state: state, expires_on: expiresOn, status: "pending", label: null })
    .select("id")
    .single();
  /*
   * Two submissions in flight together both pass the read above. 0067's unique
   * partial index refuses the second (23505), and it gets the same sentence the
   * read gives, rather than a database message. Product audit, 2026-10-09.
   */
  if (error?.code === "23505") {
    return { ok: false, error: `Your ${asked.label.toLowerCase()} is already submitted and awaiting verification.` };
  }
  if (error || !inserted) return { ok: false, error: error?.message ?? "The submission was not recorded." };

  await writeAudit({
    actor,
    action: "credential.submitted",
    entityType: "profile",
    entityId: actor.id,
    summary: `Submitted ${asked.label}${state ? `, issued in ${state}` : ""}${expiresOn ? `, expires ${expiresOn}` : ""}, awaiting verification`,
    diff: { credential_id: { from: null, to: inserted.id }, kind: { from: null, to: asked.kind }, status: { from: null, to: "pending" } },
    ...context,
  });
  return { ok: true, id: inserted.id as string };
}

async function decide(
  actor: Actor,
  credentialId: string,
  to: "verified" | "rejected",
  reason: string | null,
  context: Context,
): Promise<Result> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "profiles.update")) return { ok: false, error: "Your role cannot verify credentials." };

  const { data: row } = await db
    .from("eng_credentials")
    .select("id, profile_id, kind, status, expires_on")
    .eq("id", credentialId)
    .maybeSingle();
  if (!row) return { ok: false, error: "That submission does not exist." };
  if (row.status !== "pending") return { ok: false, error: `That submission is already ${row.status}.` };
  if (to === "verified" && row.expires_on && (row.expires_on as string) < todayInFirmCalendar()) {
    return { ok: false, error: "It expired before it was verified. Reject it so the technician submits the current one." };
  }

  const patch =
    to === "verified"
      ? { status: "verified", verified_at: DB_NOW, verified_by: actor.id }
      : { status: "rejected", reject_reason: reason };
  /* Guarded on status, so two operators acting at once cannot both decide it. */
  const { data: changed, error } = await db
    .from("eng_credentials")
    .update(patch)
    .eq("id", credentialId)
    .eq("status", "pending")
    .select("id");
  if (error) return { ok: false, error: error.message };
  if ((changed ?? []).length !== 1) return { ok: false, error: "Somebody else decided it first. Reload the list." };

  const label = CREDENTIAL_LABEL[row.kind as CredentialKind] ?? String(row.kind);
  await writeAudit({
    actor,
    action: to === "verified" ? "credential.verified" : "credential.rejected",
    entityType: "profile",
    entityId: row.profile_id as string,
    summary: to === "verified" ? `Verified ${label}` : `Rejected ${label}: ${reason}`,
    diff: { credential_id: { from: null, to: credentialId }, status: { from: "pending", to } },
    ...context,
  });
  return { ok: true };
}

/** One action, recording who verified it and when. */
export function verifyCredential(actor: Actor, credentialId: string, context: Context = {}) {
  return decide(actor, credentialId, "verified", null, context);
}

/** Reject with a reason the technician sees on their certification screen. */
export function rejectCredential(actor: Actor, credentialId: string, reason: string, context: Context = {}) {
  const r = (reason ?? "").trim();
  if (r.length < 10) {
    return Promise.resolve({ ok: false as const, error: "Say why, in a sentence the technician can act on. They read it on their screen." });
  }
  return decide(actor, credentialId, "rejected", r, context);
}

export type SubmissionRow = {
  id: string;
  profileId: string;
  kind: CredentialKind;
  label: string;
  issuingState: string | null;
  expiresOn: string | null;
  status: CredentialStatus;
  submittedAt: string;
  verifiedAt: string | null;
  rejectReason: string | null;
};

const toRow = (r: Record<string, unknown>): SubmissionRow => ({
  id: r.id as string,
  profileId: r.profile_id as string,
  kind: r.kind as CredentialKind,
  label: CREDENTIAL_LABEL[r.kind as CredentialKind] ?? String(r.kind),
  issuingState: (r.issuing_state as string | null) ?? null,
  expiresOn: (r.expires_on as string | null) ?? null,
  status: r.status as CredentialStatus,
  submittedAt: r.created_at as string,
  verifiedAt: (r.verified_at as string | null) ?? null,
  rejectReason: (r.reject_reason as string | null) ?? null,
});

const COLUMNS = "id, profile_id, kind, issuing_state, expires_on, status, created_at, verified_at, reject_reason";

/** A technician's own credential rows, newest first. */
export async function submissionsFor(profileId: string): Promise<SubmissionRow[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data } = await db.from("eng_credentials").select(COLUMNS).eq("profile_id", profileId).order("created_at", { ascending: false });
  return (data ?? []).map(toRow);
}

/** Every submission awaiting verification, oldest first, with who submitted it. */
export async function awaitingVerification(): Promise<(SubmissionRow & { name: string })[] | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.from("eng_credentials").select(COLUMNS).eq("status", "pending").order("created_at", { ascending: true }).limit(200);
  if (error) return null;
  const rows = (data ?? []).map(toRow);
  const ids = [...new Set(rows.map((r) => r.profileId))];
  const { data: people } = ids.length
    ? await db.from("eng_profiles").select("id, display_name, email").in("id", ids)
    : { data: [] };
  const nameOf = new Map((people ?? []).map((p) => [p.id as string, (p.display_name as string | null) ?? (p.email as string)]));
  return rows.map((r) => ({ ...r, name: nameOf.get(r.profileId) ?? "A technician" }));
}
