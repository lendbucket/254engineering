/**
 * THE CLOUD BOARD RUNS THE PREFLIGHT FIRST, AND A RED ONE STOPS IT, SAID PLAINLY.
 *
 *   node scripts/proofs/the-board-stops-on-a-red-preflight.mjs
 *
 * Decided overnight 2026-10-28, Robert to confirm. Board 40798160014 reported
 * every audit NO VERDICT because the runner refused at setup; the rule it broke
 * is one scripts/preflight.mjs runs in under a minute. So the board runs the
 * preflight beside the build, the shards need both, and board-verdict.mjs puts
 * a preflight stop in its first line, naming the rules.
 *
 * Asked of the workflow file, of the gate with fixture summaries, and of
 * board-verdict.mjs with fixture verdict directories, each in a child process.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${String(note).slice(0, 200)})` : ""}`);
};

/* ---------------------------------------------------------------- the workflow */

const yml = readFileSync(".github/workflows/board.yml", "utf8");
const jobAt = (name) => yml.indexOf(`\n  ${name}:\n`);
const jobBody = (name) => {
  const at = jobAt(name);
  if (at < 0) return "";
  const rest = yml.slice(at + 1);
  const next = rest.slice(1).search(/\n {2}[a-z][a-z-]*:\n/);
  return next < 0 ? rest : rest.slice(0, next + 1);
};
const pre = jobBody("preflight");
check("the board has a preflight job", pre.length > 0);
check("it runs scripts/preflight.mjs with a summary for the gate", /node scripts\/preflight\.mjs --summary "\$RUNNER_TEMP\/preflight\.json"/.test(pre));
check("and its verdicts come from the gate, the only lines that reach the public log", /node scripts\/ci\/preflight-gate\.mjs "\$RUNNER_TEMP\/preflight\.json" "\$RUNNER_TEMP\/verdict-preflight\.json"/.test(pre));
check("the preflight's own output goes to a file that is sealed", /> "\$RUNNER_TEMP\/board\/preflight\.log" 2>&1/.test(pre) && /seal\.mjs seal "\$RUNNER_TEMP\/board-log\.tgz" "\$RUNNER_TEMP\/board-log-preflight\.sealed"/.test(pre));
/* Code, not prose: the job's comments say why it has no .env.local, so they name it. */
const preCode = pre.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
check("the preflight job reads no secret and writes no .env.local", !/secrets\./.test(preCode) && !/write-env\.mjs/.test(preCode) && !/\.env\.local/.test(preCode) && /\.env\.local/.test(pre));
check("it has the whole history and a local main, as the static shard does", /fetch-depth: 0/.test(pre) && /git branch main origin\/main/.test(pre));
check("no shard starts until the build and the preflight have both passed", /\n {2}shard:\n[\s\S]*?\n {4}needs: \[build, preflight\]\n/.test(yml));
check("and the board's answer waits for the preflight too", /\n {2}board:\n[\s\S]*?\n {4}needs: \[prior, build, preflight, shard\]\n/.test(yml));
/* The skip of 2026-10-29 must not let a red preflight through: the preflight has no needs, so it runs on every push. */
check("the preflight runs on every push, skip or not", !/\n {4}needs:/.test(jobBody("preflight")) && !/\n {4}if:/.test(jobBody("preflight")));

/* ---------------------------------------------------------------- the gate */

const dir = join(tmpdir(), `preflight-proof-${process.pid}`);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const gate = (name, summary) => {
  const s = join(dir, `${name}.json`);
  const out = join(dir, `verdict-${name}.json`);
  if (summary !== null) writeFileSync(s, JSON.stringify(summary));
  const r = spawnSync(process.execPath, ["scripts/ci/preflight-gate.mjs", s, out], { encoding: "utf8" });
  let v = null;
  try {
    v = JSON.parse(readFileSync(out, "utf8"));
  } catch {}
  return { status: r.status, out: r.stdout, v };
};
const green = gate("green", { results: [{ rule: "db-guard-audit", verdict: "PASS" }, { rule: "voice on added lines", verdict: "PASS" }], exit: 0 });
check("a green preflight lets the shards run", green.status === 0 && green.v?.passed === true, green.out.trim().split("\n").pop());
const red = gate("red", { results: [{ rule: "runtime declarations (the board's setup rule)", verdict: "FAIL" }, { rule: "db-guard-audit", verdict: "PASS" }], exit: 1 });
check("a red preflight stops them, naming the rule", red.status === 1 && red.v?.passed === false && red.v.failed[0] === "runtime declarations (the board's setup rule)", red.out.trim().split("\n").pop());
const untold = gate("untold", { results: [{ rule: "db-guard-audit", verdict: "PASS" }, { rule: "voice on added lines since 8a5bbb7e", verdict: "COULD NOT TELL" }], exit: 2 });
check("an empty added-line range (main itself) is said and does not stop the board", untold.status === 0 && untold.v?.untold.length === 1 && /COULD NOT TELL/.test(untold.out));
const none = gate("none", { results: [], exit: 2 });
check("a preflight that ran no rule stops the board", none.status === 1 && none.v?.passed === false);
const missing = gate("missing", null);
check("and so does one that left no summary at all", missing.status === 1 && missing.v?.completed === false);
check("the gate prints rule names and verdicts only", red.out.split("\n").filter(Boolean).every((l) => /^(PASS|FAIL|COULD NOT TELL|NOT RUN HERE)\s+\S|^preflight: \d+ rules|^PREFLIGHT (GREEN|RED)|^THE PREFLIGHT/.test(l)), red.out.trim());

/* ---------------------------------------------------------------- the board's answer */

const board = (name, files) => {
  const d = join(dir, `board-${name}`);
  mkdirSync(d, { recursive: true });
  for (const [f, v] of Object.entries(files)) writeFileSync(join(d, f), JSON.stringify(v));
  const r = spawnSync(process.execPath, ["scripts/ci/board-verdict.mjs", d], { encoding: "utf8" });
  return { status: r.status, out: r.stdout };
};
const stopped = board("stopped", { "verdict-preflight.json": red.v });
check(
  "a red preflight is the board's first line, with the rule named",
  stopped.status === 1 && /^## Cloud board: STOPPED BY THE PREFLIGHT/.test(stopped.out) && /PREFLIGHT STOPPED THE BOARD: runtime declarations \(the board's setup rule\)\. No shard ran and nothing touched development\./.test(stopped.out),
  stopped.out.split("\n")[0],
);
const absent = board("absent", {});
check("a board with no preflight verdict says so, and is not green", absent.status === 1 && /PREFLIGHT STOPPED THE BOARD: the preflight reported nothing/.test(absent.out));
const shardsOnly = board("shards-only", { "verdict-preflight.json": green.v });
check("a green preflight alone is not a green board: the shards still have to report", shardsOnly.status === 1 && /^## Cloud board: NOT GREEN/.test(shardsOnly.out) && /Preflight: GREEN/.test(shardsOnly.out));

rmSync(dir, { recursive: true, force: true });
console.log("");
if (wrong === 0) {
  console.log("PASS: the board runs the preflight first, a red one stops every shard, and the board says so in its first line.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
