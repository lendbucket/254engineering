/**
 * A PAYMENT RELEASES WORK ONLY FOR ITS OWN AMOUNT, AND AN ACCOUNT'S CREDIT IS
 * HELD BY ONE SUBMISSION AT A TIME.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-payment-releases-only-its-own-amount-and-credit-is-held-once.mjs
 *
 * Money audit F12 and F6 (audit-money.md, 6585008424), Robert's answer of
 * 2026-11-03 to 6594441148, migration 0122:
 *
 *   F12. eng_apply_order_paid and eng_apply_batch_paid write a charge for an
 *        amount other than expected_amount_cents and release nothing; a payload
 *        that names no expectation behaves as 0075 wrote it; markPaid and
 *        markBatchPaid pass the order's and the submission's own total, and
 *        raise a task for a person when the database answers amount_differs.
 *   F6.  eng_take_credit_hold gives an account's hold to one token at a time,
 *        releases only for the token that took it, and lets a lapsed hold be
 *        taken; placeBatch takes it for an invoice account before the balance
 *        is read and releases it in a finally.
 *
 * Every migration replayed into PGlite; the source checks read the files.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const { readSource } = await import("../lib/read-source.mjs");
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");

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
check("every migration replays, 0122 among them", files.some((f) => f.startsWith("0122_")), `${files.length} files`);

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CLIENT = id(1);
const ACCOUNT = id(2);
const SHORT = id(3);
const EXACT = id(4);
const OLD_CALLER = id(5);
const BATCH = id(6);
const IN_BATCH = id(7);
const EMAIL = "f12-f6-money-proof@audit-probe.invalid";

const order = (oid, ref, status, total, batch = null) => `
  ('${oid}', '254engineering', '${ref}', 'roof-inspections', 'field',
   'F12 money proof customer, not a real person', '${EMAIL}', '${ref} Payment Way', 'Nueces',
   '${status}', ${total}, '${CLIENT}', ${batch ? `'${batch}'` : "null"}, 'card')`;

await db.exec(`
  insert into eng_clients (id, kind, name) values ('${CLIENT}', 'individual', 'F12 money proof client, not a real person');
  insert into eng_customer_accounts (id, site, client_id, billing_mode) values ('${ACCOUNT}', '254engineering', '${CLIENT}', 'invoice');
  insert into eng_order_batches (id, site, reference, account_id, service_slug, status, submitted_count, accepted_count, rejected_count, total_cents, client_request_id)
  values ('${BATCH}', '254engineering', '254-B-PROOF-F12', '${ACCOUNT}', 'roof-inspections', 'awaiting_payment', 1, 1, 0, 70900, 'f12-proof-batch');
  insert into eng_service_orders
    (id, site, reference, service_slug, order_type, customer_name, customer_email, property_address, county,
     status, total_cents, client_id, batch_id, billing_mode)
  values
    ${order(SHORT, "254-PROOF-F12-3", "awaiting_payment", 70900)},
    ${order(EXACT, "254-PROOF-F12-4", "awaiting_payment", 70900)},
    ${order(OLD_CALLER, "254-PROOF-F12-5", "awaiting_payment", 70900)},
    ${order(IN_BATCH, "254-PROOF-F12-7", "awaiting_payment", 70900, BATCH)};
`);

const call = async (fn, p) => (await db.query(`select public.${fn}($1::jsonb) as a`, [JSON.stringify(p)])).rows[0].a;
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];

const paid = (oid, ev, ref, amount, extra = {}) => ({
  event_id: ev,
  source: "stripe_webhook",
  order_id: oid,
  charge_ref: ref,
  amount_cents: amount,
  provider: "stripe",
  expected_status: "awaiting_payment",
  transition: "release",
  received_summary: "Payment received.",
  unexpected_summary: "A payment arrived while the order was not awaiting it.",
  amount_differs_summary: "The charge is not the order's amount.",
  audit_summary: "received",
  ...extra,
});

/* ------------------------------------------------------------------ F12, one order */

