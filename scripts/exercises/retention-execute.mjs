// @runtime react-server
//
// Declared because this exercise reaches modules carrying `server-only`.

/**
 * PHASE 14 RANK 4: RETENTION EXECUTE MODE, EXERCISED FOR THE FIRST TIME.
 *
 *   npx tsx --conditions=react-server scripts/exercises/retention-execute.mjs
 *
 * Operator ruling, 2026-09-15: execute mode runs against DEVELOPMENT only, and
 * only against rows a fixture created. Never against a row that predates the
 * run, never against a kept_forever or kept_pending_counsel table, and the
 * manifest records that the run was an exercise.
 *
 * HOW THE RULING IS HELD RATHER THAN HOPED FOR
 * --------------------------------------------
 * `planRetention` selects EVERY row past the floor, not the rows a caller names,
 * because that is what a real run must do. So "only fixture rows" cannot be
 * passed in; it has to be proven about the plan before the run. This script:
 *
 *  1. refuses to start unless the target is development by name;
 *  2. counts deletable eng_jobs rows past the floor BEFORE writing anything, and
 *     stops if there is one, because that row predates the run;
 *  3. after planning, requires the manifest's id hash to equal the hash of the
 *     fixture's own ids, and ABANDONS the plan without running it otherwise.
 *
 * Step 3 is injection-verified inside the run: a row the fixture list does not
 * name is planted first, and the exercise must refuse.
 *
 * THE AUTHORITY IS CONSTRUCTED, NOT MINTED, AND THAT IS STATED
 * -----------------------------------------------------------
 * `executeAuthority` refuses while the firm is prelaunch, and the launch gate is
 * not to be touched. So this builds the authority value directly, which the
 * TypeScript brand forbids and plain JavaScript cannot. What that means for the
 * result: this proves the EXECUTOR, meaning the plan, the hash, the batches, the
 * never-delete rule and the reconciliation, against real rows. It proves nothing
 * about who may mint the authority; `retention-audit` proves those refusals.
 * No person is named on the manifest, because no person asked: actor_id is null
 * and actor_role is `exercise`.
 *
 * WHAT IT LEAVES BEHIND, BY DESIGN
 * --------------------------------
 * Every eng_jobs row it writes, it removes. It cannot remove the manifests,
 * which refuse DELETE, or the two eng_metrics_daily rollup rows for 2019-05-01
 * and 2019-05-02, which refuse DELETE because a rollup outlives its sources.
 * Those days predate development by seven years and are rewritten, not added
 * to, on a second run. The same trade `retention-audit` makes for 2019-03.
 */

process.loadEnvFile?.(".env.local");

import { auditClient, refOf, DEVELOPMENT_REF } from "../lib/db-target.mjs";
import { planRetention, runRetention, hashIds, abandonRun, manifestById } from "../../src/lib/ops-retention.ts";
import { METRICS } from "../../src/lib/ops-metrics.ts";

const RUN = "2026-09-15";
const KIND = "retention.exercise";
const DAYS = ["2019-05-01", "2019-05-02"];
const EXERCISE_NOTE = `EXERCISE, ${RUN}. Phase 14 rank 4, development only, against eng_jobs rows this exercise created and nothing else. No person asked for this run. `;

