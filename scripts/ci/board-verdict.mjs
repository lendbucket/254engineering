/**
 * THE CLOUD BOARD'S ONE ANSWER, FROM EVERY SHARD'S VERDICT FILE.
 *
 *   node scripts/ci/board-verdict.mjs <dir of verdict-*.json> <summary.md>
 *
 * The board passes only when every shard reported, every shard ran to
 * completion, every declared audit has exactly one verdict, and every audit
 * that gates passed. A shard with no verdict file is a FAIL of the board, not a
 * shorter board: the arithmetic is against the declaration in shards.mjs, which
 * shard jobs have already checked against the runner itself.
 *
 * An audit in INFORMATIONAL (shards.mjs) is shown and does not gate. The set
 * held perf-audit until its calibration on these runners, and is empty since
 * the operator's ruling of 2026-10-22 that perf gates with its current ceilings.
 */
import { existsSync, readdirSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { INFORMATIONAL, SHARDS } from "./shards.mjs";

const [dir, summaryPath] = process.argv.slice(2);
const files = existsSync(dir) ? readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith(".json")) : [];
const byShard = new Map();
for (const f of files) {
  try {
    const v = JSON.parse(readFileSync(join(dir, String(f)), "utf8"));
    byShard.set(v.shard, v);
  } catch {
    /* an unreadable verdict file is a missing shard below */
  }
}

/*
 * THE PREFLIGHT, FIRST (decided overnight 2026-10-28, Robert to confirm). The
 * shards need it, so when it is red no shard ran, and the board must say that
 * in its first line, naming the rules, rather than list every audit as NO
 * VERDICT: board 40798160014 read exactly like that and meant one setup refusal.
 */
const preflight = byShard.get("preflight") ?? null;
const preflightStop = preflight === null ? "the preflight reported nothing" : preflight.passed !== true ? "the preflight was red" : null;

const problems = [];
if (preflightStop) {
  problems.push(
    preflight?.failed?.length
      ? `PREFLIGHT STOPPED THE BOARD: ${preflight.failed.join(", ")}. No shard ran and nothing touched development.`
      : `PREFLIGHT STOPPED THE BOARD: ${preflightStop}${preflight && preflight.completed === false ? ", and it did not run to completion" : ""}. No shard ran and nothing touched development.`,
  );
}
const rows = [];
let pass = 0;
let fail = 0;
let cnt = 0;
let declared = 0;
for (const [shard, { audits }] of Object.entries(SHARDS)) {
  declared += audits.length;
  const v = byShard.get(shard);
  if (!v) problems.push(`shard ${shard} reported nothing`);
  else if (!v.completed) problems.push(`shard ${shard} did not run to completion`);
  for (const name of audits) {
    const verdict = v?.verdicts?.[name] ?? "NO VERDICT";
    rows.push([shard, name, verdict]);
    if (verdict === "PASS") pass++;
    else if (verdict === "COULD NOT TELL") cnt++;
    else fail++;
    if (verdict !== "PASS" && !INFORMATIONAL.has(name)) problems.push(`${name}: ${verdict}`);
  }
  if (v?.facts?.arithmetic) problems.push(`shard ${shard}: its arithmetic does not close`);
}

const ok = problems.length === 0;
const lines = [
  `## Cloud board: ${ok ? "PASS" : preflightStop ? "STOPPED BY THE PREFLIGHT" : "NOT GREEN"}`,
  "",
  preflight
    ? `Preflight: ${preflight.passed ? "GREEN" : "RED"}, ${preflight.rules ?? 0} rules, ${preflight.failed?.length ?? 0} failed, ${preflight.untold?.length ?? 0} could not tell.`
    : "Preflight: no verdict.",
  "",
  `${pass} pass + ${fail} fail or no verdict + ${cnt} could not tell = ${pass + fail + cnt}, against ${declared} declared audits.`,
  INFORMATIONAL.size > 0
    ? `Informational, not gating: ${[...INFORMATIONAL].join(", ")}.`
    : "Every audit gates, perf-audit included (operator ruling, 2026-10-22).",
  "",
  "| shard | audit | verdict |",
  "| --- | --- | --- |",
  ...rows.map(([s, n, v]) => `| ${s} | ${n} | ${v}${INFORMATIONAL.has(n) ? " (informational)" : ""} |`),
  "",
  ...[...byShard.values()].filter((v) => v.shard !== "preflight").map((v) => `${v.shard}: ${v.facts?.retries ?? "Transient retries: unknown"}${v.facts?.manyRetries ? ", MORE THAN FIVE" : ""}`),
  "",
  ok ? "Every gating audit passed." : `Holding the board:\n\n${problems.map((p) => `- ${p}`).join("\n")}`,
  "",
  "The full output of every shard is in its sealed board-log artifact, readable only with the operator's key.",
];
console.log(lines.join("\n"));
if (summaryPath) appendFileSync(summaryPath, lines.join("\n") + "\n");
process.exitCode = ok ? 0 : 1;
