// @runtime react-server
//
// Declared because it imports src/lib/no-access.ts and order-for-file.ts, which carry server-only.

/**
 * A TRIP FEE IS ITS OWN ORDER, AND NEVER THE ONE THE FILE IS WORKED UNDER.
 * Robert's answers 7 to 10 of 2026-11-14 (E5), migration 0134.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-trip-fee-is-its-own-order.mjs
 *
 * The chain is replayed to 0134 in an in-process Postgres, and the real reads
 * are asked through the replay REST server:
 *
 *   1. THE DATABASE: a visit is append only and needs a note; a trip fee names
 *      its visit and only a trip fee does; one live trip fee per visit, and a
 *      cancelled one does not count; the no-access pay names its visit, once.
 *   2. THE ORDER THE FILE IS WORKED UNDER stays the job's, after a NEWER trip
 *      fee is paid. That read is what a partner's commission, the job's refund
 *      and the technician's job pay all come from (answers 9 and 10).
 *   3. THE HOLD: no visit, nothing held; a visit with no fee, held; a fee
 *      waiting, held; a fee paid, released; a newer visit, held again.
 *   4. THE TERMS: every field order discloses the trip fee in Robert's words,
 *      a desk order does not, and the trip fee's own terms say it is not
 *      refunded. Half his rate is half.
 *   5. THE PATHS, read from the source: a paid trip fee releases before any
 *      confirmation or account; dispatch asks the hold; the one-order rule and
 *      the resend read job orders; the trip fee runs no partner attribution.
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
async function refused(sql, params = []) {
  try {
    await db.query(sql, params);
    return false;
  } catch {
    return true;
  }
}

await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const at = files.findIndex((f) => f.startsWith("0134_"));
check("0134 is in the chain", at >= 0, files[at] ?? "missing");
for (const f of files.slice(0, at + 1)) await db.exec(readSource(join(DIR, f)));

const TECH = "00000000-0000-4000-8000-00000000a134";
const CLIENT = "00000000-0000-4000-8000-00000000b134";
const FILE = "00000000-0000-4000-8000-00000000c134";
const JOB = "00000000-0000-4000-8000-00000000d134";
await db.exec(`
  insert into auth.users (id) values ('${TECH}');
  insert into eng_profiles (id, email, display_name, role, status) values
    ('${TECH}', 'trip-tech@audit-probe.invalid', 'Trip fee proof technician, not a real person', 'field_tech', 'active');
  insert into eng_clients (id, kind, name) values ('${CLIENT}', 'individual', 'Trip fee proof client, not a real person');
  insert into eng_files (id, file_number, client_id, service_slug, property_address, county, status)
    values ('${FILE}', '254-PROOF-T-1', '${CLIENT}', 'foundation-inspections', '1 Proof Way', 'Bell', 'needs_dispatch');
  insert into eng_service_orders (id, site, reference, service_slug, order_type, customer_name, customer_email, property_address, county, status, total_cents, file_id, client_id, created_at)
    values ('${JOB}', '254engineering', '254-PROOF-O-JOB', 'foundation-inspections', 'field', 'Proof', 'proof@audit-probe.invalid', '1 Proof Way', 'Bell', 'in_fulfilment', 70900, '${FILE}', '${CLIENT}', now() - interval '2 days');
`);

/* ------------------------------------------------------- 1. the database */

const kindOf = (await db.query(`select kind from eng_service_orders where id = $1`, [JOB])).rows[0]?.kind;
check("an order made before 0134 is a job order", kindOf === "job", kindOf);
check("a visit needs a note of at least three characters", await refused(`insert into eng_no_access_visits (file_id, tech_id, note) values ($1, $2, '  ')`, [FILE, TECH]));
const visit1 = (await db.query(`insert into eng_no_access_visits (file_id, tech_id, note, created_at) values ($1, $2, 'Gate locked, owner did not answer', now() - interval '1 day') returning id`, [FILE, TECH])).rows[0].id;
check("a visit cannot be changed", await refused(`update eng_no_access_visits set note = 'something else' where id = $1`, [visit1]));
check("a visit cannot be deleted", await refused(`delete from eng_no_access_visits where id = $1`, [visit1]));

const tripInsert = (id, ref, visit, status, kind = "trip_fee") =>
  db.query(
    `insert into eng_service_orders (id, site, reference, kind, trip_for_visit, service_slug, order_type, customer_name, customer_email, property_address, county, status, total_cents, file_id, client_id)
     values ($1, '254engineering', $2, $3, $4, 'foundation-inspections', 'field', 'Proof', 'proof@audit-probe.invalid', '1 Proof Way', 'Bell', $5, 12500, $6, $7)`,
    [id, ref, kind, visit, status, FILE, CLIENT],
  );
