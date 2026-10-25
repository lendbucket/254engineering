// @runtime react-server
//
// Declared because it imports src/lib/ops-payments.ts, which carries server-only.

/**
 * A BULK MEMBER IS REFUNDED ITS OWN SHARE, AGAINST ITS SUBMISSION'S CHARGE,
 * UNDER THE SAME RULES AS A SINGLE ORDER, AND NEVER MORE THAN IS LEFT ON IT.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-bulk-member-is-refunded-its-own-share.mjs
 *
 * Robert's answer on findings F1 and F2, 2026-10-25: refund a bulk member's own
 * batch_share_cents against the batch's charge, under the same refund rules as
 * a single order (including FC-1); key refunds per order so none repeats; and
 * never refund more than the batch charge less earlier refunds.
 *
 * A paid submission of two properties, one card charge on the batch (0075)
 * that names no order. Driven in process against a fake PostgREST that filters
 * payment rows the way PostgREST does, with a recording payment provider in
 * place of Stripe. Nothing reaches a database or Stripe.
 */
process.env.SUPABASE_URL = "http://bulk-share-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "bulk-share-proof-not-a-key";
delete process.env.VERCEL_ENV;
delete process.env.RESEND_API_KEY;

import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const BATCH = "00000000-0000-4000-8000-0000000000b7";
const M1 = "00000000-0000-4000-8000-0000000000d1";
const M2 = "00000000-0000-4000-8000-0000000000d2";
const SHARE = 78400;
let orders;
let payments;
let writes;
let failRead = null;
const reset = (over = {}) => {
  orders = {
    [M1]: { id: M1, reference: "254-PROOF-SHARE-1", status: "in_fulfilment", currency: "usd", batch_id: BATCH, batch_share_cents: SHARE, inspection_fee_cents: 17500, technician_visited: false },
    [M2]: { id: M2, reference: "254-PROOF-SHARE-2", status: "in_fulfilment", currency: "usd", batch_id: BATCH, batch_share_cents: SHARE, inspection_fee_cents: 17500, technician_visited: false },
  };
  payments = [{ id: "pay-charge", order_id: null, batch_id: BATCH, statement_id: null, kind: "charge", status: "succeeded", provider: "proof", provider_ref: "pi_batch_proof", amount_cents: 2 * SHARE, created_at: "2026-10-20T15:00:00Z" }];
  writes = [];
  failRead = null;
  Object.assign(orders[M1], over.m1 ?? {});
  for (const p of over.payments ?? []) payments.push(p);
};

/* PostgREST's eq, is and in, on the columns these reads filter. */
const matches = (row, url) => {
  for (const [key, raw] of url.searchParams) {
    if (["select", "order", "limit", "offset"].includes(key)) continue;
    const v = row[key];
    if (raw.startsWith("eq.")) { if (String(v) !== raw.slice(3)) return false; }
    else if (raw === "is.null") { if (v !== null && v !== undefined) return false; }
    else if (raw.startsWith("in.(")) { if (!raw.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, "")).includes(String(v))) return false; }
  }
  return true;
};
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = (init.method || "GET").toUpperCase();
  const table = url.pathname.replace("/rest/v1/", "");
  if (failRead === table && method === "GET") return json({ message: `proof: the ${table} read failed`, code: "XX000" }, 500);
  if (method !== "GET" && method !== "HEAD") {
    let body = null;
    try { body = JSON.parse(init.body || "null"); } catch { body = null; }
    writes.push({ method, table, body });
    if (table === "eng_order_payments" && method === "POST") {
      const row = { id: `pay-${payments.length}`, created_at: "2026-10-25T16:00:00Z", ...body };
      payments.push(row);
      return json([row], 201);
    }
    if (table === "eng_service_orders" && method === "PATCH") {
      for (const o of Object.values(orders)) if (matches(o, url)) Object.assign(o, body);
      return json([]);
    }
    return json(Array.isArray(body) ? body : [body ?? {}], 201);
  }
  if (table === "eng_service_orders") return json(Object.values(orders).filter((o) => matches(o, url)));
  if (table === "eng_order_payments") return json(payments.filter((p) => matches(p, url)));
  return json([]);
};

const refunds = [];
const { cancelAndRefund, settleDecision, setPaymentProvider } = await import("../../src/lib/ops-payments.ts");
setPaymentProvider({
  name: "proof",
  configured: () => true,
  async refund(request) {
    refunds.push(request);
    return { ref: `re_proof_${refunds.length}`, amountCents: request.amountCents, status: "succeeded" };
  },
  async createCheckout() { throw new Error("not in this proof"); },
  async retrieveCheckout() { return null; },
  readEvent() { return null; },
});
const actor = { id: null, role: "admin", email: "bulk-share-proof@audit-probe.invalid" };
const refundRows = () => payments.filter((p) => p.kind === "refund");

