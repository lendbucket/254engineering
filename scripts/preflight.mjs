/**
 * PREFLIGHT: EVERY STATIC, REPO-WIDE RULE THE BOARD APPLIES, IN ONE COMMAND,
 * WITH NO SERVER AND NO ENVIRONMENT FILE.
 *
 *   node scripts/preflight.mjs [--base <ref>]
 *
 * Robert, 21:07 Central 2026-10-28: "so a board never misses on a static rule
 * again." On 2026-10-27 and 2026-10-28 four boards missed on rules that need
 * nothing but the files:
 *
 *   board 40579097390  retention-audit, the declaration out of alphabetical order
 *   board 40755884083  soc2-audit, two environment names nobody declared
 *   board 40779701058  db-guard-audit, a src file writing a timestamp from the process clock
 *   board 40798160014  the runner itself, an audit needing react-server and not declaring it
 *
 * Each was findable in seconds here, and each cost a board of about an hour.
 *
 * WHAT IT RUNS, AND WHY THE LIST IS DERIVED
 * ------------------------------------------
 * 1. The runner's own invocation rule (invocationProblems, the function
 *    scripts/audit.mjs refuses the board on).
 * 2. Every audit in the board's static shard (scripts/ci/shards.mjs), each run
 *    the way the board runs it, except the ones in NOT_HERE, which are named,
 *    each with its reason, and asserted to still be in the shard.
 * 3. soc2-audit from the pages shard, which reads every environment name in
 *    the repository and needs no server for that.
 * 4. retention-audit's declaration half (scripts/lib/retention-declaration.mjs,
 *    the same function the audit calls). The rest of that audit plans against
 *    development and is the board's.
 * 5. The voice rules on every line added since the merge base with origin/main,
 *    working tree and untracked files included: banned phrases and
 *    present-tense regulatory claims in src and docs, long dashes anywhere.
 *
 * WHAT IT DOES NOT LOOSEN
 * -----------------------
 * Two of those audits carry checks that read the environment file, and with no
 * file they fail. ENV_ONLY names each such check exactly. A FAIL line is
 * excused only when its name starts with one of those, only when no
 * .env.local exists, and only when the audit's own "FAIL: n of m checks"
 * equals the number of lines excused. Every name in ENV_ONLY is asserted to
 * appear in its audit's source, so a renamed check cannot quietly widen the
 * exemption, and the count excused is printed. CLAUDE.md, section 6: an
 * exemption nobody counts becomes the rule.
 *
 * COULD NOT TELL is not a failure here, as on the board. Exit 0 is green, 1 is
 * a failure named on its own line, 2 is that something could not be measured
 * at all (no rules ran, or the added-line range was empty).
 */
import { spawnSync, execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SHARDS } from "./ci/shards.mjs";
import { runtimeFor, invocationProblems } from "./lib/audit-runtime.mjs";
import { findBannedPhrases, findRegulatoryClaims } from "./lib/voice-blocklist.mjs";

/* Static-shard audits that cannot run here, each with the reason. Asserted to be in the shard. */
const NOT_HERE = {
  "registry-audit": "fetches the three sites' sitemaps through a running server (port 4300)",
  "citation-audit": "fetches every cited source over the network; about 50 seconds and mostly COULD NOT TELL off the board",
};

/* Checks that fail only for want of .env.local, by their exact names. */
const ENV_ONLY = {
  "db-guard-audit": ["and it is the development project by ref, not merely something that is not production"],
  "soc2-audit": [
    "the index command `npx tsx scripts/soc2-evidence.mjs` runs",
    "there is an environment file to check",
    "the local service role key belongs to the development project",
    "the reverse scan found names in the environment files to check",
  ],
};

/* Figure, en, em and horizontal bar, built from code points so this file carries none of them. */
const LONG_DASH = new RegExp(`[${String.fromCharCode(0x2012, 0x2013, 0x2014, 0x2015)}]`);
const results = [];
const say = (rule, verdict, detail = "") => {
  results.push({ rule, verdict });
  console.log(`${verdict.padEnd(14)} ${rule}${detail ? `  ${detail}` : ""}`);
};

/* ------------------------------------------------------------- the retention child */

if (process.argv.includes("--retention-declaration")) {
  const { declarationChecks } = await import("./lib/retention-declaration.mjs");
  const failed = declarationChecks().filter((c) => !c.ok);
  for (const c of failed) console.log(`  FAIL: ${c.name} (${c.note})`);
  process.exit(failed.length ? 1 : 0);
}

const started = Date.now();
const hasEnv = existsSync(".env.local");
const tsx = "node_modules/tsx/dist/cli.mjs";

/* ------------------------------------------------------------- 1. invocations */

{
  const wrong = invocationProblems();
  if (wrong.length) say("runtime declarations (the board's setup rule)", "FAIL", wrong.map((w) => w.trim()).join(" | "));
  else say("runtime declarations (the board's setup rule)", "PASS");
}

/* ------------------------------------------------------------- the exemption, asserted */

{
  const stale = [];
  for (const [audit, names] of Object.entries(ENV_ONLY)) {
    const src = readFileSync(join("scripts", `${audit}.mjs`), "utf8");
    for (const n of names) {
      const probe = n.startsWith("the index command") ? "the index command \\`" : n;
      if (!src.includes(probe)) stale.push(`${audit}: "${n}"`);
    }
  }
  for (const name of Object.keys(NOT_HERE)) if (!SHARDS.static.audits.includes(name)) stale.push(`NOT_HERE names ${name}, which is not in the static shard`);
  if (stale.length) say("preflight's own exemptions name real checks", "FAIL", stale.join(" | "));
  else say("preflight's own exemptions name real checks", "PASS", `${Object.values(ENV_ONLY).flat().length} env-only names, ${Object.keys(NOT_HERE).length} audits not run here`);
}

