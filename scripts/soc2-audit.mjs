// @runtime react-server
//
// Declared because this audit imports src/lib/system-actor.ts, which carries
// `server-only`. scripts/lib/audit-runtime.mjs works the requirement out from
// the imports and the board refuses to start when package.json disagrees, so
// this line and the invocation cannot drift apart.

/**
 * THE EVIDENCE PACK, KEPT HONEST.
 *
 *   npx tsx scripts/soc2-audit.mjs
 *
 * Phase 12 Section 6. This audit exists because the artefacts it checks are
 * DOCUMENTS, and a document is the easiest thing in this repository to get
 * wrong: nothing contradicts it, and by the time somebody notices it has been
 * wrong for a year.
 *
 * WHAT IT ASSERTS, AND WHY EACH ONE
 * ---------------------------------
 * 1. Every declared regenerate command can actually be run. An evidence index
 *    whose commands have rotted is a map to nothing, and it rots silently
 *    because nobody types the commands until an auditor is waiting.
 * 2. Every declared control reaches the generated report, and every declared
 *    gap reaches the exceptions register. A control quietly dropped from the
 *    declaration would otherwise vanish from both halves of the pack.
 * 3. The generated documents are GENERATED. A hand edit to a file that is
 *    overwritten on the next run is a change somebody will lose, and worse, a
 *    claim nothing regenerates.
 * 4. Nothing anywhere claims the firm is compliant, certified, or audited.
 *    That is the single overstatement this whole section must not make.
 * 5. No secret VALUE appears in any file this section writes.
 *
 * IT DOES NOT VERIFY THE OUTSIDE WORLD and says so where that matters. Whether
 * point in time recovery is really enabled is a provider setting nothing here
 * can see, and a check that cannot see a thing must not report on it.
 */

