// @runtime react-server
//
/**
 * RETENTION PLANS WHOLE DAYS ONLY, AND A REAL SHORTFALL STILL REFUSES.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server \
 *     scripts/proofs/retention-plans-whole-days.mjs
 *
 * Operator ruling, 2026-10-06: the planner's cutoff floors to 00:00 UTC, so it
 * only ever plans whole days, and a day is eligible only when all of it is
 * older than the floor.
 *
 * WHAT PRODUCTION SHOWED. The retention alert said eng_jobs "does not
 * reconcile" for 2026-09-06: the planner held 208 rows and jobs.completed said
 * 289. Read on production by the operator's chat counterpart on 2026-10-06: the
 * rollup is 289, the planner's own predicate at the run's bounds of 17:15:24
 * and 17:15:28 UTC returns 208 both times, the 2026-10-05 run against
 * 2026-09-05 returned 207 against 289, and the database TimeZone is UTC. No row
 * had left the table. The cutoff was an exact instant, so the newest planned
 * day was part of a day, compared against a rollup of the whole day.
 *
 * WHY THE FIXTURE IS PRODUCTION'S SHAPE. 289 is 288 five-minute health-watch
 * sweeps plus one. 208 of them on 2026-09-06 finished before 17:15:24. A
 * fixture that cannot separate the two answers proves neither, so the first
 * check asserts it has rows on BOTH sides of the exact instant, and the last
 * check replays the old exact cutoff against the same rows and requires
 * production's own refusal to come back.
 *
 * WHAT IS THE PRODUCT AND WHAT IS NOT. `cutoffFor`, `dayOf` and
 * `reconcileDays` are imported from the planner itself. The one thing restated
 * here is the database's `lt` comparison, as `Date.parse(row) <
 * Date.parse(cutoff)`, because there is no database in a proof. The expected
 * cutoffs and refusal sentences are written out as literals, never computed
 * from the module under test.
 */

const { cutoffFor, dayOf, reconcileDays } = await import("../../src/lib/ops-retention.ts");

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

/* The run production actually made, and the line that run should draw. */
const RUN = new Date("2026-10-06T17:15:24.000Z");
const FLOOR_DAYS = 30;
const EXACT_INSTANT = "2026-09-06T17:15:24.000Z";
const WHOLE_DAY_LINE = "2026-09-06T00:00:00.000Z";

const RULE = { rollupRequired: "jobs.completed", ageColumn: "finished_at" };
const HELD = new Map([
  ["2026-09-05", 289],
  ["2026-09-06", 289],
]);

/** 288 sweeps at five-minute marks, plus one more at the end of the day. */
function aDayOfJobs(day) {
  const rows = [];
  for (let slot = 0; slot < 288; slot += 1) {
    const minutes = slot * 5;
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");
    rows.push({ finished_at: `${day}T${hh}:${mm}:05.000Z` });
  }
  rows.push({ finished_at: `${day}T23:59:59.000Z` });
  return rows;
}

const FIXTURE = [...aDayOfJobs("2026-09-05"), ...aDayOfJobs("2026-09-06")];

/** The planner's read, without a database: older than the line, grouped by dayOf. */
function plan(rows, cutoff) {
  const days = new Map();
  for (const r of rows) {
    if (!(Date.parse(r.finished_at) < Date.parse(cutoff))) continue;
    const d = dayOf(r.finished_at);
    days.set(d, (days.get(d) ?? 0) + 1);
  }
  return days;
}

/* ------------------------------------------------- the fixture can tell */

{
  const sixth = FIXTURE.filter((r) => r.finished_at.startsWith("2026-09-06"));
  const before = sixth.filter((r) => Date.parse(r.finished_at) < Date.parse(EXACT_INSTANT)).length;
  const after = sixth.length - before;
  rec(
    "premise: the boundary day has rows on both sides of the exact instant, as production did",
    sixth.length === 289 && before === 208 && after === 81,
    `${sixth.length} rows on 2026-09-06, ${before} before ${EXACT_INSTANT} and ${after} after (if either side were empty this proof could not tell an exact cutoff from a floored one)`,
  );
}

/* ---------------------------------------------- the line is a whole day */

