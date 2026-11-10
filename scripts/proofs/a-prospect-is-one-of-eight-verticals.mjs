/**
 * A PROSPECT IS ONE OF THE EIGHT VERTICALS.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-prospect-is-one-of-eight-verticals.mjs
 *
 * Robert's CRM answer 8 (2026-11-02), migration 0123 (numbered 0122 and staged
 * by his overnight order of 2026-11-05, moved to 0123 by his answer 3 of
 * 2026-11-06) for the operator_sql_editor route:
 *
 *   A  0123 on rows written before it: a person's roofer and agent become
 *      roofer and real_estate; a title company and a person's contractor land
 *      on other and keep the old kind as a tag; a row whose old kind was only
 *      the stand-in derived from its vertical (a solar company written as
 *      contractor) becomes its vertical and gains no tag; nothing is deleted.
 *   B  after it, the check refuses the old kinds and takes every vertical.
 *   C  the code: the kind written is the vertical, the old four still read as
 *      0112's backfill read them, and the prospects screen's CSV reads the
 *      eight from the same words the CRM imports use.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const { readSource } = await import("../lib/read-source.mjs");
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");
const rules = await import("../../src/lib/crm-rules.ts");
const importer = await import("../../src/lib/prospect-import.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* ------------------------------------------- A, the chain to 0122, then the rows */

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const at = files.findIndex((f) => f.startsWith("0123_"));
/*
 * "And last" became untrue by design when 0124 (T9, push subscriptions) was
 * written after it. So the check names what may follow 0123, rather than
 * dropping the clause: a migration after it that nobody listed here could touch
 * eng_prospects and invalidate section A's replay, and this says so by name.
 */
const AFTER_0123 = ["0124_a_phone_hears_of_an_offer.sql", "0125_a_phone_keeps_its_sign_in_in_its_keystore.sql"];
const following = at >= 0 ? files.slice(at + 1) : [];
check(
  "A: 0123 is in the chain, followed only by the migrations named here",
  at >= 0 && JSON.stringify(following) === JSON.stringify(AFTER_0123),
  at >= 0 ? `${files[at]}; after it: ${following.join(", ") || "none"}` : "missing",
);
for (const f of files.slice(0, at)) await db.exec(readSource(join(DIR, f)));

const AUTHOR = "00000000-0000-4000-8000-000000000001";
await db.exec(`
  insert into auth.users (id) values ('${AUTHOR}');
  insert into eng_profiles (id, email, display_name, role, status)
  values ('${AUTHOR}', 'kinds-proof@audit-probe.invalid', 'Kinds proof author, not a real person', 'admin', 'active');
`);
const rows = [
  ["Kinds Roofing", "roofer", "roofer", "361 555 0101"],
  ["Kinds Realty", "agent", "real_estate", "361 555 0102"],
  ["Kinds Title", "title", "other", "361 555 0103"],
  ["Kinds Builders", "contractor", "other", "361 555 0104"],
  ["Kinds Solar", "contractor", "solar", "361 555 0105"],
  ["Kinds Lending", "contractor", "lender", "361 555 0106"],
];
for (const [company, kind, vertical, phone] of rows) {
  await db.query(
    `insert into eng_prospects (company, phone, prospect_type, vertical, created_by) values ($1, $2, $3, $4, $5)`,
    [company, phone, kind, vertical, AUTHOR],
  );
}
const before = Number((await db.query(`select count(*)::int as n from eng_prospects`)).rows[0].n);

await db.exec(readSource(join(DIR, files[at])));

