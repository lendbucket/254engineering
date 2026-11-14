// @runtime react-server
//
// Declared because it imports src/lib/ops-job-billing.ts and ops-field.ts, which carry server-only.

/**
 * TRAVEL IS ITS OWN LINE, AND ITS MONEY FOLLOWS THE TRIP. Robert's rulings of
 * 2026-11-14: travel typed per job by the administrator before the payment
 * link, and his answers 12 to 15. Migration 0135.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/travel-is-its-own-line-and-follows-the-trip.mjs
 *
 *   1. THE REFUND (answer 12): no visit, the travel is refunded with
 *      everything; after the visit it is kept with the inspection fee, and
 *      never more than was paid. Without travel nothing changes.
 *   2. THE WORDS (answer 15): "Travel to Bell County", the county filled in;
 *      the reason appears in no customer sentence.
 *   3. THE DATABASE, replayed to 0135: travel on a file is whole or absent and
 *      above zero; on an order above zero; on the pay ledger once per job.
 *   4. THE DOOR, setTravel through the replay REST server: an administrator
 *      sets it with a reason; a technician cannot; a short reason is refused;
 *      once the job's order exists it is refused.
 *   5. THE PATHS, read from the source: the order's total adds the travel and
 *      records it; checkout and the customer page name it; the partner's
 *      basis takes it out (answer 13); the technician is paid it where the
 *      visit is recorded for the refund, and nowhere else (answer 14).
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

/* ------------------------------------------------- 1 and 2, the pure rules */

const { refundFor, travelLabel, travelRefundTerms } = await import("../../src/lib/ops-orders.ts");
const base = { paidCents: 79400, inspectionFeeCents: 17500, outcome: "decline" };
const noVisit = refundFor({ ...base, technicianVisited: false, travelCents: 8500 });
check("declined before the visit: everything is refunded, the travel with it", noVisit.refundCents === 79400 && noVisit.retainedCents === 0, `${noVisit.refundCents} refunded`);
const visited = refundFor({ ...base, technicianVisited: true, travelCents: 8500 });
check("declined after the visit: the inspection fee and the travel are kept", visited.retainedCents === 26000 && visited.refundCents === 53400, `${visited.retainedCents} kept, ${visited.refundCents} refunded`);
check("and the customer is told both figures", /\$175\.00/.test(visited.explanation) && /\$85\.00/.test(visited.explanation) && /travel to the property/.test(visited.explanation));
const small = refundFor({ paidCents: 20000, inspectionFeeCents: 17500, outcome: "decline", technicianVisited: true, travelCents: 8500 });
check("never more than was paid", small.retainedCents === 20000 && small.refundCents === 0, `${small.retainedCents} kept`);
const without = refundFor({ ...base, technicianVisited: true });
check("without travel, the visit keeps the inspection fee alone, as before", without.retainedCents === 17500 && !/travel/.test(without.explanation));
check("the customer reads Travel to Bell County", travelLabel("Bell") === "Travel to Bell County", travelLabel("Bell"));
const terms = travelRefundTerms(8500, "Bell");
check("the order's terms name it, its amount and both halves of the rule", terms.startsWith("Travel to Bell County, $85.00,") && /declined before the visit/.test(terms) && /made the trip/.test(terms), terms);

/* --------------------------------------------------------- 3, the database */

const db = new PGlite();
const refused = async (sql, params = []) => {
  try {
    await db.query(sql, params);
    return false;
  } catch {
    return true;
  }
};
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const at = files.findIndex((f) => f.startsWith("0135_"));
check("0135 is in the chain", at >= 0, files[at] ?? "missing");
for (const f of files.slice(0, at + 1)) await db.exec(readSource(join(DIR, f)));

const ADMIN = "00000000-0000-4000-8000-00000000a135";
const TECH = "00000000-0000-4000-8000-00000000a136";
const CLIENT = "00000000-0000-4000-8000-00000000b135";
const FILE = "00000000-0000-4000-8000-00000000c136";
await db.exec(`
  insert into auth.users (id) values ('${ADMIN}'), ('${TECH}');
  insert into eng_profiles (id, email, display_name, role, status) values
    ('${ADMIN}', 'travel-admin@audit-probe.invalid', 'Travel proof administrator, not a real person', 'admin', 'active'),
    ('${TECH}', 'travel-tech@audit-probe.invalid', 'Travel proof technician, not a real person', 'field_tech', 'active');
  insert into eng_clients (id, kind, name) values ('${CLIENT}', 'individual', 'Travel proof client, not a real person');
  insert into eng_files (id, file_number, client_id, service_slug, deliverable, property_address, county, status, client_price_cents, payment_intent)
    values ('${FILE}', '254-PROOF-TR-1', '${CLIENT}', 'foundation-inspections', 'standard', '1 Travel Way', 'Bell', 'intake', 70900, 'unset');
`);
check("travel without its reason and author is refused", await refused(`update eng_files set travel_cents = 8500 where id = $1`, [FILE]));
check("travel of zero is refused", await refused(`update eng_files set travel_cents = 0, travel_reason = 'Two hours each way', travel_set_by = $2, travel_set_at = now() where id = $1`, [FILE, ADMIN]));
/* The same row with travel of one cent is accepted first, so the refusal below can only be the travel rule. */
const orderRow = (ref, travel) =>
  `insert into eng_service_orders (site, reference, service_slug, order_type, customer_name, customer_email, property_address, county, status, travel_cents) values ('254engineering', '${ref}', 'foundation-inspections', 'field', 'P', 'p@audit-probe.invalid', 'a', 'Bell', 'draft', ${travel})`;
