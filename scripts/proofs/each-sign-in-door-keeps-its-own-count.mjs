// @runtime react-server
//
// Declared because it imports src/lib/ops-rate-limit.ts, which carries server-only.

/**
 * EACH SIGN IN DOOR KEEPS ITS OWN COUNT. Robert, 2026-11-02 (answer to issue
 * #1 6586517364, item 2): "Per-door attempt counters: yes, follow-up after Q14."
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/each-sign-in-door-keeps-its-own-count.mjs
 *
 * The staff portal, the customer account and the partner sign in counted
 * attempts against the bare email, so a successful customer sign in with the
 * same address as a staff account reset that staff account's guesses. Every
 * door now counts against doorIdentity(door, email). Run against the real
 * counting function replayed from every migration, then against the in-memory
 * fallback, then read in the source of each door.
 *
 * Nothing reaches a database: the SQL runs in an in-process Postgres.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SUPABASE_REPLAY_STUBS } from "../lib/replay-stubs.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const limiter = await import("../../src/lib/ops-rate-limit.ts");
const { doorIdentity, SIGN_IN_DOORS } = limiter;
const EMAIL = "owner@audit-probe.invalid";

/* ------------------------------------------------------------------ the key */
check("three doors, named", JSON.stringify(SIGN_IN_DOORS) === JSON.stringify(["portal", "account", "partner"]));
check("a door's identity is door:email, trimmed and lowercased", doorIdentity("portal", "  Owner@Audit-Probe.Invalid ") === `portal:${EMAIL}`);
check("and no email typed is no identity", doorIdentity("account", "   ") === undefined);
check("the same email at two doors is two identities", doorIdentity("portal", EMAIL) !== doorIdentity("account", EMAIL));

/* ------------------------------------------------------------------ the real function, replayed */
const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const dir = "supabase/migrations";
for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) await db.exec(readFileSync(join(dir, f), "utf8"));
const ADDR = "203.0.113.61";
const take = async (identity) =>
  (await db.query("select public.eng_take_sign_in_attempt($1, $2, $3, $4, $5) as r", [ADDR, identity, 20, 8, 900])).rows[0].r;
const STAFF = doorIdentity("portal", EMAIL);
const CUSTOMER = doorIdentity("account", EMAIL);
for (let i = 0; i < 7; i += 1) await take(STAFF);
/* The customer door signs in with the same email and its success resets ITS identity, the way clearLoginAttempts writes it. */
await take(CUSTOMER);
await db.query("insert into public.eng_sign_in_attempts (address, identity, kind) values ($1, $2, 'reset')", [ADDR, CUSTOMER]);
await take(STAFF);
const ninth = await take(STAFF);
check("a customer success with the staff email leaves the staff count: the ninth staff guess is refused", ninth.allowed === false && ninth.scope === "identity", JSON.stringify(ninth));
await db.close();

/* ------------------------------------------------------------------ the in-memory fallback */
const MEM = "203.0.113.62";
for (let i = 0; i < 7; i += 1) limiter.takeLoginAttemptInMemory(MEM, doorIdentity("portal", EMAIL));
limiter.clearLoginAttemptsInMemory(MEM, doorIdentity("partner", EMAIL));
limiter.takeLoginAttemptInMemory(MEM, doorIdentity("portal", EMAIL));
const memNinth = limiter.takeLoginAttemptInMemory(MEM, doorIdentity("portal", EMAIL));
check("in memory too, a partner success with the same email leaves the staff count", memNinth.allowed === false && memNinth.scope === "identity", JSON.stringify(memNinth));

/* ------------------------------------------------------------------ every door, in the source */
const DOORS = [
  ["portal", "src/app/api/portal/session/route.ts"],
  ["account", "src/app/api/account/session/route.ts"],
  ["partner", "src/app/api/partner/session/route.ts"],
];
for (const [door, path] of DOORS) {
  const src = readFileSync(path, "utf8");
  const keyed = src.match(new RegExp(`const (\\w+) = doorIdentity\\("${door}", (?:email|attempted)\\);`));
  check(`${door}: the route names its own door`, Boolean(keyed));
  const name = keyed?.[1] ?? "\u0000";
  check(`${door}: the attempt counts against that identity`, src.includes(`takeLoginAttempt(clientKey(request.headers), ${name});`));
  check(`${door}: the success resets only that identity`, src.includes(`clearLoginAttempts(clientKey(request.headers), ${name});`));
  check(`${door}: no attempt or reset is keyed on the bare email`, !/(takeLoginAttempt|clearLoginAttempts)\(clientKey\(request\.headers\), attempted( \|\| undefined)?\)/.test(src));
}
const unlock = readFileSync("src/app/api/portal/unlock/route.ts", "utf8");
check("the unlock read names a door, the staff portal unless asked", /doorIdentity\(door, /.test(unlock) && /\?\? "portal"/.test(unlock));

console.log("");
if (wrong === 0) {
  console.log("PASS: each sign in door counts and resets its own attempts, so a success on one door never ends another door's count.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
