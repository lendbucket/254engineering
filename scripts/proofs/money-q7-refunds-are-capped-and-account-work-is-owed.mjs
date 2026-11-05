// @runtime react-server
//
// Declared because it imports src/lib/ops-payments.ts and src/lib/ops-bulk.ts,
// which carry server-only, by a dynamic import the runtime sniffer does not follow.

/**
 * Q7, MONEY FINDINGS F1, F3 AND F4. Robert's ruling of 2026-11-02, verbatim:
 * "money F1, F3, F4: single orders through refundableOn, capped at what is
 * left; invoiceAccount writes account_id, runs creditDecision, calls
 * acceptOnInvoice; exposure counts open and issued statements."
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/money-q7-refunds-are-capped-and-account-work-is-owed.mjs
 *
 * HOW IT RUNS, as a-pending-refund-is-said-and-counted does: every migration is
 * replayed into PGlite and served as PostgREST by scripts/lib/replay-rest.mjs,
 * and the decisions run in this process against it, with a stand-in provider
 * that counts what it is asked to refund. Nothing reaches Stripe.
 *
 * F1, the audit's numbers. A roof order paid $709.00, with $100.00 already
 * given back from Stripe's dashboard and on file. A decline with no visit asks
 * the rule for $709.00 and only $609.00 is left: the old code asked Stripe for
 * $709.00, and now nothing is asked and the refusal is said. A decline after a
 * visit asks for $534.00 ($709.00 less the disclosed $175.00), which is inside
 * what is left, so it is refunded: the cap refuses only what cannot be given.
 *
 * F4. A $5,000.00 limit with October's $4,800.00 closed onto a statement that
 * is still OPEN (not yet issued), every order on it carrying the statement's
 * id. The old reader counted issued statements only and read $0.00 owed; now
 * $4,800.00, and a $500.00 order is refused where it was granted.
 *
 * F3, the credit half, on the same reader. $4,900.00 of unbilled invoiced work
 * against a $5,000.00 limit, and a $709.00 telephoned job: the gate the invoice
 * route now asks refuses it. That the route asks it at all, before the order,
 * that the order carries the account and that acceptOnInvoice follows, is
 * asserted on the source by intake-audit and below; the route itself cannot be
 * driven in this process because the launch gate is shut here and refuses it
 * before any of this code runs.
 */
process.env.STRIPE_SECRET_KEY = "sk_test_money_q7_proof";

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
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) await db.exec(readSource(join(DIR, f)));
check("every migration replays", files.length > 0, `${files.length} files`);

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const EMAIL = "money-q7-proof@audit-probe.invalid";
const CLIENT = id(1);
const CLIENT_OPEN = id(2);
const CLIENT_UNBILLED = id(3);
const ACCOUNT_OPEN = id(20);
const ACCOUNT_UNBILLED = id(21);
const STATEMENT_OPEN = id(30);

await db.exec(`
  insert into eng_clients (id, kind, name) values
    ('${CLIENT}', 'individual', 'Money Q7 proof client, not a real person'),
    ('${CLIENT_OPEN}', 'organization', 'Money Q7 open statement proof company, not real'),
    ('${CLIENT_UNBILLED}', 'organization', 'Money Q7 unbilled proof company, not real');
`);

/* ---------------------------------------------------------------- F1 orders */
const F1 = { noVisit: 101, visited: 102 };
for (const [k, n] of Object.entries(F1)) {
  const visited = k === "visited";
  await db.exec(`
    insert into eng_files (id, file_number, client_id, service_slug, property_address, county, status)
    values ('${id(n + 100)}', '254-PROOF-Q7-${n}', '${CLIENT}', 'roof-inspections', '${n} Capped Way', 'Bexar', 'intake');
    insert into eng_service_orders
      (id, site, reference, service_slug, order_type, customer_name, customer_email, property_address, county,
       status, total_cents, file_id, client_id, paid_at, technician_visited, inspection_fee_cents)
    values
      ('${id(n)}', '254engineering', '254-PROOF-Q7-${n}', 'roof-inspections', 'field',
       'Money Q7 proof customer, not a real person', '${EMAIL}', '${n} Capped Way', 'Bexar',
       'in_fulfilment', 70900, '${id(n + 100)}', '${CLIENT}', now(), ${visited}, 17500);
    insert into eng_order_payments (order_id, kind, amount_cents, provider, provider_ref, status)
    values ('${id(n)}', 'charge', 70900, 'stripe', 'pi_money_q7_${k}', 'succeeded');
    insert into eng_order_payments (order_id, kind, amount_cents, provider, provider_ref, status, refund_case)
    values ('${id(n)}', 'refund', 10000, 'stripe', 're_money_q7_goodwill_${k}', 'succeeded', 'issued_outside_the_platform');
  `);
}

