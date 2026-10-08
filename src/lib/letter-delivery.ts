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

async function fileForOrder(orderId: string): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db.from("eng_service_orders").select("file_id").eq("id", orderId).maybeSingle();
  return (data?.file_id as string | null) ?? null;
}

/** The sealed letters on an order's file that the customer may download. */
export async function customerLetters(orderId: string): Promise<CustomerLetter[]> {
  const db = supabaseAdmin();
  const fileId = await fileForOrder(orderId);
  if (!db || !fileId) return [];
  const { data: docs, error } = await db
    .from("eng_documents")
    .select("id, title, sealed_at")
    .eq("file_id", fileId)
    .eq("visibility", "client")
    .not("sealed_at", "is", null)
    .order("sealed_at", { ascending: false });
  if (error || !docs?.length) return [];
  const { data: acts, error: actsError } = await db
    .from("eng_seal_acts")
    .select("document_id")
    .in("document_id", docs.map((d) => d.id as string))
    .is("voided_at", null);
  if (actsError) return [];
  const live = new Set((acts ?? []).map((a) => a.document_id as string));
  return docs
    .filter((d) => live.has(d.id as string))
    .map((d) => ({ id: d.id as string, title: d.title as string, sealedAt: d.sealed_at as string }));
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
