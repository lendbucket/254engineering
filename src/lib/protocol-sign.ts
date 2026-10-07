import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { holdsLicence, type Actor } from "./ops-authz";
import type { ProfileRow } from "./ops-auth";
import { verifyFreshCode } from "./ops-mfa";
import { verifiedEngineers } from "@/config/credentials";
import { RECEIVED_PROTOCOLS } from "@/content/protocols/received";

/**
 * ===========================================================================
 * SIGNING A PROTOCOL IN THE PORTAL. The same act as sealing a letter.
 * ===========================================================================
 *
 * Operator ruling 2a of 2026-10-06, CLAUDE.md section 1: "The engineer opens
 * the verbatim transcription in the portal, the text is hashed, he applies his
 * stored seal and signature from his own MFA session, and the signed version is
 * locked and becomes the registered protocol. ... Any change to the text after
 * signing voids it."
 *
 * WHAT IS HASHED is the transcription's own `text`, the whole document as
 * protocol-registry-audit section 8 proves it against his PDF, joined one line
 * per line. That is exactly what the portal shows him to read, so the
 * signature attaches to the words he read.
 *
 * WHAT VOIDS IT. The signature is recorded with that hash. Every reader asks
 * signatureStatus(), which recomputes the hash from the transcription in code
 * and compares: a transcription changed after signing reads as "void", without
 * anybody having to remember to void it. That is the closing direction ruling
 * 11 allows to act without a deploy.
 *
 * NO IMAGE IS READ HERE. The signature records WHICH of his images he signed
 * with, by id; nothing is rendered, so the bytes are never needed and control 2
 * stays with the sealing step alone.
 */

type SignedIn = Actor & ProfileRow;

export function transcriptionSha256(documentNumber: string): string | null {
  const p = RECEIVED_PROTOCOLS.find((r) => r.declaration.documentNumber === documentNumber);
  if (!p) return null;
  return createHash("sha256").update((p.declaration.text as readonly string[]).join("\n"), "utf8").digest("hex");
}

export type SignatureStatus =
  | { state: "unsigned" }
  | { state: "signed"; signedAt: string; sha256: string }
  | { state: "void"; signedAt: string; why: string }
  | { state: "unknown"; why: string };

/** The live signature on a protocol version, judged against the text in code today. */
export async function signatureStatus(documentNumber: string, version: string): Promise<SignatureStatus> {
  const db = supabaseAdmin();
  if (!db) return { state: "unknown", why: "The database is not configured." };
  const { data, error } = await db
    .from("eng_seal_acts")
    .select("created_at, content_sha256")
    .eq("kind", "protocol")
    .eq("protocol_document", documentNumber)
    .eq("protocol_version", version)
    .is("voided_at", null)
    .maybeSingle();
  /* An unknown is not a signature, ruling 11: a failed read closes the line. */
  if (error) return { state: "unknown", why: `The signature record could not be read: ${error.message}` };
  if (!data) return { state: "unsigned" };
  const now = transcriptionSha256(documentNumber);
  if (now !== data.content_sha256) {
    return {
      state: "void",
      signedAt: data.created_at as string,
      why: "The transcription has changed since he signed it, so the signature no longer covers the text.",
    };
  }
  return { state: "signed", signedAt: data.created_at as string, sha256: data.content_sha256 as string };
}

export async function signProtocol(
  actor: SignedIn | null,
  input: { documentNumber: string; code: string },
): Promise<{ ok: true; sha256: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!holdsLicence(actor, "protocols.author")) {
    return { ok: false, error: "Only the engineer of record signs a protocol. No other role can stand in for him." };
  }
  const engineer = verifiedEngineers.find((e) => e.licenseNumber === actor!.license_number);
  if (!engineer) {
    return { ok: false, error: "Your licence number on this account does not match the engineer on the firm's register." };
  }

  const protocol = RECEIVED_PROTOCOLS.find((r) => r.declaration.documentNumber === input.documentNumber);
  if (!protocol) return { ok: false, error: `${input.documentNumber} is not a protocol waiting for a signature.` };
  const version = protocol.declaration.version as string;

  const status = await signatureStatus(input.documentNumber, version);
  if (status.state === "unknown") return { ok: false, error: status.why };
  if (status.state === "signed") return { ok: false, error: `${input.documentNumber} v${version} is already signed.` };
  if (status.state === "void") {
    return {
      ok: false,
      error: `${input.documentNumber} v${version} carries a signature that no longer covers its text. It has to be voided with a reason before it can be signed again.`,
    };
  }

  const sha256 = transcriptionSha256(input.documentNumber)!;

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
  if (!sealId || !signatureId) {
    return { ok: false, error: "Upload your seal and your signature on your profile before signing." };
  }

  const recorded = await db.rpc("eng_record_protocol_signature", {
    p_seal_act_id: randomUUID(),
    p_protocol_document: input.documentNumber,
    p_protocol_version: version,
    p_sha256: sha256,
    p_sealed_by: actor!.id,
    p_seal_image_id: sealId,
    p_signature_image_id: signatureId,
    p_mfa_verified_at: fresh.verifiedAt,
  });
  if (recorded.error) return { ok: false, error: `The signature could not be recorded: ${recorded.error.message}` };
  return { ok: true, sha256 };
}
