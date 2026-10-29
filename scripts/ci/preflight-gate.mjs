/**
 * THE BOARD'S FIRST STEP: THE PREFLIGHT'S ANSWER, IN THE BOARD'S OWN VOCABULARY.
 *
 *   node scripts/ci/preflight-gate.mjs <preflight summary.json> <out verdict-preflight.json>
 *
 * Decided overnight 2026-10-28, Robert to confirm: the cloud board runs
 * scripts/preflight.mjs before any shard, so a static rule that is red stops the
 * board in minutes instead of after an hour, and no writer touches development.
 * Board 40798160014 is the case it is for: it reported 64 audits NO VERDICT
 * because the runner refused at setup, which read like 64 failures.
 *
 * What reaches the public log is one line per rule, its verdict and its name,
 * and the tally. The rule names are the preflight's fixed strings and the audit
 * names in shards.mjs. Nothing an audit printed is passed through; the full
 * preflight output is in the sealed board-log-preflight artifact.
 *
 * Exit 1, and the board stops, when any rule is FAIL, when no rule ran, or when
 * there is no summary to read. COULD NOT TELL does not stop it: on main the
 * added-line range is empty, which the preflight reports as COULD NOT TELL, and
 * a merge commit has nothing new to read. It is printed so it is never silent.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [summaryPath, outPath] = process.argv.slice(2);
let summary = null;
try {
  summary = JSON.parse(readFileSync(summaryPath, "utf8"));
} catch {
  summary = null;
}

const results = Array.isArray(summary?.results) ? summary.results : [];
const verdicts = {};
for (const r of results) verdicts[String(r.rule)] = String(r.verdict);
const failed = results.filter((r) => r.verdict === "FAIL").map((r) => String(r.rule));
const untold = results.filter((r) => r.verdict === "COULD NOT TELL").map((r) => String(r.rule));
const ran = results.length > 0;
const passed = summary !== null && ran && failed.length === 0;

for (const r of results) console.log(`${String(r.verdict).padEnd(14)} ${r.rule}`);
if (summary === null) console.log("THE PREFLIGHT LEFT NO SUMMARY: it did not run to completion. Its log is sealed.");
else if (!ran) console.log("THE PREFLIGHT RAN NO RULE.");
console.log(`preflight: ${results.length} rules, ${failed.length} failed, ${untold.length} could not tell`);
console.log(passed ? "PREFLIGHT GREEN: the shards run." : `PREFLIGHT RED: no shard runs. ${failed.length ? `Failed: ${failed.join(", ")}.` : ""}`);

writeFileSync(
  outPath,
  JSON.stringify({ shard: "preflight", completed: summary !== null, passed, failed, untold, verdicts, rules: results.length }, null, 2),
);
process.exitCode = passed ? 0 : 1;
