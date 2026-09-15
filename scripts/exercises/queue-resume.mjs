// @runtime react-server
//
// Declared because this exercise reaches modules carrying `server-only`.

/**
 * PHASE 14 RANK 5: A DEAD-LETTERED JOB, RESUMED, FOR THE FIRST TIME.
 *
 *   npx tsx --conditions=react-server scripts/exercises/queue-resume.mjs
 *
 * What proved this before tonight: `jobs-audit` reads `retryDeadJob`'s SOURCE
 * and asserts it contains `.eq("status", "dead")` and `attempts: 0`. That is a
 * check on wording. Nothing had ever driven a job into the dead letter, resumed
 * it, and watched what the worker did next.
 *
 * The questions, and the rank's own words: the job completes, and it is not run
 * twice. Two more fall out of the code: whether the reset of attempts actually
 * buys a failing job its retries back, and whether a job that already completed
 * can be put back to run again.
 *
 * WHY THIS CANNOT CLAIM REAL WORK
 * -------------------------------
 * `runBatch` claims ANY eligible kind. Development's queue was drained on
 * 2026-09-15 and holds nothing pending or running, and this refuses to call the
 * worker unless that is still true immediately beforehand, so the only thing a
 * batch can take is the job this exercise wrote. Its handler reaches nothing
 * outside, and the job is enqueued `no_external_effect` besides.
 *
 * INJECTIONS, BOTH HALVES
 * -----------------------
 * Each assertion that matters is run against a defect written into the ROW, not
 * the code, so no module is patched and nothing is bound: a resume that forgets
 * to reset attempts, and a completed job forced back to pending. Each must turn
 * its check red.
 */

process.loadEnvFile?.(".env.local");

import { auditClient, refOf, DEVELOPMENT_REF } from "../lib/db-target.mjs";
import { enqueue, runBatch, retryDeadJob, registerJob, loadHandlers } from "../../src/lib/ops-jobs.ts";

const KIND = "queue.resume.exercise";
const WORKER = "queue-resume-exercise";