const short = await call("eng_apply_order_paid", paid(SHORT, "evt_f12_short", "pi_f12_short", 100, { expected_amount_cents: 70900 }));
check("F12: a $1.00 charge against a $709.00 order answers amount_differs", short.amount_differs === true, JSON.stringify(short));
check("F12: and releases nothing", Array.isArray(short.release) && short.release.length === 0);
const shortOrder = await one(`select status, paid_at from eng_service_orders where id = $1`, [SHORT]);
check("F12: the order stays awaiting payment, with no paid time", shortOrder.status === "awaiting_payment" && shortOrder.paid_at === null, shortOrder.status);
const shortCharge = await one(`select count(*)::int as n, max(amount_cents)::int as amount from eng_order_payments where order_id = $1 and kind = 'charge'`, [SHORT]);
check("F12: the charge is still written down, at what was taken", shortCharge.n === 1 && shortCharge.amount === 100, `${shortCharge.n} at ${shortCharge.amount}`);
const shortTrail = await one(
  `select (select count(*)::int from eng_order_events where order_id = $1 and event = 'payment.unexpected' and not customer_visible) as ev,
          (select count(*)::int from eng_audit_events where entity_id = $1::text and action = 'order.payment_amount_differs') as au,
          (select status from eng_payment_events where event_id = 'evt_f12_short') as pe`,
  [SHORT],
);
check("F12: an internal payment.unexpected line and an audit row name it", shortTrail.ev === 1 && shortTrail.au === 1, JSON.stringify(shortTrail));
check("F12: and the payment event is done, so a resend changes nothing", shortTrail.pe === "done");
const resent = await call("eng_apply_order_paid", paid(SHORT, "evt_f12_short", "pi_f12_short", 100, { expected_amount_cents: 70900 }));
check("F12: a resend of that event answers done", resent.outcome === "done", JSON.stringify(resent));

const exact = await call("eng_apply_order_paid", paid(EXACT, "evt_f12_exact", "pi_f12_exact", 70900, { expected_amount_cents: 70900 }));
check("F12: the order's own amount releases the order", exact.outcome === "applied" && exact.release?.[0] === EXACT && exact.amount_differs === undefined, JSON.stringify(exact));
check("F12: and moves it to fulfilment", (await one(`select status from eng_service_orders where id = $1`, [EXACT])).status === "in_fulfilment");

const old = await call("eng_apply_order_paid", paid(OLD_CALLER, "evt_f12_old", "pi_f12_old", 100));
check("F12: a payload that names no expectation behaves as 0075 did", old.release?.[0] === OLD_CALLER && old.amount_differs === undefined, JSON.stringify(old));

/* ------------------------------------------------------------------ F12, a batch */

const batchPaid = {
  event_id: "evt_f12_batch",
  source: "stripe_webhook",
  batch_id: BATCH,
  charge_ref: "pi_f12_batch",
  amount_cents: 50000,
  provider: "stripe",
  expected_status: "awaiting_payment",
  orders: [{ id: IN_BATCH, expected_status: "awaiting_payment", release: true }],
  expected_amount_cents: 70900,
  received_summary: "Paid as part of the submission.",
  amount_differs_summary: "The charge is not the submission's amount.",
  audit_summary: "received",
};
const batch = await call("eng_apply_batch_paid", batchPaid);
check("F12: a short charge on a submission answers amount_differs and releases nothing", batch.amount_differs === true && batch.release.length === 0, JSON.stringify(batch));
const batchAfter = await one(
  `select (select status from eng_order_batches where id = $1) as b,
          (select status from eng_service_orders where id = $2) as o,
          (select count(*)::int from eng_order_payments where batch_id = $1) as charges,
          (select count(*)::int from eng_audit_events where entity_id = $1::text and action = 'batch.payment_amount_differs') as au`,
  [BATCH, IN_BATCH],
);
check(
  "F12: the submission is not accepted, its order not released, the charge written and an audit row names it",
  batchAfter.b === "awaiting_payment" && batchAfter.o === "awaiting_payment" && batchAfter.charges === 1 && batchAfter.au === 1,
  JSON.stringify(batchAfter),
);

