import "server-only";
import { DB_NOW } from "./db-now";
import { supabaseAdmin } from "./supabase";
import { writeAudit, writeAuditOrRefuse } from "./ops-audit";
import type { Actor } from "./ops-authz";
import { mayOnboardRole, onboardingRole } from "./onboarding-scope";
import {
  VERIFICATION_COLUMNS,
  documentTypeLabel,
  isKnownDocumentType,
  type VerificationCheck,
  type VerificationRecord,
} from "./onboarding-verification";

/**
 * The two checks federal and practical procedure require a person to perform.
 *
 * Identity confirmation on a live call, and I-9 Section 2 document examination.
 * Neither can be satisfied by anything the person being onboarded uploads, which
 * is exactly why they are recorded here by the operator rather than derived from
 * the checklist.
 *
 * RESTORED ON /portal/onboarding BY ROBERT'S RULING P1, 2026-11-01. This file
 * had no importer from 2026-09-06, when the /admin screens were deleted, until
 * then. The ruling also widened what is recorded: "the admin records
 * 'verified', the document type seen, who and when. No copy of any ID or I-9
 * is stored." So each check is three facts written together (0105 refuses a
 * partial one): the time, the document type from a fixed list, and the
 * profile who saw it. There is no number, no expiry and no image anywhere.
 *
 * CORRECTING IS ALLOWED AND IT CLEARS ALL THREE
 * ---------------------------------------------
 * An operator who records the wrong row needs to be able to correct it, and a
 * record that cannot be corrected gets worked around instead. Clearing needs a
 * reason, writes its audit row first, and nulls the three facts together.
 *
 * WHO MAY: the same test as editing the onboarding, mayOnboardRole with
 * profiles.update, so the operations manager records a technician's identity
 * and never an engineer's.
 */

type Context = { ip?: string | null; userAgent?: string | null };
type Fail = { ok: false; error: string };

const CHECK_WORDS: Record<VerificationCheck, string> = {
  identity: "Identity confirmation",
  i9: "I-9 document examination",
};

async function guard(actor: Actor | null, onboardingId: string, check: VerificationCheck): Promise<Fail | { ok: true; role: string }> {
  if (check !== "identity" && check !== "i9") return { ok: false, error: "That is not a verification step." };
  const role = await onboardingRole(onboardingId);
  if (!role) return { ok: false, error: "That onboarding does not exist, or could not be read." };
  if (!mayOnboardRole(actor, role, "profiles.update")) return { ok: false, error: "Your role cannot verify this person." };
  if (check === "i9" && role !== "engineer") {
    return { ok: false, error: "Only an engineer is an employee with an I-9. A field technician is engaged as a contractor." };
  }
  return { ok: true, role };
}

