// @runtime react-server
//
// Declared because it imports src/lib/ops-job-billing.ts, which carries server-only.

/**
 * NEEDS TRAVEL HOLDS THE LINK UNTIL IT IS SET, THEN SENDS IT AND TELLS THE REP.
 * Robert's ruling of 2026-11-14, on the after walk's finding that a rep cannot
 * set travel.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/needs-travel-holds-the-link-until-it-is-set.mjs
 *
 * Replayed to the end of the chain, the real functions asked through the replay
 * REST server, as a rep and as an administrator:
 *   1. the rep asks: a pending request, one task to the administrator naming
 *      the county and the file; a second press changes nothing;
 *   2. the rep cannot set the amount; the request is still pending;
 *   3. the administrator sets it: the request is answered, the link is sent
 *      (here it is refused by the shut gate, which is the point of reading the
 *      task: the rep is told either way), and the rep has a task saying so;
 *   4. once travel is set, nobody can ask again;
 *   5. by source: sendPaymentLink refuses with the rep's sentence while a
 *      request is pending, and take_job's Needs travel holds the link.
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

const ADMIN = "00000000-0000-4000-8000-00000000a201";
const REP = "00000000-0000-4000-8000-00000000a202";
const CLIENT = "00000000-0000-4000-8000-00000000b201";
const FILE = "00000000-0000-4000-8000-00000000c201";
await db.exec(`
  insert into auth.users (id) values ('${ADMIN}'), ('${REP}');
  insert into eng_profiles (id, email, display_name, role, status) values
    ('${ADMIN}', 'travel-ask-admin@audit-probe.invalid', 'Needs travel proof administrator, not a real person', 'admin', 'active'),
    ('${REP}', 'travel-ask-rep@audit-probe.invalid', 'Needs travel proof rep, not a real person', 'rep', 'active');
  insert into eng_clients (id, kind, name, email) values ('${CLIENT}', 'individual', 'Needs travel proof client, not a real person', 'travel-ask-client@audit-probe.invalid');
  insert into eng_files (id, file_number, client_id, service_slug, deliverable, property_address, county, status, client_price_cents, payment_intent)
    values ('${FILE}', '254-PROOF-NT-1', '${CLIENT}', 'roof-inspections', 'standard', '1 Needs Travel Way', 'Bell', 'intake', 70900, 'unset');
`);

const rest = await startReplayRest(db, PORTS.replayRest);
process.env.SUPABASE_URL = rest.url;
process.env.SUPABASE_SERVICE_ROLE_KEY = "replay-stand-in";
delete process.env.VERCEL_ENV;
try {
  const { actionsFor } = await import("../../src/lib/ops-authz.ts");
  const billing = await import("../../src/lib/ops-job-billing.ts");
  const actor = (id, role, email) => ({ id, role, status: "active", email, grants: new Set(actionsFor(role)) });
  const admin = actor(ADMIN, "admin", "travel-ask-admin@audit-probe.invalid");
  const rep = actor(REP, "rep", "travel-ask-rep@audit-probe.invalid");
  const tasks = async () => (await db.query(`select title, assignee_id, file_id from eng_tasks where file_id = $1 order by created_at`, [FILE])).rows;

  check("the premise: the rep can take a job and cannot set travel", rep.grants.has("files.create") && !rep.grants.has("pricing.override_at_intake"));
  check("the premise: nothing is asked yet", (await billing.travelRequestFor(FILE)).pending === false);

  const asked = await billing.requestTravel(rep, FILE);
  const pending = await billing.travelRequestFor(FILE);
  check("the rep asks, and the request is pending under his name", asked.ok && pending.pending === true && pending.requestedBy === REP, asked.ok ? "" : asked.error);
  let t = await tasks();
  check(
    "one task to the administrator, naming the county and the file",
    t.length === 1 && t[0].assignee_id === ADMIN && /Bell County/.test(t[0].title) && /254-PROOF-NT-1/.test(t[0].title),
    JSON.stringify(t),
  );
  const again = await billing.requestTravel(rep, FILE);
  check("a second press changes nothing", again.ok && again.already === true && (await tasks()).length === 1);

  const repSets = await billing.setTravel(rep, FILE, 8500, "Two hours each way to Killeen");
  check("the rep cannot set the amount, and the request stays pending", !repSets.ok && (await billing.travelRequestFor(FILE)).pending === true);

  const set = await billing.setTravel(admin, FILE, 8500, "Two hours each way to Killeen");
  check("the administrator sets it, and the request is answered", set.ok && set.answered === true && (await billing.travelRequestFor(FILE)).pending === false, set.ok ? "" : set.error);
  t = await tasks();
  const told = t.find((x) => x.assignee_id === REP);
  check("the rep has a task on the file saying what happened to the link", Boolean(told) && /payment link (has gone|did not go)/.test(told.title), told?.title ?? "no task for the rep");
  check(
    "and it tells the truth: the gate is shut in this process, so the link did not go",
    Boolean(told) && /did not go/.test(told.title),
    told?.title ?? "",
  );

  const after = await billing.requestTravel(rep, FILE);
  check("once travel is set, nobody asks again", !after.ok && /already set/.test(after.error), after.ok ? "it asked" : after.error);
} finally {
  await rest.close?.();
}

/* By source: the hold on the link, and New job's box. */
const code = (path) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const billingSrc = code("src/lib/ops-job-billing.ts");
const send = billingSrc.slice(billingSrc.indexOf("export async function sendPaymentLink"), billingSrc.indexOf("export async function resendPaymentLink"));
check(
  "sendPaymentLink refuses with the rep's sentence while a request is pending, before any order exists",
  /if \(travelAsked\.pending\) return \{ ok: false, error: TRAVEL_REQUESTED_SAYS \};/.test(send) && send.indexOf("travelRequestFor(fileId)") < send.indexOf("createOrderForFile("),
);
check("the sentence is Robert's", /TRAVEL_REQUESTED_SAYS = "Travel requested\. The payment link goes when it is set\.";/.test(billingSrc));
const intake = code("src/lib/ops-job-intake.ts");
check(
  "take_job's Needs travel asks and holds the link instead of sending it",
  /if \(input\.needsTravel && \(input\.travelCents === null \|\| input\.travelCents === undefined\)\)/.test(intake) &&
    /input\.paymentIntent === "link_sent" && \(travelRequested \|\| travelRequestWarning\)/.test(intake),
);

console.log(wrong === 0 ? "\nNeeds travel holds the link until it is set." : `\n${wrong} check(s) wrong.`);
process.exit(wrong === 0 ? 0 : 1);
