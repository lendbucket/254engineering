/**
 * WRITES MIGRATION 0083 FROM 0068'S OWN TEXT.
 *
 *   node scripts/emit-pl-determination-migration.mjs           print it
 *   node scripts/emit-pl-determination-migration.mjs --write   write it
 *
 * 0083 replaces eng_record_review_decision so the determination it inserts
 * carries the structural letter's option and schedule (operator ruling of
 * 2026-10-22 from the engineer's email). The function is 137 lines and written
 * once, in 0068; retyping it would be the place a word drifts. So this copies
 * 0068's function text byte for byte and changes exactly the determination
 * insert, and refuses to write anything if that insert is not found exactly
 * once.
 */
import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "supabase/migrations/0068_a_decision_and_its_credit_are_one_write.sql";
const TARGET = "supabase/migrations/0083_a_permit_letter_records_its_option_and_schedule.sql";

const src = readFileSync(SOURCE, "utf8");
const start = src.indexOf("create or replace function eng_record_review_decision(p jsonb)");
const end = src.indexOf("\n$fn$;", start);
if (start < 0 || end < 0) throw new Error("0068's eng_record_review_decision was not found; nothing written");
let fn = src.slice(start, end + "\n$fn$;".length);

const FROM = [
  "    insert into public.eng_determinations",
  "      (file_id, protocol_document, determination, relied_on_item_keys, relied_on_evidence_ids, note, engineer_id)",
  "    values",
  "      (v_file_id, v_det->>'protocol_document', v_det->>'determination',",
  "       coalesce(array(select jsonb_array_elements_text(v_det->'relied_on_item_keys')), '{}'),",
  "       coalesce(array(select (jsonb_array_elements_text(v_det->'relied_on_evidence_ids'))::uuid), '{}'),",
  "       nullif(v_det->>'note', ''), v_actor_id)",
].join("\n");
const TO = [
  "    insert into public.eng_determinations",
  "      (file_id, protocol_document, determination, relied_on_item_keys, relied_on_evidence_ids, note, engineer_id,",
  "       letter_option, letter_conditions)",
  "    values",
  "      (v_file_id, v_det->>'protocol_document', v_det->>'determination',",
  "       coalesce(array(select jsonb_array_elements_text(v_det->'relied_on_item_keys')), '{}'),",
  "       coalesce(array(select (jsonb_array_elements_text(v_det->'relied_on_evidence_ids'))::uuid), '{}'),",
  "       nullif(v_det->>'note', ''), v_actor_id,",
  "       nullif(v_det->>'letter_option', ''),",
  "       coalesce(array(select jsonb_array_elements_text(coalesce(v_det->'letter_conditions', '[]'::jsonb))), '{}'))",
].join("\n");
const hits = fn.split(FROM).length - 1;
if (hits !== 1) throw new Error(`the determination insert was found ${hits} time(s) in 0068, not once; nothing written`);
fn = fn.replace(FROM, TO);

const HEAD = readFileSync("scripts/emit-pl-determination-migration.head.sql", "utf8");
const TAIL = readFileSync("scripts/emit-pl-determination-migration.tail.sql", "utf8");
const out = `${HEAD}\n${fn}\n\n${TAIL}`;
if (process.argv.includes("--write")) {
  writeFileSync(TARGET, out);
  console.log(`wrote ${TARGET}: 0068's function with the determination insert carrying the letter's option and schedule`);
} else {
  process.stdout.write(out);
}
