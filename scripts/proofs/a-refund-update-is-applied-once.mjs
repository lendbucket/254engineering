// @runtime react-server
//
// Declared because parts A, B and F import src/lib/ops-payments.ts and
// src/lib/ops-customer.ts, which carry server-only, by a dynamic import the
// runtime sniffer does not follow.

/**
 * A REFUND UPDATE IS APPLIED ONCE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-refund-update-is-applied-once.mjs
 *
 * Operator rulings, 2026-10-13 (migration 0076). Stripe's charge.refund.updated
 * goes through the payment event ledger in one transaction, and the proof the
 * ruling asks for is both directions out of pending:
 *
 *   - pending to succeeded: the row is succeeded, an internal event and an
 *     audit row, and nothing further reaches the customer;
 *   - pending to failed, and pending to canceled: the row is failed or
 *     cancelled with Stripe's reason and stops counting, the firm is alerted,
 *     nothing is reinstated, the order stays refunded, the customer is not
 *     written to, and the orders screen's reader names the order;
 *   - still pending or requires_action changes nothing;
 *   - a refund id with no row: a failed one raises one staff task naming the
 *     charge, the amount and the reason, linking the order when the charge
 *     matches one; a succeeded one raises nothing;
 *   - each delivered twice, the second changing nothing;
 *   - and ruling 6: a refund pending at the moment it is issued is told to the
 *     customer as issued, never as refunded, in the email, the timeline and
 *     the status page; one that succeeds at once keeps "Refunded to your card".
 *
 * HOW IT RUNS, as a-payment-event-is-applied-once does and for the same
 * reason: every money table refuses deletes, so every migration is replayed
 * into PGlite, served as PostgREST by scripts/lib/replay-rest.mjs, and the
 * production build is started against it. The decisions that issue a refund
 * run in this process against the same replay, with a stand-in provider that
 * answers the way Stripe does; the updates are signed here with a throwaway
 * secret and delivered to the real route. Nothing reaches Stripe.
 */
process.env.STRIPE_SECRET_KEY = "sk_test_refund_update_proof";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_refund_update_proof";

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

/* ---------------------------------------------- the rule, before any database */

const { refundUpdateFor, REFUND_ISSUED_SENTENCE } = await import("../../src/lib/refund-update.ts");
{
  const cases = [
    ["pending", "succeeded", "succeeded", false, false],
    ["pending", "failed", "failed", true, false],
    ["pending", "canceled", "cancelled", true, false],
    ["pending", "pending", null, false, false],
    ["pending", "requires_action", null, false, false],
    ["succeeded", "failed", "failed", true, false],
    ["succeeded", "succeeded", null, false, false],
    ["failed", "succeeded", null, false, false],
    ["cancelled", "pending", null, false, false],
    [null, "failed", null, false, true],
    [null, "canceled", null, false, true],
    [null, "succeeded", null, false, false],
  ];
  const off = cases.filter(([row, stripe, to, alert, task]) => {
    const got = refundUpdateFor({ providerStatus: stripe, rowStatus: row });
    return got.to !== to || got.alertFirm !== alert || got.staffTask !== task;
  });
  check(
    "the rule: every row status against every Stripe status answers as ruled",
    off.length === 0,
    off.length ? off.map((c) => `${c[0]} + ${c[1]}`).join(", ") : `${cases.length} cases`,
  );
}

/* ------------------------------------------------------------ the database */

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) await db.exec(readSource(join(DIR, f)));
check("every migration replays, 0076 included", files.some((f) => f.startsWith("0076_")), `${files.length} files`);

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CLIENT = id(1);
const PARTNER = id(4);
const ACCRUAL = id(5);
const EMAIL = "refund-update-proof@audit-probe.invalid";

