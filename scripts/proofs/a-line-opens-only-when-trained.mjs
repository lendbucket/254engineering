/**
 * A LINE OPENS ONLY WHEN ITS PROTOCOL IS SIGNED AND SOMEBODY IS TRAINED ON THAT
 * VERSION, AND THE TRAINING IS A RECORD IN THE PORTAL.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-line-opens-only-when-trained.mjs
 *
 * Operator ruling of 2026-10-23, migration 0084. The chain is replayed to 0083
 * in an in-process Postgres, interim training events of every kind are written
 * as the 2026-10-07 code wrote them, 0084 is applied, and the backfill, the
 * function the money door asks, and the guards are read back. Then the source:
 * the money door asks the function after the signature, roof keeps its path,
 * and the portal writes the decision row before any certification.
 */
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
const at = files.findIndex((f) => f.startsWith("0084_"));
check("0084 is in the chain", at >= 0, at >= 0 ? files[at] : "missing");
for (const f of files.slice(0, at)) await db.exec(readSource(join(DIR, f)));

const ENG = "00000000-0000-4000-8000-0000000000a1";
const TECH = "00000000-0000-4000-8000-0000000000a2";
const TECH2 = "00000000-0000-4000-8000-0000000000a3";
const ADMIN = "00000000-0000-4000-8000-0000000000a4";
const T11 = "00000000-0000-4000-8000-0000000000b1";
const T10 = "00000000-0000-4000-8000-0000000000b2";
const GONE = "00000000-0000-4000-8000-0000000000b9";
const SLUG = "proof-trained-line";
await db.exec(`
  insert into auth.users (id) values ('${ENG}'), ('${TECH}'), ('${TECH2}'), ('${ADMIN}');
  insert into eng_profiles (id, email, display_name, role, status) values
    ('${ENG}', 'train-eng@audit-probe.invalid', 'Training proof engineer, not a real person', 'engineer', 'active'),
    ('${TECH}', 'train-tech@audit-probe.invalid', 'Training proof technician, not a real person', 'field_tech', 'active'),
    ('${TECH2}', 'train-tech2@audit-probe.invalid', 'Second training proof technician, not a real person', 'field_tech', 'active'),
    ('${ADMIN}', 'train-admin@audit-probe.invalid', 'Training proof administrator, not a real person', 'admin', 'active');
  insert into eng_protocol_templates (id, service_slug, name, version, status, document_number, version_label)
    values ('${T11}', '${SLUG}', 'Proof permit protocol', 2, 'draft', '254-ZZ-901', '1.1'),
           ('${T10}', '${SLUG}', 'Proof permit protocol, earlier', 1, 'draft', '254-ZZ-901', '1.0');
`);

/* The interim events, exactly as certification-record.ts wrote them from 2026-10-07. */
async function event(action, entity, diff) {
  const r = await db.query(
    `insert into eng_audit_events (actor_id, actor_email, actor_role, action, entity_type, entity_id, summary, diff)
     values ($1, 'proof@audit-probe.invalid', 'admin', $2, 'profile', $3, 'proof', $4::jsonb) returning id`,
    [ADMIN, action, entity, JSON.stringify(diff)],
  );
  return Number(r.rows[0].id);
}
const rec = (template, extra = {}) => ({
  service_slug: SLUG, template_id: template, protocol_document: "254-ZZ-901", protocol_version: "1.1",
  trained_on: "2026-10-01", supervised_by: "Proof supervisor", ...extra,
});
const eApproved = await event("certification.training_recorded", TECH, rec(T11));
await event("certification.training_approved", TECH, { record_id: eApproved, service_slug: SLUG });
const eRefused = await event("certification.training_recorded", TECH2, rec(T10, { protocol_version: "1.0" }));
await event("certification.training_refused", TECH2, { record_id: eRefused, service_slug: SLUG, reason: "The supervised inspection did not cover the elevation survey." });
const eWaiting = await event("certification.training_recorded", TECH2, rec(T11));
const eNoTemplate = await event("certification.training_recorded", TECH, rec(GONE));

await db.exec(readSource(join(DIR, files[at])));
check("0084 applies over a database holding interim events", true);

/* The backfill. */
const recs = (await db.query("select source_event_id, profile_id, template_id, protocol_version_label from eng_training_records order by source_event_id")).rows;
check(
  "every interim record whose template exists is carried over once, naming its event",
  recs.map((r) => Number(r.source_event_id)).join(",") === [eApproved, eRefused, eWaiting].join(","),
  recs.map((r) => r.source_event_id).join(","),
);
check("and one naming a template that does not exist is left in the audit log alone", !recs.some((r) => Number(r.source_event_id) === eNoTemplate));
const decs = (await db.query(
  `select r.source_event_id as rec, d.decision, d.reason from eng_training_decisions d join eng_training_records r on r.id = d.record_id order by r.source_event_id`,
)).rows;
check(
  "the approval and the refusal are carried over against their records, the refusal with its reason",
  decs.length === 2 &&
    Number(decs[0].rec) === eApproved && decs[0].decision === "approved" && decs[0].reason === null &&
    Number(decs[1].rec) === eRefused && decs[1].decision === "refused" && /elevation survey/.test(decs[1].reason),
  JSON.stringify(decs),
);
check("and the record still awaiting the engineer has no decision", !decs.some((d) => Number(d.rec) === eWaiting));

