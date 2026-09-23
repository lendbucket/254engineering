/**
 * ===========================================================================
 * EVERY PROOF RUNS, AND NOTHING IN scripts/proofs/ IS REACHED BY NOTHING.
 * Operator ruling, 2026-09-23.
 * ===========================================================================
 *
 * WHAT PRODUCED THIS AUDIT. On 2026-09-22 the operator asked whether a newly
 * written proof would run on the board. It would not have. Proofs were neither
 * enumerated nor listed: `grep -n 'proofs' scripts/audit.mjs` returned nothing,
 * and a proof reached a board only because some audit happened to IMPORT a
 * function from it. Six of thirteen were imported by nothing and had never run
 * on any board.
 *
 * ONE OF THE SIX WAS CITED AS ENFORCEMENT IN A COMPLIANCE ARTIFACT.
 * `soc2-controls.mjs` told a SOC 2 reader that the TOTP digits and period were
 * "pinned by scripts/proofs/totp-matches-the-rfc.mjs". CLAUDE.md section 6c
 * names that same proof as one of the two homes of a ruled business constant,
 * the mechanism being that two places must be edited on purpose. One of the two
 * was read by nothing, so the mechanism had one leg.
 *
 * WHAT THIS AUDIT DOES, AND WHY IT IS THE CLASS FIX RATHER THAN SIX IMPORTS.
 * Wiring each proof into some audit closes today's six and leaves the seventh
 * to be written into the same hole. This derives its subject from the DIRECTORY,
 * so a proof runs by existing. That is the same idiom `scripts/lib/surfaces.mjs`
 * uses for routes and `email-audit` uses for templates: a list nobody maintains
 * cannot go stale.
 *
 * TWO KINDS OF PROOF, AND ONLY ONE OF THEM IS RUNNABLE.
 *
 *   .mjs  executed here as a child process. Its exit code is the verdict.
 *   .ts   NOT executed. These assert at COMPILE time: every line is guarded by
 *         a `@ts-expect-error`, so if the thing it forbids ever starts
 *         compiling, TypeScript reports the unused directive and the typecheck
 *         fails. Running them would prove nothing; `tsc` is what proves them.
 *
 * The second kind is verified rather than assumed. On 2026-09-23 a type error
 * was injected into `the-system-actor-is-not-a-person.ts` and `tsc --noEmit`
 * exited 2 naming the file and line, which is what establishes that tsconfig
 * reaches this directory at all.
 *
 * THE INVOCATION IS DERIVED, NOT GUESSED, and that is not a detail. Running the
 * six by hand on 2026-09-23, one reported ERR_MODULE_NOT_FOUND under `node` and
 * passed under `tsx`, because it imports a TypeScript module. Reported as a
 * failure it would have looked exactly like a broken proof. The suite's own
 * setup line says it: every audit runs the way its imports require.
 */

