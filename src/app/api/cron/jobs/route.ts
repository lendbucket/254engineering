import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual, randomUUID } from "node:crypto";
import { runBatch, queueHealth } from "@/lib/ops-jobs";
import { cronStarted, cronFinished, captureError } from "@/lib/ops-observability";

export const dynamic = "force-dynamic";

/**
 * The worker. Claims a bounded batch and runs it.
 *
 * WHERE THE HANDLERS COME FROM
 * ----------------------------
 * runBatch loads the registry itself, through loadHandlers. This route used to
 * carry a bare import of job-handlers for its side effect, which was the single
 * most likely way the section could silently stop working: an unreferenced
 * import is what a tidy up deletes, and the result would be a worker that
 * claims jobs and dead letters every one of them on "no handler is registered".
 * jobs-audit asserts no caller depends on such an import.
 *
 * WHY THE BATCH IS BOUNDED AND THE LEASE IS SHORTER THAN THE TIMEOUT
 * ------------------------------------------------------------------
 * A run that exceeds the function timeout is killed with its jobs still leased.
 * Those jobs come back when their leases expire, the next run claims them, and
 * it also times out: a queue that looks busy and completes nothing. BATCH_SIZE
 * and LEASE_SECONDS in job-rules are set so one invocation finishes well inside
 * the limit.
 *
 * WHY IT IS SAFE TO RUN CONCURRENTLY WITH ITSELF
 * ----------------------------------------------
 * Vercel can overlap cron invocations, and a slow run plus the next schedule
 * means two workers at once. eng_claim_jobs uses FOR UPDATE SKIP LOCKED, so the
 * second worker takes different rows rather than the same ones or blocking.
 * Each invocation gets its own id so the lease says which worker holds a job.
 *
 * WHY IT ANSWERS 404 WITHOUT THE SECRET
 * -------------------------------------
 * Same reasoning as the health watcher: an unconfigured or unauthenticated
 * worker is indistinguishable from a route that does not exist. This one
 * additionally moves money adjacent work, so an open trigger would let anybody
 * drive the queue.
 */

function secretMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET ?? "";
  if (!expected) return NextResponse.json({ ok: false }, { status: 404 });

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!provided || !secretMatches(provided, expected)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const workerId = `worker-${randomUUID().slice(0, 8)}`;
  const startedAt = Date.now();

  /*
   * The run row is written before the batch and closed after it. A worker
   * killed by the function timeout leaves a started row with no finished_at,
   * which is the ONLY evidence that would exist for a worker that is being
   * killed on every invocation: the jobs it claimed come back when their leases
   * lapse and the queue looks merely slow.
   */
  const runId = await cronStarted("jobs");

  let report;
  try {
    report = await runBatch(workerId);
  } catch (err) {
    await cronFinished(runId, false, err instanceof Error ? err.message : "the batch threw");
    await captureError(err, { route: "/api/cron/jobs", kind: "cron" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const health = await queueHealth();

  await cronFinished(
    runId,
    true,
    `claimed ${report.claimed}, done ${report.done}, retried ${report.retried}, dead ${report.dead}`,
  );

  /*
   * Logged on every run, including the empty one.
   *
   * An empty run is the normal case and it is also what a broken worker looks
   * like, so the line says which: it carries the queue depth beside the batch
   * result. Zero claimed with zero pending is a quiet queue; zero claimed with
   * forty pending is a worker that is running and taking nothing, and those two
   * must not look the same in a log.
   */
  console.log(
    `[jobs] ${workerId} claimed ${report.claimed} in ${Date.now() - startedAt}ms ` +
      `(done ${report.done}, retried ${report.retried}, dead ${report.dead}) ` +
      `queue: ${health ? `${health.pending} pending, ${health.overdue} overdue, ${health.dead} dead` : "unreadable"}`,
  );

  return NextResponse.json({
    ok: true,
    worker: workerId,
    ...report,
    queue: health,
  });
}
