import "server-only";
import { supabaseAdmin } from "./supabase";
import type { Result } from "./onboarding";

/**
 * The two checks federal procedure requires a person to perform.
 *
 * Identity confirmation on a live call, and I-9 Section 2 document examination.
 * Neither can be satisfied by anything the person being onboarded uploads, which
 * is exactly why they are recorded here by the operator rather than derived from
 * the checklist.
 *
 * STORED AS TIMESTAMPS, NOT BOOLEANS
 * ----------------------------------
 * "Identity was verified" and "identity was verified at 14:02 on the 3rd" are
 * different records, and only the second answers the question an I-9 audit
 * actually asks. Null means not yet, so there is no second flag to keep in step
 * with a date column.
 *
 * UNTICKING IS ALLOWED AND IT CLEARS THE TIMESTAMP
 * ------------------------------------------------
 * An operator who ticks the wrong row needs to be able to correct it, and a
 * record that cannot be corrected gets worked around instead. Clearing writes
 * null rather than keeping a stale time with a false flag beside it.
 */

export type VerificationField = "identity_verified_at" | "i9_examined_at";

export async function setVerification(
  onboardingId: string,
  field: VerificationField,
  value: boolean,
): Promise<Result<null>> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "Supabase is not configured for this deployment." };
  const { error } = await db
    .from("eng_onboardings")
    .update({ [field]: value ? new Date().toISOString() : null })
    .eq("id", onboardingId);
  return error ? { ok: false, error: error.message } : { ok: true, data: null };
}

export type OnboardingVerification = {
  identity_verified_at: string | null;
  i9_examined_at: string | null;
};

export async function getVerification(onboardingId: string): Promise<OnboardingVerification> {
  const db = supabaseAdmin();
  if (!db) return { identity_verified_at: null, i9_examined_at: null };
  const { data } = await db
    .from("eng_onboardings")
    .select("identity_verified_at, i9_examined_at")
    .eq("id", onboardingId)
    .maybeSingle();
  return {
    identity_verified_at: (data?.identity_verified_at as string) ?? null,
    i9_examined_at: (data?.i9_examined_at as string) ?? null,
  };
}
