// Audit preflight. Wired as `pre<name>` for every audit that reads the shared
// server on 3225, so none of them can start against a server that predates the
// build on disk.
//
// A stale `next start` answers 200 on every route it knew about, which is
// precisely the check a crawl performs. So the audit passes, loudly, about an
// artifact nobody built. See scripts/lib/stale-server.mjs.
import { checkServingCurrentBuild } from "./lib/stale-server.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3225";
const label = (process.env.npm_lifecycle_event || "preaudit").replace(/^pre/, "");

const result = await checkServingCurrentBuild(BASE);

if (result.ok) {
  console.log(`preflight (${label}): ${result.message}`);
} else {
  console.error(`\n=== ${label.toUpperCase()} PREFLIGHT FAILED ===\n\n${result.message}`);
  // process.exitCode, not process.exit(): process.exit() here trips a libuv
  // assertion on Windows with the fetch socket still open.
  process.exitCode = 1;
}