let failures = 0;
const rec = (name, ok, detail) => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` (${detail})` : ""}`);
};

const ref = refOf(process.env.SUPABASE_URL ?? "");
if (ref !== DEVELOPMENT_REF) {
  console.error(`REFUSED: this exercise deletes rows and runs against development (${DEVELOPMENT_REF}) by name. Target is ${ref}.`);
  process.exit(1);
}
const db = auditClient("retention execute exercise", { neverProduction: true });
if (!db) {
  console.error("REFUSED: no database configured.");
  process.exit(1);
}
console.log(`retention execute exercise, against ${ref} (development)\n`);

/* Constructed, not minted. See the header. */
const EXERCISE_AUTHORITY = { actorId: null, actorEmail: null, actorRole: "exercise" };
const EXECUTE = { kind: "execute", authority: EXERCISE_AUTHORITY };

const madeJobs = [];
const manifests = [];
const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();

async function insertJobs(rows) {
  const { data, error } = await db.from("eng_jobs").insert(rows).select("id");
  if (error) throw new Error(`fixture insert failed: ${error.message}`);
  madeJobs.push(...data.map((r) => r.id));
  return data.map((r) => r.id);
}

const job = (day, n, status = "done", tag = "fixture") => ({
  kind: KIND,
  status,
  effect_mode: "no_external_effect",
  payload: { exercise: RUN, tag },
  created_at: `${day}T0${n}:00:00Z`,
  run_after: `${day}T0${n}:00:00Z`,
  started_at: `${day}T0${n}:00:01Z`,
  finished_at: `${day}T0${n}:00:02Z`,
  attempts: 1,
  last_error: status === "dead" ? "exercise: a dead job the never-delete rule must keep" : null,
});

async function setRollup(day, value) {
  const { error } = await db
    .from("eng_metrics_daily")
    .upsert([{ day, metric: METRICS.JOBS_COMPLETED, value, computed_at: new Date().toISOString() }], {
      onConflict: "day,metric",
    });
  if (error) throw new Error(`rollup write failed: ${error.message}`);
}

const present = async (ids) =>
  ids.length === 0 ? 0 : (await db.from("eng_jobs").select("id", { count: "exact", head: true }).in("id", ids)).count;

const othersCount = async () =>
  (await db.from("eng_jobs").select("id", { count: "exact", head: true }).neq("kind", KIND)).count;

try {
  // ---------------------------------------------------- nothing predates the run
  const { count: preexisting, error: preErr } = await db
    .from("eng_jobs")
    .select("id", { count: "exact", head: true })
    .lt("finished_at", cutoff)
    .not("status", "in", "(pending,running,dead)");
  if (preErr || typeof preexisting !== "number") throw new Error(`could not count pre-existing rows: ${preErr?.message ?? "null count"}`);
  const { count: leftover } = await db.from("eng_jobs").select("id", { count: "exact", head: true }).eq("kind", KIND);
  rec(
    "no deletable eng_jobs row past the floor exists before the fixture is written",
    preexisting === 0 && leftover === 0,
    `${preexisting} past the floor, ${leftover} left by an earlier exercise`,
  );
  if (preexisting !== 0 || leftover !== 0) throw new Error("a row predates the run, so execute mode would reach it. Stopping before writing anything.");

  // ---------------------------------------------------- the tables it must refuse
  const forever = await planRetention("eng_audit_events", EXECUTE);
  rec("execute mode against a kept_forever table is refused before a manifest exists",
    forever.ok === false && /kept_forever/.test(forever.because), forever.ok ? "IT PLANNED ONE" : forever.because.slice(0, 70));
  const counsel = await planRetention("eng_files", EXECUTE);
  rec("and against a kept_pending_counsel table",
    counsel.ok === false && /kept_pending_counsel/.test(counsel.because), counsel.ok ? "IT PLANNED ONE" : counsel.because.slice(0, 70));

  // ---------------------------------------------------- the fixture
  const fixture = [];
  for (const day of DAYS) fixture.push(...(await insertJobs([job(day, 1), job(day, 2)])));
  const dead = await insertJobs([job(DAYS[0], 3, "dead")]);
  for (const day of DAYS) await setRollup(day, 2);
  const others = await othersCount();
  console.log(`  fixture: ${fixture.length} done job(s) across ${DAYS.join(", ")}, 1 dead job, rollups set to 2 a day; ${others} other job rows\n`);

  // ---------------------------------------------------- injection: a row the fixture did not name
  const foreign = await insertJobs([job(DAYS[0], 4, "done", "planted as if it predated the run")]);
  await setRollup(DAYS[0], 3);
  const plantedPlan = await planRetention("eng_jobs", EXECUTE);
  if (plantedPlan.ok) manifests.push(plantedPlan.manifest.id);
  const plantedMatches = plantedPlan.ok && plantedPlan.manifest.idHash === hashIds(fixture.map(String));
  rec(
    "INJECTION: with a row the fixture did not create in the set, the exercise's hash guard refuses to run",
    plantedPlan.ok && !plantedMatches && plantedPlan.manifest.intendedCount === fixture.length + 1,
    plantedPlan.ok ? `planned ${plantedPlan.manifest.intendedCount}, fixture is ${fixture.length}` : plantedPlan.because.slice(0, 80),
  );
  if (plantedPlan.ok) {
    const abandoned = await abandonRun(plantedPlan.manifest.id, "INJECTION: the planned set held a row this exercise planted to stand in for one it did not create, and the hash guard refused it, so this plan was never run. No real row was involved");
    rec("and the plan is abandoned, not left standing", abandoned.ok === true, abandoned.ok ? "status abandoned" : abandoned.error);
  }
  rec("and nothing was deleted", (await present([...fixture, ...foreign, ...dead])) === fixture.length + 2);
  await db.from("eng_jobs").delete().in("id", foreign);
  madeJobs.splice(madeJobs.indexOf(foreign[0]), 1);
  await setRollup(DAYS[0], 2);

  // ---------------------------------------------------- the run
  const plan = await planRetention("eng_jobs", EXECUTE);
  if (!plan.ok) throw new Error(`the real plan was refused: ${plan.because}`);
  manifests.push(plan.manifest.id);
  const exact = plan.manifest.idHash === hashIds(fixture.map(String)) && plan.manifest.intendedCount === fixture.length;
  rec("the execute plan is exactly the fixture: same count, same id hash",
    exact, `${plan.manifest.intendedCount} planned, hash ${plan.manifest.idHash.slice(0, 12)}...`);
  if (!exact) {
    await abandonRun(plan.manifest.id, "the planned set was not exactly the fixture, so it was never run");
    throw new Error("the plan reached rows the fixture did not create. Abandoned without running.");
  }
  rec("the manifest is written, as execute, before anything is touched",
    plan.manifest.mode === "execute" && plan.manifest.status === "planned" && plan.manifest.affectedCount === 0);

  const run = await runRetention(plan.manifest.id);
  rec("execute mode completes and reconciles",
    run.ok === true && run.report.affected === fixture.length && run.report.reconciled === true,
    run.ok ? run.report.note : run.because);
  rec("the fixture's done jobs are gone from the database", (await present(fixture)) === 0,
    `${await present(fixture)} of ${fixture.length} remain`);
  rec("the dead job past the floor is still there, which is the never-delete rule holding in execute mode",
    (await present(dead)) === 1);
  const othersAfter = await othersCount();
  rec("no other job row was touched", othersAfter === others,
    `${others} before, ${othersAfter} after. A count, taken with no worker running locally`);
  const stored = await manifestById(plan.manifest.id);
  rec("the stored manifest reads complete and reconciled",
    stored?.status === "complete" && stored?.reconciled === true && stored?.affectedCount === fixture.length);

  /*
   * A ROW APPENDED AFTER PLANNING IS NOT A MOVED SET, AND THE FIRST VERSION OF
   * THIS EXERCISE WAS WRONG ABOUT THAT.
   *
   * It planted a row between plan and run and expected a refusal. The run went
   * ahead, correctly: the re-read is bounded by the manifest's id range, a new
   * row takes a higher id than id_high, so it is outside the set by
   * construction and the hash still matches. The injection had not moved the
   * set. So that case is asserted for what it is, and the refusal is injected
   * by moving a row INSIDE the range.
   */
  const appended = await insertJobs([job(DAYS[0], 5), job(DAYS[0], 6)]);
  const appendPlan = await planRetention("eng_jobs", EXECUTE);
  if (appendPlan.ok) manifests.push(appendPlan.manifest.id);
  const late = await insertJobs([job(DAYS[0], 7)]);
  const appendRun = appendPlan.ok ? await runRetention(appendPlan.manifest.id) : null;
  rec(
    "a row appended after planning is outside the manifest's id range: the planned rows go and it stays",
    appendPlan.ok && appendRun?.ok === true && appendRun.report.affected === 2 &&
      (await present(appended)) === 0 && (await present(late)) === 1,
    appendRun ? (appendRun.ok ? appendRun.report.note.slice(0, 60) : appendRun.because) : appendPlan.because,
  );
  await db.from("eng_jobs").delete().in("id", late);
  madeJobs.splice(madeJobs.indexOf(late[0]), 1);

  // ---------------------------------------------------- injection: the set moves under an execute run
  const moving = await insertJobs([job(DAYS[0], 8), job(DAYS[0], 9)]);
  const movedPlan = await planRetention("eng_jobs", EXECUTE);
  if (movedPlan.ok) manifests.push(movedPlan.manifest.id);
  /* One planned row stops being old: inside the id range, out of the cutoff. */
  await db.from("eng_jobs").update({ finished_at: new Date().toISOString() }).eq("id", moving[0]);
  const movedRun = movedPlan.ok ? await runRetention(movedPlan.manifest.id) : null;
  const movedStored = movedPlan.ok ? await manifestById(movedPlan.manifest.id) : null;
  rec(
    "INJECTION: a planned row leaving the set between plan and run makes execute mode refuse, and delete nothing",
    movedPlan.ok && movedRun?.ok === false && /no longer matches/.test(movedRun.because) &&
      (await present(moving)) === 2 && movedStored?.status === "failed" && movedStored?.affectedCount === 0,
    movedRun ? (movedRun.ok ? "IT RAN" : `${movedRun.because} Manifest ${movedStored?.status}`) : movedPlan.because,
  );

  // ---------------------------------------------------- the manifests say what this was
  for (const id of manifests) {
    const m = await manifestById(id);
    await db.from("eng_retention_runs").update({ note: EXERCISE_NOTE + (m?.note ?? "") }).eq("id", id);
  }
  const marked = await Promise.all(manifests.map((id) => manifestById(id)));
  rec("every manifest this run wrote says it was an exercise, and names no person",
    marked.every((m) => m?.note?.startsWith("EXERCISE, ") && m.actorId === null && m.actorRole === "exercise"),
    marked.map((m) => `${m?.id.slice(0, 8)} ${m?.status}`).join(", "));
} catch (err) {
  failures += 1;
  console.log(`  STOP: ${err.message}`);
} finally {
  if (madeJobs.length) await db.from("eng_jobs").delete().in("id", madeJobs);
  const { count: residue } = await db.from("eng_jobs").select("id", { count: "exact", head: true }).eq("kind", KIND);
  const { count: rollups } = await db
    .from("eng_metrics_daily").select("day", { count: "exact", head: true })
    .eq("metric", METRICS.JOBS_COMPLETED).in("day", DAYS);
  console.log("");
  rec("teardown: no eng_jobs row this exercise wrote is left", residue === 0, `${residue} left`);
  console.log(`  left by design: ${manifests.length} manifest(s), which refuse DELETE: ${manifests.join(", ")}`);
  console.log(`  left by design: ${rollups} eng_metrics_daily row(s) for ${DAYS.join(" and ")}, which refuse DELETE`);
  console.log(`\n${failures ? "FAIL" : "PASS"}: ${failures} failure(s).`);
  process.exit(failures ? 1 : 0);
}
