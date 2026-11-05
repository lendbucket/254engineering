/**
 * PROOF: THE SALES LIST KNOWS COMPANIES, THEIR PEOPLE AND WHERE EACH CAME FROM.
 *
 * Robert's sales CRM ruling of 2026-11-02, item R1, migration 0112. Replays
 * the chain to 0112 into PGlite and asserts, on that database:
 *
 *   A  unique 1: a second company with the same normalized name and
 *      telephone is refused, however the two are punctuated or suffixed;
 *      a company with no telephone is not held to it
 *   B  unique 2: one row per (source, source record id), wherever it is
 *   C  a merge keeps every source: moving a merged company's source rows to
 *      the survivor leaves the survivor holding both
 *   D  activities are contact log rows: a stage change is a note naming its
 *      stages, a CRM outcome is refused on anything but a prospect, a
 *      callback names its time, a refusal its reason
 *   E  stage and status cannot contradict each other, and do not contact
 *      names when and by whom
 *   F  crm.import, crm.assign and crm.reports are held by admin and
 *      ops_manager and nobody else, in the seed and in DEFAULT_ROLES
 *   G  the TypeScript mirror of the two normalization rules agrees with the
 *      database's on the same inputs, and every vocabulary list in
 *      crm-rules.ts is the one 0112's checks hold
 *   H  the writers: every CRM activity goes through logContact, a new
 *      company is written with its primary person and its source, and a
 *      refusal moves the stage with the status
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-sales-list-knows-companies-contacts-and-sources.mjs
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "../lib/read-source.mjs";
import { SUPABASE_REPLAY_STUBS } from "../lib/replay-stubs.mjs";

const rules = await import("../../src/lib/crm-rules.ts");
const { DEFAULT_ROLES } = await import("../../src/lib/ops-authz.ts");

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok: Boolean(ok), note });

async function refused(db, sql, params = []) {
  try {
    await db.query(sql, params);
    return { refused: false, message: "" };
  } catch (e) {
    return { refused: true, message: e.message };
  }
}

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const at = files.findIndex((f) => f.startsWith("0112_"));
check("0112 is in the chain", at >= 0, at >= 0 ? files[at] : "missing");
for (const f of files.slice(0, at + 1)) await db.exec(readSource(join(DIR, f)));

const ADMIN = "00000000-0000-4000-8000-0000000001a1";
await db.exec(`
  insert into auth.users (id) values ('${ADMIN}');
  insert into eng_profiles (id, email, display_name, role, status)
    values ('${ADMIN}', 'crm-r1@audit-probe.invalid', 'CRM proof administrator, not a real person', 'admin', 'active');
`);

async function prospect(company, phone, extra = {}) {
  const cols = ["company", "phone", "email", "prospect_type", "created_by", ...Object.keys(extra)];
  const vals = [company, phone, phone ? null : "nophone@audit-probe.invalid", "roofer", ADMIN, ...Object.values(extra)];
  const r = await db.query(
    `insert into eng_prospects (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
    vals,
  );
  return r.rows[0].id;
}

/* ---------------------------------------------------------------- A, unique 1 */
const A = await prospect("Acme Roofing, LLC", "(361) 555-0100");
const dupe = await refused(db, `insert into eng_prospects (company, phone, prospect_type, created_by) values ('ACME  roofing', '+1 361 555 0100', 'roofer', '${ADMIN}')`);
check("unique 1: the same company and telephone, spelled differently, is refused", dupe.refused && /eng_prospects_name_phone_key/.test(dupe.message), dupe.message);
const otherPhone = await refused(db, `insert into eng_prospects (company, phone, prospect_type, created_by) values ('Acme Roofing', '361 555 0199', 'roofer', '${ADMIN}')`);
check("and the same name with another telephone is a different company", !otherPhone.refused, otherPhone.message);
const C = await prospect("Acme Roofing Inc", null);
check("and a company with no telephone is not held to the name and telephone key", Boolean(C));
const keys = await db.query(`select name_normalized, phone_normalized from eng_prospects where id = $1`, [A]);
check(
  "the keys are the database's own generated columns",
  keys.rows[0]?.name_normalized === "acme roofing" && keys.rows[0]?.phone_normalized === "3615550100",
  JSON.stringify(keys.rows[0]),
);
const writeKey = await refused(db, `update eng_prospects set name_normalized = 'x' where id = '${A}'`);
check("and no writer can set them", writeKey.refused, writeKey.message);

