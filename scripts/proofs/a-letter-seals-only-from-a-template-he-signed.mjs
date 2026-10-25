/**
 * A MANUFACTURED HOME, SOLAR OR WPI-8E LETTER SEALS ONLY FROM A TEMPLATE THE
 * ENGINEER HAS SIGNED, AND EVERY OTHER LETTER SEALS EXACTLY AS BEFORE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-letter-seals-only-from-a-template-he-signed.mjs
 *
 * Robert's instruction of 2026-10-24, migration 0088, narrowed by his ruling 3
 * the same day to the three drafted lines. The chain is replayed to 0087 in an
 * in-process Postgres and a roof letter is sealed; 0088 is applied; then roof,
 * foundation and permit letters seal through 0081's fifteen-argument door as
 * they did, that door's body is unchanged, no protocol record moves, and they
 * can name no template; a three-lines letter seals only from a live template
 * signature for its own protocol. Then the code: no template exists until the
 * engineer adopts the wording, the three protocols are the same three the
 * database names, and only a three-lines letter asks for a template.
 */
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "../lib/read-source.mjs";
import { SUPABASE_REPLAY_STUBS } from "../lib/replay-stubs.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const refusedWith = async (sql, params) =>
  db.query(sql, params).then(
    () => "",
    (e) => e.message,
  );

const THREE = ["254-MH-001", "254-SL-001", "254-WS-001"];

/* ------------------------------------------------------------ the database */
const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const at = files.findIndex((f) => f.startsWith("0088_"));
check("0088 is in the chain", at >= 0);
for (const f of files.slice(0, at)) await db.exec(readSource(join(DIR, f)));

const ENG = "00000000-0000-4000-8000-0000000007a1";
const SEAL = "00000000-0000-4000-8000-0000000007b1";
const SIG = "00000000-0000-4000-8000-0000000007b2";
const CLIENT = "00000000-0000-4000-8000-0000000007c9";
const FILE = "00000000-0000-4000-8000-0000000007f1";
await db.exec(`
  insert into auth.users (id) values ('${ENG}');
  insert into eng_profiles (id, email, display_name, role) values ('${ENG}', 'tpl-eng@audit-probe.invalid', 'Template proof engineer, not a real person', 'engineer');
  insert into eng_seal_images (id, profile_id, kind, storage_key, sha256, byte_size, width, height, mfa_verified_at)
  values ('${SEAL}', '${ENG}', 'seal', 'probe/s.png', '${"1".repeat(64)}', 900, 600, 600, now()),
         ('${SIG}', '${ENG}', 'signature', 'probe/g.png', '${"2".repeat(64)}', 900, 800, 300, now());
  insert into eng_clients (id, kind, name) values ('${CLIENT}', 'individual', 'Template proof client, not a real person');
  insert into eng_files (id, file_number, client_id, service_slug, deliverable, property_address, county, status)
    values ('${FILE}', '254-PROOF-TPL', '${CLIENT}', 'roof-inspections', 'standard', '1 Proof Way', 'Nueces', 'under_review');
`);

async function determination(doc) {
  const id = randomUUID();
  const permit = doc === "254-PL-001";
  await db.query(
    `insert into eng_determinations (id, file_id, protocol_document, determination, relied_on_item_keys, relied_on_evidence_ids, engineer_id, letter_option)
     values ($1, $2, $3, 'pass', array['probe'], array['00000000-0000-4000-8000-0000000000e9'::uuid], $4, $5)`,
    [id, FILE, doc, ENG, permit ? "A" : null],
  );
  return id;
}
const SEAL15 =
  "select eng_record_letter_seal($1::uuid, $2::uuid, $3::uuid, null::uuid, 'Proof letter', $4, 4096::bigint, $5, 'F-29811', $6::uuid, $7::uuid, $8::uuid, $9::uuid, now(), $10)";
