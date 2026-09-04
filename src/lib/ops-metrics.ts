import "server-only";
import { supabaseAdmin } from "./supabase";

/**
 * The daily rollup, and the one rule it follows.
 *
 * A FIGURE IS RECOMPUTED FROM ITS SOURCE ROWS, NEVER ACCUMULATED
 * --------------------------------------------------------------
 * Same rule the statement total follows, for the same reason. The queue
 * guarantees at-least-once, so this job WILL run twice for the same day, and a
 * rollup that added to what was there would double every number in it. Every
 * metric below is a count or a sum over a bounded day, written with an upsert,
 * so running it five times produces exactly what running it once produced.
 *
 * WHY THE ROLLUP EXISTS AT ALL RATHER THAN COUNTING ON DEMAND
 * -----------------------------------------------------------
 * Because the source rows will not always be there, and will not always be
 * cheap. eng_jobs and eng_error_events are both slated for pruning, and "what
 * did March look like" asked in September has to be answerable after March's
 * rows are gone. The rollup is the thing that survives the pruning.
 *
 * WHY AN ABSENT FIGURE IS NOT WRITTEN AS ZERO
 * -------------------------------------------
 * A read that fails is not a day with no orders. If a source query errors, that
 * metric is left out of the upsert entirely and the rollup reports which ones
 * it could not compute, so a gap in the table means "not computed" and a zero
 * means "genuinely none". money-audit has enforced that distinction since Phase
 * 5 and it applies with more force here, where nobody is watching.
 */

/**
 * Every metric this platform records, in one place.
 *
 * A tall table means the names are the schema, so they are enumerated here
 * rather than spelled at each call site. A typo in a metric name would
 * otherwise create a new metric that silently holds half the data.
 */
export const METRICS = {
  ORDERS_PLACED: "orders.placed",
  ORDERS_PAID: "orders.paid",
  ORDERS_REVENUE_CENTS: "orders.revenue_cents",
  ORDERS_REFUNDED_CENTS: "orders.refunded_cents",
  FILES_OPENED: "files.opened",
  LEADS_CAPTURED: "leads.captured",
  APPLICATIONS_RECEIVED: "applications.received",
  JOBS_COMPLETED: "jobs.completed",
  JOBS_DEAD: "jobs.dead",
  ERRORS_RECORDED: "errors.recorded",
  ERROR_TYPES_NEW: "errors.new_types",
  API_REQUESTS: "api.requests",
  SIGN_INS: "auth.sign_ins",
} as const;

export type MetricName = (typeof METRICS)[keyof typeof METRICS];

/** The day a rollup covers, as the date key the table uses. */
export function dayKey(when: Date = new Date()): string {
  return when.toISOString().slice(0, 10);
}

