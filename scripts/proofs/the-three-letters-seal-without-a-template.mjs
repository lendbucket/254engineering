/**
 * THE MANUFACTURED HOME, SOLAR AND WPI-8E LETTERS SEAL WITHOUT A TEMPLATE,
 * AND A TEMPLATE THAT IS NAMED STILL HAS TO BE A LIVE ONE FOR ITS OWN LINE.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-three-letters-seal-without-a-template.mjs
 *
 * Migration 0091, Robert's ruling of 2026-10-25, 23:51 Central, item A: the
 * engineer signs no templates, and his seal on each letter after reading its
 * full preview is his adoption of it. Every migration is replayed into PGlite,
 * so the whole chain, 0089's doors included, is what answers. Nothing reaches
 * development.
 *
 *   - before 0091 (the chain to 0090) each of the three is refused through
 *     the seventeen-argument door, so the change is what opens it;
 *   - after 0091 each of the three seals through the seventeen-argument door,
 *     naming no template;
 *   - roof, foundation and permit still seal as they did;
 *   - a letter for one of the three that names a voided template, or a
 *     template for another line, is refused; a live one for its own line seals;
 *   - a roof letter still cannot name a template;
 *   - every other rule of the check stands: another engineer's seal image and
 *     a letter sealed by someone who did not decide it are both refused.
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
const at = files.findIndex((f) => f.startsWith("0091_"));
check("0091 is in the chain", at >= 0);
for (const f of files.slice(0, at)) await db.exec(readSource(join(DIR, f)));

const THREE = ["254-MH-001", "254-SL-001", "254-WS-001"];
const LICENCE = "990091";
const ENG = "00000000-0000-4000-8000-0000000009a1";
const OTHER = "00000000-0000-4000-8000-0000000009a2";
const SEAL = "00000000-0000-4000-8000-0000000009b1";
const SIG = "00000000-0000-4000-8000-0000000009b2";
const OTHER_SEAL = "00000000-0000-4000-8000-0000000009b3";
const OTHER_SIG = "00000000-0000-4000-8000-0000000009b4";
const CLIENT = "00000000-0000-4000-8000-0000000009c9";
const FILE = "00000000-0000-4000-8000-0000000009f1";
await db.exec(`
  insert into auth.users (id) values ('${ENG}'), ('${OTHER}');
  insert into eng_profiles (id, email, display_name, role, license_number) values
    ('${ENG}', 'n0091-eng@audit-probe.invalid', '0091 proof engineer, not a real person', 'engineer', '${LICENCE}'),
    ('${OTHER}', 'n0091-other@audit-probe.invalid', '0091 proof second engineer, not a real person', 'engineer', '990092');
  insert into eng_seal_images (id, profile_id, kind, storage_key, sha256, byte_size, width, height, mfa_verified_at) values
    ('${SEAL}', '${ENG}', 'seal', 'probe/s.png', '${"1".repeat(64)}', 900, 600, 600, now()),
    ('${SIG}', '${ENG}', 'signature', 'probe/g.png', '${"2".repeat(64)}', 900, 800, 300, now()),
    ('${OTHER_SEAL}', '${OTHER}', 'seal', 'probe/s2.png', '${"5".repeat(64)}', 900, 600, 600, now()),
    ('${OTHER_SIG}', '${OTHER}', 'signature', 'probe/g2.png', '${"6".repeat(64)}', 900, 800, 300, now());
  insert into eng_clients (id, kind, name) values ('${CLIENT}', 'individual', '0091 proof client, not a real person');
  insert into eng_files (id, file_number, client_id, service_slug, deliverable, property_address, county, status)
    values ('${FILE}', '254-PROOF-0091', '${CLIENT}', 'roof-inspections', 'standard', '1 Proof Way', 'Nueces', 'under_review');
`);

const refusedWith = async (sql, params) => {
  try {
    await db.query(sql, params);
    return "";
  } catch (e) {
    return String(e.message);
  }
};
async function determination(doc, engineer = ENG) {
  const id = randomUUID();
  await db.query(
    `insert into eng_determinations (id, file_id, protocol_document, determination, relied_on_item_keys, relied_on_evidence_ids, engineer_id, letter_option)
     values ($1, $2, $3, 'pass', array['probe'], array['00000000-0000-4000-8000-0000000000e9'::uuid], $4, $5)`,
    [id, FILE, doc, engineer, doc === "254-PL-001" ? "A" : null],
  );
  return id;
}
const SEAL17 =
  "select eng_record_letter_seal($1::uuid, $2::uuid, $3::uuid, null::uuid, 'Proof letter', $4, 4096::bigint, $5, 'F-29811', $6::uuid, $7::uuid, $8::uuid, $9::uuid, now(), $10, $11, $12)";
const SEAL18 =
  "select eng_record_letter_seal($1::uuid, $2::uuid, $3::uuid, null::uuid, 'Proof letter', $4, 4096::bigint, $5, 'F-29811', $6::uuid, $7::uuid, $8::uuid, $9::uuid, now(), $10, $11::uuid, $12, $13)";
const seal17 = async (doc, { by = ENG, seal = SEAL, sig = SIG, decidedBy = ENG, licence = LICENCE } = {}) =>
  refusedWith(SEAL17, [randomUUID(), randomUUID(), FILE, `proof/${randomUUID()}.pdf`, "3".repeat(64), await determination(doc, decidedBy), by, seal, sig, "4".repeat(64), "0091 Proof Engineer", licence]);
const seal18 = async (doc, templateAct) =>
  refusedWith(SEAL18, [randomUUID(), randomUUID(), FILE, `proof/${randomUUID()}.pdf`, "3".repeat(64), await determination(doc), ENG, SEAL, SIG, "4".repeat(64), templateAct, "0091 Proof Engineer", LICENCE]);
const signTemplate = async (key) => {
  const id = randomUUID();
  const r = await refusedWith("select eng_record_letter_template_signature($1, $2, '2026-10-24', $3, $4, $5, $6, now())", [id, key, "7".repeat(64), ENG, SEAL, SIG]);
  return r === "" ? id : null;
};

/* Before 0091. */
for (const doc of THREE) {
  const r = await seal17(doc);
  check(`before 0091 a ${doc} letter with no template is refused`, /seals only from a letter template/.test(r), r || "it sealed");
}

