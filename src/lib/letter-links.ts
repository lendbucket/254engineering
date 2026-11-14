import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { DB_NOW } from "./db-now";

/**
 * ===========================================================================
 * A LINK TO ONE SEALED LETTER FOR ONE COPY CONTACT, AND NOTHING ELSE OF THE
 * ORDER. The Killeen call, item 7, with Robert's answer 3 of 2026-11-14; table
 * eng_letter_links (0133).
 * ===========================================================================
 *
 * Minted and hashed exactly as the customer's own link is (issueCustomerLink):
 * 32 random bytes, only the sha256 stored, 120 days, revocation the control.
 * The link resolves to an order and a document and nothing more; the download
 * then asks customerLetterFor, the customer's own check, so a voided seal or a
 * letter that is not this order's refuses here as it does there.
 *
 * The token travels as /letter/<id>?token=..., and the proxy exchanges it for a
 * cookie scoped to that one letter on first visit (link-cookie.ts), so it leaves
 * the address as every other tokened link does (Robert's answer L6).
 */
export const LETTER_LINK_DAYS = 120;

export async function issueLetterLink(input: {
  orderId: string;
  documentId: string;
  contactId: string;
}): Promise<{ ok: true; id: string; token: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  const expiresAt = new Date(Date.now() + LETTER_LINK_DAYS * 24 * 60 * 60 * 1000);
  const { data, error } = await db
    .from("eng_letter_links")
    .insert({
      order_id: input.orderId,
      document_id: input.documentId,
      contact_id: input.contactId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: `The letter link could not be made: ${error?.message ?? "no row came back"}` };
  return { ok: true, id: data.id as string, token };
}

/**
 * What a letter link opens: its order and its one document, or null. Never says
 * which of "unknown", "revoked", "expired" or "another link's id" it was.
 */
export async function letterForLink(id: string, token: string): Promise<{ orderId: string; documentId: string; contactId: string } | null> {
  const db = supabaseAdmin();
  if (!db || !id || !token) return null;
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  const { data } = await db
    .from("eng_letter_links")
    .select("id, order_id, document_id, contact_id, expires_at, revoked_at")
    .eq("id", id)
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  if (new Date(data.expires_at as string).getTime() <= Date.now()) return null;
  await db.from("eng_letter_links").update({ last_seen_at: DB_NOW }).eq("id", data.id);
  return { orderId: data.order_id as string, documentId: data.document_id as string, contactId: data.contact_id as string };
}
