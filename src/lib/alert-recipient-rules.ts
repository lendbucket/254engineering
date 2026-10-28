/**
 * The rules for the alert list, pure so they are proven without a database.
 * Robert's addendum of 2026-10-25, item 8b; table eng_alert_recipients, 0099.
 */

/**
 * THE OFFICE'S ALERTS, BY TEMPLATE ID. An email with one of these ids and no
 * recipient of its own goes to the list (notify and queueEmail resolve it).
 * Every other operator email, an enquiry or an application, still goes to the
 * firm's notification address: those are not alerts. The proof asserts every
 * `ops.` template that composes without a recipient is named here, so a new
 * alert cannot quietly bypass the list.
 */
export const OFFICE_ALERT_IDS = [
  "ops.error_alert",
  "ops.queue_alert",
  "ops.outage",
  "ops.retention",
  "ops.payments_unreleased",
  "ops.refund_failed",
  "ops.files_overdue",
] as const;

export function isOfficeAlert(id: string): boolean {
  return (OFFICE_ALERT_IDS as readonly string[]).includes(id);
}

/** The live list, or the default address when the list is empty. Each address once. */
export function recipientsOrDefault(listed: string[], fallback: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of listed) {
    const email = normaliseRecipient(raw);
    if (email && !seen.has(email)) {
      seen.add(email);
      out.push(email);
    }
  }
  return out.length ? out : [fallback];
}

/** A typed address, trimmed and lowercased, or null when it is not one. Mirrors 0099's check. */
export function normaliseRecipient(raw: string): string | null {
  const email = String(raw ?? "").trim().toLowerCase();
  if (email.length > 254) return null;
  return /^[^@\s]+@[^@\s]+[.][^@\s]+$/.test(email) ? email : null;
}
