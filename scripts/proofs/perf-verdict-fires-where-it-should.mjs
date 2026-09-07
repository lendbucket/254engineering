/**
 * PASS, FAIL, AND COULD NOT TELL, EXERCISED ON THE NUMBERS THAT PRODUCED IT.
 *
 *   node scripts/proofs/perf-verdict-fires-where-it-should.mjs
 *
 * Pure. No Chrome, no server, no network, so it runs in under a second. That is
 * the whole reason verdictFor was pulled out of perf-audit.mjs into
 * scripts/lib/perf-verdict.mjs: that file launches Chrome the moment it is
 * imported, so nothing defined inside it can be tested at all.
 *
 * perf-audit CALLS checkVerdictLogic before it measures anything, so the rule
 * the gate is about to apply is verified on every run rather than on the day
 * somebody remembers to run this file.
 *
 * WHAT THIS IS GUARDING AGAINST
 * -----------------------------
 * A third verdict is a licence to be quiet. The dangerous failure is not that
 * COULD NOT TELL fires too rarely, it is that it fires too often and becomes
 * the answer a slow page always gets. So most of the cases below are spent on
 * the two CONCLUSIVE directions and on the exact boundary, rather than on the
 * new state itself.
 */

import { verdictFor, stabilityLimit, INSTABILITY_FRACTION } from "../lib/perf-verdict.mjs";

const CEILING = 3400;

/**
 * @param {boolean} loud  Print every case. False when the gate calls it.
 * @returns {{failed: string[], total: number}}
 */
export function checkVerdictLogic(loud = false) {
  const failed = [];
  let total = 0;
  const say = (line) => {
    if (loud) console.log(line);
  };
  const rec = (name, ok, note = "") => {
    total += 1;
    if (!ok) failed.push(name);
    say(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
  };

  say("");
  say("========= PASS, FAIL, AND COULD NOT TELL =========");

  say("\nTHE TOLERANCE IS WHAT IT SAYS IT IS");
  rec(
    `the stated fraction is ${INSTABILITY_FRACTION}`,
    INSTABILITY_FRACTION === 0.1,
    "a change here changes when the gate declines to answer, and should be deliberate",
  );
  rec(
    `which is ${stabilityLimit(CEILING)}ms on the ${CEILING}ms ceiling`,
    stabilityLimit(CEILING) === 340,
  );

  say("\nTHE REAL READINGS THAT PROVOKED THE RULING");
  rec(
    "the tight fast reading passes outright (2934ms, spread 3ms)",
    verdictFor([2933, 2934, 2936], CEILING) === "pass",
    "every sample under the ceiling, so noise cannot change it",
  );
  rec(
    "the noisy reading near the ceiling says it could not tell (3454ms, spread 521ms)",
    verdictFor([3200, 3454, 3721], CEILING) === "unstable",
    "the ceiling sits inside the range and the range is wider than 340ms",
  );

  say("\nUNSTABLE IS NOT A HIDING PLACE, WHICH IS THE POINT");
  rec(
    "a genuinely slow page still fails, however noisy",
    verdictFor([3500, 3900, 4400], CEILING) === "fail",
    "the FASTEST sample is over the ceiling, so no amount of noise explains it",
  );
  rec(
    "an extremely noisy slow page still fails",
    verdictFor([3401, 9000], CEILING) === "fail",
    "spread 5599ms and it still fails, because even the best run missed",
  );
  rec(
    "a genuinely fast page still passes, however noisy",
    verdictFor([1200, 2100, 3300], CEILING) === "pass",
    "the SLOWEST sample is under the ceiling",
  );

  say("\nTHE BOUNDARY IS WHERE IT SAYS IT IS");
  rec(
    "a straddling range just inside the tolerance lets the median decide",
    verdictFor([3300, 3350, 3639], CEILING) === "pass",
    "spread 339ms, under 340ms, and the median passes",
  );
  rec(
    "and one just outside it does not",
    verdictFor([3300, 3350, 3641], CEILING) === "unstable",
    "spread 341ms",
  );
  rec(
    "a narrow straddle that fails on the median still fails",
    verdictFor([3390, 3450, 3500], CEILING) === "fail",
    "spread 110ms is well inside tolerance, so the median is trustworthy and it is over",
  );

  say("\nDEGENERATE CASES");
  rec("a single sample under the ceiling passes", verdictFor([3000], CEILING) === "pass");
  rec(
    "a single sample over the ceiling fails rather than hiding",
    verdictFor([3500], CEILING) === "fail",
    "one sample has no spread and can never be called unstable, which is honest: it is the calibrate on one sample practice perf-audit's header rejects, and it fails loudly instead",
  );
  rec("samples exactly on the ceiling pass", verdictFor([3400, 3400, 3400], CEILING) === "pass");
  rec(
    "one sample a millisecond over fails",
    verdictFor([3401], CEILING) === "fail",
    "the ceiling is inclusive and nothing here rounds it away",
  );

  say("");
  return { failed, total };
}

/* Run directly: print everything and set an exit code. */
const invokedDirectly =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());

if (invokedDirectly) {
  const { failed, total } = checkVerdictLogic(true);
  if (failed.length) {
    console.log(`FAIL: ${failed.length} of ${total} cases.`);
    process.exit(1);
  }
  console.log(`PASS: ${total} cases. The third verdict fires where it should and nowhere else.`);
}
