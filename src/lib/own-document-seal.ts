import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { holdsLicence } from "./ops-authz";
import { verifyFreshCode } from "./ops-mfa";
import { readImageForSealing } from "./seal-store";
import { writeAudit } from "./ops-audit";
import { isPrelaunch } from "./launch";
import { letterDate } from "./letter-draft";
import { stampOwnDocument } from "./letter-pdf";
import { LETTERHEAD_MARK } from "@/content/letters/letterhead-mark";
import { deliverablesFor } from "@data/catalog";
import {
  DOCUMENT_BUCKET,
  OWN_DOCUMENT_PROTOCOLS,
  deliverSealedFile,
  determination,
  frameFor,
  sealerFor,
  type LetterFrame,
  type SignedIn,
} from "./letter-seal";

/**
 * ===========================================================================
 * THE ENGINEER'S OWN DOCUMENT: UPLOADED, PREVIEWED, SEALED. Robert's ruling of
 * 2026-10-25, 23:51 Central, item C. docs/sealing-controls.md, controls 12 to 17.
 * ===========================================================================
 *
 * A repair specification is his document, so the platform drafts nothing. He
 * uploads his PDF by a signed URL into eng-engineer-drafts (0092), previews it
 * with the page the platform adds, and seals it from his own session with a
 * fresh code. The sealed copy goes to eng-documents and is recorded through
 * 0089's seventeen argument door exactly as a letter is, and delivered by the
 * same step.
 *
 * WHAT IS ASKED FIRST, EVERY TIME, IN ONE PLACE (`ownDocumentFor`): he holds
 * documents.seal, the determination is his (sealerFor, the letters' own
 * reading), it is a pass under a protocol whose deliverable is his own
 * document, and it is not already sealed.
 */

export const DRAFTS_BUCKET = "eng-engineer-drafts";

/** 25 MB, the size eng-documents and eng-engineer-drafts take at the bucket. */
export const MAX_DRAFT_BYTES = 25 * 1024 * 1024;

const draftKeyFor = (det: { file_id: string; id: string }) => `${det.file_id}/${det.id}.pdf`;
const previewKeyFor = (det: { file_id: string; id: string }) => `${det.file_id}/${det.id}.preview.pdf`;

/** The preview link lasts ten minutes: long enough to read it, short enough not to be a key. */
const PREVIEW_LINK_SECONDS = 600;

type Determination = NonNullable<Awaited<ReturnType<typeof determination>>>;
type Ready = {
  ok: true;
  det: Determination;
  sealer: Extract<ReturnType<typeof sealerFor>, { ok: true }>;
  title: string;
  frame: LetterFrame;
};

async function ownDocumentFor(actor: SignedIn | null, determinationId: string): Promise<Ready | { ok: false; error: string }> {
  if (!holdsLicence(actor, "documents.seal")) {
    return { ok: false, error: "Only the engineer of record seals a specification. No other role can stand in for him." };
  }
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const det = await determination(determinationId);
  if (!det) return { ok: false, error: "That determination does not exist." };
  const sealer = sealerFor(actor!, det);
  if (!sealer.ok) return sealer;
  if (!(OWN_DOCUMENT_PROTOCOLS as readonly string[]).includes(det.protocol_document)) {
    return { ok: false, error: `${det.protocol_document} is not sealed from your own document.` };
  }
  if (det.determination !== "pass") {
    return { ok: false, error: `A ${det.determination} determination issues no specification. 254-RS-001 section 11 issues one on a pass.` };
  }
  const { data: live, error: liveError } = await db
    .from("eng_seal_acts")
    .select("id")
    .eq("determination_id", det.id)
    .is("voided_at", null)
    .maybeSingle();
  if (liveError) return { ok: false, error: `Whether this specification is already sealed could not be read: ${liveError.message}` };
  if (live) return { ok: false, error: "This determination's specification is already sealed." };

  const { data: file, error: fileError } = await db
    .from("eng_files")
    .select("service_slug, deliverable")
    .eq("id", det.file_id)
    .maybeSingle();
  if (fileError || !file) return { ok: false, error: `The file could not be read: ${fileError?.message ?? "no such file"}` };
  const entry = deliverablesFor(file.service_slug as string).find((d) => d.tier === (file.deliverable ?? "standard"));
  return { ok: true, det, sealer, title: entry?.name ?? "Repair specification", frame: frameFor(sealer.engineer) };
}

/** The digest of what he previews: the draft's own bytes, the title, and the page the platform adds. */
export function ownDocumentDigest(draftSha256: string, title: string, frame: LetterFrame): string {
  const canonical = JSON.stringify({
    draft: draftSha256,
    title,
    letterhead: [frame.letterhead.brand, frame.letterhead.registrationLine],
    sealBlock: [frame.sealBlock.name, frame.sealBlock.licenseNumber, frame.sealBlock.role],
  });
  return createHash("sha256").update(canonical).digest("hex");
}

