import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { holdsLicence, type Actor } from "./ops-authz";
import type { ProfileRow } from "./ops-auth";
import { verifyFreshCode } from "./ops-mfa";
import { verifiedEngineers } from "@/config/credentials";
import { HELD_OUT_OF_FORCE, HELD_UNTIL_ADDENDUM, SIGNABLE_PROTOCOLS, signableProtocol, withdrawnRefusal } from "@/content/protocols/signable";
import { linePayFor } from "./line-addendum";
import { signedProtocolItemRows, type ProtocolItemRow } from "./protocol-run";
import { licenceIsCurrentToday } from "./launch";

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
 * protocol-registry-audit proves it against his PDF (section 8) or his Word
 * file (section 9), from the list in signable.ts, joined one line
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

/*
 * BY NUMBER AND VERSION, since 2026-10-14. 254-WP-001 exists at v1.1 and v1.2,
 * and a lookup by number alone would hash whichever came first. A version not
 * offered in signable.ts answers null, so a signature on it reads as void.
 */
export function transcriptionSha256(documentNumber: string, version: string): string | null {
  const p = SIGNABLE_PROTOCOLS.find((r) => r.documentNumber === documentNumber && r.version === version);
  if (!p) return null;
  return createHash("sha256").update(p.text.join("\n"), "utf8").digest("hex");
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
  const now = transcriptionSha256(documentNumber, version);
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
): Promise<{ ok: true; sha256: string; inForce: boolean } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!holdsLicence(actor, "protocols.author")) {
    return { ok: false, error: "Only the engineer of record signs a protocol. No other role can stand in for him." };
  }
  const engineer = verifiedEngineers.find((e) => e.licenseNumber === actor!.license_number);
  if (!engineer) {
    return { ok: false, error: "Your license number on this account does not match the engineer on the firm's register." };
  }

  /* A withdrawn document is refused by name (signable.ts), saying why, not "not waiting". */
  const withdrawn = withdrawnRefusal(input.documentNumber);
  if (withdrawn) return { ok: false, error: withdrawn };
  const protocol = signableProtocol(input.documentNumber);
  if (!protocol) return { ok: false, error: `${input.documentNumber} is not a protocol waiting for a signature.` };
  const version = protocol.version;

  const status = await signatureStatus(input.documentNumber, version);
  if (status.state === "unknown") return { ok: false, error: status.why };
  if (status.state === "signed") return { ok: false, error: `${input.documentNumber} v${version} is already signed.` };
  if (status.state === "void") {
    return {
      ok: false,
      error: `${input.documentNumber} v${version} carries a signature that no longer covers its text. It has to be voided with a reason before it can be signed again.`,
    };
  }

  const sha256 = transcriptionSha256(input.documentNumber, version)!;

  /* Everything that could refuse putting it in force, before the code is spent. */
  const inForce = await whatSigningPutsInForce(input.documentNumber, version, engineer);
  if (!inForce.ok) return { ok: false, error: inForce.error };

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
    p_license: engineer.licenseNumber,
    p_items: inForce.items,
  });
  if (recorded.error) return { ok: false, error: `The signature could not be recorded: ${recorded.error.message}` };
  return { ok: true, sha256, inForce: recorded.data === "in_force" || recorded.data === "already" };
}

/**
 * HIS EXISTING SIGNATURE ON A HELD PROTOCOL, PUT IN FORCE ONCE HIS ADDENDUM
 * COVERS IT. Robert's ruling of 2026-10-26, 08:19 Central, answer 12: the
 * engineer's 254-WP-001 v1.2 signature is already live, and goes in force for
 * the ongoing tier when he signs the addendum. Asked from his own signing
 * session, after the addendum is recorded, through 0096's
 * eng_put_signed_protocol_in_force, which asks eng_line_pay itself. Nothing is
 * signed here and no code is spent: the signature is the one he already gave,
 * and it must still cover the text in code.
 */
