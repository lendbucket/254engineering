/**
 * EVERY LEDGER ENTRY'S `proves` IS A PROBE THE PRODUCTION CHECK CAN RUN.
 * Static: it reads supabase/applied.mjs and scripts/lib/proves-shape.mjs and
 * touches no database.
 *
 * On 2026-11-12 scripts/production-schema-check.mjs was run and crashed on
 * 0041's `column: { table, name }`, a shape in the ledger since 2026-09-10 that
 * the check never read (issue #1, 6815852350). The check is run by hand, so
 * nothing noticed for two months. This proof runs on every board, so the next
 * unreadable shape fails a board on the day it is written.
 *
 *   A  every entry in the ledger maps to a known probe, and none to "unknown";
 *      every kind the ledger uses today is exercised.
 *   B  the parser: a nested column, a grant, a row's where clause, a bucket and
 *      a function each become the probe they mean; a where clause it cannot
 *      read, and a shape nobody wrote, become "unknown".
 *   C  the check uses the parser, refuses an unknown shape loudly rather than
 *      crashing, and does not pin the grant count it last saw in September.
 */
import { readSource } from "../lib/read-source.mjs";

const { APPLIED } = await import("../../supabase/applied.mjs");
const { probeOf, whereAsMatch } = await import("../lib/proves-shape.mjs");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ------------------------------------------------------------- A, the ledger */

const kinds = {};
const unknown = [];
for (const e of APPLIED) {
  const p = probeOf(e.proves);
  kinds[p.kind] = (kinds[p.kind] ?? 0) + 1;
  if (p.kind === "unknown") unknown.push(`${e.file}: ${p.why}`);
}
check("A: the ledger has entries to read", APPLIED.length > 100, String(APPLIED.length));
check("A: every entry's proves maps to a known probe", unknown.length === 0, unknown.join(" | ") || JSON.stringify(kinds));
for (const kind of ["table", "column", "row", "bucket", "function", "none"]) {
  check(`A: the ledger uses the ${kind} kind, so it is exercised`, (kinds[kind] ?? 0) > 0, String(kinds[kind] ?? 0));
}
const nested = APPLIED.find((e) => e.file.startsWith("0041_"));
check("A: 0041, the entry the check crashed on, is a column probe", probeOf(nested?.proves).kind === "column" && probeOf(nested?.proves).table === "eng_documents");

/* ------------------------------------------------------------- B, the parser */

check("B: a nested column", JSON.stringify(probeOf({ column: { table: "eng_x", name: "y" } })) === JSON.stringify({ kind: "column", table: "eng_x", column: "y" }));
check("B: a flat column", JSON.stringify(probeOf({ table: "eng_x", column: "y" })) === JSON.stringify({ kind: "column", table: "eng_x", column: "y" }));
check("B: a grant is a row of eng_role_grants", JSON.stringify(probeOf({ grant: { role: "admin", action: "a.b" } })) === JSON.stringify({ kind: "row", table: "eng_role_grants", match: { role_key: "admin", action: "a.b" } }));
check(
  "B: a row's where clause becomes equality filters",
  JSON.stringify(probeOf({ row: { table: "eng_role_grants", where: "role_key = 'engineer' and action = 'pricing.read_own_pay'" } })) ===
    JSON.stringify({ kind: "row", table: "eng_role_grants", match: { role_key: "engineer", action: "pricing.read_own_pay" } }),
);
check("B: a where with a boolean and a number", JSON.stringify(whereAsMatch("is_demo = true and n = 3")) === JSON.stringify({ is_demo: true, n: 3 }));
check("B: a where it cannot read is refused, not guessed", whereAsMatch("status in ('a', 'b')") === null && probeOf({ row: { table: "eng_x", where: "a > 1" } }).kind === "unknown");
check("B: a bucket", JSON.stringify(probeOf({ bucket: "eng-uploads" })) === JSON.stringify({ kind: "bucket", bucket: "eng-uploads" }));
check("B: a function is not probeable through the API", JSON.stringify(probeOf({ function: "eng_f" })) === JSON.stringify({ kind: "function", name: "eng_f" }));
check("B: a shape nobody wrote is unknown", probeOf({ index: "eng_i" }).kind === "unknown" && probeOf("eng_x").kind === "unknown");
check("B: nothing declared is none", probeOf(null).kind === "none" && probeOf(undefined).kind === "none");

/* -------------------------------------------------------------- C, the check */

const src = readSource("scripts/production-schema-check.mjs");
check("C: the check reads proves through the parser", /import \{ probeOf \} from "\.\/lib\/proves-shape\.mjs";/.test(src) && /const probe = probeOf\(entry\.proves\);/.test(src));
check("C: it no longer destructures proves itself", !/const \{ table, column, match \} = entry\.proves;/.test(src));
check("C: an unknown shape is a failure it names, not a crash", /if \(probe\.kind === "unknown"\)/.test(src));
check("C: it does not pin September's grant count", !/count === 111/.test(src));
check("C: it pins production's grant count at its last sitting, 195 after 0126", /const PRODUCTION_GRANTS = 195;/.test(src));

console.log(wrong === 0 ? "PASS: every ledger entry's proves is a probe the production check can run." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
