/**
 * THE FIFTEEN- AND SIXTEEN-ARGUMENT SEAL DOORS REFUSE, AND THE SEVENTEEN AND
 * EIGHTEEN STILL SEAL.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-old-seal-doors-refuse.mjs
 *
 * Migration 0094, Robert's addendum of 2026-10-25, item 9. Every migration is
 * replayed into PGlite. Before 0094 the old doors still seal; after it they
 * refuse with a sentence naming the door to use, nothing is written by them,
 * and the doors 0089 added seal exactly as before. Nothing reaches development.
 */
import { randomUUID } from "node:crypto";
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
const at = files.findIndex((f) => f.startsWith("0094_"));
check("0094 is in the chain", at >= 0);
for (const f of files.slice(0, at)) await db.exec(readSource(join(DIR, f)));

const LICENCE = "990094";
const ENG = "00000000-0000-4000-8000-0000000094a1";
const SEAL = "00000000-0000-4000-8000-0000000094b1";
const SIG = "00000000-0000-4000-8000-0000000094b2";
const CLIENT = "00000000-0000-4000-8000-0000000094c9";
const FILE = "00000000-0000-4000-8000-0000000094f1";
await db.exec(`
  insert into auth.users (id) values ('${ENG}');
  insert into eng_profiles (id, email, display_name, role, license_number)
    values ('${ENG}', 'n0094-eng@audit-probe.invalid', '0094 proof engineer, not a real person', 'engineer', '${LICENCE}');
  insert into eng_seal_images (id, profile_id, kind, storage_key, sha256, byte_size, width, height, mfa_verified_at) values
    ('${SEAL}', '${ENG}', 'seal', 'probe/s.png', '${"1".repeat(64)}', 900, 600, 600, now()),
    ('${SIG}', '${ENG}', 'signature', 'probe/g.png', '${"2".repeat(64)}', 900, 800, 300, now());
  insert into eng_clients (id, kind, name) values ('${CLIENT}', 'individual', '0094 proof client, not a real person');
  insert into eng_files (id, file_number, client_id, service_slug, deliverable, property_address, county, status)
    values ('${FILE}', '254-PROOF-0094', '${CLIENT}', 'roof-inspections', 'standard', '1 Proof Way', 'Nueces', 'under_review');
`);

const refusedWith = async (sql, params) => {
  try {
    await db.query(sql, params);
    return "";
  } catch (e) {
    return String(e.message);
  }
};
async function determination() {
  const id = randomUUID();
  await db.query(
    `insert into eng_determinations (id, file_id, protocol_document, determination, relied_on_item_keys, relied_on_evidence_ids, engineer_id)
     values ($1, $2, '254-RC-001', 'pass', array['probe'], array['00000000-0000-4000-8000-0000000000e9'::uuid], $3)`,
    [id, FILE, ENG],
  );
  return id;
}
const HEAD = "select eng_record_letter_seal($1::uuid, $2::uuid, $3::uuid, null::uuid, 'Proof letter', $4, 4096::bigint, $5, 'F-29811', $6::uuid, $7::uuid, $8::uuid, $9::uuid, now(), $10";
const base = async () => [randomUUID(), randomUUID(), FILE, `proof/${randomUUID()}.pdf`, "3".repeat(64), await determination(), ENG, SEAL, SIG, "4".repeat(64)];
const seal15 = async () => refusedWith(`${HEAD})`, await base());
const seal16 = async () => refusedWith(`${HEAD}, null::uuid)`, await base());
const seal17 = async () => refusedWith(`${HEAD}, $11, $12)`, [...(await base()), "0094 Proof Engineer", LICENCE]);
const seal18 = async () => refusedWith(`${HEAD}, null::uuid, $11, $12)`, [...(await base()), "0094 Proof Engineer", LICENCE]);
const documents = async () => Number((await db.query("select count(*) as n from eng_documents")).rows[0].n);

const before15 = await seal15();
const before16 = await seal16();
check("before 0094 the fifteen-argument door still seals", before15 === "", before15);
check("and the sixteen-argument door, naming no template, still seals", before16 === "", before16);

await db.exec(readSource(join(DIR, files[at])));
check("0094 applies", true, files[at]);

const docsBefore = await documents();
const after15 = await seal15();
const after16 = await seal16();
check("after it the fifteen-argument door refuses, naming the change", /fifteen-argument door is retired \(0094\)/.test(after15), after15 || "it sealed");
check("and so does the sixteen-argument door", /sixteen-argument door is retired \(0094\)/.test(after16), after16 || "it sealed");
check("and neither wrote a document", (await documents()) === docsBefore, `${docsBefore} to ${await documents()}`);
const after17 = await seal17();
const after18 = await seal18();
check("the seventeen-argument door still seals, with the printed name and licence", after17 === "", after17);
check("and the eighteen-argument door, naming no template, still seals", after18 === "", after18);
const printed = (await db.query("select count(*) as n from eng_seal_acts where printed_license = $1", [LICENCE])).rows[0].n;
check("and both of those acts recorded the licence they print", Number(printed) === 2, `${printed}`);

await db.close();
console.log("");
if (wrong === 0) {
  console.log("PASS: the fifteen- and sixteen-argument seal doors refuse, and the seventeen and eighteen still seal.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
