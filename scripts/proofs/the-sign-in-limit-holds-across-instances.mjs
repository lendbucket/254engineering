/**
 * THE SIGN IN LIMIT HOLDS ACROSS INSTANCES, BECAUSE IT COUNTS IN THE DATABASE.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-sign-in-limit-holds-across-instances.mjs
 *
 * Operator ruling, 2026-10-10 (decision 14): the sign in limiter moves out of
 * process memory, where every warm Vercel instance counted on its own. 0071 adds
 * eng_sign_in_attempts and eng_take_sign_in_attempt.
 *
 * Every migration is replayed into an in-process Postgres (as migration-audit
 * does) and the real function is asked, with the limits ops-rate-limit.ts
 * passes, written here as literals: 8 per identity and 20 per address in 15
 * minutes. "Two instances" are two callers of one database, which is exactly
 * the property the move buys: the count is shared because it is in one place.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "../lib/read-source.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const MAX_IDENTITY = 8;
const MAX_ADDRESS = 20;
const WINDOW = 15 * 60;

const db = new PGlite();
await db.exec(`
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key);
  create schema if not exists storage;
  create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
`);
const DIR = "supabase/migrations";
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".sql")).sort()) await db.exec(readSource(join(DIR, f)));

const take = async (address, identity) =>
  (await db.query("select eng_take_sign_in_attempt($1, $2, $3, $4, $5) as r", [address, identity, MAX_ADDRESS, MAX_IDENTITY, WINDOW])).rows[0].r;

/* One identity, from two "instances" taking turns: the ninth attempt is refused whichever instance makes it. */
let ninth = null;
for (let i = 1; i <= 9; i += 1) ninth = await take("203.0.113.7", "probe@audit-probe.invalid");
check("the ninth attempt on one account from one address is refused, counted across callers", ninth.allowed === false && ninth.scope === "identity", JSON.stringify(ninth));
check("and it says how long until it may try again", ninth.retry_after_seconds > 0 && ninth.retry_after_seconds <= WINDOW, `${ninth.retry_after_seconds}s`);

/* A successful sign in writes a reset, and the count starts again. */
await db.query("insert into eng_sign_in_attempts (address, identity, kind) values ($1, null, 'reset')", ["203.0.113.7"]);
const after = await take("203.0.113.7", "probe@audit-probe.invalid");
/*
 * And the attempt after the reset COUNTS: remaining is seven, not eight. The
 * first version compared timestamps, two rows in one instant shared now(), and
 * the attempt made right after a reset was not counted; this figure caught it.
 */
check(
  "after a reset, the same account may try again, and that attempt is counted",
  after.allowed === true && after.remaining === MAX_IDENTITY - 1,
  JSON.stringify(after),
);

/* Spraying one password across many accounts from one address: the address cap stops it at 21. */
let sprayed = null;
for (let i = 1; i <= 21; i += 1) sprayed = await take("198.51.100.9", `account-${i}@audit-probe.invalid`);
check("the twenty first attempt from one address across many accounts is refused on the address", sprayed.allowed === false && sprayed.scope === "address", JSON.stringify(sprayed));

/* Another address is untouched by either. */
const elsewhere = await take("192.0.2.44", "probe@audit-probe.invalid");
check("another address is not affected", elsewhere.allowed === true);

const deletes = (await db.query("select count(*)::int as n from eng_sign_in_attempts where kind = 'reset'")).rows[0].n;
check("a reset is a row, so nothing was deleted to clear a count", deletes === 1, `${deletes} reset row(s)`);

await db.close();
console.log("");
if (wrong === 0) {
  console.log("PASS: the sign in limit holds across instances, because it counts in the database.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
