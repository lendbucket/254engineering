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
  const original = readFileSync(CONFIG, "utf8");

  let patched = original
    .replace(
      /number: "[^"]*",/,
      `number: "${FIXTURE_FIRM_NUMBER}",`,
    )
    .replace(/onRecord: false,/, "onRecord: true,")
    /* Far enough out that a fixture cannot expire during a run. */
    .replace(/expires: "[^"]*",/, 'expires: "2099-12-31",');

  if (patched === original) {
    throw new Error(
      `${CONFIG} did not change when the gate fixture patched it. The register's shape has moved and this ` +
        "fixture is now editing nothing, which would run the live half of an audit against the prelaunch state.",
    );
  }
  if (!patched.includes("onRecord: true")) {
    throw new Error(`${CONFIG} still says onRecord: false after patching, so the gate would stay shut.`);
  }

  try {
    writeFileSync(CONFIG, patched);
    return await fn();
  } finally {
    writeFileSync(CONFIG, original);
    const after = readFileSync(CONFIG, "utf8");
    if (after !== original) {
      throw new Error(
        `THE CREDENTIALS REGISTER WAS NOT RESTORED. ${CONFIG} differs from what this run found. It must be ` +
          "put back before anything builds, because it currently carries a fixture registration number.",
      );
    }
  }
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
