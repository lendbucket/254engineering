/**
 * SELF SERVICE SIGN UP NEEDS THE GATE, NOT ONLY ITS OWN FLAG.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/sign-up-needs-the-gate.mjs
 *
 * WHAT IT PROVES. `selfServiceSignUpOpen()` read `selfServiceSignUp.cleared`
 * and nothing else. That flag is one of the nine launch conditions and says
 * "public sign up is ready to reach production", not "the firm is open". So
 * clearing it, which a reasonable person would do EARLY because clearing it is
 * preparation rather than a commitment, would have put public sign up live on a
 * firm that is not taking orders.
 *
 * THE THREE CASES, AND THE SECOND IS WHY THERE ARE THREE. A function that
 * simply returned false would satisfy the first and third and be useless, which
 * is the fixture rule: a check that cannot separate the two answers proves
 * neither.
 *
 *   gate SHUT, flag cleared    false   the regression this prevents
 *   gate OPEN, flag cleared    true    so it is not constant false
 *   gate OPEN, flag NOT cleared false  the flag still has to be set
 *
 * WHY EVERY CASE IS A CHILD PROCESS. `selfServiceSignUp` is read at module
 * load, so a patch on disk cannot reach a module this process has already
 * imported. A fresh import() is not fresh enough: a query string busts one
 * specifier and everything beneath it keeps the values it was loaded with. A
 * child process has no module graph to invalidate.
 *
 * IT PATCHES AND RESTORES BY COPY, and verifies the restore, because a restore
 * reads identically whether it happened or not.
 */

import { readFileSync, writeFileSync, copyFileSync, unlinkSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { inOpenGateProcess } from "../lib/gate-fixture.mjs";

const CONDITIONS = "src/config/launch-conditions.ts";
const BACKUP = `.sign-up-proof-backup-${process.pid}.ts`;
const TSX = "node_modules/tsx/dist/cli.mjs";

const out = [];
const rec = (name, ok, note = "") => {
  out.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

/** Run one expression in a child that reads the files as they are on disk now. */
function inChild(expression) {
  const file = `.sign-up-proof-child-${process.pid}.mjs`;
  writeFileSync(
    file,
    `const { selfServiceSignUpOpen, launchMode } = await import("./src/lib/launch.ts");\n` +
      `console.log("RESULT " + JSON.stringify({ open: selfServiceSignUpOpen(), mode: launchMode() }));\n`,
  );
  try {
    const stdout = execFileSync(process.execPath, [TSX, file], {
      encoding: "utf8",
      stdio: "pipe",
      env: { ...process.env },
    });
    const line = stdout.split("\n").find((l) => l.startsWith("RESULT "));
    if (!line) throw new Error(`the child printed no RESULT line: ${stdout.slice(0, 200)}`);
    return JSON.parse(line.slice("RESULT ".length));
  } finally {
    if (existsSync(file)) unlinkSync(file);
  }
}

console.log("");
console.log("========== SIGN UP NEEDS THE GATE ==========");
console.log("");

copyFileSync(CONDITIONS, BACKUP);

try {
  /* ---------------------------------- case one: gate shut, flag cleared */
  /*
   * SET THE STATE, RATHER THAN REQUIRE AN EDIT. Corrected 2026-09-28, the day
   * the operator cleared self service sign up for launch.
   *
   * This replaced `cleared: false` with `cleared: true` and threw when the
   * replacement changed nothing, which is the right assertion when the point is
   * to MOVE the world off its current state. It is the wrong assertion when the
   * point is to GUARANTEE a state: the flag being already true is exactly the
   * world this case wants, and the proof read that as "the shape has moved" and
   * died, taking the whole of proofs-audit red with it.
   *
   * It is the third time this shape has cost a board in a week. The insurance
   * proof drew the same distinction for its registers and named the two helpers
   * `patch` and `ensure` for it; the gate fixture needed an `already` clause for
   * this very condition the same afternoon.
   *
   * THE ASSERTION THAT MATTERS IS THAT THE DECLARATION IS STILL THERE. A file
   * with no `cleared:` line at all would mean the condition was renamed or
   * removed, and this proof would then be running against a world it cannot
   * describe. That still throws.
   */
  const original = readFileSync(CONDITIONS, "utf8");
  if (!/\n\s*cleared: (?:true|false),/.test(original)) {
    throw new Error(
      "the proof could not find a `cleared:` declaration in " +
        CONDITIONS +
        ". The condition was renamed or removed, and a proof that cannot state its own world proves nothing.",
    );
  }
  writeFileSync(CONDITIONS, original.replace(/\n(\s*)cleared: false,/, "\n$1cleared: true,"));

  const shut = inChild();
  rec(
    "with the gate SHUT and the flag cleared, sign up is closed",
    shut.open === false,
    `mode ${shut.mode}, selfServiceSignUpOpen ${shut.open}. Before this change it returned true here.`,
  );
  rec(
    "and the gate really was shut, so the case above is the case it claims",
    shut.mode !== "open",
    `mode ${shut.mode}`,
  );

  writeFileSync(CONDITIONS, original);

  /* ------------------------------- case two: gate open, flag cleared */
  const openResult = await inOpenGateProcess(
    `const { selfServiceSignUpOpen, launchMode } = await import("./src/lib/launch.ts");\n` +
      `answer({ open: selfServiceSignUpOpen(), mode: launchMode() });\n`,
  );
  rec(
    "with the gate OPEN and the flag cleared, sign up is open",
    openResult.open === true,
    `mode ${openResult.mode}, selfServiceSignUpOpen ${openResult.open}. Without this, a function returning constant false would pass.`,
  );
  rec(
    "and the gate really was open",
    openResult.mode === "open",
    `mode ${openResult.mode}`,
  );
} finally {
  copyFileSync(BACKUP, CONDITIONS);
  const restored = readFileSync(CONDITIONS, "utf8");
  const backup = readFileSync(BACKUP, "utf8");
  if (restored !== backup) {
    console.log("FAIL  the file was NOT restored. Restore it by hand from " + BACKUP);
    process.exitCode = 1;
  } else {
    console.log("");
    console.log("restored byte identical");
    unlinkSync(BACKUP);
  }
}

console.log("");
const failed = out.filter((r) => !r.ok);
if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exitCode = 1;
} else {
  console.log(`All ${out.length} checks correct.`);
}
