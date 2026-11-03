/**
 * EACH CLOUD BOARD RUN HAS ITS OWN SIGN IN BUCKET ON DEVELOPMENT, NO REQUEST
 * CAN CHOOSE A KEY, AND PRODUCTION IGNORES THE VARIABLE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/each-board-run-has-its-own-sign-in-bucket.mjs
 *
 * Robert's rulings of 2026-10-23 and 2026-10-24 (ruling 5): CI runners share
 * one "unknown" bucket because they send no x-forwarded-for; do not loosen the
 * limiter; the board passes its run id to its own server as BOARD_RUN_ID, read
 * only on development; no request header or body chooses a key; prove that
 * production ignores it. The real clientKey is called with each database and
 * each variable, with requests that try to choose a key. board.yml is read for
 * the wiring. The browser half runs under the board, in mobile-overflow-audit,
 * against the board's own server: a real sign in through the form, read back.
 */
import { existsSync, readFileSync } from "node:fs";

const { clientKey } = await import("../../src/lib/ops-rate-limit.ts");
const { PRODUCTION_REF, DEVELOPMENT_REF } = await import("../../src/lib/db-guard.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const PROD = `https://${PRODUCTION_REF}.supabase.co`;
const DEV = `https://${DEVELOPMENT_REF}.supabase.co`;
const RUN = "40065536871";
const h = (o = {}) => new Headers(o);
/* Every way a request might try to choose a key. */
const CHOOSING = { "x-254-board-run": "1234567", "x-board-run-id": "1234567", "board-run-id": "1234567", cookie: "BOARD_RUN_ID=1234567" };

check("on development, the server's run id prefixes the address main uses", clientKey(h(), { SUPABASE_URL: DEV, BOARD_RUN_ID: RUN }) === `board:${RUN}:unknown`);
check("and a request cannot choose another run", clientKey(h(CHOOSING), { SUPABASE_URL: DEV, BOARD_RUN_ID: RUN }) === `board:${RUN}:unknown`);

/*
 * Question 2, 2026-10-25: a run keeps as many buckets as main has. Board
 * 40141490603 put every sign in of a run into one bucket and missed on 429s.
 * The addresses here are the loopback forms Next forwards on the board's own
 * server, which main counts as two separate buckets.
 */
const LOOPBACKS = ["::1", "127.0.0.1", "::ffff:127.0.0.1"];
const onMain = new Set(LOOPBACKS.map((a) => clientKey(h({ "x-forwarded-for": a }), { SUPABASE_URL: DEV })));
const inRun = new Set(LOOPBACKS.map((a) => clientKey(h({ "x-forwarded-for": a }), { SUPABASE_URL: DEV, BOARD_RUN_ID: RUN })));
check("a run has exactly as many buckets as main has for the same addresses", inRun.size === onMain.size && onMain.size === LOOPBACKS.length, `main ${onMain.size}, run ${inRun.size}`);
check("and every one of them is inside this run", [...inRun].every((k) => k.startsWith(`board:${RUN}:`)));
const other = new Set(LOOPBACKS.map((a) => clientKey(h({ "x-forwarded-for": a }), { SUPABASE_URL: DEV, BOARD_RUN_ID: "40141490603" })));
check("and no bucket is shared with another run", [...inRun].every((k) => !other.has(k)));
check(
  "a forwarded address cannot climb out of its run",
  clientKey(h({ "x-forwarded-for": "board:40141490603:::1" }), { SUPABASE_URL: DEV, BOARD_RUN_ID: RUN }).startsWith(`board:${RUN}:`),
);
check("with no run id on development, no request can create one", clientKey(h(CHOOSING), { SUPABASE_URL: DEV }) === "unknown");
check("on production, the variable is ignored and the key is what it always was", clientKey(h(), { SUPABASE_URL: PROD, BOARD_RUN_ID: RUN }) === "unknown");
check(
  "on production, with a forwarded address, the address is still the key",
  clientKey(h({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }), { SUPABASE_URL: PROD, BOARD_RUN_ID: RUN }) === "203.0.113.9",
);
check("with no database named, the variable is ignored", clientKey(h(), { BOARD_RUN_ID: RUN }) === "unknown");
check("on development, a value that is not a run id is ignored", clientKey(h(), { SUPABASE_URL: DEV, BOARD_RUN_ID: "everyone-shares-this" }) === "unknown");

/*
 * A BUCKET PER AUDIT, Robert's answer of 2026-11-03 (Q9): "bucket per audit on
 * development only. The key comes from the harness, never from a request.
 * Production keeps one bucket per address, unchanged." Q9's H1 stopped a
 * successful sign in clearing the address count, and board 41635661415 met 429
 * on every probe after a run's twentieth sign in from one address.
 */
const AUDIT_A = "roles-audit";
const AUDIT_B = "contrast-audit";
const keyA = clientKey(h({ "x-forwarded-for": "::1" }), { SUPABASE_URL: DEV, BOARD_RUN_ID: RUN, BOARD_AUDIT: AUDIT_A });
const keyB = clientKey(h({ "x-forwarded-for": "::1" }), { SUPABASE_URL: DEV, BOARD_RUN_ID: RUN, BOARD_AUDIT: AUDIT_B });
check("on development, each audit's server keys its own bucket inside the run", keyA === `board:${RUN}:${AUDIT_A}:::1` && keyB === `board:${RUN}:${AUDIT_B}:::1`, `${keyA} / ${keyB}`);
check("and two audits of one run never share a bucket", keyA !== keyB);
check(
  "and a request cannot choose the audit",
  clientKey(h({ ...CHOOSING, "x-board-audit": AUDIT_B, "board-audit": AUDIT_B, cookie: `BOARD_AUDIT=${AUDIT_B}` }), { SUPABASE_URL: DEV, BOARD_RUN_ID: RUN, BOARD_AUDIT: AUDIT_A }) === `board:${RUN}:${AUDIT_A}:unknown`,
);
check("an audit name with no run id keys nothing on development", clientKey(h(), { SUPABASE_URL: DEV, BOARD_AUDIT: AUDIT_A }) === "unknown");
check("on production, the audit name is ignored and the address is the key", clientKey(h({ "x-forwarded-for": "203.0.113.9" }), { SUPABASE_URL: PROD, BOARD_RUN_ID: RUN, BOARD_AUDIT: AUDIT_A }) === "203.0.113.9");
check("a value that is not an audit name leaves the run's key as it was", clientKey(h(), { SUPABASE_URL: DEV, BOARD_RUN_ID: RUN, BOARD_AUDIT: "Any:Thing" }) === `board:${RUN}:unknown`);
check("and with no run id, development keys exactly as before", clientKey(h({ "x-forwarded-for": "198.51.100.4" }), { SUPABASE_URL: DEV }) === "198.51.100.4");

/* The source: the key is read from the environment, never from the request. */
const limiter = readFileSync("src/lib/ops-rate-limit.ts", "utf8");
const body = limiter.slice(limiter.indexOf("export function clientKey("), limiter.indexOf("export const RATE_LIMITS"));
check("clientKey reads the run id from the environment", /const boardRun = env\.BOARD_RUN_ID;/.test(body) && /BOARD_RUN_ID: process\.env\.BOARD_RUN_ID/.test(body));
check("and reads the audit name from the environment only", /const audit = env\.BOARD_AUDIT;/.test(body) && /BOARD_AUDIT: process\.env\.BOARD_AUDIT/.test(body));
check("and reads nothing else from the request but the forwarded address", (body.match(/headers\.get\(/g) ?? []).length === 2 && /headers\.get\("x-forwarded-for"\)/.test(body) && /headers\.get\("x-real-ip"\)/.test(body));

/* The wiring. */
const yml = readFileSync(".github/workflows/board.yml", "utf8");
check("the board sets the run id on the shard every server inherits", /BOARD_RUN_ID="\$\{\{ github\.run_id \}\}" \\\s*\n\s*node scripts\/audit\.mjs/.test(yml));
check("and loads no preload into the shard's processes", !/NODE_OPTIONS/.test(yml) && !existsSync("scripts/ci/board-run-header.mjs"));
/*
 * The harness sets the audit name. Phase one shares one server, so under a board
 * run the suite restarts it for each audit with that audit's name in the
 * server's own environment; phase zero and phase two pass it to the audit,
 * whose own servers inherit it.
 */
const suite = readFileSync("scripts/audit.mjs", "utf8");
const phaseOne = suite.slice(suite.indexOf("for (const audit of RUN_ONE) {"), suite.indexOf("PHASE TWO: these audits start their own servers."));
check(
  "the suite restarts the shared server for each phase one audit with that audit's name, under a board run",
  /const PER_AUDIT_BUCKET = MANAGED && \/\^\\d\{6,20\}\$\/\.test\(process\.env\.BOARD_RUN_ID/.test(suite) &&
    /if \(PER_AUDIT_BUCKET && server\) \{[\s\S]{0,120}await server\.stop\(\);[\s\S]{0,80}server = await startNextServer\(\{ port: PORT, env: \{ BOARD_AUDIT: audit\.name \} \}\);/.test(phaseOne),
);
check(
  "and every phase hands the audit its own name",
  (suite.match(/BOARD_AUDIT: audit\.name/g) ?? []).length === 4,
  `${(suite.match(/BOARD_AUDIT: audit\.name/g) ?? []).length} of 4 (phase zero, the phase one restart, phase one, phase two)`,
);
const overflow = readFileSync("scripts/mobile-overflow-audit.mjs", "utf8");
check(
  "under the board, a real browser sign in is read back for its key",
  /page\.fill\('input\[name="email"\]', techProbe\.email\)/.test(overflow) && /\.from\("eng_sign_in_attempts"\)/.test(overflow) && /String\(address\)\.startsWith\(expected\)/.test(overflow) && /`board:\$\{runId\}:`/.test(overflow),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: each board run has its own sign in bucket on development, no request chooses a key, and production ignores the variable.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