/* The function the money door asks. */
const trained = async (slug, template) => (await db.query("select eng_line_is_trained($1, $2) as t", [slug, template])).rows[0].t;
check("an approved record on the in-force template trains the line", (await trained(SLUG, T11)) === true);
check("a refused record trains nothing", (await trained(SLUG, T10)) === false);
check("training on one line trains no other", (await trained("proof-other-line", T11)) === false);

/* The guards. */
const editRec = await refused(`update eng_training_records set supervised_by = 'Somebody else' where source_event_id = ${eApproved}`);
check("a training record cannot be edited", editRec.refused, editRec.message.slice(0, 60));
const delRec = await refused(`delete from eng_training_records where source_event_id = ${eWaiting}`);
check("or deleted", delRec.refused);
const delDec = await refused(`delete from eng_training_decisions`);
check("and nor can a decision", delDec.refused);
const waitingId = (await db.query(`select id from eng_training_records where source_event_id = ${eWaiting}`)).rows[0].id;
const approvedId = (await db.query(`select id from eng_training_records where source_event_id = ${eApproved}`)).rows[0].id;
const second = await refused(`insert into eng_training_decisions (record_id, decision) values ($1, 'approved')`, [approvedId]);
check("a record already decided cannot be decided again", second.refused, second.message.slice(0, 60));
const bareRefusal = await refused(`insert into eng_training_decisions (record_id, decision, reason) values ($1, 'refused', 'no')`, [waitingId]);
check("a refusal without his reason is refused", bareRefusal.refused);
const reasonedApproval = await refused(`insert into eng_training_decisions (record_id, decision, reason) values ($1, 'approved', 'A reason on an approval')`, [waitingId]);
check("and an approval carries no reason", reasonedApproval.refused);
const shortSupervisor = await refused(
  `insert into eng_training_records (profile_id, service_slug, template_id, protocol_document, protocol_version_label, trained_on, supervised_by)
   values ($1, $2, $3, '254-ZZ-901', '1.1', '2026-10-02', 'x')`,
  [TECH, SLUG, T11],
);
check("a record names who supervised", shortSupervisor.refused);

/* An approval written now trains its line; a suspended technician trains nothing. */
await db.query(`insert into eng_training_decisions (record_id, decision, decided_by) values ($1, 'approved', $2)`, [waitingId, ENG]);
await db.query(`update eng_profiles set status = 'suspended' where id = $1`, [TECH]);
check("with the first technician suspended, the second's approval still trains the line", (await trained(SLUG, T11)) === true);
await db.query(`update eng_profiles set status = 'suspended' where id = $1`, [TECH2]);
check("and with nobody trained left active, the line is untrained", (await trained(SLUG, T11)) === false);

const exec = (await db.query(
  `select has_function_privilege('anon', 'public.eng_line_is_trained(text,uuid)', 'EXECUTE') as anon,
          has_function_privilege('authenticated', 'public.eng_line_is_trained(text,uuid)', 'EXECUTE') as authed`,
)).rows[0];
check("nobody signed out or signed in as a customer can call the function", !exec.anon && !exec.authed);

/* The source: the money door, roof, and the portal's order of writes. */
const gate = readFileSync("src/lib/line-gate.ts", "utf8");
check(
  "the money door asks the training record only after the signature is confirmed",
  /if \(status\.state !== "signed"\) return closed\([^\n]*\n\s*return trainedInDatabase\(serviceSlug, received\.documentNumber, received\.version\);/.test(gate),
);
check("and asks it through eng_line_is_trained, of the template in force", /db\.rpc\("eng_line_is_trained"/.test(gate) && /\.eq\("status", "published"\)/.test(gate));
check("roof keeps its own path, returned before any training read", /if \(registered\?\.declaration\.documentNumber === "254-RC-001"\) return rc001Signed\("254-RC-001"\);/.test(gate));
const cert = readFileSync("src/lib/certification-record.ts", "utf8");
const decisionAt = cert.indexOf('from("eng_training_decisions").insert(');
const certifyAt = cert.indexOf('from("eng_certifications").upsert(');
check("the portal writes the decision row before any certification", decisionAt > 0 && certifyAt > decisionAt);
check("and records a training as a row", cert.includes('.from("eng_training_records")\n    .insert('));

console.log("");
if (wrong === 0) {
  console.log("PASS: a line opens only when signed and trained, and the training is a record in the portal.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
