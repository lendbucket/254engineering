import "server-only";
import { SITE_KEY, supabaseAdmin } from "./supabase";

/**
 * Document uploads for the careers applications.
 *
 * WHY A SIGNED URL AND NOT A POST THROUGH THE APP
 * -----------------------------------------------
 * The obvious build is a route that accepts the file and forwards it to storage.
 * It works and it is the wrong shape here: it puts a ten megabyte body through a
 * serverless function on every resume, doubles the transfer, and makes the
 * function's timeout the upload's timeout on a phone with one bar of signal in a
 * county where that is the normal condition.
 *
 * A signed upload URL moves the bytes from the applicant's phone straight to
 * storage. The server's only job is to decide whether that upload is allowed and
 * where it goes, which is a small JSON round trip.
 *
 * WHY THERE IS STILL NO BROWSER SUPABASE CLIENT
 * ---------------------------------------------
 * The signed URL is a plain HTTPS endpoint. The client PUTs the file to it with
 * fetch, so the closed door pattern holds: no NEXT_PUBLIC key exists, the
 * browser never holds a credential, and the bucket stays private. See
 * src/lib/supabase.ts.
 *
 * DEFENCE IN DEPTH ON WHAT CAN BE UPLOADED
 * ----------------------------------------
 * The checks below are the first layer. The bucket itself carries a 10MB
 * file_size_limit and an allowed_mime_types list, because a check that lives
 * only in application code is a check somebody can skip by calling storage
 * directly with a signed URL obtained for a different file.
 */

/** 10MB. A resume is under one; a phone photo of a wallet card can be several. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_UPLOAD_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const UPLOAD_KINDS = ["resume", "certifications", "license"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

const BUCKET = "eng-uploads";

/**
 * Strip a filename to something safe to place in a storage key.
 *
 * Applicants upload files called "Resume (final) v3 – Copy.pdf". The extension
 * is preserved because it is what makes the file open correctly when the
 * operator clicks the link; everything else is reduced to characters that cannot
 * change the meaning of a path.
 */
export function safeFilename(name: string): string {
  const trimmed = name.trim().slice(-120);
  const dot = trimmed.lastIndexOf(".");
  const stem = (dot > 0 ? trimmed.slice(0, dot) : trimmed).replace(/[^A-Za-z0-9._-]+/g, "-");
  const ext = dot > 0 ? trimmed.slice(dot + 1).replace(/[^A-Za-z0-9]+/g, "").toLowerCase() : "";
  const cleanStem = stem.replace(/^-+|-+$/g, "").slice(0, 60) || "file";
  return ext ? `${cleanStem}.${ext}` : cleanStem;
}

/**
 * The storage key for an upload.
 *
 * Keyed to the application id, which is generated at the start of the flow and
 * is the same id the row is inserted with. That is what makes an operator able
 * to go from a row to its documents without a join table.
 */
export function uploadPath(applicationId: string, kind: UploadKind, filename: string): string {
  return `${SITE_KEY}/${applicationId}/${kind}-${safeFilename(filename)}`;
}

export type SignedUpload = { ok: true; url: string; path: string } | { ok: false; error: string };

export async function createSignedUpload(params: {
  applicationId: string;
  kind: UploadKind;
  filename: string;
  contentType: string;
  size: number;
}): Promise<SignedUpload> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "Uploads are not configured." };

  if (!UPLOAD_KINDS.includes(params.kind)) {
    return { ok: false, error: "Unknown document type." };
  }
  if (!ALLOWED_UPLOAD_TYPES.includes(params.contentType as (typeof ALLOWED_UPLOAD_TYPES)[number])) {
    return { ok: false, error: "That file type is not accepted. Use a PDF or an image." };
  }
  if (!Number.isFinite(params.size) || params.size <= 0) {
    return { ok: false, error: "That file looks empty." };
  }
  if (params.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "That file is over 10MB. Please attach a smaller one." };
  }
  // A UUID, and nothing else, because it becomes part of a storage path.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.applicationId)) {
    return { ok: false, error: "Malformed application reference." };
  }

  const path = uploadPath(params.applicationId, params.kind, params.filename);
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not prepare the upload." };
  }
  return { ok: true, url: data.signedUrl, path: data.path };
}

/**
 * A time limited link to a stored document, for the operator notification.
 *
 * The bucket is private, so the email cannot carry a bare storage URL. Seven
 * days is long enough to read an application over a weekend and short enough
 * that an old forwarded email stops being a key to somebody's resume.
 */
export async function signedDownloadUrl(path: string, expiresInSeconds = 60 * 60 * 24 * 7) {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  return error || !data ? null : data.signedUrl;
}
