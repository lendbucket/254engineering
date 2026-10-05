import "server-only";
import { DB_NOW } from "./db-now";
import { supabaseAdmin } from "./supabase";
import { retentionReadiness } from "./ops-retention";
import { sweepable } from "./ops-retention";
import { opsNotification } from "./email-templates";
import { notify } from "./notify";
import { business } from "@/config/business";
import { emailIdentity } from "@/config/email-identity";
import {
  RETENTION_STALL_COOLDOWN_MINUTES,
  decideRetentionStall,
  type RetentionStallDecision,
  type TableReadiness,
} from "./retention-stall";

/**
 * Somebody watching whether retention can still run at all.
 *
 * The reasoning for its existence is at the top of `retention-stall.ts`. This
 * file is the part that touches the world: it reads, it decides with the pure
 * function, it sends, and it stamps the cooldown. Every awkward decision in it
 * is copied deliberately from `queue-watch.ts`, because that module has already
 * been through the failures this one would otherwise repeat.
 */

const KEY = "retention.stalled";

export type RetentionWatchResult = {
  /** False when it could not establish the state, which is not the same as healthy. */
  looked: boolean;
  decision: RetentionStallDecision | null;
  sent: boolean;
  note: string;
};

export async function watchRetention(now = Date.now()): Promise<RetentionWatchResult> {
  const db = supabaseAdmin();
  if (!db) {
    return { looked: false, decision: null, sent: false, note: "the database is not configured" };
  }

  /*
   * THE SUBJECT IS DERIVED FROM THE DECLARATION, never listed here.
   *
   * `sweepable()` reads retention-policy.ts, which is the one place that says
   * which tables retention may delete from. A list in this file would be a
   * second account of that, and the day a third table became deletable this
   * watcher would go on watching two and report that everything was fine.
   */
  const tables = sweepable();

  const readiness: TableReadiness[] = [];
  for (const table of tables) {
    const ready = await retentionReadiness(db, table);
    readiness.push({
      table,
      ok: ready.ok,
      because: ready.ok ? null : ready.because,
    });
  }

  /*
   * THE COOLDOWN READ IS CHECKED, AND NEITHER DIRECTION IS A SAFE DEFAULT.
   *
   * Copied from queue-watch, including the reason, because the reason is what
   * makes it right. Treating a failed read as "never alerted" emails the
   * operator every five minutes; treating it as "recently alerted" silences a
   * real stall. So it reports that it could not look, which is a state somebody
   * can find, rather than an answer it has no basis for.
   *
   * This is not hypothetical for `eng_alert_state` specifically: migration 0023
   * created that table and was not applied to production for a day after its
   * branch merged, so a select against it failed silently on production every
   * five minutes.
   */
  const { data: state, error: stateError } = await db
    .from("eng_alert_state")
    .select("last_alerted_at")
    .eq("key", KEY)
    .maybeSingle();

  if (stateError) {
    console.error(
      `[retention-watch] the alert cooldown could not be read, so no decision was made: ${stateError.message}`,
    );
    return {
      looked: false,
      decision: null,
      sent: false,
      note: `the alert cooldown could not be read: ${stateError.message}`,
    };
  }

  const decision = decideRetentionStall(
    {
      tables: readiness,
      lastAlertedAtMs: state?.last_alerted_at ? Date.parse(state.last_alerted_at as string) : null,
    },
    now,
  );

  if (!decision.send) {
    return { looked: true, decision, sent: false, note: decision.because };
  }

  /*
   * EVERY STALLED TABLE'S OWN SENTENCE GOES IN THE EMAIL, not a count.
   *
   * The planner's refusals name the DAY and the figures, which is the whole
   * reason they were written that way: "the rollup did not reconcile" sends
   * somebody looking through a month. An alert that said "retention is stalled
   * on 1 table" would throw that away and the operator would have to go and
   * reproduce it.
   */
  const body = [
    decision.because,
    "",
    ...decision.stalled.map((t) => `${t.table}: ${t.because ?? "no reason was given"}`),
    "",
    `Nothing has been deleted and nothing is at risk. The next check is in ${RETENTION_STALL_COOLDOWN_MINUTES} minutes at the earliest.`,
  ].join("\n");

  const result = await notify(
    opsNotification({
      to: emailIdentity.senders.operator.replyTo,
      title: decision.headline,
      body,
      href: `${business.url}/portal/status`,
    }),
  );

  /*
   * THE COOLDOWN IS STAMPED ONLY IF THE EMAIL ACTUALLY LEFT. Stamping first
   * would mean a send that failed silently bought an hour of silence: the
   * operator would hear nothing about a stalled retention because the platform
   * had already recorded telling them.
   */
  if (result.sent) {
    const { error: stampError } = await db.from("eng_alert_state").upsert(
      {
        key: KEY,
        last_alerted_at: DB_NOW,
        detail: decision.headline,
        updated_at: DB_NOW,
      },
      { onConflict: "key" },
    );

    if (stampError) {
      console.error(
        `[retention-watch] the alert was sent and the cooldown was NOT stamped: ${stampError.message}. ` +
          "The next run has no cooldown to find, so this alert will repeat.",
      );
    }
  }

  return {
    looked: true,
    decision,
    sent: result.sent,
    note: result.sent ? decision.headline : `the alert could not be sent: ${result.reason ?? "unknown"}`,
  };
}
