#!/usr/bin/env node
/**
 * A STANDALONE AUDIT TAKES THE MACHINE LOCK. Robert's answer 1 of 2026-11-13,
 * closing the BACKLOG entry "A standalone audit takes no machine lock".
 *
 * Every `*-audit` script in package.json runs through this file:
 *
 *     node scripts/run-audit.mjs <the audit's own command>
 *
 * It takes the machine lock, runs the command exactly as it was written, and
 * exits with the command's own code, so a COULD NOT TELL exit of 3 stays 3.
 *
 * WHY A WRAPPER AND NOT THE `pre<audit>` HOOK, which is what the BACKLOG entry
 * first proposed. npm runs the pre hook as its own process and the lock is
 * released when the process that took it exits, so a lock taken there is gone
 * before the audit itself starts. The lock has to be held by a process that
 * lives exactly as long as the audit does, and that is this one.
 *
 * UNDER THE BOARD IT IS A NO-OP. `scripts/audit.mjs` takes the lock and hands
 * every audit `MACHINE_LOCK_HELD` naming its own pid, and `takeLock` lets a
 * descendant of a live holder through without waiting and without releasing.
 * In CI and on a builder `takeLock` returns at once, because there is no
 * shared machine there to coordinate with.
 *
 * The command is passed to a shell as ONE string, because that is how npm ran
 * it before: `tsx --conditions=react-server scripts/x-audit.mjs` and
 * `node scripts/perf-audit.mjs --all` must behave exactly as they did. Extra
 * arguments given to `npm run x-audit -- ...` arrive after it and are appended.
 *
 * Proved by scripts/proofs/a-standalone-audit-takes-the-lock.mjs.
 */
import { spawn } from "node:child_process";
import { takeLock } from "./lib/machine-lock.mjs";

const parts = process.argv.slice(2);
if (parts.length === 0) {
  console.error("run-audit: no command given. Usage: node scripts/run-audit.mjs <command>");
  process.exit(2);
}

/* Quote anything a shell would split or expand, so an argument survives as given. */
const quote = (s) => (/^[\w./:=@%+,-]+$/.test(s) ? s : `"${s.replace(/(["$`\\])/g, "\\$1")}"`);
const command = parts.map(quote).join(" ");

const release = await takeLock({
  project: "254engineering",
  label: `standalone ${command}`,
  onWait: (held) =>
    console.log(
      held.reaped
        ? `run-audit: removed a lock left by dead pid ${held.pid} (${held.project})`
        : `run-audit: the machine lock is held by ${held.project} (pid ${held.pid}, ${held.label}); waiting`,
    ),
});

const child = spawn(command, { shell: true, stdio: "inherit", env: process.env });

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    try {
      child.kill(sig);
    } catch {}
  });
}

child.on("error", (err) => {
  console.error(`run-audit: could not start "${command}": ${err.message}`);
  release();
  process.exit(2);
});

child.on("exit", (code, signal) => {
  release();
  process.exit(code ?? (signal ? 1 : 0));
});