const ORDERS = {
  settlePending: 201, settleNow: 202, failAfter: 203, cancelPending: 204, actionOnly: 205,
  failedAtIssue: 206, unknown: 207, failedLong: 208,
};
const orderId = (k) => id(ORDERS[k]);
const fileId = (k) => id(ORDERS[k] + 100);
const pi = (k) => `pi_refund_proof_${k}`;

await db.exec(`
  insert into eng_clients (id, kind, name) values ('${CLIENT}', 'individual', 'Refund update proof client, not a real person');
`);
for (const [k, n] of Object.entries(ORDERS)) {
  const refunded = k === "failedLong";
  await db.exec(`
    insert into eng_files (id, file_number, client_id, service_slug, property_address, county, status)
    values ('${fileId(k)}', '254-PROOF-RF-${n}', '${CLIENT}', 'roof-inspections', '${n} Refund Way', 'Nueces', 'intake');
    insert into eng_service_orders
      (id, site, reference, service_slug, order_type, customer_name, customer_email, property_address, county,
       status, total_cents, file_id, client_id, paid_at ${refunded ? ", refunded_at" : ""})
    values
      ('${orderId(k)}', '254engineering', '254-PROOF-R-${n}', 'roof-inspections', 'field',
       'Refund update proof customer, not a real person', '${EMAIL}', '${n} Refund Way', 'Nueces',
       '${refunded ? "refunded" : "in_fulfilment"}', 50000, '${fileId(k)}', '${CLIENT}', now() ${refunded ? ", now()" : ""});
    insert into eng_order_payments (order_id, kind, amount_cents, provider, provider_ref, status)
    values ('${orderId(k)}', 'charge', 50000, 'stripe', '${pi(k)}', 'succeeded');
  `);
}
await db.exec(`
  insert into eng_partners (id, organisation, contact_name, contact_email, code)
  values ('${PARTNER}', 'Refund update proof partner, not a real firm', 'Nobody', 'refund-partner-proof@audit-probe.invalid', 'PROOFRU');
  insert into eng_partner_entries (id, partner_id, kind, amount_cents, status, explanation, model, basis_cents, order_id, payable_at)
  values ('${ACCRUAL}', '${PARTNER}', 'accrual', 5000, 'accrued', 'Ten percent of the proof order.', 'percent_of_order', 50000, '${orderId("failAfter")}', now());

  -- A refund that failed when it was issued: the order was never marked refunded.
  insert into eng_order_payments (order_id, kind, amount_cents, provider, provider_ref, status, failure_reason)
  values ('${orderId("failedAtIssue")}', 'refund', 50000, 'stripe', 're_refund_proof_failed_at_issue', 'failed', 'insufficient_funds');
  -- An order marked refunded, whose failed refund is OLDER than the marking: a re-issue settled it.
  insert into eng_order_payments (order_id, kind, amount_cents, provider, provider_ref, status, failure_reason, created_at, updated_at)
  values ('${orderId("failedLong")}', 'refund', 50000, 'stripe', 're_refund_proof_failed_long', 'failed', 'expired_or_canceled_card',
          now() - interval '1 day', now() - interval '1 day');
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

/* This process runs the decisions that issue refunds, against the same replay. */
process.env.SUPABASE_URL = rest.url;
process.env.SUPABASE_SERVICE_ROLE_KEY = "replay-stand-in";
process.env.ORDER_PAYMENTS_FAKE = "";
const payments = await import("../../src/lib/ops-payments.ts");
const { fakeProvider } = await import("../../src/lib/payments.ts");
const { issueCustomerLink } = await import("../../src/lib/ops-intake.ts");
const { customerView } = await import("../../src/lib/ops-customer.ts");

/** A provider named stripe, as the live one is, whose refund answers with the given status. */
function stripeAnswering(status, ref) {
  return { ...fakeProvider(), name: "stripe", refund: async (r) => ({ ref, amountCents: r.amountCents, status }) };
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
let created = 1_760_400_000;
function signed(event) {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  return { payload, header };
}
const updated = (eventId, { refund, status, amount = 50000, intent = null, reason = null }) => {
  created += 1;
  return {
    id: eventId, object: "event", api_version: "2024-06-20", type: "charge.refund.updated", livemode: false, created,
    data: { object: { id: refund, object: "refund", status, amount, payment_intent: intent, failure_reason: reason } },
  };
};
async function deliver(event) {
  const { payload, header } = signed(event);
  const res = await fetch(`${APP}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": header },
    body: payload,
    signal: AbortSignal.timeout(60_000),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0] ?? null;
