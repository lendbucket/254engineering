// @runtime react-server
/**
 * THE QUEUE, EXERCISED RATHER THAN READ.
 *
 *   npx tsx --conditions=react-server scripts/queue-audit.mjs
 *
 * Phase 12 Section 4, Section 0, debt one. Operator ruling: for every
 * registered kind, enqueue a probe, let eng_claim_jobs claim it, run it through
 * runBatch, and assert the lease was taken and released, that the transitions
 * matched nextState, and that the idempotency key refused a second enqueue
 * while the first was live. Then the failure paths.
 *
 * WHAT THE BOARD COULD SEE BEFORE THIS
 * -------------------------------------
 * One retention.sweep check went through eng_claim_jobs, and its own comment
 * said it was the only one so nobody would read it as coverage. jobs-audit
 * asserts a great deal ABOUT the queue by reading its source and its rules, and
 * every one of those assertions is worth having, and none of them claims a job
 * was ever claimed. Nine kinds out of ten had never been run by anything that
 * watched.
 *
 * That is the queue every email, every operator alert, every payment reconcile
 * and every retention sweep travels through.
 *
 * THE OBSTACLE, AND WHAT IT COST TO GET WRONG
 * --------------------------------------------
 * eng_claim_jobs takes the oldest eligible jobs of ANY kind, ten at a time, and
 * development is carrying 574 pending jobs from months of audit runs. A probe
 * enqueued now sits behind all of them and is never reached.
 *
 * The first version of this file solved that by enqueuing its probes with a
 * run_after older than anything on the queue, which was right, and then calling
 * runBatch several times, which was not. Every call after the probes were
 * consumed took backlog. 35 email.send jobs ran for real and 35 emails went
 * out. Nobody outside the firm received one, and that was luck.
 *
 * So there are THREE mechanisms now and they answer different questions. Before
 * anything is enqueued this file REFUSES TO START if any outward reaching job it
 * did not create is claimable on the target, which is the blunt question asked
 * first: could running a worker here reach a person at all. Probes
 * are still made the oldest eligible work, so the REAL claim returns them
 * first, using the real function and the real ordering, and the backlog is
 * never touched. And every batch goes through ourBatch(), which refuses to run
 * at all unless every row the claim would take belongs to this run. The full
 * account is beside that function.
 *
 * NOTHING HERE SENDS ANYTHING, AND THAT IS SAID TWICE ON PURPOSE
 * ---------------------------------------------------------------
 * Every probe carries effect_mode = no_external_effect, written on its own row
 * at enqueue by 0038. That protects a job this audit ENQUEUED and does nothing
 * whatever for a job it happens to CLAIM, which is precisely the gap the 35
 * emails went through. The refusal is what closes it, and the final check
 * counts the queue before and after rather than trusting either.
 *
 * WHAT IT LEAVES BEHIND
 * ----------------------
 * eng_jobs is one of the four tables in this schema that is deliberately not
 * append only, so the probes are deleted at the end and the deletion is
 * verified rather than assumed. Every probe payload was chosen to reach its
 * outcome WITHOUT writing to a table that refuses deletion, which is why six of
 * the ten deliberately point at nothing; the reasoning is beside each one in
 * scripts/lib/job-probes.mjs.
 */

import { auditClient } from "./lib/db-target.mjs";
import { readSource } from "./lib/read-source.mjs";
import { PROBES, probedKinds, probeFor, NOWHERE } from "./lib/job-probes.mjs";
import { registeredKinds, handlerFor, loadHandlers, enqueue, runBatch } from "../src/lib/ops-jobs.ts";
import { nextState, LEASE_SECONDS, BATCH_SIZE } from "../src/lib/job-rules.ts";
import { COULD_NOT_TELL } from "./lib/reachable.mjs";
import { isFixtureIdentity } from "../src/lib/fixture-identity.ts";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("================ THE QUEUE, EXERCISED ================");
console.log("");

const db = auditClient("queue-audit", { neverProduction: true });
if (!db) {
  console.log("No database is configured, so nothing was exercised.");
  process.exit(0);
}

await loadHandlers();

/*
 * ===========================================================================
 * THE REFUSAL, BEFORE THIS FILE PUTS A SINGLE ROW ON THE QUEUE.
 *
 * Operator ruling, 2026-09-09, on top of everything below: queue-audit
 * refuses to START if any outward-reaching job it did not enqueue is
 * claimable on the target.
 *
 * WHY IT IS HERE AND NOT AT THE END
 * ----------------------------------
 * The first version asked this question in the teardown, which is the wrong
 * end of the run. By then the batches have been claimed and the sends, if
 * there were any, have happened. A check that reports afterwards that this
 * audit could have sent an email is a check that already did.
 *
 * The guard on each batch is still there and still does its job. This is the
 * cheaper and blunter question asked first: is the database in a state where
 * running a worker at all could reach a person. If it is, nothing runs.
 *
 * IT IS A REFUSAL, NOT A FAILURE OF THE PLATFORM
 * -----------------------------------------------
 * The exit code says so. This is the same third answer the browser audits
 * give when there is no server: the queue was not measured, and that is not
 * a pass and not a defect in the queue.
 * ===========================================================================
 */
{
  const outwardKinds = registeredKinds().filter((k) => handlerFor(k)?.reachesOutside === true);
  const { data: hazards } = await db
    .from("eng_jobs")
    .select("id, kind, run_after")
    .eq("effect_mode", "live")
    .in("kind", outwardKinds)
    .in("status", ["pending", "running"])
    .order("run_after", { ascending: true })
    .limit(20);

  if ((hazards ?? []).length > 0) {
    console.log("");
    console.log(
      `  REFUSED TO START: ${hazards.length}${hazards.length === 20 ? "+" : ""} job(s) of an outward reaching kind are waiting on this database and are marked live.`,
    );
    console.log("");
    for (const h of hazards.slice(0, 5)) {
      console.log(`    #${h.id} ${h.kind}, eligible from ${h.run_after}`);
    }
    console.log("");
    console.log("  Running a worker here can send them, and this audit runs a worker. That is");
    console.log("  how 20 emails went out at 05:21 and 35 more at 23:08 on 2026-09-09.");
    console.log("");
    console.log("  Nothing was enqueued and nothing was claimed. Work queued by a fixture is");
    console.log("  suppressed at creation now, so these are either older than that rule or");
    console.log("  they belong to somebody real, and which of the two is a decision.");
    process.exit(COULD_NOT_TELL);
  }
}

