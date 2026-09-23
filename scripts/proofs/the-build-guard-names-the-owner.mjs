/*
 * ===========================================================================
 * THE GUARD NAMES WHAT OWNS A STRAY SERVER, NOT JUST THE SERVER.
 * Operator ruling, 2026-09-23.
 * ===========================================================================
 *
 * WHAT THIS EXISTS TO STOP HAPPENING AGAIN. On 2026-09-22 a board stopped after
 * 32 of 58 audits with its server gone. The cause, established the next night:
 * an orphaned `launch-audit` was alive and starting a fresh server every time
 * one died.
 *
 * THE ORPHAN WAS MADE BY FOLLOWING THE GUARD'S OWN ADVICE. It printed
 * `taskkill /PID <server> /T /F`. `/T` kills a process's CHILDREN, not its
 * PARENT, so tree-killing the server left the audit that owned it running, and
 * `launch-audit` starts three servers one after another. Windows said so in its
 * own output at the time: "SUCCESS: The process with PID 31996 (child process
 * of PID 34400) has been terminated." That parent was never killed.
 *
 * So the guard reported a symptom and printed the command that reproduces it.
 *
 * WHY A PROOF RATHER THAN AN AUDIT CHECK. The live half needs a process table
 * with a real parent chain in it, and manufacturing one would mean spawning
 * servers, which is the thing this guard exists to complain about. So ownership
 * is a pure function over a command line and this feeds it chains.
 *
 * EVERY FIXTURE IS A REAL COMMAND LINE, taken from the Windows process table on
 * 2026-09-22 and 2026-09-23 while the orphan was being traced, rather than
 * invented to match the rule.
 */

const ROOT = new URL("../..", import.meta.url).href.replace(/\/$/, "");
const { classifyOwnerCandidate } = await import(ROOT + "/scripts/lib/build-guard.mjs");

const NEEDLE = "c:/users/salon/projects/254engineering";

const CASES = [
  {
    name: "an audit that spawned the server IS the owner",
    command: '"C:\\Program Files\\nodejs\\node.exe" scripts/launch-audit.mjs',
    expect: true,
    why: "THE REAL ONE. This is what sat above the server that respawned three times on 2026-09-23",
  },
  {
    name: "a shell wrapping that audit is NOT the owner",
    command: 'C:\\windows\\system32\\cmd.exe /d /s /c node scripts/launch-audit.mjs',
    expect: false,
    why: "killing cmd.exe leaves the node process it wrapped, which is the same mistake one level up",
  },
  {
    name: "a next server started RELATIVELY is not an owner",
    command: '"C:\\Program Files\\nodejs\\node.exe" node_modules/next/dist/bin/next start -p 3141',
    expect: false,
    why: "naming a server as its own owner would send somebody round in a circle",
  },
  {
    /*
     * THIS FIXTURE EXISTS BECAUSE AN INJECTION PASSED.
     *
     * Removing the next-server exclusion from the classifier left every case
     * green, which means the clause was load bearing for nothing and the proof
     * was not testing it. The case above returns false for a DIFFERENT reason:
     * a relative invocation names no scripts/ entry and does not contain the
     * repository root, so it fails the last test anyway.
     *
     * An ABSOLUTE next server inside this checkout is the shape that needs the
     * exclusion: it contains the repo root, so without that clause it would be
     * named as the owner of itself.
     */
    name: "a next server at an ABSOLUTE path in this checkout is still not an owner",
    command:
      '"C:\\Program Files\\nodejs\\node.exe" "C:\\Users\\salon\\projects\\254engineering\\node_modules\\next\\dist\\bin\\next" start -p 3225',
    expect: false,
    why: "it contains the repository root, so only the next-server exclusion keeps it out. The injection that proved this clause fails here and nowhere else",
  },
  {
    name: "npm itself is NOT named as an owner, because it names no scripts file",
    command:
      '"C:\\Program Files\\nodejs\\node.exe" "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js" run launch-audit',
    expect: false,
    why: "npm-cli.js is not under the repo root and names no scripts/ entry, so it is left alone rather than guessed at",
  },
  {
    name: "a scripts file in ANOTHER checkout IS named, which is a known limit",
    command: '"C:\\Program Files\\nodejs\\node.exe" C:\\some\\other\\project\\scripts\\thing.mjs',
    expect: true,
    why: "recorded rather than pretended away: the guard refuses and prints a pid for a person, it kills nothing, so naming one too many costs a glance and naming one too few cost a board",
  },
  {
    name: "an unreadable command line is not an owner",
    command: "",
    expect: false,
    why: "commandLineOf returns empty when a process cannot be read, and unreadable is not ownership",
  },
];

let failures = 0;
const rec = (ok, label, note) => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}${note ? ` (${note})` : ""}`);
};

export function checkOwnerClassification(loud = false) {
  const failed = [];
  let total = 0;
  const say = (line) => {
    if (loud) console.log(line);
  };
  const r = (name, ok, note = "") => {
    total += 1;
    if (!ok) failed.push(name);
    say(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
  };

  for (const c of CASES) {
    const got = classifyOwnerCandidate(c.command, NEEDLE);
    r(c.name, got === c.expect, got === c.expect ? c.why : `expected ${c.expect}, got ${got}`);
  }

  /*
   * VACUITY GUARD. A function answering false to everything satisfies four of
   * the six, and one answering true to everything satisfies two. Neither is a
   * working classifier, so the count of distinct answers is asserted.
   */
  const answers = new Set(CASES.map((c) => classifyOwnerCandidate(c.command, NEEDLE)));
  r(
    "the classifier distinguishes owners from non owners",
    answers.size === 2,
    `${answers.size} distinct answer(s); one answer for everything would name every parent or none`,
  );

  return { failed, total };
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`) {
  console.log("Classifying parent command lines taken from a real process table.\n");
  const { failed, total } = checkOwnerClassification(true);
  console.log("");
  console.log(failed.length === 0 ? `All ${total} checks correct.` : `FAIL: ${failed.length} of ${total}.`);
  process.exit(failed.length === 0 ? 0 : 1);
}
