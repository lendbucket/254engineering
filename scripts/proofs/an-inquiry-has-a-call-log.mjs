// @runtime react-server
//
// Declared because it imports src/lib/ops-contact-log.ts, which carries server-only.

/**
 * AN INQUIRY HAS A CALL LOG (0136). Office-ready Batch B: a call log entry is
 * one click from any record (Robert, 2026-10-20), and an inquiry had none.
 * "An inquiry" is three records, and all three get one (autopilot question 21).
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/an-inquiry-has-a-call-log.mjs
 *
 * Replayed to the end of the chain, the real logContact and contactLogFor asked
 * through the replay REST server, as a rep:
 *   1. a call on the inbox's inquiry, a design brief and a windstorm brief is
 *      written against that record and read back from it alone;
 *   2. the database refuses a row naming two subjects, and a row whose
 *      subject_type names a different column from the one filled;
 *   3. the four subjects 0079 knew still write (a client);
 *   4. a role that cannot open an inquiry's screen cannot read its log;
 *   5. by source: the inbox, the design briefs and the windstorm briefs each
 *      open the log from the row.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const { readSource } = await import("../lib/read-source.mjs");
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");
const { PORTS } = await import("../lib/ports.mjs");
const { startReplayRest } = await import("../lib/replay-rest.mjs");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
for (const f of readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()) await db.exec(readSource(join(DIR, f)));

const REP = "00000000-0000-4000-8000-00000000a401";
const TECH = "00000000-0000-4000-8000-00000000a402";
const CLIENT = "00000000-0000-4000-8000-00000000b401";
const LEAD = "00000000-0000-4000-8000-00000000d401";
const DESIGN = "00000000-0000-4000-8000-00000000d402";
const WIND = "00000000-0000-4000-8000-00000000d403";
await db.exec(`
  insert into auth.users (id) values ('${REP}'), ('${TECH}');
  insert into eng_profiles (id, email, display_name, role, status) values
    ('${REP}', 'inquiry-log-rep@audit-probe.invalid', 'Inquiry log proof rep, not a real person', 'rep', 'active'),
    ('${TECH}', 'inquiry-log-tech@audit-probe.invalid', 'Inquiry log proof technician, not a real person', 'field_tech', 'active');
  insert into eng_clients (id, kind, name, email) values ('${CLIENT}', 'individual', 'Inquiry log proof client, not a real person', 'inquiry-log-client@audit-probe.invalid');
  insert into eng_leads (id, site, form, name, email) values ('${LEAD}', '254engineering', 'contact', 'Inquiry log proof lead, not a real person', 'inquiry-log-lead@audit-probe.invalid');
  insert into eng_design_inquiries (id, name, email, asking_as, work_kind, deliverable, property_address, open_insurance_claim, active_litigation, prior_adverse_report)
    values ('${DESIGN}', 'Inquiry log proof design brief', 'inquiry-log-design@audit-probe.invalid', 'owner', 'repair', 'sealed_letter', '1 Proof Lane', false, false, false);
  insert into eng_windstorm_inquiries (id, name, email, asking_as, property_address, work_done, what_is_covered, openings_rated, will_open_up, open_insurance_claim, active_litigation, prior_adverse_report)
    values ('${WIND}', 'Inquiry log proof windstorm brief', 'inquiry-log-wind@audit-probe.invalid', 'owner', '2 Proof Lane', 'A re-roof', 'Nothing', 'unknown', 'yes', false, false, false);
`);

const rest = await startReplayRest(db, PORTS.replayRest);
process.env.SUPABASE_URL = rest.url;
process.env.SUPABASE_SERVICE_ROLE_KEY = "replay-stand-in";
delete process.env.VERCEL_ENV;
try {
  const { actionsFor } = await import("../../src/lib/ops-authz.ts");
  const log = await import("../../src/lib/ops-contact-log.ts");
  const actor = (uid, role) => ({ id: uid, role, status: "active", email: `${role}@audit-probe.invalid`, grants: new Set(actionsFor(role)) });
  const rep = actor(REP, "rep");
  const tech = actor(TECH, "field_tech");

  for (const [subject, id, label] of [
    ["lead", LEAD, "the inbox's inquiry"],
    ["design_inquiry", DESIGN, "a design brief"],
    ["windstorm_inquiry", WIND, "a windstorm brief"],
  ]) {
    const wrote = await log.logContact(rep, { subject, subjectId: id, channel: "call", direction: "outbound", outcome: "reached", body: `Called about ${label}.` });
    /*
     * Read back from the database by the subject's own column. contactLogFor's
     * join to the author's name is one the replay stand-in does not serve; its
     * key is checked by source below, on the same column map.
     */
    const rows = (await db.query(`select body, subject_type from eng_contact_log where ${subject}_id = $1`, [id])).rows;
    check(
      `a call on ${label} is written against it and read back from it`,
      wrote.ok && rows.length === 1 && rows[0].body === `Called about ${label}.` && rows[0].subject_type === subject,
      wrote.ok ? `${rows.length} row(s)` : wrote.error,
    );
  }
  const row = (await db.query(`select subject_type, lead_id, design_inquiry_id, windstorm_inquiry_id, client_id from eng_contact_log where lead_id = $1`, [LEAD])).rows[0];
  check("the row names its subject and only its subject", row?.subject_type === "lead" && row.design_inquiry_id === null && row.windstorm_inquiry_id === null && row.client_id === null);

  const client = await log.logContact(rep, { subject: "client", subjectId: CLIENT, channel: "note", body: "A note on the client, which 0079 already allowed." });
  check("the subjects 0079 knew still write", client.ok, client.ok ? "" : client.error);

  const techRead = await log.contactLogFor(tech, "design_inquiry", DESIGN);
  check("a role that cannot open an inquiry's screen cannot read its log", !techRead.ok);

  const refused = async (sql) => {
    try {
      await db.exec(sql);
      return false;
    } catch {
      return true;
    }
  };
  check(
    "the database refuses a row naming two subjects",
    await refused(`insert into eng_contact_log (by_id, subject_type, lead_id, design_inquiry_id, channel, body) values ('${REP}', 'lead', '${LEAD}', '${DESIGN}', 'note', 'two subjects')`),
  );
  check(
    "and a row whose type names a different column from the one filled",
    await refused(`insert into eng_contact_log (by_id, subject_type, lead_id, channel, body) values ('${REP}', 'design_inquiry', '${LEAD}', 'note', 'mismatched')`),
  );
  check(
    "and a subject the log does not know",
    await refused(`insert into eng_contact_log (by_id, subject_type, lead_id, channel, body) values ('${REP}', 'inquiry', '${LEAD}', 'note', 'unknown type')`),
  );
} finally {
  await rest.close?.();
}