/* ------------------------------------------------------- F4 and F3 accounts */
await db.exec(`
  insert into eng_customer_accounts (id, site, client_id, status, billing_mode, credit_limit_cents, net_days)
  values ('${ACCOUNT_OPEN}', '254engineering', '${CLIENT_OPEN}', 'active', 'invoice', 500000, 30),
         ('${ACCOUNT_UNBILLED}', '254engineering', '${CLIENT_UNBILLED}', 'active', 'invoice', 500000, 30);
  insert into eng_statements (id, account_id, reference, period, status, total_cents)
  values ('${STATEMENT_OPEN}', '${ACCOUNT_OPEN}', 'ST-PROOF-Q7-2026-10', '2026-10', 'open', 480000);
`);
/* October's two orders, closed onto the open statement: each carries its id. */
for (const [n, cents] of [[201, 300000], [202, 180000]]) {
  await db.exec(`
    insert into eng_service_orders
      (id, site, reference, service_slug, order_type, customer_name, customer_email, property_address, county,
       status, total_cents, client_id, account_id, billing_mode, statement_id, paid_at)
    values
      ('${id(n)}', '254engineering', '254-PROOF-Q7-${n}', 'roof-inspections', 'field',
       'Money Q7 proof company, not real', '${EMAIL}', '${n} Statement Way', 'Bexar',
       'complete', ${cents}, '${CLIENT_OPEN}', '${ACCOUNT_OPEN}', 'invoice', '${STATEMENT_OPEN}', now());
  `);
}
/* $4,900.00 of invoiced work on the other account, done and not yet billed. */
await db.exec(`
  insert into eng_service_orders
    (id, site, reference, service_slug, order_type, customer_name, customer_email, property_address, county,
     status, total_cents, client_id, account_id, billing_mode, paid_at)
  values
    ('${id(301)}', '254engineering', '254-PROOF-Q7-301', 'roof-inspections', 'field',
     'Money Q7 proof company, not real', '${EMAIL}', '301 Unbilled Way', 'Bexar',
     'in_fulfilment', 490000, '${CLIENT_UNBILLED}', '${ACCOUNT_UNBILLED}', 'invoice', now());
`);

const rest = await startReplayRest(db, PORTS.replayRest);
process.env.SUPABASE_URL = rest.url;
process.env.SUPABASE_SERVICE_ROLE_KEY = "replay-stand-in";
process.env.ORDER_PAYMENTS_FAKE = "";
const payments = await import("../../src/lib/ops-payments.ts");
const { accountBalance } = await import("../../src/lib/ops-bulk.ts");
const { creditDecision } = await import("../../src/lib/account-credit.ts");
const { fakeProvider } = await import("../../src/lib/payments.ts");

const asked = [];
const stripeAnswering = (ref) => ({
  ...fakeProvider(),
  name: "stripe",
  refund: async (r) => {
    asked.push({ ref, amountCents: r.amountCents });
    return { ref, amountCents: r.amountCents, status: "succeeded" };
  },
});
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0] ?? null;

