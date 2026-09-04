import "server-only";
import { supabaseAdmin } from "./supabase";
import { fingerprintOf, scrubString, scrubValue } from "./observability-scrub";

/**
 * Errors, cron runs, and the numbers behind the status page.
 *
 * WHY THE FAULTS ARE RECORDED HERE AS WELL AS IN SENTRY
 * ------------------------------------------------------
 * Sentry is configured by a DSN that lives in the deployment's environment. If
 * it is unset, wrong, or the account lapses, Sentry records nothing and says
 * nothing, and the only symptom is an error dashboard that looks calm. That is
 * the shape of failure this platform keeps finding: a success indistinguishable
 * from nothing happening.
 *
 * So the fault store is in this firm's own database, which is the one
 * dependency the platform cannot be quietly missing, and Sentry is the second
 * copy with the better tooling. Alerting reads the local one, so an alert
 * cannot be silenced by a third party's outage or by an unset variable.
 *
 * EVERYTHING HERE SWALLOWS ITS OWN FAILURES
 * -----------------------------------------
 * This module runs inside error handlers. A throw here would turn a reportable
 * fault into an unreportable crash, and the request that was already failing
 * would fail worse and less legibly. Every function returns rather than throws,
 * and logs to the console when it cannot write, because the console is the one
 * channel that does not depend on anything this module could break.
 */

// ============================================================== error capture

export type ErrorContext = {
  /** The route or job the fault happened in. Used in the fingerprint. */
  route?: string | null;
  /** "route", "job", "webhook", "render". Used in the fingerprint. */
  kind?: string;
  level?: "fatal" | "error" | "warning";
  /** Anything else worth keeping. Scrubbed before it is stored. */
  extra?: Record<string, unknown>;
};

export const RELEASE =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? process.env.SENTRY_RELEASE ?? "local";

export const ENVIRONMENT = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";

/**
 * Record a fault.
 *
 * The message is scrubbed with the same function that scrubs what goes to
 * Sentry, deliberately. Two scrubbers would drift, and the one that drifted
 * would be the one nobody was watching.
 */
export async function captureError(err: unknown, context: ErrorContext = {}): Promise<void> {
  try {
    const raw = err instanceof Error ? err.message : String(err);
    const message = scrubString(raw).slice(0, 2000);
    const kind = context.kind ?? "error";
    const route = context.route ?? null;
    const fingerprint = fingerprintOf(kind, message, route);
    const level = context.level ?? "error";

    // The console line always happens, whatever the database does next. It is
    // the only record that survives the database being the thing that broke.
    console.error(`[error] ${fingerprint} :: ${message}`);

    const db = supabaseAdmin();
    if (!db) return;

    /*
     * The type row first, because the event references it. Upserted rather
     * than inserted, and the counters are read back so the caller could act on
     * "this is the first time" without a second query.
     */
    const { data: existing } = await db
      .from("eng_error_types")
      .select("fingerprint, occurrences")
      .eq("fingerprint", fingerprint)
      .maybeSingle();

    const now = new Date().toISOString();

    if (existing) {
      await db
        .from("eng_error_types")
        .update({
          last_seen_at: now,
          occurrences: Number(existing.occurrences) + 1,
        })
        .eq("fingerprint", fingerprint);
    } else {
      await db.from("eng_error_types").insert({
        fingerprint,
        title: message.slice(0, 200),
        culprit: route,
        first_seen_at: now,
        last_seen_at: now,
        occurrences: 1,
      });
    }

    await db.from("eng_error_events").insert({
      fingerprint,
      message,
      route,
      release: RELEASE,
      environment: ENVIRONMENT,
      level,
      /*
       * Scrubbed on the way in rather than on the way out. A secret that
       * reaches the row is a secret in the database and in every backup of it,
       * and scrubbing at read time would only hide it from the screen.
       */
      extra: context.extra ? (scrubValue(context.extra) as Record<string, unknown>) : null,
      occurred_at: now,
    });
  } catch (recordingFailure) {
    /*
     * The one place a swallowed exception is correct. Something went wrong
     * while recording that something went wrong, and rethrowing would replace
     * the original fault with this one in the caller's stack.
     */
    console.error(
      `[error] could not record a fault: ${
        recordingFailure instanceof Error ? recordingFailure.message : "unknown"
      }`,
    );
  }
}

// ================================================================= cron runs

/**
 * Mark a scheduled run as started, and get back the id to close it with.
 *
 * WHY THE START IS RECORDED AT ALL
 * --------------------------------
 * A run recorded only on completion leaves no trace when it is killed by a
 * timeout, so a cron dying every minute for an hour shows the same thing on
 * the status page as a cron that has not been scheduled yet: the last good run,
 * an hour ago, and nothing to say why. The started row is what makes a timeout
 * visible.
 */
