// @runtime react-server
//
// Declared because it imports src/lib/ops-payments.ts, which carries server-only.

/**
 * A BULK ORDER'S CANCELLATION AND REFUSAL SAY WHERE ITS MONEY IS, AND A SEAL IS
 * TOLD TO THE CUSTOMER WHEREVER THE MONEY WAS RECORDED.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-bulk-order-refusal-says-where-the-money-is.mjs
 *
 * Robert's audit of 2026-10-24. A paid bulk submission's charge is recorded
 * against the batch (0075), so a member order carries no charge of its own.
 *
 * F1. cancelAndRefund read that as nothing charged and called markAbandoned,
 *     which refuses to close an order in fulfilment and answers ok with nothing
 *     changed; it then audited "canceled with nothing charged" and reported
 *     success. The order stayed live and nothing was refunded.
 * F2. settleDecision on a refusal recorded "could not be worked out", and a
 *     failed charge read took the same path, so nobody could tell which.
 * And the seal: the same missing charge made a SEAL record refund.blocked, so
 *     the customer was never told their document was sealed.
 *
 * How a member of a paid submission is refunded is Robert's to rule; this
 * proves only that nothing claims to have done it. Driven in process against a
 * fake PostgREST that records every write. Nothing reaches a database or Stripe.
 */
process.env.SUPABASE_URL = "http://bulk-refund-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "bulk-refund-proof-not-a-key";
delete process.env.VERCEL_ENV;
delete process.env.RESEND_API_KEY;

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const ORDER = "00000000-0000-4000-8000-0000000000c1";
const state = { batch: "00000000-0000-4000-8000-0000000000b9", status: "in_fulfilment", charges: [], failCharges: false };
let writes = [];
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = (init.method || "GET").toUpperCase();
  const table = url.pathname.replace("/rest/v1/", "");
  if (method !== "GET" && method !== "HEAD") {
    let body = null;
    try { body = JSON.parse(init.body || "null"); } catch { body = null; }
    writes.push({ method, table, body });
    if (table === "eng_service_orders" && method === "PATCH") return json([]);
    return json(Array.isArray(body) ? body : [body ?? {}], 201);
  }
  if (table === "eng_service_orders") {
    return json([{
      id: ORDER, reference: "254-PROOF-BULK-1", status: state.status, currency: "usd", batch_id: state.batch,
      inspection_fee_cents: null, technician_visited: false,
      customer_name: "Bulk proof, not a real person", customer_email: "bulk-refund-proof@audit-probe.invalid", property_address: "1 Proof Way",
    }]);
  }
  if (table === "eng_order_payments") {
    if (state.failCharges) return json({ message: "proof: the charges read failed", code: "XX000" }, 500);
    return json(url.searchParams.get("kind") === "eq.charge" ? state.charges : []);
  }
  return json([]);
};

const { cancelAndRefund, settleDecision } = await import("../../src/lib/ops-payments.ts");
const actor = { id: null, role: "admin", email: "bulk-refund-proof@audit-probe.invalid" };
const events = () => writes.filter((w) => w.table === "eng_order_events").map((w) => w.body?.event);

/* F1 */
writes = [];
const cancelled = await cancelAndRefund({ orderId: ORDER, reason: "The proof cancels a bulk member.", actor });
check("canceling a paid bulk member is refused, saying its money is on the submission", cancelled.ok === false && /bulk submission/.test(cancelled.error), JSON.stringify(cancelled));
check("and nothing was written: no cancellation, no audit claiming nothing was charged", writes.length === 0, JSON.stringify(writes.map((w) => `${w.method} ${w.table}`)));

state.batch = null;
writes = [];
const stuck = await cancelAndRefund({ orderId: ORDER, reason: "The proof cancels an order with no charge.", actor });
check(
  "an order in fulfilment with no charge that markAbandoned cannot close is refused, not reported as canceled",
  stuck.ok === false && /could not be canceled/.test(stuck.error) && !writes.some((w) => w.table === "eng_audit_events"),
  JSON.stringify(stuck),
);
state.batch = "00000000-0000-4000-8000-0000000000b9";

/* F2 */
writes = [];
const refused = await settleDecision({ orderId: ORDER, outcome: "refuse" });
check("a refusal on a bulk member records a blocked refund naming the submission", refused.ok === false && /bulk submission/.test(refused.error) && events().includes("refund.blocked"), JSON.stringify(refused));
check("and does not say nothing had been charged", !events().includes("refund.not_needed"), events().join(", "));

state.failCharges = true;
writes = [];
const unread = await settleDecision({ orderId: ORDER, outcome: "refuse" });
check("a failed charge read is said as a failed read, never worked out as nothing paid", unread.ok === false && /could not be read/.test(unread.error), JSON.stringify(unread));
state.failCharges = false;

/* The seal */
writes = [];
const sealed = await settleDecision({ orderId: ORDER, outcome: "seal" });
check("a seal on a bulk member settles, refunding nothing", sealed.ok === true && sealed.refundedCents === 0, JSON.stringify(sealed));
check(
  "and the customer is told the document was sealed",
  events().includes("refund.none") && !events().includes("refund.blocked") && (events().includes("email.queued") || events().includes("email.not_sent")),
  events().join(", "),
);

state.batch = null;
state.charges = [{ provider: "stripe", provider_ref: "pi_proof", amount_cents: 70900 }];
writes = [];
const paidSeal = await settleDecision({ orderId: ORDER, outcome: "seal" });
check("a seal on an order paid on its own still retains what was paid", paidSeal.ok === true && paidSeal.retainedCents === 70900 && paidSeal.refundedCents === 0, JSON.stringify(paidSeal));

console.log("");
if (wrong === 0) {
  console.log("PASS: a bulk order's cancellation and refusal say where its money is, and a seal is told wherever the money was recorded.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
