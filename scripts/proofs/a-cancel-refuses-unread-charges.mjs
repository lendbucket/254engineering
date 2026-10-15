// @runtime react-server
//
// Declared because it imports src/lib/ops-payments.ts, which carries
// server-only, by a dynamic import the runtime sniffer does not follow.

/**
 * A CANCELLATION THAT CANNOT READ THE CHARGES REFUSES.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-cancel-refuses-unread-charges.mjs
 *
 * Operator ruling, 2026-10-15, the same pattern as ruling 6 on the refunds
 * read beside it. cancelAndRefund read the order's charges and discarded the
 * error, so a failed read looked like an order with nothing charged: the paid
 * order was closed as "canceled with nothing charged", nothing was refunded,
 * and the record said the customer had never paid.
 *
 * HOW IT RUNS, as a-pending-refund-is-said-and-counted does: every migration
 * replayed into PGlite and served as PostgREST by scripts/lib/replay-rest.mjs,
 * with a stand-in provider that counts what it is asked to refund. Nothing
 * reaches Stripe, and no server is started.
 */
process.env.STRIPE_SECRET_KEY = "sk_test_unread_charges_proof";

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
const CLIENT = id(601);
const EMAIL = "unread-charges-proof@audit-probe.invalid";
const ORDERS = { readable: 611, readFails: 612 };
const orderId = (k) => id(ORDERS[k]);
const fileId = (k) => id(ORDERS[k] + 100);

await db.exec(`
  insert into eng_clients (id, kind, name) values ('${CLIENT}', 'individual', 'Unread charges proof client, not a real person');
`);
for (const [k, n] of Object.entries(ORDERS)) {
  await db.exec(`
    insert into eng_files (id, file_number, client_id, service_slug, property_address, county, status)
    values ('${fileId(k)}', '254-PROOF-UC-${n}', '${CLIENT}', 'roof-inspections', '${n} Charge Way', 'Nueces', 'intake');
    insert into eng_service_orders
      (id, site, reference, service_slug, order_type, customer_name, customer_email, property_address, county,
       status, total_cents, file_id, client_id, paid_at)
    values
      ('${orderId(k)}', '254engineering', '254-PROOF-C-${n}', 'roof-inspections', 'field',
       'Unread charges proof customer, not a real person', '${EMAIL}', '${n} Charge Way', 'Nueces',
       'in_fulfilment', 50000, '${fileId(k)}', '${CLIENT}', now());
    insert into eng_order_payments (order_id, kind, amount_cents, provider, provider_ref, status)
    values ('${orderId(k)}', 'charge', 50000, 'stripe', 'pi_unread_charges_proof_${k}', 'succeeded');
  `);
}

/* ------------------------------------------------------------- the failure */

/*
 * The admin client binds the global fetch when it is first made, so the
 * failure is armed here, before anything makes it, and answers only the read
 * of charges for the one order named.
 */
let failChargeReadFor = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = decodeURIComponent(String(input instanceof Request ? input.url : input));
  if (
    failChargeReadFor &&
    url.includes("/eng_order_payments?") &&
    url.includes("select=provider,provider_ref,amount_cents") &&
    url.includes("kind=eq.charge") &&
    url.includes(`order_id=eq.${failChargeReadFor}`)
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
    asked.push({ amountCents: r.amountCents });
    return { ref: `re_unread_charges_proof_${asked.length}`, amountCents: r.amountCents, status: "succeeded" };
  },
});

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0] ?? null;
const many = async (sql, params = []) => (await db.query(sql, params)).rows;
const actor = { id: null, role: "admin", email: EMAIL };
const cancel = (k) => payments.cancelAndRefund({ orderId: orderId(k), reason: "The proof cancels this order on the firm's decision.", actor });

try {
  /* ====================== the control: the charges are read ====================== */
  {
    const before = asked.length;
    const res = await cancel("readable");
    check(
      "with the charges read, a firm cancellation refunds what was paid",
      res.ok === true && asked.length === before + 1 && asked[before].amountCents === 50000,
      JSON.stringify(res),
    );
  }

  /* ====================== the read of charges fails ====================== */
  {
    const before = asked.length;
    failChargeReadFor = orderId("readFails");
    let res;
    try {
      res = await cancel("readFails");
    } finally {
      failChargeReadFor = null;
    }
    check(
      "a cancellation whose read of charges fails is refused and asks Stripe for nothing",
      res?.ok === false && /could not be read/.test(res.error) && asked.length === before,
      `${asked.length - before} refund(s) asked; ${JSON.stringify(res)}`,
    );
    const order = await one(`select status from eng_service_orders where id = $1`, [orderId("readFails")]);
    const events = await many(`select event, summary from eng_order_events where order_id = $1`, [orderId("readFails")]);
    const audit = await many(`select action from eng_audit_events where entity_id = $1`, [orderId("readFails")]);
    check(
      "and the paid order is left as it was, never closed as canceled with nothing charged",
      order?.status === "in_fulfilment" &&
        !events.some((e) => /nothing charged|canceled this order/i.test(e.summary ?? "")) &&
        !audit.some((a) => a.action === "order.cancelled_by_firm"),
      `${order?.status}; ${events.map((e) => e.event).join(", ") || "no events"}; ${audit.map((a) => a.action).join(", ") || "no audit"}`,
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
console.log("PASS: a cancellation that cannot read the charges refuses, and a paid order is never closed as unpaid.");