export async function cronStarted(name: string): Promise<number | null> {
  try {
    const db = supabaseAdmin();
    if (!db) return null;
    const { data } = await db
      .from("eng_cron_runs")
      .insert({ name, started_at: new Date().toISOString() })
      .select("id")
      .single();
    return (data?.id as number) ?? null;
  } catch {
    return null;
  }
}

export async function cronFinished(
  id: number | null,
  ok: boolean,
  detail?: string,
): Promise<void> {
  if (id === null) return;
  try {
    const db = supabaseAdmin();
    if (!db) return;
    await db
      .from("eng_cron_runs")
      .update({
        finished_at: new Date().toISOString(),
        ok,
        detail: detail ? scrubString(detail).slice(0, 500) : null,
      })
      .eq("id", id);
  } catch {
    // Nothing to do. The started row stands, which reads as a run that did not
    // report, and that is closer to the truth than silence.
  }
}

// ============================================================== the picture

export type DependencyState = {
  name: string;
  configured: boolean;
  /** null means "not checked", which is never rendered as healthy. */
  reachable: boolean | null;
  detail: string;
  checkedAt: string;
};

export type CronState = {
  name: string;
  label: string;
  everyMinutes: number;
  lastStartedAt: string | null;
  lastSuccessAt: string | null;
  /** A run that started and never reported. */
  lastRunUnfinished: boolean;
  /** null when it has NEVER run, which is not the same as stalled. */
  minutesSinceSuccess: number | null;
  verdict: "healthy" | "late" | "stalled" | "never run" | "unreadable";
};

/**
 * How late is too late.
 *
 * Three intervals is deliberately loose. Vercel's scheduler is not exact and a
 * cron that occasionally slips one interval is normal; alerting on that teaches
 * the operator to ignore the status page, which costs more than the lateness.
 */
export function cronVerdict(
  everyMinutes: number,
  minutesSinceSuccess: number | null,
  hasAnyRun: boolean,
): CronState["verdict"] {
  if (!hasAnyRun) return "never run";
  if (minutesSinceSuccess === null) return "stalled";
  if (minutesSinceSuccess <= everyMinutes * 2) return "healthy";
  if (minutesSinceSuccess <= everyMinutes * 3) return "late";
  return "stalled";
}

export const WATCHED_CRONS: { name: string; label: string; everyMinutes: number }[] = [
  { name: "health-watch", label: "Outage watcher", everyMinutes: 5 },
  { name: "jobs", label: "Job worker", everyMinutes: 1 },
  { name: "daily", label: "Daily rollup", everyMinutes: 1440 },
];

/**
 * The state of every scheduled job.
 *
 * Returns null when the table could not be read, and the page renders that as
 * a failure. A status page that says every cron is healthy because it could not
 * look is the exact thing a status page is for preventing.
 */
export async function cronStates(): Promise<CronState[] | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const { data, error } = await db
    .from("eng_cron_runs")
    .select("name, started_at, finished_at, ok")
    .order("started_at", { ascending: false })
    .limit(500);

  if (error) return null;

  const rows = data ?? [];
  const now = Date.now();

  return WATCHED_CRONS.map(({ name, label, everyMinutes }) => {
    const mine = rows.filter((r) => r.name === name);
    const last = mine[0] ?? null;
    const lastSuccess = mine.find((r) => r.ok === true && r.finished_at) ?? null;

    const lastSuccessAt = (lastSuccess?.finished_at as string) ?? null;
    const minutesSinceSuccess = lastSuccessAt
      ? Math.floor((now - Date.parse(lastSuccessAt)) / 60000)
      : null;

    return {
      name,
      label,
      everyMinutes,
      lastStartedAt: (last?.started_at as string) ?? null,
      lastSuccessAt,
      lastRunUnfinished: Boolean(last && !last.finished_at),
      minutesSinceSuccess,
      verdict: cronVerdict(everyMinutes, minutesSinceSuccess, mine.length > 0),
    };
  });
}

/**
 * What has been going wrong lately.
 *
 * `sinceMinutes` bounds the rate window. Null on a failed read, for the same
 * reason as everything else here.
 */
