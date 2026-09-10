/**
 * THE ONE PLACE THAT SAYS WHEN A SCRIPT MAY RUN A WORKER.
 *
 * Operator ruling, 2026-09-10: one refusal, declared once, both call sites
 * reading it.
 *
 * ===========================================================================
 * WHY THIS MODULE EXISTS, AND IT IS NOT TIDINESS
 * ===========================================================================
 * On 2026-09-09 this repository sent 20 emails at 05:21 and 35 more at 23:08.
 * Both times a script ran a worker over a queue it did not own. `runBatch`
 * claims BATCH_SIZE rows of ANY kind, so once a script's own probes were
 * consumed every later call took backlog: 35 `email.send` jobs that had been
 * sitting pending on development ran for real. Nobody outside the firm was
 * written to, and it was luck rather than design that decided that.
 *
 * `effect_mode` protects a row a script ENQUEUED. It does nothing whatever for
 * a row a script happens to CLAIM, and that difference is the whole incident.
 *
 * The fix was a refusal rather than more care, because care is what fails. It
 * was then COPIED into a second script, and two copies of a safety mechanism
 * drift. The mechanism that exists because of two incidents is the last one
 * that should have two versions of itself, so it lives here and both callers
 * read it.
 *
 * ===========================================================================
 * THE TWO REFUSALS ARE DIFFERENT QUESTIONS AND BOTH ARE NEEDED
 * ===========================================================================
 *
 *   refuseIfOutwardWorkIsWaiting()  asked ONCE, before anything is enqueued.
 *     Is there work on this database that reaches a person and is marked live?
 *     If so, do not start: running a worker here can send it.
 *
 *   makeBatchRunner().ourBatch()    asked BEFORE EVERY BATCH.
 *     Would the next claim take a row this run does not own? If so, stop.
 *
 * The first cannot replace the second, because a live outward job can arrive
 * while a run is in progress. The second cannot replace the first, because a
 * run that refuses every batch has measured nothing and should say so before
 * it writes two hundred rows.
 */

import { COULD_NOT_TELL } from "./reachable.mjs";

/**
 * Refuse to start if any outward reaching job is waiting here marked live.
 *
 * Exits the process with COULD NOT TELL rather than returning, because there is
 * no safe way to continue: the caller is about to run a worker. A third verdict
 * rather than a failure, for the reason in reachable.mjs: the queue was not
 * measured, which is not a pass and not a defect in the queue.
 *
 * @param {object} o
 * @param {import("@supabase/supabase-js").SupabaseClient} o.db
 * @param {string[]} o.outwardKinds  Kinds whose handler admits `reachesOutside`.
 * @param {string} o.label           The script, for the message.
 */
export async function refuseIfOutwardWorkIsWaiting({ db, outwardKinds, label }) {
  const { data: hazards } = await db
    .from("eng_jobs")
    .select("id, kind, run_after")
    .eq("effect_mode", "live")
    .in("kind", outwardKinds)
    .in("status", ["pending", "running"])
    .order("run_after", { ascending: true })
    .limit(20);

  if ((hazards ?? []).length === 0) return { ok: true, checked: outwardKinds.length };

  console.log("");
  console.log(
    `  REFUSED TO START: ${hazards.length}${hazards.length === 20 ? "+" : ""} job(s) of an outward reaching kind are waiting on this database and are marked live.`,
  );
  console.log("");
  for (const h of hazards.slice(0, 5)) {
    console.log(`    #${h.id} ${h.kind}, eligible from ${h.run_after}`);
  }
  console.log("");
  console.log(`  Running a worker here can send them, and ${label} runs a worker. That is`);
  console.log("  how 20 emails went out at 05:21 and 35 more at 23:08 on 2026-09-09.");
  console.log("");
  console.log("  Nothing was enqueued and nothing was claimed. Work queued by a fixture is");
  console.log("  suppressed at creation now, so these are either older than that rule or");
  console.log("  they belong to somebody real, and which of the two is a decision.");

  /*
   * EXITED AFTER A TICK, NOT INSIDE ONE.
   *
   * process.exit() here aborted the process outright on Windows with
   * "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)", because the
   * database client still had a socket mid close. The exit code became 127 and
   * the board read the refusal as a FAILED audit rather than as one that could
   * not measure, which is the exact distinction the refusal exists to draw. It
   * said the right words and reported the wrong verdict.
   */
  process.exitCode = COULD_NOT_TELL;
  await new Promise((resolve) => setTimeout(resolve, 150));
  process.exit(COULD_NOT_TELL);
}