const SEAL16 =
  "select eng_record_letter_seal($1::uuid, $2::uuid, $3::uuid, null::uuid, 'Proof letter', $4, 4096::bigint, $5, 'F-29811', $6::uuid, $7::uuid, $8::uuid, $9::uuid, now(), $10, $11::uuid)";
const seal15 = async (doc) => refusedWith(SEAL15, [randomUUID(), randomUUID(), FILE, `proof/${randomUUID()}.pdf`, "3".repeat(64), await determination(doc), ENG, SEAL, SIG, "4".repeat(64)]);
const seal16 = async (doc, templateAct) =>
  refusedWith(SEAL16, [randomUUID(), randomUUID(), FILE, `proof/${randomUUID()}.pdf`, "3".repeat(64), await determination(doc), ENG, SEAL, SIG, "4".repeat(64), templateAct]);

/* Before 0088: what is open, and the door it goes through. */
const before = await seal15("254-RC-001");
check("before 0088 a roof letter seals through the fifteen-argument door", before === "", before);
const door15 = async () =>
  (await db.query("select md5(prosrc) as m from pg_proc where proname = 'eng_record_letter_seal' and pronargs = 15")).rows[0]?.m;
const protocolRecords = async () =>
  (await db.query(
    "select md5(coalesce(string_agg(t::text, '|' order by t.id), '')) as m from (select id, service_slug, status, version_label, document_number, approved_by from eng_protocol_templates) t",
  )).rows[0].m;
const door15Before = await door15();
const recordsBefore = await protocolRecords();

await db.exec(readSource(join(DIR, files[at])));
check("0088 applies on top of a sealed roof letter", true, files[at]);

/* Every line open before is open after. */
check("0081's fifteen-argument door is exactly as it was", (await door15()) === door15Before && Boolean(door15Before));
check("no protocol record moved", (await protocolRecords()) === recordsBefore);
for (const doc of ["254-RC-001", "254-FC-001", "254-PL-001"]) {
  const r = await seal15(doc);
  check(`after 0088 a ${doc} letter still seals through the fifteen-argument door`, r === "", r);
}

/* The three lines. */
for (const doc of THREE) {
  const r = await seal15(doc);
  check(`a ${doc} letter with no template is refused`, /seals only from a letter template/.test(r), r || "it sealed");
}
const nullTemplate = await seal16("254-MH-001", null);
check("and naming no template through the new door is refused too", /seals only from a letter template/.test(nullTemplate), nullTemplate || "it sealed");

const signTemplate = (key) =>
  refusedWith("select eng_record_letter_template_signature($1, $2, '2026-10-24', $3, $4, $5, $6, now())", [randomUUID(), key, "5".repeat(64), ENG, SEAL, SIG]);
for (const key of ["254-RC-001", "254-FC-001", "254-PL-001"]) {
  const r = await signTemplate(key);
  check(`a ${key} template cannot be signed: those letters are untouched`, /eng_seal_acts_template_shape_ck/.test(r), r || "it was signed");
}
const MH_T = randomUUID();
await db.query("select eng_record_letter_template_signature($1, '254-MH-001', '2026-10-24', $2, $3, $4, $5, now())", [MH_T, "5".repeat(64), ENG, SEAL, SIG]);
const row = (await db.query("select kind, template_key, document_id, determination_id from eng_seal_acts where id = $1", [MH_T])).rows[0];
check("a template signature is its own kind, naming its template and nothing a letter carries", row.kind === "letter_template" && row.template_key === "254-MH-001" && row.document_id === null && row.determination_id === null);
check("one live signature per template version", /duplicate key|unique/i.test(await signTemplate("254-MH-001")));
const mh = await seal16("254-MH-001", MH_T);
check("a manufactured home letter seals from its signed template", mh === "", mh);
const wrongLine = await seal16("254-SL-001", MH_T);
check("a solar letter cannot seal from the manufactured home template", /seals only from a letter template/.test(wrongLine), wrongLine || "it sealed");
const roofWithTemplate = await seal16("254-RC-001", MH_T);
check("and a roof letter cannot name a template at all", /Only a manufactured home, solar or WPI-8E letter names a letter template/.test(roofWithTemplate), roofWithTemplate || "it sealed");
const edit = await refusedWith("update eng_seal_acts set template_key = '254-SL-001' where id = $1", [MH_T]);
check("a template signature can never be edited into another template", edit !== "", edit);
await db.query("update eng_seal_acts set voided_at = now(), voided_by = $2, voided_because = 'Proof: the template is withdrawn.' where id = $1", [MH_T, ENG]);
const afterVoid = await seal16("254-MH-001", MH_T);
check("a voided template seals nothing", /seals only from a letter template/.test(afterVoid), afterVoid || "it sealed");
const audited = (await db.query("select count(*)::int as n from eng_audit_events where action = 'letter_template.signed'")).rows[0].n;
check("signing a template is audited as what it is", audited === 1, `${audited}`);

