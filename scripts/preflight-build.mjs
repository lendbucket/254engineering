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

const kill = process.argv.includes("--kill") || process.env.AUDIT_KILL_STALE === "1";

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
