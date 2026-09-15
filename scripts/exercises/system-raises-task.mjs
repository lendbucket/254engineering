// @runtime react-server
//
// Declared because this exercise reaches modules carrying `server-only`.

/**
 * PHASE 14 RANK 10: THE SYSTEM PRINCIPAL RAISING A TASK.
 *
 *   npx tsx --conditions=react-server scripts/exercises/system-raises-task.mjs
 *
 * `SYSTEM_ACTOR` holds `tasks.raise` and is proven unassignable at compile
 * time. Whether it could actually raise a task was exercised by nothing, and
 * `raiseSystemTask` has no caller in the source today.
 *
 * THE FIRST RUN OF THIS FILE, 2026-09-15, WAS RED, AND THAT WAS THE FINDING:
 *
 *     insert or update on table "eng_tasks" violates foreign key constraint
 *     "eng_tasks_created_by_fkey"
 *
 * The function wrote created_by = the principal's id, which is not a profile.
 * Operator ruling the same day: fix it, choosing between giving the principal
 * what the table requires and changing the requirement. The requirement
 * changed; the reasoning is above raiseSystemTask in src/lib/system-work.ts.
 * The platform's task now has no creator row, is named by source_key
 * `system:<key>` under 0005's unique index, and the principal is named in the
 * audit trail.
 *
 * What this proves, against development:
 *   - the platform can raise a task, and the row and the trail name it
 *   - a second raise of the same key finds the first
 *   - two raises racing for one key produce one row
 *   - keys differing only where LIKE would have wildcarded are distinct
 *   - INJECTION: the insert the old code made is still refused by the database,
 *     so a regression to it fails here rather than in production
 *
 * Every task it raises it removes (eng_tasks refuses nothing). The `task.raise`
 * audit rows cannot be removed, and each names its title, which begins EXERCISE.
 */

process.loadEnvFile?.(".env.local");

import { auditClient, refOf, DEVELOPMENT_REF } from "../lib/db-target.mjs";
import { raiseSystemTask } from "../../src/lib/system-work.ts";

/* Written as literals: an exercise does not import its expectation. */
const SYSTEM_ID = "00000000-0000-4000-8000-000000005957";
const SYSTEM_EMAIL = "the-platform@system.invalid";
const RUN = Date.now().toString(36);

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

const raised = new Set();
const title = (what) => `EXERCISE 2026-09-15: ${what}`;
const task = async (id) =>
  (await db.from("eng_tasks").select("id, created_by, assignee_id, source_key, title").eq("id", id).maybeSingle()).data;

try {
  const key = `exercise-rank-10-${RUN}`;
  const first = await raiseSystemTask({ title: title("the platform raising a task"), description: "Removed by the exercise.", key });
  if (first.ok) raised.add(first.id);
  rec("the platform can raise a task in its own name", first.ok === true && first.already === false, first.ok ? first.id : first.error);

  if (first.ok) {
    const row = await task(first.id);
    rec("with no creator row, unassigned, and named by its source key",
      row?.created_by === null && row?.assignee_id === null && row?.source_key === `system:${key}`,
      `created_by ${row?.created_by}, source_key ${row?.source_key}`);

    const { data: trail } = await db.from("eng_audit_events").select("actor_id, actor_email, action")
      .eq("action", "task.raise").eq("entity_id", first.id);
    rec("and the audit trail names the principal", trail?.length === 1 && trail[0].actor_email === SYSTEM_EMAIL && trail[0].actor_id === SYSTEM_ID,
      trail?.[0] ? `${trail[0].actor_email}` : "no trail row");

    const again = await raiseSystemTask({ title: title("the platform raising a task"), key });
    rec("a second raise with the same key finds the first", again.ok && again.already === true && again.id === first.id);
  }

  const raceKey = `exercise-race-${RUN}`;
  const [r1, r2] = await Promise.all([
    raiseSystemTask({ title: title("race one"), key: raceKey }),
    raiseSystemTask({ title: title("race two"), key: raceKey }),
  ]);
  for (const r of [r1, r2]) if (r.ok) raised.add(r.id);
  const { count: raceRows } = await db.from("eng_tasks").select("id", { count: "exact", head: true }).eq("source_key", `system:${raceKey}`);
  rec("two raises racing for one key produce one row", r1.ok && r2.ok && r1.id === r2.id && raceRows === 1,
    `${raceRows} row(s), ${[r1, r2].filter((r) => r.ok && r.already).length} answered already`);

  const underscore = await raiseSystemTask({ title: title("key with an underscore"), key: `exercise_like_${RUN}` });
  const letter = await raiseSystemTask({ title: title("key with a letter where the underscore was"), key: `exerciseXlike_${RUN}` });
  for (const r of [underscore, letter]) if (r.ok) raised.add(r.id);
  rec("keys that differ only where LIKE would have wildcarded are two tasks", underscore.ok && letter.ok && underscore.id !== letter.id && !letter.already,
    letter.ok ? (letter.already ? "the second was answered as the first" : "distinct") : letter.error);

  /* INJECTION: exactly the insert the old code made. It must still be refused. */
  const { data: oldShape, error: oldError } = await db.from("eng_tasks")
    .insert({ title: title("the old insert"), created_by: SYSTEM_ID, priority: "normal" })
    .select("id").maybeSingle();
  if (oldShape?.id) raised.add(oldShape.id);
  rec("INJECTION: the old insert, created_by the principal's id, is refused by the database",
    Boolean(oldError) && /eng_tasks_created_by_fkey/.test(oldError.message),
    oldError ? oldError.message.slice(0, 90) : "IT WAS ACCEPTED, so the principal's id is now a profile somewhere");
} catch (err) {
  failures += 1;
  console.log(`  STOP: ${err.message}`);
} finally {
  if (raised.size) await db.from("eng_tasks").delete().in("id", [...raised]);
  const { count } = await db.from("eng_tasks").select("id", { count: "exact", head: true }).in("id", [...raised]);
  console.log("");
  rec("teardown: no task this exercise raised is left", (count ?? 0) === 0, `${raised.size} raised, ${count ?? 0} left`);
}

console.log(`\n${failures ? "FAIL" : "PASS"}: ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