/* ------------------------------------------------------------------ the code */
const { LETTER_TEMPLATES, TEMPLATE_ADOPTION_PROTOCOLS, letterTemplateFor, letterNeedsTemplate } = await import("../../src/content/letters/templates.ts");
const sql = readFileSync(join(DIR, files[at]), "utf8");
const sqlThree = [...(sql.match(/template_key in \(([^)]*)\)/)?.[1] ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]);
const sqlThreeCheck = [...(sql.match(/array\[([^\]]*)\]/)?.[1] ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]);
check(
  "the code's three protocols are the same three the database names, in both places",
  JSON.stringify(TEMPLATE_ADOPTION_PROTOCOLS) === JSON.stringify(THREE) && JSON.stringify(sqlThree) === JSON.stringify(THREE) && JSON.stringify(sqlThreeCheck) === JSON.stringify(THREE),
  `${TEMPLATE_ADOPTION_PROTOCOLS.join(", ")} / ${sqlThree.join(", ")} / ${sqlThreeCheck.join(", ")}`,
);
check("no template exists until the engineer adopts the drafted wording", LETTER_TEMPLATES.length === 0, `${LETTER_TEMPLATES.length}`);
check("roof, foundation and permit have no template and need none", ["254-RC-001", "254-FC-001", "254-PL-001"].every((k) => letterTemplateFor(k) === null && !letterNeedsTemplate(k)));
check("the three need one", THREE.every((k) => letterNeedsTemplate(k)));
check("0088 does not replace the fifteen-argument door", !/p_letterhead_sha256\s+text\s*\)\s*returns void/.test(sql));

const seal = readFileSync("src/lib/letter-seal.ts", "utf8");
const at4b = seal.indexOf("letterNeedsTemplate(det.protocol_document)");
const at5 = seal.indexOf("verifyFreshCode(actor!.id, input.code)");
check("sealing asks whether the letter needs a template, and for it, before it spends the code", at4b > 0 && at5 > at4b && /needsTemplate \? await templateToSealFrom\(det\.protocol_document\) : null/.test(seal));
check("and hands the database a template only when it sealed from one", /\.\.\.\(template\?\.ok \? \{ p_letter_template_act_id: template\.actId \} : \{\}\)/.test(seal));
const sign = readFileSync("src/lib/letter-template-sign.ts", "utf8");
check(
  "a template is signed only from his own licensed session, with a fresh second factor and his own images",
  /holdsLicence\(actor, "documents\.seal"\)/.test(sign) && /verifiedEngineers\.find/.test(sign) && /verifyFreshCode\(actor!\.id, input\.code\)/.test(sign) && /\.eq\("profile_id", actor!\.id\)/.test(sign),
);
check("and a signature on changed words reads void, so nothing seals from it", /templateSha256\(key, version\) !== data\.content_sha256/.test(sign) && /state: "void"/.test(sign));

console.log("");
if (wrong === 0) {
  console.log("PASS: a manufactured home, solar or WPI-8E letter seals only from a signed template, and every other letter seals as before.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
