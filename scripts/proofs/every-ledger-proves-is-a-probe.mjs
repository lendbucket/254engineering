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
const { probeOf, probeSql, whereAsMatch } = await import("../lib/proves-shape.mjs");

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
check("C: the check reads proves through the parser", /import \{ probeOf, probeSql \} from "\.\/lib\/proves-shape\.mjs";/.test(src) && /const probe = probeOf\(entry\.proves\);/.test(src));
check("C: it no longer destructures proves itself", !/const \{ table, column, match \} = entry\.proves;/.test(src));
check("C: an unknown shape is a failure it names, not a crash", /if \(probe\.kind === "unknown"\)/.test(src));
check("C: it does not pin September's grant count", !/count === 111/.test(src));
check("C: it pins production's grant count at its last sitting, 195 after 0126", /const PRODUCTION_GRANTS = 195;/.test(src));
check("C: the count has one home, read by the check and by --sql", (src.match(/const PRODUCTION_GRANTS = /g) ?? []).length === 1 && !/count === 111|= 195 as ok/.test(src));

/* ---------------------------------------------- D, the same probes as SQL */

check("D: --sql prints and exits before any client is made", src.indexOf('process.argv.includes("--sql")') > 0 && src.indexOf('process.argv.includes("--sql")') < src.indexOf('auditClient("production-schema-check")'));
check("D: a table", probeSql({ kind: "table", table: "eng_x" }) === "to_regclass('public.eng_x') is not null");
check("D: a column", /information_schema\.columns where table_schema = 'public' and table_name = 'eng_x' and column_name = 'y'/.test(probeSql({ kind: "column", table: "eng_x", column: "y" }) ?? ""));
check("D: a row, its literals quoted", probeSql({ kind: "row", table: "eng_r", match: { a: "it's", b: true, n: 3 } }) === "exists (select 1 from public.eng_r where a = 'it''s' and b = true and n = 3)");
check("D: a bucket", probeSql({ kind: "bucket", bucket: "eng-uploads" }) === "exists (select 1 from storage.buckets where id = 'eng-uploads')");
check("D: a function, read by name, not called", /from pg_proc p join pg_namespace n .* p\.proname = 'eng_f'/.test(probeSql({ kind: "function", name: "eng_f" }) ?? "") && !/eng_f\(/.test(probeSql({ kind: "function", name: "eng_f" }) ?? ""));
check("D: an identifier that is not one is refused, so no statement can ride in", probeSql({ kind: "table", table: "eng_x; drop table eng_y" }) === null && probeSql({ kind: "row", table: "eng_r", match: { "a = 1 or 1": 1 } }) === null);
const sqlOf = APPLIED.filter((e) => e.production).map((e) => ({ file: e.file, probe: probeOf(e.proves) })).filter((x) => x.probe.kind !== "none");
const unwritable = sqlOf.filter((x) => !probeSql(x.probe)).map((x) => x.file);
check("D: every applied entry's probe can be written as SQL", unwritable.length === 0, unwritable.join(", ") || `${sqlOf.length} probes`);
const emitted = sqlOf.map((x) => probeSql(x.probe)).join(" ");
check("D: nothing it writes can change a database", !/\b(insert|update|delete|drop|alter|create|grant|revoke|truncate)\b/i.test(emitted));

/* Run the printed select against a replayed database: it must parse and answer one boolean per probe. */
const { readdirSync } = await import("node:fs");
const { join } = await import("node:path");
const { PGlite } = await import("@electric-sql/pglite");
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");
const DIR = "supabase/migrations";
const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
for (const f of readdirSync(DIR).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort()) await db.exec(readSource(join(DIR, f)));
const union = sqlOf.map((x) => `select '${x.file}' as migration, ${probeSql(x.probe)} as ok`).join(" union all ");
const answered = await db.query(union).then((r) => r.rows).catch((e) => String(e.message));
check("D: the select parses and runs on a replayed database", Array.isArray(answered), Array.isArray(answered) ? "" : answered);
check("D: and answers one boolean per probe", Array.isArray(answered) && answered.length === sqlOf.length && answered.every((r) => typeof r.ok === "boolean"), Array.isArray(answered) ? `${answered.length} rows` : "");
const schemaMarks = Array.isArray(answered) ? answered.filter((r, i) => ["table", "column", "bucket", "function"].includes(sqlOf[i].probe.kind)) : [];
check("D: every table, column, bucket and function mark is true on the replay", schemaMarks.length > 0 && schemaMarks.every((r) => r.ok === true), schemaMarks.filter((r) => !r.ok).map((r) => r.migration).join(", "));
await db.close();

console.log(wrong === 0 ? "PASS: every ledger entry's proves is a probe the production check can run." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
