/**
 * PROOF: A STANDALONE AUDIT TAKES THE MACHINE LOCK, AND UNDER THE BOARD IT
 * DOES NOT WAIT FOR ITS OWN PARENT.
 *
 * Robert's answer 1 of 2026-11-13, closing the BACKLOG entry "A standalone
 * audit takes no machine lock". Every `*-audit` script in package.json runs as
 * `node scripts/run-audit.mjs <its own command>`.
 *
 *   A  every audit script in package.json runs through the wrapper, and the
 *      file it wraps exists
 *   B  audit-runtime still judges each audit by the AUDIT's file, not the
 *      wrapper's, so a react-server audit without the flag is still caught
 *   C  run alone, the wrapper holds the lock while the command runs, names
 *      itself in it, passes the command's exit code through (3 stays 3), and
 *      removes the lock when the command ends
 *   D  a lock held by a LIVE other project makes the wrapper WAIT, and the
 *      other project's lock is untouched
 *   E  under a live holder whose pid it inherits (the board), it runs at once
 *      and leaves the holder's lock alone
 *
 * B IS THE ONE A REWRITE WOULD BREAK SILENTLY. `invocationProblems` took the
 * first `scripts/*.mjs` in each command, which is now the wrapper, which
 * imports nothing server-only: every audit would have been judged by it and
 * every audit would have passed.
 *
 * THE LOCK PATH IS REAL, so the real file is moved aside first and restored
 * byte identical in a finally, exactly as the-machine-lock-holds-and-reaps
 * does, and for the same reason this proof never runs while ANOTHER project
 * holds the machine.
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync, copyFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { LOCK_PATH, readLock } from "../lib/machine-lock.mjs";
import { auditScriptOf, invocationProblems } from "../lib/audit-runtime.mjs";

let wrong = 0;
const check = (name, ok, note) => {
  if (!ok) wrong += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
};

{
  const held = existsSync(LOCK_PATH) ? readLock() : null;
  if (held && held.project !== "254engineering" && held.pid && alive(held.pid)) {
    console.log(`COULD NOT TELL: ${held.project} (pid ${held.pid}) holds the machine lock, and this proof never moves another project's lock. Run it when the machine is free.`);
    process.exit(0);
  }
}

// ------------------------------------------------ A: every audit is wrapped

const WRAP = "node scripts/run-audit.mjs ";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const audits = Object.entries(pkg.scripts).filter(([n]) => /audit/.test(n) && !n.startsWith("pre") && n !== "audit");
const unwrapped = audits.filter(([, c]) => !c.startsWith(WRAP)).map(([n]) => n);
check("A: there are audit scripts to judge", audits.length >= 60, `${audits.length} found; fewer than 60 means the filter matched the wrong thing`);
check("A: every audit script runs through the lock wrapper", unwrapped.length === 0, unwrapped.length ? `unwrapped: ${unwrapped.join(", ")}` : `${audits.length} of ${audits.length}`);
const missing = audits.filter(([, c]) => {
  const f = auditScriptOf(c);
  return !f || !existsSync(f);
});
check("A: and each wraps an audit file that exists", missing.length === 0, missing.length ? missing.map(([n]) => n).join(", ") : "");
check("A: the wrapper itself exists", existsSync("scripts/run-audit.mjs"), "");

// ------------------------------- B: audit-runtime reads past the wrapper

check(
  "B: the audit's file is read past the wrapper",
  auditScriptOf("node scripts/run-audit.mjs tsx --conditions=react-server scripts/x-audit.mjs") === "scripts/x-audit.mjs",
  String(auditScriptOf("node scripts/run-audit.mjs tsx --conditions=react-server scripts/x-audit.mjs")),
);
check("B: and an unwrapped command still reads its own file", auditScriptOf("tsx scripts/y-audit.mjs") === "scripts/y-audit.mjs", "");
check("B: and the wrapper alone names no audit", auditScriptOf("node scripts/run-audit.mjs") === undefined, "");
const problems = invocationProblems();
check("B: every wrapped audit agrees with its runtime", problems.length === 0, problems.join(" | "));

// ------------------------------------------------- C, D, E: the real lock

/* A child that takes the lock for real: no CI marker, no inherited holder. */
const childEnv = (extra = {}) => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !["CI", "GITHUB_ACTIONS", "VERCEL", "MACHINE_LOCK_HELD"].includes(k)),
  );
  return { ...env, ...extra };
};

/*
 * The probe finds the lock the way machine-lock.mjs does, from the home
 * directory, rather than being handed the path in an environment variable
 * nothing declares. Asserted first, so a moved lock is a red here rather than a
 * probe reading a file nobody writes.
 */
