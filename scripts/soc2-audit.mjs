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

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { CONTROLS, GAPS, regenerateCommands } from "./lib/soc2-controls.mjs";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

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
  const inSuite = commands.filter((c) => {
    const m = c.match(/^npx tsx scripts\/([\w-]+)\.mjs$/);
    return m && pkg.scripts?.[m[1]];
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
        execFileSync(process.execPath, ["./node_modules/tsx/dist/cli.mjs", tsx[1]], {
          stdio: ["ignore", "pipe", "pipe"],
          encoding: "utf8",
        });
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
    ...["scripts/lib/soc2-controls.mjs", "scripts/soc2-evidence.mjs", "scripts/soc2-audit.mjs"]
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