{
  const cutoff = cutoffFor(FLOOR_DAYS, RUN);
  rec(
    "the 2026-10-06 17:15:24 UTC run draws the line at 00:00 UTC on 2026-09-06",
    cutoff === WHOLE_DAY_LINE,
    `got ${cutoff}, expected ${WHOLE_DAY_LINE}`,
  );

  const days = plan(FIXTURE, cutoff);
  rec(
    "and plans none of 2026-09-06, the day not yet wholly older than the floor",
    !days.has("2026-09-06"),
    days.has("2026-09-06") ? `IT PLANNED ${days.get("2026-09-06")} ROWS OF A PART DAY` : "2026-09-06 is not in the planned set",
  );
  rec(
    "and plans all of 2026-09-05, which is wholly older than the floor",
    days.get("2026-09-05") === 289,
    `${days.get("2026-09-05") ?? 0} of 289`,
  );

  const verdict = reconcileDays("eng_jobs", RULE, days, HELD);
  rec(
    "so the plan reconciles against the rollup production holds",
    verdict.ok === true &&
      verdict.rollupDays.length === 1 &&
      verdict.rollupDays[0].day === "2026-09-05" &&
      verdict.rollupDays[0].planned === 289 &&
      verdict.rollupDays[0].rollup === 289,
    verdict.ok ? JSON.stringify(verdict.rollupDays) : `REFUSED: ${verdict.because}`,
  );
}

/* -------------------------------------- a real shortfall still refuses */

{
  const cutoff = cutoffFor(FLOOR_DAYS, RUN);
  const missingOne = FIXTURE.filter((r) => r.finished_at !== "2026-09-05T12:00:05.000Z");
  const verdict = reconcileDays("eng_jobs", RULE, plan(missingOne, cutoff), HELD);
  const expected =
    "2026-09-05 does not reconcile: eng_jobs holds 288 row(s) for it and jobs.completed says 289. " +
    "The rollup and its source disagree, so nothing is deleted. Whichever is wrong, deleting the " +
    "source would make the disagreement permanent.";
  rec(
    "a whole day one row short of its rollup is refused, in the planner's exact sentence",
    verdict.ok === false && verdict.because === expected,
    verdict.ok ? "IT PLANNED A DAY THAT DOES NOT RECONCILE" : verdict.because,
  );
}

{
  const cutoff = cutoffFor(FLOOR_DAYS, RUN);
  const verdict = reconcileDays("eng_jobs", RULE, plan(FIXTURE, cutoff), new Map([["2026-09-06", 289]]));
  const expected =
    "2026-09-05 has 289 row(s) in eng_jobs and no jobs.completed figure in eng_metrics_daily. " +
    "The rollup that replaces this day does not exist yet, so the day is not deleted. Run the " +
    "metrics rollup for that day first.";
  rec(
    "a whole day with no rollup at all is refused, in the planner's exact sentence",
    verdict.ok === false && verdict.because === expected,
    verdict.ok ? "IT PLANNED A DAY NOTHING HAS ROLLED UP" : verdict.because,
  );
}

/* ------------------------- and the old line reproduces production's stall */

{
  /*
   * THE COUNTERFACTUAL, written out on purpose: this is the formula cutoffFor
   * used before 2026-10-06. If the same rows under it did NOT produce
   * production's refusal, the fixture would not be the situation production
   * was in, and every green above would be about something else.
   */
  const oldCutoff = new Date(RUN.getTime() - FLOOR_DAYS * 86_400_000).toISOString();
  const verdict = reconcileDays("eng_jobs", RULE, plan(FIXTURE, oldCutoff), HELD);
  const expected =
    "2026-09-06 does not reconcile: eng_jobs holds 208 row(s) for it and jobs.completed says 289. " +
    "The rollup and its source disagree, so nothing is deleted. Whichever is wrong, deleting the " +
    "source would make the disagreement permanent.";
  rec(
    "the exact-instant cutoff, on the same rows, gives production's own refusal of 208 against 289",
    oldCutoff === EXACT_INSTANT && verdict.ok === false && verdict.because === expected,
    verdict.ok ? "THE OLD LINE PLANNED CLEANLY, SO THIS FIXTURE IS NOT PRODUCTION'S SITUATION" : verdict.because,
  );
}

/* ----------------------------------------------------------------- report */

for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length > 0) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exit(1);
}
console.log(`PASS: ${out.length} checks. Retention plans whole days only, and a real shortfall still refuses.`);