/* ------------------------------------------------------------------ F6, the hold */

const A = id(101);
const B = id(102);
const C = id(103);
const take = async (token, secs = 900) =>
  (await one(`select public.eng_take_credit_hold($1::uuid, $2::uuid, $3::int) as t`, [ACCOUNT, token, secs])).t;
const release = async (token) => db.query(`select public.eng_release_credit_hold($1::uuid, $2::uuid)`, [ACCOUNT, token]);

check("F6: the first submission takes the account's hold", (await take(A)) === true);
check("F6: a second submission in the same moment does not", (await take(B)) === false);
await release(B);
check("F6: a release by a token that never held it releases nothing", (await take(B)) === false);
await release(A);
check("F6: once the holder releases, the next submission takes it", (await take(B)) === true);
await db.query(`update eng_account_credit_holds set held_until = now() - interval '1 second' where account_id = $1`, [ACCOUNT]);
check("F6: a hold left by a request that died lapses, and can be taken", (await take(C)) === true);
await release(B);
check("F6: the lapsed holder's late release does not free the new holder's hold", (await take(A)) === false);

let refused = "";
try {
  await take(A, 0);
} catch (e) {
  refused = String(e?.message ?? e);
}
check("F6: a hold with no length is refused", refused.includes("needs an account, a token and a length"), refused);

/* ------------------------------------------------------------------ the callers */

const payments = readSource("src/lib/ops-payments.ts");
const markPaidBody = payments.slice(payments.indexOf("export async function markPaid("), payments.indexOf("export type ReleaseResult"));
check("F12: markPaid reads the order's total", markPaidBody.includes('.select("id, reference, status, total_cents")'));
check("F12: markPaid passes it as expected_amount_cents", markPaidBody.includes("{ expected_amount_cents: expectedCents }"));
check(
  "F12: markPaid raises a task for a person when the database answers amount_differs",
  /if \(applied\.detail\.amount_differs === true\) \{\s*await raiseRefundTask\(\{\s*key: `payment-amount-differs:\$\{input\.orderId\}/.test(markPaidBody),
);
const batchBody = payments.slice(payments.indexOf("export async function markBatchPaid("), payments.indexOf("export async function expireCheckout("));
check("F12: markBatchPaid passes the submission's own total", batchBody.includes('.select("id, reference, status, total_cents")') && batchBody.includes("{ expected_amount_cents: expectedCents }"));
check("F12: markBatchPaid raises a task when the database answers amount_differs", /if \(applied\.detail\.amount_differs === true\) \{\s*await raiseRefundTask\(/.test(batchBody));

const bulk = readSource("src/lib/ops-bulk.ts");
const outer = bulk.slice(bulk.indexOf("export async function placeBatch("), bulk.indexOf("async function placeBatchUnheld("));
const inner = bulk.slice(bulk.indexOf("async function placeBatchUnheld("));
check("F6: placeBatch takes the hold for an invoice account", outer.includes('db.rpc("eng_take_credit_hold"') && outer.includes('mode?.billing_mode !== "invoice"'));
check("F6: and refuses with a sentence when another submission holds it", outer.includes("if (taken !== true)") && outer.includes("Nothing was placed."));
check("F6: and releases it in a finally, whatever the batch did", /try \{\s*return await placeBatchUnheld\(input\);\s*\} finally \{\s*const \{ error: releaseError \} = await db\.rpc\("eng_release_credit_hold"/.test(outer));
check("F6: the balance is read only inside the held body", !outer.includes("accountBalance(") && inner.includes("await accountBalance(input.accountId)"));

console.log(wrong === 0 ? "PASS: a payment releases only its own amount, and an account's credit is held by one submission at a time." : `FAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
