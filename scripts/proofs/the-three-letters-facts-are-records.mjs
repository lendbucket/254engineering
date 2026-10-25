/**
 * THE MANUFACTURED HOME, SOLAR AND WPI-8E FACTS ARE RECORDS, EACH RECORDED BY
 * WHOEVER IS NAMED FOR IT, AND THE DATABASE AND THE CATALOGUE SAY THE SAME.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-three-letters-facts-are-records.mjs
 *
 * Robert's instruction of 2026-10-24, migration 0087. The chain is replayed to
 * 0086, a row of each 0085 fact is written, 0087 is applied, and then every
 * catalogue fact is written with its declared capacity (accepted) and with the
 * other capacity (refused), the fixed values are held, the 0085 four keep their
 * rulings, and 0087's lists are parsed and compared with the catalogue, both
 * ways, so neither can gain or lose a fact alone.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "../lib/read-source.mjs";
import { SUPABASE_REPLAY_STUBS } from "../lib/replay-stubs.mjs";

const { LETTER_FACT_CATALOGUE } = await import("../../src/content/letters/letter-fact-catalogue.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
async function refused(sql, params = []) {
  try {
    await db.query(sql, params);
    return false;
  } catch {
    return true;
  }
}

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const at = files.findIndex((f) => f.startsWith("0087_"));
check("0087 is in the chain", at >= 0, at >= 0 ? files[at] : "missing");
for (const f of files.slice(0, at)) await db.exec(readSource(join(DIR, f)));

const ADMIN = "00000000-0000-4000-8000-0000000000e1";
const FILE = "00000000-0000-4000-8000-0000000000e2";
await db.exec(`
  insert into auth.users (id) values ('${ADMIN}');
  insert into eng_profiles (id, email, display_name, role, status)
    values ('${ADMIN}', 'facts-admin@audit-probe.invalid', 'Facts proof administrator, not a real person', 'admin', 'active');
`);
const clientCols = (await db.query(`select column_name from information_schema.columns where table_name = 'eng_clients' and is_nullable = 'NO' and column_default is null`)).rows.map((r) => r.column_name);
const fileCols = (await db.query(`select column_name from information_schema.columns where table_name = 'eng_files' and is_nullable = 'NO' and column_default is null`)).rows.map((r) => r.column_name);
check("the fixture can build a file (its required columns are known)", clientCols.length > 0 && fileCols.length > 0, `client ${clientCols.join(",")}; file ${fileCols.join(",")}`);
const CLIENT = "00000000-0000-4000-8000-0000000000e3";
/* Every required column, plus the id so the file can point at it. */
const fill = (cols, given) => ({ id: given.id, ...Object.fromEntries(cols.map((c) => [c, given[c] ?? `proof-${c}`])) });
const client = fill(clientCols, { id: CLIENT, name: "Facts proof client, not a real person", kind: "individual" });
const insert = async (table, row) => {
  const keys = Object.keys(row);
  await db.query(`insert into ${table} (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")})`, Object.values(row));
};
await insert("eng_clients", client);
await insert("eng_files", fill(fileCols, { id: FILE, client_id: CLIENT, file_number: "254-FACTS-1", service_slug: "manufactured-home-foundation-certifications", property_address: "1 Fictional Way", county: "Fictional", site: "254engineering" }));

/* Before 0087: a row of each 0085 fact. */
const old = [
  ["authority_address", "office", "1 Main St"],
  ["authority_salutation", "office", "Building Official"],
  ["foundation_type", "engineer", "crawlspace"],
  ["element_described", "engineer", "the new beam"],
];
for (const [fact, capacity, value] of old) {
  await db.query(`insert into eng_letter_facts (file_id, fact, value, recorded_by, capacity) values ($1, $2, $3, $4, $5)`, [FILE, fact, value, ADMIN, capacity]);
}
await db.exec(readSource(join(DIR, files[at])));
const kept = (await db.query(`select count(*)::int as n from eng_letter_facts`)).rows[0].n;
check("0087 applies over every 0085 fact already recorded", kept === 4, `${kept} rows`);

