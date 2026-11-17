/**
 * AN UNPAID ORDER IS REMINDED ONCE.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/an-unpaid-order-is-reminded-once.mjs
 *
 * Robert's /start add-on of 2026-11-15, item 16: an order started with an
 * email and not paid within 24 hours gets one reminder, nothing more.
 *
 *   A  the window is 24 hours, typed here.
 *   B  the sweep, read from its source: only web checkouts (no file), still
 *      awaiting payment, not demonstration, with an email, never reminded,
 *      placed more than 24 hours ago; the order is claimed by a conditional
 *      update on a null stamp, from the database clock, BEFORE the email is
 *      queued, and a claim that matched nothing sends nothing.
 *   C  0137 replayed: the same conditional update, run twice, matches once,
 *      which is the whole of "once".
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const { readSource } = await import("../lib/read-source.mjs");
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ----------------------------------------------------------------- A, window */

const src = readSource("src/lib/unpaid-reminder.ts");
check("A: the window is 24 hours", /export const REMINDER_AFTER_HOURS = 24;/.test(src));

/* ------------------------------------------------------------------ B, sweep */

for (const [name, needle] of [
  ["awaiting payment", '.eq("status", "awaiting_payment")'],
  ["a web checkout, with no file", '.is("file_id", null)'],
  ["never reminded", '.is("unpaid_reminder_sent_at", null)'],
  ["not a demonstration", '.eq("is_demo", false)'],
  ["with an email", '.not("customer_email", "is", null)'],
  ["placed before the window", '.lt("placed_at", before)'],
]) {
  const read = src.slice(src.indexOf('.from("eng_service_orders")'), src.indexOf(".limit(REMINDER_BATCH)"));
  check(`B: the sweep reads only orders ${name}`, read.includes(needle));
}
const claim = src.indexOf(".update({ unpaid_reminder_sent_at: DB_NOW })");
const claimGuard = src.indexOf('.is("unpaid_reminder_sent_at", null)', claim);
const skip = src.indexOf("if (claimError || !claimed || claimed.length !== 1) continue;");
const queued = src.indexOf("await queueEmail(");
check("B: the claim stamps from the database clock, only where the stamp is still null", claim > 0 && claimGuard > claim && claimGuard < skip);
check("B: and comes before the email, which a claim that matched nothing never reaches", skip > claimGuard && queued > skip);

/* ------------------------------------------------------------------ C, twice */

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const idx = files.findIndex((f) => f.startsWith("0137_"));
for (const f of files.slice(0, idx + 1)) await db.exec(readSource(join(DIR, f)));
const col = (await db.query(`select data_type, is_nullable from information_schema.columns where table_name = 'eng_service_orders' and column_name = 'unpaid_reminder_sent_at'`)).rows[0];
check("C: 0137 gives the order a nullable reminder stamp", col?.is_nullable === "YES" && /timestamp/.test(col?.data_type ?? ""), JSON.stringify(col));
/* The conditional update the sweep makes, run twice against one row, in a scratch table shaped like the claim. */
await db.exec(`create temporary table claim_probe (id int primary key, unpaid_reminder_sent_at timestamptz, status text); insert into claim_probe values (1, null, 'awaiting_payment');`);
const claimOnce = async () =>
  (await db.query(`update claim_probe set unpaid_reminder_sent_at = now() where id = 1 and unpaid_reminder_sent_at is null and status = 'awaiting_payment' returning id`)).rows.length;
const firstClaim = await claimOnce();
const secondClaim = await claimOnce();
check("C: the claim matches the first time and not the second", firstClaim === 1 && secondClaim === 0, `${firstClaim} then ${secondClaim}`);

console.log(wrong === 0 ? "PASS: an unpaid order is reminded once." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