const after = Object.fromEntries(
  (await db.query(`select company, prospect_type, vertical, tags from eng_prospects`)).rows.map((r) => [r.company, r]),
);
const kindOf = (c) => after[c]?.prospect_type;
const tagsOf = (c) => after[c]?.tags ?? [];
check("A: a roofer stays a roofer, with no tag", kindOf("Kinds Roofing") === "roofer" && tagsOf("Kinds Roofing").length === 0);
check("A: an agent becomes real_estate, with no tag", kindOf("Kinds Realty") === "real_estate" && tagsOf("Kinds Realty").length === 0);
check("A: a title company lands on other and keeps title_company as a tag", kindOf("Kinds Title") === "other" && tagsOf("Kinds Title").includes("title_company"), JSON.stringify(after["Kinds Title"]));
check("A: a person's contractor lands on other and keeps contractor as a tag", kindOf("Kinds Builders") === "other" && tagsOf("Kinds Builders").includes("contractor"), JSON.stringify(after["Kinds Builders"]));
check("A: a solar company written as contractor becomes solar, with no tag", kindOf("Kinds Solar") === "solar" && tagsOf("Kinds Solar").length === 0, JSON.stringify(after["Kinds Solar"]));
check("A: a lender written as contractor becomes lender", kindOf("Kinds Lending") === "lender");
check("A: every kind equals its vertical", Object.values(after).every((r) => r.prospect_type === r.vertical));
check("A: nothing was deleted", Object.keys(after).length === before, `${before} before, ${Object.keys(after).length} after`);

/* ------------------------------------------------------------ B, the new check */

const refused = async (sql) => {
  try {
    await db.query(sql);
    return "";
  } catch (e) {
    return String(e?.message ?? e);
  }
};
for (const old of ["agent", "title", "contractor"]) {
  const msg = await refused(`insert into eng_prospects (company, phone, prospect_type, vertical, created_by) values ('Kinds ${old}', '361 555 01${old.length}9', '${old}', 'other', '${AUTHOR}')`);
  check(`B: the check refuses the old kind ${old}`, msg.includes("eng_prospects_type_known"), msg.slice(0, 80));
}
let n = 200;
let taken = 0;
for (const v of rules.CRM_VERTICALS) {
  n += 1;
  const msg = await refused(`insert into eng_prospects (company, phone, prospect_type, vertical, created_by) values ('Kinds Vertical ${v}', '361 555 0${n}', '${v}', '${v}', '${AUTHOR}')`);
  if (!msg) taken += 1;
}
check("B: and takes every one of the eight", taken === rules.CRM_VERTICALS.length, `${taken} of ${rules.CRM_VERTICALS.length}`);

/* ------------------------------------------------------------------- C, the code */

check("C: the kind written is the vertical, for all eight", rules.CRM_VERTICALS.every((v) => rules.prospectTypeForVertical(v) === v));
check(
  "C: the old four read as 0112's backfill read them, and a vertical reads as itself",
  rules.verticalForProspectType("agent") === "real_estate" &&
    rules.verticalForProspectType("title") === "other" &&
    rules.verticalForProspectType("contractor") === "other" &&
    rules.verticalForProspectType("roofer") === "roofer" &&
    rules.verticalForProspectType("insurance_agent") === "insurance_agent",
);
check("C: the prospects screen's types are the eight verticals, in order", JSON.stringify(importer.PROSPECT_TYPES) === JSON.stringify(rules.CRM_VERTICALS));
check(
  "C: its CSV reads the old words onto the eight",
  importer.typeFrom("Realtor") === "real_estate" &&
    importer.typeFrom("title company") === "other" &&
    importer.typeFrom("GC") === "other" &&
    importer.typeFrom("solar installer") === "solar" &&
    importer.typeFrom("plumber") === null,
);
const csv = "Company,Phone,Type\nKinds CSV,361 555 0300,plumber\n";
const read = importer.readProspectFile(csv, null);
check(
  "C: a type outside the eight is refused naming the eight",
  read.rows[0]?.ok === false && read.rows[0].reason.includes("manufactured home dealer") && !read.rows[0].reason.includes("title or contractor"),
  read.rows[0]?.reason,
);
const parse = readSource("src/lib/crm-import-parse.ts");
check("C: the CRM imports read the same words, from crm-rules", !parse.includes("const VERTICAL_WORDS") && parse.includes("verticalFrom, type CrmSource"));

console.log(wrong === 0 ? "PASS: a prospect is one of the eight verticals." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
