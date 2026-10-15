// @runtime react-server
//
// Declared because it imports src/lib/ops-payments.ts and src/lib/ops-customer.ts,
// which carry server-only, by a dynamic import the runtime sniffer does not follow.

/**
 * A PENDING REFUND IS COUNTED AS GIVEN BACK, AND SAID AS BEING REFUNDED.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-pending-refund-is-said-and-counted.mjs
 *
 * Operator rulings, 2026-10-14, on fix/refund-pending-wording:
 *
 *   1. cancelAndRefund counts pending refunds toward what has been refunded,
 *      the same fix 0075 made on the webhook path. A second cancellation while
 *      the first refund is pending issues nothing.
 *   2. While a refund is pending, the customer rule sentences say it "is being
 *      refunded", not "refunded in full" or "is refunded".
 *   3. The status page says "Refund issued." until the refund succeeds.
 *
 * HOW IT RUNS, as a-refund-update-is-applied-once does for its in-process half:
 * every migration is replayed into PGlite and served as PostgREST by
 * scripts/lib/replay-rest.mjs, because every money table refuses deletes on
 * development. The decisions run in this process against that replay, with a
 * stand-in provider that answers the way Stripe does and counts what it is
 * asked to refund. Nothing reaches Stripe, and no server is started: nothing
 * here is delivered to a route.
 */
process.env.STRIPE_SECRET_KEY = "sk_test_pending_refund_proof";

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
const CLIENT = id(1);
const EMAIL = "pending-refund-proof@audit-probe.invalid";

/*
 * raceCancel and partialCancel sit at `paid` with a pending refund already on
 * file: the state a second cancellation meets when the first one's refund is
 * still pending, whether it arrives in the gap before the status moves or
 * after a status write that did not land. The order's status is therefore not
 * what refuses it, and only the count can.
 */
const ORDERS = {
  raceCancel: 301, partialCancel: 302, cancelPending: 303,
  settleNoVisit: 304, settleVisited: 305, settleNow: 306, cancelNow: 307,
};
const orderId = (k) => id(ORDERS[k]);
const fileId = (k) => id(ORDERS[k] + 100);

await db.exec(`
  insert into eng_clients (id, kind, name) values ('${CLIENT}', 'individual', 'Pending refund proof client, not a real person');
`);
for (const [k, n] of Object.entries(ORDERS)) {
  const status = k === "raceCancel" || k === "partialCancel" ? "paid" : "in_fulfilment";
  const visited = k === "settleVisited";
  await db.exec(`
    insert into eng_files (id, file_number, client_id, service_slug, property_address, county, status)
    values ('${fileId(k)}', '254-PROOF-PR-${n}', '${CLIENT}', 'roof-inspections', '${n} Pending Way', 'Nueces', 'intake');
    insert into eng_service_orders
      (id, site, reference, service_slug, order_type, customer_name, customer_email, property_address, county,
       status, total_cents, file_id, client_id, paid_at, technician_visited, inspection_fee_cents)
    values
      ('${orderId(k)}', '254engineering', '254-PROOF-P-${n}', 'roof-inspections', 'field',
       'Pending refund proof customer, not a real person', '${EMAIL}', '${n} Pending Way', 'Nueces',
       '${status}', 50000, '${fileId(k)}', '${CLIENT}', now(), ${visited}, ${visited ? 17500 : "null"});
    insert into eng_order_payments (order_id, kind, amount_cents, provider, provider_ref, status)
    values ('${orderId(k)}', 'charge', 50000, 'stripe', 'pi_pending_refund_proof_${k}', 'succeeded');
  `);
}
await db.exec(`
  insert into eng_order_payments (order_id, kind, amount_cents, provider, provider_ref, status, refund_case)
  values ('${orderId("raceCancel")}', 'refund', 50000, 'stripe', 're_pending_proof_race_first', 'pending', 'cancelled_by_the_firm'),
         ('${orderId("partialCancel")}', 'refund', 20000, 'stripe', 're_pending_proof_partial_first', 'pending', 'cancelled_by_the_firm');
`);

/* ------------------------------------------------------------- the stand-in */

