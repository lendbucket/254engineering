import "server-only";
import { supabaseAdmin } from "./supabase";
import { business } from "@/config/business";
import { recipientsOrDefault } from "./alert-recipient-rules";

/**
 * WHERE THE OFFICE'S ALERTS GO, READ AT SEND TIME. Robert's addendum of
 * 2026-10-25, item 8b: "Alert recipients become a list the owner edits in the
 * portal (default: Robert's email)." Table eng_alert_recipients, 0099.
 *
 * Read by notify() and queueEmail() for an office alert that names no
 * recipient, so every alert reaches the list without each sender being edited,
 * and the outage and queue alerts keep their own direct send.
 *
 * THE DEFAULT IS THE DECLARED VALUE, NEVER A COPY. An empty list means
 * business.notificationEmail, where every operator email already went.
 *
 * A FAILED OR SLOW READ FALLS BACK TO THE DEFAULT AND SAYS SO. An alert is how
 * the firm hears that something is wrong, and the outage alert is sent when the
 * site or the database may be down. One that reaches nobody because the list
 * could not be read is the failure alerting exists to prevent, so the read is
 * bounded and its failure sends to the default address with a log line.
 */

export type AlertAddresses = {
  to: string[];
  source: "list" | "default";
  /** Set when the list could not be read and the default was used instead. */
  unread: string | null;
};

const READ_LIMIT_MS = 4000;

export async function officeAlertAddresses(): Promise<AlertAddresses> {
  const fallback = (why: string): AlertAddresses => {
    console.error(`[alert-addresses] the list could not be read, so this alert goes to the default address: ${why}`);
    return { to: [business.notificationEmail], source: "default", unread: why };
  };
  const db = supabaseAdmin();
  if (!db) return fallback("no database");
  try {
    const read = db.from("eng_alert_recipients").select("email").is("removed_at", null);
    const timeout = new Promise<{ data: null; error: { message: string } }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: { message: `no answer in ${READ_LIMIT_MS} ms` } }), READ_LIMIT_MS),
    );
    const { data, error } = await Promise.race([read, timeout]);
    if (error) return fallback(error.message);
    const listed = (data ?? []).map((r: { email: unknown }) => String(r.email));
    return {
      to: recipientsOrDefault(listed, business.notificationEmail),
      source: listed.length ? "list" : "default",
      unread: null,
    };
  } catch (err) {
    return fallback(err instanceof Error ? err.message : "the read threw");
  }
}
