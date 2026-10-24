/**
 * AN APPROVAL BY PHONE IS ITS OWN KIND, IT COUNTS AS APPROVED, AND IT CAN NEVER
 * BE MISTAKEN FOR AN APPROVAL HE MADE IN THE PORTAL.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/an-approval-by-phone-is-its-own-kind.mjs
 *
 * Operator ruling of 2026-10-23 21:56 CT, migration 0086. The chain is replayed
 * to 0085 in an in-process Postgres, a portal decision is written the way
 * decideTraining writes one, 0086 is applied, and then: the old row reads as a
 * portal row; the one door records a relayed approval, the training, the
 * certification and the audit event; eng_line_is_trained counts it; every way a
 * relayed row could pass for a portal row is refused; the written confirmation
 * attaches only to a relayed approval, once, and is append only. Then the
 * source: the portal reads and shows the kind and "written confirmation pending".
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
async function refused(sql, params = []) {
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
const at = files.findIndex((f) => f.startsWith("0086_"));
check("0086 is in the chain", at >= 0, at >= 0 ? files[at] : "missing");
for (const f of files.slice(0, at)) await db.exec(readSource(join(DIR, f)));

const ENG = "00000000-0000-4000-8000-0000000000c1";
const OWNER = "00000000-0000-4000-8000-0000000000c2";
const TECH = "00000000-0000-4000-8000-0000000000c3";
const OTHER = "00000000-0000-4000-8000-0000000000c4";
const T = "00000000-0000-4000-8000-0000000000d1";
const T_DRAFT = "00000000-0000-4000-8000-0000000000d2";
const SLUG = "proof-relayed-line";
await db.exec(`
  insert into auth.users (id) values ('${ENG}'), ('${OWNER}'), ('${TECH}'), ('${OTHER}');
  insert into eng_profiles (id, email, display_name, role, status) values
    ('${ENG}', 'relay-eng@audit-probe.invalid', 'Relay proof engineer, not a real person', 'engineer', 'active'),
    ('${OWNER}', 'relay-owner@audit-probe.invalid', 'Relay proof owner, not a real person', 'admin', 'active'),
    ('${TECH}', 'relay-tech@audit-probe.invalid', 'Relay proof technician, not a real person', 'field_tech', 'active'),
    ('${OTHER}', 'relay-other@audit-probe.invalid', 'Relay proof second technician, not a real person', 'field_tech', 'active');
  -- FIXTURE ONLY: eng_guard_protocol_insert_in_force lets only a signature put a
  -- template in force, so triggers are off for this one setup insert (its check
  -- constraints still apply) and back on before anything under test runs.
  set session_replication_role = replica;
  insert into eng_protocol_templates (id, service_slug, name, version, status, document_number, version_label, approved_by, approved_at, published_at)
    values ('${T}', '${SLUG}', 'Proof protocol', 1, 'published', '254-ZZ-902', '1.1', '${ENG}', now(), now());
  set session_replication_role = origin;
  insert into eng_protocol_templates (id, service_slug, name, version, status, document_number, version_label)
    values ('${T_DRAFT}', '${SLUG}-draft', 'Proof draft protocol', 1, 'draft', '254-ZZ-903', '1.0');
`);

/* A portal decision before 0086, as decideTraining writes one. */
const portalRec = await db.query(
  `insert into eng_training_records (profile_id, service_slug, template_id, protocol_document, protocol_version_label, trained_on, supervised_by, recorded_by)
   values ($1, $2, $3, '254-ZZ-902', '1.1', '2026-10-01', 'Proof supervisor', $4) returning id`,
  [OTHER, SLUG, T, OWNER],
);
await db.query(
  `insert into eng_training_decisions (record_id, decision, decided_by, decided_by_license) values ($1, 'approved', $2, 'PROOF-LIC')`,
  [portalRec.rows[0].id, ENG],
);

await db.exec(readSource(join(DIR, files[at])));

const old = await db.query(`select channel, approved_by_engineer, relayed_by, approved_at, decided_by from eng_training_decisions`);
check(
  "a decision written before 0086 reads as a portal decision, with its engineer in decided_by and nothing relayed",
  old.rows.length === 1 && old.rows[0].channel === "portal" && old.rows[0].decided_by === ENG && old.rows[0].relayed_by === null,
);

