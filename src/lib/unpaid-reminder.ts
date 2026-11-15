import "server-only";
import { supabaseAdmin } from "./supabase";
import { issueCustomerLink } from "./ops-intake";
import { customerStatusUrl } from "./customer-link-url";
import { queueEmail } from "./ops-jobs";
import { orderUnpaidReminder } from "./email-templates";
import { money } from "./ops-money";
import { captureError } from "./ops-observability";
import { services } from "@/content/services";

/**
 * ===========================================================================
 * AN ORDER STARTED WITH AN EMAIL AND NOT PAID WITHIN 24 HOURS GETS ONE
 * REMINDER. NOTHING MORE. Robert's add-on of 2026-11-15, item 16.
 * ===========================================================================
 *
 * WHICH ORDERS. A web checkout: an order with no file (a job taken by
 * telephone has a file, and unpaid-followup.ts gives that one back to the rep
 * who took it as a task, which is a different answer to a different case),
 * still awaiting payment 24 hours after it was placed, with an email on it.
 *
 * ONCE, BY CONSTRUCTION. The order is claimed by a conditional update that
 * sets unpaid_reminder_sent_at only where it is still null (0137), BEFORE the
 * email is queued. Two workers racing for the same order: one update matches,
 * the other matches nothing and sends nothing. A failed queue leaves the stamp
 * in place, so a fault means no reminder rather than two; the order screen's
 * "waiting on payment" flag (order-attention.ts) still shows the order to the
 * office.
 *
 * Bounded per run, newest first, for the reason unpaid-followup.ts gives: a
 * batch filled with the oldest would never reach the order that just crossed
 * 24 hours. Proved by scripts/proofs/an-unpaid-order-is-reminded-once.mjs.
 */
export const REMINDER_AFTER_HOURS = 24;
export const REMINDER_BATCH = 50;

export async function sweepUnpaidOrderReminders(now: number = Date.now()): Promise<{ looked: boolean; sent: number; note: string }> {
  try {
    const db = supabaseAdmin();
    if (!db) return { looked: false, sent: 0, note: "the database is not configured" };
    const before = new Date(now - REMINDER_AFTER_HOURS * 3600_000).toISOString();
    const { data, error } = await db
      .from("eng_service_orders")
      .select("id, reference, customer_name, customer_email, property_address, service_slug, total_cents")
      .eq("status", "awaiting_payment")
      .is("file_id", null)
      .is("unpaid_reminder_sent_at", null)
      .eq("is_demo", false)
      .not("customer_email", "is", null)
      .lt("placed_at", before)
      .order("placed_at", { ascending: false })
      .limit(REMINDER_BATCH);
    if (error) {
      await captureError(new Error(`The unpaid orders could not be read: ${error.message}`), { kind: "unpaid-reminder", route: "/api/cron/jobs" });
      return { looked: false, sent: 0, note: `the read failed: ${error.message}` };
    }

    let sent = 0;
    for (const o of data ?? []) {
      /* The claim. Only the worker whose update matches a still-null stamp sends. */
      const { data: claimed, error: claimError } = await db
        .from("eng_service_orders")
        .update({ unpaid_reminder_sent_at: new Date(now).toISOString() })
        .eq("id", o.id)
        .is("unpaid_reminder_sent_at", null)
        .eq("status", "awaiting_payment")
        .select("id");
      if (claimError || !claimed || claimed.length !== 1) continue;

      const link = await issueCustomerLink({ orderId: o.id as string });
      if (!link) continue;
      const name = services.find((s) => s.slug === o.service_slug)?.name ?? "letter";
      const queued = await queueEmail(
        orderUnpaidReminder({
          customerName: (o.customer_name as string) || "Hello",
          customerEmail: o.customer_email as string,
          reference: o.reference as string,
          propertyAddress: o.property_address as string,
          serviceName: name,
          totalLine: money(o.total_cents as number),
          statusUrl: customerStatusUrl(o.reference as string, link.token),
        }),
        { orderId: o.id as string },
      );
      if (queued.ok) sent += 1;
    }
    return { looked: true, sent, note: `${sent} unpaid order reminder(s) queued` };
  } catch (err) {
    await captureError(err, { kind: "unpaid-reminder", route: "/api/cron/jobs" });
    return { looked: false, sent: 0, note: "the sweep threw" };
  }
}
