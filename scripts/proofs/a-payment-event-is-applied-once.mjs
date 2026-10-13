// @runtime react-server
//
// Declared because part K imports src/lib/payment-events.ts and
// src/lib/payments-watch.ts, which carry server-only, by a dynamic import the
// runtime sniffer does not follow.

/**
 * A PAYMENT EVENT IS APPLIED ONCE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-payment-event-is-applied-once.mjs
 *
 * Operator rulings, 2026-10-12, on Stripe webhooks (migration 0075): allow
 * Stripe's resends; record every event once by its id before any effect, in
 * the same transaction as the effect; release the work after commit under
 * claimed then done; answer non 2xx for anything that did not commit. The
 * proof the ruling asks for:
 *
 *   - the same signed test-mode event delivered twice, for each webhook kind,
 *     and the second delivery changes nothing;
 *   - a write cut off on the first delivery answers non 2xx, and the resend
 *     completes it exactly once;
 *   - the injection: remove the event id check, and this goes red.
 *
 * And the three hypotheses, each verified against the code and fixed: a
 * pending platform refund recorded twice, a batch or statement refund refused,
 * and an expired checkout cancelling an order a payment had just moved.
 *
 * HOW IT RUNS, AND WHY NOT AGAINST DEVELOPMENT. Every money table here refuses
 * deletes, so a run on development would leave its probe charges, refunds,
 * events and audit rows there for ever (CLAUDE.md 6b). So every migration is
 * replayed into PGlite, scripts/lib/replay-rest.mjs serves it as PostgREST, and
 * the production build is started with SUPABASE_URL pointed at that. The route,
 * the adapter, ops-payments and the 0075 functions are all the real ones; the
 * database is real Postgres with the real schema; only its data is the
 * proof's, and it is thrown away.
 *
 * SIGNED, AND NOTHING LEAVES THE MACHINE. Each event is signed here with a
 * throwaway secret and verified by the real adapter. The route's account check
 * would fetch the event's object from Stripe on its first webhook; the server
 * is started with scripts/lib/no-stripe-outbound.cjs preloaded, which refuses
 * any connection to stripe.com and logs it, and the proof counts those lines.
 */
process.env.STRIPE_SECRET_KEY = "sk_test_payment_events_proof";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_payment_events_proof";

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import Stripe from "stripe";
import { PGlite } from "@electric-sql/pglite";

const { readSource } = await import("../lib/read-source.mjs");
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");
const { PORTS } = await import("../lib/ports.mjs");
const { startNextServer } = await import("../lib/dev-server.mjs");
const { startReplayRest } = await import("../lib/replay-rest.mjs");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

if (!existsSync(".next/BUILD_ID")) {
  console.log("  COULD NOT TELL: no production build on disk, so there is nothing to start. Run the board, or npm run build.");
  process.exit(3);
}

/* ------------------------------------------------------------ the database */

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) await db.exec(readSource(join(DIR, f)));
check("every migration replays, 0075 included", files.some((f) => f.startsWith("0075_")), `${files.length} files`);

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CLIENT = id(1);
const ACCOUNT = id(2);
const STATEMENT = id(3);
const PARTNER = id(4);
const ACCRUAL = id(5);
const BATCH_PAID = id(6);
const BATCH_EXPIRE = id(7);
/* The account-cut order's own client: an account is unique per site and client,
 * and the other orders' releases open one for CLIENT. */
const CLIENT_ACCOUNT_CUT = id(8);
const EMAIL = "payment-events-proof@audit-probe.invalid";

const ORDERS = {
  paid: 101, expire: 102, race: 103, cutBefore: 104, cutAfter: 105, claimed: 106, pending: 107,
  batchA: 108, batchB: 109, expireA: 110, expireB: 111, accountCut: 112,
};
const orderId = (k) => id(ORDERS[k]);
const fileId = (k) => id(ORDERS[k] + 100);
const pi = (k) => `pi_proof_${k}`;