/* ---------------------------------------------------------------- B, unique 2 */
await db.query(`insert into eng_prospect_sources (prospect_id, source, source_record_id) values ($1, 'permits_san_antonio', 'P-1')`, [A]);
const srcDupe = await refused(db, `insert into eng_prospect_sources (prospect_id, source, source_record_id) values ('${C}', 'permits_san_antonio', 'P-1')`);
check("unique 2: one row per source record, wherever it is", srcDupe.refused && /eng_prospect_sources_record_key/.test(srcDupe.message), srcDupe.message);
const sameIdOtherSource = await refused(db, `insert into eng_prospect_sources (prospect_id, source, source_record_id) values ('${C}', 'trec', 'P-1')`);
check("and the same id from another source is another record", !sameIdOtherSource.refused, sameIdOtherSource.message);
const badSource = await refused(db, `insert into eng_prospect_sources (prospect_id, source, source_record_id) values ('${C}', 'google_places', 'x')`);
check("and a source the list does not read is refused (no Places data is stored)", badSource.refused, badSource.message);

/* --------------------------------------------------- C, a merge keeps sources */
await db.query(`update eng_prospect_sources set prospect_id = $1 where prospect_id = $2`, [A, C]);
const kept = await db.query(`select source, source_record_id from eng_prospect_sources where prospect_id = $1 order by source`, [A]);
check(
  "a merge keeps every source: the survivor holds its own and the merged company's",
  kept.rows.length === 2 && kept.rows.some((r) => r.source === "trec") && kept.rows.some((r) => r.source === "permits_san_antonio"),
  JSON.stringify(kept.rows),
);
await db.query(`insert into eng_prospect_contacts (prospect_id, full_name, phone, is_primary, created_by) values ($1, 'Pat Probe', '361-555-0100', true, $2)`, [A, ADMIN]);
const twoPrimary = await refused(db, `insert into eng_prospect_contacts (prospect_id, full_name, is_primary) values ('${A}', 'Second Probe', true)`);
check("several people per company, one of them primary", twoPrimary.refused && /eng_prospect_contacts_one_primary/.test(twoPrimary.message), twoPrimary.message);
await db.query(`insert into eng_prospect_contacts (prospect_id, full_name, is_primary) values ($1, 'Second Probe', false)`, [A]);
const people = await db.query(`select count(*)::int as n from eng_prospect_contacts where prospect_id = $1`, [A]);
check("and a second person sits beside the first", people.rows[0].n === 2, String(people.rows[0].n));

/* ------------------------------------------- D, activities in the contact log */
const stageNote = await refused(
  db,
  `insert into eng_contact_log (by_id, subject_type, prospect_id, channel, body, activity_kind, stage_from, stage_to)
   values ('${ADMIN}', 'prospect', '${A}', 'note', 'Stage moved from New to Attempted.', 'stage_change', 'new', 'attempted')`,
);
check("a stage change is a note in the contact log naming its stages", !stageNote.refused, stageNote.message);
const stageOnCall = await refused(
  db,
  `insert into eng_contact_log (by_id, subject_type, prospect_id, channel, direction, activity_kind, stage_to)
   values ('${ADMIN}', 'prospect', '${A}', 'call', 'outbound', 'stage_change', 'attempted')`,
);
check("and a stage change is refused on a call", stageOnCall.refused, stageOnCall.message);
const stageWithoutKind = await refused(
  db,
  `insert into eng_contact_log (by_id, subject_type, prospect_id, channel, body, stage_to) values ('${ADMIN}', 'prospect', '${A}', 'note', 'x', 'attempted')`,
);
check("and only a stage change names a stage", stageWithoutKind.refused, stageWithoutKind.message);
const callbackNoTime = await refused(
  db,
  `insert into eng_contact_log (by_id, subject_type, prospect_id, channel, direction, outcome, activity_kind, crm_outcome)
   values ('${ADMIN}', 'prospect', '${A}', 'call', 'outbound', 'reached', 'call', 'callback')`,
);
check("a callback names its time", callbackNoTime.refused, callbackNoTime.message);
const refusalNoReason = await refused(
  db,
  `insert into eng_contact_log (by_id, subject_type, prospect_id, channel, direction, outcome, activity_kind, crm_outcome)
   values ('${ADMIN}', 'prospect', '${A}', 'call', 'outbound', 'reached', 'call', 'not_interested')`,
);
check("and a refusal names its reason", refusalNoReason.refused, refusalNoReason.message);
await db.exec(`
  insert into eng_clients (id, kind, name) values ('00000000-0000-4000-8000-0000000001c1', 'organization', 'CRM proof client, not a real company');
`);
const clientRow = await db.query(`select id from eng_clients limit 1`);
const callbackTimeAlone = await refused(
  db,
  `insert into eng_contact_log (by_id, subject_type, prospect_id, channel, direction, activity_kind, callback_at)
   values ('${ADMIN}', 'prospect', '${A}', 'call', 'outbound', 'call', now())`,
);
check("and only a callback carries a callback time", callbackTimeAlone.refused, callbackTimeAlone.message);
if (clientRow.rows[0]) {
  const crmOnClient = await refused(
    db,
    `insert into eng_contact_log (by_id, subject_type, client_id, channel, direction, crm_outcome) values ('${ADMIN}', 'client', '${clientRow.rows[0].id}', 'call', 'outbound', 'no_answer')`,
  );
  check("a CRM outcome is refused on anything but a company on the sales list", crmOnClient.refused, crmOnClient.message);
} else {
  check("a CRM outcome is refused on anything but a company on the sales list", false, "no client row could be made to test against");
}
const logUpdate = await refused(db, `update eng_contact_log set stage_to = 'connected' where prospect_id = '${A}'`);
check("and the log stays append only", logUpdate.refused, logUpdate.message);