/* ------------------------------------------------------------- 2 and 3. the audits */

function runAudit(name) {
  const file = join("scripts", `${name}.mjs`);
  const args = runtimeFor(file).needsReactServer ? [tsx, "--conditions=react-server", file] : [tsx, file];
  const r = spawnSync(process.execPath, args, { encoding: "utf8", maxBuffer: 64 << 20, timeout: 300000 });
  const lines = `${r.stdout || ""}\n${r.stderr || ""}`.split("\n");
  if (r.status === 0) return say(name, "PASS");
  const named = lines.map((l) => /^\s*FAIL: (.*)$/.exec(l)?.[1]).filter((x) => x && !/^\d+ of \d+ checks\.?$/.test(x));
  const summary = lines.map((l) => /^\s*FAIL: (\d+) of (\d+) checks/.exec(l)).find(Boolean);
  const excusable = hasEnv ? [] : ENV_ONLY[name] ?? [];
  const excused = named.filter((l) => excusable.some((n) => l.startsWith(n)));
  const real = named.filter((l) => !excused.includes(l));
  if (summary && real.length === 0 && excused.length > 0 && Number(summary[1]) === excused.length) {
    return say(name, "PASS", `(${excused.length} env-only line${excused.length === 1 ? "" : "s"} excused, no .env.local here)`);
  }
  if (real.length) return say(name, "FAIL", real.map((l) => l.slice(0, 200)).join(" | "));
  const tail = lines.filter(Boolean).slice(-3).join(" / ").slice(0, 300);
  return say(name, "FAIL", `exit ${r.status} with no FAIL line: ${tail}`);
}

for (const name of SHARDS.static.audits) {
  if (NOT_HERE[name]) {
    console.log(`${"NOT RUN HERE".padEnd(14)} ${name}  ${NOT_HERE[name]}`);
    continue;
  }
  runAudit(name);
}
runAudit("soc2-audit");

/* ------------------------------------------------------------- 4. retention declaration */

{
  const r = spawnSync(process.execPath, [tsx, "--conditions=react-server", "scripts/preflight.mjs", "--retention-declaration"], { encoding: "utf8" });
  const fails = (r.stdout || "").split("\n").filter((l) => /FAIL:/.test(l)).map((l) => l.trim().replace(/^FAIL: /, ""));
  if (r.status === 0) say("retention-audit, the declaration against the schema", "PASS");
  else say("retention-audit, the declaration against the schema", "FAIL", fails.join(" | ") || (r.stderr || "").slice(-300));
}

/* ------------------------------------------------------------- 5. voice on added lines */

{
  const argBase = process.argv.indexOf("--base");
  const base = argBase > 0 ? process.argv[argBase + 1] : execFileSync("git", ["merge-base", "origin/main", "HEAD"], { encoding: "utf8" }).trim();
  const diff = execFileSync("git", ["diff", "--unified=0", base], { encoding: "utf8", maxBuffer: 1 << 28 });
  const added = []; // { path, text }
  let path = null;
  for (const l of diff.split("\n")) {
    if (l.startsWith("+++ ")) path = l.slice(4).replace(/^b\//, "");
    else if (l.startsWith("+") && path && path !== "/dev/null") added.push({ path, text: l.slice(1) });
  }
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { encoding: "utf8" }).split("\n").filter(Boolean);
  for (const f of untracked) {
    if (!/\.(ts|tsx|mjs|js|md|sql|json|css)$/.test(f)) continue;
    for (const text of readFileSync(f, "utf8").split("\n")) added.push({ path: f, text });
  }
  if (added.length === 0) {
    say(`voice on added lines since ${base.slice(0, 8)}`, "COULD NOT TELL", "no added lines in the range; pass --base <ref> to name one");
  } else {
    const prose = added.filter((a) => /^(src|docs)\//.test(a.path)).map((a) => a.text).join("\n");
    const banned = findBannedPhrases(prose);
    const claims = findRegulatoryClaims(prose);
    const dashes = added.filter((a) => LONG_DASH.test(a.text));
    const problems = [
      ...banned.map((b) => `banned phrase: ${JSON.stringify(b).slice(0, 80)}`),
      ...claims.map((c) => `present tense claim: ${JSON.stringify(c).slice(0, 80)}`),
      ...dashes.slice(0, 5).map((d) => `long dash in ${d.path}: ${d.text.trim().slice(0, 80)}`),
    ];
    const detail = `${added.length} added lines (${untracked.length} untracked files read), base ${base.slice(0, 8)}`;
    if (problems.length) say("voice on added lines", "FAIL", `${problems.join(" | ")}  [${detail}]`);
    else say("voice on added lines", "PASS", detail);
  }
}

/* ------------------------------------------------------------- the verdict */

const failed = results.filter((r) => r.verdict === "FAIL");
const untold = results.filter((r) => r.verdict === "COULD NOT TELL");
console.log("");
console.log(`preflight: ${results.length} rules, ${failed.length} failed, ${untold.length} could not tell, ${((Date.now() - started) / 1000).toFixed(0)} s`);
if (results.length === 0) process.exit(2);
if (failed.length) {
  console.log(`RED: ${failed.map((f) => f.rule).join(", ")}. No bundle boards on a red preflight.`);
  process.exit(1);
}
if (untold.length) process.exit(2);
console.log("GREEN.");
