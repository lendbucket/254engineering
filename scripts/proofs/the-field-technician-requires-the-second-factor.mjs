/**
 * THE FIELD TECHNICIAN REQUIRES THE SECOND FACTOR, AND EVERY OTHER ROLE KEEPS
 * WHAT IT HAD.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-field-technician-requires-the-second-factor.mjs
 *
 * Migration 0103, Robert's answer 1 of 2026-10-28 on the mobile plan's ruling
 * 13: the server cannot tell the installed app from a browser, so a technician
 * on the app signs in with a second factor only if the role requires it
 * everywhere. Every migration is replayed into PGlite, and every role's
 * mfa_requirement is read before 0103 and after it. Nothing reaches
 * development.
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

const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const at = files.findIndex((f) => f.startsWith("0103_"));
check("0103 is in the chain", at >= 0);

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
for (const f of files.slice(0, at)) await db.exec(readSource(join(DIR, f)));

const roles = async (d) =>
  Object.fromEntries((await d.query("select key, mfa_requirement from eng_roles order by key")).rows.map((r) => [r.key, r.mfa_requirement]));
const before = await roles(db);
check("before 0103 the field technician is optional", before.field_tech === "optional", JSON.stringify(before));

await db.exec(readSource(join(DIR, files[at])));
const after = await roles(db);
check("after it the field technician is required", after.field_tech === "required");

/* Pinned here, not read from the migration: the five required and the four optional, by name. */
const REQUIRED = ["admin", "engineer", "field_tech", "ops_manager", "rep"];
const OPTIONAL = ["customer_service", "dispatcher", "read_only", "sales"];
check(
  "the five staff roles that must be required are",
  REQUIRED.every((k) => after[k] === "required"),
  REQUIRED.map((k) => `${k} ${after[k]}`).join(", "),
);
check(
  "and the four that stay optional are",
  OPTIONAL.every((k) => after[k] === "optional"),
  OPTIONAL.map((k) => `${k} ${after[k]}`).join(", "),
);
check("every role is one of those nine", Object.keys(after).sort().join(",") === [...REQUIRED, ...OPTIONAL].sort().join(","), Object.keys(after).join(", "));
const moved = Object.keys(before).filter((k) => k !== "field_tech" && before[k] !== after[k]);
check("no role other than the field technician moved", moved.length === 0, moved.join(", ") || "none");

/* The file refuses itself if a role it must not move has moved: set sales to required first. */
const lone = new PGlite();
await lone.exec(SUPABASE_REPLAY_STUBS);
for (const f of files.slice(0, at)) await lone.exec(readSource(join(DIR, f)));
await lone.exec("update eng_roles set mfa_requirement = 'required' where key = 'sales';");
const refused = await lone.exec(readSource(join(DIR, files[at]))).then(() => "").catch((e) => String(e.message));
check("and it refuses to apply where another role has moved", /moves the field technician only/.test(refused), refused || "it applied");

await db.close();
await lone.close();
console.log("");
if (wrong === 0) {
  console.log("PASS: the field technician requires the second factor, and no other role moved.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
