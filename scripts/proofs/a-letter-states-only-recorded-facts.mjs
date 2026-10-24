/**
 * A LETTER STATES ONLY FACTS SOMEBODY RECORDED, AND EACH FACT ONLY BY WHOEVER
 * THE RULING NAMES.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-letter-states-only-recorded-facts.mjs
 *
 * Operator rulings of 2026-10-23 (ruling 7), migration 0085, replayed in an
 * in-process Postgres: the office records the authority's address and
 * salutation; the engineer confirms the foundation type and the element
 * described; the foundation type is one of the three the intake offers; the
 * engineer's triage is site or desk; his added capture items are his words.
 * Every row is append only and goes only with its file.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "../lib/read-source.mjs";
import { SUPABASE_REPLAY_STUBS } from "../lib/replay-stubs.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) await db.exec(readSource(join(DIR, f)));
check("every migration replays, 0085 included", files.some((f) => f.startsWith("0085_")), `${files.length} files`);

const PERSON = "00000000-0000-4000-8000-0000000000c1";
const CLIENT = "00000000-0000-4000-8000-0000000000c2";
const FILE = "00000000-0000-4000-8000-0000000000c3";
const SPARE = "00000000-0000-4000-8000-0000000000c4";
await db.exec(`
  insert into eng_clients (id, kind, name) values ('${CLIENT}', 'individual', 'Letter facts proof client, not a real person');
  insert into eng_files (id, file_number, client_id, service_slug, deliverable, property_address, county, status)
    values ('${FILE}', '254-FACTS-1', '${CLIENT}', 'structural-letters', 'standard', '1 Fictional Way', 'Fictional', 'under_review'),
           ('${SPARE}', '254-FACTS-2', '${CLIENT}', 'foundation-inspections', 'standard', '2 Fictional Way', 'Fictional', 'under_review');
`);

async function refused(sql, params = []) {
  try {
    await db.query(sql, params);
    return { refused: false, message: "" };
  } catch (e) {
    return { refused: true, message: e.message };
  }
}
const fact = (file, f, value, capacity) =>
  refused(`insert into eng_letter_facts (file_id, fact, value, recorded_by, capacity) values ($1, $2, $3, $4, $5)`, [file, f, value, PERSON, capacity]);

check("the office records the authority's address", !(await fact(FILE, "authority_address", "City Hall, 1 Main St", "office")).refused);
check("and its salutation", !(await fact(FILE, "authority_salutation", "Building Official", "office")).refused);
check("the engineer cannot record the authority's address: the ruling gives it to the office", (await fact(FILE, "authority_address", "x", "engineer")).refused);
check("the engineer records the element described", !(await fact(FILE, "element_described", "The new 16 ft LVL header over the kitchen opening", "engineer")).refused);
check("the office cannot record the element described: the engineer reviews it", (await fact(FILE, "element_described", "x", "office")).refused);
check("the engineer confirms a foundation type the intake offers", !(await fact(SPARE, "foundation_type", "pier-and-beam", "engineer")).refused);
check("a foundation type the intake does not offer is refused", (await fact(SPARE, "foundation_type", "basement", "engineer")).refused);
check("the office cannot confirm the foundation type", (await fact(SPARE, "foundation_type", "slab-on-grade", "office")).refused);
check("a blank fact is refused", (await fact(FILE, "authority_salutation", "   ", "office")).refused);
check("a fact the ruling does not name is refused", (await fact(FILE, "permit_number", "BP-1", "office")).refused);

/* Newest wins, and nothing is overwritten to get there. */
await fact(SPARE, "foundation_type", "crawlspace", "engineer");
const latest = (await db.query(
  `select value from eng_letter_facts where file_id = $1 and fact = 'foundation_type' order by created_at desc, id desc limit 1`,
  [SPARE],
)).rows[0]?.value;
const kept = Number((await db.query(`select count(*) as n from eng_letter_facts where file_id = $1 and fact = 'foundation_type'`, [SPARE])).rows[0].n);
check("a correction is a new row, and both stay on record", kept === 2, `${kept} rows, newest ${latest}`);

const triage = (file, basis) => refused(`insert into eng_job_triage (file_id, basis, decided_by) values ($1, $2, $3)`, [file, basis, PERSON]);
check("the engineer records a site job", !(await triage(FILE, "site")).refused);
check("or a desk job", !(await triage(SPARE, "desk")).refused);
check("and nothing else", (await triage(FILE, "remote")).refused);

const add = (file, label) => refused(`insert into eng_job_capture_additions (file_id, label, added_by) values ($1, $2, $3)`, [file, label, PERSON]);
check("he adds a capture item in his words", !(await add(FILE, "Photograph the bearing at each end of the header, with the post visible")).refused);
check("a blank or two letter item is refused", (await add(FILE, "ok")).refused);

for (const t of ["eng_letter_facts", "eng_job_triage", "eng_job_capture_additions"]) {
  const edit = await refused(`update ${t} set created_at = now() where file_id = $1`, [FILE]);
  const del = await refused(`delete from ${t} where file_id = $1`, [FILE]);
  check(`${t} cannot be edited or deleted on its own`, edit.refused && del.refused);
}

const goneWithFile = await refused(`delete from eng_files where id = $1`, [FILE]);
const left = Number((await db.query(
  `select (select count(*) from eng_letter_facts where file_id = $1) + (select count(*) from eng_job_triage where file_id = $1)
        + (select count(*) from eng_job_capture_additions where file_id = $1) as n`,
  [FILE],
)).rows[0].n);
check("and every one goes with its file, and only with its file", !goneWithFile.refused && left === 0, goneWithFile.message.slice(0, 80) || `${left} left`);

console.log("");
if (wrong === 0) {
  console.log("PASS: a letter states only facts somebody recorded, each by whoever the ruling names.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
