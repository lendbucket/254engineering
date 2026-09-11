import "server-only";
import { DB_NOW } from "./db-now";
import { supabaseAdmin } from "./supabase";
import { queueHealth } from "./ops-jobs";
import { queueAlert } from "./email-templates";
import { notify } from "./notify";
import { business } from "@/config/business";
import { ENVIRONMENT } from "./ops-observability";
import {
  QUEUE_COOLDOWN_MINUTES,
  decideQueueAlert,
  type QueueDecision,
} from "./queue-alert";

/**
 * Somebody watching the queue.
 *
 * WHAT WAS MISSING, AND WHY IT MATTERED MORE THAN IT SOUNDS
 * ----------------------------------------------------------
 * Recorded in docs/platform-state.md: alerting on queue depth is not built, and
 * nothing watches it. The depth was on the status page, which means the
 * platform's answer to "the worker stopped an hour ago" was that somebody had
 * to already suspect it and go and look.
 *
 * Everything this firm sends leaves through that queue. A receipt, an invite, a
 * dispatch offer, a password link, the fault sweep itself. A worker that stops
 * is silent in exactly the way the 2026-09-03 outage was silent, and the outage
 * watcher would not catch it: the site answers 200 the whole time, because the
 * site is fine and only the work is not happening.
 *
 * WHY IT RIDES ON THE OUTAGE WATCHER'S SCHEDULE
 * ---------------------------------------------
 * Every five minutes is right for it, the cooldown is an hour, and the one
 * thing it must not do is run on the queue. The error alert sweep is a queued
 * job precisely because it is allowed to wait; this one is not allowed to wait,
 * for the same reason its email is not queued.
 *
 * WHY THE EMAIL IS SENT DIRECTLY
 * ------------------------------
 * The second deliberate exception to "all mail goes through the queue", after
 * the outage alert, and it is the sharper case: an alert about a queue that is
 * not draining, placed in that queue, is an alert that arrives when the problem
 * goes away on its own. jobs-audit asserts both exceptions by name so a later
 * tidy cannot remove them quietly.
 */

const KEY = "queue.depth";

export type QueueWatchResult = {
  /** Null when the queue could not be read at all, which is not the same as empty. */
  looked: boolean;
  decision: QueueDecision | null;
  sent: boolean;
  note: string;
};

export async function watchQueue(now: number = Date.now()): Promise<QueueWatchResult> {
  const db = supabaseAdmin();
  if (!db) return { looked: false, decision: null, sent: false, note: "no database" };

  const health = await queueHealth();
  /*
   * A failed read is NOT an empty queue, and queueHealth already returns null
   * rather than zeros for that reason. Reporting "nothing to alert about"
   * because the read failed is the exact shape of defect the status page was
   * built to remove.
   */
  if (!health) return { looked: false, decision: null, sent: false, note: "the queue could not be read" };

  /*
   * THE COOLDOWN READ IS CHECKED, AND THIS FILE ALREADY KNEW WHY.
   *
   * Six lines above, queueHealth's failure is handled with the comment "A
   * failed read is NOT an empty queue". This read then discarded its error and
   * let a missing row and a broken table produce the same answer: no cooldown,
   * which is the PERMISSIVE direction. The module stated the principle for one
   * read and violated it for the next.
   *
   * It was not hypothetical. Migration 0023 created eng_alert_state and was
   * never applied to production after its branch merged, so on production this
   * select fails on a table that does not exist, every five minutes, silently.
   * The consequence was latent rather than absent: the first time the queue
   * went deep enough to alert, the cooldown would have read as "never alerted",
   * the upsert that records the send would have failed on the same missing
   * table, and the operator would have been emailed every five minutes about a
   * stuck queue. That is the exact failure 0023 was written to prevent, caused
   * by 0023 being missing and nothing saying so.
   *
   * Neither direction is safe as a default here. Treating a failed read as
   * "never alerted" spams; treating it as "recently alerted" silences a real
   * outage. So it does what this function already does when it cannot see the
   * queue: it reports that it could not look, which is a state somebody can
   * find, rather than an answer it has no basis for.
   */
  const { data: state, error: stateError } = await db
    .from("eng_alert_state")
    .select("last_alerted_at")
    .eq("key", KEY)
    .maybeSingle();

  if (stateError) {
    console.error(
      `[queue-watch] the alert cooldown could not be read, so no decision was made: ${stateError.message}`,
    );
    return {
      looked: false,
      decision: null,
      sent: false,
      note: `the alert cooldown could not be read: ${stateError.message}`,
    };
  }

  const decision = decideQueueAlert(
    {
      pending: health.pending,
      overdue: health.overdue,
      dead: health.dead,
      oldestOverdueSeconds: health.oldestWaitingSeconds,
      lastAlertedAtMs: state?.last_alerted_at ? Date.parse(state.last_alerted_at as string) : null,
    },
    now,
  );

  if (!decision.send) {
    return { looked: true, decision, sent: false, note: decision.because };
  }

  const oldestMinutes = Math.floor((health.oldestWaitingSeconds ?? 0) / 60);
  const worst = [...health.byKind]
    .filter((k) => k.pending > 0 || k.dead > 0)
    .sort((a, b) => b.pending + b.dead - (a.pending + a.dead))
    .slice(0, 3);

  const result = await notify(
    queueAlert({
      reason: decision.reason,
      headline: decision.headline,
      because: decision.because,
      pending: health.pending,
      overdue: health.overdue,
      dead: health.dead,
      oldestOverdueMinutes: oldestMinutes,
      worst,
      checkedAt: new Date(now).toISOString(),
      cooldownMinutes: QUEUE_COOLDOWN_MINUTES,
      statusUrl: `${business.url}/portal/status`,
      environment: ENVIRONMENT,
    }),
  );

  /*
   * THE COOLDOWN IS STAMPED ONLY IF THE EMAIL ACTUALLY LEFT.
   *
   * Stamping first would be simpler and would mean a send that failed silently
   * bought an hour of silence: the operator would hear nothing about a stalled
   * queue because the platform had already recorded telling them. So a failure
   * to send leaves the state alone, and the next run five minutes later tries
   * again.
   */
  if (result.sent) {
    const { error: stampError } = await db.from("eng_alert_state").upsert(
      {
        key: KEY,
        last_alerted_at: DB_NOW,
        detail: `${decision.reason}: ${decision.because}`,
        updated_at: DB_NOW,
      },
      { onConflict: "key" },
    );

    /*
     * A stamp that did not land means the next run has no cooldown to find, so
     * the operator gets this same alert again in five minutes and every five
     * minutes after. That is the failure this table exists to prevent, and an
     * unchecked upsert is how it would happen without anybody being told.
     */
    if (stampError) {
      console.error(
        `[queue-watch] the alert was SENT but the cooldown was not recorded, so it will send again: ${stampError.message}`,
      );
    }
  } else {
    console.error(`[queue-watch] could not send the queue alert: ${result.outcome}`);
  }

  return {
    looked: true,
    decision,
    sent: result.sent,
    note: `${decision.reason}: ${decision.because}`,
  };
}
