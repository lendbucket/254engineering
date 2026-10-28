import "server-only";
import { DB_NOW } from "./db-now";
import { supabaseAdmin } from "./supabase";
import { writeAuditOrRefuse } from "./ops-audit";
import { can, type Actor } from "./ops-authz";
import { normaliseRecipient } from "./alert-recipient-rules";

/**
 * THE OWNER EDITS WHERE THE OFFICE'S ALERTS GO. Robert's addendum of
 * 2026-10-25, item 8b; table eng_alert_recipients, 0099. Reading the list at
 * send time is src/lib/alert-addresses.ts.
 *
 * alerts.manage, the owner alone. Every change writes its audit row first and
 * refuses if that row cannot be written, because who was told about the
 * firm's faults, and from when, is a fact somebody will be asked for.
 */

export type AlertRecipientRow = { id: string; email: string; addedAt: string };

/** The live list for the settings screen. Null is a failed read, never an empty list. */
export async function listAlertRecipients(): Promise<AlertRecipientRow[] | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("eng_alert_recipients")
    .select("id, email, created_at")
    .is("removed_at", null)
    .order("created_at", { ascending: true });
  if (error) return null;
  return (data ?? []).map((r) => ({ id: String(r.id), email: String(r.email), addedAt: String(r.created_at) }));
}

export async function addAlertRecipient(
  actor: Actor,
  rawEmail: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!can(actor, "alerts.manage")) return { ok: false, error: "Not permitted." };
  const email = normaliseRecipient(rawEmail);
  if (!email) return { ok: false, error: "That is not an email address. Type it as name@example.com." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured, so nothing was changed." };

  const recorded = await writeAuditOrRefuse({
    actor,
    action: "alerts.recipient_added",
    entityType: "alert_recipient",
    entityId: null,
    summary: `${email} now receives the office's alerts.`,
    diff: { email },
  });
  if (!recorded.ok) return recorded;

  const { error } = await db.from("eng_alert_recipients").insert({ email, added_by: actor.id });
  if (error) {
    return {
      ok: false,
      error: /duplicate|unique/i.test(error.message)
        ? `${email} already receives the alerts.`
        : `The address could not be added: ${error.message}`,
    };
  }
  return { ok: true };
}

export async function removeAlertRecipient(
  actor: Actor,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!can(actor, "alerts.manage")) return { ok: false, error: "Not permitted." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured, so nothing was changed." };

  const { data: row, error: readError } = await db
    .from("eng_alert_recipients")
    .select("id, email, removed_at")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { ok: false, error: `The list could not be read: ${readError.message}` };
  if (!row) return { ok: false, error: "That address is not on the list." };
  if (row.removed_at) return { ok: false, error: `${row.email} was already removed.` };

  const recorded = await writeAuditOrRefuse({
    actor,
    action: "alerts.recipient_removed",
    entityType: "alert_recipient",
    entityId: id,
    summary: `${row.email} no longer receives the office's alerts.`,
    diff: { email: row.email },
  });
  if (!recorded.ok) return recorded;

  const { error } = await db
    .from("eng_alert_recipients")
    .update({ removed_at: DB_NOW, removed_by: actor.id })
    .eq("id", id)
    .is("removed_at", null);
  if (error) return { ok: false, error: `The address could not be removed: ${error.message}` };
  return { ok: true };
}