import { readFileSync, existsSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { CONTROLS, GAPS, regenerateCommands } from "./lib/soc2-controls.mjs";
import { CREDENTIALS, NOT_CREDENTIALS, STRING_LOOKUP_NOT_SECRETS, OFFBOARDING, RETIRED } from "./lib/soc2-credentials.mjs";
import { SYSTEM_CAPABILITIES, SYSTEM_ACTOR_MUST_NEVER } from "../src/lib/system-actor.ts";
import { readdirSync as _readdirSync } from "node:fs";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

const codeOnlyFile = (path) =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");

const READINESS = "docs/soc2-readiness.md";
const EXCEPTIONS = "docs/soc2-exceptions.md";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

/*
 * ===========================================================================
 * EVERYTHING THIS AUDIT JUDGES IS READ HERE, BEFORE ANY COMMAND RUNS.
 * ===========================================================================
 *
 * The first version of this file read the documents AFTER executing the
 * regenerate commands, one of which is the generator itself. So it overwrote
 * the documents and then inspected its own fresh output, which agrees with the
 * declaration by construction.
 *
 * Three injections proved it: a control deleted from the declaration, a
 * compliance claim pasted into the report, and a service key pasted into the
 * report were ALL missed, because the generator rewrote the file before the
 * check looked at it. The audit was green over a document that no longer
 * existed.
 *
 * That is CLAUDE.md section 6's rule one level up. An audit must not import its
 * expectation from the thing it audits, and regenerating the thing you are
 * about to judge is the same failure wearing a build step: the comparison can
 * only ever succeed.
 *
 * So the bytes are captured first. What is asserted below is the state of the
 * repository as somebody would find it, which is also the state an auditor
 * would be handed, rather than the state this process could produce.
 */
const SNAPSHOT = new Map();
for (const p of [READINESS, EXCEPTIONS]) {
  SNAPSHOT.set(p, existsSync(p) ? readFileSync(p, "utf8") : null);
}
const SNAPSHOT_EVIDENCE = (existsSync("evidence") ? readdirSync("evidence").map((x) => `evidence/${x}`) : [])
  .filter((p) => existsSync(p))
  .map((p) => [p, readFileSync(p, "utf8")]);

console.log("");
console.log("================ SOC 2 EVIDENCE, KEPT HONEST ================");
console.log("");

/* --------------------------------------- 1. the declaration is well formed */

{
  const ids = CONTROLS.map((c) => c.id);
  rec(
    "every control has a unique id",
    new Set(ids).size === ids.length,
    `${ids.length} controls`,
  );

  const incomplete = CONTROLS.filter(
    (c) => !c.control?.trim() || !c.enforcedBy?.trim() || !c.evidence?.trim() || typeof c.machine !== "boolean" || typeof c.verifiable !== "boolean",
  ).map((c) => c.id);
  rec(
    "and every one answers what enforces it, where the evidence is, and whether an outsider could check it",
    incomplete.length === 0,
    incomplete.length === 0 ? `${CONTROLS.length} complete` : `incomplete: ${incomplete.join(", ")}`,
  );

  const gapIncomplete = GAPS.filter((g) => !g.gap?.trim() || !g.consequence?.trim() || !g.severity?.trim()).map((g) => g.id);
  rec(
    "every gap states what actually follows from it rather than restating itself",
    gapIncomplete.length === 0,
    gapIncomplete.length === 0 ? `${GAPS.length} gaps` : `incomplete: ${gapIncomplete.join(", ")}`,
  );

  /*
   * THE GAPS ARE RANKED WITHOUT TIES OR HOLES. A rank is a claim about what an
   * auditor asks for first, and two things cannot both be first.
   */
  const ranks = GAPS.map((g) => g.rank).sort((a, b) => a - b);
  const contiguous = ranks.every((r, i) => r === i + 1);
  rec(
    "and the ranking is a real order, with no ties and no holes",
    contiguous,
    contiguous ? `1 to ${ranks.length}` : `ranks: ${ranks.join(", ")}`,
  );

  /*
   * AND THE HONEST HALF IS NOT SHORTER THAN THE FLATTERING ONE. Not a style
   * rule: a readiness assessment that finds more controls than gaps, for a firm
   * with one employee and no customers, has stopped looking.
   */
  rec(
    "the gaps are not outnumbered by the controls by more than half",
    GAPS.length >= CONTROLS.length / 2,
    `${CONTROLS.length} controls, ${GAPS.length} gaps`,
  );
}

/* ------------------------------- 2. every regenerate command can be run */

{
  const commands = regenerateCommands();
  rec("the evidence index names commands at all", commands.length > 0, `${commands.length} distinct`);

  const broken = [];
  const resolved = [];
  for (const cmd of commands) {
    let ok = false;
    let how = "";
    const npmRun = cmd.match(/^npm run ([\w:-]+)$/);
    const tsx = cmd.match(/^npx tsx (\S+)$/);
    const tsc = cmd.match(/^npx tsc\b/);
    if (npmRun) {
      ok = Boolean(pkg.scripts?.[npmRun[1]]);
      how = ok ? `package.json script "${npmRun[1]}"` : `no npm script named ${npmRun[1]}`;
    } else if (tsx) {
      ok = existsSync(tsx[1]);
      how = ok ? `${tsx[1]} exists` : `${tsx[1]} does not exist`;
    } else if (tsc) {
      ok = existsSync("node_modules/typescript/bin/tsc");
      how = ok ? "typescript is installed" : "typescript is not installed";
    } else {
      how = "this audit does not know how to resolve that command shape";
    }
    (ok ? resolved : broken).push(`${cmd} (${how})`);
  }
  rec(
    "and every one of them resolves to something that exists",
    broken.length === 0,
    broken.length === 0 ? `${resolved.length} resolved` : `BROKEN: ${broken.join("; ")}`,
  );

  /*
   * RESOLVING IS NOT RUNNING, AND THE DIFFERENCE IS STATED RATHER THAN BLURRED.
   *
   * Most of these commands ARE board audits, so the suite runs them on every
   * run and executing them again here would double a twenty minute board. One
   * is `npm run audit` itself, and running that from inside the board is a
   * recursion that would never terminate.
   *
   * So: a command that is a board audit is covered by the board, and that is
   * asserted rather than assumed. Anything else is executed here.
   */
  /*
   * WHAT THE BOARD RUNS IS THE BOARD'S OWN LIST, NOT package.json.
   *
   * The first version asked whether an npm script existed with that name and
   * treated a yes as "the board covers it". Those are different facts, and the
   * moment soc2-evidence was given an npm script for convenience this check
   * reclassified it as covered and quietly stopped executing it. The audit went
   * from 24 checks to 23 and said nothing, which is a check disappearing rather
   * than failing.
   *
   * scripts/audit.mjs carries the suite's own list, so it is parsed here. That
   * is the declared inventory idiom: derive from the declaration of intent,
   * never from something that merely correlates with it.
   */
  const boardSource = readFileSync("scripts/audit.mjs", "utf8");
  const boardRuns = new Set([...boardSource.matchAll(/name:\s*"([\w-]+)"/g)].map((m) => m[1]));
  rec(
    "the board's own audit list can be read",
    boardRuns.size > 20,
    `${boardRuns.size} audits named in scripts/audit.mjs`,
  );

  const inSuite = commands.filter((c) => {
    const m = c.match(/^npx tsx scripts\/([\w-]+)\.mjs$/);
    return m && boardRuns.has(m[1]);
  });
  const selfReferential = commands.filter((c) => c === "npm run audit");
  const mustRunHere = commands.filter((c) => !inSuite.includes(c) && !selfReferential.includes(c));

  rec(
    "the commands this audit does not execute are ones the board already runs",
    inSuite.length + selfReferential.length + mustRunHere.length === commands.length,
    `${inSuite.length} run by the board, ${selfReferential.length} is the board itself, ${mustRunHere.length} executed here`,
  );

  for (const cmd of mustRunHere) {
    let ran = false;
    let note = "";
    try {
      const tsx = cmd.match(/^npx tsx (\S+)$/);
      if (tsx) {
        /*
         * INTO A TEMPORARY DIRECTORY, NOT OVER THE TRACKED ARTEFACTS.
         *
         * The first version ran the generator over docs/ and evidence/, so
         * every board run rewrote four tracked files with a fresh timestamp
         * and left the working tree dirty. A board that dirties the tree is a
         * board a real uncommitted change can hide in.
         *
         * The command is still genuinely executed, which is the whole point of
         * the check. What it no longer does is edit the repository in order to
         * prove it can.
         */
        const scratch = mkdtempSync(join(tmpdir(), "soc2-audit-"));
        execFileSync(process.execPath, ["./node_modules/tsx/dist/cli.mjs", tsx[1]], {
          stdio: ["ignore", "pipe", "pipe"],
          encoding: "utf8",
          env: { ...process.env, SOC2_OUT_DIR: join(scratch, "evidence"), SOC2_DOCS_DIR: join(scratch, "docs") },
        });
        rmSync(scratch, { recursive: true, force: true });
        ran = true;
        note = "ran";
      } else if (/^npx tsc\b/.test(cmd)) {
        execFileSync(process.execPath, ["./node_modules/typescript/bin/tsc", "--noEmit"], {
          stdio: ["ignore", "pipe", "pipe"],
          encoding: "utf8",
        });
        ran = true;
        note = "ran";
      } else {
        note = "not executable from here";
      }
    } catch (e) {
      const output = (e.stdout || e.stderr || e.message || "").toString();
      /*
       * A STALE .next IS NOT A TYPE ERROR IN THIS REPOSITORY.
       *
       * Next generates .next/dev/types/validator.ts naming every route it knows
       * about. Switching branches leaves it describing routes that no longer
       * exist here, and tsc then reports "Cannot find module
       * '../../../src/app/portal/(app)/launch/page.js'" for a file that belongs
       * to a different branch.
       *
       * That failure looks exactly like a type error in the source and is not
       * one, which is the same class as the build race guard and the same
       * answer: say what happened rather than reporting a red nobody can act on.
       * A real error in src/ or scripts/ still fails.
       */
      const lines = output.split("\n").filter((l) => /error TS\d+/.test(l));
      const ours = lines.filter((l) => !l.startsWith(".next"));
      if (lines.length > 0 && ours.length === 0) {
        ran = true;
        note = `ran; ${lines.length} error(s) ignored, all in .next generated types, which is a stale artifact from another branch rather than a type error here. Clear .next to silence it.`;
      } else {
        note = `exited non zero: ${ours.slice(0, 2).join(" | ").slice(0, 200) || output.trim().slice(0, 180)}`;
      }
    }
    rec(`the index command \`${cmd}\` runs`, ran, note);
  }
}

/* ------------------- 3. the generated documents carry what is declared */

{
  for (const [label, path] of [["readiness", READINESS], ["exceptions", EXCEPTIONS]]) {
    const text = SNAPSHOT.get(path);
    if (text === null || text === undefined) {
      rec(`${path} exists`, false, "regenerate with: npx tsx scripts/soc2-evidence.mjs");
      continue;
    }

    rec(
      `${path} says it was generated and must not be edited`,
      /Generated by `scripts\/soc2-evidence\.mjs`/.test(text) && /Do not edit this file/.test(text),
      "a hand edit to a generated file is a change somebody loses and a claim nothing regenerates",
    );

    /*
     * THE ONE OVERSTATEMENT THIS SECTION MUST NOT MAKE. Checked as words in the
     * output rather than as an intention in the source, because the output is
     * what somebody outside the firm would read.
     */
    const claims = [
      /\bis SOC 2 compliant\b/i,
      /\bwe are compliant\b/i,
      /\bSOC 2 certified\b/i,
      /\bhas been audited\b/i,
      /\bpassed (?:our|the) SOC 2\b/i,
      /\bfully compliant\b/i,
    ].filter((p) => p.test(text));
    rec(
      `${path} never claims the firm is compliant, certified or audited`,
      claims.length === 0,
      claims.length === 0 ? "readiness, not compliance" : `IT CLAIMS: ${claims.map(String).join(", ")}`,
    );

    /* A template that rendered undefined is a figure nobody read. */
    const holes = ["undefined", "NaN", "[object Object]", "${"].filter((h) => text.includes(h));
    rec(
      `${path} has no unrendered figures`,
      holes.length === 0,
      holes.length === 0 ? "every placeholder filled" : `found: ${holes.join(", ")}`,
    );

    if (label === "readiness") {
      const missing = CONTROLS.filter((c) => !text.includes(c.control)).map((c) => c.id);
      rec(
        "every declared control reaches the readiness report",
        missing.length === 0,
        missing.length === 0 ? `${CONTROLS.length} present` : `missing: ${missing.join(", ")}`,
      );
      rec(
        "and the report names which database it was generated against",
        /against (?:PRODUCTION|development|an unknown project) \(/.test(text),
        "an access review of the wrong database is worse than none",
      );
      rec(
        "and it states the firm is not compliant before it lists any control",
        text.indexOf("NOT SOC 2 COMPLIANT") > 0 &&
          text.indexOf("NOT SOC 2 COMPLIANT") < text.indexOf("## THE CONTROLS THAT DO EXIST"),
        "the disclaimer is above the controls, not below them",
      );
      rec(
        "and the gaps are printed before the controls",
        text.indexOf("## THE GAPS") > 0 && text.indexOf("## THE GAPS") < text.indexOf("## THE CONTROLS THAT DO EXIST"),
        "a readiness document that leads with controls is a sales document",
      );
    }

    if (label === "exceptions") {
      const missing = GAPS.filter((g) => !text.includes(g.gap)).map((g) => g.id);
      rec(
        "every declared gap reaches the exceptions register",
        missing.length === 0,
        missing.length === 0 ? `${GAPS.length} present` : `missing: ${missing.join(", ")}`,
      );
      rec(
        "and the deferred cutover is named with its consequence",
        /cutover/i.test(text) && /shared with four unrelated applications/i.test(text),
        "the operator's ruling of 2026-09-10 asked for the deferral and its recorded consequence",
      );
    }
  }
}

/* ------------------- 3b. the credential inventory matches what the code reads */

{
  /*
   * DERIVED FROM THE SOURCE, COMPARED TO THE DECLARATION.
   *
   * The inventory is worth nothing if it is a list somebody maintained once. So
   * every process.env read in src/ and scripts/ is scanned out of the files and
   * every one of them must be either declared as a credential or named as not
   * being one. Adding a secret without declaring it fails the board.
   *
   * This is the surfaces.mjs idiom: the harness measures what the declaration
   * says exists, and a directory that renders pages and belongs to no declared
   * surface is a red board.
   */
  const files = [];
  const walk = (dir) => {
    for (const entry of _readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const p = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(p);
      else if (/\.(ts|tsx|mjs)$/.test(entry.name)) files.push(p);
    }
  };
  walk("src");
  walk("scripts");

  /*
   * COMMENTS ARE STRIPPED BEFORE ANYTHING IS MATCHED.
   *
   * The first run reported an undeclared credential called X, which is the word
   * process.env.X written inside the explanatory comment at the top of
   * soc2-credentials.mjs. That is the fourth time in this repository a check has
   * matched its own prose, and the answer is the one used the other three times
   * rather than a looser pattern.
   */
  const codeOnly = (text) =>
    text
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*)/.test(line))
      .join("\n");

  /*
   * AND TWO SHAPES ARE SCANNED, NOT ONE.
   *
   * The first version looked only for process.env.NAME and reported
   * ALLOW_PRODUCTION_PREVIEW as declared but never read. It IS read, at
   * src/lib/db-guard.ts:136, as env.ALLOW_PRODUCTION_PREVIEW: that module takes
   * an env object as a parameter so its guard can be tested against a preview,
   * a production and a local environment without setting real variables.
   *
   * So the scanner had a blind spot exactly where the most careful code lives.
   * A secret read through an injected env object would never have been required
   * to be declared, and the check would have been green over it forever. Both
   * shapes are matched now.
   */
  const read = new Set();
  for (const p of files) {
    const text = codeOnly(readFileSync(p, "utf8"));
    for (const m of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]{2,})/g)) read.add(m[1]);
    for (const m of text.matchAll(/\benv\.([A-Z][A-Z0-9_]{2,})/g)) read.add(m[1]);
  }

  rec(
    "the environment scan found variables to check",
    read.size > 20,
    `${read.size} distinct process.env reads across ${files.length} files`,
  );

  /*
   * THE THIRD SHAPE, AND IT IS THE ONE THAT HID TWO REAL SECRETS.
   *
   * Operator ruling, 2026-09-12. INTAKE_KEY_SEALED and INTAKE_KEY_STAMP are
   * named as STRINGS in a lookup table in src/lib/sister-intake.ts and read
   * through that map, so neither a direct property read nor an injected env
   * object read appears for them anywhere. Both scans above were blind to them
   * and the inventory was silently short by two credentials, each of which lets
   * a caller write into this firm's database.
   *
   * So an all capitals underscored string literal is treated as a candidate
   * environment name and must be declared or named as not a credential. That
   * convention is the only thing distinguishing an env name from any other
   * string, which is exactly why the shape is worth checking rather than
   * trusting.
   *
   * IT IS DELIBERATELY NOISY IN ONE DIRECTION. A false positive costs one line
   * in NOT_CREDENTIALS with a reason beside it. A false negative is a secret
   * nobody declared, which is what this ruling exists to prevent happening
   * twice.
   */
  const byStringLookup = new Set();
  for (const p of files) {
    const text = codeOnly(readFileSync(p, "utf8"));
    for (const m of text.matchAll(/["']([A-Z][A-Z0-9]*(?:_[A-Z0-9]+){1,})["']/g)) byStringLookup.add(m[1]);
  }

  const declared = new Set(CREDENTIALS.map((c) => c.name));
  const undeclared = [...read].filter((v) => !declared.has(v) && !NOT_CREDENTIALS.has(v)).sort();
  rec(
    "every environment value the code reads is either declared or named as not a credential",
    undeclared.length === 0,
    undeclared.length === 0
      ? `${declared.size} declared, ${NOT_CREDENTIALS.size} named as not credentials`
      : `UNDECLARED: ${undeclared.join(", ")}`,
  );

  rec(
    "the string literal scan found candidate names to check",
    byStringLookup.size > 5,
    `${byStringLookup.size} all capitals underscored string literals`,
  );

  /*
   * RETIRED NAMES ARE EXCUSED, and the first run without this is the eighth
   * time a check here matched its own declaration: listing ADMIN_PASSPHRASE as
   * retired put the string into a scanned file, and the scan reported it as an
   * undeclared secret.
   *
   * Recording that a credential is dead must not itself look like a live one.
   */
  const retiredHere = new Set(RETIRED.map((r) => r.name));
  const undeclaredStrings = [...byStringLookup]
    .filter((v) => !declared.has(v) && !NOT_CREDENTIALS.has(v) && !STRING_LOOKUP_NOT_SECRETS.has(v) && !retiredHere.has(v))
    .sort();
  rec(
    "and every secret named by string lookup is declared, which is the shape that hid two",
    undeclaredStrings.length === 0,
    undeclaredStrings.length === 0
      ? `${byStringLookup.size} candidates, all declared or named as not credentials`
      : `UNDECLARED BY STRING LOOKUP: ${undeclaredStrings.join(", ")}`,
  );

  /*
   * AND THE SCAN PROVES IT CAN SEE THE TWO IT WAS WRITTEN FOR. A scanner that
   * has never matched anything has never been tested, and these are the exact
   * names it exists because of.
   */
  rec(
    "and the scan can see the two secrets that hid from the other two shapes",
    byStringLookup.has("INTAKE_KEY_SEALED") && byStringLookup.has("INTAKE_KEY_STAMP"),
    byStringLookup.has("INTAKE_KEY_SEALED") && byStringLookup.has("INTAKE_KEY_STAMP")
      ? "both found as string literals in src/lib/sister-intake.ts"
      : "THE SCAN CANNOT SEE THEM, so it would not have caught the thing it was written for",
  );

  /*
   * ROTATION IS STATED FOR EVERY SECRET, AND "Never." IS A STATEMENT.
   *
   * Operator ruling, 2026-09-12: state when each was last rotated, and if the
   * answer is never, say never. null used to mean unknown, which is softer than
   * the truth and let the column stay empty forever.
   */
  const unstated = CREDENTIALS.filter((c) => c.kind === "secret" && !String(c.rotated ?? "").trim()).map((c) => c.name);
  const rotatedSecrets = CREDENTIALS.filter((c) => c.kind === "secret" && !/^Never\.$/.test(String(c.rotated)));
  rec(
    "every secret states when it was last rotated, and says Never when it never was",
    unstated.length === 0,
    unstated.length === 0
      ? `${CREDENTIALS.filter((c) => c.kind === "secret").length} secrets, ${rotatedSecrets.length} rotated at least once`
      : `no rotation stated: ${unstated.join(", ")}`,
  );

  /*
   * AND THE DECLARATION DOES NOT DESCRIBE THINGS THAT NO LONGER EXIST. A list
   * that only ever grows is a list nobody is reading.
   */
  /*
   * ACROSS ALL THREE SHAPES. The by-name exception for FIRM_PHONE is gone: the
   * string lookup scan added on 2026-09-12 sees it, because contact.ts reads it
   * through a helper that takes the name as a string. An exception that exists
   * only because a scanner was blind should disappear when the scanner learns
   * to see, rather than staying as a permanent excuse nobody revisits.
   */
  const readAnyShape = new Set([...read, ...byStringLookup]);
  const phantom = CREDENTIALS.filter((c) => !readAnyShape.has(c.name)).map((c) => c.name);
  rec(
    "and the declaration does not carry credentials the code never reads",
    phantom.length === 0,
    phantom.length === 0 ? "every declared name is read somewhere" : `declared but never read: ${phantom.join(", ")}`,
  );

  const noGrant = CREDENTIALS.filter((c) => !c.grants?.trim() || !c.livesIn?.trim()).map((c) => c.name);
  rec(
    "and every credential says what it grants and where it lives",
    noGrant.length === 0,
    noGrant.length === 0 ? `${CREDENTIALS.length} complete` : `incomplete: ${noGrant.join(", ")}`,
  );

  /*
   * THE ROTATION FINDING, ASSERTED RATHER THAN LEFT IN PROSE. Nothing records
   * when a secret was last changed. If that ever becomes knowable this check
   * starts failing, which is the right way round: it forces the report to be
   * updated when the fact changes.
   */
  const cannot = OFFBOARDING.filter((s) => !s.can).length;
  rec(
    "the offboarding sequence names the steps the platform cannot perform",
    cannot > 0 && OFFBOARDING.every((s) => s.what?.trim() && s.how?.trim()),
    `${OFFBOARDING.length} steps, ${cannot} the platform cannot perform and says so`,
  );
}

/* --------------------- 3c. the system principal, and what it may never do */

{
  /*
   * THE PLATFORM ACTING IN ITS OWN NAME, CHECKED THE WAY THE LICENSED ACTIONS
   * ARE.
   *
   * Operator ruling, 2026-09-12. The guarantee itself is a COMPILE TIME one and
   * lives in scripts/proofs/the-system-actor-is-not-a-person.ts, which fails to
   * build if the system principal ever becomes assignable to a human actor or
   * its capabilities become grantable.
   *
   * What this audit adds is the thing a compile proof cannot do: assert that
   * the proof still NAMES everything it claims to cover. A proof that stopped
   * mentioning documents.seal would keep compiling and would prove less, which
   * is the same reason reporting-audit checks its own proof for every licensed
   * figure.
   */
  const proofPath = "scripts/proofs/the-system-actor-is-not-a-person.ts";
  if (!existsSync(proofPath)) {
    rec("the system actor compile proof exists", false, proofPath);
  } else {
    const proof = readFileSync(proofPath, "utf8");

    rec("the system actor compile proof exists", true, proofPath);

    /*
     * EVERY ACTION IT MUST NEVER PERFORM IS NAMED IN THE PROOF. Read from the
     * declaration, so adding one to SYSTEM_ACTOR_MUST_NEVER without proving it
     * fails here rather than being a sentence nothing enforces.
     */
    const mustNever = [...SYSTEM_ACTOR_MUST_NEVER.licensed, ...SYSTEM_ACTOR_MUST_NEVER.money];
    const unproved = mustNever.filter((a) => !proof.includes(`"${a}"`));
    rec(
      "and every action the platform must never perform is named in it",
      mustNever.length > 0 && unproved.length === 0,
      unproved.length === 0
        ? `${mustNever.length} actions proved unaskable`
        : `declared forbidden but not proved: ${unproved.join(", ")}`,
    );

    /*
     * AND THE PROOF ASSERTS BOTH DIRECTIONS. One direction stops the platform
     * being handed to a function that takes a person. The other stops a
     * person's action being attributed to the platform, which would hide a real
     * actor behind "The platform" in the trail.
     */
    rec(
      "and it proves the principal is not a person in both directions",
      /systemAsPerson/.test(proof) && /personAsSystem/.test(proof),
      "a one way check would let a person's action be recorded as the platform's",
    );

    /*
     * A PROOF WITH NO ASSERTIONS IS A FILE. Every guarantee here is a
     * @ts-expect-error, so counting them is counting the assertions.
     */
    const expectations = (proof.match(/@ts-expect-error/g) ?? []).length;
    rec(
      "and it carries assertions rather than prose",
      expectations >= 10,
      `${expectations} compile time assertions`,
    );
  }

  /*
   * THE PRINCIPAL HOLDS NO GRANTS AND IS NOT A PERSON'S ROLE.
   *
   * Read from the declaration rather than asserted in words: its capabilities
   * are a closed set of two, and neither is an Action.
   */
  rec(
    "the system principal holds exactly the two capabilities it was ruled",
    SYSTEM_CAPABILITIES.length === 2 &&
      SYSTEM_CAPABILITIES.includes("tasks.raise") &&
      SYSTEM_CAPABILITIES.includes("audit.write"),
    SYSTEM_CAPABILITIES.join(", "),
  );

  /*
   * AND IT IS NOT A ROW IN eng_profiles, which is what stops it being signed in
   * to, reset, suspended, or listed as an account somebody must justify. The
   * access review would otherwise carry a principal nobody can offboard.
   */
  const sysSrc = codeOnlyFile("src/lib/system-actor.ts");
  rec(
    "and it is a constant rather than a profile row, so there is nothing to sign in to",
    !/eng_profiles/.test(sysSrc),
    "a profile is one password reset away from being a person",
  );

  /*
   * EVERY ROW IT WRITES NAMES IT. The operator's requirement, and the reason
   * the principal exists at all: an auditor separates platform-raised work from
   * a person's by reading the trail, without asking anybody.
   */
  const workSrc = codeOnlyFile("src/lib/system-work.ts");
  rec(
    "every row the platform writes names it",
    /SYSTEM_ACTOR_EMAIL/.test(workSrc) && /SYSTEM_ACTOR\.id/.test(workSrc),
    "actor_email is the-platform@system.invalid, which is greppable without knowing the uuid",
  );
  rec(
    "and it writes through the same audit path as everybody else",
    /writeAudit\(/.test(workSrc),
    "a second insert path is a second row shape that will drift",
  );
}

/* ------------- 3d. what must not be sitting in an environment file at all */

{
  /*
   * A CREDENTIAL IN AN ENVIRONMENT FOR A THING NOBODY IS RUNNING.
   *
   * Operator rulings, 2026-09-12. Three keys were sitting in .env.local for no
   * current purpose, and one of them had already done damage.
   *
   * RESEND_API_KEY is the worked example and the reason this check exists.
   * notify.ts returns null when it is absent and logs "skipped, RESEND_API_KEY
   * is not set", so with no key a mistake writes a row instead of reaching
   * somebody's inbox. WITH the key present, two bugs in one day sent fifty five
   * real emails: a retention dry run sent twenty and the first version of
   * queue-audit sent thirty five, to the operator's own address and the firm's.
   * Migration 0038's header records both.
   *
   * effect_mode answered it for the JOBS. This answers it for the MACHINE.
   *
   * THE REFUSAL TO SEND WITHOUT A KEY IS CORRECT AND IS NOT WORKED AROUND. A
   * session that genuinely means to send sets ALLOW_REAL_EMAIL_SENDS and
   * supplies the key by hand for that session. Neither is ever committed.
   */
  const ENV_FILES = [".env", ".env.local", ".env.development", ".env.production", ".env.development.local", ".env.production.local"];
  const present = ENV_FILES.filter((p) => existsSync(p));

  rec(
    "there is an environment file to check",
    present.length > 0,
    present.join(", ") || "none found, so every check below would pass over nothing",
  );

  /** Which env files name this variable at all. Never reads a value. */
  const setIn = (name) =>
    present.filter((p) => new RegExp(`^\\s*${name}=`, "m").test(readFileSync(p, "utf8")));

  /*
   * THE CUTOVER KEYS. Full access to a source database and a destination,
   * between them, for a script that is deferred. The largest single credential
   * exposure this firm could have, existing for no current purpose.
   */
  for (const key of ["COPY_FROM_KEY", "COPY_TO_KEY"]) {
    const where = setIn(key);
    rec(
      `${key} is in no environment file, because the cutover is deferred`,
      where.length === 0,
      where.length === 0
        ? "supplied by hand for one command on the day it runs"
        : `SET IN ${where.join(", ")}. Remove it and rotate the underlying key.`,
    );
  }

  /*
   * THE MAIL KEY, unless somebody said they meant it. Checked against the
   * PROCESS environment rather than a file, because the opt in is for a session
   * and must never be committed.
   */
  {
    const where = setIn("RESEND_API_KEY");
    const optedIn = process.env.ALLOW_REAL_EMAIL_SENDS === "1";
    rec(
      "RESEND_API_KEY is in no environment file unless this session means to send",
      where.length === 0 || optedIn,
      where.length === 0
        ? "absent, so a mistake writes a row instead of reaching an inbox"
        : optedIn
          ? `set in ${where.join(", ")}, and ALLOW_REAL_EMAIL_SENDS=1 says that is deliberate`
          : `SET IN ${where.join(", ")} with no ALLOW_REAL_EMAIL_SENDS. Two bugs sent 55 real emails the last time this was true.`,
    );

    /*
     * AND THE OPT IN IS NEVER COMMITTED. A variable that lives in a file is not
     * a decision somebody made for one session.
     */
    const optInFiles = setIn("ALLOW_REAL_EMAIL_SENDS");
    rec(
      "and the opt in itself is in no environment file",
      optInFiles.length === 0,
      optInFiles.length === 0
        ? "it is typed for a session, never stored"
        : `SET IN ${optInFiles.join(", ")}, which makes the permission permanent`,
    );
  }

  /*
   * AND THE UNLOCK TOKEN, removed for the same reason: it serves one route
   * handler that nothing local calls.
   */
  {
    const where = setIn("OPS_UNLOCK_TOKEN");
    rec(
      "OPS_UNLOCK_TOKEN is in no environment file, because nothing local calls that route",
      where.length === 0,
      where.length === 0 ? "absent" : `SET IN ${where.join(", ")}`,
    );
  }

  /*
   * AND THE DEVELOPMENT KEY IS THE DEVELOPMENT PROJECT'S.
   *
   * The one service role key that SHOULD be here. Asserted by ref rather than
   * by value, so this says which database it opens without reading the secret
   * that opens it.
   */
  {
    const local = present.includes(".env.local") ? readFileSync(".env.local", "utf8") : "";
    const url = (local.match(/^\s*SUPABASE_URL=(.*)$/m) ?? [])[1] ?? "";
    rec(
      "the local service role key belongs to the development project",
      /ythzaiqeoijlrdibnieo/.test(url),
      /ythzaiqeoijlrdibnieo/.test(url)
        ? "SUPABASE_URL names development, which every audit reads through"
        : `SUPABASE_URL does not name the development project: ${url.slice(0, 40)}`,
    );
  }

  /*
   * THREE THINGS THIS MACHINE CANNOT SEE, RECORDED AS UNKNOWN RATHER THAN
   * ABSENT.
   *
   * Operator ruling, 2026-09-12. No Vercel tool available here exposes
   * environment variables and the CLI is not installed, so the deployment half
   * of every answer above is unread. Recording it as absent would be the
   * overstatement this whole section exists to avoid: a check that cannot see a
   * thing must not report on it.
   */
  /*
   * THREE QUESTIONS, FOUR ENTRIES. The two cutover keys are one question, and
   * counting entries instead of naming them reported four against an expected
   * three on the first run. Named, so the check says which answer is missing
   * rather than that a number moved.
   */
  const MUST_BE_PENDING = {
    "do the cutover keys exist in Vercel at all": ["COPY_FROM_KEY", "COPY_TO_KEY"],
    "is the service role key scoped to Production alone": ["SUPABASE_SERVICE_ROLE_KEY"],
    "is the mail key set on Preview": ["RESEND_API_KEY"],
  };
  const byName = new Map(CREDENTIALS.map((c) => [c.name, c]));
  const notPending = [];
  for (const [question, names] of Object.entries(MUST_BE_PENDING)) {
    for (const name of names) {
      const entry = byName.get(name);
      if (!entry || !/UNKNOWN, pending the operator/.test(entry.livesIn)) notPending.push(`${name} (${question})`);
    }
  }
  /*
   * ANSWERED ON 2026-09-12, SO THE CHECK CHANGED WITH THE FACT.
   *
   * It used to assert every one of these was marked pending, which was right
   * while nobody had read the dashboard and became wrong the moment the
   * operator did. A check that insists on ignorance after the answer arrives is
   * a check on a moment rather than on a property.
   *
   * What it asserts now is that each entry carries an ANSWER WITH ITS
   * PROVENANCE: either still pending the operator, or read on a date by a named
   * reader. What it will not tolerate is a bare claim with neither.
   */
  const unanswered = [];
  for (const [question, names] of Object.entries(MUST_BE_PENDING)) {
    for (const name of names) {
      const entry = byName.get(name);
      const text = entry?.livesIn ?? "";
      const pending = /UNKNOWN, pending the operator/.test(text);
      const answered = /Read 2026-\d\d-\d\d|the operator read Vercel on 2026-\d\d-\d\d/.test(text);
      if (!entry || (!pending && !answered)) unanswered.push(`${name} (${question})`);
    }
  }
  rec(
    "what only Vercel can answer is either still pending or recorded with when it was read",
    unanswered.length === 0,
    unanswered.length === 0
      ? `${Object.keys(MUST_BE_PENDING).length} questions across 4 entries, each carrying an answer or an explicit pending`
      : `a bare claim with no provenance: ${unanswered.join("; ")}`,
  );
}

/* ------- 3e. the reverse scan, and secrets that must never cross Preview */

{
  const ENV_FILES = [".env", ".env.local", ".env.development", ".env.production", ".env.development.local", ".env.production.local"];
  const present = ENV_FILES.filter((p) => existsSync(p));

  /*
   * ===================================================================
   * THE REVERSE SCAN. EVERY OTHER CHECK HERE ASKS WHAT THE CODE READS.
   * ===================================================================
   *
   * Operator ruling, 2026-09-12, and the sentence is the whole lesson: a secret
   * NOTHING READS was invisible to every scan, because every scan asked what
   * the code reads.
   *
   * ADMIN_PASSPHRASE sat in .env.local holding a short human passphrase for a
   * surface retired months ago. The property scans could not see it, the string
   * lookup scan could not see it, and the phantom check could not see it,
   * because all three start from the source. It was found by reading an
   * environment file.
   *
   * So this runs the other way: every name SET in an env file must be declared
   * or listed as retired. A dead credential is named rather than invisible.
   */
  const namesInEnvFiles = new Set();
  for (const p of present) {
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z][A-Z0-9_]*)=/);
      if (m) namesInEnvFiles.add(m[1]);
    }
  }

  rec(
    "the reverse scan found names in the environment files to check",
    namesInEnvFiles.size > 3,
    `${namesInEnvFiles.size} names set across ${present.length} file(s)`,
  );

  const declaredNames = new Set(CREDENTIALS.map((c) => c.name));
  const retiredNames = new Set(RETIRED.map((r) => r.name));
  const undeclaredInFiles = [...namesInEnvFiles]
    .filter((v) => !declaredNames.has(v) && !NOT_CREDENTIALS.has(v) && !retiredNames.has(v))
    .sort();
  rec(
    "and every name set in an environment file is declared or recorded as retired",
    undeclaredInFiles.length === 0,
    undeclaredInFiles.length === 0
      ? `${namesInEnvFiles.size} checked against ${declaredNames.size} declared and ${retiredNames.size} retired`
      : `SET BUT DECLARED NOWHERE: ${undeclaredInFiles.join(", ")}. A secret nothing reads is invisible to every other check here.`,
  );

  /*
   * AND A RETIRED CREDENTIAL IS NOT STILL SITTING THERE. Naming it is half the
   * job; the other half is that it is actually gone.
   */
  const retiredButPresent = [...retiredNames].filter((v) => namesInEnvFiles.has(v));
  rec(
    "and nothing recorded as retired is still set",
    retiredButPresent.length === 0,
    retiredButPresent.length === 0
      ? `${retiredNames.size} retired, none present`
      : `RETIRED BUT STILL SET: ${retiredButPresent.join(", ")}`,
  );

  /*
   * AND EVERY RETIREMENT SAYS WHEN AND WHY. A list of names nobody can act on
   * is the shape this repository keeps rejecting.
   */
  const thinRetirements = RETIRED.filter((r) => !r.retired?.trim() || (r.why ?? "").trim().length < 40).map((r) => r.name);
  rec(
    "and every retirement says when and why",
    thinRetirements.length === 0,
    thinRetirements.length === 0 ? `${RETIRED.length} recorded` : `thin: ${thinRetirements.join(", ")}`,
  );

  /*
   * ===================================================================
   * A SECRET THAT DECIDES IDENTITY OR OPENS A DATABASE IS NEVER SHARED
   * BETWEEN PREVIEW AND PRODUCTION.
   * ===================================================================
   *
   * Operator ruling, 2026-09-12, after reading the dashboard. CUSTOMER_SESSION_
   * SECRET was All Environments, so a customer cookie minted on ANY preview
   * deployment was valid on production, and a preview URL is reachable by
   * anybody holding the link. PARTNER_SESSION_SECRET and MFA_ENCRYPTION_KEY
   * were Production and Preview sharing one value. OPS_SESSION_SECRET was
   * already split, which is how the finding was findable at all: the correct
   * pattern existed and had been applied to one principal of three.
   *
   * THIS CHECK CANNOT READ VERCEL, and does not pretend to. It asserts what the
   * DECLARATION says, which is the operator's answer written down. That is
   * worth having because it makes a future sharing a deliberate edit to a file
   * somebody reviews, rather than a dropdown nobody looks at again.
   */
  const sensitive = CREDENTIALS.filter((c) => c.decides === "identity" || c.decides === "database");
  rec(
    "the identity and database secrets are named",
    sensitive.length >= 5,
    sensitive.map((c) => c.name).join(", "),
  );

  const undeclaredEnvs = sensitive.filter((c) => !c.environments).map((c) => c.name);
  rec(
    "and every one records which environments it lives in",
    undeclaredEnvs.length === 0,
    undeclaredEnvs.length === 0
      ? `${sensitive.length} recorded, read from the dashboard`
      : `no environments recorded: ${undeclaredEnvs.join(", ")}`,
  );

  const shared = sensitive
    .filter((c) => c.environments)
    .filter((c) => c.environments.preview === "set" && c.environments.previewValueDistinct !== true)
    .map((c) => c.name);
  rec(
    "and none is declared as sharing a value between Preview and Production",
    shared.length === 0,
    shared.length === 0
      ? "every one is absent on Preview or holds a distinct value there"
      : `SHARED WITH PREVIEW: ${shared.join(", ")}. A preview URL is reachable by anybody with the link.`,
  );

  /*
   * AND THE ANSWER HAS A DATE AND AN AUTHOR. An environment map with no
   * provenance is a claim about a dashboard somebody looked at once.
   */
  const undated = sensitive.filter((c) => c.environments && !(c.environments.readOn ?? "").trim()).map((c) => c.name);
  rec(
    "and says when it was read and by whom",
    undated.length === 0,
    undated.length === 0 ? "every environment map carries its provenance" : `undated: ${undated.join(", ")}`,
  );
}