await db.exec(`
  insert into eng_clients (id, kind, name) values
    ('${CLIENT}', 'individual', 'Payment events proof client, not a real person'),
    ('${CLIENT_ACCOUNT_CUT}', 'individual', 'Payment events proof second client, not a real person');
  insert into eng_customer_accounts (id, site, client_id, billing_mode) values ('${ACCOUNT}', '254engineering', '${CLIENT}', 'invoice');
  insert into eng_statements (id, account_id, reference, period, status) values ('${STATEMENT}', '${ACCOUNT}', '254-PROOF-ST-1', '2026-09', 'issued');
  insert into eng_order_batches (id, site, reference, service_slug, status) values
    ('${BATCH_PAID}', '254engineering', '254-PROOF-BA-1', 'roof-inspections', 'awaiting_payment'),
    ('${BATCH_EXPIRE}', '254engineering', '254-PROOF-BA-2', 'roof-inspections', 'awaiting_payment');
`);
for (const [k, n] of Object.entries(ORDERS)) {
  const batch = k.startsWith("batch") ? BATCH_PAID : k.startsWith("expire") && k !== "expire" ? BATCH_EXPIRE : null;
  await db.exec(`
    insert into eng_files (id, file_number, client_id, service_slug, property_address, county, status)
    values ('${fileId(k)}', '254-PROOF-F-${n}', '${CLIENT}', 'roof-inspections', '${n} Proof Way', 'Nueces', 'intake');
    insert into eng_service_orders
      (id, site, reference, service_slug, order_type, customer_name, customer_email, property_address, county,
       status, total_cents, file_id, client_id ${batch ? ", batch_id" : ""})
    values
      ('${orderId(k)}', '254engineering', '254-PROOF-O-${n}', 'roof-inspections', 'field',
       'Payment events proof customer, not a real person',
       '${k === "accountCut" ? "payment-events-proof-account@audit-probe.invalid" : EMAIL}', '${n} Proof Way', 'Nueces',
       'awaiting_payment', 50000, '${fileId(k)}', '${k === "accountCut" ? CLIENT_ACCOUNT_CUT : CLIENT}' ${batch ? `, '${batch}'` : ""});
  `);
}
await db.exec(`
  insert into eng_partners (id, organisation, contact_name, contact_email, code)
  values ('${PARTNER}', 'Payment events proof partner, not a real firm', 'Nobody', 'partner-proof@audit-probe.invalid', 'PROOFPE');
  insert into eng_partner_entries (id, partner_id, kind, amount_cents, status, explanation, model, basis_cents, order_id, payable_at)
  values ('${ACCRUAL}', '${PARTNER}', 'accrual', 5000, 'accrued', 'Ten percent of the proof order.', 'percent_of_order', 50000, '${orderId("paid")}', now());
`);

/* ------------------------------------------------------- the stand-in and app */

