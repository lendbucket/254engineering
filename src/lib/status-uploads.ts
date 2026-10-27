import "server-only";
import { supabaseAdmin } from "./supabase";
import { fieldsFor } from "@data/intake-fields";
import { orderForCustomerToken, event } from "./ops-intake";
import { answersFor, AnswersUnreadable } from "./ops-file-inputs";
import { signOrderUpload, ORDER_UPLOAD_BUCKET, type OrderUpload } from "./order-uploads";
import { writeAudit } from "./ops-audit";
import { requestedSlots, statusUploadKeyProblem, type UploadSlot } from "./status-upload-rules";

/**
 * DOCUMENTS A CUSTOMER SENDS AFTER ORDERING, FROM THEIR TOKENED STATUS PAGE.
 * Robert's addendum of 2026-10-25, item 4.
 *
 * The token is the credential, as it is for the page and for the sealed letter
 * download: every call resolves it again, and a bad, revoked or expired token
 * answers exactly as an unknown one does. The upload goes straight to the
 * private bucket through a signed URL, under status/<order>/<slot>/, and is
 * then RECORDED on the file as the answer to that slot, with where it landed,
 * so the firm's screens see it as attached rather than as nothing.
 */

/** The one answer for no token, a wrong one, a revoked one and an expired one, so none tells a guesser anything. */
export const STATUS_UPLOAD_NOT_HERE = "This link does not open an order. Use the link in your most recent email from the firm.";
const NOT_HERE = STATUS_UPLOAD_NOT_HERE;

type Subject = { orderId: string; fileId: string; serviceSlug: string; tier: string };

async function subjectFor(token: string): Promise<{ ok: true; subject: Subject } | { ok: false; error: string }> {
  const access = await orderForCustomerToken(token);
  if (!access?.orderId) return { ok: false, error: NOT_HERE };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "Uploads are not configured." };
  const { data: order, error } = await db
    .from("eng_service_orders")
    .select("id, file_id, service_slug, tier")
    .eq("id", access.orderId)
    .maybeSingle();
  if (error) return { ok: false, error: "Your order could not be read just now. Try again in a minute." };
  if (!order) return { ok: false, error: NOT_HERE };
  if (!order.file_id) return { ok: false, error: "The firm has not opened the work on this order yet, so there is nothing to send documents to." };
  return {
    ok: true,
    subject: {
      orderId: order.id as string,
      fileId: order.file_id as string,
      serviceSlug: order.service_slug as string,
      tier: (order.tier as string | null) ?? "standard",
    },
  };
}

/** The documents the firm is waiting on for this order, for the status page. */
export async function requestedDocuments(
  orderId: string,
): Promise<{ ok: true; slots: UploadSlot[] } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "the documents the firm is waiting on" };
  const { data: order, error } = await db
    .from("eng_service_orders")
    .select("file_id, service_slug, tier")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !order) return { ok: false, error: "the documents the firm is waiting on" };
  if (!order.file_id) return { ok: true, slots: [] };
  try {
    const answers = await answersFor(order.file_id as string);
    return { ok: true, slots: requestedSlots(fieldsFor(order.service_slug as string, (order.tier as string | null) ?? "standard"), answers) };
  } catch (err) {
    if (err instanceof AnswersUnreadable) return { ok: false, error: "the documents the firm is waiting on" };
    throw err;
  }
}

async function slotFor(subject: Subject, fieldId: string): Promise<{ ok: true; slot: UploadSlot } | { ok: false; error: string }> {
  try {
    const answers = await answersFor(subject.fileId);
    const slot = requestedSlots(fieldsFor(subject.serviceSlug, subject.tier), answers).find((s) => s.id === fieldId);
    return slot ? { ok: true, slot } : { ok: false, error: "The firm is not waiting on that document, or it has already arrived." };
  } catch (err) {
    if (err instanceof AnswersUnreadable) return { ok: false, error: "What the firm is waiting on could not be read just now. Try again in a minute." };
    throw err;
  }
}

export async function signStatusUpload(input: {
  token: string;
  fieldId: string;
  filename: string;
  contentType: string;
  size: number;
}): Promise<OrderUpload> {
  const found = await subjectFor(input.token);
  if (!found.ok) return found;
  const slot = await slotFor(found.subject, input.fieldId);
  if (!slot.ok) return slot;
  return signOrderUpload({
    draftId: found.subject.orderId,
    inputKey: input.fieldId,
    filename: input.filename,
    contentType: input.contentType,
    size: input.size,
    space: "status",
    /* A plan or a document is a PDF, for now; a photograph slot takes a photograph. */
    pdfOnly: !slot.slot.photo,
  });
}

export async function recordStatusUpload(input: {
  token: string;
  fieldId: string;
  storageKey: string;
  contentType: string;
  byteSize: number;
}): Promise<{ ok: true; label: string } | { ok: false; error: string }> {
  const found = await subjectFor(input.token);
  if (!found.ok) return found;
  const { subject } = found;
  const slot = await slotFor(subject, input.fieldId);
  if (!slot.ok) return slot;

  const keyProblem = statusUploadKeyProblem(subject.orderId, input.fieldId, input.storageKey);
  if (keyProblem) return { ok: false, error: keyProblem };

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "Uploads are not configured." };

  /* The object must be there before it is recorded as attached: a row naming a file that never arrived reads as received. */
  const folder = input.storageKey.slice(0, input.storageKey.lastIndexOf("/"));
  const name = input.storageKey.slice(input.storageKey.lastIndexOf("/") + 1);
  const { data: listed, error: listError } = await db.storage.from(ORDER_UPLOAD_BUCKET).list(folder, { search: name });
  if (listError) return { ok: false, error: "The upload could not be checked just now. Try again in a minute." };
  if (!(listed ?? []).some((o) => o.name === name)) return { ok: false, error: "The file did not arrive. Choose it and send it again." };

  const { error } = await db.from("eng_file_inputs").upsert(
    {
      file_id: subject.fileId,
      field_id: input.fieldId,
      value_text: "Sent by the customer from their status page",
      source: "customer",
      recorded_by: null,
      bucket: ORDER_UPLOAD_BUCKET,
      storage_key: input.storageKey,
      content_type: input.contentType || null,
      byte_size: Number.isFinite(input.byteSize) && input.byteSize > 0 ? input.byteSize : null,
    },
    { onConflict: "file_id,field_id" },
  );
  if (error) return { ok: false, error: "The document arrived and could not be recorded. Try again, or reply to the firm's email." };

  await event(subject.orderId, "customer.document_received", true, `Document received: ${slot.slot.label}.`, {
    field: input.fieldId,
  });
  await writeAudit({
    actor: { id: null, role: "customer" },
    action: "file.customer_document_received",
    entityType: "file",
    entityId: subject.fileId,
    summary: `The customer sent ${slot.slot.label} from their status page.`,
    diff: { field: input.fieldId, storage_key: input.storageKey },
  });
  return { ok: true, label: slot.slot.label };
}