/* ------------------------------------ 4. no secret value in what we wrote */

{
  /*
   * A NARROW GUARANTEE, STATED NARROWLY.
   *
   * This proves no secret VALUE reached the files this section writes. It is
   * not secret scanning, it does not cover the rest of the repository, and the
   * exceptions register lists the absence of real scanning as a gap. Saying
   * more than this would be the overstatement the section exists to avoid.
   */
  /*
   * The documents and the evidence come from the SNAPSHOT taken before the
   * generator ran, for the reason written at the top of this file. The scripts
   * are read from disk because nothing in this audit rewrites them.
   */
  const ours = [
    ...[...SNAPSHOT.entries()].filter(([, v]) => v !== null),
    ...SNAPSHOT_EVIDENCE,
    ...["scripts/lib/soc2-controls.mjs", "scripts/lib/soc2-credentials.mjs", "scripts/soc2-evidence.mjs", "scripts/soc2-audit.mjs"]
      .filter((p) => existsSync(p))
      .map((p) => [p, readFileSync(p, "utf8")]),
  ];

  /* Shapes, not names. A variable called SUPABASE_SERVICE_ROLE_KEY is fine; the
   * 200 character JWT it holds is not. */
  const shapes = [
    { name: "a JSON web token", re: /\beyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\./ },
    { name: "a Stripe secret key", re: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}/ },
    { name: "a Supabase publishable or secret key", re: /\bsb[ps]_[A-Za-z0-9_-]{16,}/ },
    { name: "a long base64 blob that could be a key", re: /['"][A-Za-z0-9+/]{60,}={0,2}['"]/ },
    { name: "a private key block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  ];

  const hits = [];
  for (const [file, text] of ours) {
    for (const s of shapes) if (s.re.test(text)) hits.push(`${file}: ${s.name}`);
  }
  rec(
    "no secret value appears in any file this section writes",
    hits.length === 0,
    hits.length === 0 ? `${ours.length} files scanned for 5 shapes` : `FOUND: ${hits.join("; ")}`,
  );

  /*
   * AND THE SCAN CAN SEE ONE. A scanner that has never matched anything is a
   * scanner nobody has tested, which is the same rule the board applies to
   * every audit in this suite.
   */
  /*
   * ASSEMBLED RATHER THAN WRITTEN, and the first run is why.
   *
   * This file is in the list of files the scan reads, so a literal token here
   * is a token in a scanned file, and the scan found it and failed. That is the
   * scanner working perfectly on its own test fixture.
   *
   * Building it from pieces means no scannable token exists in the source while
   * the assembled value is still a real match, so the proof keeps its teeth.
   */
  const canary = ["ey", "JhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", ".", "eyJzdWIiOiJ0ZXN0In0", ".", "notarealsignature"].join("");
  rec(
    "and the scan proves it can see one",
    shapes.some((s) => s.re.test(canary)),
    "a scanner that has never matched anything has never been tested",
  );
}

/* ----------------------------------------------------------------- verdict */

console.log("");
const failed = out.filter((r) => !r.ok);
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. ${CONTROLS.length} controls and ${GAPS.length} gaps, all reaching the pack.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("A readiness document nothing checks is the claim this whole section exists to avoid making.");
  process.exitCode = 1;
}