const rest = await startReplayRest(db, PORTS.replayRest);
const PRELOAD = resolve("scripts/lib/no-stripe-outbound.cjs");
let server;
try {
  server = await startNextServer({
    port: PORTS.replayApp,
    timeoutMs: 120_000,
    env: {
      SUPABASE_URL: rest.url,
      SUPABASE_SERVICE_ROLE_KEY: "replay-stand-in",
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      ORDER_PAYMENTS_FAKE: "",
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require ${JSON.stringify(PRELOAD)}`.trim(),
    },
  });
} catch (err) {
  console.log(`  COULD NOT TELL: the production build did not start against the replay: ${err.message}`);
  await rest.close();
  process.exit(3);
}
const APP = server.base;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
let created = 1_760_300_000;

function signed(event) {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  return { payload, header };
}
function envelope(eventId, type, object) {
  created += 1;
  return { id: eventId, object: "event", api_version: "2024-06-20", type, livemode: false, created, data: { object } };
}
const completed = (eventId, { order = null, batch = null, statement = null, intent, amount }) =>
  envelope(eventId, "checkout.session.completed", {
    id: `cs_${eventId}`, object: "checkout.session", payment_intent: intent, amount_total: amount,
    metadata: { ...(order ? { order_id: order } : {}), ...(batch ? { batch_id: batch } : {}), ...(statement ? { statement_id: statement } : {}) },
  });
const expired = (eventId, { order = null, batch = null }) =>
  envelope(eventId, "checkout.session.expired", {
    id: `cs_${eventId}`, object: "checkout.session", payment_intent: null,
    metadata: { ...(order ? { order_id: order } : {}), ...(batch ? { batch_id: batch } : {}) },
  });
const refunded = (eventId, { intent, toDate }) =>
  envelope(eventId, "charge.refunded", {
    id: `ch_${eventId}`, object: "charge", payment_intent: intent, amount_refunded: toDate,
  });

async function deliver(event) {
  const { payload, header } = signed(event);
  const started = Date.now();
  const res = await fetch(`${APP}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": header },
    body: payload,
    signal: AbortSignal.timeout(60_000),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body, seconds: (Date.now() - started) / 1000 };
}

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0] ?? null;
const many = async (sql, params = []) => (await db.query(sql, params)).rows;
const n = async (sql, params = []) => Number((await one(sql, params))?.n ?? 0);

/* Everything a delivery could change, so "changed nothing" is measured rather than assumed. */
async function snapshot() {
  const tables = [
    "eng_order_payments", "eng_order_events", "eng_audit_events", "eng_payment_events", "eng_jobs",
    "eng_customer_access", "eng_partner_entries", "eng_customer_accounts", "eng_customer_users", "eng_file_events",
  ];
  const counts = {};
  for (const t of tables) counts[t] = await n(`select count(*)::int as n from ${t}`);
  const orders = await many(`select id, status from eng_service_orders order by id`);
  const batches = await many(`select id, status from eng_order_batches order by id`);
  const statements = await many(`select id, status from eng_statements order by id`);
  const ledger = await many(`select event_id, status, release_attempts from eng_payment_events order by event_id`);
  const filesNow = await many(`select id, status from eng_files order by id`);
  return JSON.stringify({ counts, orders, batches, statements, ledger, filesNow });
}
function diffOf(a, b) {
  const A = JSON.parse(a), B = JSON.parse(b);
  const out = [];
  for (const k of Object.keys(A.counts)) if (A.counts[k] !== B.counts[k]) out.push(`${k} ${A.counts[k]} to ${B.counts[k]}`);
  for (const k of ["orders", "batches", "statements", "ledger", "filesNow"]) {
    if (JSON.stringify(A[k]) !== JSON.stringify(B[k])) out.push(`${k} changed`);
  }
  return out.join("; ") || "nothing";
}

const ledgerOf = (eventId) => one(`select status, release_attempts, last_error from eng_payment_events where event_id = $1`, [eventId]);
const confirmations = (order) =>
  n(`select count(*)::int as n from eng_jobs where kind = 'email.send' and payload->>'id' = 'order.confirmed' and payload->>'orderId' = $1`, [order]);
const orderStatus = async (order) => (await one(`select status from eng_service_orders where id = $1`, [order]))?.status;
const chargesOn = (column, value) =>
  n(`select count(*)::int as n from eng_order_payments where kind = 'charge' and ${column} = $1`, [value]);

/** Delivered twice: the second answers 200, says duplicate, and changes nothing anywhere. */
async function twice(label, event, firstChecks) {
  const first = await deliver(event);
  check(`${label}: the first delivery answers 200`, first.status === 200, `${first.status} ${JSON.stringify(first.body)}`);
  check(`${label}: and was not a duplicate`, first.body?.duplicate === false, JSON.stringify(first.body));
  await firstChecks();
  const before = await snapshot();
  const second = await deliver(event);
  const after = await snapshot();
  check(`${label}: the same event delivered again answers 200`, second.status === 200, `${second.status} ${JSON.stringify(second.body)}`);
  check(`${label}: and says it was a duplicate`, second.body?.duplicate === true, JSON.stringify(second.body));
  check(`${label}: and the second delivery changed nothing`, before === after, diffOf(before, after));
  check(`${label}: the event is recorded once, and done`, (await ledgerOf(event.id))?.status === "done", JSON.stringify(await ledgerOf(event.id)));
}

try {
  /* ============================ A. one order paid ============================ */
  await twice("an order paid", completed("evt_proof_paid", { order: orderId("paid"), intent: pi("paid"), amount: 50000 }), async () => {
    check("an order paid: one charge row on the order", (await chargesOn("order_id", orderId("paid"))) === 1);
    check("an order paid: the order is in fulfilment", (await orderStatus(orderId("paid"))) === "in_fulfilment", await orderStatus(orderId("paid")));
    check(
      "an order paid: one payment event and one audit row",
      (await n(`select count(*)::int as n from eng_order_events where order_id = $1 and event = 'payment.received'`, [orderId("paid")])) === 1 &&
        (await n(`select count(*)::int as n from eng_audit_events where action = 'order.paid' and entity_id = $1`, [orderId("paid")])) === 1,
    );
    check("an order paid: the work was released, the file moved", (await one(`select status from eng_files where id = $1`, [fileId("paid")]))?.status === "needs_dispatch");
    check("an order paid: one confirmation queued", (await confirmations(orderId("paid"))) === 1);
  });

  /* ============================ B. a batch paid ============================== */
  await twice("a batch paid", completed("evt_proof_batch_paid", { batch: BATCH_PAID, intent: pi("batch"), amount: 100000 }), async () => {
    check("a batch paid: one charge row, on the batch", (await chargesOn("batch_id", BATCH_PAID)) === 1);
    check(
      "a batch paid: both orders are in fulfilment, each with one confirmation",
      (await orderStatus(orderId("batchA"))) === "in_fulfilment" && (await orderStatus(orderId("batchB"))) === "in_fulfilment" &&
        (await confirmations(orderId("batchA"))) === 1 && (await confirmations(orderId("batchB"))) === 1,
    );
  });

  /* ============================ C. a statement paid =========================== */
  await twice("a statement paid", completed("evt_proof_statement_paid", { statement: STATEMENT, intent: pi("statement"), amount: 75000 }), async () => {
    check("a statement paid: one charge row on the statement", (await chargesOn("statement_id", STATEMENT)) === 1);
    check("a statement paid: the statement is paid", (await one(`select status from eng_statements where id = $1`, [STATEMENT]))?.status === "paid");
  });

  /* ============================ D. an order's checkout expired ================ */
  await twice("an order's checkout expired", expired("evt_proof_expired", { order: orderId("expire") }), async () => {
    check("an order's checkout expired: the order is cancelled", (await orderStatus(orderId("expire"))) === "cancelled");
  });

  /* ============================ E. a batch's checkout expired ================ */
  await twice("a batch's checkout expired", expired("evt_proof_batch_expired", { batch: BATCH_EXPIRE }), async () => {
    check(
      "a batch's checkout expired: the batch and both orders are cancelled",
      (await one(`select status from eng_order_batches where id = $1`, [BATCH_EXPIRE]))?.status === "cancelled" &&
        (await orderStatus(orderId("expireA"))) === "cancelled" && (await orderStatus(orderId("expireB"))) === "cancelled",
    );
  });

  /* ============================ F. a refund =================================== */
  await twice("a refund", refunded("evt_proof_refund", { intent: pi("paid"), toDate: 20000 }), async () => {
    const rows = await many(`select id, amount_cents, order_id from eng_order_payments where kind = 'refund' and order_id = $1`, [orderId("paid")]);
    check("a refund: one refund row of the delta, on the order", rows.length === 1 && Number(rows[0].amount_cents) === 20000, JSON.stringify(rows));
    const reversal = await one(`select amount_cents, payment_id from eng_partner_entries where kind = 'reversal' and reverses_id = $1`, [ACCRUAL]);
    check(
      "a refund: the commission reversal points at that refund row, in the same transaction",
      reversal !== null && reversal.payment_id === rows[0]?.id && Number(reversal.amount_cents) < 0,
      JSON.stringify(reversal),
    );
    check("a refund: a partial refund leaves the order in fulfilment", (await orderStatus(orderId("paid"))) === "in_fulfilment");
  });

  /* ============================ G. a write that never reached the database ==== */
  {
    const event = completed("evt_proof_cut_before", { order: orderId("cutBefore"), intent: pi("cutBefore"), amount: 50000 });
    rest.hold("POST", "/rest/v1/rpc/eng_apply_order_paid", "before");
    const first = await deliver(event);
    rest.releaseHeld();
    check("a payment cut off before it reached the database answers non 2xx", first.status >= 300, `${first.status} after ${first.seconds.toFixed(1)}s`);
    check(
      "and nothing was written",
      (await chargesOn("order_id", orderId("cutBefore"))) === 0 && (await ledgerOf(event.id)) === null,
    );
    const resend = await deliver(event);
    check("the resend answers 200 and records it", resend.status === 200 && resend.body?.duplicate === false, `${resend.status} ${JSON.stringify(resend.body)}`);
    check(
      "exactly once: one charge, one confirmation, the event done",
      (await chargesOn("order_id", orderId("cutBefore"))) === 1 && (await confirmations(orderId("cutBefore"))) === 1 &&
        (await ledgerOf(event.id))?.status === "done",
    );
  }

  /* ============================ H. a write that committed and was never answered */
  {
    const event = completed("evt_proof_cut_after", { order: orderId("cutAfter"), intent: pi("cutAfter"), amount: 50000 });
    rest.hold("POST", "/rest/v1/rpc/eng_apply_order_paid", "after");
    const first = await deliver(event);
    rest.releaseHeld();
    check("a payment that committed with its answer cut off answers non 2xx", first.status >= 300, `${first.status} after ${first.seconds.toFixed(1)}s`);
    check(
      "and the money is written with the event claimed and nothing released",
      (await chargesOn("order_id", orderId("cutAfter"))) === 1 && (await ledgerOf(event.id))?.status === "claimed" &&
        (await confirmations(orderId("cutAfter"))) === 0,
      JSON.stringify(await ledgerOf(event.id)),
    );
    const resend = await deliver(event);
    check("the resend answers 200", resend.status === 200, `${resend.status} ${JSON.stringify(resend.body)}`);
    check(
      "and completes it exactly once: still one charge and one payment event, one confirmation, the event done",
      (await chargesOn("order_id", orderId("cutAfter"))) === 1 &&
        (await n(`select count(*)::int as n from eng_order_events where order_id = $1 and event = 'payment.received'`, [orderId("cutAfter")])) === 1 &&
        (await confirmations(orderId("cutAfter"))) === 1 && (await ledgerOf(event.id))?.status === "done",
      JSON.stringify(await ledgerOf(event.id)),
    );
  }

  /* ============================ I. a release cut off after the money committed */
  {
    const event = completed("evt_proof_claimed", { order: orderId("claimed"), intent: pi("claimed"), amount: 50000 });
    rest.hold("POST", "/rest/v1/eng_customer_access", "before");
    const first = await deliver(event);
    rest.releaseHeld();
    check("a release cut off after the money committed answers non 2xx", first.status >= 300, `${first.status} after ${first.seconds.toFixed(1)}s`);
    check(
      "and the event is claimed, not done, with no confirmation",
      (await ledgerOf(event.id))?.status === "claimed" && (await confirmations(orderId("claimed"))) === 0,
      JSON.stringify(await ledgerOf(event.id)),
    );
    const resend = await deliver(event);
    check("a resend of the claimed event is processed, not skipped", resend.status === 200, `${resend.status} ${JSON.stringify(resend.body)}`);
    check(
      "and the release completes once: one charge, one confirmation, the event done",
      (await chargesOn("order_id", orderId("claimed"))) === 1 && (await confirmations(orderId("claimed"))) === 1 &&
        (await ledgerOf(event.id))?.status === "done",
      JSON.stringify(await ledgerOf(event.id)),
    );
  }

  /* ===================== I2. a release cut off AFTER its confirmation went ==== */
  /*
   * The case that makes "safe to run twice" more than a phrase: the release
   * queued the confirmation and was then cut off at the account step, so the
   * resend runs the whole release again. The confirmation must not go twice.
   * Parts G to I cannot see this: each is cut off before the confirmation.
   */
  {
    const event = completed("evt_proof_account_cut", { order: orderId("accountCut"), intent: pi("accountCut"), amount: 50000 });
    rest.hold("POST", "/rest/v1/eng_customer_accounts", "before");
    const first = await deliver(event);
    rest.releaseHeld();
    check("a release cut off after its confirmation was queued answers non 2xx", first.status >= 300, `${first.status} after ${first.seconds.toFixed(1)}s`);
    check(
      "and the event is claimed, with the confirmation already queued",
      (await ledgerOf(event.id))?.status === "claimed" && (await confirmations(orderId("accountCut"))) === 1,
      JSON.stringify(await ledgerOf(event.id)),
    );
    const resend = await deliver(event);
    const notOpened = await many(
      `select summary from eng_order_events where order_id = $1 and event = 'account.not_opened' order by created_at`,
      [orderId("accountCut")],
    );
    check(
      "the resend runs the release again and answers 200",
      resend.status === 200,
      `${resend.status} ${JSON.stringify(resend.body)}${notOpened.length ? `; ${notOpened.map((r) => r.summary).join(" | ")}` : ""}`,
    );
    check(
      "and the second run sent nothing twice: one confirmation, one status link, the file moved once, the event done",
      (await confirmations(orderId("accountCut"))) === 1 &&
        (await n(`select count(*)::int as n from eng_customer_access where order_id = $1`, [orderId("accountCut")])) === 1 &&
        (await n(`select count(*)::int as n from eng_file_events where file_id = $1 and kind = 'status'`, [fileId("accountCut")])) === 1 &&
        (await ledgerOf(event.id))?.status === "done",
      `confirmations ${await confirmations(orderId("accountCut"))}, links ${await n(`select count(*)::int as n from eng_customer_access where order_id = $1`, [orderId("accountCut")])}`,
    );
  }

  /* ============================ J. the three hypotheses ======================= */
  {
    // 1. A platform refund still pending is not recorded a second time.
    const paid = await deliver(completed("evt_proof_pending_paid", { order: orderId("pending"), intent: pi("pending"), amount: 50000 }));
    check("hypothesis 1 setup: the order is paid", paid.status === 200);
    const charge = await one(`select id from eng_order_payments where kind = 'charge' and order_id = $1`, [orderId("pending")]);
    await db.query(
      `insert into eng_order_payments (order_id, kind, amount_cents, provider, provider_ref, status, refund_case)
       values ($1, 'refund', 20000, 'stripe', 're_proof_platform_pending', 'pending', 'declined_before_visit')`,
      [orderId("pending")],
    );
    const before = await n(`select count(*)::int as n from eng_order_payments where kind = 'refund' and order_id = $1`, [orderId("pending")]);
    const res = await deliver(refunded("evt_proof_pending_refund", { intent: pi("pending"), toDate: 20000 }));
    const after = await n(`select count(*)::int as n from eng_order_payments where kind = 'refund' and order_id = $1`, [orderId("pending")]);
    check(
      "hypothesis 1 holds and is fixed: a platform refund still pending is not recorded again from its webhook",
      res.status === 200 && charge !== null && before === 1 && after === 1,
      `${res.status} ${JSON.stringify(res.body)}, refund rows ${before} to ${after}`,
    );

    // 2. A refund against a batch's charge is recorded on the batch.
    const batchRefund = await deliver(refunded("evt_proof_batch_refund", { intent: pi("batch"), toDate: 10000 }));
    const rows = await many(`select amount_cents, batch_id, order_id from eng_order_payments where kind = 'refund' and batch_id = $1`, [BATCH_PAID]);
    check(
      "hypothesis 2 holds and is fixed: a batch refund is recorded on the batch, and answers 200",
      batchRefund.status === 200 && rows.length === 1 && Number(rows[0].amount_cents) === 10000 && rows[0].order_id === null,
      `${batchRefund.status} ${JSON.stringify(batchRefund.body)} ${JSON.stringify(rows)}`,
    );
    check(
      "and a batch refund moves no order's status",
      (await orderStatus(orderId("batchA"))) === "in_fulfilment" && (await orderStatus(orderId("batchB"))) === "in_fulfilment",
    );

    // 3. An expiry judged before a payment cannot cancel the order after it.
    const racePaid = await deliver(completed("evt_proof_race_paid", { order: orderId("race"), intent: pi("race"), amount: 50000 }));
    check("hypothesis 3 setup: the order is paid and in fulfilment", racePaid.status === 200 && (await orderStatus(orderId("race"))) === "in_fulfilment");
    let raised = null;
    try {
      await db.query(`select public.eng_apply_checkout_expired($1::jsonb)`, [JSON.stringify({
        event_id: "evt_proof_race_stale", source: "stripe_webhook", order_id: orderId("race"),
        orders: [{ id: orderId("race"), expected_status: "awaiting_payment", cancel: true }],
        reason: "An expiry judged before the payment landed.",
      })]);
    } catch (err) {
      raised = err.message;
    }
    check(
      "hypothesis 3 holds and is fixed: an expiry judged at awaiting_payment refuses once a payment moved the order",
      raised !== null && /moved while its expiry was being recorded/.test(raised),
      raised ?? "it did not raise",
    );
    check(
      "and it wrote nothing: the order is still in fulfilment, no expiry event, no ledger row",
      (await orderStatus(orderId("race"))) === "in_fulfilment" &&
        (await n(`select count(*)::int as n from eng_order_events where order_id = $1 and event = 'checkout.expired'`, [orderId("race")])) === 0 &&
        (await ledgerOf("evt_proof_race_stale")) === null,
    );
    const lateExpiry = await deliver(expired("evt_proof_race_expired", { order: orderId("race") }));
    check(
      "and the real expiry, delivered after the payment, leaves the paid order alone",
      lateExpiry.status === 200 && (await orderStatus(orderId("race"))) === "in_fulfilment",
      `${lateExpiry.status} ${JSON.stringify(lateExpiry.body)}`,
    );
  }

  /* ============================ K. paid, work not released ==================== */
  {
    process.env.SUPABASE_URL = rest.url;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "replay-stand-in";
    const { unreleasedPayments, UNRELEASED_AFTER_MINUTES } = await import("../../src/lib/payment-events.ts");
    const { watchUnreleasedPayments } = await import("../../src/lib/payments-watch.ts");
    check("the ruled threshold is fifteen minutes", UNRELEASED_AFTER_MINUTES === 15, String(UNRELEASED_AFTER_MINUTES));

    await db.exec(`
      insert into eng_payment_events (event_id, source, event_type, order_id, status, claimed_at)
      values ('evt_proof_stuck_old', 'stripe_webhook', 'checkout.completed', '${orderId("paid")}', 'claimed', now() - interval '20 minutes'),
             ('evt_proof_stuck_new', 'stripe_webhook', 'checkout.completed', '${orderId("paid")}', 'claimed', now() - interval '5 minutes');
    `);
    const listed = await unreleasedPayments();
    check(
      "an event claimed more than fifteen minutes is listed with its order reference, and a newer one is not",
      Array.isArray(listed) && listed.length === 1 && listed[0].eventId === "evt_proof_stuck_old" && listed[0].reference === "254-PROOF-O-101",
      JSON.stringify(listed),
    );
    const alerts = () => n(`select count(*)::int as n from eng_jobs where kind = 'email.send' and payload->>'id' = 'ops.payments_unreleased'`);
    const watched = await watchUnreleasedPayments();
    check("the health watch reports it and queues one alert", watched.looked && watched.count === 1 && watched.sent && (await alerts()) === 1, watched.note);
    const again = await watchUnreleasedPayments();
    check("and not a second within the hour", again.looked && !again.sent && (await alerts()) === 1, again.note);
  }

  /* ============================ L. what the route refuses ===================== */
  {
    const noId = await deliver({ ...completed("evt_x", { order: orderId("paid"), intent: pi("paid"), amount: 50000 }), id: undefined });
    check("an event with no id is refused rather than applied without a record", noId.status === 400, `${noId.status} ${JSON.stringify(noId.body)}`);
    const { payload } = signed(completed("evt_proof_bad_sig", { order: orderId("paid"), intent: pi("paid"), amount: 50000 }));
    const badSig = await fetch(`${APP}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": "t=1,v1=00" }, body: payload });
    check("an unsigned event is refused", badSig.status === 400, String(badSig.status));
  }
} finally {
  await server.stop();
  await rest.close();
}

/* ============================ M. nothing reached Stripe ======================= */
{
  const log = readFileSync(server.logPath, "utf8");
  const refusals = (log.match(/\[no-stripe-outbound\] refused/g) ?? []).length;
  check(
    "no call reached Stripe: the preload refused every attempt and the account check could not tell",
    !/ACCOUNT MISMATCH/.test(log),
    `${refusals} outbound attempt${refusals === 1 ? "" : "s"} refused`,
  );
}

await db.close();
console.log("");
if (wrong) {
  console.log(`FAIL: ${wrong} check${wrong === 1 ? "" : "s"} wrong.`);
  process.exit(1);
}
console.log("PASS: a payment event is applied once, a cut off write completes once on the resend, and the three defects are closed.");
