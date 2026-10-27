import "server-only";
import { supabaseAdmin } from "./supabase";

/**
 * Signed uploads for documents a customer attaches to an order they are placing.
 *
 * WHY NOT REUSE src/lib/uploads.ts
 * --------------------------------
 * That module signs paths under an APPLICATION id and validates against the
 * career document kinds. An order is a different subject with a different key
 * space, and widening one function to serve both would mean a bug in either
 * path could write into the other's namespace. Two small modules that cannot
 * reach each other's paths is the cheaper failure.
 *
 * THE PATH IS KEYED ON THE DRAFT, NOT THE ORDER
 * ---------------------------------------------
 * A customer attaches documents before the order exists, so there is no order
 * id to key on yet. The client's idempotency key is used instead: it is already
 * required, already unique, already travels with the submission, and the
 * storage path lands on the order row when the order is created.
 *
 * The residual risk is the same one uploads.ts accepts and states: somebody
 * spending their own bandwidth writing junk into a private bucket under a
 * random id that no row will ever reference. The bucket is private, nothing is
 * readable without a separate signed download, and the bucket enforces its own
 * size and type limits.
 */

/** Exported so a quote request can refuse a file from anywhere else (ops-intake.ts, quoteFileProblem). */
export const ORDER_UPLOAD_BUCKET = "eng-uploads";
const BUCKET = ORDER_UPLOAD_BUCKET;

/** What a customer may attach. Narrower than the career flow on purpose. */
const ALLOWED = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
] as const;

/**
 * A PLAN FILE IS 40 MB, A PHOTOGRAPH STAYS AT 10. Robert's addendum of
 * 2026-10-25, item 4: "Raise the order upload limit to 40 MB for plan files
 * (PDF only for now)." Plans arrive as PDFs, and a sheet set at 10 MB was the
 * limit a customer met first. The bucket takes 40 MB since 0099 and stays the
 * last check; a photograph keeps the old limit, because nothing asked for it.
 */
export const ORDER_PDF_MAX_BYTES = 40 * 1024 * 1024;
export const ORDER_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** The limit for one content type, and how it reads to a customer. */
export function orderUploadLimit(contentType: string): { bytes: number; label: string } {
  return contentType === "application/pdf"
    ? { bytes: ORDER_PDF_MAX_BYTES, label: "40 MB" }
    : { bytes: ORDER_IMAGE_MAX_BYTES, label: "10 MB" };
}

/** Anything that is not a plain path segment is refused rather than sanitised. */
const SAFE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;

export type OrderUpload =
  | { ok: true; uploadUrl: string; token: string; bucket: string; storageKey: string }
  | { ok: false; error: string };

export async function signOrderUpload(params: {
  /** The client's idempotency key for the order being drafted. */
  draftId: string;
  /** The catalog input this document answers. */
  inputKey: string;
  filename: string;
  contentType: string;
  size: number;
  /**
   * Whose draft. A customer's order drafts under "orders"; a job the firm takes
   * by telephone drafts under "intake" (0078), so neither door can write into
   * the other's keys. A document a customer sends AFTER ordering, from their
   * tokened status page, lands under "status", keyed on the order's id
   * (addendum item 4), so it can never be mistaken for a draft's.
   */
  space?: "orders" | "intake" | "status";
  /** Only a PDF, for a slot that asks for a plan or a document rather than a photograph. */
  pdfOnly?: boolean;
}): Promise<OrderUpload> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "Uploads are not configured." };

  if (!SAFE.test(params.draftId)) return { ok: false, error: "That draft reference is not valid." };
  if (!SAFE.test(params.inputKey)) return { ok: false, error: "That document slot is not valid." };

  if (params.pdfOnly && params.contentType !== "application/pdf") {
    return { ok: false, error: "This document is taken as a PDF. Save or scan it as a PDF and attach that." };
  }
  if (!ALLOWED.includes(params.contentType as (typeof ALLOWED)[number])) {
    return { ok: false, error: "That file type is not accepted. Use a PDF or a photograph." };
  }
  if (!Number.isFinite(params.size) || params.size <= 0) {
    return { ok: false, error: "That file looks empty." };
  }
  const limit = orderUploadLimit(params.contentType);
  if (params.size > limit.bytes) {
    return { ok: false, error: `That file is over ${limit.label}. Please attach a smaller one.` };
  }

  /*
   * The extension is taken from the content type rather than the filename, so a
   * name the customer typed can never decide the path. The original name is not
   * used in the key at all.
   */
  const ext =
    params.contentType === "application/pdf"
      ? "pdf"
      : params.contentType === "image/png"
        ? "png"
        : params.contentType === "image/heic"
          ? "heic"
          : params.contentType === "image/webp"
            ? "webp"
            : "jpg";

  const storageKey = `${params.space ?? "orders"}/${params.draftId}/${params.inputKey}/${crypto.randomUUID()}.${ext}`;

  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(storageKey, {
    upsert: false,
  });
  if (error || !data) {
    return { ok: false, error: error?.message ?? "That upload could not be prepared." };
  }

  return {
    ok: true,
    uploadUrl: data.signedUrl,
    token: data.token,
    bucket: BUCKET,
    storageKey,
  };
}
