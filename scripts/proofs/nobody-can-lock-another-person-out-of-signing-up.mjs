// @runtime react-server
// Declared because it imports src/lib/ops-rate-limit.ts, which carries server-only.
/**
 * PROOF: NOBODY CAN LOCK ANOTHER PERSON OUT OF SIGNING UP OR RESETTING A
 * PASSWORD, AND THE COUNT IS SHARED BY EVERY SERVER.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/nobody-can-lock-another-person-out-of-signing-up.mjs
 *
 * Robert's ruling 18 of 2026-11-19 (`docs/master-undone-2026-11-19.md`). The
 * limiter refused once an address had been named five times from anywhere
 * (three for a reset), and returned before it read the connection's bucket, so
 * strangers could lock a person out of their own sign up for an hour, while the
 * comment beside it promised the opposite. The ruling: refuse on the
 * connection, keep a much higher ceiling on the address, and count in the
 * database so every server shares one count.
 *
 *   A  five sign ups from one connection naming somebody's address do not lock
 *      that person out; the stranger's sixth is refused
 *   B  the address ceiling still holds against many connections
 *   C  an attempt a connection was refused for never counts against the address
 *   D  the same three, for a password reset, at its own ceilings
 *   E  the count goes through eng_take_sign_in_attempt under keys that cannot
 *      meet a sign in's, carries no email address, follows the database's
 *      answer, and falls back to the instance's count when it cannot ask
 *   F  every route that calls a limiter awaits it: a Promise is always truthy,
 *      so `!takeSignUpAttempt(...)` without await refuses nobody, and the type
 *      checker does not say so
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

/* A stub PostgREST answering eng_take_sign_in_attempt as 0071 defines it, for keys with no identity and no reset. */
const rows = [];
let rpcCalls = [];
let rpcFails = false;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const json = { "content-type": "application/json" };
  if (url.pathname.endsWith("/rpc/eng_take_sign_in_attempt")) {
    if (rpcFails) return new Response(JSON.stringify({ message: "stub: database unreachable" }), { status: 503, headers: json });
    const body = JSON.parse(init.body ?? "{}");
    rpcCalls.push(body);
    rows.push(body.p_address);
    const count = rows.filter((k) => k === body.p_address).length;
    return new Response(JSON.stringify({ allowed: count <= body.p_max_address, remaining: Math.max(0, body.p_max_address - count), retry_after_seconds: 0 }), { status: 200, headers: json });
  }
  return new Response("[]", { status: 200, headers: json });
};
process.env.SUPABASE_URL = "https://ythzaiqeoijlrdibnieo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "proof-not-a-key";
delete process.env.VERCEL_ENV;

const limiter = await import("../../src/lib/ops-rate-limit.ts");
const doors = await import("../../src/lib/account-doors.ts");
const {
  takeSignUpAttempt,
  takeResetAttempt,
  takeSignUpAttemptInMemory,
  takeResetAttemptInMemory,
} = limiter;

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures += 1;
}
const t0 = 1_800_000_000_000;

console.log("the ceilings");
check(
  "the address ceilings are higher than the connection ceilings",
  doors.SIGN_UP_ADDRESS_CEILING_PER_HOUR > doors.SIGN_UP_ATTEMPTS_PER_HOUR && doors.RESET_ADDRESS_CEILING_PER_HOUR > doors.RESET_ATTEMPTS_PER_HOUR,
  `sign up ${doors.SIGN_UP_ATTEMPTS_PER_HOUR} per connection, ${doors.SIGN_UP_ADDRESS_CEILING_PER_HOUR} per address; reset ${doors.RESET_ATTEMPTS_PER_HOUR} and ${doors.RESET_ADDRESS_CEILING_PER_HOUR}`,
);

function lockout(take, perConnection, label, offset) {
  const victim = `victim-${label}@example.com`;
  const strangers = [];
  for (let i = 0; i < perConnection; i += 1) strangers.push(take(victim, `stranger-${label}`, t0 + offset + i));
  const strangerAgain = take(victim, `stranger-${label}`, t0 + offset + 50);
  const victimOwn = take(victim, `victim-connection-${label}`, t0 + offset + 60);
  return { strangers, strangerAgain, victimOwn, victim };
}

console.log("A  a stranger cannot lock somebody out of signing up");
{
  const r = lockout(takeSignUpAttemptInMemory, doors.SIGN_UP_ATTEMPTS_PER_HOUR, "a", 0);
  check(`the stranger's first ${doors.SIGN_UP_ATTEMPTS_PER_HOUR} are allowed`, r.strangers.every(Boolean), JSON.stringify(r.strangers));
  check("the stranger's next is refused", r.strangerAgain === false);
  check("the person's own sign up, from their own connection, is allowed", r.victimOwn === true);
}

