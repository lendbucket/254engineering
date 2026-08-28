import "server-only";
import { supabaseAdmin, supabaseConfigured } from "./supabase";

/**
 * Uploads for the onboarding flow.
 *
 * A SEPARATE BUCKET FROM eng-uploads, DELIBERATELY
 * ------------------------------------------------
 * eng-uploads holds resumes and certificates attached to job applications.
 * eng-onboarding holds driver licences, passports, signed W-4s and I-9s, and
 * voided checks. Those are not the same kind of data and they do not have the
 * same retention: an application from somebody who was not hired should age out,
 * and an employment record has a statutory life of its own.
 *
 * One bucket with a naming convention would have been less work and it would
 * mean the stricter rule never actually applies to anything, because the only
 * thing enforcing it would be a path prefix nobody checks. Two buckets means the
 * 15MB limit, the MIME allowlist, and any future retention policy are properties
 * of the store rather than of the code that happens to write to it.
 *
 * DEFENCE IN DEPTH, THREE LAYERS
 * ------------------------------
 * The checks in this file are the first layer and the weakest, because they run
 * in code that a future edit can change. The bucket itself carries the 15MB
 * limit and the MIME allowlist, which Supabase enforces on the PUT regardless of
 * what this file believes. And the bucket is private, so an object that somehow
 * lands in it is still not readable without a signed URL.
 *
 * NOTHING IN THIS BUCKET IS EVER PUBLIC
 * -------------------------------------
 * There is no public URL path. Reading a document is always a short lived signed
 * URL minted server side for an authenticated admin. `signedDownloadUrl` below
 * defaults to ten minutes and takes a maximum, not a suggestion: the download
 * links in the admin portal are for looking at a document now, not for pasting
 * into an email.
 *
 * That is a deliberate difference from src/lib/uploads.ts, whose links run for
 * seven days because they are sent to the operator in a notification email. An
 * identity document link with a seven day life would outlive the reason it was
 * created.
 */

const BUCKET = "eng-onboarding";

/** Matches the bucket's own limit. Both are enforced; neither is trusted alone. */
export const MAX_ONBOARDING_UPLOAD_BYTES = 15 * 1024 * 1024;

export const ALLOWED_ONBOARDING_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

/** Ten minutes. Long enough to open a document, short enough to be useless later. */
export const SIGNED_URL_SECONDS = 10 * 60;
const MAX_SIGNED_URL_SECONDS = 60 * 60;

/**
 * Strip a filename to something safe to put in a storage key.
 *
 * Identity documents arrive from phones with names like
 * "IMG_0421 (1) copy.HEIC" and occasionally with the person's own name in them.
 * The extension is preserved because content type detection downstream benefits
 * from it; everything else is flattened.
 */
export function safeFilename(name: string): string {
  const trimmed = name.trim().toLowerCase();
  const dot = trimmed.lastIndexOf(".");
  const stem = (dot > 0 ? trimmed.slice(0, dot) : trimmed).replace(/[^a-z0-9]+/g, "-");
  const ext = dot > 0 ? trimmed.slice(dot + 1).replace(/[^a-z0-9]+/g, "") : "";
  const shortStem = (stem.replace(/^-+|-+$/g, "") || "file").slice(0, 60);
  return ext ? `${shortStem}.${ext.slice(0, 8)}` : shortStem;
}

/**
 * Where a document lives.
 *
 * Keyed by onboarding id and item key, so a re-upload of the same item replaces
 * the previous file rather than accumulating copies of somebody's passport.
 */
export function onboardingPath(onboardingId: string, itemKey: string, filename: string): string {
  return `254/${onboardingId}/${itemKey}-${safeFilename(filename)}`;
}

export type SignedUpload = { ok: true; url: string; path: string } | { ok: false; error: string };

export async function createOnboardingUpload(params: {
  onboardingId: string;
  itemKey: string;
  filename: string;
  contentType: string;
  size: number;
}): Promise<SignedUpload> {
  if (!supabaseConfigured()) {
    return { ok: false, error: "Uploads are not configured on this deployment." };
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.onboardingId)) {
    return { ok: false, error: "That upload could not be matched to an onboarding." };
  }
  if (!/^[a-z0-9_]{2,40}$/.test(params.itemKey)) {
    return { ok: false, error: "That upload could not be matched to a checklist item." };
  }
  if (
    !ALLOWED_ONBOARDING_TYPES.includes(
      params.contentType as (typeof ALLOWED_ONBOARDING_TYPES)[number],
    )
  ) {
    return { ok: false, error: "That file type is not accepted. Use a PDF or a photograph." };
  }
  if (!Number.isFinite(params.size) || params.size <= 0) {
    return { ok: false, error: "That file looks empty." };
  }
  if (params.size > MAX_ONBOARDING_UPLOAD_BYTES) {
    return { ok: false, error: "That file is over 15MB. Please upload a smaller copy." };
  }

  const path = onboardingPath(params.onboardingId, params.itemKey, params.filename);
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "Uploads are not configured on this deployment." };
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path, {
    upsert: true,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "The upload could not be prepared." };
  }
  return { ok: true, url: data.signedUrl, path };
}

/**
 * A short lived link to read one document.
 *
 * The ceiling is enforced here rather than left to the caller. A caller asking
 * for a week gets an hour, silently, because the alternative is that somebody
 * eventually passes a large number to make a demo easier and an identity
 * document ends up behind a link that works for a month.
 */
export async function signedOnboardingUrl(
  path: string,
  expiresInSeconds: number = SIGNED_URL_SECONDS,
): Promise<string | null> {
  if (!supabaseConfigured() || !path) return null;
  const seconds = Math.min(Math.max(30, Math.floor(expiresInSeconds)), MAX_SIGNED_URL_SECONDS);
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, seconds);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Remove a document. Used when an item is re-uploaded or an onboarding is purged. */
export async function removeOnboardingObject(path: string): Promise<boolean> {
  if (!supabaseConfigured() || !path) return false;
  const db = supabaseAdmin();
  if (!db) return false;
  const { error } = await db.storage.from(BUCKET).remove([path]);
  return !error;
}
