/**
 * HOW AN AUDIT REACHES THE LIVE STATE NOW THAT A VARIABLE CANNOT OPEN THE GATE.
 *
 * Operator ruling, 2026-09-10: the compliance gate is a set of NAMED CONDITIONS
 * read from configuration, so the flip is impossible until each is stated true
 * in a file somebody has to edit on purpose.
 *
 * That ruling did exactly what it was meant to, and it broke three audits the
 * same afternoon. launch-audit, email-audit and retention-audit all reached the
 * live state by setting TBPELS_FIRM_NUMBER, and there is no longer any
 * environment variable that opens the gate. Their live halves went red while
 * the gate was working perfectly.
 *
 * WHY THE ANSWER IS NOT A TEST FLAG
 * ----------------------------------
 * The obvious fix is an escape hatch: a variable the gate honours when some
 * other variable says it is safe. That is the thing the ruling removed, wearing
 * a lab coat. A gate with a documented bypass is a gate whose bypass eventually
 * gets set on a deployment, and this one governs what a firm may claim about
 * its registration.
 *
 * SO THE FIXTURE STATES THE CONDITIONS TRUE, IN THE FILE, AND PUTS IT BACK
 * ------------------------------------------------------------------------
 * Which is what the ruling says opening the gate takes, and what every
 * injection in this repository already does. The gate is untouched: there is no
 * code path that opens it without the register saying so. What changes is that
 * an audit can write the register for the length of a run.
 *
 * IT RESTORES IN A `finally` AND THEN VERIFIES THE RESTORE.
 *
 * A crash mid run must not leave a fixture registration in the source tree,
 * because the next thing to read it would be a build. So the original bytes are
 * held in memory, written back whatever happens, and compared afterwards. If
 * the comparison fails the error says so loudly, names the file and prints the
 * backup path, because a half restored credentials register is the one state
 * nobody should have to guess at.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CONFIG = "src/config/credentials.ts";
const READINESS = "src/config/launch-readiness.ts";

/** The account holder an audit sees. Unmistakable if it ever leaks into a page. */
export const FIXTURE_STRIPE_ACCOUNT = "AUDIT-FIXTURE-NOT-A-REAL-STRIPE-ACCOUNT";

/**
 * The telephone number an audit sees in the live state.
 *
 * THIS ONE CANNOT SAY WHAT IT IS, AND THE TENSION IS WORTH NAMING.
 *
 * Every other fixture value above spells out that it is a fixture, because
 * nothing validates their shape. This one has to satisfy the gate's phone
 * condition, which exists precisely to refuse numbers that are obviously not
 * numbers: 555, a repeated digit, the keypad in order, a zero exchange. A
 * self describing value would be refused by the thing it is meant to get past.
 *
 * So it is valid in shape and unmistakable in pattern: 254 254 2542, the firm's
 * own county count three times over. It cannot be confused for a number
 * somebody chose to publish, and if it is ever found in a rendered page, a
 * screenshot or a database row, a fixture leaked.
 *
 * It is NOT in src/config/credentials.ts and must not be. That register is the
 * list of credentials permitted to appear on the site, and this is the opposite
 * of that.
 */
export const FIXTURE_PHONE = "+12542542542";

/**
 * Environment a caller must pass to a SERVER it spawns for the live state.
 *
 * The file patches above reach anything that reads the source. FIRM_PHONE is an
 * environment variable read at module load, so a spawned `next dev` gets it
 * only if the caller passes it on. Exported as one object so a caller spreads
 * it rather than remembering which variables the gate has grown.
 *
 * LAUNCH_MODE is deliberately NOT in here. That is the operator's switch, and
 * an audit that forgets it should get prelaunch and find out.
 */
export const FIXTURE_ENV = { FIRM_PHONE: FIXTURE_PHONE };

/**
 * The number an audit sees in the live state.
 *
 * Obviously not a registration. It has to be shaped enough to render and
 * unmistakable enough that finding it in a rendered page, a database row or a
 * screenshot means a fixture leaked rather than that the firm has a second
 * registration.
 */
export const FIXTURE_FIRM_NUMBER = "AUDIT-FIXTURE-NOT-A-REAL-REGISTRATION";