/** Midnight to midnight, UTC, for the day named. */
function bounds(day: string): { from: string; to: string } {
  const from = new Date(`${day}T00:00:00.000Z`);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export type RollupReport = {
  day: string;
  written: number;
  /** Metrics that could not be computed, and are therefore ABSENT rather than zero. */
  unavailable: string[];
};

type Db = NonNullable<ReturnType<typeof supabaseAdmin>>;

/**
 * Count rows in one table inside the day.
 *
 * Returns null on a failed read rather than zero, and every caller passes that
 * null straight through to "unavailable". This is the single most important
 * function in the file: it is where an outage would otherwise become a day of
 * flawless zeroes.
 */
async function countIn(
  db: Db,
  table: string,
  column: string,
  from: string,
  to: string,
  equals?: { column: string; value: string },
): Promise<number | null> {
  let query = db
    .from(table)
    .select("*", { count: "exact", head: true })
    .gte(column, from)
    .lt(column, to);
  if (equals) query = query.eq(equals.column, equals.value);

  const { count, error } = await query;
  if (error) return null;
  return count ?? 0;
}

/**
 * Sum a cents column inside the day. Null on a failed read.
 *
 * Summed in JavaScript rather than in SQL because PostgREST has no sum
 * aggregate over a filtered set without a view, and a view here would be a
 * fourth object in the migration to keep in step for one number. The row count
 * per day is small enough that reading the amounts is cheaper than the
 * maintenance.
 */
async function sumIn(
  db: Db,
  table: string,
  column: string,
  amountColumn: string,
  from: string,
  to: string,
  equals?: { column: string; value: string },
): Promise<number | null> {
  let query = db.from(table).select(amountColumn).gte(column, from).lt(column, to);
  if (equals) query = query.eq(equals.column, equals.value);

  const { data, error } = await query;
  if (error) return null;
  return (data ?? []).reduce(
    (total, row) => total + Number((row as unknown as Record<string, unknown>)[amountColumn] ?? 0),
    0,
  );
}

/**
 * Compute and store one day.
 *
 * Yesterday by default, because a rollup of today is a partial figure that
 * looks like a final one, and somebody reading a chart cannot tell which.
 */
export async function rollupDay(day: string = dayKey(new Date(Date.now() - 86_400_000))): Promise<
  RollupReport | null
> {
  const db = supabaseAdmin();
  if (!db) return null;

  const { from, to } = bounds(day);
  const values: Partial<Record<MetricName, number>> = {};
  const unavailable: string[] = [];

  const put = (metric: MetricName, value: number | null) => {
    if (value === null) unavailable.push(metric);
    else values[metric] = value;
  };

  const payment = { column: "kind", value: "payment" };
  const refund = { column: "kind", value: "refund" };

  put(METRICS.ORDERS_PLACED, await countIn(db, "eng_service_orders", "created_at", from, to));
  put(METRICS.ORDERS_PAID, await countIn(db, "eng_order_payments", "created_at", from, to, payment));

  /*
   * Revenue and refunds are separate metrics rather than one net figure.
   *
   * A net number that reads zero cannot be told from a day with no trading,
   * and those two need very different reactions. Whoever wants the net can
   * subtract; nobody can recover the two halves from the net.
   */
  put(
    METRICS.ORDERS_REVENUE_CENTS,
    await sumIn(db, "eng_order_payments", "created_at", "amount_cents", from, to, payment),
  );
  put(
    METRICS.ORDERS_REFUNDED_CENTS,
    await sumIn(db, "eng_order_payments", "created_at", "amount_cents", from, to, refund),
  );

  put(METRICS.FILES_OPENED, await countIn(db, "eng_files", "created_at", from, to));
  put(METRICS.LEADS_CAPTURED, await countIn(db, "eng_leads", "created_at", from, to));
  put(METRICS.APPLICATIONS_RECEIVED, await countIn(db, "eng_applications", "created_at", from, to));

  put(
    METRICS.JOBS_COMPLETED,
    await countIn(db, "eng_jobs", "finished_at", from, to, { column: "status", value: "done" }),
  );
  put(
    METRICS.JOBS_DEAD,
    await countIn(db, "eng_jobs", "finished_at", from, to, { column: "status", value: "dead" }),
  );

  put(METRICS.ERRORS_RECORDED, await countIn(db, "eng_error_events", "occurred_at", from, to));
  put(METRICS.ERROR_TYPES_NEW, await countIn(db, "eng_error_types", "first_seen_at", from, to));
  put(METRICS.API_REQUESTS, await countIn(db, "eng_account_api_requests", "created_at", from, to));
  put(
    METRICS.SIGN_INS,
    await countIn(db, "eng_audit_events", "created_at", from, to, {
      column: "action",
      value: "auth.sign_in",
    }),
  );

  const rows = Object.entries(values).map(([metric, value]) => ({
    day,
    metric,
    value,
    computed_at: new Date().toISOString(),
  }));

  if (rows.length > 0) {
    /*
     * An upsert on the composite key, which recomputes rather than adds. This
     * is the line that makes the job safe to run twice, and it is the reason
     * the handler can declare itself keyed on the day alone.
     */
    const { error } = await db.from("eng_metrics_daily").upsert(rows, { onConflict: "day,metric" });
    if (error) return { day, written: 0, unavailable: [...unavailable, "upsert failed"] };
  }

  return { day, written: rows.length, unavailable };
}

/** Read a window of days back, for the operator's screen. */
export async function metricsSince(days = 14) {
  const db = supabaseAdmin();
  if (!db) return null;

  const from = dayKey(new Date(Date.now() - days * 86_400_000));
  const { data, error } = await db
    .from("eng_metrics_daily")
    .select("day, metric, value, computed_at")
    .gte("day", from)
    .order("day", { ascending: false });

  if (error) return null;
  return (data ?? []).map((r) => ({
    day: r.day as string,
    metric: r.metric as string,
    value: Number(r.value),
    computedAt: r.computed_at as string,
  }));
}
