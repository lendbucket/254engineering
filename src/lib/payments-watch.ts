import "server-only";
import { DB_NOW } from "./db-now";
import { supabaseAdmin } from "./supabase";
import { queueEmail } from "./ops-jobs";
import { unreleasedPaymentsAlert } from "./email-templates";
import { business } from "@/config/business";
import { ENVIRONMENT } from "./ops-observability";
import { UNRELEASED_AFTER_MINUTES, unreleasedPayments } from "./payment-events";

/**
 * Somebody watching for money that is written and work that is not released.
 * Operator ruling, 2026-10-12, on 0075: an event claimed and not done for more
 * than fifteen minutes is shown on the admin dashboard and reported by the
 * health watch.
 *
 * WHY IT RIDES ON THE HEALTH WATCH. The same reason the queue and retention
 * watchers do: it is a cheap read on a five minute schedule, and a second cron
 * is a second thing that can be missing from Vercel without anybody noticing.
 *
 * WHY ITS EMAIL IS QUEUED. The two direct sends are for a site that is down
 * and a queue that is not draining, where the queue cannot carry the news.
 * This is neither: the release that did not finish is a payment's own work, so
 * the alert goes through the queue like the rest of the firm's mail.
 *
 * ONE EMAIL AN HOUR AT MOST, through the same cooldown table the queue watcher
 * uses, stamped only when the email was actually queued.
 */

const KEY = "payments.unreleased";
export const UNRELEASED_COOLDOWN_MINUTES = 60;

export type PaymentsWatchResult = {
  looked: boolean;
  count: number | null;
  sent: boolean;
  note: string;
};

export async function watchUnreleasedPayments(now: number = Date.now()): Promise<PaymentsWatchResult> {
  const db = supabaseAdmin();
  if (!db) return { looked: false, count: null, sent: false, note: "no database" };

  const unreleased = await unreleasedPayments(now);
  if (unreleased === null) {
    return { looked: false, count: null, sent: false, note: "the payment event ledger could not be read" };
  }
  if (unreleased.length === 0) {
    return { looked: true, count: 0, sent: false, note: "no paid order is waiting for its work" };
  }

  const summary = `${unreleased.length} paid order${unreleased.length === 1 ? "" : "s"} waiting more than ${UNRELEASED_AFTER_MINUTES} minutes for the work to be released`;

  const { data: state, error: stateError } = await db
    .from("eng_alert_state")
    .select("last_alerted_at")
    .eq("key", KEY)
    .maybeSingle();
  if (stateError) {
    return {
      looked: false,
      count: unreleased.length,
      sent: false,
      note: `${summary}; the alert cooldown could not be read, so no email was decided: ${stateError.message}`,
    };
  }

  const last = state?.last_alerted_at ? Date.parse(state.last_alerted_at as string) : null;
  if (last !== null && now - last < UNRELEASED_COOLDOWN_MINUTES * 60_000) {
    return { looked: true, count: unreleased.length, sent: false, note: `${summary}; alerted within the hour` };
  }

  const queued = await queueEmail(
    unreleasedPaymentsAlert({
      payments: unreleased.slice(0, 10).map((u) => ({
        reference: u.reference,
        minutes: u.minutes,
        attempts: u.attempts,
        lastError: u.lastError,
      })),
      total: unreleased.length,
      afterMinutes: UNRELEASED_AFTER_MINUTES,
      cooldownMinutes: UNRELEASED_COOLDOWN_MINUTES,
      checkedAt: new Date(now).toISOString(),
      dashboardUrl: `${business.url}/portal`,
      environment: ENVIRONMENT,
    }),
  );
  if (!queued.ok) {
    return { looked: true, count: unreleased.length, sent: false, note: `${summary}; the alert could not be queued: ${queued.error}` };
  }

  const { error: stampError } = await db.from("eng_alert_state").upsert(
    { key: KEY, last_alerted_at: DB_NOW, detail: summary, updated_at: DB_NOW },
    { onConflict: "key" },
  );
  if (stampError) {
    console.error(`[payments-watch] the alert was queued but the cooldown was not recorded, so it will send again: ${stampError.message}`);
  }
  return { looked: true, count: unreleased.length, sent: true, note: `${summary}; alert queued` };
}
