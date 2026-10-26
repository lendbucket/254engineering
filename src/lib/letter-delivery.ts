import "server-only";
import { supabaseAdmin } from "./supabase";
import { sealedLetterBytes } from "./letter-seal";
import { writeAudit } from "./ops-audit";

/**
 * ===========================================================================
 * DELIVERY: WHICH SEALED LETTERS AN ORDER'S CUSTOMER MAY HAVE, AND THE BYTES.
 * ===========================================================================
 *
 * Sealing piece two. Control 10 in docs/sealing-controls.md: no customer sees
 * anything before sealing. A document is the customer's only when it sits on
 * the order's own file, is sealed, is marked visible to the client, and its
 * seal act is live. Everything else is invisible to them, including a letter
 * sealed and later voided.
 */

export type CustomerLetter = { id: string; title: string; sealedAt: string };

/**
 * The sealed letters on an order's file that the customer may download, or a
 * failed read said as one. Robert's audit of 2026-10-24, finding F29: every
 * read here answered a failure with an empty list, so a sealed letter
 * vanished from the customer's page with nothing saying anything was missing.
 */
export async function customerLettersRead(orderId: string): Promise<{ ok: true; letters: CustomerLetter[] } | { ok: false }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false };
  const { data: order, error: orderError } = await db.from("eng_service_orders").select("file_id").eq("id", orderId).maybeSingle();
  if (orderError) return { ok: false };
  const fileId = (order?.file_id as string | null) ?? null;
  /* No file yet is a real empty: nothing can have been sealed. */
  if (!fileId) return { ok: true, letters: [] };
  const { data: docs, error } = await db
    .from("eng_documents")
    .select("id, title, sealed_at")
    .eq("file_id", fileId)
    .eq("visibility", "client")
    .not("sealed_at", "is", null)
    .order("sealed_at", { ascending: false });
  if (error) return { ok: false };
  if (!docs?.length) return { ok: true, letters: [] };
  const { data: acts, error: actsError } = await db
    .from("eng_seal_acts")
    .select("document_id")
    .in("document_id", docs.map((d) => d.id as string))
    .is("voided_at", null);
  if (actsError) return { ok: false };
  const live = new Set((acts ?? []).map((a) => a.document_id as string));
  return {
    ok: true,
    letters: docs
      .filter((d) => live.has(d.id as string))
      .map((d) => ({ id: d.id as string, title: d.title as string, sealedAt: d.sealed_at as string })),
  };
}

/** The same list, for the download check, where a failed read is a refusal and an empty list says exactly that. */
export async function customerLetters(orderId: string): Promise<CustomerLetter[]> {
  const read = await customerLettersRead(orderId);
  return read.ok ? read.letters : [];
}

/** One letter's bytes for an order's customer, or a refusal that names nothing. */
export async function customerLetterFor(
  orderId: string,
  documentId: string,
): Promise<{ ok: true; bytes: Uint8Array; filename: string } | { ok: false }> {
  const mine = await customerLetters(orderId);
  if (!mine.some((l) => l.id === documentId)) return { ok: false };
  const read = await sealedLetterBytes(documentId);
  if (!read.ok) {
    console.error(`[delivery] ${documentId} was refused to its customer: ${read.error}`);
    return { ok: false };
  }
  await writeAudit({
    actor: { id: null, role: "customer" },
    action: "document.customer_download",
    entityType: "document",
    entityId: documentId,
    summary: "The customer downloaded the sealed letter through the order link.",
  });
  return { ok: true, bytes: read.bytes, filename: `254-letter-${documentId.slice(0, 8)}.pdf` };
}