/**
 * A batch runner that will not claim a row the caller did not create.
 *
 * @param {object} o
 * @param {import("@supabase/supabase-js").SupabaseClient} o.db
 * @param {Set<number>} o.created   Job ids this run made. Read live, so a caller
 *                                  may keep adding to it between batches.
 * @param {number} o.batchSize      The real BATCH_SIZE, from job-rules.
 * @param {(worker: string) => Promise<any>} o.runBatch  The real runBatch.
 * @param {string} o.worker         Worker id prefix.
 */
export function makeBatchRunner({ db, created, batchSize, runBatch, worker }) {
  const leaks = [];
  let refusedBatches = 0;
  let lastRefusal = "";

  /** Rows eligible right now, in the order eng_claim_jobs would take them. */
  async function nextEligible(limit) {
    const nowIso = new Date().toISOString();
    const { data } = await db
      .from("eng_jobs")
      .select("id, kind, status, run_after, leased_until, effect_mode")
      .lte("run_after", nowIso)
      .in("status", ["pending", "running"])
      .order("run_after", { ascending: true })
      .order("id", { ascending: true })
      .limit(limit * 4);
    /*
     * A running row is only eligible once its lease has run out. Mirrored from
     * eng_claim_jobs rather than assumed, and over-read then filtered because
     * PostgREST cannot express the OR the function's WHERE clause has.
     */
    return (data ?? [])
      .filter((r) => r.status === "pending" || (r.leased_until && Date.parse(r.leased_until) < Date.now()))
      .slice(0, limit);
  }

  /**
   * Run one batch, and only if every row it would take belongs to this run.
   *
   * Returns the worker report, or null when it refused. A refusal is recorded
   * and is a FAILURE of the caller rather than a reason to press on: a run that
   * cannot run its own batch has not measured the queue, and pressing on is how
   * 35 emails went out.
   */
  async function ourBatch(label) {
    const eligible = await nextEligible(batchSize);
    const foreign = eligible.filter((r) => !created.has(r.id));
    if (foreign.length > 0) {
      refusedBatches += 1;
      lastRefusal =
        `the next batch would take ${foreign.length} row(s) this run does not own ` +
        `(${foreign.slice(0, 3).map((r) => `#${r.id} ${r.kind}`).join(", ")})`;
      console.warn(`[${worker}] REFUSED to run ${label}: ${lastRefusal}`);
      return null;
    }

    /*
     * THE GUARD IS AN ARGUMENT; THIS IS THE OBSERVATION, PER BATCH.
     *
     * The check the guard makes is "the rows I can see are mine". What the
     * claim then takes is decided by the DATABASE's clock and the database's
     * view of which leases have expired, and those are not the same reads. A
     * batch that leaks is named here, at the batch, rather than turning up as a
     * number at the end that nobody can trace back.
     */
    const before = await db.from("eng_jobs").select("id", { count: "exact", head: true }).eq("status", "pending");
    const report = await runBatch(`${worker}-${label}`);
    const after = await db.from("eng_jobs").select("id", { count: "exact", head: true }).eq("status", "pending");

    const ours = eligible.length;
    const consumed = (before.count ?? 0) - (after.count ?? 0);
    /*
     * Every row this batch could legitimately consume was one of ours and was
     * pending a moment ago, so the pending count may fall by at most that many.
     * More than that is somebody else's work.
     */
    if (consumed > ours) {
      leaks.push(`${label}: pending fell by ${consumed} and this run only offered ${ours}`);
    }
    return report;
  }

  return {
    nextEligible,
    ourBatch,
    leaks,
    get refusedBatches() {
      return refusedBatches;
    },
    get lastRefusal() {
      return lastRefusal;
    },
  };
}
