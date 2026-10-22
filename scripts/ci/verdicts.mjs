/**
 * THE ONLY LINES OF A SHARD THAT REACH THE PUBLIC LOG. Operator ruling,
 * 2026-10-22: the public check shows verdict lines only.
 *
 *   node scripts/ci/verdicts.mjs <shard> <suite.log> <suite exit code> <out.json>
 *
 * It reads the suite's SUMMARY and prints a fixed vocabulary: one line per audit
 * ("PASS  name", "FAIL  name", "COULD NOT TELL  name"), the shard line, the
 * tally, the retry count and whether the run completed. Nothing an audit printed
 * is passed through, because an audit's own lines name probe addresses, ids and
 * rendered text. The setup error's message is NOT printed for the same reason:
 * it can carry the tail of a server log. It is in the sealed log.
 *
 * Exit: 0 when every audit in the shard passed, informational ones aside; 1
 * otherwise. The board job judges the whole; this only colours the shard.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { INFORMATIONAL, SHARDS } from "./shards.mjs";

const [shard, logPath, exitArg, outPath] = process.argv.slice(2);
const log = (() => {
  try {
    return readFileSync(logPath, "utf8");
  } catch {
    return "";
  }
})();
const summaryAt = log.lastIndexOf("SUITE SUMMARY");
const summary = summaryAt === -1 ? "" : log.slice(summaryAt);
const completed = summaryAt !== -1 && !summary.includes("THE SUITE DID NOT RUN TO COMPLETION");

const verdicts = {};
for (const m of summary.matchAll(/^ {2,4}(PASS|FAIL|COULD NOT TELL)\s+([a-z0-9-]+-audit)\s*$/gm)) verdicts[m[2]] = m[1];

const pick = (re) => (summary.match(re) ?? [null])[0];
const facts = {
  shardLine: pick(/^SHARD .*$/m) ?? (log.match(/^SHARD .*$/m) ?? [null])[0],
  tally: pick(/^Tally: .*$/m),
  arithmetic: summary.includes("THE BOARD'S ARITHMETIC DOES NOT CLOSE"),
  retries: pick(/^Transient retries: \d+/m),
  manyRetries: summary.includes("MORE THAN FIVE RETRIES"),
};

const members = SHARDS[shard]?.audits ?? [];
const missing = members.filter((n) => !(n in verdicts));
const gating = members.filter((n) => !INFORMATIONAL.has(n) && verdicts[n] !== "PASS");

console.log(`shard ${shard}: ${completed ? "ran to completion" : "DID NOT RUN TO COMPLETION (the reason is in the sealed log)"}, suite exit ${exitArg}`);
if (facts.shardLine) console.log(facts.shardLine);
for (const n of members) {
  const v = verdicts[n] ?? "NO VERDICT";
  console.log(`  ${v.padEnd(14)}  ${n}${INFORMATIONAL.has(n) ? "  (informational in the cloud)" : ""}`);
}
if (facts.retries) console.log(facts.retries);
if (facts.manyRetries) console.log("MORE THAN FIVE RETRIES in this shard.");
if (facts.tally) console.log(facts.tally);
if (facts.arithmetic) console.log("THE SHARD'S ARITHMETIC DOES NOT CLOSE.");

writeFileSync(outPath, JSON.stringify({ shard, completed, exit: Number(exitArg), verdicts, missing, facts }, null, 2));
process.exitCode = completed && missing.length === 0 && gating.length === 0 && !facts.arithmetic ? 0 : 1;