try {
  /* ==================================================================== F1 */
  {
    payments.setPaymentProvider(stripeAnswering("re_money_q7_no_visit"));
    const before = asked.length;
    const res = await payments.settleDecision({ orderId: id(F1.noVisit), outcome: "refuse" });
    const blocked = await one(`select summary from eng_order_events where order_id = $1 and event = 'refund.blocked'`, [id(F1.noVisit)]);
    check(
      "F1: a decline with no visit on $709.00 paid and $100.00 already back asks Stripe for nothing",
      asked.length === before,
      asked.slice(before).map((a) => `asked ${a.amountCents}`).join(", ") || "nothing asked",
    );
    check(
      "and is refused, naming the $709.00 the rule gives and the $609.00 left",
      res.ok === false && /\$709\.00/.test(res.error ?? "") && /\$609\.00/.test(res.error ?? ""),
      res.ok ? "ok" : res.error,
    );
    check("and says so on the order's timeline, for a person to settle", Boolean(blocked) && /A person settles it/.test(String(blocked?.summary)), blocked?.summary ?? "no event");
  }
  {
    payments.setPaymentProvider(stripeAnswering("re_money_q7_visited"));
    const before = asked.length;
    const res = await payments.settleDecision({ orderId: id(F1.visited), outcome: "refuse" });
    const asks = asked.slice(before);
    check(
      "F1: a decline after a visit asks for $534.00, inside the $609.00 left, and it is refunded",
      res.ok === true && asks.length === 1 && asks[0].amountCents === 53400,
      res.ok ? asks.map((a) => a.amountCents).join(", ") : res.error,
    );
  }
  payments.setPaymentProvider(null);

  /* ==================================================================== F4 */
  {
    const balance = await accountBalance(ACCOUNT_OPEN);
    check(
      "F4: October's $4,800.00, closed onto a statement not yet issued, is owed",
      balance.outstandingCents === 480000 && balance.issuedUnpaidCents === 480000,
      JSON.stringify(balance),
    );
    check("and an open statement has no due date, so nothing reads as overdue", balance.oldestUnpaidDays === null, String(balance.oldestUnpaidDays));
    const verdict = creditDecision(
      { billingMode: "invoice", status: "active", creditLimitCents: 500000, outstandingCents: balance.outstandingCents, oldestUnpaidDays: balance.oldestUnpaidDays, netDays: 30 },
      50000,
    );
    check("and a $500.00 order on the $5,000.00 limit is refused, where $0.00 owed would have granted it", verdict.ok === false, verdict.message ?? "");
  }

  /* ==================================================================== F3 */
  {
    const balance = await accountBalance(ACCOUNT_UNBILLED);
    const verdict = creditDecision(
      { billingMode: "invoice", status: "active", creditLimitCents: 500000, outstandingCents: balance.outstandingCents, oldestUnpaidDays: balance.oldestUnpaidDays, netDays: 30 },
      70900,
    );
    check(
      "F3: a $709.00 telephoned job on $4,900.00 owed against a $5,000.00 limit is refused by the gate the invoice route asks",
      balance.outstandingCents === 490000 && verdict.ok === false,
      `${balance.outstandingCents} owed; ${verdict.ok ? "granted" : verdict.message}`,
    );
  }
  {
    const billing = readFileSync("src/lib/ops-job-billing.ts", "utf8");
    const start = billing.indexOf("export async function invoiceAccount(");
    const body = start < 0 ? "" : billing.slice(start);
    const gate = body.indexOf("creditDecision(");
    const raise = body.indexOf('createOrderForFile(actor, file, client, "invoice", account.id as string)');
    const accept = body.indexOf("await acceptOnInvoice(order.orderId)");
    check(
      "F3: invoiceAccount asks creditDecision, then raises the order on the account, then accepts it on the account",
      start > -1 && gate > -1 && raise > gate && accept > raise,
      `creditDecision ${gate}, order ${raise}, acceptOnInvoice ${accept}`,
    );
    check("and the order row it writes carries account_id", /account_id: accountId,/.test(billing));
  }
} finally {
  await rest.close();
}

await db.close();
console.log("");
if (wrong) {
  console.log(`FAIL: ${wrong} check${wrong === 1 ? "" : "s"} wrong.`);
  process.exit(1);
}
console.log("PASS: a single order's refund is capped at what is left on its charge, a closed but unissued statement is owed, and the invoice route asks the credit gate, bills the account and accepts the order on it.");
