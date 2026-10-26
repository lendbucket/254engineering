// @runtime react-server
//
// Declared because it imports src/lib/payments-stripe.ts, which carries server-only.

/**
 * A CHECKOUT TAKES CARDS ONLY, SO A COMPLETED SESSION IS MONEY THAT MOVED.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-checkout-takes-cards-only.mjs
 *
 * Robert's answer on finding F11, 2026-10-25: restrict checkout sessions to
 * card payments in code, on top of the payment_status check, with nothing to
 * set up in Stripe's console. A card is paid when its session completes. A
 * delayed method (a bank debit) completes unpaid and settles or fails days
 * later, and this platform handles neither event, so the account's settings
 * must not be able to offer one.
 *
 * The real adapter is called. Its Stripe client's HTTPS request is answered
 * here, so the body Stripe would have received is read as sent and nothing
 * leaves this machine. The partner program's checkout is built by a pure
 * function and read directly.
 */
process.env.STRIPE_SECRET_KEY = "sk_test_card_only_proof_not_a_key";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_card_only_proof";
delete process.env.VERCEL_ENV;

import https from "node:https";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const sent = [];
https.request = (options) => {
  const req = new EventEmitter();
  let body = "";
  req.setTimeout = () => req;
  req.destroy = () => {};
  req.write = (chunk) => { body += chunk; return true; };
  req.end = () => {
    sent.push({ host: options.host, path: options.path, method: options.method, body });
    const res = new PassThrough();
    res.statusCode = 200;
    res.headers = { "content-type": "application/json", "request-id": "req_card_only_proof" };
    res.complete = true;
    req.emit("response", res);
    res.end(JSON.stringify({ id: "cs_card_only_proof", object: "checkout.session", url: "https://checkout.stripe.invalid/cs_card_only_proof" }));
  };
  process.nextTick(() => req.emit("socket", { connecting: false }));
  return req;
};

const { stripeProvider } = await import("../../src/lib/payments-stripe.ts");
const { partnerCheckoutParams } = await import("../../src/lib/partner-billing-rules.ts");

const session = await stripeProvider().createCheckout({
  reference: "254-PROOF-0001",
  subjectKind: "order",
  orderId: "00000000-0000-4000-8000-00000000c4d0",
  amountCents: 78400,
  currency: "usd",
  customerEmail: "card-only@audit-probe.invalid",
  description: "Roof certification letter",
  lines: [{ label: "Roof certification letter", amountCents: 70900 }, { label: "First tier coastal county", amountCents: 7500 }],
  successUrl: "https://254engineering.com/order/done",
  cancelUrl: "https://254engineering.com/order",
});
const call = sent.find((s) => s.path === "/v1/checkout/sessions" && s.method === "POST");
const form = new URLSearchParams(call?.body ?? "");
const methods = [...form.entries()].filter(([k]) => k.startsWith("payment_method_types")).map(([, v]) => v);
check("the order checkout reached Stripe's session endpoint, answered here", Boolean(call) && call.host === "api.stripe.com", call ? `${call.method} ${call.host}${call.path}` : `${sent.length} request(s), none to the session endpoint`);
check("and asked for card payments, and nothing else", JSON.stringify(methods) === JSON.stringify(["card"]), JSON.stringify(methods));
check("and does not leave the choice to the account's automatic methods", ![...form.keys()].some((k) => k.startsWith("automatic_payment_methods")));
check("and the adapter returned the session it was given", session?.url === "https://checkout.stripe.invalid/cs_card_only_proof", JSON.stringify(session));

const partner = partnerCheckoutParams({
  partnerId: "00000000-0000-4000-8000-00000000c4d1",
  email: "card-only-partner@audit-probe.invalid",
  successUrl: "https://254engineering.com/partner",
  cancelUrl: "https://254engineering.com/partner",
});
check("the partner program's checkout asks for card payments, and nothing else", JSON.stringify(partner.params.payment_method_types) === JSON.stringify(["card"]), JSON.stringify(partner.params.payment_method_types));

console.log("");
if (wrong === 0) {
  console.log("PASS: every checkout session this platform opens takes cards only.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
