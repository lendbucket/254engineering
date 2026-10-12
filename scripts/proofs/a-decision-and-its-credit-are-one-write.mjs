/**
 * A DECIDED REVIEW AND ITS CREDIT ARE ONE WRITE, OR NONE.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-decision-and-its-credit-are-one-write.mjs
 *
 * Operator rulings of 2026-10-10: the decision and the credit are one database
 * function (eng_record_review_decision, migration 0068), so a decided review
 * and its ledger row are written in the same transaction or not at all; the
 * outside work is enqueued in eng_jobs in that transaction; and a proof calls
 * the real function inside a transaction, reads what it wrote, rolls back, and
 * proves nothing remains.
 *
 * WHERE THE TRANSACTION RUNS, AND WHY NOT DEVELOPMENT. The ruling said the
 * proof connects to development directly. This repository holds no Postgres
 * client and no database URL for development, only the PostgREST key, and
 * PostgREST cannot hold a transaction open across calls. So this replays EVERY
 * migration, 0068 included, into an in-process Postgres (PGlite, the engine
 * migration-audit already replays into), and runs the real function there
 * inside BEGIN and ROLLBACK. It is the real function on the real schema with
 * real transaction semantics; what it is not is development's data. Reported to
 * the operator with what would close the gap: a development database URL.
 *
 * THE CREDIT IS THE REAL PATH'S FIGURE. Each amount is computed by
 * src/config/engineer-pay.ts (tierForDeliverable, engineerPayCents), the home
 * productionCreditFor reads, and compared against the agreement's tier pay
 * written here as literals.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "../lib/read-source.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const AGREED = { 1: 17_500, 2: 35_000, 3: 52_500 };
const { tierForDeliverable, engineerPayCents } = await import("../../src/config/engineer-pay.ts");

/* ------------------------------------------------------------ the database */

const db = new PGlite();
await db.exec(`
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key);
  create schema if not exists storage;
  create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
`);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) await db.exec(readSource(join(DIR, f)));
check("every migration replays, 0068 included", files.some((f) => f.startsWith("0068_")), `${files.length} files`);

const ENG = "00000000-0000-4000-8000-0000000000e1";
const CLIENT = "00000000-0000-4000-8000-0000000000e2";
await db.exec(`
  insert into auth.users (id) values ('${ENG}');
  insert into eng_profiles (id, email, display_name, role) values ('${ENG}', 'decision-proof@audit-probe.invalid', 'Decision proof engineer, not a real person', 'engineer');
  insert into eng_clients (id, kind, name) values ('${CLIENT}', 'individual', 'Decision proof client, not a real person');
`);

let n = 0;
async function file(slug, deliverable) {
  n += 1;
  const id = `00000000-0000-4000-8000-00000000f0${String(n).padStart(2, "0")}`;
  const session = `00000000-0000-4000-8000-00000000a0${String(n).padStart(2, "0")}`;
  await db.exec(`
    insert into eng_files (id, file_number, client_id, service_slug, deliverable, property_address, county, status)
    values ('${id}', '254-PROOF-${n}', '${CLIENT}', '${slug}', ${deliverable ? `'${deliverable}'` : "null"}, '1 Proof Way', 'Nueces', 'under_review');
    insert into eng_review_sessions (id, file_id, engineer_id) values ('${session}', '${id}', '${ENG}');
  `);
  return { id, session, slug, deliverable };
}

function params(f, action, extra = {}) {
  const tier = tierForDeliverable(f.slug, f.deliverable);
  const cents = tier === null ? null : engineerPayCents(tier);
  return {
    file_id: f.id,
    expected_status: "under_review",
    action,
    target_status: { revisions: "revisions_requested", refuse: "refused", repairs: "repairs_required", seal: null }[action],
    stamp_column: { refuse: "refused_at", repairs: "repairs_required_at" }[action] ?? null,
    note: action === "refuse" ? "Declined by the proof, never a real decision." : null,
    actor_id: ENG,
    actor_email: "decision-proof@audit-probe.invalid",
    actor_role: "engineer",
    transition_summary: "proof",
    decision_summary: "proof",
    determination: null,
    repairs: [],
    session: { id: f.session, minutes: 12 },
    charge_log: { property_address: "1 Proof Way", county: "Nueces", revision_count: 0, site_visit: false, period: "2026-10" },
    credit: cents === null ? null : { amount_cents: cents, period: "2026-10", note: `proof, tier ${tier}` },
    job: null,
    ...extra,
    _tier: tier,
  };
}

async function call(p) {
  const { _tier, ...body } = p;
  return db.query("select eng_record_review_decision($1::jsonb) as r", [JSON.stringify(body)]);
}
const count = async (sql) => Number((await db.query(sql)).rows[0].n);

/* ------------------------------------------- 1. one per tier, rolled back */