/*
 * One full row, so each refusal below can only be the rule it names: the
 * control is the same row as a job with no visit, and it is accepted first.
 * (The first version left out customer_email, which is not null, so these two
 * checks would have passed on that and proved nothing about kind.)
 */
const bareOrder = (ref, kind) =>
  `insert into eng_service_orders (site, reference, kind, service_slug, order_type, customer_name, customer_email, property_address, county, status, total_cents) values ('254engineering', '${ref}', '${kind}', 'foundation-inspections', 'field', 'P', 'p@audit-probe.invalid', 'a', 'Bell', 'draft', 12500)`;
check("the control: a job order naming no visit is accepted", !(await refused(bareOrder("254-PROOF-CTL", "job"))));
check("a trip fee must name its visit", await refused(bareOrder("254-PROOF-X", "trip_fee")));
let jobWithVisit = false;
try {
  await tripInsert("00000000-0000-4000-8000-00000000e100", "254-PROOF-JV", visit1, "awaiting_payment", "job");
} catch {
  jobWithVisit = true;
}
check("and only a trip fee may name one", jobWithVisit);
check("a kind other than job or trip fee is refused", await refused(bareOrder("254-PROOF-K", "deposit")));

const TRIP1 = "00000000-0000-4000-8000-00000000e101";
await tripInsert(TRIP1, "254-PROOF-T1", visit1, "awaiting_payment");
let second = false;
try {
  await tripInsert("00000000-0000-4000-8000-00000000e102", "254-PROOF-T1B", visit1, "awaiting_payment");
} catch {
  second = true;
}
check("one live trip fee per visit", second);

check("the no-access pay names its visit", await refused(`insert into eng_tech_pay_ledger (tech_id, file_id, amount_cents, kind) values ($1, $2, 4250, 'no_access')`, [TECH, FILE]));
await db.query(`insert into eng_tech_pay_ledger (tech_id, file_id, amount_cents, kind, no_access_visit_id) values ($1, $2, 4250, 'no_access', $3)`, [TECH, FILE, visit1]);
check("and is written once per visit", await refused(`insert into eng_tech_pay_ledger (tech_id, file_id, amount_cents, kind, no_access_visit_id) values ($1, $2, 4250, 'no_access', $3)`, [TECH, FILE, visit1]));
check("a job pay row names no visit", await refused(`insert into eng_tech_pay_ledger (tech_id, file_id, amount_cents, kind, no_access_visit_id) values ($1, $2, 8500, 'job', $3)`, [TECH, FILE, visit1]));

/* ------------------------------------------- 2 and 3, through the real reads */

const rest = await startReplayRest(db, PORTS.replayRest);
process.env.SUPABASE_URL = rest.url;
process.env.SUPABASE_SERVICE_ROLE_KEY = "replay-stand-in";
delete process.env.VERCEL_ENV;

try {
  const { orderForFileRead } = await import("../../src/lib/order-for-file.ts");
  const { noAccessState, noAccessRefusal } = await import("../../src/lib/no-access.ts");

  let s = await noAccessState(FILE);
  check("a visit with a trip fee waiting is held", s.kind === "unpaid" && s.tripOrder?.id === TRIP1 && noAccessRefusal(s) !== null, `${s.kind}`);

  await db.query(`update eng_service_orders set status = 'in_fulfilment', paid_at = now() where id = $1`, [TRIP1]);
  s = await noAccessState(FILE);
  check("once the trip fee is paid, nothing holds the job", s.kind === "paid" && noAccessRefusal(s) === null, `${s.kind}`);

  const read = await orderForFileRead(FILE, "reference, total_cents");
  check(
    "the order the file is worked under is still the job's, with a newer trip fee paid beside it",
    read.ok && read.order?.id === JOB && Number(read.order?.total_cents) === 70900,
    read.ok ? `${read.order?.reference} at ${read.order?.total_cents}` : "the read failed",
  );

  const visit2 = (await db.query(`insert into eng_no_access_visits (file_id, tech_id, note) values ($1, $2, 'Dog loose in the yard, nobody home') returning id`, [FILE, TECH])).rows[0].id;
  s = await noAccessState(FILE);
  check("a newer visit with no fee holds it again", s.kind === "unpaid" && s.visitId === visit2 && s.tripOrder === null && noAccessRefusal(s) !== null, `${s.kind}`);

  await tripInsert("00000000-0000-4000-8000-00000000e103", "254-PROOF-T2", visit2, "cancelled");
  s = await noAccessState(FILE);
  check("a cancelled trip fee does not release it", s.kind === "unpaid" && s.tripOrder === null, `${s.kind}`);
  let afterCancel = true;
  try {
    await tripInsert("00000000-0000-4000-8000-00000000e104", "254-PROOF-T3", visit2, "awaiting_payment");
  } catch {
    afterCancel = false;
  }
  check("and a new one may be raised after it", afterCancel);

  const OTHER = "00000000-0000-4000-8000-00000000c135";
  await db.query(`insert into eng_files (id, file_number, client_id, service_slug, property_address, county, status) values ($1, '254-PROOF-T-2', $2, 'roof-inspections', '2 Proof Way', 'Bell', 'needs_dispatch')`, [OTHER, CLIENT]);
  s = await noAccessState(OTHER);
  check("a file nobody failed to get into is not held", s.kind === "none" && noAccessRefusal(s) === null, s.kind);
} finally {
  await rest.close?.();
}