const rest = await startReplayRest(db, PORTS.replayRest);
process.env.SUPABASE_URL = rest.url;
process.env.SUPABASE_SERVICE_ROLE_KEY = "replay-stand-in";
process.env.ORDER_PAYMENTS_FAKE = "";
const payments = await import("../../src/lib/ops-payments.ts");
const { fakeProvider } = await import("../../src/lib/payments.ts");
const { issueCustomerLink } = await import("../../src/lib/ops-intake.ts");
const { customerView } = await import("../../src/lib/ops-customer.ts");
const { CUSTOMER_STATUS, CUSTOMER_STATUS_REFUND_ISSUED } = await import("../../src/lib/ops-orders.ts");

/** A provider named stripe, as the live one is, answering with the given status and recording every refund asked of it. */
const asked = [];
function stripeAnswering(status, ref) {
  return {
    ...fakeProvider(),
    name: "stripe",
    refund: async (r) => {
      asked.push({ ref, amountCents: r.amountCents });
      return { ref, amountCents: r.amountCents, status };
    },
  };
}

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0] ?? null;
const many = async (sql, params = []) => (await db.query(sql, params)).rows;
const refundsOn = (k) => many(`select amount_cents, status from eng_order_payments where kind = 'refund' and order_id = $1 order by created_at`, [orderId(k)]);
const eventOf = async (k, event) => (await one(`select summary, customer_visible from eng_order_events where order_id = $1 and event = $2`, [orderId(k), event])) ?? null;
const mailTo = async (k) =>
  (await one(`select payload->>'text' as text from eng_jobs where kind = 'email.send' and payload->>'id' = 'order.declined' and payload->>'orderId' = $1`, [orderId(k)]))?.text ?? "";
const actor = { id: null, role: "admin", email: EMAIL };
const view = async (k) => {
  const link = await issueCustomerLink({ orderId: orderId(k) });
  return link ? customerView(link.token) : null;
};

/**
 * The settled sentences a pending refund must never be told in. "refunded it in
 * full" is the firm cancellation's own wording; a pattern for "refunded in
 * full" alone passed over it, which injecting the timeline found.
 */
const SETTLED = [/refunded (it )?in full/i, /the full amount is refunded/i, /the rest is refunded/i];
const saysSettled = (text) => SETTLED.filter((p) => p.test(text)).map(String);

