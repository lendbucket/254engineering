// @runtime react-server
//
// Declared because it imports src/lib/ops-payments.ts, which carries
// server-only, by a dynamic import the runtime sniffer does not follow.

/**
 * A DECISION'S REFUND COUNTS WHAT IS ALREADY GIVEN BACK.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-decision-refund-counts-earlier-refunds.mjs
 *
 * Operator ruling 7 of 2026-10-15. settleDecision read no earlier refund at
 * all. The pre-dispatch hold (dispatch-hold.ts) calls it on a decline without
 * checking for one, so an order the firm had already cancelled and refunded
 * would have been refunded again. Now settleDecision reads the refunds on
 * file, pending included, and:
 *
 *   1. with none on file, refunds what the rule returns, as before;
 *   2. with the whole amount already refunded or pending, refunds nothing;
 *   3. with part already given back, refunds nothing automatically and says
 *      the rest is settled by hand, because a partial refund under a sentence
 *      written for the whole amount would tell the customer something false;
 *   4. when the read fails, refunds nothing and says so.
 *
 * HOW IT RUNS, as a-pending-refund-is-said-and-counted does: every migration
 * replayed into PGlite and served as PostgREST by scripts/lib/replay-rest.mjs,
 * with a stand-in provider that counts what it is asked to refund. Nothing
 * reaches Stripe, and no server is started.
 */
process.env.STRIPE_SECRET_KEY = "sk_test_decision_refund_proof";

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

/* ------------------------------------------------------------ the database */

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) await db.exec(readSource(join(DIR, f)));
check("every migration replays", files.length > 0, `${files.length} files`);

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CLIENT = id(501);
const EMAIL = "decision-refund-proof@audit-probe.invalid";
const ORDERS = { fresh: 511, wholePending: 512, partPending: 513, readFails: 514 };
const orderId = (k) => id(ORDERS[k]);
const fileId = (k) => id(ORDERS[k] + 100);

await db.exec(`
  insert into eng_clients (id, kind, name) values ('${CLIENT}', 'individual', 'Decision refund proof client, not a real person');
`);
for (const [k, n] of Object.entries(ORDERS)) {
  await db.exec(`
    insert into eng_files (id, file_number, client_id, service_slug, property_address, county, status)
    values ('${fileId(k)}', '254-PROOF-DR-${n}', '${CLIENT}', 'roof-inspections', '${n} Decision Way', 'Nueces', 'intake');
    insert into eng_service_orders
      (id, site, reference, service_slug, order_type, customer_name, customer_email, property_address, county,
       status, total_cents, file_id, client_id, paid_at, technician_visited)
    values
      ('${orderId(k)}', '254engineering', '254-PROOF-D-${n}', 'roof-inspections', 'field',
       'Decision refund proof customer, not a real person', '${EMAIL}', '${n} Decision Way', 'Nueces',
       'in_fulfilment', 50000, '${fileId(k)}', '${CLIENT}', now(), false);
    insert into eng_order_payments (order_id, kind, amount_cents, provider, provider_ref, status)
    values ('${orderId(k)}', 'charge', 50000, 'stripe', 'pi_decision_refund_proof_${k}', 'succeeded');
  `);
}
await db.exec(`
  insert into eng_order_payments (order_id, kind, amount_cents, provider, provider_ref, status, refund_case)
  values ('${orderId("wholePending")}', 'refund', 50000, 'stripe', 're_decision_proof_whole', 'pending', 'cancelled_by_the_firm'),
         ('${orderId("partPending")}', 'refund', 20000, 'stripe', 're_decision_proof_part', 'pending', 'cancelled_by_the_firm');
`);

/* ------------------------------------------------------------- the failure */

/*
 * The admin client binds the global fetch when it is first made, so the
 * failure is armed here, before anything makes it, and answers only the read
 * of earlier refunds for the one order named. The charge read beside it still
 * succeeds, so a refusal can only come from the read under test.
 */