/* ------------------------------------------------------------ 4. the terms */

const { refundDisclosure, TRIP_FEE_DISCLOSURE, TRIP_FEE_REFUND_TERMS } = await import("../../src/lib/ops-orders.ts");
const { CATALOG } = await import("../../data/catalog.ts");
const { noAccessPayCents } = await import("../../src/lib/ops-field.ts");
const APPROVED = "If the technician cannot get in at the agreed time, a trip fee of $125.00 is charged before the visit is booked again.";
check("the disclosure is Robert's approved wording", TRIP_FEE_DISCLOSURE === APPROVED, TRIP_FEE_DISCLOSURE);
const field = CATALOG.filter((e) => e.orderType === "field");
check("every field order's terms disclose it", field.length > 0 && field.every((e) => refundDisclosure(e).includes(APPROVED)), `${field.length} field deliverables`);
/* The catalogue sells no desk deliverable today, so the subject is built rather than filtered for: a check over none passes over nothing. */
const builtDesk = { ...field.find((e) => e.serviceSlug !== "foundation-inspections"), orderType: "desk" };
check("a desk order's terms do not, because nobody visits", !refundDisclosure(builtDesk).includes(APPROVED), `built from ${builtDesk.serviceSlug}`);
check(
  "no field order still promises it is never charged more without the trip fee beside it",
  field.every((e) => !refundDisclosure(e).some((l) => l.startsWith("You are never charged more"))),
);
check("the trip fee's own terms say it is not refunded", /not refunded, including if the job is later declined/.test(TRIP_FEE_REFUND_TERMS));
check("half his rate is half", noAccessPayCents(8500) === 4250 && noAccessPayCents(12500) === 6250 && noAccessPayCents(8501) === 4251);

/* --------------------------------------------------- 5. the paths, by source */

const code = (path) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const payments = code("src/lib/ops-payments.ts");
const release = payments.slice(payments.indexOf("export async function releaseForFulfilment"));
check(
  "a paid trip fee is released before any confirmation, status link or account",
  release.indexOf('kindRow?.kind === "trip_fee"') > 0 &&
    release.indexOf('kindRow?.kind === "trip_fee"') < release.indexOf("openAccountForOrder(") &&
    release.indexOf('kindRow?.kind === "trip_fee"') < release.indexOf("issueCustomerLink("),
);
check("its checkout is one line named Trip fee, returning with trip=1", /label: "Trip fee"/.test(payments) && /&trip=1/.test(payments));
const fieldSrc = code("src/lib/ops-field.ts");
const sendOffers = fieldSrc.slice(fieldSrc.indexOf("export async function sendOffers"), fieldSrc.indexOf("export async function sendOffers") + 6000);
check("dispatch asks the hold before it offers", /noAccessRefusal\(await noAccessState\(fileId\)\)/.test(sendOffers));
check("the order a file is worked under reads job orders only", /\.eq\("kind", "job"\)/.test(code("src/lib/order-for-file.ts")));
const billing = code("src/lib/ops-job-billing.ts");
check("the one-order rule counts job orders only", /\.select\("reference, status"\)\.eq\("file_id", fileId\)\.eq\("kind", "job"\)/.test(billing));
const tripFn = billing.slice(billing.indexOf("export async function sendTripFeeLink"), billing.indexOf("export async function invoiceAccount"));
check("the trip fee runs no partner attribution", tripFn.length > 100 && !/attributeToPartner\(|attributeOrder\(/.test(tripFn));
check("and the partner's commission reads the job order through orderForFileRead", /orderForFileRead\(fileId/.test(code("src/lib/ops-partner-comp.ts")));

console.log(wrong === 0 ? "\nA trip fee is its own order." : `\n${wrong} check(s) wrong.`);
process.exit(wrong === 0 ? 0 : 1);