const many = async (sql, params = []) => (await db.query(sql, params)).rows;
const n = async (sql, params = []) => Number((await one(sql, params))?.n ?? 0);

async function snapshot() {
  const tables = ["eng_order_payments", "eng_order_events", "eng_audit_events", "eng_payment_events", "eng_jobs", "eng_partner_entries", "eng_tasks"];
  const counts = {};
  for (const t of tables) counts[t] = await n(`select count(*)::int as n from ${t}`);
  const refunds = await many(`select provider_ref, status, failure_reason from eng_order_payments where kind = 'refund' order by provider_ref`);
  const orders = await many(`select id, status from eng_service_orders order by id`);
  return JSON.stringify({ counts, refunds, orders });
}
const refundRow = (ref) => one(`select status, failure_reason from eng_order_payments where kind = 'refund' and provider_ref = $1`, [ref]);
const orderStatus = async (k) => (await one(`select status from eng_service_orders where id = $1`, [orderId(k)]))?.status;
const eventsOf = (k, event) => many(`select summary, customer_visible from eng_order_events where order_id = $1 and event = $2`, [orderId(k), event]);
const jobsTo = (k, emailId) =>
  many(`select payload->>'text' as text from eng_jobs where kind = 'email.send' and payload->>'id' = $1 and payload->>'orderId' = $2`, [emailId, orderId(k)]);
const refundSucceededTo = (k) =>
  many(`select payload->>'to' as "to" from eng_jobs where kind = 'email.send' and payload->>'id' = 'order.refund_succeeded' and payload->>'orderId' = $1`, [orderId(k)]);
/*
 * The confirmation's recipient rule (ruling 2026-10-13), written out here
 * rather than imported from the code under test: an order linked to an account
 * by its client record or by a person writes to the account's active owner,
 * then its billing email; any other order writes to its own address.
 */
async function confirmationAddress(k) {
  const linked = await n(
    `select count(*)::int as n from eng_order_events where order_id = $1 and event in ('account.linked_by_client', 'account.attached')`,
    [orderId(k)],
  );
  if (linked === 0) return (await one(`select customer_email from eng_service_orders where id = $1`, [orderId(k)]))?.customer_email ?? null;
  const owner = await one(
    `select u.email from eng_customer_users u join eng_service_orders o on o.account_id = u.account_id
      where o.id = $1 and u.account_role = 'owner' and u.status = 'active' order by u.created_at limit 1`,
    [orderId(k)],
  );
  if (owner?.email) return owner.email;
  return (
    (await one(
      `select a.billing_email from eng_customer_accounts a join eng_service_orders o on o.account_id = a.id where o.id = $1 and a.superseded_at is null`,
      [orderId(k)],
    ))?.billing_email ?? null
  );
}
const customerJobs = (k) =>
  n(`select count(*)::int as n from eng_jobs where kind = 'email.send' and payload->>'orderId' = $1 and payload->>'id' not like 'ops.%'`, [orderId(k)]);

/** Delivered twice: the second answers 200, duplicate, and changes nothing anywhere. */
async function twice(label, event, firstChecks) {
  const first = await deliver(event);
  check(`${label}: the first delivery answers 200, not a duplicate`, first.status === 200 && first.body?.duplicate === false, `${first.status} ${JSON.stringify(first.body)}`);
  await firstChecks();
  const before = await snapshot();
  const second = await deliver(event);
  const after = await snapshot();
  check(`${label}: delivered again it answers 200 as a duplicate and changes nothing`, second.status === 200 && second.body?.duplicate === true && before === after, `${second.status} ${JSON.stringify(second.body)}`);
}

