// @runtime react-server
//
// Declared because this reaches modules carrying `server-only`.

/**
 * PLAN A RETENTION PASS, PUT IT ON THE QUEUE, AND READ WHAT IT WOULD HAVE DONE.
 *
 *   npm run retention-dry-run
 *   npm run retention-dry-run -- eng_cron_runs
 *
 * Phase 12 Section 3. Run by hand, like seed-admin and
 * production-schema-check, and the friction is deliberate.
 *
 * WHY THERE IS NO SCHEDULE AND NO SCREEN YET
 * -------------------------------------------
 * A retention pass that ran itself on a timer before anybody had read one is
 * exactly the thing the operator's dry-run-first ruling exists to prevent. The
 * machinery is complete, the job is registered, and what is deliberately absent
 * is anything that starts a run without a person deciding to. BACKLOG.md names
 * the screen and the schedule as the next step, with this as the reason.
 *
 * WHAT THIS DOES AND DOES NOT DO
 * -------------------------------
 * It plans, which writes a manifest and touches nothing. It ENQUEUES, so the
 * sweep runs through the durable queue exactly as it would in production rather
 * than being called directly by this script, which would prove the queue path
 * works by not using it. Then it drains one batch and reads the manifest back.
 *
 * IT CANNOT EXECUTE. There is no argument to this script that deletes a row.
 * An execute run needs an authority minted from a signed-in actor holding
 * retention.execute, and a script has no actor. That is not an oversight to be
 * fixed by adding a flag: a flag is what the mode exists instead of.
 */

process.loadEnvFile?.(".env.local");

/*
 * Constructed for its GUARD rather than for its client. db-target refuses to
 * hand back a connection when SUPABASE_URL is production and
 * ALLOW_PRODUCTION_DB is not exactly "1", and it does that before a client
 * exists, so importing it here puts this script behind the same door every
 * other script is behind. The reads below go through the application's own
 * modules, which is the point.
 */
import { auditClient } from "./lib/db-target.mjs";
import { planRetention, manifestById, sweepable } from "../src/lib/ops-retention.ts";
import { enqueue, runBatch } from "../src/lib/ops-jobs.ts";

const db = auditClient("retention-dry-run");
const only = process.argv[2];
const tables = only ? [only] : sweepable();

const n = (v) => (v === null || v === undefined ? "not set" : String(v));

console.log("");
console.log("================ RETENTION, DRY RUN ================");
console.log("");
console.log(`Tables the declaration allows a run against: ${sweepable().join(", ")}`);
console.log(`Running for: ${tables.join(", ")}`);

let failures = 0;

