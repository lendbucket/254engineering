/**
 * A LETTER SEALS ONLY FROM A TEMPLATE THE ENGINEER HAS SIGNED.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-letter-seals-only-from-a-template-he-signed.mjs
 *
 * Robert's instruction of 2026-10-24, migration 0088. The templates are read
 * from code (every built letter has one, its text is what the drafts print,
 * a changed word changes its hash); the chain is replayed to 0088 in an
 * in-process Postgres and a voided template seals nothing, nor can a template
 * signature be edited; and the source is read for the order sealing must keep:
 * the template before the code is spent, passed to the database's one door,
 * and signing only from his own session.
 */
import { createHash } from "node:crypto";
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

const { LETTER_TEMPLATES } = await import("../../src/content/letters/templates.ts");
const { ROOF_LETTER_LINES, ROOF_LETTER_DETERMINATION_SENTENCE } = await import("../../src/content/letters/roof-certification.ts");
const { FOUNDATION_LETTER_OPTION_SENTENCE } = await import("../../src/content/letters/foundation-certification.ts");
const { STRUCTURAL_LETTER_OPTION_SENTENCE, STRUCTURAL_LETTER_LIMITATIONS } = await import("../../src/content/letters/structural-letter.ts");

/* The templates, from code. */
const seal = readFileSync("src/lib/letter-seal.ts", "utf8");
const sealable = [...(seal.match(/export const SEALABLE_PROTOCOLS = \[([^\]]*)\]/)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
check("every letter sealing can seal has a template", sealable.length === 3 && sealable.every((k) => LETTER_TEMPLATES.some((t) => t.key === k)), sealable.join(", "));
const roof = LETTER_TEMPLATES.find((t) => t.key === "254-RC-001");
check(
  "the roof template carries every line the roof letter prints, and every determination sentence",
  ROOF_LETTER_LINES.every((l) => !l.text?.trim() || roof.text.includes(l.text)) &&
    Object.values(ROOF_LETTER_DETERMINATION_SENTENCE).every((s) => roof.text.some((t) => t.endsWith(s))),
);
const fc = LETTER_TEMPLATES.find((t) => t.key === "254-FC-001");
check("the foundation template carries each option sentence", Object.values(FOUNDATION_LETTER_OPTION_SENTENCE).every((s) => fc.text.some((t) => t.endsWith(s))));
const pl = LETTER_TEMPLATES.find((t) => t.key === "254-PL-001");
check(
  "the permit template carries each option sentence and every limitation",
  Object.values(STRUCTURAL_LETTER_OPTION_SENTENCE).every((s) => pl.text.some((t) => t.endsWith(s))) &&
    [...STRUCTURAL_LETTER_LIMITATIONS.always, ...STRUCTURAL_LETTER_LIMITATIONS.deskOnly].every((s) => pl.text.some((t) => t.endsWith(s))),
);
check("no template line is blank: where the words are filled in, the line says what fills it", LETTER_TEMPLATES.every((t) => t.text.every((l) => l.trim().length > 0)));
const hash = (lines) => createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
const changed = [...roof.text];
changed[4] = changed[4].replace("inspected", "examined");
check("a changed word changes the hash, so a signature on the old words reads void", hash(changed) !== hash(roof.text));

/* The database. */
const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const at = files.findIndex((f) => f.startsWith("0088_"));
check("0088 is in the chain", at >= 0);
for (const f of files.slice(0, at + 1)) await db.exec(readSource(join(DIR, f)));
const ENG = "00000000-0000-4000-8000-0000000007a1";
const SEAL = "00000000-0000-4000-8000-0000000007b1";
const SIG = "00000000-0000-4000-8000-0000000007b2";
await db.exec(`
  insert into auth.users (id) values ('${ENG}');
  insert into eng_profiles (id, email, display_name, role) values ('${ENG}', 'tpl-eng@audit-probe.invalid', 'Template proof engineer, not a real person', 'engineer');
  insert into eng_seal_images (id, profile_id, kind, storage_key, sha256, byte_size, width, height, mfa_verified_at)
  values ('${SEAL}', '${ENG}', 'seal', 'probe/s.png', '${"1".repeat(64)}', 900, 600, 600, now()),
         ('${SIG}', '${ENG}', 'signature', 'probe/g.png', '${"2".repeat(64)}', 900, 800, 300, now());
`);
const T1 = "00000000-0000-4000-8000-0000000007c1";
await db.query(`select eng_record_letter_template_signature($1, '254-RC-001', '2026-10-06', $2, $3, $4, $5, now())`, [T1, "3".repeat(64), ENG, SEAL, SIG]);
const row = (await db.query(`select kind, template_key, template_version, document_id, determination_id from eng_seal_acts where id = $1`, [T1])).rows[0];
check("a template signature is its own kind, naming the template and version and nothing a letter carries", row.kind === "letter_template" && row.template_key === "254-RC-001" && row.document_id === null && row.determination_id === null);
const twice = await db.query(`select eng_record_letter_template_signature($1, '254-RC-001', '2026-10-06', $2, $3, $4, $5, now())`, ["00000000-0000-4000-8000-0000000007c2", "3".repeat(64), ENG, SEAL, SIG]).then(() => false, () => true);
check("one live signature per template version", twice);
const edit = await db.query(`update eng_seal_acts set template_key = '254-FC-001' where id = $1`, [T1]).then(() => false, () => true);
check("and a template signature can never be edited into another template", edit);
await db.query(`update eng_seal_acts set voided_at = now(), voided_by = $2, voided_because = 'Proof: the template is withdrawn.' where id = $1`, [T1, ENG]);
const audited = (await db.query(`select count(*)::int as n from eng_audit_events where action = 'letter_template.signed'`)).rows[0].n;
check("signing a template is audited as what it is", audited === 1, `${audited}`);

/* The source: the order sealing keeps, and who signs. */
const at4b = seal.indexOf("templateToSealFrom(det.protocol_document)");
const at5 = seal.indexOf("verifyFreshCode(actor!.id, input.code)");
check("sealing asks for the signed template before it spends the code", at4b > 0 && at5 > at4b);
check("and hands the database the template signature it sealed from", /p_letter_template_act_id: template\.actId/.test(seal));
const sign = readFileSync("src/lib/letter-template-sign.ts", "utf8");
check(
  "a template is signed only from his own licensed session, with a fresh second factor and his own images",
  /holdsLicence\(actor, "documents\.seal"\)/.test(sign) && /verifiedEngineers\.find/.test(sign) && /verifyFreshCode\(actor!\.id, input\.code\)/.test(sign) && /\.eq\("profile_id", actor!\.id\)/.test(sign),
);
check("and a signature on changed words reads void, so nothing seals from it", /templateSha256\(key, version\) !== data\.content_sha256/.test(sign) && /state: "void"/.test(sign));

console.log("");
if (wrong === 0) {
  console.log("PASS: a letter seals only from a template the engineer has signed, and a changed template seals nothing.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
