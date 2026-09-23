/*
 * ===========================================================================
 * THE BUILD GUARD KNOWS WHOSE SERVER IT IS, AND SAYS SO WHEN IT CANNOT TELL.
 * Operator ruling, 2026-09-22.
 * ===========================================================================
 *
 * WHAT THIS EXISTS TO STOP HAPPENING AGAIN. On 2026-09-22 a board printed
 *
 *     [build-guard] nothing holding .next, proceeding.
 *
 * while a next server started out of this repository had been alive for
 * eighteen minutes. It killed the suite's own server partway through and the
 * board stopped after 32 of 58 audits with THE SUITE DID NOT RUN TO COMPLETION.
 * Nothing in this repository tested the guard, so the defect had no way of
 * being found except by a board dying.
 *
 * WHY A PROOF RATHER THAN AN AUDIT CHECK. The live half needs a process table,
 * and a fixture that proves it would have to SPAWN a server on a port, which is
 * the exact thing this guard exists to complain about. So the classification is
 * a pure function and this feeds it command lines.
 *
 * EVERY FIXTURE IS A REAL COMMAND LINE. Copied from the Windows process table
 * on 2026-09-22 rather than invented to match the rule, which is the difference
 * between proving the rule and proving the fixture. The bash wrapper case was
 * discovered by an injection rather than by design: widening the guard to
 * report unknown ownership immediately named three shells, and a check that
 * cries wolf gets switched off within a week.
 *
 * IT IS IMPORTED BY `db-guard-audit` SO THE BOARD RUNS IT, and that is the
 * point rather than a detail. Proofs in this directory are not enumerated and
 * not listed: one reaches the board only because an audit imports it. On
 * 2026-09-22 six proofs here were reached by NOTHING and never ran on any
 * board, which is recorded at the top of BACKLOG.md as the first item for the
 * following day. A proof nobody runs is a file, not a check.
 */

const ROOT = new URL("../..", import.meta.url).href.replace(/\/$/, "");
const { classifyNextProcess } = await import(ROOT + "/scripts/lib/build-guard.mjs");

/* The repository root as the guard computes it: lowercased, forward slashes. */
const NEEDLE = "c:/users/salon/projects/254engineering";

const CASES = [
  {
    name: "a next server at an absolute path inside THIS checkout is ours",
    command:
      '"node" "C:\\Users\\salon\\projects\\254engineering\\node_modules\\.bin\\..\\next\\dist\\bin\\next" start -p 3225',
    expect: "ours",
    why: "the shape a hand started server has. It was always caught, which is why the guard looked sound",
  },
  {
    name: "a next server at an absolute path in a DIFFERENT checkout is foreign",
    command: '"node" "C:\\Users\\salon\\projects\\some-other-app\\node_modules\\next\\dist\\bin\\next" dev -p 3000',
    expect: "foreign",
    why: "a next dev in another repository cannot touch this .next, and a guard that cries wolf gets switched off",
  },
  {
    name: "a next server started by a RELATIVE path is unknown, not dismissed",
    command: '"C:\\Program Files\\nodejs\\node.exe" node_modules/next/dist/bin/next start -p 3141',
    expect: "unknown",
    why: "THE SHAPE THAT GOT THROUGH on 2026-09-22 and cost a board 26 audits",
  },
  {
    name: "a shell whose command line CONTAINS a next start is not a server",
    command:
      '"C:\\Program Files\\Git\\bin\\bash.exe" -c "cd /c/repo && node node_modules/next/dist/bin/next start -p 3141"',
    expect: null,
    why: "the false positive the first version of the fix produced three of. A shell is not a server, and its command line contains the server's",
  },
  {
    name: "npm running an audit is node and is not a next server",
    command:
      '"C:\\Program Files\\nodejs\\node.exe" "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js" run launch-audit',
    expect: null,
    why: "reporting this would name a process on every run",
  },
  {
    name: "next dev counts as well as next start",
    command: '"C:\\Program Files\\nodejs\\node.exe" node_modules/next/dist/bin/next dev -p 3228',
    expect: "unknown",
    why: "dev writes .next as surely as start serves it, so both verbs are in scope",
  },
];

/**
 * Exercise the classifier. Returns `{ failed, total }` the way the perf proof
 * does, so an audit can fold the result into its own tally rather than parsing
 * output.
 */
export function checkBuildGuardClassification(loud = false) {
  const failed = [];
  let total = 0;
  const say = (line) => {
    if (loud) console.log(line);
  };
  const rec = (name, ok, note = "") => {
    total += 1;
    if (!ok) failed.push(name);
    say(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
  };

  for (const c of CASES) {
    const got = classifyNextProcess(c.command, NEEDLE);
    rec(
      c.name,
      got === c.expect,
      got === c.expect ? c.why : `got ${got === null ? "not a next server" : got}`,
    );
  }

  /*
   * VACUITY GUARDS. A classifier answering null to everything satisfies two of
   * the six cases, and one answering "unknown" to everything satisfies two
   * others. Neither is a working guard. Asserted explicitly so a future edit
   * that collapses the answers cannot pass quietly on a subset.
   */
  const answers = new Set(CASES.map((c) => classifyNextProcess(c.command, NEEDLE)));
  rec(
    "the classifier distinguishes at least three outcomes",
    answers.size >= 3,
    `${answers.size} distinct answer(s); one answer for everything would name every process or none`,
  );

  rec(
    "an unreadable command line is not a next server",
    classifyNextProcess("", NEEDLE) === null && classifyNextProcess("   ", NEEDLE) === null,
    "commandLineOf() returns empty when a process cannot be read",
  );

  return { failed, total };
}

/* Runnable on its own, which is how it is injection-verified during a change. */
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`) {
  console.log("Classifying command lines taken from a real process table.\n");
  const { failed, total } = checkBuildGuardClassification(true);
  console.log("");
  console.log(failed.length === 0 ? `All ${total} checks correct.` : `FAIL: ${failed.length} of ${total}.`);
  process.exit(failed.length === 0 ? 0 : 1);
}