for (const table of tables) {
  console.log("");
  console.log(`--- ${table} ---------------------------------------------`);

  const before = await db.from(table).select("*", { count: "exact", head: true });
  console.log(`  rows in the table right now: ${n(before.count)}`);

  /*
   * EVERY MANIFEST NAMES WHAT WROTE IT.
   *
   * askedBy was null here at first, and reading eng_retention_runs afterwards
   * showed a table of runs whose actor_role was empty: a person opening it
   * could not tell a run somebody asked for from one a board produced. A
   * script cannot mint an execute authority and should not pretend to have a
   * person behind it, so it names ITSELF.
   */
  const plan = await planRetention(table, {
    kind: "dry_run",
    askedBy: { id: null, email: null, role: "script:retention-dry-run" },
  });
  if (!plan.ok) {
    console.log("");
    console.log("  REFUSED, and nothing was written:");
    console.log(`  ${plan.because}`);
    continue;
  }

  const m = plan.manifest;
  console.log("");
  console.log("  THE MANIFEST, written before anything is touched:");
  console.log(`    id               ${m.id}`);
  console.log(`    table            ${m.table}`);
  console.log(`    rule             ${m.rule}`);
  console.log(`    floor            ${m.floorDays} days on ${m.ageColumn}`);
  console.log(`    cutoff           ${m.cutoff}`);
  console.log(`    mode             ${m.mode}`);
  console.log(`    intended count   ${m.intendedCount}`);
  console.log(`    id range         ${n(m.idLow)} .. ${n(m.idHigh)}`);
  console.log(`    hash of ids      ${m.idHash}`);
  console.log(`    rollup required  ${n(m.rollupMetric)}`);
  for (const d of m.rollupDays) {
    console.log(`      ${d.day}  planned ${d.planned}  rollup ${n(d.rollup)}  ${d.planned === d.rollup ? "reconciles" : "DOES NOT RECONCILE"}`);
  }
  console.log(`    asked by         script:retention-dry-run (a script cannot mint the authority to delete)`);
  console.log(`    planned at (CT)  ${m.plannedAtCt}`);
  console.log(`    status           ${m.status}`);

  const queued = await enqueue("retention.sweep", { manifestId: m.id });
  console.log("");
  console.log(`  ON THE QUEUE: ${queued.ok ? `job ${queued.id}${queued.duplicate ? " (already queued)" : ""}` : `REFUSED: ${queued.error}`}`);
  if (!queued.ok) { failures += 1; continue; }

  /*
   * DRAINING RUNS OTHER PEOPLE'S JOBS, SO IT ASKS FIRST.
   *
   * The queue's claim takes the oldest eligible rows of ANY kind, which is
   * correct for a worker and wrong for a diagnostic tool: the first version of
   * this script called runBatch unconditionally, and on development, where
   * nothing drains the queue, that claimed twenty backed up email jobs and
   * Resend accepted every one of them. Twenty emails went out because a
   * retention dry run wanted to see its own job finish.
   *
   * So it counts what else is waiting and refuses to drain over a backlog. The
   * job is queued either way, which is the part that matters: the sweep runs
   * through the durable queue, and this script never calls the sweep itself.
   */
  const others = await db
    .from("eng_jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "running"])
    .neq("kind", "retention.sweep");

  if ((others.count ?? 0) > 0 && !process.argv.includes("--drain")) {
    console.log("");
    console.log(`  NOT DRAINING. The queue holds ${others.count} pending job(s) of other kinds, and`);
    console.log("  the worker claims the oldest eligible row whatever its kind, so draining here");
    console.log("  would run all of them. Job is queued and will run when the queue next runs.");
    console.log("  Pass --drain to run the queue anyway, knowing what that sends.");
    continue;
  }

  let worked = { claimed: 0, done: 0, retried: 0, dead: 0 };
  for (let pass = 0; pass < 20; pass += 1) {
    const r = await runBatch("retention-dry-run");
    worked = { claimed: worked.claimed + r.claimed, done: worked.done + r.done, retried: worked.retried + r.retried, dead: worked.dead + r.dead };
    if (r.claimed === 0) break;
    const check = await manifestById(m.id);
    if (check && check.status !== "planned") break;
  }
  console.log(
    `  the worker claimed ${worked.claimed} job(s): ${worked.done} done, ${worked.retried} retried, ${worked.dead} dead`,
  );

  const after = await manifestById(m.id);
  console.log("");
  console.log("  WHAT THE RUN RECORDED:");
  console.log(`    status           ${after?.status}`);
  console.log(`    affected count   ${after?.affectedCount}`);
  console.log(`    reconciled       ${after?.reconciled}`);
  console.log(`    note             ${after?.note}`);

  /*
   * THE PLANNED SET, NOT THE TABLE'S ROW COUNT.
   *
   * The first version of this compared the table's total before and after, and
   * reported eng_jobs as having CHANGED under a dry run. It had: the
   * retention.sweep job is itself a row in eng_jobs, so enqueueing the sweep
   * adds one to the table the sweep is about. The count was right and the
   * conclusion was wrong, which is this repository's own recurring defect
   * wearing a row count.
   *
   * What a dry run has to prove is that the rows it PLANNED are still there.
   */
  const post = await db.from(table).select("*", { count: "exact", head: true });
  console.log("");
  console.log(`  rows in the table now: ${n(post.count)}${table === "eng_jobs" ? " (the sweep itself is a row in this table)" : ""}`);

  if (m.intendedCount === 0) {
    console.log("  The plan named no rows, so there was nothing a dry run could have deleted.");
  } else {
    const still = await db.from(table).select("id", { count: "exact", head: true })
      .gte("id", m.idLow).lte("id", m.idHigh).lt(m.ageColumn, m.cutoff);
    const kept = still.count === m.intendedCount;
    console.log(`  rows the plan named that are still present: ${n(still.count)} of ${m.intendedCount}`);
    console.log(`  ${kept ? "NOTHING WAS DELETED, which is what a dry run means." : "*** THE PLANNED ROWS ARE GONE. A DRY RUN MUST NOT DELETE. ***"}`);
    if (!kept) failures += 1;
  }
  if (after?.status !== "complete" || after?.reconciled !== true) {
    console.log("  *** the run did not complete and reconcile ***");
    failures += 1;
  }
}

console.log("");
if (failures) {
  console.log(`${failures} problem(s). A dry run that deletes is not a dry run.`);
  process.exit(1);
}
console.log("The dry run finished. No row was removed from any table.");