/* 1. A firm cancellation of one member refunds its own share against the batch charge. */
reset();
const first = await cancelAndRefund({ orderId: M1, reason: "The proof cancels the first member.", actor });
const r1 = refunds.at(-1);
check("canceling a paid bulk member refunds its own share", first.ok === true && first.refundedCents === SHARE, JSON.stringify(first));
check("against the submission's charge", r1?.chargeRef === "pi_batch_proof" && r1?.amountCents === SHARE, JSON.stringify(r1));
check("keyed to that member, so equal shares of one charge are separate refunds", r1?.orderId === M1, String(r1?.orderId));
const row1 = refundRows().at(-1);
check("and its refund row names the order and its submission", row1?.order_id === M1 && row1?.batch_id === BATCH && row1?.amount_cents === SHARE, JSON.stringify(row1));
check("and the order is refunded", orders[M1].status === "refunded", orders[M1].status);

/* 2. The second member, same share, same charge: its own refund under its own key. */
const second = await cancelAndRefund({ orderId: M2, reason: "The proof cancels the second member.", actor });
check("the second member's equal share is its own refund, under its own key", second.ok === true && refunds.length === 2 && refunds[1].orderId === M2, JSON.stringify(refunds.map((r) => r.orderId)));

/* 3. None repeats. */
const again = await cancelAndRefund({ orderId: M1, reason: "The proof cancels the first member again.", actor });
check("canceling the first member again moves no money", again.ok === false && refunds.length === 2, JSON.stringify(again));

/* 4. The same refund rules as a single order: a decline after a visit keeps the disclosed fee. */
reset({ m1: { technician_visited: true } });
const declined = await settleDecision({ orderId: M1, outcome: "refuse" });
const r4 = refunds.at(-1);
check(
  "a refusal after a technician visited refunds the share less the disclosed fee",
  declined.ok === true && declined.refundedCents === SHARE - 17500 && declined.retainedCents === 17500,
  JSON.stringify(declined),
);
check("against the submission's charge, keyed to the member, naming both", r4?.chargeRef === "pi_batch_proof" && r4?.orderId === M1 && refundRows().at(-1)?.batch_id === BATCH, JSON.stringify(r4));

/* 5. Never more than is left on the batch charge. */
reset({ payments: [{ id: "pay-dash", order_id: null, batch_id: BATCH, statement_id: null, kind: "refund", status: "succeeded", provider: "proof", provider_ref: "re_dashboard", amount_cents: 100000 }] });
const before = refunds.length;
const capped = await settleDecision({ orderId: M1, outcome: "refuse" });
check(
  "with $1,000.00 already refunded on the submission in Stripe, a full refund of the share is refused, said, and moves nothing",
  capped.ok === false && /only \$568\.00 is left/.test(capped.error) && refunds.length === before,
  JSON.stringify(capped),
);
const cappedCancel = await cancelAndRefund({ orderId: M1, reason: "The proof cancels after a dashboard refund.", actor });
check(
  "and a firm cancellation is refused the same way, never refunding quietly less than the share",
  cappedCancel.ok === false && /only \$568\.00 is left/.test(cappedCancel.error) && refunds.length === before && orders[M1].status === "in_fulfilment",
  JSON.stringify(cappedCancel),
);

/* 6. Fails shut, and a seal still refunds nothing. */
reset();
failRead = "eng_order_payments";
const unread = await settleDecision({ orderId: M1, outcome: "refuse" });
check("a failed read of the submission's charge is said, and refunds nothing", unread.ok === false && /could not be read/.test(unread.error) && refunds.length === before, JSON.stringify(unread));
failRead = null;
const sealed = await settleDecision({ orderId: M1, outcome: "seal" });
check("a seal on a paid member refunds nothing and retains its share", sealed.ok === true && sealed.refundedCents === 0 && sealed.retainedCents === SHARE, JSON.stringify(sealed));

/* FC-1: a foundation decline at review never reaches a refund; it settles as sealed work. */
const handlers = readFileSync("src/lib/job-handlers.ts", "utf8");
check(
  "a foundation decline at review is still kept from the refund path (FC-1)",
  /const lettersInstead = refusedFile\?\.service_slug === "foundation-inspections";\s*const order = lettersInstead \? null : await liveOrderForFile\(fileId, "id"\);/.test(handlers),
);
const stripe = readFileSync("src/lib/payments-stripe.ts", "utf8");
check("Stripe's refund key carries the member order when there is one", /`refund:\$\{request\.chargeRef\}:order:\$\{request\.orderId\}:\$\{request\.amountCents\}`/.test(stripe));

console.log("");
if (wrong === 0) {
  console.log("PASS: a bulk member is refunded its own share against its submission's charge, under the single order's rules, never twice and never past what is left.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
