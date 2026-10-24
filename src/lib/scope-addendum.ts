import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { holdsLicence, type Actor } from "./ops-authz";
import type { ProfileRow } from "./ops-auth";
import { verifyFreshCode } from "./ops-mfa";
import { verifiedEngineers } from "@/config/credentials";

/**
 * ===========================================================================
 * A SCOPE ADDENDUM, SIGNED IN THE PORTAL EXACTLY AS A PROTOCOL IS.
 * ===========================================================================
 *
 * Operator rulings of 2026-10-22 (migration 0082): custom design pays the
 * engineer 35% of the engineering fee under a signed scope addendum, and
 * nothing without one; he signs it "in the portal, under his own account, with
 * a fresh second factor, recorded as a seal-act style record exactly like a
 * protocol signature. No PDF signing, no email signing."
 *
 * src/lib/protocol-sign.ts is the pattern, step for step: the licence on the
 * register, the hash of the text he reads, a fresh code, his current seal and
 * signature images by id, and one database function as the door. The text is
 * the database's own (0082 writes it from the addendum's figures), so what he
 * reads, what is hashed and what pays are one record.
 */

type SignedIn = Actor & ProfileRow;

export type AddendumRow = {
  id: string;
  created_at: string;
  quote_id: string;
  deliverable: string;
  scope: string;
  fee_cents: number;
  share_bp: number;
  pay_cents: number;
  addendum_text: string;
  content_sha256: string;
};

export type AddendumState =
  | { state: "unsigned" }
  | { state: "signed"; signedAt: string }
  | { state: "unknown"; why: string };

/** The addenda naming this engineer, newest first, each with its signature state. */
export async function addendaFor(engineerId: string): Promise<
  { ok: true; addenda: (AddendumRow & { signature: AddendumState })[] } | { ok: false; why: string }
> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, why: "The database is not configured." };
  const { data, error } = await db
    .from("eng_scope_addenda")
    .select("id, created_at, quote_id, deliverable, scope, fee_cents, share_bp, pay_cents, addendum_text, content_sha256")
    .eq("engineer_id", engineerId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return { ok: false, why: `The scope addenda could not be read: ${error.message}` };
  const rows = (data ?? []) as AddendumRow[];
  const { data: acts, error: actsError } = await db
    .from("eng_seal_acts")
    .select("addendum_id, created_at, content_sha256")
    .eq("kind", "addendum")
    .is("voided_at", null)
    .in("addendum_id", rows.map((r) => r.id));
  if (actsError) return { ok: false, why: `The addendum signatures could not be read: ${actsError.message}` };
  return {
    ok: true,
    addenda: rows.map((r) => {
      const act = (acts ?? []).find((a) => a.addendum_id === r.id && a.content_sha256 === r.content_sha256);
      return { ...r, signature: act ? { state: "signed", signedAt: act.created_at as string } : { state: "unsigned" } };
    }),
  };
}

export async function signAddendum(
  actor: SignedIn | null,
  input: { addendumId: string; code: string },
): Promise<{ ok: true; sha256: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!holdsLicence(actor, "protocols.author")) {
    return { ok: false, error: "Only the engineer of record signs a scope addendum. No other role can stand in for him." };
  }
  const engineer = verifiedEngineers.find((e) => e.licenseNumber === actor!.license_number);
  if (!engineer) {
    return { ok: false, error: "Your license number on this account does not match the engineer on the firm's register." };
  }

  const { data: addendum, error } = await db
    .from("eng_scope_addenda")
    .select("id, engineer_id, addendum_text, content_sha256")
    .eq("id", input.addendumId)
    .maybeSingle();
  if (error) return { ok: false, error: `The addendum could not be read: ${error.message}` };
  if (!addendum) return { ok: false, error: "That scope addendum does not exist." };
  if (addendum.engineer_id !== actor!.id) return { ok: false, error: "This scope addendum names another engineer." };

  /* The hash he signs is recomputed from the text he reads, never taken on trust from the row. */
  const sha256 = createHash("sha256").update(addendum.addendum_text as string, "utf8").digest("hex");
  if (sha256 !== addendum.content_sha256) {
    return { ok: false, error: "This addendum's text does not match its recorded hash, so it cannot be signed." };
  }

  const fresh = await verifyFreshCode(actor!.id, input.code);
  if (!fresh.ok) return { ok: false, error: fresh.error };

  const { data: images, error: imageError } = await db
    .from("eng_seal_images")
    .select("id, kind")
    .eq("profile_id", actor!.id)
    .is("superseded_at", null);
  if (imageError) return { ok: false, error: `Your seal images could not be read: ${imageError.message}` };
  const sealId = images?.find((i) => i.kind === "seal")?.id as string | undefined;
  const signatureId = images?.find((i) => i.kind === "signature")?.id as string | undefined;
  if (!sealId || !signatureId) return { ok: false, error: "Upload your seal and your signature on your profile before signing." };

  const recorded = await db.rpc("eng_record_addendum_signature", {
    p_seal_act_id: randomUUID(),
    p_addendum_id: input.addendumId,
    p_sha256: sha256,
    p_sealed_by: actor!.id,
    p_seal_image_id: sealId,
    p_signature_image_id: signatureId,
    p_mfa_verified_at: fresh.verifiedAt,
  });
  if (recorded.error) return { ok: false, error: `The signature could not be recorded: ${recorded.error.message}` };
  return { ok: true, sha256 };
}

/**
 * HIS PAY ON A DESIGN QUOTE, OR WHY THERE IS NONE. Read through eng_design_pay
 * (0082), so the rule that pays is the database's and cannot drift from the
 * proof. A failed read is not a figure, and neither is a missing signature.
 */
export async function designPayFor(
  quoteId: string,
): Promise<{ ok: true; cents: number; addendumId: string } | { ok: false; reason: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, reason: "the database is not configured, so the scope addendum could not be read" };
  const { data, error } = await db.rpc("eng_design_pay", { p_quote_id: quoteId });
  if (error) return { ok: false, reason: `the scope addendum could not be read: ${error.message}` };
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return {
      ok: false,
      reason: "no scope addendum signed by the engineer covers this design job, so no pay is owed until he signs one",
    };
  }
  return { ok: true, cents: Number(row.pay_cents), addendumId: row.addendum_id as string };
}
