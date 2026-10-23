/**
 * A STRUCTURAL LETTER FOR PERMIT DETERMINATION RECORDS ITS OPTION AND ITS
 * SCHEDULE, AND A B WITH AN EMPTY SCHEDULE CANNOT BE RECORDED.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-permit-letter-determination-records-its-option.mjs
 *
 * Operator ruling of 2026-10-22 from the engineer's email (migration 0083):
 * A a pass with no conditions, B a pass with the condition listed in the
 * schedule and sealing refused if it is empty, C repairs required. The real
 * decision function (eng_record_review_decision, 0083's) is called inside a
 * transaction in an in-process Postgres with every migration replayed, as
 * a-decision-and-its-credit-are-one-write.mjs does, and rolled back.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { readSource } from "../lib/read-source.mjs";
import { SUPABASE_REPLAY_STUBS } from "../lib/replay-stubs.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* 0083 is what its generator writes today: 0068's function, one insert changed. */
{
  const gen = spawnSync(process.execPath, ["scripts/emit-pl-determination-migration.mjs"], { encoding: "utf8" });
  const file = readFileSync("supabase/migrations/0083_a_permit_letter_records_its_option_and_schedule.sql", "utf8");
  check("0083 is exactly what its generator writes from 0068 today", gen.status === 0 && gen.stdout === file, gen.status === 0 ? "identical" : gen.stderr.slice(0, 100));
}

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) await db.exec(readSource(join(DIR, f)));
check("every migration replays, 0083 included", files.some((f) => f.startsWith("0083_")), `${files.length} files, last ${files.at(-1)}`);

const ENG = "00000000-0000-4000-8000-0000000000e1";
const CLIENT = "00000000-0000-4000-8000-0000000000e2";
await db.exec(`
  insert into auth.users (id) values ('${ENG}');
  insert into eng_profiles (id, email, display_name, role) values ('${ENG}', 'pl-proof@audit-probe.invalid', 'Permit letter proof engineer, not a real person', 'engineer');
  insert into eng_clients (id, kind, name) values ('${CLIENT}', 'individual', 'Permit letter proof client, not a real person');
`);

let n = 0;
async function file(slug) {
  n += 1;
  const id = `00000000-0000-4000-8000-00000000f0${String(n).padStart(2, "0")}`;
  const session = `00000000-0000-4000-8000-00000000a0${String(n).padStart(2, "0")}`;
  await db.exec(`
    insert into eng_files (id, file_number, client_id, service_slug, deliverable, property_address, county, status)
    values ('${id}', '254-PLPROOF-${n}', '${CLIENT}', '${slug}', 'standard', '1 Fictional Way', 'Fictional', 'under_review');
    insert into eng_review_sessions (id, file_id, engineer_id) values ('${session}', '${id}', '${ENG}');
  `);
  return { id, session };
}

/* One decision, rolled back. Returns the determination row written, or the refusal. */
async function decide({ protocol = "254-PL-001", slug = "structural-letters", determination, option = null, conditions = [], repairs = [] }) {
  const f = await file(slug);
  const action = determination === "repairs-required" ? "repairs" : determination === "pass" ? "seal" : "revisions";
  const p = {
    file_id: f.id,
    expected_status: "under_review",
    action,
    target_status: { revisions: "revisions_requested", repairs: "repairs_required", seal: null }[action],
    stamp_column: action === "repairs" ? "repairs_required_at" : null,
    note: null,
    actor_id: ENG,
    actor_email: "pl-proof@audit-probe.invalid",
    actor_role: "engineer",
    transition_summary: "proof",
    decision_summary: "proof",
    determination: {
      protocol_document: protocol, determination, relied_on_item_keys: ["probe"],
      relied_on_evidence_ids: ["00000000-0000-4000-8000-0000000000e9"], note: null,
      letter_option: option, letter_conditions: conditions,
    },
    repairs,
    session: { id: f.session, minutes: 5 },
    charge_log: { property_address: "1 Fictional Way", county: "Fictional", revision_count: 0, site_visit: false, period: "2026-10" },
    credit: null,
    job: null,
  };
  await db.exec("begin");
  try {
    await db.query("select eng_record_review_decision($1::jsonb)", [JSON.stringify(p)]);
    const row = (await db.query("select letter_option, letter_conditions from eng_determinations where file_id = $1", [f.id])).rows[0];
    return { ok: true, row };
  } catch (e) {
    return { ok: false, why: e.message };
  } finally {
    await db.exec("rollback");
  }
}

const a = await decide({ determination: "pass", option: "A" });
check("A: a pass with no conditions is recorded as option A", a.ok && a.row.letter_option === "A" && a.row.letter_conditions.length === 0, a.ok ? JSON.stringify(a.row) : a.why);
const b = await decide({ determination: "pass", option: "B", conditions: ["Live load limited to 40 psf."] });
check(
  "B: a pass with a condition is recorded as option B, with the condition in its schedule",
  b.ok && b.row.letter_option === "B" && b.row.letter_conditions[0] === "Live load limited to 40 psf.",
  b.ok ? JSON.stringify(b.row) : b.why,
);
const c = await decide({ determination: "repairs-required", option: "C", repairs: ["Install the missing hanger at the header."] });
check("C: repairs required is recorded as option C", c.ok && c.row.letter_option === "C", c.ok ? JSON.stringify(c.row) : c.why);

const bEmpty = await decide({ determination: "pass", option: "B", conditions: [] });
check("B with an empty schedule cannot be recorded at all, so no sealing step can be handed one", !bEmpty.ok, bEmpty.ok ? "RECORDED" : bEmpty.why.slice(0, 80));
const bBlank = await decide({ determination: "pass", option: "B", conditions: ["   "] });
check("and nor can B whose only condition is blank", !bBlank.ok && /blank/.test(bBlank.why), bBlank.ok ? "RECORDED" : bBlank.why.slice(0, 80));
const aWith = await decide({ determination: "pass", option: "A", conditions: ["Install the specified hanger."] });
check("A with a condition is refused: A says there is none", !aWith.ok, aWith.ok ? "RECORDED" : "refused");
const passNone = await decide({ determination: "pass", option: null });
check("a pass with no option is refused: he chooses A or B", !passNone.ok, passNone.ok ? "RECORDED" : "refused");
const passC = await decide({ determination: "pass", option: "C" });
check("a pass cannot carry option C", !passC.ok, passC.ok ? "RECORDED" : "refused");
const revise = await decide({ determination: "revise", option: null });
check("revise records no option", revise.ok && revise.row.letter_option === null, revise.ok ? JSON.stringify(revise.row) : revise.why);
const reviseB = await decide({ determination: "revise", option: "B", conditions: ["x"] });
check("and cannot carry one", !reviseB.ok, reviseB.ok ? "RECORDED" : "refused");
const roof = await decide({ protocol: "254-RC-001", slug: "roof-inspections", determination: "pass", option: "A" });
check("a roof determination cannot carry a permit letter option", !roof.ok, roof.ok ? "RECORDED" : "refused");
const roofPlain = await decide({ protocol: "254-RC-001", slug: "roof-inspections", determination: "pass" });
check("while a roof determination without one records as before", roofPlain.ok && roofPlain.row.letter_option === null, roofPlain.ok ? "recorded" : roofPlain.why);

console.log("");
if (wrong === 0) {
  console.log("PASS: a permit letter determination records its option and schedule, and B with an empty schedule cannot be recorded.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