export async function putHeldProtocolInForce(
  actor: SignedIn | null,
  documentNumber: string,
): Promise<{ ok: true; inForce: boolean } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!holdsLicence(actor, "protocols.author")) {
    return { ok: false, error: "Only the engineer of record puts a protocol in force. No other role can stand in for him." };
  }
  const engineer = verifiedEngineers.find((e) => e.licenseNumber === actor!.license_number);
  if (!engineer) return { ok: false, error: "Your license number on this account does not match the engineer on the firm's register." };
  const protocol = signableProtocol(documentNumber);
  if (!protocol || !HELD_UNTIL_ADDENDUM[documentNumber]) return { ok: false, error: `${documentNumber} is not held until an addendum.` };

  const status = await signatureStatus(documentNumber, protocol.version);
  if (status.state === "unknown") return { ok: false, error: status.why };
  if (status.state !== "signed") return { ok: true, inForce: false };

  const inForce = await whatSigningPutsInForce(documentNumber, protocol.version, engineer);
  if (!inForce.ok) return { ok: false, error: inForce.error };
  if (!inForce.items) return { ok: true, inForce: false };

  const { data: act, error: actError } = await db
    .from("eng_seal_acts")
    .select("id")
    .eq("kind", "protocol")
    .eq("protocol_document", documentNumber)
    .eq("protocol_version", protocol.version)
    .is("voided_at", null)
    .maybeSingle();
  if (actError) return { ok: false, error: `The signature record could not be read: ${actError.message}` };
  if (!act) return { ok: true, inForce: false };
  const put = await db.rpc("eng_put_signed_protocol_in_force", {
    p_seal_act_id: act.id,
    p_license: engineer.licenseNumber,
    p_items: inForce.items,
  });
  if (put.error) return { ok: false, error: `${documentNumber} could not be put in force: ${put.error.message}` };
  return { ok: true, inForce: put.data === "in_force" || put.data === "already" };
}

/**
 * WHAT A SIGNATURE PUTS IN FORCE, decided before the code is spent. Operator
 * ruling, 2026-10-22: signing puts the protocol in force within the signing
 * transaction, so everything that could refuse it is asked first and a refusal
 * spends nothing. The checks are approveProtocol's (src/lib/ops-field.ts),
 * because the register lives in code: a current licence, and a discipline the
 * register says he seals. Items null means the signature is recorded and
 * nothing goes in force, which only HELD_OUT_OF_FORCE asks for.
 *
 * A protocol held until an addendum (HELD_UNTIL_ADDENDUM, 0096) goes in force
 * like any other once his signed addendum covers its deliverable, and stays
 * held before that. A failed read of the addendum refuses, rather than
 * guessing which of the two it is.
 */
async function whatSigningPutsInForce(
  documentNumber: string,
  version: string,
  engineer: (typeof verifiedEngineers)[number],
): Promise<{ ok: true; items: ProtocolItemRow[] | null } | { ok: false; error: string }> {
  if (HELD_OUT_OF_FORCE[documentNumber]) {
    const until = HELD_UNTIL_ADDENDUM[documentNumber];
    if (!until) return { ok: true, items: null };
    const pay = await linePayFor(until);
    if (pay.state === "unknown") {
      return { ok: false, error: `Whether a signed scope addendum covers ${until} could not be read, so nothing was signed. ${pay.why}.` };
    }
    if (pay.state !== "signed") return { ok: true, items: null };
  }
  if (!licenceIsCurrentToday(engineer.expires)) {
    return { ok: false, error: "The register has no current expiry for your license, so a signature cannot put a protocol in force." };
  }
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const { data: template, error } = await db
    .from("eng_protocol_templates")
    .select("requires_discipline, status")
    .eq("document_number", documentNumber)
    .eq("version_label", version)
    .maybeSingle();
  if (error) return { ok: false, error: `The protocol record could not be read: ${error.message}` };
  if (!template) return { ok: false, error: `${documentNumber} v${version} has no protocol record to put in force.` };
  const required = template.requires_discipline as string | null;
  if (!required || !engineer.sealsOnly.includes(required)) {
    return {
      ok: false,
      error: required
        ? `This protocol requires competence in ${required}, and the register records that you seal ${engineer.sealsOnly.join(", ") || "nothing"}.`
        : "This protocol has not declared the discipline it requires, so nothing can check that you cover it.",
    };
  }
  const items = signedProtocolItemRows(documentNumber, version);
  if (!items || items.length === 0) {
    return { ok: false, error: `${documentNumber} v${version} has no structured checklist on this platform, so it cannot be put in force. Nothing was signed.` };
  }
  return { ok: true, items };
}
