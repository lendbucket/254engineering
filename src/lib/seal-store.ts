import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { holdsLicence, type Actor } from "./ops-authz";
import { verifyFreshCode } from "./ops-mfa";

/**
 * ===========================================================================
 * THE ENGINEER'S SEAL AND SIGNATURE IMAGES. Rulings 2 and 5 of 2026-10-06.
 * ===========================================================================
 *
 * The platform drafts a letter and the engineer applies his seal and signature
 * to it in the portal. These are the images he applies, uploaded by him, from
 * his own session, with a fresh second factor.
 *
 * THIS IS THE ONLY MODULE THAT NAMES THE BUCKET, and that is the control for
 * the second requirement: "the seal and signature images are readable only by
 * the sealing step, never displayed or downloadable anywhere else". A source
 * check asserts it (scripts/proofs/a-seal-image-is-read-only-by-sealing.mjs).
 * Nothing here returns image bytes to a caller. `sealImagesForSealing`, which
 * will read them, is written with the sealing step and is called by nothing
 * else.
 *
 * WHAT A PERSON IS SHOWN about an image is when it went on file and a short
 * fingerprint of it, so he can tell which image is current without anybody
 * being shown the image.
 *
 * 22 TAC 137.35(a)(2): "An engineer may create an electronic seal and electronic
 * signature". 137.33(d): "take reasonable steps to ensure the security of their
 * physical or electronic seals and electronic signatures". These are those
 * steps, and the audit row for each upload is written by the database in the
 * same transaction (0061 part three).
 */

const SEAL_BUCKET = "eng-seals";

/** The bucket's own limit is the one a person cannot skip; this one gives a sentence first. */
export const SEAL_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const SEAL_IMAGE_MIN_SIDE = 200;
export const SEAL_IMAGE_MAX_SIDE = 4000;

export type SealImageKind = "seal" | "signature";
export const SEAL_IMAGE_KINDS: readonly SealImageKind[] = ["seal", "signature"];

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * The width and height a PNG declares in its header, or null when the bytes are
 * not a PNG. Read from the IHDR chunk rather than trusted from the upload's
 * content type, which the browser supplies and anybody can set.
 */
export function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) if (bytes[i] !== PNG_SIGNATURE[i]) return null;
  const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (chunkType !== "IHDR") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width === 0 || height === 0) return null;
  return { width, height };
}

export type SealImageStatus = {
  kind: SealImageKind;
  onFileSince: string | null;
  /** The first twelve characters of the image's SHA-256, never the image. */
  fingerprint: string | null;
};

/** What is on file for an engineer, for his own screen. Never the image. */
export async function sealImageStatus(profileId: string): Promise<SealImageStatus[]> {
  const db = supabaseAdmin();
  const empty = SEAL_IMAGE_KINDS.map((kind) => ({ kind, onFileSince: null, fingerprint: null }));
  if (!db) return empty;
  const { data, error } = await db
    .from("eng_seal_images")
    .select("kind, created_at, sha256")
    .eq("profile_id", profileId)
    .is("superseded_at", null);
  if (error) throw new Error(`The seal images on file could not be read: ${error.message}`);
  return SEAL_IMAGE_KINDS.map((kind) => {
    const row = (data ?? []).find((r) => r.kind === kind);
    return {
      kind,
      onFileSince: row ? String(row.created_at) : null,
      fingerprint: row ? String(row.sha256).slice(0, 12) : null,
    };
  });
}

export type UploadResult = { ok: true; kind: SealImageKind; fingerprint: string } | { ok: false; error: string };

/**
 * Store a seal or signature image for the engineer making the request.
 *
 * IDENTITY, NOT PERMISSION. The image is stored for the actor's own profile and
 * no other: there is no parameter naming whose seal this is, so no request can
 * upload one for somebody else, and no administrator path exists. The licence
 * check is the same one every sealing act uses.
 *
 * ORDER OF CHECKS, cheapest refusal first, and the code is spent last of the
 * checks so a malformed file does not cost the engineer a code.
 */
export async function uploadSealImage(input: {
  actor: (Actor & { status: string; role: string }) | null;
  kind: string;
  bytes: Uint8Array;
  code: string;
}): Promise<UploadResult> {
  const { actor } = input;
  if (!holdsLicence(actor, "documents.seal") || !actor) {
    return { ok: false, error: "Only a licensed engineer of record can store a seal or signature, and only his own." };
  }
  if (!SEAL_IMAGE_KINDS.includes(input.kind as SealImageKind)) {
    return { ok: false, error: "Say whether this is the seal or the signature." };
  }
  const kind = input.kind as SealImageKind;

  if (input.bytes.length === 0) return { ok: false, error: "No file arrived." };
  if (input.bytes.length > SEAL_IMAGE_MAX_BYTES) {
    return { ok: false, error: "That file is over 2 MB. A seal scanned at 600 dpi is a few hundred kilobytes." };
  }
  const size = pngDimensions(input.bytes);
  if (!size) return { ok: false, error: "That is not a PNG image. Save the seal as a PNG and try again." };
  if (
    size.width < SEAL_IMAGE_MIN_SIDE ||
    size.height < SEAL_IMAGE_MIN_SIDE ||
    size.width > SEAL_IMAGE_MAX_SIDE ||
    size.height > SEAL_IMAGE_MAX_SIDE
  ) {
    return {
      ok: false,
      error: `The image is ${size.width} by ${size.height} pixels. It needs to be between ${SEAL_IMAGE_MIN_SIDE} and ${SEAL_IMAGE_MAX_SIDE} on each side to print clearly.`,
    };
  }

  const factor = await verifyFreshCode(actor.id, input.code);
  if (!factor.ok) return { ok: false, error: factor.error };

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const id = randomUUID();
  const storageKey = `${actor.id}/${kind}/${id}.png`;

  const stored = await db.storage
    .from(SEAL_BUCKET)
    .upload(storageKey, input.bytes, { contentType: "image/png", upsert: false });
  if (stored.error) return { ok: false, error: `The image could not be stored: ${stored.error.message}` };

  /*
   * ONE ACT IN THE DATABASE: supersede the current image, if there is one, and
   * insert the new row, in a single transaction, because the reference between
   * them is checked at commit (0061). Done by a function rather than two calls
   * from here, since two calls are two transactions and the first would be
   * refused.
   */
  const { error: recordError } = await db.rpc("eng_record_seal_image", {
    p_id: id,
    p_profile_id: actor.id,
    p_kind: kind,
    p_storage_key: storageKey,
    p_sha256: sha256,
    p_byte_size: input.bytes.length,
    p_width: size.width,
    p_height: size.height,
    p_mfa_verified_at: factor.verifiedAt,
  });
  if (recordError) {
    /*
     * The object is in the bucket with no record. It is left there rather than
     * removed, because nothing reads an object without a current record, and a
     * removal that failed silently is worse than an orphan the record makes
     * inert. It is reported so somebody can see it happened.
     */
    console.error(`[seal-store] stored ${storageKey} but could not record it: ${recordError.message}`);
    return { ok: false, error: `The image was stored but could not be recorded, so it is not in use: ${recordError.message}` };
  }

  return { ok: true, kind, fingerprint: sha256.slice(0, 12) };
}