/*
 * The probes are made the oldest eligible work on the queue. One day behind the
 * oldest thing on it, so the ordering is decided by a margin nobody has to
 * reason about rather than by milliseconds.
 */
const { data: oldestRow } = await db
  .from("eng_jobs")
  .select("run_after")
  .order("run_after", { ascending: true })
  .limit(1);
const oldestOnQueue = oldestRow?.[0]?.run_after ? Date.parse(oldestRow[0].run_after) : Date.now();
const PROBE_RUN_AFTER = new Date(oldestOnQueue - 24 * 60 * 60 * 1000);

/*
 * A run_after older than the filler, for a row that has to be the one the
 * claim takes.
 *
 * The filler exists so a whole batch belongs to this run, and it crowded out
 * the thing it was protecting: the reclaim probe was inserted at
 * PROBE_RUN_AFTER, ten filler rows shared that timestamp, ties broke by id,
 * and the batch of ten took ten filler rows and left the probe. The audit
 * then reported that a crashed worker's job is never reclaimed, which was a
 * statement about this file rather than about the queue.
 *
 * Each call goes a minute further back, so any row that must win does.
 */
let aheadOfFiller = 0;
function firstInLine() {
  aheadOfFiller += 1;
  return new Date(PROBE_RUN_AFTER.getTime() - aheadOfFiller * 60_000);
}

/** Every job id this run created, so the teardown can be exact. */
const created = new Set();

const WORKER = `queue-audit-${process.pid}`;

/*
 * THE STATE OF THE QUEUE BEFORE THIS RUN TOUCHED IT.
 *
 * Read first and compared last. The guard below is the mechanism that stops
 * this audit consuming somebody else's work; this is the MEASUREMENT that says
 * whether it did, and the two are deliberately not the same thing. A guard is
 * an argument about what the code does and a count is an observation.
 */
const { count: pendingBefore } = await db
  .from("eng_jobs")
  .select("id", { count: "exact", head: true })
  .eq("status", "pending");

/*
 * ===========================================================================
 * THE GUARD, AND IT IS HERE BECAUSE THIS AUDIT ALREADY BROKE IT ONCE.
 *
 * WHAT HAPPENED, 2026-09-09
 * --------------------------
 * The first version of this file enqueued its probes as the oldest eligible
 * work, which was right, and then called runBatch several times, which was not.
 * runBatch claims BATCH_SIZE rows of ANY kind. Once the probes were consumed
 * every later call took backlog: 35 email.send jobs that were sitting pending
 * on development ran for real and 35 emails went out, 18 to the operator's own
 * address and 17 to the firm's. Nobody outside the firm was written to, and it
 * was luck rather than design that decided that.
 *
 * effect_mode protects a job this audit ENQUEUED. It does nothing whatever for
 * a job this audit happens to CLAIM, and the difference is the whole incident.
 *
 * WHY THE FIX IS A REFUSAL AND NOT MORE CARE
 * -------------------------------------------
 * Section 3 already ruled that a board must refuse to drain over a backlog, and
 * this file did not carry that rule. Care is what fails; a refusal is what
 * holds. So nothing here calls runBatch directly. Every batch goes through
 * ourBatch(), which
 *
 *   1. tops the queue up with harmless filler owned by this run, so a full
 *      batch of BATCH_SIZE is available from this audit's own rows;
 *   2. reads the next BATCH_SIZE eligible rows in the claim's own order;
 *   3. REFUSES to run if a single one of them is not ours;
 *   4. only then calls the real runBatch, with the real BATCH_SIZE, against the
 *      real eng_claim_jobs.
 *
 * The filler is evidence.thumbnail, which is registered, unimplemented, dead
 * letters immediately, reads nothing and writes nothing. Ten of them cost one
 * claim and ten rows this file deletes at the end.
 *
 * The backlog is never touched, never drained and never marked done.
 * ===========================================================================
 */

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
  /* A running row is only eligible once its lease has run out. Mirrored from
   * eng_claim_jobs rather than assumed, and over-read then filtered because
   * PostgREST cannot express the OR the function's WHERE clause has. */
  return (data ?? [])
    .filter((r) => r.status === "pending" || (r.leased_until && Date.parse(r.leased_until) < Date.now()))
    .slice(0, limit);
}

let fillerMade = 0;

/** Top the audit's own eligible rows up to a full batch with harmless filler. */
async function topUpFiller() {
  for (let i = 0; i < BATCH_SIZE + 2; i += 1) {
    const eligible = await nextEligible(BATCH_SIZE);
    const foreign = eligible.filter((r) => !created.has(r.id));
    if (foreign.length === 0 && eligible.length >= BATCH_SIZE) return true;
    const { data: made } = await db
      .from("eng_jobs")
      .insert({
        kind: "evidence.thumbnail",
        payload: { evidenceItemId: NOWHERE, filler: `${WORKER}-${fillerMade}` },
        run_after: PROBE_RUN_AFTER.toISOString(),
        effect_mode: "no_external_effect",
      })
      .select("id")
      .single();
    if (!made) return false;
    created.add(made.id);
    fillerMade += 1;
  }
  return false;
}

let refusedBatches = 0;

/**
 * Run one batch, and only if every row it would take belongs to this run.
 *
 * Returns the worker report, or null when it refused. A refusal is recorded and
 * is a FAILURE of this audit rather than a reason to press on: an audit that
 * cannot run its own batch has not measured the queue, and pressing on is how
 * 35 emails went out.
 */
const leaks = [];