await db.exec(readSource(join(DIR, files[at])));
check("0091 applies", true, files[at]);

/* After 0091: the three seal with no template. */
for (const doc of THREE) {
  const r = await seal17(doc);
  check(`after 0091 a ${doc} letter seals through the seventeen-argument door with no template`, r === "", r);
}
for (const doc of ["254-RC-001", "254-FC-001", "254-PL-001"]) {
  const r = await seal17(doc);
  check(`a ${doc} letter still seals as it did`, r === "", r);
}

/* A template that is named still has to be live and for its own line. */
const mhTemplate = await signTemplate("254-MH-001");
check("a template can still be signed: nothing is dropped", mhTemplate !== null);
const ownLive = await seal18("254-MH-001", mhTemplate);
check("a manufactured home letter naming its own live template seals", ownLive === "", ownLive);
const wrongLine = await seal18("254-SL-001", mhTemplate);
check("a solar letter naming the manufactured home template is refused", /names a live one for the protocol/.test(wrongLine), wrongLine || "it sealed");
await db.query("update eng_seal_acts set voided_at = now(), voided_by = $2, voided_because = 'the 0091 proof voids it' where id = $1", [mhTemplate, ENG]);
const voided = await seal18("254-MH-001", mhTemplate);
check("a letter naming a voided template is refused", /names a live one for the protocol/.test(voided), voided || "it sealed");
const roofTemplate = await seal18("254-RC-001", (await signTemplate("254-SL-001")));
check("a roof letter still cannot name a template", /Only a manufactured home, solar or WPI-8E letter names a letter template/.test(roofTemplate), roofTemplate || "it sealed");

/* Every other clause stands. */
const borrowed = await seal17("254-MH-001", { seal: OTHER_SEAL, sig: OTHER_SIG });
check("another engineer's seal image is refused", /own current seal image/.test(borrowed), borrowed || "it sealed");
const notTheDecider = await seal17("254-SL-001", { by: OTHER, seal: OTHER_SEAL, sig: OTHER_SIG, decidedBy: ENG, licence: "990092" });
check("a letter sealed by an engineer who did not record its determination is refused", /only by the engineer who recorded its determination/.test(notTheDecider), notTheDecider || "it sealed");

await db.close();
console.log("");
if (wrong === 0) {
  console.log("PASS: the manufactured home, solar and WPI-8E letters seal without a template, and a named template is still a live one for its own line.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