/**
 * Run `fn` with the compliance gate's configuration conditions satisfied.
 *
 * The caller still has to set LAUNCH_MODE=live: that is the operator's switch
 * and this fixture deliberately does not touch it, so an audit that forgets it
 * gets prelaunch and finds out, rather than being handed the live state it did
 * not ask for.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withGateConditionsMet(fn) {
  /*
   * TWO FILES SINCE 2026-09-11, AND THE SECOND ONE IS WHY THIS IS A LOOP.
   *
   * The gate gained four more conditions and three of them live in
   * src/config/launch-readiness.ts. A fixture that went on patching only the
   * credentials register would leave the gate correctly shut and every live
   * half red, which is exactly what the board reported the hour those
   * conditions landed: retention-audit's two execute checks failed saying "the
   * gate did not open for the fixture".
   *
   * That is the fixture being wrong rather than the gate, and it is the third
   * time this shape has appeared here. So the patches are declared as a list
   * with an assertion each, rather than chained, because a chained replace that
   * silently matches nothing is how a fixture starts measuring the prelaunch
   * state while reporting on the live one.
   */
  const files = [CONFIG, READINESS];
  const originals = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));

  const patches = [
    /* --- the registration itself */
    { file: CONFIG, find: /number: "[^"]*",/, replace: `number: "${FIXTURE_FIRM_NUMBER}",`, what: "the registration number" },
    { file: CONFIG, find: /onRecord: false,/, replace: "onRecord: true,", what: "the operating name on the board's record" },
    /* Far enough out that a fixture cannot expire during a run. */
    { file: CONFIG, find: /expires: "[^"]*",/, replace: 'expires: "2099-12-31",', what: "the expiry" },

    /* --- the Stripe account, connected and proven */
    { file: READINESS, find: /connected: false,/, replace: "connected: true,", what: "the Stripe account being connected" },
    {
      file: READINESS,
      find: /accountName: null,/,
      replace: `accountName: "${FIXTURE_STRIPE_ACCOUNT}",`,
      what: "the Stripe account holder",
    },
    {
      file: READINESS,
      find: /proof: null,/,
      replace:
        `proof: { chargeId: "ch_AUDIT_FIXTURE", refundId: "re_AUDIT_FIXTURE", on: "2099-12-31", amountCents: 100 },`,
      what: "the charge and refund proof",
    },

    /* --- one approved protocol per service line */
    {
      file: READINESS,
      find: /export const approvedProtocols: ApprovedProtocol\[\] = \[\];/,
      replace: () => `export const approvedProtocols: ApprovedProtocol[] = ${JSON.stringify(fixtureProtocols(), null, 2)};`,
      what: "the approved protocol registry",
    },
  ];

  const patched = new Map(originals);
  for (const p of patches) {
    const before = patched.get(p.file);
    const after = before.replace(p.find, typeof p.replace === "function" ? p.replace() : p.replace);
    if (after === before) {
      throw new Error(
        `The gate fixture could not state ${p.what} true: its pattern matched nothing in ${p.file}. The ` +
          "shape has moved, and a fixture that edits nothing runs the live half of an audit against the " +
          "prelaunch state while reporting on the live one.",
      );
    }
    patched.set(p.file, after);
  }

  /*
   * The phone is an environment variable rather than a file, so it is set here
   * for anything running IN THIS PROCESS and exported as FIXTURE_ENV for
   * callers that spawn a server. Restored beside the files, including the
   * distinction between unset and set to empty, because those are different
   * states to a config module that trims.
   */
  const hadPhone = process.env.FIRM_PHONE;

  try {
    for (const f of files) writeFileSync(f, patched.get(f));
    process.env.FIRM_PHONE = FIXTURE_PHONE;
    return await fn();
  } finally {
    if (hadPhone === undefined) delete process.env.FIRM_PHONE;
    else process.env.FIRM_PHONE = hadPhone;
    /*
     * Every file is restored even if an earlier restore throws, because a
     * half restored pair is worse than either file being wrong on its own.
     */
    const unrestored = [];
    for (const f of files) {
      try {
        writeFileSync(f, originals.get(f));
        if (readFileSync(f, "utf8") !== originals.get(f)) unrestored.push(f);
      } catch {
        unrestored.push(f);
      }
    }
    if (unrestored.length > 0) {
      throw new Error(
        `THE GATE FIXTURE DID NOT RESTORE ${unrestored.join(" and ")}. They must be put back before anything ` +
          "builds, because they currently state the compliance gate's conditions true.",
      );
    }
  }
}

