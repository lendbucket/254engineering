// @runtime react-server
//
// Declared because it imports src/lib/letter-facts.ts and src/lib/ops-engineer.ts, which carry server-only.

/**
 * A NEW FILE AND AN OLD REVIEW ARE NOT STARVED BY A WINDOW.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-new-file-and-an-old-review-are-not-starved-by-a-window.mjs
 *
 * Section 6 of Robert's audit of 2026-10-24 (class B, severity 2):
 *
 *   - filesAwaitingTriage read the oldest 200 open permit letter files and only
 *     then dropped the triaged ones, so once 200 triaged files were still open
 *     a new file never reached the engineer's triage list (the B2 shape);
 *   - uncreditedReviewsRead read the newest 500 decided reviews, so an older
 *     review that was never credited dropped off the administrators' list.
 *
 * Every migration is replayed into PGlite and served as PostgREST
 * (scripts/lib/replay-rest.mjs), so the real filters and the real paging
 * answer. Nothing reaches development.
 */
import { readdirSync } from "node:fs";
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
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) await db.exec(readSource(join(DIR, f)));
check("every migration replays", files.length > 0, `${files.length} files`);

const ENG = "00000000-0000-4000-8000-00000000e001";
const CLIENT = "00000000-0000-4000-8000-00000000c001";
const REVIEWED = "00000000-0000-4000-8000-00000000f001";
await db.exec(`
  insert into auth.users (id) values ('${ENG}');
  insert into eng_profiles (id, email, display_name, role) values ('${ENG}', 'starvation-proof@audit-probe.invalid', 'Starvation proof engineer, not a real person', 'engineer');
  insert into eng_clients (id, kind, name) values ('${CLIENT}', 'individual', 'Starvation proof client, not a real person');

  /* 220 open permit letter files, the oldest, each already triaged; then 30 newer ones nobody has triaged. */
  insert into eng_files (id, file_number, client_id, service_slug, property_address, county, status, created_at)
    select gen_random_uuid(), '254-PROOF-TRI-' || g, '${CLIENT}', 'structural-letters', g || ' Triage Way', 'Nueces', 'intake', now() - interval '400 days' + (g || ' hours')::interval
      from generate_series(1, 250) g;
  insert into eng_job_triage (file_id, basis, decided_by)
    select id, 'desk', '${ENG}' from eng_files where file_number like '254-PROOF-TRI-%' and property_address in (
      select g || ' Triage Way' from generate_series(1, 220) g);

  /* One file reviewed 520 times: the 10 oldest decisions were never credited, the newest 510 were. */
  insert into eng_files (id, file_number, client_id, service_slug, deliverable, property_address, county, status)
    values ('${REVIEWED}', '254-PROOF-REV-1', '${CLIENT}', 'roof-certification', null, '1 Review Way', 'Nueces', 'under_review');
  insert into eng_review_sessions (file_id, engineer_id, started_at, ended_at, decision)
    select '${REVIEWED}', '${ENG}', now() - (g || ' hours')::interval, now() - (g || ' hours')::interval + interval '10 minutes', 'seal'
      from generate_series(1, 520) g;
  insert into eng_production_ledger (engineer_id, file_id, amount_cents, review_session_id, decision)
    select '${ENG}', '${REVIEWED}', 0, id, 'seal' from eng_review_sessions
      where file_id = '${REVIEWED}' order by ended_at desc limit 510;
`);

const rest = await startReplayRest(db, PORTS.replayRest);
process.env.SUPABASE_URL = rest.url;
process.env.SUPABASE_SERVICE_ROLE_KEY = "replay-stand-in";
try {
  const { filesAwaitingTriage } = await import("../../src/lib/letter-facts.ts");
  const triage = await filesAwaitingTriage();
  const listed = triage.ok ? triage.files.map((f) => f.fileNumber) : [];
  check("the triage list reads", triage.ok, triage.ok ? `${listed.length} listed` : triage.error);
  check("every one of the 30 untriaged files is listed past 220 older triaged ones", listed.length === 30, `${listed.length}`);
  check("and no triaged file is", listed.every((n) => Number(n.replace("254-PROOF-TRI-", "")) > 220));

  const { uncreditedReviewsRead } = await import("../../src/lib/ops-engineer.ts");
  const uncredited = await uncreditedReviewsRead();
  check("the uncredited reviews read", Array.isArray(uncredited), uncredited === null ? "null" : `${uncredited.length} listed`);
  check("every one of the 10 oldest uncredited reviews is listed past 510 newer credited ones", uncredited?.length === 10, `${uncredited?.length}`);
} finally {
  await rest.close();
}
await db.close();

console.log("");
if (wrong) {
  console.log(`FAIL: ${wrong} check${wrong === 1 ? "" : "s"} wrong.`);
  process.exit(1);
}
console.log("PASS: a new file and an old review are not starved by a window.");