/* ------------------------------------------------- E, stage and status agree */
const convertedNew = await refused(db, `update eng_prospects set status = 'converted' where id = '${A}'`);
check("converted without a customer stage is refused", convertedNew.refused, convertedNew.message);
const customerOpen = await refused(db, `update eng_prospects set stage = 'ordering' where id = '${A}'`);
check("and a customer stage without the conversion is refused", customerOpen.refused, customerOpen.message);
const dncBare = await refused(db, `update eng_prospects set stage = 'do_not_contact', status = 'not_interested' where id = '${A}'`);
check("do not contact names when and by whom", dncBare.refused, dncBare.message);
const dncOpen = await refused(db, `update eng_prospects set stage = 'do_not_contact', do_not_contact_at = now(), do_not_contact_by = '${ADMIN}' where id = '${A}'`);
check("and do not contact is always a refusal", dncOpen.refused, dncOpen.message);
const dnc = await refused(db, `update eng_prospects set stage = 'do_not_contact', status = 'not_interested', do_not_contact_at = now(), do_not_contact_by = '${ADMIN}' where id = '${A}'`);
check("a whole do not contact is accepted", !dnc.refused, dnc.message);
const refusedOpen = await refused(db, `update eng_prospects set status = 'not_interested' where id = '${C}'`);
check("not interested must be dormant or do not contact", refusedOpen.refused, refusedOpen.message);
const badScore = await refused(db, `update eng_prospects set score = 101 where id = '${C}'`);
check("a score runs 0 to 100", badScore.refused, badScore.message);

/* ------------------------------------------------------------- F, the grants */
const held = await db.query(`select role_key, action from eng_role_grants where action in ('crm.import', 'crm.assign', 'crm.reports') order by action, role_key`);
const seeded = held.rows.map((r) => `${r.action}:${r.role_key}`).join(",");
const wanted = "crm.assign:admin,crm.assign:ops_manager,crm.import:admin,crm.import:ops_manager,crm.reports:admin,crm.reports:ops_manager";
check("the seed: crm.import, crm.assign and crm.reports for admin and ops_manager only", seeded === wanted, seeded);
for (const action of ["crm.import", "crm.assign", "crm.reports"]) {
  const holders = DEFAULT_ROLES.filter((r) => r.grants.includes(action)).map((r) => r.key).sort().join(",");
  check(`DEFAULT_ROLES: ${action} for admin and ops_manager only`, holders === "admin,ops_manager", holders);
}
const crmUse = DEFAULT_ROLES.filter((r) => r.grants.includes("crm.use")).map((r) => r.key).sort().join(",");
check("crm.use stays with admin, ops_manager and rep; sales holds none of the four", crmUse === "admin,ops_manager,rep", crmUse);

