/**
 * A FUNCTION A LATER MIGRATION RESTATES IS ONE ASSIGNMENT WRITER, AND TWO
 * DIFFERENT FUNCTIONS ARE TWO.
 *
 *   node scripts/proofs/an-assignment-writer-is-counted-once-per-function.mjs
 *
 * Operator ruling of 2026-10-23 on bulk-audit: count a replaced function once,
 * by its latest definition; "prove by injection that two distinct writer
 * functions still count as two." bulk-audit is a writer audit and runs only in
 * the cloud writers shard, so its counting lives in
 * scripts/lib/assignment-writers.mjs and is exercised here, statically, on the
 * real migrations and on migrations built to separate the answers.
 */
import { readdirSync } from "node:fs";
import { readSource } from "../lib/read-source.mjs";
import { migrationAssignmentWriters } from "../lib/assignment-writers.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const real = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => ({ name: `supabase/migrations/${f}`, text: readSource(`supabase/migrations/${f}`) }));
const live = migrationAssignmentWriters(real);
check(
  "the real migrations hold exactly one writer, the review decision clearing a technician",
  live.length === 1 && /set assigned_tech_id = null/.test(live[0]),
  live.join(" | "),
);

/* The real function's own text, as 0068 wrote it, so the cases are built from what is live, not typed. */
const m0068 = real.find((m) => m.name.includes("0068_"));
const fn = m0068.text.slice(m0068.text.indexOf("create or replace function eng_record_review_decision"));
const body = fn.slice(0, fn.indexOf("$fn$;") + "$fn$;".length);

const restated = migrationAssignmentWriters([
  { name: "0068.sql", text: body },
  { name: "0083.sql", text: `${body}\n-- the same function, restated with two fields` },
]);
check("one function restated by a later migration counts once", restated.length === 1, restated.join(" | "));
check("and the writer named is the latest definition's", restated.length === 1 && restated[0].startsWith("0083.sql:"));

/* THE INJECTION THE RULING ASKS FOR: a second, DIFFERENT function that also writes one. */
const second = body.replace("eng_record_review_decision", "eng_second_writer_injected");
const distinct = migrationAssignmentWriters([
  { name: "0068.sql", text: body },
  { name: "0090.sql", text: second },
]);
check("two different functions that each write an assignment count as two", distinct.length === 2, distinct.join(" | "));

const loose = migrationAssignmentWriters([
  { name: "a.sql", text: "update eng_files set assigned_engineer_id = null where id = 1;" },
  { name: "b.sql", text: "update eng_files set assigned_engineer_id = null where id = 1;" },
]);
check("a writer outside any function is counted per statement, as before", loose.length === 2, loose.join(" | "));

const setter = migrationAssignmentWriters([
  { name: "c.sql", text: body.replace("assigned_tech_id = null", "assigned_tech_id = v_actor_id") },
]);
check("a restated function that now SETS an assignment is read from its latest text", setter.length === 1 && /assigned_tech_id = v_actor_id/.test(setter[0]), setter.join(" | "));

console.log("");
if (wrong === 0) {
  console.log("PASS: an assignment writer is counted once per live definition, and two functions are two.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