try {
  /* ============ A. ruling 6: what the customer is told at the moment of issue ============ */
  payments.setPaymentProvider(stripeAnswering("pending", "re_refund_proof_settle_pending"));
  const settled = await payments.settleDecision({ orderId: orderId("settlePending"), outcome: "refuse" });
  check("a decline whose refund Stripe answers pending settles", settled.ok === true, JSON.stringify(settled));
  check("and the refund row is written pending", (await refundRow("re_refund_proof_settle_pending"))?.status === "pending");
  const pendingMail = (await jobsTo("settlePending", "order.declined"))[0]?.text ?? "";
  check(
    "the decline email says the refund was issued, with the issued sentence",
    pendingMail.includes("Refund issued to your card") && pendingMail.includes(REFUND_ISSUED_SENTENCE),
    pendingMail ? "" : "no decline email queued",
  );
  check(
    "and never that it was refunded to the card",
    pendingMail.length > 0 && !/refunded to your card/i.test(pendingMail),
    (pendingMail.match(/.{0,40}refunded to your card.{0,20}/i) ?? [""])[0],
  );
  const pendingIssued = (await eventsOf("settlePending", "refund.issued"))[0];
  check(
    "the customer's timeline carries the issued sentence",
    pendingIssued?.customer_visible === true && String(pendingIssued.summary).includes(REFUND_ISSUED_SENTENCE),
    pendingIssued?.summary ?? "no refund.issued event",
  );
  const link = await issueCustomerLink({ orderId: orderId("settlePending") });
  const pendingView = link ? await customerView(link.token) : null;
  check(
    "and the status page says issued, not refunded",
    pendingView?.refundIssued?.amount === "$500.00" && pendingView.refundIssued.sentence === REFUND_ISSUED_SENTENCE && pendingView.refunded === null,
    JSON.stringify({ issued: pendingView?.refundIssued, refunded: pendingView?.refunded }),
  );

  payments.setPaymentProvider(stripeAnswering("succeeded", "re_refund_proof_settle_now"));
  await payments.settleDecision({ orderId: orderId("settleNow"), outcome: "refuse" });
  const nowMail = (await jobsTo("settleNow", "order.declined"))[0]?.text ?? "";
  check(
    "a refund that succeeds at once keeps \"Refunded to your card\" and carries no issued sentence",
    nowMail.includes("Refunded to your card") && !nowMail.includes(REFUND_ISSUED_SENTENCE) && !nowMail.includes("Refund issued"),
    nowMail ? "" : "no decline email queued",
  );
  const nowIssued = (await eventsOf("settleNow", "refund.issued"))[0];
  check("and its timeline carries no issued sentence", nowIssued && !String(nowIssued.summary).includes(REFUND_ISSUED_SENTENCE), nowIssued?.summary);

  payments.setPaymentProvider(stripeAnswering("pending", "re_refund_proof_cancel"));
  const cancelled = await payments.cancelAndRefund({
    orderId: orderId("cancelPending"),
    reason: "The proof cancels this order to issue a pending refund.",
    actor: { id: null, role: "admin", email: "refund-update-proof@audit-probe.invalid" },
  });
  const cancelEvent = (await eventsOf("cancelPending", "order.cancelled_by_firm"))[0];
  check(
    "a firm cancellation whose refund Stripe answers pending tells the customer it was issued",
    cancelled.ok === true && cancelEvent?.customer_visible === true && String(cancelEvent.summary).includes(REFUND_ISSUED_SENTENCE),
    `${JSON.stringify(cancelled)} ${cancelEvent?.summary ?? "no event"}`,
  );

  payments.setPaymentProvider(stripeAnswering("pending", "re_refund_proof_fail"));
  await payments.settleDecision({ orderId: orderId("failAfter"), outcome: "refuse" });
  payments.setPaymentProvider(stripeAnswering("pending", "re_refund_proof_action"));
  await payments.settleDecision({ orderId: orderId("actionOnly"), outcome: "refuse" });
  const reversal = await one(`select id from eng_partner_entries where kind = 'reversal' and reverses_id = $1`, [ACCRUAL]);
  check(
    "setup: both pending refunds are on file, their orders refunded, the commission reversed",
    (await refundRow("re_refund_proof_fail"))?.status === "pending" && (await refundRow("re_refund_proof_action"))?.status === "pending" &&
      (await orderStatus("failAfter")) === "refunded" && reversal !== null,
  );
  payments.setPaymentProvider(null);

  /* ============================ B. pending to succeeded ============================ */
  const mailBefore = await customerJobs("settlePending");
  await twice("pending to succeeded", updated("evt_refund_proof_succeeded", { refund: "re_refund_proof_settle_pending", status: "succeeded", intent: pi("settlePending") }), async () => {
    check("pending to succeeded: the row is succeeded", (await refundRow("re_refund_proof_settle_pending"))?.status === "succeeded");
    const settledEvent = (await eventsOf("settlePending", "refund.settled"))[0];
    check("pending to succeeded: one internal event, not shown to the customer", settledEvent?.customer_visible === false, JSON.stringify(settledEvent));
    check(
      "pending to succeeded: one audit row",
      (await n(`select count(*)::int as n from eng_audit_events where action = 'order.refund_settled' and entity_id = $1`, [orderId("settlePending")])) === 1,
    );
    /*
     * ONE EMAIL, WHERE THIS USED TO ASSERT NONE. Addition b of the 2026-10-20
     * customer report rulings, ruled into this proof on 2026-10-21: a pending
     * refund that succeeds tells the customer. The old check read "nothing
     * further is sent to the customer". Applied once still means emailed once:
     * twice() asserts the repeat changes no table, eng_jobs included, and the
     * count is asserted again after it below.
     */
    const succeededMail = await refundSucceededTo("settlePending");
    check(
      "pending to succeeded: exactly one refund succeeded email, and nothing else, is sent to the customer",
      succeededMail.length === 1 && (await customerJobs("settlePending")) === mailBefore + 1,
      `${mailBefore} before, ${await customerJobs("settlePending")} after, ${succeededMail.length} refund succeeded`,
    );
    const expected = await confirmationAddress("settlePending");
    check(
      "pending to succeeded: it goes where the confirmation rule sends it",
      expected !== null && succeededMail[0]?.to === expected,
      `sent to ${succeededMail[0]?.to ?? "nobody"}, the rule gives ${expected ?? "no address"}`,
    );
    const view = link ? await customerView(link.token) : null;
    check("pending to succeeded: the status page now says refunded", view?.refunded?.amount === "$500.00" && view.refundIssued === null, JSON.stringify(view?.refunded));
  });

  check(
    "pending to succeeded, delivered again: still exactly one refund succeeded email",
    (await refundSucceededTo("settlePending")).length === 1,
    `${(await refundSucceededTo("settlePending")).length} queued`,
  );

  /* ============================ C. pending to failed ============================ */
  const failMailBefore = await customerJobs("failAfter");
  await twice("pending to failed", updated("evt_refund_proof_failed", { refund: "re_refund_proof_fail", status: "failed", intent: pi("failAfter"), reason: "expired_or_canceled_card" }), async () => {
    const row = await refundRow("re_refund_proof_fail");
    check("pending to failed: the row is failed with Stripe's reason", row?.status === "failed" && row.failure_reason === "expired_or_canceled_card", JSON.stringify(row));
    const counted = await n(`select coalesce(sum(amount_cents), 0)::int as n from eng_order_payments where kind = 'refund' and order_id = $1 and status in ('pending', 'succeeded')`, [orderId("failAfter")]);
    check("pending to failed: it no longer counts as given back", counted === 0, `${counted} cents counted`);
    const failedEvent = (await eventsOf("failAfter", "refund.failed"))[0];
    check(
      "pending to failed: one internal refund.failed event, saying it failed and why",
      failedEvent?.customer_visible === false && /failed at Stripe: expired_or_canceled_card\./.test(failedEvent.summary ?? ""),
      JSON.stringify(failedEvent),
    );
    check(
      "pending to failed: one audit row",
      (await n(`select count(*)::int as n from eng_audit_events where action = 'order.refund_failed' and entity_id = $1`, [orderId("failAfter")])) === 1,
    );
    check("pending to failed: the firm is alerted, once", (await jobsTo("failAfter", "ops.refund_failed")).length === 1);
    check("pending to failed: the customer is sent nothing", (await customerJobs("failAfter")) === failMailBefore);
    check("pending to failed: the order stays refunded", (await orderStatus("failAfter")) === "refunded");
    check(
      "pending to failed: the commission reversal is not undone",
      (await n(`select count(*)::int as n from eng_partner_entries where reverses_id = $1 and kind = 'reversal'`, [ACCRUAL])) === 1 &&
        (await n(`select count(*)::int as n from eng_partner_entries where order_id = $1`, [orderId("failAfter")])) === 2,
    );
  });

  /* ============================ D. pending to canceled ============================ */
  await twice("pending to canceled", updated("evt_refund_proof_canceled", { refund: "re_refund_proof_cancel", status: "canceled", intent: pi("cancelPending") }), async () => {
    const row = await refundRow("re_refund_proof_cancel");
    check(
      "pending to canceled: the row is cancelled, the schema's spelling, and with no reason from Stripe it stores none",
      row?.status === "cancelled" && row.failure_reason === null,
      JSON.stringify(row),
    );
    const cancelEvent = (await eventsOf("cancelPending", "refund.failed"))[0];
    check("pending to canceled: its internal event says it was canceled", /was canceled at Stripe: Stripe gave no reason\./.test(cancelEvent?.summary ?? ""), cancelEvent?.summary);
    check("pending to canceled: the firm is alerted", (await jobsTo("cancelPending", "ops.refund_failed")).length === 1);
    check("pending to canceled: the order stays refunded", (await orderStatus("cancelPending")) === "refunded");
  });

  /* ============================ E. still pending ============================ */
  {
    const before = await snapshot();
    const res = await deliver(updated("evt_refund_proof_action", { refund: "re_refund_proof_action", status: "requires_action", intent: pi("actionOnly") }));
    const after = JSON.parse(await snapshot());
    const was = JSON.parse(before);
    check(
      "requires_action records the event and changes nothing else",
      res.status === 200 && (await refundRow("re_refund_proof_action"))?.status === "pending" &&
        after.counts.eng_payment_events === was.counts.eng_payment_events + 1 &&
        after.counts.eng_order_events === was.counts.eng_order_events && after.counts.eng_audit_events === was.counts.eng_audit_events,
      `${res.status} ${JSON.stringify(res.body)}`,
    );
  }

  /* ============================ F. the orders screen's named state ============================ */
  {
    const listed = await payments.refundsFailedAfterRefunded();
    const refs = (listed ?? []).map((r) => r.reference).sort();
    check(
      "the orders screen lists exactly the orders whose refund failed after they were marked refunded",
      JSON.stringify(refs) === JSON.stringify(["254-PROOF-R-203", "254-PROOF-R-204"]),
      JSON.stringify(listed),
    );
    const failRow = (listed ?? []).find((r) => r.reference === "254-PROOF-R-203");
    const cancelRow = (listed ?? []).find((r) => r.reference === "254-PROOF-R-204");
    check(
      "and says Failed with Stripe's reason, and Canceled in the rendered spelling",
      failRow?.status === "Failed" && failRow.reason === "expired_or_canceled_card" && cancelRow?.status === "Canceled",
      JSON.stringify({ failRow, cancelRow }),
    );
    const page = readSource("src/app/portal/(app)/orders/page.tsx");
    check(
      "the screen titles that panel with the ruled words and reads this list",
      page.includes('"Refund failed at Stripe, order still marked refunded"') && page.includes("refundsFailedAfterRefunded()"),
    );
  }

  /* ============================ G. a refund id with no row on file ============================ */
  const tasks = () => many(`select title, description from eng_tasks where source_key like 'system:refund-update-unmatched:%' order by source_key`);
  await twice("an unknown refund that failed", updated("evt_refund_proof_unknown_failed", { refund: "re_refund_proof_unknown", status: "failed", amount: 12500, intent: pi("unknown"), reason: "lost_or_stolen_card" }), async () => {
    const [task] = await tasks();
    check(
      "an unknown failed refund raises one staff task naming the charge, the amount and the reason",
      (await tasks()).length === 1 && task.description.includes(pi("unknown")) && task.description.includes("$125.00") && task.description.includes("lost_or_stolen_card"),
      JSON.stringify(task),
    );
    check("and linking the order the charge belongs to", task?.description.includes(`/portal/orders?id=${orderId("unknown")}`), task?.description);
    check("and writes no refund row", (await refundRow("re_refund_proof_unknown")) === null);
  });
  {
    const res = await deliver(updated("evt_refund_proof_unknown_ok", { refund: "re_refund_proof_unknown_ok", status: "succeeded", intent: pi("unknown") }));
    check("an unknown refund that succeeded answers 200 and raises nothing", res.status === 200 && (await tasks()).length === 1, `${res.status} ${JSON.stringify(res.body)}`);
    const orphan = await deliver(updated("evt_refund_proof_orphan", { refund: "re_refund_proof_orphan", status: "canceled", amount: 900, intent: "pi_refund_proof_nobody" }));
    const orphanTask = (await tasks()).find((t) => t.description.includes("pi_refund_proof_nobody"));
    check(
      "an unknown canceled refund on a charge nobody recorded says it matches no order",
      orphan.status === 200 && orphanTask?.description.includes("matches no order") && orphanTask.title.includes("was canceled"),
      JSON.stringify(orphanTask),
    );
  }

  /* ============================ H. a refund that moved since it was read ============================ */
  {
    let raised = null;
    try {
      await db.query(`select public.eng_apply_refund_update($1::jsonb)`, [JSON.stringify({
        event_id: "evt_refund_proof_stale", source: "stripe_webhook", provider: "stripe",
        refund_ref: "re_refund_proof_settle_pending", expected_status: "pending", new_status: "failed",
        order_event_summary: "stale", audit_summary: "stale",
      })]);
    } catch (err) {
      raised = err.message;
    }
    check(
      "an update judged against pending refuses once the row moved, and writes nothing",
      raised !== null && /moved while its update was being recorded/.test(raised) &&
        (await refundRow("re_refund_proof_settle_pending"))?.status === "succeeded" &&
        (await one(`select 1 as x from eng_payment_events where event_id = 'evt_refund_proof_stale'`)) === null,
      raised ?? "it did not raise",
    );
  }
} finally {
  await server.stop();
  await rest.close();
}

{
  const log = readFileSync(server.logPath, "utf8");
  check("no call reached Stripe", !/ACCOUNT MISMATCH/.test(log));
}

await db.close();
console.log("");
if (wrong) {
  console.log(`FAIL: ${wrong} check${wrong === 1 ? "" : "s"} wrong.`);
  process.exit(1);
}
console.log("PASS: a refund update is applied once, both ways out of pending, and a pending refund is told to the customer as issued.");