/** Control 13: a signed URL to put his PDF straight into the drafts bucket. A new upload replaces the old. */
export async function ownDocumentUploadUrl(
  actor: SignedIn | null,
  input: { determinationId: string; contentType: string; size: number },
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ready = await ownDocumentFor(actor, input.determinationId);
  if (!ready.ok) return ready;
  if (input.contentType !== "application/pdf") return { ok: false, error: "Upload the specification as a PDF." };
  if (!Number.isFinite(input.size) || input.size <= 0) return { ok: false, error: "That file looks empty." };
  if (input.size > MAX_DRAFT_BYTES) return { ok: false, error: "That PDF is over 25 MB. Reduce it and upload it again." };
  const db = supabaseAdmin()!;
  const { data, error } = await db.storage.from(DRAFTS_BUCKET).createSignedUploadUrl(draftKeyFor(ready.det), { upsert: true });
  if (error || !data) return { ok: false, error: `The upload could not be prepared: ${error?.message ?? "no URL came back"}` };
  return { ok: true, url: data.signedUrl };
}

async function readDraft(det: Determination): Promise<{ ok: true; bytes: Uint8Array; sha256: string } | { ok: false; error: string }> {
  const db = supabaseAdmin()!;
  const { data, error } = await db.storage.from(DRAFTS_BUCKET).download(draftKeyFor(det));
  if (error || !data) return { ok: false, error: "No specification has been uploaded for this file yet. Upload your PDF first." };
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.byteLength > MAX_DRAFT_BYTES) return { ok: false, error: "The uploaded PDF is over 25 MB. Upload a smaller one." };
  return { ok: true, bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
}

export type OwnDocumentPreview =
  | { ok: true; url: string; previewSha256: string; pages: number; title: string; frame: LetterFrame }
  | { ok: false; error: string };

/** Control 14: his pages and the added page, without the two images, for him to read in full. */
export async function previewOwnDocument(actor: SignedIn | null, determinationId: string): Promise<OwnDocumentPreview> {
  const ready = await ownDocumentFor(actor, determinationId);
  if (!ready.ok) return ready;
  const draft = await readDraft(ready.det);
  if (!draft.ok) return draft;
  const stamped = await stampOwnDocument({
    source: draft.bytes,
    brand: ready.frame.letterhead.brand,
    registrationLine: ready.frame.letterhead.registrationLine,
    logoPng: new Uint8Array(Buffer.from(LETTERHEAD_MARK.pngBase64, "base64")),
    title: ready.title,
    sealBlock: { ...ready.frame.sealBlock, date: "the date of sealing" },
    images: null,
  });
  if (!stamped.ok) return { ok: false, error: stamped.why };
  const db = supabaseAdmin()!;
  const key = previewKeyFor(ready.det);
  const put = await db.storage.from(DRAFTS_BUCKET).upload(key, stamped.bytes, { contentType: "application/pdf", upsert: true });
  if (put.error) return { ok: false, error: `The preview could not be stored: ${put.error.message}` };
  const { data: link, error: linkError } = await db.storage.from(DRAFTS_BUCKET).createSignedUrl(key, PREVIEW_LINK_SECONDS);
  if (linkError || !link) return { ok: false, error: `The preview link could not be made: ${linkError?.message ?? "no URL came back"}` };
  return {
    ok: true,
    url: link.signedUrl,
    previewSha256: ownDocumentDigest(draft.sha256, ready.title, ready.frame),
    pages: stamped.sourcePages + 1,
    title: ready.title,
    frame: ready.frame,
  };
}

export type OwnDocumentSealResult =
  | { ok: true; documentId: string; sha256: string; delivered: boolean; warning: string | null }
  | { ok: false; error: string };