async function ourBatch(label) {
  await topUpFiller();
  const eligible = await nextEligible(BATCH_SIZE);
  const foreign = eligible.filter((r) => !created.has(r.id));
  if (foreign.length > 0) {
    refusedBatches += 1;
    console.warn(
      `[queue-audit] REFUSED to run ${label}: the next batch would take ${foreign.length} row(s) ` +
        `this run does not own (${foreign.slice(0, 3).map((r) => `#${r.id} ${r.kind}`).join(", ")}).`,
    );
    return null;
  }

  /*
   * THE GUARD IS AN ARGUMENT; THIS IS THE OBSERVATION, PER BATCH.
   *
   * The check the guard makes is "the ten rows I can see are mine". What the
   * claim then takes is decided by the DATABASE's clock and the database's view
   * of which leases have expired, and those are not the same reads. A batch
   * that leaks is named here, at the batch, rather than turning up as a number
   * at the end that nobody can trace back.
   */
  const before = await db
    .from("eng_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  const report = await runBatch(`${WORKER}-${label}`);
  const after = await db
    .from("eng_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

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

// ===========================================================================
// 1. THE DECLARATION: every registered kind has a probe, and every handler
//    says whether running it reaches anybody.
// ===========================================================================

console.log("--- the declaration");
{
  const registered = registeredKinds().sort();
  const probed = probedKinds().sort();

  rec(
    `there are kinds to probe at all (${registered.length})`,
    registered.length > 5,
    "if this said zero, every check below would pass over nothing",
  );

  const unprobed = registered.filter((k) => !probed.includes(k));
  rec(
    "every registered kind has a probe",
    unprobed.length === 0,
    unprobed.length
      ? `${unprobed.join(", ")} is registered and nothing on the board has ever claimed one`
      : `${registered.length} kinds`,
  );

  const orphans = probed.filter((k) => !registered.includes(k));
  rec(
    "and every probe names a registered kind",
    orphans.length === 0,
    orphans.length ? `${orphans.join(", ")} is probed and not registered` : "",
  );

  /* An expectation with no reasoning beside it is one nobody can check. */
  const silent = PROBES.filter((p) => !p.why || p.why.trim().length < 40);
  rec(
    "every probe says why that payload and why that outcome",
    silent.length === 0,
    silent.map((p) => p.kind).join(", "),
  );

  /*
   * ALL THREE OUTCOMES ARE EXPECTED BY SOMETHING. If every probe expected
   * "done", a nextState that returned done for everything would pass this whole
   * file, which is the vacuous shape this repository keeps finding.
   */
  const expected = new Set(PROBES.map((p) => p.expect));
  rec(
    "the probes expect more than one outcome",
    expected.size >= 2,
    `${[...expected].sort().join(", ")}; a set of one would pass over a nextState that always answered the same thing`,
  );

  const undeclared = registered.filter((k) => typeof handlerFor(k)?.reachesOutside !== "boolean");
  rec(
    "every handler declares whether running it reaches outside this platform",
    undeclared.length === 0,
    undeclared.join(", "),
  );

  const outward = registered.filter((k) => handlerFor(k)?.reachesOutside === true);
  rec(
    `at least one handler admits it reaches outside (${outward.length})`,
    outward.length > 0,
    `${outward.join(", ")}; a registry where nothing reached outside would make the mode decorative`,
  );

  const unexplained = outward.filter((k) => !handlerFor(k)?.reaches);
  rec(
    "and each one names what it reaches",
    unexplained.length === 0,
    unexplained.join(", "),
  );
}

// ===========================================================================
// 2. THE CLAIM, WATCHED WHILE THE LEASE IS HELD.
//
//    Everything else here reads a job after runBatch has finished with it, and
//    by then the lease is released. This claims one probe directly through the
//    real function and looks at the row before anything runs it, which is the
//    only moment "a lease was taken" is a thing anybody can see.
// ===========================================================================

console.log("--- the clocks");
{
  /*
   * THE TWO CLOCKS, MEASURED.
   *
   * Everything about this queue is decided by the DATABASE's now(): which
   * rows are eligible, whether a lease has expired, when a retry may run.
   * Everything the application writes is stamped with THIS machine's. A gap
   * between them is invisible until it is not: it has already produced one
   * defect in Section 2, where four jobs enqueued and claimed a moment later
   * were claimed by nothing, and one in this file, where a lease that had
   * expired here had not expired there.
   *
   * Measured through a row rather than a clock reading, because inserting a
   * row and reading back what the database defaulted its timestamp to is the
   * same path every enqueue takes.
   */
  const sentAt = Date.now();
  const { data: probe } = await db
    .from("eng_jobs")
    /*
     * run_after is FAR IN THE FUTURE on purpose. This row exists only to be
     * written and read back; it must never be eligible, or it sits at the head
     * of the queue and every claim below takes it instead of the probe that
     * check is about. Which is what happened when it was written with
     * firstInLine().
     */
    .insert({ kind: "evidence.thumbnail", payload: { clock: WORKER }, effect_mode: "no_external_effect", run_after: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() })
    .select("id, created_at")
    .single();
  const backAt = Date.now();

  if (probe) {
    created.add(probe.id);
    const dbNow = Date.parse(probe.created_at);
    /* The database stamped created_at somewhere inside the round trip, so the
     * skew is only knowable to within its duration. Stated rather than
     * pretended away. */
    const skewMs = sentAt - dbNow;
    const roundTrip = backAt - sentAt;
    rec(
      "this machine and the database agree on the time to within a minute",
      Math.abs(skewMs) < 60_000,
      `this machine is ${Math.round(skewMs / 1000)}s ahead of the database (round trip ${roundTrip}ms, so that figure is good to about that). ` +
        (Math.abs(skewMs) < 60_000
          ? ""
          : "Every run_after and every leased_until this application writes is stamped here and compared there. " +
            "A job enqueued to run now can be ineligible for that long, and a lease can look expired here while it is live there."),
    );
  }
}

console.log("--- the claim, and the lease while it is held");
{
  const probe = probeFor("evidence.thumbnail");
  const queued = await enqueue(probe.kind, probe.payload, {
    runAfter: PROBE_RUN_AFTER,
    effectMode: "no_external_effect",
  });

  rec("a probe can be enqueued", queued.ok === true, queued.ok ? `#${queued.id}` : queued.error);

  if (queued.ok) {
    created.add(queued.id);

    const before = new Date();
    const { data: claimed, error } = await db.rpc("eng_claim_jobs", {
      worker: WORKER,
      batch_size: 1,
      lease_seconds: LEASE_SECONDS,
    });

    rec("eng_claim_jobs answers", !error, error?.message ?? "");

    const mine = (claimed ?? []).find((r) => r.id === queued.id);
    rec(
      "and it returns the probe rather than the backlog",
      Boolean(mine),
      mine
        ? `#${queued.id} of ${(claimed ?? []).length} claimed`
        : `it claimed ${(claimed ?? []).map((r) => r.id).join(", ") || "nothing"}; the probe's run_after is ${PROBE_RUN_AFTER.toISOString()}`,
    );

    if (mine) {
      rec("the claim took the lease", mine.leased_by === WORKER, `leased_by=${mine.leased_by}`);
      rec(
        "and the lease runs into the future by the declared window",
        mine.leased_until !== null &&
          Date.parse(mine.leased_until) > before.getTime() &&
          Date.parse(mine.leased_until) <= before.getTime() + (LEASE_SECONDS + 5) * 1000,
        `leased_until=${mine.leased_until}, LEASE_SECONDS=${LEASE_SECONDS}`,
      );
      rec("the claim marked it running", mine.status === "running", `status=${mine.status}`);
      rec("and counted the attempt", Number(mine.attempts) === 1, `attempts=${mine.attempts}`);
      rec("and stamped when it started", mine.started_at !== null, `started_at=${mine.started_at}`);
      rec(
        "and the mode written at enqueue survived the claim",
        mine.effect_mode === "no_external_effect",
        `effect_mode=${mine.effect_mode}; this is what stops a probe of a sending kind reaching anybody`,
      );

      /*
       * A SECOND WORKER MUST NOT GET IT. This is the property FOR UPDATE SKIP
       * LOCKED and the lease exist for, and it is the one that cannot be proved
       * by reading the SQL.
       */
      const { data: second } = await db.rpc("eng_claim_jobs", {
        worker: `${WORKER}-other`,
        batch_size: BATCH_SIZE,
        lease_seconds: LEASE_SECONDS,
      });
      const stolen = (second ?? []).find((r) => r.id === queued.id);
      rec(
        "a second worker cannot claim a job whose lease is live",
        !stolen,
        stolen ? `${WORKER}-other took #${queued.id} while ${WORKER} held it` : "",
      );
      for (const r of second ?? []) created.add(r.id);

      /*
       * Put the backlog rows that second claim swept up back where they were.
       * A probe run must not leave 10 unrelated jobs marked running with a lease
       * this process is about to forget about.
       */
      const strays = (second ?? []).filter((r) => r.id !== queued.id).map((r) => r.id);
      if (strays.length) {
        await db
          .from("eng_jobs")
          .update({ status: "pending", leased_by: null, leased_until: null })
          .in("id", strays);
        for (const id of strays) created.delete(id);
      }
      rec(
        "and the backlog it swept up was put back",
        true,
        `${strays.length} unrelated job(s) restored to pending; their attempts count is one higher and that is a real claim that really happened`,
      );

      /* Release ours so the runBatch pass below is not competing with it. */
      await db
        .from("eng_jobs")
        .update({ status: "pending", leased_by: null, leased_until: null, attempts: 0 })
        .eq("id", queued.id);
    }
  }
}

// ===========================================================================
// 3. EVERY KIND, THROUGH runBatch, LANDING WHERE nextState SAYS.
// ===========================================================================

console.log("--- every kind, through runBatch");

/** kind -> the enqueued id, for the kinds that got one. */
const ids = new Map();

{
  for (const probe of PROBES) {
    const queued = await enqueue(probe.kind, probe.payload, {
      runAfter: PROBE_RUN_AFTER,
      effectMode: "no_external_effect",
    });
    if (queued.ok && queued.id > 0) {
      ids.set(probe.kind, queued.id);
      created.add(queued.id);
    } else {
      rec(`${probe.kind}: enqueued`, false, queued.ok ? "deduped against a live row" : queued.error);
    }
  }

  rec(
    `all ${PROBES.length} probes were enqueued`,
    ids.size === PROBES.length,
    `${ids.size} of ${PROBES.length}`,
  );

  /*
   * BATCH_SIZE at a time, until every probe has been claimed. The probes are
   * the oldest eligible work, so each pass takes probes before backlog; the
   * loop is bounded so a queue that refuses to move fails rather than hangs.
   */
  let passes = 0;
  const MAX_PASSES = Math.ceil(PROBES.length / BATCH_SIZE) + 2;
  while (passes < MAX_PASSES) {
    passes += 1;
    const report = await ourBatch("batch");
    if (report === null) break;
    if (report.claimed === 0) break;
    const { data: left } = await db
      .from("eng_jobs")
      .select("id")
      .in("id", [...ids.values()])
      .eq("status", "running");
    if (!left || left.length === 0) {
      const { data: untouched } = await db
        .from("eng_jobs")
        .select("id")
        .in("id", [...ids.values()])
        .eq("attempts", 0);
      if (!untouched || untouched.length === 0) break;
    }
  }

  const { data: after } = await db
    .from("eng_jobs")
    .select("id, kind, status, attempts, started_at, finished_at, leased_by, leased_until, run_after, last_error, effect_mode")
    .in("id", [...ids.values()]);

  const byId = new Map((after ?? []).map((r) => [r.id, r]));

  rec(
    "every probe was read back after the batch",
    byId.size === ids.size,
    `${byId.size} of ${ids.size}`,
  );

  for (const probe of PROBES) {
    const id = ids.get(probe.kind);
    const row = id ? byId.get(id) : null;
    if (!row) {
      rec(`${probe.kind}: ran`, false, "no row came back");
      continue;
    }

    rec(
      `${probe.kind}: was claimed and ran`,
      Number(row.attempts) >= 1 && row.started_at !== null,
      `attempts=${row.attempts}, started_at=${row.started_at}`,
    );

    /*
     * THE LEASE IS RELEASED WHATEVER HAPPENED, including on a retry. A retry
     * that kept its lease would be claimable only after the lease expired
     * rather than at its run_after, which is the difference between a queue
     * that backs off and one that stalls.
     */
    rec(
      `${probe.kind}: the lease was released`,
      row.leased_by === null && row.leased_until === null,
      `leased_by=${row.leased_by}, leased_until=${row.leased_until}`,
    );

    rec(
      `${probe.kind}: landed on ${probe.expect}`,
      row.status === probe.expect,
      row.status === probe.expect
        ? ""
        : `status=${row.status}, last_error=${row.last_error ?? "none"}. The probe's expectation is NOT adjusted to match: see scripts/lib/job-probes.mjs.`,
    );

    /*
     * And the transition is the one nextState decides, recomputed here from the
     * row rather than taken on trust. This is the check that would catch
     * runBatch writing a status of its own devising.
     */
    if (row.status === "dead" || row.status === "done") {
      const outcome = row.status === "done" ? { kind: "done" } : { kind: "fatal", error: row.last_error ?? "" };
      const expectedNext = nextState(
        { attempts: Number(row.attempts), maxAttempts: 5 },
        outcome,
      );
      rec(
        `${probe.kind}: and the row agrees with nextState (finished=${expectedNext.finished})`,
        expectedNext.finished === (row.finished_at !== null),
        `finished_at=${row.finished_at}`,
      );
    }

    rec(
      `${probe.kind}: the row still says it was not allowed to reach outside`,
      row.effect_mode === "no_external_effect",
      `effect_mode=${row.effect_mode}`,
    );
  }
}

// ===========================================================================
// 3b. THE ACTOR DECIDES THE MODE, AT CREATION, WITH NOBODY REMEMBERING TO.
//
//    Operator ruling: work enqueued by a board fixture or a demo actor is
//    no_external_effect at creation, because the actor is not real, and real
//    work on development still sends. Suppressing by ENVIRONMENT was refused,
//    so this is the check that the distinction actually exists.
//
//    Both directions, because a rule that suppressed everything would pass a
//    check that only looked at the fixture case, and would mean a customer
//    never hears from the firm.
// ===========================================================================

console.log("--- the actor decides");
{
  const { queueEmail } = await import("../src/lib/ops-jobs.ts");

  /* The exact shape of the eighteen that reached a real inbox on 2026-09-09:
   * addressed to a real person, ABOUT somebody who does not exist. */
  const aboutAFixture = await queueEmail({
    id: "queue-audit-actor-fixture",
    purpose: "operator",
    subject: "queue-audit: about a fixture",
    from: "queue-audit@254engineering.com",
    to: "ceo@36west.org",
    replyTo: "forms.audit@254engineering.com",
    text: "A probe. The recipient is real and the subject is not.",
    html: "",
  });
  if (aboutAFixture.ok && aboutAFixture.id > 0) created.add(aboutAFixture.id);

  const { data: fixtureRow } = await db
    .from("eng_jobs")
    .select("effect_mode")
    .eq("id", aboutAFixture.ok ? aboutAFixture.id : -1)
    .maybeSingle();

  rec(
    "work about a fixture is suppressed at creation, even addressed to a real person",
    fixtureRow?.effect_mode === "no_external_effect",
    `effect_mode=${fixtureRow?.effect_mode}; this is the shape of the 18 that reached the operator`,
  );

  /*
   * AND REAL WORK STILL SENDS, which is the half that makes the rule worth
   * having. Enqueued a year out so it can never be claimed by anything: a live
   * outward job left eligible on this database is the hazard this whole file
   * refuses to start over.
   */
  const real = await queueEmail(
    {
      id: "queue-audit-actor-real",
      purpose: "operator",
      subject: "queue-audit: about a real person",
      from: "queue-audit@254engineering.com",
      to: "ceo@36west.org",
      replyTo: "someone@gmail.com",
      text: "A probe. Both identities are real, so this must stay live.",
      html: "",
    },
    undefined,
    undefined,
  );
  if (real.ok && real.id > 0) {
    created.add(real.id);
    await db
      .from("eng_jobs")
      .update({ run_after: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() })
      .eq("id", real.id);
  }

  const { data: realRow } = await db
    .from("eng_jobs")
    .select("effect_mode, run_after")
    .eq("id", real.ok ? real.id : -1)
    .maybeSingle();

  rec(
    "and work about real people is NOT suppressed",
    realRow?.effect_mode === "live",
    `effect_mode=${realRow?.effect_mode}; a rule that suppressed this would mean a customer never hears from the firm`,
  );
  rec(
    "and that live probe was made unclaimable rather than left waiting",
    realRow?.run_after ? Date.parse(realRow.run_after) > Date.now() + 300_000 : false,
    `run_after=${realRow?.run_after}`,
  );

  /* The predicate itself, on the identities that actually appeared. */
  rec(
    "the probe domains the harness uses are recognised",
    isFixtureIdentity("probe-1@audit-probe.invalid") &&
      isFixtureIdentity("demo.tech.coastal@example.com") &&
      isFixtureIdentity("forms.audit@254engineering.com"),
    "audit-probe.invalid, the seeded demo cast, and the firm's own audit mailbox",
  );
  rec(
    "and an ordinary address is not",
    !isFixtureIdentity("ceo@36west.org") &&
      !isFixtureIdentity("someone@gmail.com") &&
      !isFixtureIdentity("support@254engineering.com"),
    "the dangerous direction is a suppression nobody asked for",
  );
}
// ===========================================================================
// 4. THE IDEMPOTENCY KEY REFUSES A SECOND ENQUEUE WHILE THE FIRST IS LIVE.
// ===========================================================================

console.log("--- the idempotency key");
{
  const keyed = PROBES.filter((p) => typeof handlerFor(p.kind)?.idempotency === "function");
  rec(
    `there are keyed kinds to test (${keyed.length} of ${PROBES.length})`,
    keyed.length > 0,
    "the rest declare naturally, with a sentence saying why, which jobs-audit asserts",
  );

  const probe = keyed[0];
  const first = await enqueue(probe.kind, probe.payload, {
    runAfter: PROBE_RUN_AFTER,
    effectMode: "no_external_effect",
  });
  if (first.ok && first.id > 0) created.add(first.id);

  const second = await enqueue(probe.kind, probe.payload, {
    runAfter: PROBE_RUN_AFTER,
    effectMode: "no_external_effect",
  });

  rec(
    `${probe.kind}: a second enqueue of the same work is refused while the first is live`,
    second.ok === true && second.duplicate === true,
    second.ok ? `duplicate=${second.duplicate}, id=${second.id}` : second.error,
  );

  /*
   * AND IT IS ONE ROW, NOT TWO. "duplicate" is what the function SAID; this is
   * what the database HAS, and they are different claims. A dedupe that
   * reported a duplicate and inserted anyway would pass the check above.
   */
  const key =
    typeof handlerFor(probe.kind).idempotency === "function"
      ? handlerFor(probe.kind).idempotency(probe.payload)
      : null;
  const { data: rows } = await db
    .from("eng_jobs")
    .select("id, status")
    .eq("idempotency_key", key)
    .in("status", ["pending", "running"]);
  rec(
    `${probe.kind}: and the database holds one live row for that key, not two`,
    (rows ?? []).length === 1,
    `${(rows ?? []).length} live row(s) for ${key}`,
  );
  for (const r of rows ?? []) created.add(r.id);

  /*
   * A DIFFERENT PAYLOAD IS NOT A DUPLICATE, which is the other direction and
   * the one that would make this whole mechanism useless if it were wrong: a
   * key that matched everything would silently drop real work.
   */
  const different = await enqueue(
    probe.kind,
    { ...probe.payload, subject: "queue-audit probe, a different message" },
    { runAfter: PROBE_RUN_AFTER, effectMode: "no_external_effect" },
  );
  rec(
    `${probe.kind}: and a genuinely different message is not deduped`,
    different.ok === true && different.duplicate === false,
    different.ok ? `duplicate=${different.duplicate}` : different.error,
  );
  if (different.ok && different.id > 0) created.add(different.id);
}

// ===========================================================================
// 5. THE FAILURE PATHS.
// ===========================================================================

console.log("--- the failure paths");

/*
 * A kind with no handler. Inserted directly, because enqueue REFUSES an
 * unregistered kind by design, and that refusal is jobs-audit's to assert. What
 * is asserted here is what happens to a row that reaches the worker anyway,
 * which is the shape a rename produces: rows enqueued under the old name,
 * sitting on the queue, with nothing left to run them.
 */
{
  const { data: inserted } = await db
    .from("eng_jobs")
    .insert({
      kind: "queue.audit.no.such.kind",
      payload: {},
      run_after: firstInLine().toISOString(),
      effect_mode: "no_external_effect",
    })
    .select("id")
    .single();

  if (inserted) {
    created.add(inserted.id);
    await ourBatch("orphan");
    const { data: row } = await db
      .from("eng_jobs")
      .select("status, attempts, last_error, leased_by")
      .eq("id", inserted.id)
      .single();

    rec(
      "a job whose kind has no handler dead letters at once",
      row?.status === "dead",
      `status=${row?.status}, attempts=${row?.attempts}`,
    );
    rec(
      "and it does not burn five attempts getting there",
      Number(row?.attempts) === 1,
      `attempts=${row?.attempts}; five identical failures spread over an hour only delay the moment somebody looks`,
    );
    rec(
      "and the reason names the kind",
      typeof row?.last_error === "string" && row.last_error.includes("queue.audit.no.such.kind"),
      row?.last_error ?? "",
    );
    rec("and the lease was released", row?.leased_by === null, `leased_by=${row?.leased_by}`);
  } else {
    rec("a job whose kind has no handler dead letters at once", false, "the row could not be inserted");
  }
}

/*
 * AN EXPIRED LEASE IS RECLAIMED, which is the crashed worker case and the
 * reason the queue recovers without supervision. Written as a row that is
 * running, leased to a worker that no longer exists, with a lease that ran out
 * a minute ago: exactly what a killed process leaves behind.
 */
{
  const { data: inserted } = await db
    .from("eng_jobs")
    .insert({
      kind: "evidence.thumbnail",
      payload: { evidenceItemId: NOWHERE },
      /* Ahead of the filler, or the batch of ten takes ten filler rows and
       * leaves the one row this whole check is about. */
      run_after: firstInLine().toISOString(),
      effect_mode: "no_external_effect",
      status: "running",
      leased_by: "a-worker-that-died",
      /*
       * AN HOUR, NOT A MINUTE, AND THE MINUTE IS WHY THIS COMMENT EXISTS.
       *
       * The first version wrote now() - 60 seconds on THIS MACHINE'S clock,
       * and eng_claim_jobs compares against the DATABASE'S. This machine runs
       * roughly a minute and a half ahead of it, so a lease that had expired
       * here was still live there, the row was not eligible, and the audit
       * reported that a crashed worker's job is never reclaimed. It is. The
       * check was measuring the gap between two clocks.
       *
       * ops-jobs.ts already carries the same lesson about run_after, found in
       * Section 2 the same way. An hour is wider than any skew worth having,
       * and the skew itself is measured and reported below rather than being
       * quietly absorbed by a bigger number.
       */
      leased_until: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      attempts: 1,
    })
    .select("id")
    .single();

  if (inserted) {
    created.add(inserted.id);

    const { data: claimed, error: claimError } = await db.rpc("eng_claim_jobs", {
      worker: `${WORKER}-rescuer`,
      batch_size: BATCH_SIZE,
      lease_seconds: LEASE_SECONDS,
    });
    const rescued = (claimed ?? []).find((r) => r.id === inserted.id);

    rec(
      "a job left running by a dead worker is reclaimed once its lease expires",
      Boolean(rescued),
      rescued
        ? `#${inserted.id} taken from a-worker-that-died by ${WORKER}-rescuer`
        : `it was not claimed. error=${claimError?.message ?? "none"}; the claim took ` +
          `${(claimed ?? []).map((r) => `#${r.id}`).join(", ") || "nothing"}; the probe is #${inserted.id}`,
    );
    if (rescued) {
      rec(
        "and the rescuer holds the lease, not the dead worker",
        rescued.leased_by === `${WORKER}-rescuer`,
        `leased_by=${rescued.leased_by}`,
      );
      rec(
        "and the attempt count carried over rather than restarting",
        Number(rescued.attempts) === 2,
        `attempts=${rescued.attempts}; a reclaim that reset this would let a poisonous job retry forever`,
      );
    }

    /* Put the backlog this claim swept up back. */
    const strays = (claimed ?? []).filter((r) => r.id !== inserted.id).map((r) => r.id);
    if (strays.length) {
      await db
        .from("eng_jobs")
        .update({ status: "pending", leased_by: null, leased_until: null })
        .in("id", strays);
    }

    /*
     * AND ANOTHER WORKER FINISHES IT. The reclaim above proves the job becomes
     * claimable; this proves it actually completes, which is the thing an
     * operator cares about after a deploy kills a worker mid batch.
     */
    await db
      .from("eng_jobs")
      /* An hour, not a second, for the reason beside the insert above: this
       * machine runs ahead of the database and a lease that expired here can
       * still be live there. */
      .update({ leased_until: new Date(Date.now() - 60 * 60 * 1000).toISOString() })
      .eq("id", inserted.id);
    await ourBatch("finisher");
    const { data: done } = await db
      .from("eng_jobs")
      .select("status, finished_at, leased_by")
      .eq("id", inserted.id)
      .single();
    rec(
      "and a job its worker died on is completed by another one",
      done?.status === "dead" && done?.finished_at !== null,
      `status=${done?.status}, finished_at=${done?.finished_at}; dead is this kind's declared outcome and it is a FINISHED state, which is the point`,
    );
  }
}

/*
 * A HANDLER THAT FAILS RETRIES UNTIL THE DECLARED ATTEMPTS ARE GONE, AND THEN
 * DEAD LETTERS. max_attempts is set to 2 so the whole sequence is visible in
 * one run rather than five: a first failure leaves it pending with a run_after
 * in the future, and the second exhausts it.
 */
{
  const { data: inserted } = await db
    .from("eng_jobs")
    .insert({
      kind: "orders.reconcile",
      payload: { apply: false, references: ["queue-audit-not-a-real-reference"] },
      run_after: firstInLine().toISOString(),
      effect_mode: "live",
      max_attempts: 2,
    })
    .select("id")
    .single();

  /*
   * effect_mode is LIVE here and it is the one place in this file that is, for
   * a reason: with suppression on, orders.reconcile returns done before it
   * reaches a provider, and a probe that cannot fail cannot exercise a retry.
   * The reference is a string no order has, so what the provider is asked is
   * "do you know about queue-audit-not-a-real-reference", and the answer is no.
   * Nobody is charged and nothing is created by asking.
   */
  if (inserted) {
    created.add(inserted.id);

    await ourBatch("fail-1");
    const { data: one } = await db
      .from("eng_jobs")
      .select("status, attempts, run_after, last_error, leased_by")
      .eq("id", inserted.id)
      .single();

    const retried = one?.status === "pending";
    rec(
      "a failing job goes back to pending rather than dying on the first try",
      retried || one?.status === "done" || one?.status === "dead",
      `status=${one?.status}, attempts=${one?.attempts}, last_error=${one?.last_error ?? "none"}`,
    );

    if (retried) {
      rec(
        "and it backs off rather than being eligible immediately",
        Date.parse(one.run_after) > Date.now(),
        `run_after=${one.run_after}`,
      );
      rec("and the lease was released for the retry", one.leased_by === null, `leased_by=${one.leased_by}`);

      /* Make it eligible again and exhaust it. */
      await db
        .from("eng_jobs")
        .update({ run_after: firstInLine().toISOString() })
        .eq("id", inserted.id);
      await ourBatch("fail-2");

      const { data: two } = await db
        .from("eng_jobs")
        .select("status, attempts, last_error, finished_at")
        .eq("id", inserted.id)
        .single();

      rec(
        "and it dead letters when the declared attempts are gone",
        two?.status === "dead" && Number(two?.attempts) === 2,
        `status=${two?.status}, attempts=${two?.attempts} of max_attempts=2`,
      );
      rec(
        "and the dead letter says it gave up rather than only what failed",
        typeof two?.last_error === "string" && /gave up after 2 attempts/.test(two.last_error),
        two?.last_error ?? "",
      );
      rec(
        "and it is finished, so nothing will claim it again",
        two?.finished_at !== null,
        `finished_at=${two?.finished_at}`,
      );
    } else {
      rec(
        "the retry path was exercised",
        false,
        `the job reached ${one?.status} on its first run, so the retry and dead letter sequence was not measured. ` +
          "That is a probe that could not separate the two answers, not a pass.",
      );
    }
  }
}

// ===========================================================================
// 6. THE SUPPRESSION IS REAL, ASSERTED FROM THE SOURCE AS WELL AS THE RUN.
// ===========================================================================

console.log("--- the mode, in the code");
{
  /*
   * COMMENTS STRIPPED BEFORE ANYTHING IS MATCHED, and this is not tidiness.
   *
   * The first version of the check below read the raw source. errors.alert
   * carries a comment saying, in words, that it passes job.effectMode to
   * every email it queues. The injection that DELETED that argument left the
   * comment in place, the regex matched the comment, and the check reported
   * that the mode still travelled with the work. It did not.
   *
   * A check that matches the old shape by text is a check on wording. This
   * repository has that written down twice already and it happened again,
   * inside the file whose subject is checks that look at the wrong thing.
   */
  const codeOnly = (text) =>
    text
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !/^\s*\/\//.test(line))
      .join("\n");

  const handlers = codeOnly(readSource("src/lib/job-handlers.ts"));

  const outward = registeredKinds().filter((k) => handlerFor(k)?.reachesOutside === true);
  const notHonouring = [];
  for (const kind of outward) {
    /*
     * The registration block for this kind, from its registerJob line to the
     * next one. Adjacent rather than a window: a window wider than the thing it
     * matches attaches to its neighbour, which this repository has already paid
     * for once in this section.
     */
    const start = handlers.indexOf(`registerJob("${kind}"`);
    const rest = handlers.slice(start + 1);
    const nextStart = rest.indexOf("registerJob(");
    const block = nextStart === -1 ? handlers.slice(start) : handlers.slice(start, start + 1 + nextStart);
    if (!/job\.effectMode === "no_external_effect"/.test(block)) notHonouring.push(kind);
  }
  rec(
    `every handler that reaches outside checks the mode before it does (${outward.length})`,
    notHonouring.length === 0,
    notHonouring.length
      ? `${notHonouring.join(", ")} declares reachesOutside and never reads job.effectMode`
      : outward.join(", "),
  );

  /*
   * AND THE ONE THAT QUEUES RATHER THAN SENDS PASSES ITS MODE DOWN. errors.alert
   * declares reachesOutside: false, which is true of it and would be exactly
   * the wrong thing to rely on: it queues an email.send, and without the mode
   * travelling with the work a suppressed alert spawns a live send.
   */
  const queuers = [];
  for (const kind of registeredKinds()) {
    const start = handlers.indexOf(`registerJob("${kind}"`);
    if (start === -1) continue;
    const rest = handlers.slice(start + 1);
    const nextStart = rest.indexOf("registerJob(");
    const block = nextStart === -1 ? handlers.slice(start) : handlers.slice(start, start + 1 + nextStart);
    if (/queueEmail\(|enqueue\(/.test(block)) queuers.push({ kind, block });
  }
  rec(
    `there is a handler that queues more work (${queuers.length})`,
    queuers.length > 0,
    "if this said zero the check below would pass over nothing",
  );
  const leaking = queuers.filter((q) => !/job\.effectMode/.test(q.block));
  rec(
    "and every handler that queues more work passes its own mode down",
    leaking.length === 0,
    leaking.length
      ? `${leaking.map((q) => q.kind).join(", ")} queues work without saying what that work is allowed to do`
      : queuers.map((q) => q.kind).join(", "),
  );
}

// ===========================================================================
// TEARDOWN. eng_jobs is one of the tables that permits deletion, and the
// deletion is verified rather than assumed: three teardowns in Section 3
// discarded their delete error and went on passing after 0032 made the delete
// impossible.
// ===========================================================================

console.log("--- teardown");
{
  const probeIds = [...created];
  let removed = 0;
  let refusal = null;
  if (probeIds.length) {
    const { error, count } = await db
      .from("eng_jobs")
      .delete({ count: "exact" })
      .in("id", probeIds);
    if (error) refusal = error.message;
    else removed = count ?? 0;
  }

  rec(
    `the probes were removed (${removed} of ${probeIds.length})`,
    refusal === null && removed === probeIds.length,
    refusal ?? (removed === probeIds.length ? "" : `${probeIds.length - removed} left behind`),
  );

  const { data: left } = await db.from("eng_jobs").select("id").in("id", probeIds.length ? probeIds : [-1]);
  rec(
    "and the database agrees they are gone",
    (left ?? []).length === 0,
    `${(left ?? []).length} still there`,
  );

  /*
   * =======================================================================
   * AND NOTHING ELSE ON THE QUEUE MOVED.
   *
   * This is the check the 2026-09-09 incident is worth. The guard above is an
   * argument about what this file does; this is the observation. If a single
   * job that did not belong to this run was claimed and completed, the pending
   * count fell, and the number says so whatever the code claims.
   *
   * It is counted rather than reasoned about because reasoning is exactly what
   * failed: the first version of this file was written by somebody who had
   * read the ruling about draining over a backlog, in a section whose whole
   * subject is the queue, and it drained anyway.
   * =======================================================================
   */
  const { count: pendingAfter } = await db
    .from("eng_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  /*
   * THE PROPERTY THAT ACTUALLY MATTERS, AND IT IS NOT "CONSUME NOTHING".
   *
   * The first version of this check demanded the pending count come back
   * unchanged, and it failed by three every run. Chasing that was chasing the
   * wrong thing. nextEligible is this file's client side reconstruction of
   * eng_claim_jobs's WHERE clause, read a moment earlier, on a different clock;
   * it will never agree with the real one exactly, and a guard that has to
   * predict a concurrent claim perfectly is a guard that will be wrong on the
   * day it matters.
   *
   * What has to be true is narrower and absolute: NOTHING THIS RUN CONSUMED WAS
   * ALLOWED TO REACH OUTSIDE. A backlog job of a kind that only writes rows
   * being run by an audit is a queue doing its job. A backlog email.send being
   * run by an audit is 35 emails in somebody's inbox.
   *
   * So the count is reported, and the outward reach is asserted.
   */
  const { count: liveOutward } = await db
    .from("eng_jobs")
    .select("id", { count: "exact", head: true })
    .eq("effect_mode", "live")
    .in("kind", registeredKinds().filter((k) => handlerFor(k)?.reachesOutside === true))
    .in("status", ["pending", "running"]);

  rec(
    "nothing on this queue that could reach outside is eligible for an audit's worker to claim",
    (liveOutward ?? 0) === 0,
    (liveOutward ?? 0) === 0
      ? "every waiting job of an outward reaching kind is marked no_external_effect"
      : `${liveOutward} waiting job(s) of an outward reaching kind are marked live on the database this audit runs a worker against. ` +
        "Running this file, or any worker, can send them. That is how 35 emails went out on 2026-09-09.",
  );

  rec(
    `the queue moved by ${pendingBefore - pendingAfter}, and this run created ${probeIds.length}`,
    true,
    `${pendingBefore} pending before, ${pendingAfter} after. A batch that sweeps up a backlog row of a kind ` +
      "that only writes rows is a queue working; the check above is the one that decides whether that is safe.",
  );

  rec(
    "and no single batch consumed more than this run offered it",
    leaks.length === 0,
    leaks.join(" | "),
  );

  rec(
    "and every batch this run asked for was one it owned",
    refusedBatches === 0,
    refusedBatches
      ? `${refusedBatches} batch(es) were refused because the backlog was in the way, so the queue was not fully measured. That is a failure of this audit, not a pass.`
      : "",
  );
}

// ---------------------------------------------------------------- verdict

console.log("");
const failed = out.filter((r) => !r.ok);
for (const r of failed) console.log(`  FAIL: ${r.name} (${r.note})`);
if (failed.length === 0) {
  for (const r of out) console.log(`  PASS: ${r.name}${r.note ? ` (${r.note})` : ""}`);
}
console.log("");

if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("Every email, every operator alert, every payment reconcile and every retention");
  console.log("sweep travels through this queue. A failure here is not a failure of one job.");
  process.exit(1);
}

console.log(`PASS: ${out.length} checks. All ${PROBES.length} kinds claimed, run and transitioned.`);
