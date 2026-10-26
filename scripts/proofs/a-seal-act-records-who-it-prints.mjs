/**
 * A SEAL ACT RECORDS THE NAME AND LICENCE THE LETTER PRINTS, THROUGH 0089'S
 * DOORS, FROM THE SAME FRAME THE PDF PRINTS.
 *
 *   node scripts/proofs/a-seal-act-records-who-it-prints.mjs
 *
 * Robert's answers of 2026-10-25 on L2e and L2j. The database half (the doors
 * refuse a blank name and another engineer's licence, record both, date the
 * document by the act's own moment, refuse a rewrite) is proved in replay by
 * scripts/migration-audit.mjs. This proves the code half from the source: the
 * one call to the door passes the printed name and licence, and they are the
 * frame's, the same values the PDF's seal block prints.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const seal = readFileSync("src/lib/letter-seal.ts", "utf8");
const call = seal.slice(seal.indexOf('db.rpc("eng_record_letter_seal"'), seal.indexOf("if (recorded.error)"));
check("there is one call to the seal door", (seal.match(/db\.rpc\("eng_record_letter_seal"/g) ?? []).length === 1);
check("it passes the printed name and licence (0089's seventeen and eighteen)", /p_printed_name: frame\.sealBlock\.name,/.test(call) && /p_printed_license: frame\.sealBlock\.licenseNumber,/.test(call));
check("and the PDF's seal block prints from the same frame", /\.\.\.frame\.sealBlock,/.test(seal));
const migration = readFileSync("supabase/migrations/0089_a_seal_act_records_who_it_prints.sql", "utf8");
check("both new doors write the document's sealed_at as the act's moment", (migration.match(/p_byte_size, p_mfa_verified_at, p_sealed_by/g) ?? []).length === 2);
check("and neither replaces 0081's or 0088's door", !/drop function/i.test(migration) && (migration.match(/create or replace function eng_record_letter_seal\(/g) ?? []).length === 2);

console.log("");
if (wrong === 0) {
  console.log("PASS: a seal act records the name and licence the letter prints, through 0089's doors.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