/* A certification already in force, as the owner's roof one of 2026-09-23 is. */
await db.query(
  `insert into eng_certifications (profile_id, service_slug, template_id, status, certified_at) values ($1, $2, $3, 'certified', '2026-09-23T05:00:00Z')`,
  [TECH, SLUG, T],
);

/* The one door. */
const APPROVED_AT = "2026-10-24T02:56:00Z";
const before = await db.query(`select eng_line_is_trained($1, $2) as t`, [SLUG, T]);
const door = await db.query(
  `select eng_record_relayed_training_approval($1, $2, '2026-10-23', 'Proof supervisor', $3, $4, $5) as id`,
  [TECH, T, ENG, OWNER, APPROVED_AT],
);
const decisionId = door.rows[0].id;
const d = (await db.query(`select * from eng_training_decisions where id = $1`, [decisionId])).rows[0];
check(
  "the one door records the approval as phone_relayed: no decided_by, no licence, the engineer who approved, the owner who relayed, and the moment he approved",
  d.channel === "phone_relayed" && d.decided_by === null && d.decided_by_license === null &&
    d.approved_by_engineer === ENG && d.relayed_by === OWNER && new Date(d.approved_at).toISOString() === new Date(APPROVED_AT).toISOString(),
);
const r = (await db.query(`select * from eng_training_records where id = $1`, [d.record_id])).rows[0];
check("and the training on the in force template, recorded by the owner", r.template_id === T && r.profile_id === TECH && r.recorded_by === OWNER);
const cert = (await db.query(`select status, certified_at from eng_certifications where profile_id = $1 and service_slug = $2`, [TECH, SLUG])).rows[0];
check("and the certification dispatch reads", cert?.status === "certified");
check(
  "and a certification already in force keeps its own date, never re-dated by the door",
  new Date(cert?.certified_at).toISOString() === "2026-09-23T05:00:00.000Z",
  cert ? new Date(cert.certified_at).toISOString() : "no row",
);
const ev = (await db.query(`select actor_id, action, summary, diff from eng_audit_events where action = 'certification.training_approved_by_phone'`)).rows;
check(
  "and an audit event by the owner that names it relayed and says written confirmation pending",
  ev.length === 1 && ev[0].actor_id === OWNER && /by phone, relayed by the owner/.test(ev[0].summary) &&
    /Written confirmation pending/.test(ev[0].summary) && ev[0].diff.channel === "phone_relayed",
);

/* eng_line_is_trained counts it. */
await db.query(`update eng_profiles set status = 'suspended' where id = $1`, [OTHER]);
const afterLine = await db.query(`select eng_line_is_trained($1, $2) as t`, [SLUG, T]);
check("eng_line_is_trained counts the relayed approval as approved (the portal technician suspended, so only it can answer)", afterLine.rows[0].t === true, `before the door: ${before.rows[0].t}`);

/* Refusals: a relayed row can never pass for a portal row. */
const rec2 = (await db.query(
  `insert into eng_training_records (profile_id, service_slug, template_id, protocol_document, protocol_version_label, trained_on, supervised_by, recorded_by)
   values ($1, $2, $3, '254-ZZ-902', '1.1', '2026-10-23', 'Proof supervisor', $4) returning id`,
  [OTHER, SLUG, T, OWNER],
)).rows[0].id;
const relayedWithDecidedBy = await refused(
  `insert into eng_training_decisions (record_id, decision, channel, decided_by, approved_by_engineer, relayed_by, approved_at)
   values ($1, 'approved', 'phone_relayed', $2, $2, $3, now())`, [rec2, ENG, OWNER]);
check("a relayed row that carries his decided_by is refused", relayedWithDecidedBy.refused, relayedWithDecidedBy.message.slice(0, 80));
const relayedWithLicence = await refused(
  `insert into eng_training_decisions (record_id, decision, channel, decided_by_license, approved_by_engineer, relayed_by, approved_at)
   values ($1, 'approved', 'phone_relayed', 'PROOF-LIC', $2, $3, now())`, [rec2, ENG, OWNER]);
check("a relayed row that carries a licence is refused", relayedWithLicence.refused);
const portalWithRelay = await refused(
  `insert into eng_training_decisions (record_id, decision, channel, decided_by, relayed_by) values ($1, 'approved', 'portal', $2, $3)`, [rec2, ENG, OWNER]);
