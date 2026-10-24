/**
 * EACH CLOUD BOARD RUN HAS ITS OWN SIGN IN BUCKET ON DEVELOPMENT, AND
 * PRODUCTION IGNORES THE HEADER THAT GIVES IT ONE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/each-board-run-has-its-own-sign-in-bucket.mjs
 *
 * Robert's ruling of 2026-10-23: CI runners share one "unknown" bucket because
 * they send no x-forwarded-for; do not loosen the limiter; give each board run
 * its own key, a header the board sets from its run id that the limiter honours
 * only on development; prove that production ignores it.
 *
 * The real clientKey is called with each database. The real preload is run in
 * a child process against a local server that records the headers it receives.
 * board.yml is read for the wiring.
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { clientKey, BOARD_RUN_HEADER } = await import("../../src/lib/ops-rate-limit.ts");
const { PRODUCTION_REF, DEVELOPMENT_REF } = await import("../../src/lib/db-guard.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const PROD = { SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co` };
const DEV = { SUPABASE_URL: `https://${DEVELOPMENT_REF}.supabase.co` };
const h = (o) => new Headers(o);

check("on development, a board run's header is its own bucket", clientKey(h({ [BOARD_RUN_HEADER]: "40065536871" }), DEV) === "board:40065536871");
check("on production, the same header is ignored and the key is what it always was", clientKey(h({ [BOARD_RUN_HEADER]: "40065536871" }), PROD) === "unknown");
check(
  "on production, with a forwarded address, the address is still the key",
  clientKey(h({ [BOARD_RUN_HEADER]: "40065536871", "x-forwarded-for": "203.0.113.9, 10.0.0.1" }), PROD) === "203.0.113.9",
);
check("with no database named, the header is ignored", clientKey(h({ [BOARD_RUN_HEADER]: "40065536871" }), {}) === "unknown");
check("on development, a value that is not a run id is ignored", clientKey(h({ [BOARD_RUN_HEADER]: "everyone-shares-this" }), DEV) === "unknown");
check("and with no header, development keys exactly as before", clientKey(h({ "x-forwarded-for": "198.51.100.4" }), DEV) === "198.51.100.4");

/* The preload, in a child process, against a local server. */
const seen = [];
const server = createServer((req, res) => {
  seen.push(req.headers[BOARD_RUN_HEADER] ?? null);
  res.end("ok");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const dir = mkdtempSync(join(tmpdir(), "board-run-"));
const child = join(dir, "child.mjs");
writeFileSync(child, `await fetch("http://127.0.0.1:${port}/a"); await fetch("http://localhost:${port}/b", { headers: { "x-other": "1" } }); console.log("done");`);
const preload = new URL("../ci/board-run-header.mjs", import.meta.url).href;
/* Asynchronous, so this process's server can answer the child while it waits. */
const run = (env) =>
  new Promise((resolve) => {
    const p = spawn(process.execPath, ["--import", preload, child], { env: { ...process.env, ...env }, stdio: "ignore" });
    const timer = setTimeout(() => p.kill(), 30_000);
    p.on("exit", (status) => {
      clearTimeout(timer);
      resolve({ status });
    });
  });
const withRun = await run({ BOARD_RUN_ID: "40065536871" });
check("the preload sends the run id on every request to this machine", withRun.status === 0 && seen.length === 2 && seen.every((v) => v === "40065536871"), JSON.stringify(seen));
seen.length = 0;
await run({ BOARD_RUN_ID: "" });
check("and sends nothing when no run id is set", seen.length === 2 && seen.every((v) => v === null), JSON.stringify(seen));
server.close();
const pre = readFileSync("scripts/ci/board-run-header.mjs", "utf8");
check("it touches only requests to this machine", /hostname === "localhost" \|\| hostname === "127\.0\.0\.1"/.test(pre) && /if \(!url \|\| !local\(url\)\) return original\(input, init\);/.test(pre));

/* The wiring. */
const yml = readFileSync(".github/workflows/board.yml", "utf8");
check(
  "the board sets the run id and loads the preload into every process of the shard",
  /BOARD_RUN_ID="\$\{\{ github\.run_id \}\}" NODE_OPTIONS="--import \$\{\{ github\.workspace \}\}\/scripts\/ci\/board-run-header\.mjs"/.test(yml),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: each board run has its own sign in bucket on development, and production ignores the header.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