check("an order's travel of one cent is accepted (the control)", !(await refused(orderRow("254-PROOF-TR-C", 1))));
check("an order's travel of zero is refused", await refused(orderRow("254-PROOF-TR-Z", 0)));
await db.query(`insert into eng_tech_pay_ledger (tech_id, file_id, amount_cents, kind) values ($1, $2, 8500, 'travel')`, [TECH, FILE]);
check("travel is paid once per job", await refused(`insert into eng_tech_pay_ledger (tech_id, file_id, amount_cents, kind) values ($1, $2, 8500, 'travel')`, [ADMIN, FILE]));

/* ------------------------------------------------ 4, the door, through REST */

const rest = await startReplayRest(db, PORTS.replayRest);
process.env.SUPABASE_URL = rest.url;
process.env.SUPABASE_SERVICE_ROLE_KEY = "replay-stand-in";
delete process.env.VERCEL_ENV;
try {
  const { actionsFor } = await import("../../src/lib/ops-authz.ts");
  const { setTravel } = await import("../../src/lib/ops-job-billing.ts");
  const actor = (id, role, email) => ({ id, role, status: "active", email, grants: new Set(actionsFor(role)) });
  const admin = actor(ADMIN, "admin", "travel-admin@audit-probe.invalid");
  const tech = actor(TECH, "field_tech", "travel-tech@audit-probe.invalid");

  const byTech = await setTravel(tech, FILE, 8500, "Two hours each way to Killeen");
  check("a technician cannot set travel", byTech.ok === false, byTech.ok ? "it saved" : byTech.error);
  const short = await setTravel(admin, FILE, 8500, "far");
  check("a short reason is refused", short.ok === false, short.ok ? "it saved" : short.error);
  const set = await setTravel(admin, FILE, 8500, "Two hours each way to Killeen");
  const row = (await db.query(`select travel_cents, travel_reason, travel_set_by from eng_files where id = $1`, [FILE])).rows[0];
  check("an administrator sets it with a reason, and the file names who", set.ok && Number(row.travel_cents) === 8500 && row.travel_set_by === ADMIN, set.ok ? `${row.travel_cents} by ${row.travel_set_by}` : set.error);

  await db.query(
    `insert into eng_service_orders (site, reference, service_slug, order_type, customer_name, customer_email, property_address, county, status, total_cents, travel_cents, file_id, client_id)
     values ('254engineering', '254-PROOF-TR-O', 'foundation-inspections', 'field', 'P', 'p@audit-probe.invalid', '1 Travel Way', 'Bell', 'awaiting_payment', 79400, 8500, $1, $2)`,
    [FILE, CLIENT],
  );
  const after = await setTravel(admin, FILE, 9500, "Changed after the link went out");
  check("once the job's order exists, travel cannot change", after.ok === false, after.ok ? "it saved" : after.error);
} finally {
  await rest.close?.();
}

/* ------------------------------------------------------ 5, the paths, by source */

const code = (path) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const billing = code("src/lib/ops-job-billing.ts");
check("the order's total is the price plus the travel, and records it", /total_cents: file\.client_price_cents \+ travel,/.test(billing) && /travel_cents: travel > 0 \? travel : null,/.test(billing));
check("and its stored terms carry the travel sentence", /travelRefundTerms\(travel, file\.county\)/.test(billing));
const payments = code("src/lib/ops-payments.ts");
check("checkout names the travel for its county", /label: travelLabel\(order\.county as string\), amountCents: travel/.test(payments));
check("the decline passes the order's travel to the refund", /travelCents: order\.travel_cents === null/.test(payments));
check("the customer page names it", /travelLabel\(order\.county as string\)/.test(code("src/lib/ops-customer.ts")));
check("the partner's basis takes the travel out", /Number\(order\.total_cents\) - \(order\.travel_cents/.test(code("src/lib/ops-partner-comp.ts")));
const field = code("src/lib/ops-field.ts");
const calls = field.split("await payTravel(").length - 1;
const start = field.indexOf("export async function submitEvidence");
const submit = field.slice(start, field.indexOf("export async function", start + 10));
check(
  "the technician is paid the travel where the visit is recorded for the refund, and nowhere else",
  calls === 1 && submit.indexOf("await payTravel(") > submit.indexOf("await recordTechnicianVisit(fileId)") && submit.indexOf("await recordTechnicianVisit(fileId)") > 0,
  `${calls} call(s)`,
);

console.log(wrong === 0 ? "\nTravel is its own line and follows the trip." : `\n${wrong} check(s) wrong.`);
process.exit(wrong === 0 ? 0 : 1);