import { readdirSync, existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { readSource } from "./lib/read-source.mjs";
import { runtimeFor } from "./lib/audit-runtime.mjs";

const DIR = "scripts/proofs";

/*
 * TSX IS INVOKED AS A SCRIPT, NEVER AS A COMMAND NAME.
 *
 * The first version ran `npx tsx <proof>` with `shell: true`, which works and
 * carries Node's deprecation warning about unescaped arguments. Removing the
 * shell broke it completely and instructively: every tsx proof came back with
 * `exit null` and no output, because on Windows the executable is `npx.cmd` and
 * a `.cmd` cannot be launched without a shell. SEVEN PROOFS REPORTED AS
 * FAILURES WHEN NOT ONE OF THEM HAD RUN.
 *
 * `node node_modules/tsx/dist/cli.mjs <proof>` is the same program with no
 * shell and no `.cmd`: the path is tsx's own declared `bin` entry. Asserted
 * below rather than assumed, because a tsx upgrade that moves it would
 * otherwise reproduce exactly the failure this paragraph describes.
 */
const TSX_CLI = "node_modules/tsx/dist/cli.mjs";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

/* ------------------------------------------------------------ the subject */

const entries = readdirSync(DIR).filter((f) => /\.(mjs|ts)$/.test(f)).sort();
const runnable = entries.filter((f) => f.endsWith(".mjs"));
const compileOnly = entries.filter((f) => f.endsWith(".ts"));

/*
 * VACUITY GUARD FIRST, and it is not theoretical here. A glob that matched
 * nothing would make every check below pass over an empty list, which is the
 * exact shape this audit was written to end. If the directory is ever moved,
 * this is what says so rather than a green run.
 */
rec(
  "there are proofs to run",
  runnable.length > 0 && compileOnly.length > 0,
  `${runnable.length} runnable, ${compileOnly.length} compile time (if either were zero this audit would be proving nothing)`,
);

/*
 * AND THE THING THAT RUNS THE TYPESCRIPT ONES EXISTS. Without this, a tsx
 * upgrade that moves the CLI entry turns every tsx proof into `exit null` with
 * no output, which is what happened on 2026-09-23 for a different reason. That
 * read as seven failing proofs and was seven proofs that never started.
 */
rec(
  "the tsx entry point this audit invokes is on disk",
  existsSync(TSX_CLI),
  existsSync(TSX_CLI) ? TSX_CLI : `${TSX_CLI} is missing, so every proof importing TypeScript would report a failure it never had`,
);

/* ------------------------------------------------- how each one is invoked */

/**
 * Does this proof import TypeScript?
 *
 * A proof that imports a `.ts` module cannot run under bare `node`: the loader
 * reports ERR_MODULE_NOT_FOUND for the specifier, or for a path alias it cannot
 * resolve. Derived from the source rather than listed, so a proof that starts
 * importing TypeScript tomorrow is invoked correctly without anybody noticing.
 */
function importsTypeScript(path) {
  const src = readSource(path);
  if (/from\s+"[^"]+\.tsx?"/.test(src) || /import\(\s*[`"][^`"]+\.tsx?/.test(src)) return true;
  if (/from\s+"@\//.test(src) || /import\(\s*[`"]@\//.test(src)) return true;
  /* A relative specifier that resolves to a .ts file on disk. */
  const specs = [...src.matchAll(/from\s+"(\.\.?\/[^"]+)"/g)].map((m) => m[1]);
  return specs.some((s) => {
    const base = join(DIR, s);
    return existsSync(`${base}.ts`) || existsSync(`${base}.tsx`);
  });
}

function invocationFor(file) {
  const path = `${DIR}/${file}`;
  const needsTsx = importsTypeScript(path);
  const { needsReactServer } = runtimeFor(path);
  const args = [];
  if (needsTsx) args.push(TSX_CLI);
  if (needsReactServer) args.push("--conditions=react-server");
  args.push(path);
  return { command: "node", args, needsTsx, needsReactServer };
}

/* --------------------------------------------------------------- run them */

const results = [];
for (const file of runnable) {
  const { command, args, needsTsx, needsReactServer } = invocationFor(file);
  /*
   * NO `shell: true`. Node deprecates passing an args array with a shell,
   * because the arguments are concatenated rather than escaped, and a path with
   * a space in it is then two arguments. This repository sits one rename away
   * from a directory with a space in it.
   */
  const r = spawnSync(command, args, { encoding: "utf8", env: process.env });
  const how = `${needsTsx ? "tsx" : "node"}${needsReactServer ? " --conditions=react-server" : ""}`;
  const tail = (r.stdout || "").trim().split("\n").filter(Boolean).slice(-1)[0] || "";
  results.push({ file, status: r.status, how, tail, stdout: r.stdout || "", stderr: (r.stderr || "").trim() });
}

for (const p of results) {
  /*
   * A PROOF THAT COULD NOT BE INVOKED IS NOT A PROOF THAT FAILED, and the two
   * must not print the same way. `unreachable is not failed` applies to a child
   * process as surely as to a server: a loader error says nothing about the
   * property under test, and reporting it as a finding sends somebody to read
   * a proof that is perfectly correct.
   */
  const neverStarted = p.status === null;
  const loaderRefused = p.status !== 0 && /ERR_MODULE_NOT_FOUND|Cannot find package|Cannot find module/.test(p.stderr);
  if (neverStarted || loaderRefused) {
    rec(
      `${p.file} could not be invoked, so it proved nothing`,
      false,
      neverStarted
        ? `ran as ${p.how} and the process never started, so its exit code is null rather than a verdict`
        : `ran as ${p.how} and the loader refused: ${p.stderr.split("\n").find((l) => l.includes("Error")) || "module not found"}`,
    );
    continue;
  }
  rec(`${p.file}`, p.status === 0, p.status === 0 ? `${p.how}: ${p.tail}` : `${p.how}, exit ${p.status}: ${p.tail}`);
}

/* ------------------------------ an acknowledgement is only as good as its park */

/*
 * A PROOF MAY ACKNOWLEDGE A KNOWN DIFFERENCE. IT MAY NOT GRANT ITSELF ONE.
 * Operator ruling, 2026-09-23.
 *
 * A proof that fails for a reason nobody can fix unattended, a schema defect
 * whose repair is a migration, would otherwise have to be left red or deleted.
 * Red holds a merge on work nobody can do; deleted loses the finding. So a
 * proof may print
 *
 *     ACKNOWLEDGED-PARKS: <id>,<id>
 *
 * and still exit zero. What it may NOT do is carry the expiry, because an
 * acknowledgement with its end date written beside it is one somebody edits to
 * make a red go away. The date lives in src/config/parked-work.ts, which
 * compliance-audit already turns red the day after it lapses.
 *
 * THIS CHECK IS WHAT STOPS THE ACKNOWLEDGEMENT BECOMING AN EXEMPTION: an id
 * naming no park, or naming one that has expired, is a failure here whatever
 * the proof's exit code said. Without it a proof could acknowledge anything for
 * ever by printing a line.
 */
const { parkedWork, expiredParks } = await import("../src/config/parked-work.ts");
const { todayInFirmCalendar } = await import("../src/lib/firm-calendar.ts");
const firmToday = todayInFirmCalendar();
const expiredIds = new Set(expiredParks(firmToday).map((p) => p.id));
const knownIds = new Set(parkedWork.map((p) => p.id));

const claimed = [];
for (const p of results) {
  const line = (p.stdout || "").split("\n").find((l) => l.startsWith("ACKNOWLEDGED-PARKS:"));
  if (!line) continue;
  for (const id of line.slice("ACKNOWLEDGED-PARKS:".length).split(",").map((s) => s.trim()).filter(Boolean)) {
    claimed.push({ file: p.file, id });
  }
}

const unknown = claimed.filter((c) => !knownIds.has(c.id));
rec(
  "every acknowledgement a proof claims names a real park",
  unknown.length === 0,
  unknown.length === 0
    ? claimed.length === 0
      ? "no proof is acknowledging anything today"
      : claimed.map((c) => `${c.file} claims ${c.id}`).join("; ")
    : `names no park: ${unknown.map((c) => `${c.file} claims ${c.id}`).join("; ")}`,
);

const lapsed = claimed.filter((c) => expiredIds.has(c.id));
rec(
  "and none of those parks has run out",
  lapsed.length === 0,
  lapsed.length === 0
    ? `today is ${firmToday} in the firm's calendar`
    : `EXPIRED, so this is a finding again: ${lapsed.map((c) => `${c.file} claims ${c.id}`).join("; ")}`,
);

/* ------------------------------------- nothing is reached by nothing */

/*
 * THE CHECK THE OPERATOR ASKED FOR, and it is the half that does not rot.
 * Enumeration makes today's proofs run. This is what stops tomorrow's being
 * written somewhere the enumeration does not look: every file in the directory
 * is either executed above or proved by the compiler, and there is no third
 * category. A proof added with any other extension is named here rather than
 * ignored.
 */
const unaccounted = readdirSync(DIR).filter((f) => !/\.(mjs|ts)$/.test(f));
rec(
  "every file in the proofs directory is either run or type checked",
  unaccounted.length === 0,
  unaccounted.length === 0
    ? `${runnable.length} run as child processes, ${compileOnly.length} proved by tsc`
    : `reached by nothing: ${unaccounted.join(", ")}`,
);

/*
 * AND THE COMPILE TIME ONES ARE ACTUALLY IN THE TYPECHECK'S SUBJECT. Asserted
 * against tsconfig rather than believed, because the whole claim of a compile
 * proof is that `tsc` reads it. If the include pattern ever narrows, these stop
 * being proofs and start being files, silently, which is the defect this audit
 * exists to end.
 */
const tsconfig = readFileSync("tsconfig.json", "utf8");
const includesEveryTs = /"\*\*\/\*\.ts"/.test(tsconfig);
const excludesOnlyNodeModules = /"exclude"\s*:\s*\[\s*"node_modules"\s*\]/.test(tsconfig);
rec(
  "and the compile time proofs are inside what tsc reads",
  includesEveryTs && excludesOnlyNodeModules,
  includesEveryTs && excludesOnlyNodeModules
    ? `tsconfig includes **/*.ts and excludes node_modules only, so ${compileOnly.join(", ")} are type checked`
    : "tsconfig no longer includes every .ts, so the compile proofs may not be read at all",
);

/*
 * AND A PROOF NAMED AS ENFORCEMENT IN THE SOC 2 PACK IS ONE THIS AUDIT RUNS.
 *
 * The specific failure of 2026-09-22: the readiness pack told an auditor a
 * control was enforced by a proof no board executed. A reader takes enforcedBy
 * to mean a machine makes the control true. This asserts the citation is worth
 * something, in the one document where being wrong is worst.
 */
const controls = readSource("scripts/lib/soc2-controls.mjs");
const citedProofs = [...controls.matchAll(/scripts\/proofs\/([A-Za-z0-9._-]+\.mjs)/g)].map((m) => m[1]);
const citedButNotRun = [...new Set(citedProofs)].filter((f) => !runnable.includes(f));
rec(
  "every runnable proof the SOC 2 pack cites is one this audit runs",
  citedButNotRun.length === 0,
  citedButNotRun.length === 0
    ? citedProofs.length === 0
      ? "the pack cites no runnable proof today"
      : `cited and run: ${[...new Set(citedProofs)].join(", ")}`
    : `cited as enforcement and not run: ${citedButNotRun.join(", ")}`,
);

/* ------------------------------------------------------------------ verdict */

for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);

const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. Every proof runs, and none is reached by nothing.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exitCode = 1;
}