let failures = 0;
const rec = (name, ok, detail) => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` (${detail})` : ""}`);
};
/* An injection is expected to turn its check red. Recorded as PASS when it does. */
const injected = (name, checkWentRed, detail) => rec(`INJECTION: ${name}`, checkWentRed, detail);

const ref = refOf(process.env.SUPABASE_URL ?? "");
if (ref !== DEVELOPMENT_REF) {
  console.error(`REFUSED: this exercise runs the worker against development (${DEVELOPMENT_REF}) by name. Target is ${ref}.`);
  process.exit(1);
}
const db = auditClient("queue resume exercise", { neverProduction: true });
if (!db) {
  console.error("REFUSED: no database configured.");
  process.exit(1);
}
console.log(`queue resume exercise, against ${ref} (development)\n`);

/* ------------------------------------------------------------ the handler */

/* What the handler does next, set by the exercise between batches. */
let behaviour = "retry";
const invocations = new Map();

await loadHandlers();
registerJob(KIND, {
  idempotency: "naturally",
  why: "It records an invocation in this process's memory and does nothing else.",
  reachesOutside: false,
  run: async (_payload, job) => {
    invocations.set(job.id, (invocations.get(job.id) ?? 0) + 1);
    if (behaviour === "done") return { kind: "done" };
    return { kind: "retry", error: "exercise: the handler is broken on purpose" };
  },
});

const made = [];
const row = async (id) =>
  (await db.from("eng_jobs").select("id, status, attempts, max_attempts, last_error, finished_at").eq("id", id).single()).data;

async function quietQueue() {
  const { count, error } = await db
    .from("eng_jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "running"])
    .neq("kind", KIND);
  if (error || typeof count !== "number") throw new Error(`could not count the queue: ${error?.message ?? "null count"}`);
  if (count !== 0) throw new Error(`${count} real job(s) are pending or running, so a batch could claim them. Stopping before the worker runs.`);
}

/* The worker, but only over a queue holding nothing except this exercise. */
async function batch() {
  await quietQueue();
  return runBatch(WORKER);
}

/* Backoff puts a retried job minutes into the future. The exercise owns the row, so it brings it forward. */
const due = (id) => db.from("eng_jobs").update({ run_after: new Date(Date.now() - 60_000).toISOString() }).eq("id", id);

async function newJob(maxAttempts) {
  const r = await enqueue(KIND, { exercise: "2026-09-15" }, { maxAttempts, effectMode: "no_external_effect" });
  if (!r.ok) throw new Error(`enqueue refused: ${r.error}`);
  made.push(r.id);
  return r.id;
}

/* Drive a job into the dead letter by exhausting its attempts. */
async function killJob(id) {
  behaviour = "retry";
  await batch();
  await due(id);
  await batch();
  return row(id);
}

try {
  await quietQueue();
  rec("development's queue holds no real pending or running job, so the worker can only claim this exercise", true);

  // ---------------------------------------------------- into the dead letter
  const id = await newJob(2);
  const dead = await killJob(id);
  rec("a job that fails its two attempts is dead-lettered",
    dead.status === "dead" && dead.attempts === 2 && /gave up after 2/.test(dead.last_error ?? ""),
    `${dead.status}, attempts ${dead.attempts}, "${dead.last_error}"`);
  rec("and the worker ran it exactly twice getting there", invocations.get(id) === 2, `${invocations.get(id)}`);

  const notRetriedYet = await batch();
  rec("a dead job is not claimed by the next batch", invocations.get(id) === 2 && notRetriedYet.claimed === 0);

  // ---------------------------------------------------- resume
  const resumed = await retryDeadJob(id);
  const back = await row(id);
  rec("resuming puts it back as pending with its attempts reset and its error kept",
    resumed.ok && back.status === "pending" && back.attempts === 0 && back.finished_at === null &&
      /gave up after 2/.test(back.last_error ?? ""),
    `${back.status}, attempts ${back.attempts}, error kept: ${Boolean(back.last_error)}`);

  const twice = await retryDeadJob(id);
  rec("a second resume of the same job is refused, because it is no longer dead", twice.ok === false, twice.ok ? "IT WAS ACCEPTED" : twice.error);

  /* The reset is only worth something if it buys the retries back. */
  behaviour = "retry";
  await batch();
  const afterOneFailure = await row(id);
  const resetHolds = afterOneFailure.status === "pending" && afterOneFailure.attempts === 1;
  rec("after resuming, one more failure is retried rather than dead-lettered on the spot",
    resetHolds, `${afterOneFailure.status}, attempts ${afterOneFailure.attempts}`);

  /* The rank's question: it completes. */
  behaviour = "done";
  await due(id);
  const before = invocations.get(id);
  await batch();
  const finished = await row(id);
  rec("with the handler fixed, the resumed job completes",
    finished.status === "done" && finished.finished_at !== null, `${finished.status}`);
  rec("running once more to get there", invocations.get(id) === before + 1, `${before} then ${invocations.get(id)}`);

  /* And it is not run twice: not by a later batch, not by two workers at once, not by a resume. */
  const settled = invocations.get(id);
  const [a, b] = await Promise.all([runBatch(`${WORKER}-a`), runBatch(`${WORKER}-b`)]);
  rec("a completed job is not run again, by one batch or by two racing", invocations.get(id) === settled && a.claimed + b.claimed === 0,
    `${a.claimed + b.claimed} claimed`);
  const resurrect = await retryDeadJob(id);
  rec("and a completed job cannot be resumed", resurrect.ok === false, resurrect.ok ? "IT WAS PUT BACK" : resurrect.error);

  /* Two workers racing for one resumed job: the claim is one statement and must hand it to one of them. */
  const racer = await newJob(2);
  await killJob(racer);
  await retryDeadJob(racer);
  behaviour = "done";
  const beforeRace = invocations.get(racer);
  await quietQueue();
  const [r1, r2] = await Promise.all([runBatch(`${WORKER}-a`), runBatch(`${WORKER}-b`)]);
  rec("two workers racing for a resumed job run it once between them",
    invocations.get(racer) === beforeRace + 1 && r1.claimed + r2.claimed === 1 && (await row(racer)).status === "done",
    `claimed ${r1.claimed} and ${r2.claimed}, ran ${invocations.get(racer) - beforeRace} time(s)`);

  // ---------------------------------------------------- injections
  /*
   * A resume that forgets to reset attempts, written into the row: exactly
   * what retryDeadJob would leave if `attempts: 0` came out of it.
   */
  const noReset = await newJob(2);
  await killJob(noReset);
  await db.from("eng_jobs").update({ status: "pending", finished_at: null, run_after: new Date(Date.now() - 60_000).toISOString() }).eq("id", noReset);
  behaviour = "retry";
  await batch();
  const injectedRow = await row(noReset);
  const wouldPass = injectedRow.status === "pending" && injectedRow.attempts === 1;
  injected("a resume that does not reset attempts turns the reset check red",
    !wouldPass && injectedRow.status === "dead",
    `the job went straight to ${injectedRow.status} at attempts ${injectedRow.attempts}`);

  /*
   * A completed job forced back to pending, which is what a resume without its
   * `status = dead` guard would allow. The not-run-twice check must see it.
   */
  const forced = await newJob(2);
  behaviour = "done";
  await batch();
  const ranOnce = invocations.get(forced);
  await db.from("eng_jobs").update({ status: "pending", finished_at: null, run_after: new Date(Date.now() - 60_000).toISOString() }).eq("id", forced);
  await batch();
  injected("a completed job put back without the dead-only guard turns the not-run-twice check red",
    invocations.get(forced) === ranOnce + 1,
    `ran ${ranOnce} then ${invocations.get(forced)} time(s)`);
} catch (err) {
  failures += 1;
  console.log(`  STOP: ${err.message}`);
} finally {
  if (made.length) await db.from("eng_jobs").delete().in("id", made);
  const { count: residue } = await db.from("eng_jobs").select("id", { count: "exact", head: true }).eq("kind", KIND);
  console.log("");
  rec("teardown: no job this exercise wrote is left", residue === 0, `${residue} left, ${made.length} written`);
  console.log(`\n${failures ? "FAIL" : "PASS"}: ${failures} failure(s).`);
  process.exit(failures ? 1 : 0);
}
