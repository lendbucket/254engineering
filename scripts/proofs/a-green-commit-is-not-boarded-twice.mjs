/**
 * A PUSH TO MAIN WHOSE EXACT COMMIT ALREADY PASSED A FULL BOARD IS NOT BOARDED
 * TWICE, AND NOTHING ELSE IS SKIPPED.
 *
 *   node scripts/proofs/a-green-commit-is-not-boarded-twice.mjs
 *
 * Ruled 2026-10-22 (BACKLOG, "A PUSH TO MAIN RE-BOARDS A COMMIT THAT ALREADY HAS
 * A GREEN BOARD"): same commit only, and the skip names the earlier run. The
 * decision is the pure decideSkip in scripts/ci/prior-green.mjs, asked here of
 * every case that must board and the one that may skip; then board.yml is read
 * for the wiring, and board-verdict is fed a skip to read its first line.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { decideSkip, REQUIRED_JOBS } from "../ci/prior-green.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${String(note).slice(0, 200)})` : ""}`);
};

const SHA = "a".repeat(40);
const OTHER = "b".repeat(40);
const full = (conclusion = "success") => REQUIRED_JOBS.map((name) => ({ name, conclusion }));
const run = (id, over = {}) => ({ id, headSha: SHA, status: "completed", conclusion: "success", jobs: full(), ...over });
const ask = (over) => decideSkip({ event: "push", ref: "refs/heads/main", sha: SHA, currentRunId: 999, runs: [], error: null, ...over });

check("the jobs a full board has are build, preflight, every shard and board", REQUIRED_JOBS.includes("build") && REQUIRED_JOBS.includes("preflight") && REQUIRED_JOBS.includes("board") && REQUIRED_JOBS.filter((j) => j.startsWith("shard ")).length >= 5, REQUIRED_JOBS.join(", "));

const passed = ask({ runs: [run(101)] });
check("the same commit passed in full on main: skip, naming that run", passed.skip === true && passed.run === 101 && /run 101/.test(passed.reason), passed.reason);
check("the newest passing run is the one named", ask({ runs: [run(101), run(205), run(150)] }).run === 205);
check("the same commit failed: board", ask({ runs: [run(101, { conclusion: "failure" })] }).skip === false);
check(
  "the same commit with a shard that failed inside a successful run: board",
  ask({ runs: [run(101, { jobs: full().map((j) => (j.name === "shard writers" ? { ...j, conclusion: "failure" } : j)) })] }).skip === false,
);
check(
  "an earlier run that was itself a skip (its build and shards skipped): board",
  ask({ runs: [run(101, { jobs: full().map((j) => (j.name === "board" || j.name === "preflight" ? j : { ...j, conclusion: "skipped" })) })] }).skip === false,
);
check("an earlier run missing a declared shard: board", ask({ runs: [run(101, { jobs: full().filter((j) => j.name !== "shard documents") })] }).skip === false);
check("the API could not be read: board", ask({ runs: [run(101)], error: "GitHub answered 403" }).skip === false);
check("the runs list is not a list: board", ask({ runs: null }).skip === false);
check("a different commit, even one whose tree may match: board", ask({ runs: [run(101, { headSha: OTHER })] }).skip === false);
check("a run not yet completed: board", ask({ runs: [run(101, { status: "in_progress" })] }).skip === false);
check("this run itself is never the evidence: board", ask({ runs: [run(999)] }).skip === false);
check("a push to another branch: board", ask({ ref: "refs/heads/feat/x", runs: [run(101)] }).skip === false);
check("a dispatched run on main: board", ask({ event: "workflow_dispatch", runs: [run(101)] }).skip === false);
check("an unknown commit: board", ask({ sha: "", runs: [run(101, { headSha: "" })] }).skip === false);

/* ---------------------------------------------------------------- the wiring */

const yml = readFileSync(".github/workflows/board.yml", "utf8");
const jobBody = (name) => {
  const at = yml.indexOf(`\n  ${name}:\n`);
  if (at < 0) return "";
  const rest = yml.slice(at + 1);
  const next = rest.slice(1).search(/\n {2}[a-z][a-z-]*:\n/);
  return next < 0 ? rest : rest.slice(0, next + 1);
};
const prior = jobBody("prior");
check("a prior job decides, reading no secret", prior.length > 0 && /node scripts\/ci\/prior-green\.mjs "\$RUNNER_TEMP\/verdict-prior\.json"/.test(prior) && !/secrets\./.test(prior) && /github\.token/.test(prior));
check("and hands the board its verdict", /name: verdict-prior/.test(prior));
const build = jobBody("build");
check(
  "the build waits on it and runs unless it positively said skip, so a failed prior still boards",
  /\n {4}needs: \[prior\]\n/.test(build) && /\n {4}if: \$\{\{ !cancelled\(\) && needs\.prior\.outputs\.skip != 'true' \}\}\n/.test(build),
);
check("the shards still need the build and the preflight", /\n {2}shard:\n[\s\S]*?\n {4}needs: \[build, preflight\]\n/.test(yml));
check("the board's answer reads the prior verdict too", /\n {2}board:\n[\s\S]*?\n {4}needs: \[prior, build, preflight, shard\]\n/.test(yml));

/* ---------------------------------------------------------------- the summary */

const dir = join(tmpdir(), `skip-proof-${process.pid}`);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const verdict = (files) => {
  const d = join(dir, String(Object.keys(files).join("-") || "none"));
  mkdirSync(d, { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(d, `${name}.json`), JSON.stringify(body));
  return spawnSync(process.execPath, ["scripts/ci/board-verdict.mjs", d], { encoding: "utf8" });
};
const skipped = verdict({ prior: { shard: "prior", skip: true, run: 101 }, preflight: { shard: "preflight", completed: true, passed: true, rules: 35, failed: [], untold: [] } });
check(
  "a skip reads SKIPPED in its first line and names the run, never PASS",
  skipped.status === 0 && /^## Cloud board: SKIPPED\n/.test(skipped.stdout) && /skipped: the same commit passed on run 101/.test(skipped.stdout) && !/Cloud board: PASS/.test(skipped.stdout),
  skipped.stdout.split("\n")[0],
);
const skippedRed = verdict({ prior: { shard: "prior", skip: true, run: 101 }, preflight: { shard: "preflight", completed: true, passed: false, rules: 35, failed: ["token-audit"], untold: [] } });
check("a skip with a red preflight is still held", skippedRed.status === 1 && /PREFLIGHT WAS RED/.test(skippedRed.stdout) && /token-audit/.test(skippedRed.stdout));
const boarded = verdict({ prior: { shard: "prior", skip: false, run: null } });
check("a prior that said board is not a skip: the shards are counted as usual", boarded.status === 1 && !/SKIPPED/.test(boarded.stdout) && /reported nothing/.test(boarded.stdout));
rmSync(dir, { recursive: true, force: true });

console.log("");
if (wrong === 0) {
  console.log("PASS: a push to main whose exact commit already passed a full board is not boarded twice, the skip names that run, and every other push boards.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