console.log("B  the address ceiling still holds against many connections");
{
  const victim = "victim-b@example.com";
  const answers = [];
  for (let i = 0; i < doors.SIGN_UP_ADDRESS_CEILING_PER_HOUR; i += 1) answers.push(takeSignUpAttemptInMemory(victim, `connection-b-${i}`, t0 + 1000 + i));
  check(`${doors.SIGN_UP_ADDRESS_CEILING_PER_HOUR} connections naming one address are allowed`, answers.every(Boolean));
  check("the next connection naming it is refused", takeSignUpAttemptInMemory(victim, "connection-b-next", t0 + 1100) === false);
  check("an hour later it is allowed again", takeSignUpAttemptInMemory(victim, "connection-b-later", t0 + 1100 + 61 * 60 * 1000) === true);
}

console.log("C  a refused attempt never counts against the address");
{
  const victim = "victim-c@example.com";
  for (let i = 0; i < 200; i += 1) takeSignUpAttemptInMemory(victim, "one-busy-connection", t0 + 2000 + i);
  check("two hundred tries from one connection leave the address open to its owner", takeSignUpAttemptInMemory(victim, "owner-c", t0 + 2300) === true);
}

console.log("D  the same for a password reset, at its own ceilings");
{
  const r = lockout(takeResetAttemptInMemory, doors.RESET_ATTEMPTS_PER_HOUR, "d", 3000);
  check(`the stranger's first ${doors.RESET_ATTEMPTS_PER_HOUR} are allowed`, r.strangers.every(Boolean), JSON.stringify(r.strangers));
  check("the stranger's next is refused", r.strangerAgain === false);
  check("the person's own reset, from their own connection, is allowed", r.victimOwn === true);
  const victim = "victim-d2@example.com";
  const answers = [];
  for (let i = 0; i < doors.RESET_ADDRESS_CEILING_PER_HOUR; i += 1) answers.push(takeResetAttemptInMemory(victim, `connection-d-${i}`, t0 + 4000 + i));
  check(`${doors.RESET_ADDRESS_CEILING_PER_HOUR} connections naming one address may reset`, answers.every(Boolean));
  check("the next is refused", takeResetAttemptInMemory(victim, "connection-d-next", t0 + 4100) === false);
}

console.log("E  the count is shared, through the database");
{
  const email = "Shared.Person@Example.com";
  const digest = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  rpcCalls = [];
  const first = await takeSignUpAttempt(email, "shared-connection");
  check("an attempt is allowed through the shared count", first === true);
  const keys = rpcCalls.map((c) => c.p_address);
  check("it asked for the connection, then the address", keys[0] === "signup:connection:shared-connection" && keys[1] === `signup:address:${digest}`, keys.join(" | "));
  check("no key carries the email address itself", !rpcCalls.some((c) => JSON.stringify(c).toLowerCase().includes("example.com")));
  check("no key can meet a sign in's, which is a bare connection key", keys.every((k) => /^(signup|reset):(connection|address):/.test(k)));
  check("the window passed is an hour", rpcCalls.every((c) => c.p_window_seconds === 3600));

  /* Five more from the same connection: the sixth in all is refused by the database's count, which no instance holds. */
  const more = [];
  for (let i = 0; i < doors.SIGN_UP_ATTEMPTS_PER_HOUR; i += 1) more.push(await takeSignUpAttempt(`someone-${i}@example.com`, "shared-connection"));
  check("the database's count refuses the connection past its ceiling", more.slice(0, doors.SIGN_UP_ATTEMPTS_PER_HOUR - 1).every(Boolean) && more[doors.SIGN_UP_ATTEMPTS_PER_HOUR - 1] === false, JSON.stringify(more));

  rpcCalls = [];
  const reset = await takeResetAttempt(email, "reset-connection");
  check("a reset counts under its own door's keys", reset === true && rpcCalls[0]?.p_address === "reset:connection:reset-connection" && rpcCalls[1]?.p_address === `reset:address:${digest}`);

  rpcFails = true;
  const fallback = await takeSignUpAttempt("fallback@example.com", "fallback-connection");
  rpcFails = false;
  check("when the database cannot be asked, the instance's own count answers", fallback === true);
}

console.log("F  every route that calls a limiter awaits it");
{
  const files = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(n)) files.push(p);
    }
  };
  walk("src");
  const calls = [];
  for (const f of files) {
    if (f.split("\\").join("/").endsWith("src/lib/ops-rate-limit.ts")) continue;
    const text = readFileSync(f, "utf8");
    for (const m of text.matchAll(/(await\s+)?(takeSignUpAttempt|takeResetAttempt)\(/g)) calls.push({ file: f, awaited: Boolean(m[1]) });
  }
  check("the callers are found", calls.length >= 3, `${calls.length} call(s)`);
  const bare = calls.filter((c) => !c.awaited);
  check("every one is awaited", bare.length === 0, bare.map((c) => c.file).join(", "));
}

if (failures) {
  console.log(`FAIL: ${failures} check(s).`);
  process.exit(1);
}
console.log("PASS: nobody can lock another person out of signing up or resetting, and the count is shared.");
