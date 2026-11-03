// @runtime react-server
//
// Declared because it imports src/lib/ops-payments.ts, which carries
// server-only, by a dynamic import the runtime sniffer does not follow.

/**
 * A PLATFORM REFUND, A LATE EXPIRY AND A SHORT BATCH EACH COUNT ONCE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-platform-refund-a-late-expiry-and-a-short-batch-each-count-once.mjs
 *
 * Robert's ruling Q8 of 2026-11-02 (money audit F2, F5, F7):
 *
 *   F2. A platform refund's row is inserted pending before Stripe is asked, so
 *       a charge.refunded webhook landing inside the call sees it and records
 *       nothing, and the ledger carries the money once. A row that cannot take
 *       Stripe's answer is cancelled, never left pending to count twice.
 *   F5. An expired session that is not the order's latest checkout closes
 *       nothing, and a payment that lands on a cancelled order raises a staff
 *       task naming it.
 *   F7. A batch's stored total is the sum of the members actually placed.
 *
 * HOW IT RUNS, as a-pending-refund-is-said-and-counted does: every migration
 * replayed into PGlite and served as PostgREST by scripts/lib/replay-rest.mjs,
 * the decisions run in this process with a stand-in provider. The stand-in
 * refund delivers the webhook itself, inside the call, which is the race the
 * audit describes. Nothing reaches Stripe.
 */
process.env.STRIPE_SECRET_KEY = "sk_test_q8_money_proof";

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
const CLIENT = id(1);
const EMAIL = "q8-money-proof@audit-probe.invalid";
const ORDERS = { race: 801, collide: 802, other: 803, expireTwo: 804, expireOne: 805, paidLate: 806 };
const orderId = (k) => id(ORDERS[k]);
const fileId = (k) => id(ORDERS[k] + 100);
const STATUS = { race: "in_fulfilment", collide: "in_fulfilment", other: "in_fulfilment", expireTwo: "awaiting_payment", expireOne: "awaiting_payment", paidLate: "cancelled" };

await db.exec(`insert into eng_clients (id, kind, name) values ('${CLIENT}', 'individual', 'Q8 money proof client, not a real person');`);
for (const [k, n] of Object.entries(ORDERS)) {
  await db.exec(`
    insert into eng_files (id, file_number, client_id, service_slug, property_address, county, status)
    values ('${fileId(k)}', '254-PROOF-Q8-${n}', '${CLIENT}', 'roof-inspections', '${n} Ledger Way', 'Nueces', 'intake');
    insert into eng_service_orders
      (id, site, reference, service_slug, order_type, customer_name, customer_email, property_address, county,
       status, total_cents, file_id, client_id)
    values
      ('${orderId(k)}', '254engineering', '254-PROOF-Q8-${n}', 'roof-inspections', 'field',
       'Q8 money proof customer, not a real person', '${EMAIL}', '${n} Ledger Way', 'Nueces',
       '${STATUS[k]}', 50000, '${fileId(k)}', '${CLIENT}');
  `);
  if (STATUS[k] === "in_fulfilment") {
    await db.exec(`
      insert into eng_order_payments (order_id, kind, amount_cents, provider, provider_ref, status)
      values ('${orderId(k)}', 'charge', 50000, 'stripe', 'pi_q8_${k}', 'succeeded');
    `);
  }
}
/* A refund row already carrying the id Stripe will answer with, on another order: the collision the settle step must survive. */
await db.exec(`
  insert into eng_order_payments (order_id, kind, amount_cents, provider, provider_ref, status, refund_case)
  values ('${orderId("other")}', 'refund', 100, 'stripe', 're_q8_taken', 'succeeded', 'cancelled_by_the_firm');
  insert into eng_order_events (order_id, event, customer_visible, summary, detail, created_at) values
    ('${orderId("expireTwo")}', 'checkout.started', false, 'first', '{"session_ref":"cs_q8_old"}', now() - interval '25 hours'),
    ('${orderId("expireTwo")}', 'checkout.started', false, 'second', '{"session_ref":"cs_q8_new"}', now() - interval '1 hour'),
    ('${orderId("expireOne")}', 'checkout.started', false, 'only', '{"session_ref":"cs_q8_only"}', now() - interval '25 hours');
`);

const rest = await startReplayRest(db, PORTS.replayRest);
process.env.SUPABASE_URL = rest.url;
process.env.SUPABASE_SERVICE_ROLE_KEY = "replay-stand-in";
process.env.ORDER_PAYMENTS_FAKE = "";
const payments = await import("../../src/lib/ops-payments.ts");
const { fakeProvider } = await import("../../src/lib/payments.ts");

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0] ?? null;
const many = async (sql, params = []) => (await db.query(sql, params)).rows;
const refundsOn = (k) =>
  many(`select amount_cents, status, provider_ref, refund_case from eng_order_payments where kind = 'refund' and order_id = $1 order by created_at`, [orderId(k)]);
const statusOf = async (k) => (await one(`select status from eng_service_orders where id = $1`, [orderId(k)]))?.status;
const actor = { id: null, role: "admin", email: EMAIL };