export async function recordVerification(
  actor: (Actor & { email: string }) | null,
  onboardingId: string,
  check: VerificationCheck,
  documentType: string,
  context: Context = {},
): Promise<{ ok: true } | Fail> {
  const allowed = await guard(actor, onboardingId, check);
  if (!allowed.ok) return allowed;
  if (!actor) return { ok: false, error: "Not signed in." };
  if (!isKnownDocumentType(check, documentType)) return { ok: false, error: "Choose the document type you saw from the list." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const columns = VERIFICATION_COLUMNS[check];
  const label = documentTypeLabel(check, documentType);
  const recorded = await writeAuditOrRefuse({
    actor,
    action: `onboarding.${check}_verified`,
    entityType: "onboarding",
    entityId: onboardingId,
    /* The type seen, never a number off the document: an audit row is readable by everybody with audit.read. */
    summary: `${CHECK_WORDS[check]} recorded: ${label} seen by ${actor.email}.`,
    ...context,
  });
  if (!recorded.ok) return recorded;

  const { data: changed, error } = await db
    .from("eng_onboardings")
    /* DB_NOW: the milestone is stamped by the database, never this process's clock. */
    .update({ [columns.at]: DB_NOW, [columns.type]: documentType, [columns.by]: actor.id })
    .eq("id", onboardingId)
    .is("activated_at", null)
    .select("id");
  if (error || !changed?.length) {
    await writeAudit({
      actor,
      action: `onboarding.${check}_verified_failed`,
      entityType: "onboarding",
      entityId: onboardingId,
      summary: `${CHECK_WORDS[check]} was not saved: ${error?.message ?? "no onboarding row changed (it may already be activated)"}.`,
      ...context,
    });
    return {
      ok: false,
      error: error
        ? `${CHECK_WORDS[check]} was not saved: ${error.message}`
        : `${CHECK_WORDS[check]} was not saved: the onboarding is already activated, or no longer exists.`,
    };
  }
  return { ok: true };
}

export async function clearVerification(
  actor: (Actor & { email: string }) | null,
  onboardingId: string,
  check: VerificationCheck,
  reason: string,
  context: Context = {},
): Promise<{ ok: true } | Fail> {
  const allowed = await guard(actor, onboardingId, check);
  if (!allowed.ok) return allowed;
  if (!actor) return { ok: false, error: "Not signed in." };
  if (!reason.trim()) return { ok: false, error: "Say why this record is being cleared." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const columns = VERIFICATION_COLUMNS[check];
  const recorded = await writeAuditOrRefuse({
    actor,
    action: `onboarding.${check}_cleared`,
    entityType: "onboarding",
    entityId: onboardingId,
    summary: `${CHECK_WORDS[check]} cleared by ${actor.email}: ${reason.trim()}`,
    ...context,
  });
  if (!recorded.ok) return recorded;

  const { data: changed, error } = await db
    .from("eng_onboardings")
    .update({ [columns.at]: null, [columns.type]: null, [columns.by]: null })
    .eq("id", onboardingId)
    .is("activated_at", null)
    .select("id");
  if (error || !changed?.length) {
    await writeAudit({
      actor,
      action: `onboarding.${check}_cleared_failed`,
      entityType: "onboarding",
      entityId: onboardingId,
      summary: `${CHECK_WORDS[check]} was not cleared: ${error?.message ?? "no onboarding row changed (it may already be activated)"}.`,
      ...context,
    });
    return { ok: false, error: `${CHECK_WORDS[check]} was not cleared: ${error?.message ?? "the onboarding is already activated, or no longer exists."}` };
  }
  return { ok: true };
}

export type OnboardingVerification = Record<VerificationCheck, VerificationRecord & { byName: string | null }>;

/**
 * Both records, with the verifier's name. NULL WHEN IT CANNOT BE READ, never
 * two empty records: an empty record means "not verified", and a read that
 * failed (as it will on a database without 0105) is a different state that
 * the screen says out loud and activation refuses on.
 */
export async function readVerification(onboardingId: string): Promise<{ ok: true; verification: OnboardingVerification } | Fail> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const { data, error } = await db
    .from("eng_onboardings")
    .select("identity_verified_at, identity_document_type, identity_verified_by, i9_examined_at, i9_document_type, i9_examined_by")
    .eq("id", onboardingId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "the onboarding was not found" };
  const row = data as Record<string, string | null>;
  const ids = [row.identity_verified_by, row.i9_examined_by].filter((v): v is string => Boolean(v));
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: people, error: peopleError } = await db.from("eng_profiles").select("id, display_name, email").in("id", ids);
    if (peopleError) return { ok: false, error: peopleError.message };
    for (const p of people ?? []) names.set(p.id as string, ((p.display_name as string | null) ?? (p.email as string)) || (p.email as string));
  }
  const of = (check: VerificationCheck) => {
    const c = VERIFICATION_COLUMNS[check];
    const by = row[c.by] ?? null;
    return { at: row[c.at] ?? null, type: row[c.type] ?? null, by, byName: by ? (names.get(by) ?? null) : null };
  };
  return { ok: true, verification: { identity: of("identity"), i9: of("i9") } };
}