/* By source: the read and the write key every subject on one column map, and each screen opens the log from the row. */
const lib = readFileSync("src/lib/ops-contact-log.ts", "utf8");
check(
  "the log maps each inquiry to its own column and table",
  /lead: "lead_id",\s*design_inquiry: "design_inquiry_id",\s*windstorm_inquiry: "windstorm_inquiry_id",/.test(lib) &&
    /lead: "eng_leads",\s*design_inquiry: "eng_design_inquiries",\s*windstorm_inquiry: "eng_windstorm_inquiries",/.test(lib),
);
check("and the history is read by that column", /\.eq\(COLUMN\[subject\], subjectId\)/.test(lib));
check(
  "an inquiry's log is read by whoever may open its screen",
  /if \(subject === "lead"\) return can\(actor, "inbox\.read"\);/.test(lib) &&
    /if \(subject === "design_inquiry" \|\| subject === "windstorm_inquiry"\) return can\(actor, "files\.create"\);/.test(lib),
);
const code = (path) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const inbox = code("src/app/portal/(app)/inbox/page.tsx");
check(
  "the inbox maps each kind to its log, contact and waitlist to the lead",
  /contact: "lead",\s*waitlist: "lead",\s*design: "design_inquiry",\s*windstorm: "windstorm_inquiry",\s*reply: null,/.test(inbox) &&
    /<ContactLogPanel actor=\{actor\} subject=\{logSubject\} subjectId=\{logId\}/.test(inbox) && /Calls and notes/.test(inbox),
);
/* The Batch B walk of 2026-11-14 found the link carrying the kind twice ("contact:contact:<id>"): the row id is already kind:id. */
check(
  "the inbox's link names the record by its own id, once",
  /rows=\{shown\.map\(\(i\) => \(\{ \.\.\.i, recordId: i\.id, id: `\$\{i\.kind\}:\$\{i\.id\}` \}\)\)\}/.test(inbox) &&
    /log: `\$\{i\.kind\}:\$\{\(i as InboxItem & \{ recordId\?: string \}\)\.recordId \?\? i\.id\}`/.test(inbox),
);
for (const [path, subject] of [
  ["src/app/portal/(app)/inquiries/page.tsx", "design_inquiry"],
  ["src/app/portal/(app)/windstorm-inquiries/page.tsx", "windstorm_inquiry"],
]) {
  const page = code(path);
  check(`${path.split("/")[4]} opens its brief's log from the row`, new RegExp(`<ContactLogInRow[\\s\\S]*?subject="${subject}"[\\s\\S]*?open=\\{params\\.log === r\\.id\\}`).test(page));
}

console.log(wrong === 0 ? "\nAn inquiry has a call log, one click from its row." : `\n${wrong} check(s) wrong.`);
await db.close();
process.exitCode = wrong === 0 ? 0 : 1;
