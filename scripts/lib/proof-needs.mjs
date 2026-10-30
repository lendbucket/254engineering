import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

/**
 * WHAT A PROOF NEEDS TO RUN, READ FROM THE PROOF RATHER THAN REMEMBERED.
 *
 * Board 40918058948 (2026-10-29) missed on `every-date-names-its-zone.mjs`, a
 * sweep of `src` that needs no server, no database and no environment file.
 * The preflight did not run it, so a new client file formatting a time with no
 * zone reached a seventy minute board. A list of "the static proofs" typed into
 * the preflight would go stale the first time a proof was added, which is the
 * same silence that let this one through, so the set is derived here.
 *
 * A proof is STATIC when its own source, and the scripts/ modules it imports,
 * show none of these:
 *
 *   database  it reaches scripts/lib/db-target.mjs, Supabase, a probe account,
 *             or loads the environment file the database client reads
 *   server    it fetches localhost or BASE_URL, or drives a browser
 *   env       it reads a process.env name it does not set itself, other than
 *             the handful any node process has
 *   build     it reads `.next`
 *
 * Modules under `src` are deliberately NOT followed. Almost every proof imports
 * product code, and product code names the database client; whether a proof
 * reaches it is decided by what the proof calls, which the proof's own text and
 * its helper modules show. The cost of that choice is a false "static", and the
 * guard against it is the preflight itself: a proof wrongly classified static
 * fails on main, and the preflight names it on its first run.
 */

const DIR = "scripts/proofs";

/* Environment names any process has, or that a proof may read without an env file. */
const AMBIENT = new Set(["NODE_ENV", "CI", "TZ", "PATH", "HOME", "USERPROFILE", "TEMP", "TMP", "TMPDIR", "GITHUB_ACTIONS", "NODE_OPTIONS"]);

const DATABASE = [
  /db-target(\.mjs)?["']/,
  /@supabase\//,
  /\bsupabaseAdmin\s*\(/,
  /\bmakeProbe|\bdestroyProbes|\bprobe-accounts/,
  /\bloadEnv\s*\(|["']\.env\.local["']/,
  /\bSUPABASE_(URL|SERVICE)/,
];
const SERVER = [/localhost:\d+|127\.0\.0\.1/, /\bBASE_URL\b/, /\bplaywright\b|\bchromium\b/];
const BUILD = [/["'`][^"'`]*\.next[\\/]/];

function helpersOf(file, src) {
  const out = [];
  for (const m of src.matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+\.m?js)["']/g)) {
    const p = resolve(dirname(file), m[1]);
    if (p.includes(`${join("scripts", "")}`) && existsSync(p)) out.push(p);
  }
  return out;
}

/*
 * The names an environment file can supply are exactly the names the platform
 * declares, because soc2-audit fails on any name set in an environment that is
 * not declared in src/config/credential-inventory.ts. So a proof NEEDS the env
 * file only when it reads one of those. A name a proof sets for its own child
 * process (`{ ...process.env, EVERY_DATE_CHILD: "1" }`) is not one, and reading
 * it back is the child reading its parent.
 */
let DECLARED;
function declaredNames() {
  DECLARED ??= new Set([...readFileSync("src/config/credential-inventory.ts", "utf8").matchAll(/name: "([A-Z][A-Z0-9_]+)"/g)].map((m) => m[1]));
  return DECLARED;
}

function envReads(src) {
  const set = new Set();
  const read = /process\.env\.([A-Z][A-Z0-9_]*)\b(?!\s*=[^=])/g;
  const written = new Set([
    ...[...src.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)\s*=[^=]/g)].map((m) => m[1]),
    ...[...src.matchAll(/\b([A-Z][A-Z0-9_]*)\s*:\s*["'`]/g)].map((m) => m[1]),
  ]);
  for (const m of src.matchAll(read)) {
    const name = m[1];
    if (AMBIENT.has(name) || written.has(name)) continue;
    if (declaredNames().has(name)) set.add(name);
  }
  return [...set];
}

/** What one proof needs, with the line of evidence for each need. */
export function needsOf(file) {
  const seen = new Set();
  const needs = {};
  const visit = (f, depth) => {
    if (seen.has(f) || depth > 2) return;
    seen.add(f);
    const src = readFileSync(f, "utf8");
    const at = (re) => re.test(src);
    if (DATABASE.some(at)) needs.database ??= f;
    if (SERVER.some(at)) needs.server ??= f;
    if (BUILD.some(at)) needs.build ??= f;
    if (depth === 0) {
      const env = envReads(src);
      if (env.length) needs.env ??= env.join(", ");
    }
    for (const h of helpersOf(f, src)) visit(h, depth + 1);
  };
  visit(resolve(file), 0);
  return needs;
}

/*
 * WHETHER A PROOF MAY RUN BESIDE ANOTHER. A proof that writes into the
 * repository, most often by patching a config file through the gate fixture
 * and restoring it, changes what every proof running at the same moment reads.
 * `sign-up-needs-the-gate.mjs` passed alone and failed in parallel on the first
 * run of this sweep, which is the hazard measured rather than imagined. Such a
 * proof runs alone, after the rest.
 */
const WRITES = [/\b(writeFileSync|copyFileSync|renameSync|unlinkSync|rmSync|appendFileSync)\s*\(/, /gate-fixture(\.mjs)?["']/];

export function writesRepo(file) {
  const seen = new Set();
  const visit = (f, depth) => {
    if (seen.has(f) || depth > 2) return false;
    seen.add(f);
    const src = readFileSync(f, "utf8");
    if (WRITES.some((re) => re.test(src))) return true;
    return helpersOf(f, src).some((h) => visit(h, depth + 1));
  };
  return visit(resolve(file), 0);
}

/**
 * Every proof, classified. `static` holds the file names that need nothing;
 * `alone` is the subset of those that write into the repository and so must
 * not run beside another proof.
 */
export function classifyProofs(dir = DIR) {
  const files = readdirSync(dir).filter((f) => /\.(mjs|ts)$/.test(f)).sort();
  const staticSet = [];
  const alone = [];
  const needing = {};
  for (const f of files) {
    const n = needsOf(join(dir, f));
    if (Object.keys(n).length === 0) {
      staticSet.push(f);
      if (writesRepo(join(dir, f))) alone.push(f);
    } else needing[f] = n;
  }
  return { all: files, static: staticSet, alone, needing };
}