/**
 * One approved protocol per service line, built from the service list itself.
 *
 * Derived rather than listed: a hardcoded set of nine slugs would go stale the
 * first time a service line is added, and the failure would be a live half
 * silently measuring a gate that is still shut on one condition.
 *
 * The slugs are read out of the source rather than imported, because this file
 * is plain .mjs loaded by audits that must not pull the TypeScript module graph
 * in just to build a fixture.
 */
function fixtureProtocols() {
  const src = readFileSync("src/content/services.ts", "utf8");
  const slugs = [...src.matchAll(/^\s*slug: "([a-z0-9-]+)",/gm)].map((m) => m[1]);
  if (slugs.length < 2) {
    throw new Error(
      "The gate fixture found fewer than two service slugs in src/content/services.ts, so the protocol " +
        "condition would be stated true over an empty set and the gate would stay shut for a reason no " +
        "audit would name.",
    );
  }
  return slugs.map((serviceSlug) => ({
    serviceSlug,
    protocolName: "AUDIT FIXTURE NOT A REAL PROTOCOL",
    version: 1,
    approvedBy: "Audit Fixture",
    approvedByLicense: "AUDIT-FIXTURE",
    approvedOn: "2099-12-31",
  }));
}

/**
 * Run a snippet in a CHILD PROCESS while the gate's conditions are stated true.
 *
 * WHY A CHILD PROCESS AND NOT A FRESH import()
 * ---------------------------------------------
 * Because a fresh import is not fresh enough, and the first attempt at this
 * proved it. `import("../src/lib/ops-retention.ts?gate=open")` reloads
 * ops-retention and NOTHING BELOW IT: the query string busts one specifier, and
 * the `./launch` and `@/config/credentials` modules underneath keep the values
 * they were loaded with. The audit patched the file, re-imported, and read the
 * same shut gate it was failing on, which is worse than the failure because it
 * looks like a fix.
 *
 * This mattered only after the 2026-09-10 ruling. While the gate read
 * process.env at call time there was nothing to reload; a module level constant
 * is read once.
 *
 * A child process has no module graph to invalidate. It starts, reads the file
 * as it is on disk at that moment, answers, and exits.
 *
 * The snippet writes JSON to stdout on ONE line prefixed with GATE_RESULT, so
 * a warning from the runtime cannot be mistaken for the answer.
 *
 * @param {string} source  An ES module body. Call `answer(value)` to return.
 * @returns {Promise<unknown>}
 */
export async function inOpenGateProcess(source) {
  const { execFileSync } = await import("node:child_process");
  const { writeFileSync, unlinkSync } = await import("node:fs");
  const file = `.gate-child-${process.pid}.mjs`;

  const wrapped =
    `const answer = (v) => console.log("GATE_RESULT " + JSON.stringify(v));\n` +
    `process.env.LAUNCH_MODE = "live";\n` +
    source;

  return withGateConditionsMet(async () => {
    writeFileSync(file, wrapped);
    try {
      /*
       * node on tsx's own entry point, rather than npx.
       *
       * execFileSync("npx.cmd", ...) fails on Windows with EINVAL, because a
       * .cmd is a shell script and not an executable. shell: true would work
       * and would also mean the file name goes through a command line parser,
       * which is a quoting bug waiting for a path with a space in it. Calling
       * the same JavaScript node is already running is neither.
       */
      const tsxCli = fileURLToPath(import.meta.resolve("tsx/cli"));
      const stdout = execFileSync(
        process.execPath,
        [tsxCli, "--conditions=react-server", file],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
      const line = stdout.split("\n").find((l) => l.startsWith("GATE_RESULT "));
      if (!line) {
        throw new Error(`the child produced no GATE_RESULT line. It said: ${stdout.trim().slice(0, 300)}`);
      }
      return JSON.parse(line.slice("GATE_RESULT ".length));
    } finally {
      try {
        unlinkSync(file);
      } catch {
        /* Already gone. */
      }
    }
  });
}