/** Controls 15, 16 and 17: sealed only as he previewed it, rendered once, recorded and delivered as a letter. */
export async function sealOwnDocument(
  actor: SignedIn | null,
  input: { determinationId: string; code: string; previewSha256?: string; context?: { ip?: string | null; userAgent?: string | null } },
): Promise<OwnDocumentSealResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (isPrelaunch()) {
    return { ok: false, error: "The firm cannot issue a sealed document while the launch gate is shut. Nothing was sealed." };
  }
  const ready = await ownDocumentFor(actor, input.determinationId);
  if (!ready.ok) return ready;
  const { det, sealer, title, frame } = ready;

  // Control 15: what he previewed, before any code is spent.
  if (!input.previewSha256) {
    return { ok: false, error: "Open the preview before sealing: a specification is sealed only as you read it. Nothing was sealed." };
  }
  const draft = await readDraft(det);
  if (!draft.ok) return draft;
  if (ownDocumentDigest(draft.sha256, title, frame) !== input.previewSha256) {
    return {
      ok: false,
      error: "The uploaded PDF or the page added to it changed since you previewed it. Open the preview again before sealing. Nothing was sealed.",
    };
  }

  // A fresh second factor, for this act.
  const fresh = await verifyFreshCode(actor!.id, input.code);
  if (!fresh.ok) return { ok: false, error: fresh.error };

  // His images, read here and in the letter's sealing step only (control 2).
  const seal = await readImageForSealing(actor!.id, "seal");
  if (!seal.ok) return { ok: false, error: seal.error };
  const signature = await readImageForSealing(actor!.id, "signature");
  if (!signature.ok) return { ok: false, error: signature.error };

  const markBytes = Buffer.from(LETTERHEAD_MARK.pngBase64, "base64");
  const markSha256 = createHash("sha256").update(markBytes).digest("hex");
  if (markSha256 !== LETTERHEAD_MARK.sha256) {
    return { ok: false, error: "The letterhead mark does not match its recorded checksum, so nothing was sealed." };
  }

  // Control 16: rendered once, nothing drawn over his pages.
  const rendered = await stampOwnDocument({
    source: draft.bytes,
    brand: frame.letterhead.brand,
    registrationLine: frame.letterhead.registrationLine,
    logoPng: new Uint8Array(markBytes),
    title,
    /* Dated by the instant his fresh code was spent, which the seal act records (L2j). */
    sealBlock: { ...frame.sealBlock, date: letterDate(fresh.verifiedAt) },
    images: { sealPng: seal.bytes, signaturePng: signature.bytes },
  });
  if (!rendered.ok) return { ok: false, error: rendered.why };

  const sha256 = createHash("sha256").update(rendered.bytes).digest("hex");
  const documentId = randomUUID();
  const sealActId = randomUUID();
  const storageKey = `${det.file_id}/${documentId}.pdf`;
  const stored = await db.storage
    .from(DOCUMENT_BUCKET)
    .upload(storageKey, rendered.bytes, { contentType: "application/pdf", upsert: false });
  if (stored.error) return { ok: false, error: `The sealed specification could not be stored: ${stored.error.message}. Nothing was sealed.` };

  // Control 17: the act, in one transaction, audited by the database.
  const { data: file } = await db.from("eng_files").select("client_id").eq("id", det.file_id).maybeSingle();
  const recorded = await db.rpc("eng_record_letter_seal", {
    p_seal_act_id: sealActId,
    p_document_id: documentId,
    p_file_id: det.file_id,
    p_client_id: (file?.client_id as string | null) ?? null,
    p_title: title,
    p_storage_key: storageKey,
    p_byte_size: rendered.bytes.byteLength,
    p_sha256: sha256,
    p_firm_registration: sealer.registration.number,
    p_determination_id: det.id,
    p_sealed_by: actor!.id,
    p_seal_image_id: seal.id,
    p_signature_image_id: signature.id,
    p_mfa_verified_at: fresh.verifiedAt,
    p_letterhead_sha256: markSha256,
    p_printed_name: frame.sealBlock.name,
    p_printed_license: frame.sealBlock.licenseNumber,
  });
  if (recorded.error) {
    /* No unrecorded PDF is left in the bucket: an object with no seal act is a seal nothing vouches for. */
    await db.storage.from(DOCUMENT_BUCKET).remove([storageKey]);
    return { ok: false, error: `The seal could not be recorded: ${recorded.error.message}. Nothing was sealed.` };
  }

  await writeAudit({
    actor,
    action: "specification.sealed",
    entityType: "file",
    entityId: det.file_id,
    summary: `Sealed the repair specification, ${rendered.sourcePages} page(s) of his and the seal page, sha256 ${sha256.slice(0, 12)}`,
    ...(input.context ?? {}),
  });

  /* Control 13: the draft and its preview go once the sealed copy is stored and recorded. */
  const removed = await db.storage.from(DRAFTS_BUCKET).remove([draftKeyFor(det), previewKeyFor(det)]);
  if (removed.error) console.error(`[own-document] the draft for ${det.file_id} was not removed: ${removed.error.message}`);

  const problems = await deliverSealedFile(actor!, det, input.context ?? {}, "specification");
  return {
    ok: true,
    documentId,
    sha256,
    delivered: problems.length === 0,
    warning: problems.length ? `The specification is sealed. Then ${problems.join("; ")}.` : null,
  };
}