/* ---------------------------------------------------- G, one rule, two places */
const samples = ["Acme Roofing, LLC", "ACME  roofing", "Smith & Sons Co.", "L.L.C. Holdings Inc", "  Beta-Solar Corp ", "Gamma Lending Company", "Coastal Cooling", "dba Delta Roof"];
let nameAgree = 0;
for (const s of samples) {
  const r = await db.query(`select eng_crm_normalize_name($1) as n`, [s]);
  if (r.rows[0].n === rules.normalizeName(s)) nameAgree += 1;
  else check(`name rule agrees on "${s}"`, false, `database "${r.rows[0].n}", code "${rules.normalizeName(s)}"`);
}
check(`the name rule agrees in the database and the code (${nameAgree} of ${samples.length})`, nameAgree === samples.length);
const phones = ["(361) 555-0100", "+1 361 555 0100", "1-361-555-0100", "555-0100", "361.555.0100 ext 4", "", null];
let phoneAgree = 0;
for (const p of phones) {
  const r = await db.query(`select eng_crm_normalize_phone($1) as n`, [p]);
  if ((r.rows[0].n ?? null) === rules.normalizePhone(p)) phoneAgree += 1;
  else check(`phone rule agrees on "${p}"`, false, `database "${r.rows[0].n}", code "${rules.normalizePhone(p)}"`);
}
check(`the phone rule agrees in the database and the code (${phoneAgree} of ${phones.length})`, phoneAgree === phones.length);

const migration = readFileSync(join(DIR, files[at]), "utf8");
const listIn = (constraint) => {
  const start = migration.indexOf(constraint);
  if (start < 0) return null;
  const body = migration.slice(start, migration.indexOf(";", start));
  return [...body.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
};
const same = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);
check("the verticals in code are 0112's", same(listIn("eng_prospects_vertical_known"), [...rules.CRM_VERTICALS]), JSON.stringify(listIn("eng_prospects_vertical_known")));
check("the stages in code are 0112's", same(listIn("eng_prospects_stage_known"), [...rules.CRM_STAGES]), JSON.stringify(listIn("eng_prospects_stage_known")));
check("the sources in code are 0112's", same(listIn("eng_prospect_sources_source_known"), [...rules.CRM_SOURCES]), JSON.stringify(listIn("eng_prospect_sources_source_known")));
check("the activity kinds in code are 0112's", same(listIn("eng_contact_log_activity_kind_known"), [...rules.ACTIVITY_KINDS]));
check("the CRM outcomes in code are 0112's", same(listIn("eng_contact_log_crm_outcome_known"), [...rules.CRM_OUTCOMES]));

const t = rules.territoryFor("nueces county");
check("the territory is the county, the region derived from the region map", t?.county === "Nueces" && t?.regionSlug === "coastal-bend", JSON.stringify(t));
check("and an unknown county is refused rather than stored", rules.territoryFor("Atlantis") === null && rules.countyProblem("Atlantis") !== null);
check(
  "a stage move out of do not contact is refused, and a customer stage needs the conversion",
  !rules.stageMove("do_not_contact", "new").ok && !rules.stageMove("interested", "account_opened").ok && rules.stageMove("interested", "account_opened", { byConversion: true }).ok,
);

/* -------------------------------------------------------------- H, the writers */
const crmSrc = readFileSync("src/lib/crm-prospects.ts", "utf8");
const logSrc = readFileSync("src/lib/ops-contact-log.ts", "utf8");
const prospectsSrc = readFileSync("src/lib/ops-prospects.ts", "utf8");
check("a stage change is written through logContact", /await logContact\(actor, \{[\s\S]{0,400}activityKind: "stage_change"/.test(crmSrc));
check("and crm-prospects writes eng_contact_log nowhere else", !/from\("eng_contact_log"\)/.test(crmSrc));
check("logContact carries the CRM fields onto its one insert", /\.\.\.crmRow,/.test(logSrc) && /activity_kind: kind/.test(logSrc));
check("a refusal logged on a call moves the stage with the status", /status: "not_interested", stage: "dormant"/.test(logSrc));
check(
  "a new company is written with its primary person and its source, typed or imported",
  (prospectsSrc.match(/addPrimaryContactAndSource\(/g) ?? []).length === 2 && /source: "manual"/.test(prospectsSrc) && /source: "csv" as const/.test(prospectsSrc),
);
check("a conversion lands on Account opened", /status: "converted",[\s\S]{0,200}stage: "account_opened"/.test(prospectsSrc));

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note && !x.ok ? ` (${x.note})` : ""}`);
}
console.log(
  failed === 0
    ? "PASS: the sales list knows companies, several people each and every source, unique on normalized name and telephone and on source record, with its activities in the contact log and its grants where Robert put them."
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