const CASES = [
  [await file("roof-inspections", "standard"), 1],
  [await file("manufactured-home-foundation-certifications", "standard"), 2],
  [await file("windstorm-wpi-8", "ongoing"), 3],
];
for (const [f, tier] of CASES) {
  const p = params(f, "revisions");
  await db.exec("begin");
  try {
    await call(p);
    const { rows } = await db.query(
      `select amount_cents, note, decision, review_session_id from eng_production_ledger where file_id = $1`,
      [f.id],
    );
    const status = (await db.query(`select status from eng_files where id = $1`, [f.id])).rows[0].status;
    const log = await count(`select count(*) as n from eng_responsible_charge_log where file_id = '${f.id}'`);
    check(
      `tier ${tier}: inside the transaction the decision wrote its credit of $${(AGREED[tier] / 100).toFixed(2)}, its charge log row and its status move`,
      rows.length === 1 && Number(rows[0].amount_cents) === AGREED[tier] && rows[0].note.endsWith(`tier ${tier}`) &&
        rows[0].review_session_id === f.session && log === 1 && status === "revisions_requested",
      `${rows.length} ledger row(s), ${rows[0]?.amount_cents} cents, "${rows[0]?.note}", ${log} log row(s), status ${status}`,
    );
  } finally {
    await db.exec("rollback");
  }
  const left =
    (await count(`select count(*) as n from eng_production_ledger where file_id = '${f.id}'`)) +
    (await count(`select count(*) as n from eng_responsible_charge_log where file_id = '${f.id}'`)) +
    (await count(`select count(*) as n from eng_file_events where file_id = '${f.id}'`));
  const status = (await db.query(`select status from eng_files where id = $1`, [f.id])).rows[0].status;
  check(`tier ${tier}: after the rollback nothing remains and the file is where it was`, left === 0 && status === "under_review", `${left} row(s), status ${status}`);
}

/* ---------------- 2. a refusal enqueues its outside work, and a rollback leaves none */

{
  const f = await file("roof-inspections", "standard");
  const job = {
    kind: "review.after_decision",
    payload: { fileId: f.id, action: "refuse", decisionId: "proof" },
    idempotency_key: "decision-proof-key",
    effect_mode: "no_external_effect",
  };
  await db.exec("begin");
  try {
    const r = await call(params(f, "refuse", { job }));
    const jobId = r.rows[0].r.job_id;
    const inside = await count(`select count(*) as n from eng_jobs where idempotency_key = 'decision-proof-key'`);
    check("a refusal enqueues its outside work in the same transaction", inside === 1 && jobId !== null, `${inside} job(s)`);
  } finally {
    await db.exec("rollback");
  }
  const after = await count(`select count(*) as n from eng_jobs where idempotency_key = 'decision-proof-key'`);
  const credits = await count(`select count(*) as n from eng_production_ledger where file_id = '${f.id}'`);
  check("and a rolled back decision leaves no queued job and no credit", after === 0 && credits === 0, `${after} job(s), ${credits} credit(s)`);
}

/* ------------------------------------------- 3. all or nothing, for real */

{
  const f = await file("roof-inspections", "standard");
  /*
   * A credit that cannot write must take the whole decision with it. NO
   * BEGIN AND NO ROLLBACK OF OURS HERE: the call runs in autocommit, and the
   * failure comes at the ledger insert, after the status move, the file event
   * and the charge log row have been written. If anything remains afterwards,
   * the function is not one write. (The first version used a negative amount,
   * which the ledger accepts, and wrapped it in its own rollback, so it passed
   * on the rollback rather than on the function; the check below caught that.)
   */
  const p = params(f, "revisions", { credit: { amount_cents: "not a number", period: "2026-10", note: "x" } });
  let refused = null;
  try {
    await call(p);
  } catch (err) {
    refused = err instanceof Error ? err.message : String(err);
  }
  const left =
    (await count(`select count(*) as n from eng_responsible_charge_log where file_id = '${f.id}'`)) +
    (await count(`select count(*) as n from eng_file_events where file_id = '${f.id}'`));
  const status = (await db.query(`select status from eng_files where id = $1`, [f.id])).rows[0].status;
  const ledgerRefusesNegative = refused !== null;
  check(
    "a credit the ledger refuses takes the whole decision with it: no charge log row, no status move",
    left === 0 && status === "under_review",
    ledgerRefusesNegative ? `refused: ${refused.split("\n")[0].slice(0, 90)}` : "the bad credit was ACCEPTED, so this case did not exercise a failure",
  );
  check("and that failure was a real refusal, not a pass by accident", ledgerRefusesNegative);
}

/* --------------------------- 4. the file moved under the rules: nothing written */

{
  const f = await file("roof-inspections", "standard");
  let refused = null;
  try {
    await call(params(f, "revisions", { expected_status: "evidence_submitted" }));
  } catch (err) {
    refused = err instanceof Error ? err.message : String(err);
  }
  const left = await count(`select count(*) as n from eng_responsible_charge_log where file_id = '${f.id}'`);
  check("a decision judged against a status the file no longer has is refused and writes nothing", refused !== null && /moved/.test(refused) && left === 0, refused ? refused.split("\n")[0].slice(0, 90) : "it was ACCEPTED");
}

/* ------------------- 5. a repairs decision records, which 0004's checks forbade */

{
  const f = await file("roof-inspections", "standard");
  let error = null;
  await db.exec("begin");
  try {
    await call(params(f, "repairs"));
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  const rows = error ? 0 : await count(`select count(*) as n from eng_production_ledger where file_id = '${f.id}' and decision = 'repairs'`);
  await db.exec("rollback");
  check("a repairs decision writes its credit and its charge log row (0004 allowed only four actions)", error === null && rows === 1, error ? error.split("\n")[0].slice(0, 100) : `${rows} credit row(s)`);
}

await db.close();
console.log("");
if (wrong === 0) {
  console.log("PASS: a decided review and its credit are one write, and a rolled back decision leaves nothing, not even a queued job.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