let failPriorRefundReadFor = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = decodeURIComponent(String(input instanceof Request ? input.url : input));
  if (
    failPriorRefundReadFor &&
    url.includes("/eng_order_payments?") &&
    url.includes("select=amount_cents") &&
    url.includes("kind=eq.refund") &&
    url.includes(`order_id=eq.${failPriorRefundReadFor}`)
  ) {
    return new Response(JSON.stringify({ code: "PROOF", message: "the proof failed this read", details: null, hint: null }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  return realFetch(input, init);
};

const rest = await startReplayRest(db, PORTS.replayRest);
process.env.SUPABASE_URL = rest.url;
process.env.SUPABASE_SERVICE_ROLE_KEY = "replay-stand-in";
process.env.ORDER_PAYMENTS_FAKE = "";
const payments = await import("../../src/lib/ops-payments.ts");
const { fakeProvider } = await import("../../src/lib/payments.ts");

const asked = [];
payments.setPaymentProvider({
  ...fakeProvider(),
  name: "stripe",
  refund: async (r) => {
    const ref = `re_decision_proof_${asked.length + 1}`;
    asked.push({ amountCents: r.amountCents });
    return { ref, amountCents: r.amountCents, status: "succeeded" };
  },
});

const many = async (sql, params = []) => (await db.query(sql, params)).rows;
const refundsOn = (k) => many(`select amount_cents, status from eng_order_payments where kind = 'refund' and order_id = $1 order by created_at`, [orderId(k)]);
const eventsOn = (k) => many(`select event, summary, customer_visible from eng_order_events where order_id = $1 order by created_at`, [orderId(k)]);
const settle = (k) => payments.settleDecision({ orderId: orderId(k), outcome: "refuse" });

try {
  /* ====================== 1. nothing on file: the rule's refund ====================== */
  {
    const before = asked.length;
    const res = await settle("fresh");
    const asks = asked.slice(before);
    check(
      "with no earlier refund, a decline with no visit refunds the whole amount",
      res.ok === true && asks.length === 1 && asks[0].amountCents === 50000,
      `${JSON.stringify(asks)} ${JSON.stringify(res)}`,
    );
  }

  /* ================= 2. the whole amount already refunded or pending ================= */
  {
    const before = asked.length;
    const res = await settle("wholePending");
    const rows = await refundsOn("wholePending");
    const events = await eventsOn("wholePending");
    check(
      "with the whole amount already refunded or pending, nothing more is asked of Stripe",
      res.ok === true && res.refundedCents === 0 && asked.length === before,
      `${asked.length - before} refund(s) asked; ${JSON.stringify(res)}`,
    );
    check(
      "and no second refund row is written, and the order says why, internally",
      rows.length === 1 && events.some((e) => e.event === "refund.already_given" && e.customer_visible === false),
      `${rows.length} refund row(s); ${events.map((e) => e.event).join(", ")}`,
    );
  }

  /* =================== 3. part already given back: settled by hand =================== */
  {
    const before = asked.length;
    const res = await settle("partPending");
    const rows = await refundsOn("partPending");
    const events = await eventsOn("partPending");
    check(
      "with part already given back, nothing is refunded automatically",
      res.ok === false && /settled by hand/.test(res.error) && asked.length === before && rows.length === 1,
      `${asked.length - before} refund(s) asked; ${JSON.stringify(res)}`,
    );
    check(
      "and the order says the rest is settled by hand, and tells the customer nothing",
      events.some((e) => e.event === "refund.needs_hand" && e.customer_visible === false) &&
        !events.some((e) => e.customer_visible === true && /refund/i.test(e.event)),
      events.map((e) => `${e.event}${e.customer_visible ? " (customer)" : ""}`).join(", "),
    );
  }

  /* ========================= 4. the read of earlier refunds fails ========================= */
  {
    const before = asked.length;
    failPriorRefundReadFor = orderId("readFails");
    let res;
    try {
      res = await settle("readFails");
    } finally {
      failPriorRefundReadFor = null;
    }
    const rows = await refundsOn("readFails");
    const events = await eventsOn("readFails");
    check(
      "a decline whose read of earlier refunds fails is refused and asks Stripe for nothing",
      res?.ok === false && /could not be read/.test(res.error) && asked.length === before && rows.length === 0,
      `${asked.length - before} refund(s) asked; ${JSON.stringify(res)}`,
    );
    check(
      "and the order records the block, internally",
      events.some((e) => e.event === "refund.blocked" && e.customer_visible === false),
      events.map((e) => e.event).join(", "),
    );
  }
  payments.setPaymentProvider(null);
} finally {
  await rest.close();
}
await db.close();

console.log("");
if (wrong) {
  console.log(`FAIL: ${wrong} check${wrong === 1 ? "" : "s"} wrong.`);
  process.exit(1);
}
console.log("PASS: a decision's refund counts what is already refunded or pending, and refuses when it cannot read it.");
