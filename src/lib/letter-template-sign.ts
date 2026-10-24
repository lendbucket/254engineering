import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { holdsLicence, type Actor } from "./ops-authz";
import type { ProfileRow } from "./ops-auth";
import { verifyFreshCode } from "./ops-mfa";
import { verifiedEngineers } from "@/config/credentials";
import { LETTER_TEMPLATES, letterTemplateFor } from "@/content/letters/templates";

/**
 * ===========================================================================
 * SIGNING A LETTER TEMPLATE IN THE PORTAL. The same act as signing a protocol.
 * ===========================================================================
 *
 * Robert's instruction of 2026-10-24, migration 0088: the engineer signs each
 * letter template in his portal like a protocol, and a line's letter can seal
 * only from a template he has signed. Nothing seals without it.
 *
 * WHAT IS HASHED is the template's text as templates.ts flattens it from the
 * constants every letter is drafted from, one line per line: exactly what the
 * portal shows him. A template changed after he signs reads as "void" here, so
 * nothing seals from it until he signs the new text.
 *
 * ONLY HIS OWN SESSION, with a fresh second factor and his own current seal and
 * signature images, by id. No role, grant or administrator stands in for him,
 * and no image is read.
 */

type SignedIn = Actor & ProfileRow;

export function templateSha256(key: string, version: string): string | null {
  const t = LETTER_TEMPLATES.find((x) => x.key === key && x.version === version);
  if (!t) return null;
  return createHash("sha256").update(t.text.join("\n"), "utf8").digest("hex");
}

export type TemplateSignature =
  | { state: "unsigned" }
  | { state: "signed"; actId: string; signedAt: string; sha256: string }
  | { state: "void"; actId: string; signedAt: string; why: string }
  | { state: "unknown"; why: string };

/** The live signature on a template version, judged against the template in code today. */
export async function templateSignatureStatus(key: string, version: string): Promise<TemplateSignature> {
  const db = supabaseAdmin();
  if (!db) return { state: "unknown", why: "The database is not configured." };
  const { data, error } = await db
    .from("eng_seal_acts")
    .select("id, created_at, content_sha256")
    .eq("kind", "letter_template")
    .eq("template_key", key)
    .eq("template_version", version)
    .is("voided_at", null)
    .maybeSingle();
  /* An unknown is not a signature: a failed read seals nothing. */
  if (error) return { state: "unknown", why: `The template signature could not be read: ${error.message}` };
  if (!data) return { state: "unsigned" };
  if (templateSha256(key, version) !== data.content_sha256) {
    return {
      state: "void",
      actId: data.id as string,
      signedAt: data.created_at as string,
      why: "The template has changed since he signed it, so his signature no longer covers its words.",
    };
  }
  return { state: "signed", actId: data.id as string, signedAt: data.created_at as string, sha256: data.content_sha256 as string };
}

/**
 * THE TEMPLATE SIGNATURE A LETTER SEALS FROM, or the sentence saying why
 * there is none. letter-seal.ts calls this before it spends the code.
 */
export async function templateToSealFrom(protocolDocument: string): Promise<{ ok: true; actId: string } | { ok: false; error: string }> {
  const template = letterTemplateFor(protocolDocument);
  if (!template) return { ok: false, error: `${protocolDocument} has no letter template, so nothing is sealed.` };
  const status = await templateSignatureStatus(template.key, template.version);
  if (status.state === "signed") return { ok: true, actId: status.actId };
  if (status.state === "unknown") return { ok: false, error: status.why };
  if (status.state === "void") {
    return { ok: false, error: `${status.why} Sign the ${template.title.toLowerCase()} template again on your protocols screen before sealing.` };
  }
  return { ok: false, error: `You have not signed the ${template.title.toLowerCase()} template. Sign it on your protocols screen, then seal this letter.` };
}

export async function signLetterTemplate(
  actor: SignedIn | null,
  input: { key: string; code: string },
): Promise<{ ok: true; sha256: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!holdsLicence(actor, "documents.seal")) {
    return { ok: false, error: "Only the engineer of record signs a letter template. No other role can stand in for him." };
  }
  const engineer = verifiedEngineers.find((e) => e.licenseNumber === actor!.license_number);
  if (!engineer) {
    return { ok: false, error: "Your license number on this account does not match the engineer on the firm's register." };
  }
  const template = letterTemplateFor(input.key);
  if (!template) return { ok: false, error: `${input.key} has no letter template to sign.` };

  const status = await templateSignatureStatus(template.key, template.version);
  if (status.state === "unknown") return { ok: false, error: status.why };
  if (status.state === "signed") return { ok: false, error: `The ${template.title.toLowerCase()} template is already signed.` };
  if (status.state === "void") {
    return { ok: false, error: `The ${template.title.toLowerCase()} template carries a signature that no longer covers its words. It has to be voided with a reason before it can be signed again.` };
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

  const sha256 = templateSha256(template.key, template.version)!;
  const { error } = await db.rpc("eng_record_letter_template_signature", {
    p_seal_act_id: randomUUID(),
    p_template_key: template.key,
    p_template_version: template.version,
    p_sha256: sha256,
    p_sealed_by: actor!.id,
    p_seal_image_id: sealId,
    p_signature_image_id: signatureId,
    p_mfa_verified_at: fresh.verifiedAt,
  });
  if (error) return { ok: false, error: `The signature could not be recorded: ${error.message}` };
  return { ok: true, sha256 };
}
