// @runtime react-server
//
// Declared because this exercise reaches modules carrying `server-only`.

/**
 * PHASE 14 RANK 10: THE SYSTEM PRINCIPAL RAISING A TASK.
 *
 *   npx tsx --conditions=react-server scripts/exercises/system-raises-task.mjs
 *
 * `SYSTEM_ACTOR` holds `tasks.raise` and is proven unassignable at compile
 * time. Whether it can actually raise a task was exercised by nothing, and
 * `raiseSystemTask` has no caller anywhere in the source today.
 *
 * Against development. A task it manages to raise is removed afterwards
 * (eng_tasks has no delete refusal); the audit row that goes with it cannot be.
 *
 * THIS EXERCISE IS RED, AND THE RED IS THE FINDING. 2026-09-15, first run:
 *
 *     insert or update on table "eng_tasks" violates foreign key constraint
 *     "eng_tasks_created_by_fkey"
 *
 * `eng_tasks.created_by` references `eng_profiles(id)`, the principal's id is
 * not a profile on development, and no migration seeds one. So the capability
 * the principal is declared to hold cannot be exercised, and the first schedule
 * that relies on it will fail at the insert. It stays red until the operator
 * rules on the shape of the fix, because making it green by writing a profile
 * row by hand would prove a database nobody else has.
 *
 * A SECOND THING READ, NOT PROVEN, because nothing gets far enough to test it:
 * idempotency matches `description LIKE '%[system:<key>]%'` with the key
 * unescaped, and `_` and `%` are LIKE wildcards, so a key containing `_` would
 * also match a different key's open task and report `already` for work never
 * raised.
 */

process.loadEnvFile?.(".env.local");

import { auditClient, refOf, DEVELOPMENT_REF } from "../lib/db-target.mjs";
import { raiseSystemTask } from "../../src/lib/system-work.ts";

/* The principal's id, written as a literal: an exercise does not import its expectation. */
const SYSTEM_ID = "00000000-0000-4000-8000-000000005957";

let failures = 0;
const rec = (name, ok, detail) => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` (${detail})` : ""}`);
};

if (refOf(process.env.SUPABASE_URL ?? "") !== DEVELOPMENT_REF) {
  console.error("REFUSED: this exercise runs against development by name.");
  process.exit(1);
}
const db = auditClient("system raises task exercise", { neverProduction: true });
console.log("system principal raises a task, against development\n");

const raised = [];
try {
  const { data: profile } = await db.from("eng_profiles").select("id").eq("id", SYSTEM_ID).maybeSingle();
  console.log(`  the principal's id ${profile ? "IS" : "is NOT"} a row in eng_profiles, and eng_tasks.created_by references eng_profiles`);

  const first = await raiseSystemTask({
    title: "EXERCISE 2026-09-15: the platform raising a task",
    description: "Written by the Phase 14 rank 10 exercise on development and removed by it.",
    key: "exercise-rank-10",
  });
  if (first.ok) raised.push(first.id);
  rec("the platform can raise a task in its own name", first.ok === true && first.already === false,
    first.ok ? `task ${first.id}` : first.error);

  if (first.ok) {
    const again = await raiseSystemTask({ title: "EXERCISE 2026-09-15: the platform raising a task", key: "exercise-rank-10" });
    rec("a second raise with the same key finds the first", again.ok && again.already && again.id === first.id);
  }
} catch (err) {
  failures += 1;
  console.log(`  STOP: ${err.message}`);
} finally {
  if (raised.length) await db.from("eng_tasks").delete().in("id", raised);
}

console.log(`\n${failures ? "FAIL" : "PASS"}: ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
