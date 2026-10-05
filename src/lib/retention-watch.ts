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

/** The cooldown as a sentence, derived so it cannot disagree with the constant. */
function cooldownInWords(): string {
  const minutes = RETENTION_STALL_COOLDOWN_MINUTES;
  if (minutes % (60 * 24) === 0) {
    const days = minutes / (60 * 24);
    return days === 1
      ? "This will not repeat for a day."
      : `This will not repeat for ${days} days.`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1
      ? "This will not repeat for an hour."
      : `This will not repeat for ${hours} hours.`;
  }
  return `This will not repeat for ${minutes} minutes.`;
}

export type RetentionWatchResult = {
  /** False when it could not establish the state, which is not the same as healthy. */
  looked: boolean;
  decision: RetentionStallDecision | null;
  sent: boolean;
  note: string;
};

/**
 * THE CLIENT IS A PARAMETER SO THE READ ORDER CAN BE PROVED.
 *
 * `supabaseAdmin()` by default, so every caller is unchanged. The proof passes
 * a fake that records which tables were touched, which is the only way to
 * assert the property below as BEHAVIOUR rather than as the order two lines
 * happen to appear in a file. A source-text check would have been a proxy, and
 * a proxy for an ordering is worth very little: moving one `await` past another
 * is exactly the edit that keeps the text plausible and changes what runs.
 */
export async function watchRetention(
  now = Date.now(),
  db = supabaseAdmin(),
): Promise<RetentionWatchResult> {
  if (!db) {
    return { looked: false, decision: null, sent: false, note: "the database is not configured" };
  }

  /*
   * ======================================================================
   * THE COOLDOWN IS READ FIRST, AND IT RETURNS BEFORE TOUCHING A SOURCE
   * TABLE. Operator ruling, 2026-10-05.
   * ======================================================================
   *
   * THE FIRST VERSION HAD THIS THE OTHER WAY ROUND and it was pure waste that
   * would never have announced itself. `retentionReadiness` calls `planned()`,
   * which uses `readEvery` and therefore pages EVERY candidate row rather than
   * sampling. On production that is about 1,846 rows across the two tables,
   * every five minutes, roughly 531,000 row reads a day, to answer a question
   * whose answer is then discarded 287 times out of 288 by the cooldown.
   *
   * Nothing about the result was wrong, which is what made it invisible: the
   * alert worked, the figures were right, and the cost sat in a cron nobody
   * reads. It was found by working out what the thing would actually do in
   * production once it was live, not by any check.
   *
   * SO THE ORDER IS THE WHOLE FIX and the proof asserts it with a fake client
   * that records every table it is asked for. Inside the cooldown, the only
   * table touched is `eng_alert_state`.
   *
   * AND THE CHECKED READ IS UNCHANGED, including the reason, because the reason
   * is what makes it right. Treating a failed read as "never alerted" emails
   * the operator every five minutes; treating it as "recently alerted" silences
   * a real stall. So it reports that it could not look, which is a state
   * somebody can find, rather than an answer it has no basis for. Not
   * hypothetical for this table: migration 0023 created `eng_alert_state` and
   * was not applied to production for a day after its branch merged, so a
   * select against it failed silently every five minutes.
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

  const lastAlertedAtMs = state?.last_alerted_at
    ? Date.parse(state.last_alerted_at as string)
    : null;

  /*
   * INSIDE THE COOLDOWN, NOTHING ELSE IS READ AT ALL.
   *
   * `looked` is FALSE here, and that is deliberate rather than sloppy. The
   * field means "this run established the state of retention", and this run did
   * not: it established that the firm was told recently. Reporting `looked:
   * true` would make a suppressed run indistinguishable from one that checked
   * both tables and found them healthy, which is the absent-versus-zero
   * failure in a telemetry field.
   */
  if (lastAlertedAtMs !== null) {
    const sinceMinutes = Math.floor((now - lastAlertedAtMs) / 60_000);
    if (sinceMinutes < RETENTION_STALL_COOLDOWN_MINUTES) {
      return {
        looked: false,
        decision: null,
        sent: false,
        note:
          `the firm was told ${sinceMinutes} minute(s) ago, inside the ` +
          `${RETENTION_STALL_COOLDOWN_MINUTES} minute cooldown, so no table was read`,
      };
    }
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
   * The pure rule still receives the cooldown, even though the early return
   * above has already handled it. That is not redundant: the rule is the one
   * place that decides, this function is the one place that avoids work, and
   * removing the parameter would move a decision out of the tested function and
   * into an untested branch.
   */
  const decision = decideRetentionStall({ tables: readiness, lastAlertedAtMs }, now);

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
    /*
     * SAID THE WAY A PERSON SAYS IT. The cooldown moved to 1440 minutes and
     * this sentence read "the next check is in 1440 minutes at the earliest",
     * which nobody says and which reads as a machine quoting its own constant.
     * It is derived from the constant rather than typed, so the two cannot
     * disagree, and the plural is handled because "in 1 days" is the other way
     * a generated sentence announces itself.
     */
    `Nothing has been deleted and nothing is at risk. ${cooldownInWords()}`,
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