try {
  /* ====================== ruling 1: a pending refund counts ====================== */
  {
    payments.setPaymentProvider(stripeAnswering("pending", "re_pending_proof_race_second"));
    const before = asked.length;
    const second = await payments.cancelAndRefund({
      orderId: orderId("raceCancel"),
      reason: "The proof cancels a second time while the first refund is pending.",
      actor,
    });
    check(
      "a second cancellation while the first refund is pending issues nothing",
      asked.length === before && second.ok === true && second.refundedCents === 0 && second.alreadyRefunded === true,
      `${asked.length - before} refund(s) asked of Stripe; ${JSON.stringify(second)}`,
    );
    const rows = await refundsOn("raceCancel");
    check("and writes no second refund row", rows.length === 1 && rows[0].status === "pending", JSON.stringify(rows));
  }
  {
    payments.setPaymentProvider(stripeAnswering("pending", "re_pending_proof_partial_second"));
    const before = asked.length;
    const rest2 = await payments.cancelAndRefund({
      orderId: orderId("partialCancel"),
      reason: "The proof cancels an order whose first refund is pending and partial.",
      actor,
    });
    const asks = asked.slice(before);
    check(
      "with a partial refund pending, a cancellation refunds only what is left",
      rest2.ok === true && asks.length === 1 && asks[0].amountCents === 30000,
      `${JSON.stringify(asks)} ${JSON.stringify(rest2)}`,
    );
  }

  /* ============ rulings 2 and 3: what the customer is told while pending ============ */
  {
    payments.setPaymentProvider(stripeAnswering("pending", "re_pending_proof_cancel"));
    const res = await payments.cancelAndRefund({
      orderId: orderId("cancelPending"),
      reason: "The proof cancels this order to issue a pending refund.",
      actor,
    });
    const ev = await eventOf("cancelPending", "order.cancelled_by_firm");
    const said = String(ev?.summary ?? "");
    check(
      "a firm cancellation pending at Stripe says the full amount is being refunded",
      res.ok === true && ev?.customer_visible === true && said.includes("the full amount is being refunded"),
      said || JSON.stringify(res),
    );
    check("and never that it was refunded in full", said.length > 0 && saysSettled(said).length === 0, saysSettled(said).join(", "));
    const v = await view("cancelPending");
    check("and its status page says Refund issued.", v?.statusLine === CUSTOMER_STATUS_REFUND_ISSUED && v.statusLine.startsWith("Refund issued."), v?.statusLine);
  }
  {
    payments.setPaymentProvider(stripeAnswering("pending", "re_pending_proof_no_visit"));
    const res = await payments.settleDecision({ orderId: orderId("settleNoVisit"), outcome: "refuse" });
    const said = String((await eventOf("settleNoVisit", "refund.issued"))?.summary ?? "");
    const mail = await mailTo("settleNoVisit");
    check(
      "a decline with no visit, pending at Stripe, says the full amount is being refunded on the timeline",
      res.ok === true && said.includes("the full amount is being refunded"),
      said || JSON.stringify(res),
    );
    check("and in the decline email", mail.includes("the full amount is being refunded"), mail ? "" : "no decline email queued");
    check(
      "and neither says it is refunded",
      said.length > 0 && mail.length > 0 && saysSettled(said).length === 0 && saysSettled(mail).length === 0,
      [...saysSettled(said), ...saysSettled(mail)].join(", "),
    );
    const pendingView = await view("settleNoVisit");
    check("its status page says Refund issued.", pendingView?.statusLine === CUSTOMER_STATUS_REFUND_ISSUED, pendingView?.statusLine);

    await db.query(`update eng_order_payments set status = 'succeeded' where kind = 'refund' and order_id = $1`, [orderId("settleNoVisit")]);
    const settledView = await view("settleNoVisit");
    check(
      "and once the refund succeeds it says Refunded.",
      settledView?.statusLine === CUSTOMER_STATUS.refunded && settledView.statusLine.startsWith("Refunded."),
      settledView?.statusLine,
    );
  }
  {
    payments.setPaymentProvider(stripeAnswering("pending", "re_pending_proof_visited"));
    const res = await payments.settleDecision({ orderId: orderId("settleVisited"), outcome: "refuse" });
    const said = String((await eventOf("settleVisited", "refund.issued"))?.summary ?? "");
    const mail = await mailTo("settleVisited");
    check(
      "a decline after a visit, pending at Stripe, says the rest is being refunded",
      res.ok === true && said.includes("The rest is being refunded") && mail.includes("The rest is being refunded"),
      said || JSON.stringify(res),
    );
    check("and never that the rest is refunded", saysSettled(said).length === 0 && saysSettled(mail).length === 0, [...saysSettled(said), ...saysSettled(mail)].join(", "));
  }

  /* ============== the settled path keeps the settled words ============== */
  {
    payments.setPaymentProvider(stripeAnswering("succeeded", "re_pending_proof_now"));
    await payments.settleDecision({ orderId: orderId("settleNow"), outcome: "refuse" });
    const said = String((await eventOf("settleNow", "refund.issued"))?.summary ?? "");
    const mail = await mailTo("settleNow");
    check(
      "a refund that succeeds at once keeps \"the full amount is refunded\", on the timeline and in the email",
      said.includes("the full amount is refunded") && mail.includes("the full amount is refunded") && !said.includes("being refunded"),
      said,
    );
    const v = await view("settleNow");
    check("and its status page says Refunded.", v?.statusLine === CUSTOMER_STATUS.refunded, v?.statusLine);

    payments.setPaymentProvider(stripeAnswering("succeeded", "re_pending_proof_cancel_now"));
    await payments.cancelAndRefund({ orderId: orderId("cancelNow"), reason: "The proof cancels with a refund that succeeds at once.", actor });
    const cancelSaid = String((await eventOf("cancelNow", "order.cancelled_by_firm"))?.summary ?? "");
    check("and a firm cancellation that succeeds at once keeps \"refunded it in full\"", cancelSaid.includes("refunded it in full"), cancelSaid);
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
console.log("PASS: a pending refund counts as given back, is said as being refunded, and the status page says Refund issued. until it succeeds.");