/* Every catalogue fact: accepted with its capacity, refused with the other. */
const other = (c) => (c === "office" ? "engineer" : "office");
const sample = (f) => (f.values ? f.values[0] : `proof value for ${f.key}`);
const acceptedWrong = [];
const refusedRight = [];
for (const f of LETTER_FACT_CATALOGUE) {
  if (await refused(`insert into eng_letter_facts (file_id, fact, value, recorded_by, capacity) values ($1, $2, $3, $4, $5)`, [FILE, f.key, sample(f), ADMIN, f.capacity])) refusedRight.push(f.key);
  if (!(await refused(`insert into eng_letter_facts (file_id, fact, value, recorded_by, capacity) values ($1, $2, $3, $4, $5)`, [FILE, f.key, sample(f), ADMIN, other(f.capacity)]))) acceptedWrong.push(f.key);
}
check(`every one of the ${LETTER_FACT_CATALOGUE.length} catalogue facts is accepted from whoever is named for it`, refusedRight.length === 0, refusedRight.join(", "));
check("and refused from the other", acceptedWrong.length === 0, acceptedWrong.join(", "));

/* The 0085 four keep their rulings. */
check("the authority's address is still the office's alone", await refused(`insert into eng_letter_facts (file_id, fact, value, recorded_by, capacity) values ($1, 'authority_address', 'x', $2, 'engineer')`, [FILE, ADMIN]));
check("the foundation type is still the engineer's alone, and one of its three", await refused(`insert into eng_letter_facts (file_id, fact, value, recorded_by, capacity) values ($1, 'foundation_type', 'basement', $2, 'engineer')`, [FILE, ADMIN]));

/* Fixed values. */
for (const f of LETTER_FACT_CATALOGUE.filter((x) => x.values)) {
  check(`${f.key} holds to its ${f.values.length} values`, await refused(`insert into eng_letter_facts (file_id, fact, value, recorded_by, capacity) values ($1, $2, 'not one of them', $3, $4)`, [FILE, f.key, ADMIN, f.capacity]));
}
check("a fact nobody declared is refused", await refused(`insert into eng_letter_facts (file_id, fact, value, recorded_by, capacity) values ($1, 'roof_colour', 'red', $2, 'engineer')`, [FILE, ADMIN]));

/* The migration's lists and the catalogue, both ways. */
const sql = readSource(join(DIR, files[at]));
const capacityCk = sql.slice(sql.indexOf("add constraint eng_letter_facts_capacity_ck"), sql.indexOf("add constraint eng_letter_facts_values_ck"));
const officeList = [...(capacityCk.match(/\(fact in \(([^)]*)\)\s*and capacity = 'office'\)/)?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
const engineerList = [...(capacityCk.match(/or \(fact in \(([\s\S]*?)\) and capacity = 'engineer'\)/)?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
const OLD_OFFICE = ["authority_address", "authority_salutation"];
const OLD_ENGINEER = ["foundation_type", "element_described"];
const declaredOffice = [...OLD_OFFICE, ...LETTER_FACT_CATALOGUE.filter((f) => f.capacity === "office").map((f) => f.key)];
const declaredEngineer = [...OLD_ENGINEER, ...LETTER_FACT_CATALOGUE.filter((f) => f.capacity === "engineer").map((f) => f.key)];
const same = (a, b) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);
check("the migration's office facts are the catalogue's, both ways", officeList.length > 0 && same(officeList, declaredOffice), `${officeList.length} in the migration, ${declaredOffice.length} declared`);
check("and its engineer facts", engineerList.length > 0 && same(engineerList, declaredEngineer), `${engineerList.length} in the migration, ${declaredEngineer.length} declared`);

console.log("");
if (wrong === 0) {
  console.log("PASS: the three documents' facts are records, each recorded by whoever is named for it, and the database and the catalogue agree.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
