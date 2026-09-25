// Build preflight. Wired as `prebuild` in package.json, so it runs on every
// `npm run build` without anybody having to remember it, including builds
// invoked from other scripts. A guard you have to call by hand protects the runs
// you were already being careful about.
//
//   npm run build                      refuses if a server holds .next
//   AUDIT_KILL_STALE=1 npm run build   kills the holders first
//
// See scripts/lib/build-guard.mjs for what counts as a blocker and why this is
// not a two-line pkill.
import { assertClearToBuild } from "./lib/build-guard.mjs";
import { takeLock } from "./lib/machine-lock.mjs";

const kill = process.argv.includes("--kill") || process.env.AUDIT_KILL_STALE === "1";

/*
 * THE MACHINE LOCK, on every build, because a build is the thing that writes
 * `.next` underneath whatever is serving it. Operator ruling, 2026-09-24.
 *
 * A build invoked by the suite finds the lock already held by an ancestor and
 * proceeds immediately: the lock is re-entrant across a process tree, or this
 * hook would wait for its own parent for ever. A build somebody types waits
 * for the other project properly.
 */
await takeLock({
  project: "254engineering",
  label: "build",
  onWait: (held) =>
    console.log(
      held.reaped
        ? `[lock] ${held.project} (pid ${held.pid}) is gone. Reaping its lock and proceeding.`
        : `[lock] waiting for ${held.project} (pid ${held.pid}, ${held.label}, started ${held.since}). Re-checking every 60s.`,
    ),
});

try {
  const { skipped, killed } = assertClearToBuild({ kill, label: "build" });
  if (skipped) console.log("[build-guard] CI or deploy environment, skipped.");
  else if (killed) console.log("[build-guard] cleared stale server(s), proceeding.");
  else console.log("[build-guard] nothing holding .next, proceeding.");
} catch (err) {
  console.error(err.message);
  // process.exitCode, not process.exit(): the same libuv assertion that bites
  // the audit scripts on Windows is not worth re-litigating here.
  process.exitCode = 1;
}