export async function recentErrors(sinceMinutes = 60, limit = 25) {
  const db = supabaseAdmin();
  if (!db) return null;

  const since = new Date(Date.now() - sinceMinutes * 60_000).toISOString();

  const { data: types, error } = await db
    .from("eng_error_types")
    .select("fingerprint, title, culprit, first_seen_at, last_seen_at, occurrences, muted")
    .gte("last_seen_at", since)
    .order("last_seen_at", { ascending: false })
    .limit(limit);

  if (error) return null;

  const { data: events } = await db
    .from("eng_error_events")
    .select("fingerprint")
    .gte("occurred_at", since);

  const inWindow = new Map<string, number>();
  for (const e of events ?? []) {
    const f = e.fingerprint as string;
    inWindow.set(f, (inWindow.get(f) ?? 0) + 1);
  }

  return (types ?? []).map((t) => ({
    fingerprint: t.fingerprint as string,
    title: t.title as string,
    culprit: (t.culprit as string) ?? null,
    firstSeenAt: t.first_seen_at as string,
    lastSeenAt: t.last_seen_at as string,
    occurrences: Number(t.occurrences),
    inWindow: inWindow.get(t.fingerprint as string) ?? 0,
    muted: Boolean(t.muted),
  }));
}

/** Silence the email for a known fault. Counting continues. */
export async function muteErrorType(
  fingerprint: string,
  muted: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "Not configured." };
  const { data } = await db
    .from("eng_error_types")
    .update({ muted })
    .eq("fingerprint", fingerprint)
    .select("fingerprint");
  if (!data || data.length === 0) return { ok: false, error: "No such fault." };
  return { ok: true };
}

/** Kept so a caller can attach scrubbed detail without importing the scrubber. */
export const scrubForStorage = scrubValue;

// ============================================================ dependencies

/**
 * What this deployment depends on, and whether each one is actually there.
 *
 * THREE STATES, NOT TWO, AND THE THIRD IS THE IMPORTANT ONE
 * ----------------------------------------------------------
 * configured false        Nobody has given this deployment the credential. The
 *                         feature is off, which may be correct.
 * reachable true          It was checked and it answered.
 * reachable null          It is configured and was NOT checked, because
 *                         checking it costs a request to somebody else's API
 *                         and this page is not worth that.
 *
 * null is never rendered as healthy. A status page that shows a green tick for
 * something it did not look at is worse than one that omits it, because the
 * tick is read as evidence.
 */
export async function dependencyStates(): Promise<DependencyState[]> {
  const checkedAt = new Date().toISOString();
  const out: DependencyState[] = [];

  // The database, and this one IS checked, because the check is one indexed
  // read against a table auth itself uses and everything else depends on it.
  {
    let reachable: boolean | null = null;
    let detail = "not checked";
    const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (configured) {
      try {
        const db = supabaseAdmin();
        if (!db) {
          reachable = false;
          detail = "the client could not be built";
        } else {
          const { error } = await db.from("eng_profiles").select("id", { head: true }).limit(1);
          reachable = !error;
          detail = error ? "configured, and the query failed" : "answering";
        }
      } catch {
        /*
         * supabaseAdmin throws on a preview pointed at production. That is a
         * misconfiguration rather than an outage and it belongs in the same
         * bucket here: this deployment must not be trusted to answer.
         */
        reachable = false;
        detail = "refused by the database guard";
      }
    } else {
      detail = "SUPABASE_URL or the service role key is not set";
    }

    out.push({ name: "Database", configured, reachable, detail, checkedAt });
  }

  /*
   * The rest are reported as configured or not, and deliberately not probed.
   *
   * A status page that pings Stripe and Resend on every load turns an operator
   * refreshing a screen into traffic against two paid APIs, and it would report
   * THEIR availability rather than this platform's ability to use them. What
   * actually answers "is Stripe working for us" is whether recent jobs and
   * webhooks succeeded, which is on this page already as queue depth and dead
   * letters.
   */
  out.push({
    name: "Payments (Stripe)",
    configured: Boolean(process.env.STRIPE_SECRET_KEY),
    reachable: null,
    detail: process.env.STRIPE_SECRET_KEY
      ? `configured, ${process.env.STRIPE_SECRET_KEY.startsWith("sk_live") ? "live" : "test"} key`
      : "STRIPE_SECRET_KEY is not set, so nothing can be ordered",
    checkedAt,
  });

  out.push({
    name: "Email (Resend)",
    configured: Boolean(process.env.RESEND_API_KEY),
    reachable: null,
    detail: process.env.RESEND_API_KEY
      ? "configured, and every send is recorded on the queue"
      : "RESEND_API_KEY is not set, so every email job will report skipped",
    checkedAt,
  });

  out.push({
    name: "Error reporting (Sentry)",
    configured: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
    reachable: null,
    detail:
      process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
        ? "configured, and faults are recorded here as well either way"
        : "no DSN, so nothing reaches Sentry. Faults are still recorded in this database and alerting still works.",
    checkedAt,
  });

  out.push({
    name: "Scheduled jobs (CRON_SECRET)",
    configured: Boolean(process.env.CRON_SECRET),
    reachable: null,
    detail: process.env.CRON_SECRET
      ? "set, so the worker and the watcher can be triggered"
      : "not set, so every cron route answers 404 and NOTHING scheduled runs",
    checkedAt,
  });

  return out;
}