check("the lock is where the probe looks for it", LOCK_PATH === join(homedir(), ".test-lock"), LOCK_PATH);

/* The command the wrapper runs: print the lock as it stands, then exit 3. */
/* `node` by name, as every package.json command spells it, so no install path with a space is quoted. */
const PROBE = [
  "node",
  "-e",
  "const f=require('fs');let l=null;try{l=JSON.parse(f.readFileSync(require('path').join(require('os').homedir(),'.test-lock'),'utf8'))}catch(e){};console.log('LOCK '+(l?l.project+' '+l.pid+' '+l.label:'none'));process.exit(3)",
];

function wrapper(env) {
  const p = spawn(process.execPath, ["scripts/run-audit.mjs", ...PROBE], { stdio: ["ignore", "pipe", "pipe"], env });
  const run = { p, out: "", code: undefined };
  p.stdout.on("data", (d) => (run.out += String(d)));
  p.stderr.on("data", (d) => (run.out += String(d)));
  run.done = new Promise((r) => p.on("exit", (code) => r((run.code = code))));
  return run;
}

function sleeper() {
  return spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
}

const ASIDE = `${LOCK_PATH}.run-audit-proof-aside`;
const hadReal = existsSync(LOCK_PATH);
if (hadReal) copyFileSync(LOCK_PATH, ASIDE);
const clean = () => {
  try {
    if (existsSync(LOCK_PATH)) unlinkSync(LOCK_PATH);
  } catch {}
};

let held = null;
try {
  // ------------------------------------------------------- C: run alone
  clean();
  const c = wrapper(childEnv());
  await c.done;
  const line = c.out.split("\n").find((l) => l.startsWith("LOCK ")) ?? "";
  check(
    "C: run alone, the wrapper holds the lock while the command runs",
    line.startsWith(`LOCK 254engineering ${c.p.pid} standalone `),
    line.trim() || c.out.trim().slice(0, 200),
  );
  check("C: and the command's exit code passes through", c.code === 3, `exit ${c.code}`);
  check("C: and the lock is gone when it ends", !existsSync(LOCK_PATH), existsSync(LOCK_PATH) ? JSON.stringify(readLock()) : "");

  // ------------------------------------- D: a live other project holds it
  held = sleeper();
  const other = JSON.stringify({ project: "other-project", pid: held.pid, label: "a board", startedAt: new Date().toISOString() });
  writeFileSync(LOCK_PATH, other);
  const d = wrapper(childEnv());
  await new Promise((r) => setTimeout(r, 2500));
  check(
    "D: a lock held by a live other project makes the wrapper wait",
    !d.out.includes("LOCK ") && d.code === undefined && /waiting/.test(d.out),
    d.out.trim().slice(0, 200) || "no output",
  );
  d.p.kill();
  await d.done;
  check("D: and the other project's lock is untouched", existsSync(LOCK_PATH) && readFileSync(LOCK_PATH, "utf8") === other, "");
  held.kill();
  held = null;
  clean();

  // ------------------------------------ E: under the board, re-entrant
  held = sleeper();
  const board = JSON.stringify({ project: "254engineering", pid: held.pid, label: "the board", startedAt: new Date().toISOString() });
  writeFileSync(LOCK_PATH, board);
  const began = Date.now();
  const e = wrapper(childEnv({ MACHINE_LOCK_HELD: String(held.pid) }));
  await Promise.race([e.done, new Promise((r) => setTimeout(r, 10000))]);
  const eLine = e.out.split("\n").find((l) => l.startsWith("LOCK ")) ?? "";
  check(
    "E: under a live holder it inherits, the wrapper runs at once",
    e.code === 3 && eLine.startsWith(`LOCK 254engineering ${held.pid} the board`) && Date.now() - began < 10000,
    `${Date.now() - began}ms, ${eLine.trim() || "no LOCK line"}`,
  );
  if (e.code === undefined) e.p.kill();
  check("E: and leaves the holder's lock in place", existsSync(LOCK_PATH) && readFileSync(LOCK_PATH, "utf8") === board, "");
  held.kill();
  held = null;
} finally {
  if (held) held.kill();
  clean();
  if (hadReal) {
    copyFileSync(ASIDE, LOCK_PATH);
    unlinkSync(ASIDE);
    console.log("the real lock is back where it was");
  }
}

if (wrong) {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exit(1);
}
console.log("PASS: a standalone audit takes the machine lock, and under the board it does not wait for its own parent.");
