/**
 * THE SECOND FACTOR IS REQUIRED FOR THE ADMINISTRATOR, THE OPERATIONS MANAGER
 * AND THE REP, AND EVERY OTHER ROLE KEEPS WHAT IT HAD.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-second-factor-is-required-for-staff.mjs
 *
 * Migration 0093, Robert's addendum of 2026-10-25, item 5. Every migration is
 * replayed into PGlite, and every role's mfa_requirement is read before 0093
 * and after it. Nothing reaches development.
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

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const at = files.findIndex((f) => f.startsWith("0093_"));
check("0093 is in the chain", at >= 0);
for (const f of files.slice(0, at)) await db.exec(readSource(join(DIR, f)));

const roles = async () =>
  Object.fromEntries((await db.query("select key, mfa_requirement from eng_roles order by key")).rows.map((r) => [r.key, r.mfa_requirement]));
const before = await roles();
check(
  "before 0093 the administrator, the operations manager and the rep are optional, and the engineer required",
  before.admin === "optional" && before.ops_manager === "optional" && before.rep === "optional" && before.engineer === "required",
  JSON.stringify(before),
);

await db.exec(readSource(join(DIR, files[at])));
const after = await roles();
const NAMED = ["admin", "ops_manager", "rep"];
check("after it the three named roles are required", NAMED.every((k) => after[k] === "required"), JSON.stringify(after));
check("and the engineer stays required", after.engineer === "required");
const others = Object.keys(before).filter((k) => !NAMED.includes(k));
check(
  "every other role keeps exactly what it had",
  others.length > 0 && others.every((k) => after[k] === before[k]),
  others.map((k) => `${k} ${before[k]} to ${after[k]}`).join(", "),
);

/* The file refuses itself if a role it names is missing: run it against a database where rep was removed. */
const lone = new PGlite();
await lone.exec(SUPABASE_REPLAY_STUBS);
for (const f of files.slice(0, at)) await lone.exec(readSource(join(DIR, f)));
await lone.exec("delete from eng_role_grants where role_key = 'rep'; delete from eng_roles where key = 'rep';").catch(() => {});
const refused = await lone.exec(readSource(join(DIR, files[at]))).then(() => "").catch((e) => String(e.message));
check("and it refuses to apply where a role it names does not exist", /expects the admin, ops_manager and rep roles to exist/.test(refused), refused || "it applied");

await db.close();
await lone.close();
console.log("");
if (wrong === 0) {
  console.log("PASS: the second factor is required for the administrator, the operations manager and the rep, and no other role moved.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