try {
  /* ============ F2: the webhook lands inside the refund call ============ */
  {
    let webhook = null;
    payments.setPaymentProvider({
      ...fakeProvider(),
      name: "stripe",
      refund: async (r) => {
        /* Stripe sends charge.refunded as soon as the refund exists, before the call returns. */
        webhook = await payments.recordExternalRefund({
          eventId: "evt_q8_race_refunded",
          chargeRef: "pi_q8_race",
          refundRef: "evt_q8_race_refunded",
          refundedToDateCents: r.amountCents,
          provider: "stripe",
        });
        return { ref: "re_q8_race", amountCents: r.amountCents, status: "succeeded" };
      },
    });
    const done = await payments.cancelAndRefund({ orderId: orderId("race"), reason: "The Q8 proof cancels the race order.", actor });
    const rows = await refundsOn("race");
    check(
      "a webhook landing inside a platform refund records nothing, and the ledger carries the money once",
      done.ok === true && rows.length === 1 && Number(rows[0].amount_cents) === 50000 && rows[0].provider_ref === "re_q8_race" && rows[0].status === "succeeded",
      `${JSON.stringify(done)}; rows ${JSON.stringify(rows)}; webhook ${JSON.stringify(webhook)}`,
    );
    check(
      "and the webhook saw the platform's pending row rather than recording the amount itself",
      webhook?.ok === true && webhook.recordedCents === undefined,
      JSON.stringify(webhook),
    );
  }

  /* ============ F2: a row that cannot take Stripe's answer is cancelled ============ */
  {
    payments.setPaymentProvider({
      ...fakeProvider(),
      name: "stripe",
      refund: async (r) => ({ ref: "re_q8_taken", amountCents: r.amountCents, status: "succeeded" }),
    });
    const done = await payments.cancelAndRefund({ orderId: orderId("collide"), reason: "The Q8 proof cancels the collision order.", actor });
    const rows = await refundsOn("collide");
    check(
      "a reserved row that cannot take Stripe's answer is cancelled, never left pending to count twice",
      done.ok === false && rows.length === 1 && rows[0].status === "cancelled" && rows[0].provider_ref.startsWith("platform-refund:"),
      `${JSON.stringify(done)}; rows ${JSON.stringify(rows)}`,
    );
  }

  /* ============ F5: a late expiry of an older session ============ */
  {
    const older = await payments.expireCheckout({
      eventId: "evt_q8_expired_old",
      orderId: orderId("expireTwo"),
      batchId: null,
      sessionRef: "cs_q8_old",
      reason: "The Q8 proof expires the older session.",
    });
    check(
      "an expired session that is not the order's latest closes nothing",
      older.ok === true && older.closed === 0 && (await statusOf("expireTwo")) === "awaiting_payment",
      `${JSON.stringify(older)}; status ${await statusOf("expireTwo")}`,
    );
    const latest = await payments.expireCheckout({
      eventId: "evt_q8_expired_only",
      orderId: orderId("expireOne"),
      batchId: null,
      sessionRef: "cs_q8_only",
      reason: "The Q8 proof expires the order's only session.",
    });
    check(
      "and the expiry of the order's latest session still closes it",
      latest.ok === true && (await statusOf("expireOne")) === "cancelled",
      `${JSON.stringify(latest)}; status ${await statusOf("expireOne")}`,
    );
  }

  /* ============ F5: money on a cancelled order raises a task ============ */
  {
    const paid = await payments.markPaid({
      eventId: "evt_q8_paid_late",
      orderId: orderId("paidLate"),
      chargeRef: "pi_q8_paid_late",
      amountCents: 50000,
      provider: "stripe",
    });
    const task = await one(`select title, description from eng_tasks where title like $1`, ["254-PROOF-Q8-806%"]);
    check(
      "a payment on a cancelled order raises a staff task naming the order and the charge",
      paid.ok === true && (await statusOf("paidLate")) === "cancelled" && Boolean(task) && /pi_q8_paid_late/.test(task?.description ?? ""),
      `${JSON.stringify(paid)}; task ${JSON.stringify(task)}`,
    );
  }

  /* ============ F7: the batch total is what was placed ============ */
  {
    const code = readFileSync("src/lib/ops-bulk.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => (/^\s*\/\//.test(l) ? "" : l))
      .join("\n");
    check(
      "a batch's stored total is the sum of the members placed, set with its status",
      /const placedTotalCents = accepted\.some\(\(a\) => a\.shareCents === null\)/.test(code) &&
        /accepted\.reduce\(\(n, a\) => n \+ \(a\.shareCents as number\), 0\)/.test(code) &&
        /total_cents: placedTotalCents,/.test(code) &&
        /rejected_count: split\.rejected\.length \+ failures\.length,/.test(code) &&
        (code.match(/\.update\(\{ status: "(accepted|awaiting_payment)", \.\.\.placed \}\)/g) ?? []).length === 2 &&
        /totalCents: placedTotalCents,/.test(code),
    );
  }
} catch (e) {
  wrong += 1;
  console.log(`  FAIL: the proof threw (${e instanceof Error ? e.stack : String(e)})`);
} finally {
  await rest.close?.();
  await db.close();
}

if (wrong > 0) {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exit(1);
}
console.log("PASS: a platform refund, a late expiry and a short batch each count once, and money on a cancelled order reaches a person.");
process.exit(0);