check("a portal row that carries a relayer is refused", portalWithRelay.refused);
const relayedRefusal = await refused(
  `insert into eng_training_decisions (record_id, decision, channel, reason, approved_by_engineer, relayed_by, approved_at)
   values ($1, 'refused', 'phone_relayed', 'A relayed refusal is not a thing.', $2, $3, now())`, [rec2, ENG, OWNER]);
check("a relayed row is only ever an approval", relayedRefusal.refused);
const selfRelay = await refused(
  `insert into eng_training_decisions (record_id, decision, channel, approved_by_engineer, relayed_by, approved_at)
   values ($1, 'approved', 'phone_relayed', $2, $2, now())`, [rec2, ENG]);
check("the engineer cannot be his own relayer", selfRelay.refused);
const notEngineer = await refused(
  `insert into eng_training_decisions (record_id, decision, channel, approved_by_engineer, relayed_by, approved_at)
   values ($1, 'approved', 'phone_relayed', $2, $3, now())`, [rec2, TECH, OWNER]);
check("the approver must be an engineer", notEngineer.refused, notEngineer.message.slice(0, 80));
const notAdmin = await refused(
  `insert into eng_training_decisions (record_id, decision, channel, approved_by_engineer, relayed_by, approved_at)
   values ($1, 'approved', 'phone_relayed', $2, $3, now())`, [rec2, ENG, TECH]);
check("the relayer must be an administrator", notAdmin.refused);
const future = await refused(
  `insert into eng_training_decisions (record_id, decision, channel, approved_by_engineer, relayed_by, approved_at)
   values ($1, 'approved', 'phone_relayed', $2, $3, now() + interval '1 day')`, [rec2, ENG, OWNER]);
check("an approval stated as given in the future is refused", future.refused);
const draftDoor = await refused(
  `select eng_record_relayed_training_approval($1, $2, '2026-10-23', 'Proof supervisor', $3, $4, now())`, [OTHER, T_DRAFT, ENG, OWNER]);
check("the door refuses a template that is not in force", draftDoor.refused);
const edit = await refused(`update eng_training_decisions set channel = 'portal' where id = $1`, [decisionId]);
check("and a relayed row can never be edited into a portal row", edit.refused);

/* The written confirmation. */
const pending = await db.query(`select count(*)::int as n from eng_training_confirmations where decision_id = $1`, [decisionId]);
check("no confirmation row: written confirmation pending", pending.rows[0].n === 0);
const portalDecisionId = (await db.query(`select id from eng_training_decisions where channel = 'portal'`)).rows[0].id;
const onPortal = await refused(
  `insert into eng_training_confirmations (decision_id, kind, received_at, body, attached_by) values ($1, 'text', now(), 'Confirmed, the technician is approved.', $2)`,
  [portalDecisionId, OWNER]);
check("a written confirmation does not attach to a portal decision", onPortal.refused);
const byTech = await refused(
  `insert into eng_training_confirmations (decision_id, kind, received_at, body, attached_by) values ($1, 'text', now(), 'Confirmed, the technician is approved.', $2)`,
  [decisionId, TECH]);
check("only an administrator attaches it", byTech.refused);
await db.query(
  `insert into eng_training_confirmations (decision_id, kind, received_at, body, attached_by) values ($1, 'email', now(), 'Confirmed by email: the technician is approved.', $2)`,
  [decisionId, OWNER]);
const second = await refused(
  `insert into eng_training_confirmations (decision_id, kind, received_at, body, attached_by) values ($1, 'text', now(), 'A second confirmation for the same approval.', $2)`,
  [decisionId, OWNER]);
check("it attaches once", second.refused);
const editConf = await refused(`update eng_training_confirmations set body = 'changed after the fact' where decision_id = $1`, [decisionId]);
check("and it is append only", editConf.refused);

/* The portal shows the kind. */
const lib = readSource("src/lib/certification-record.ts");
check("the portal reads the channel, the relayer and the confirmation", /channel/.test(lib) && /eng_training_confirmations/.test(lib));
check("and words the relayed kind exactly as ruled", lib.includes("Approved by the engineer of record by phone, relayed by the owner"));
check("and says written confirmation pending until it is attached", lib.includes("Written confirmation pending"));

console.log("");
if (wrong === 0) {
  console.log("PASS: an approval by phone is its own kind, it counts as approved, and it can never pass for a portal approval.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
