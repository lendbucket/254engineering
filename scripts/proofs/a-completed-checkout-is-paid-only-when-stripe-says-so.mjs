/**
 * A COMPLETED CHECKOUT IS RECORDED AS PAID ONLY WHEN STRIPE SAYS IT WAS PAID,
 * AND NEVER AS A CHARGE OF $0.00.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-completed-checkout-is-paid-only-when-stripe-says-so.mjs
 *
 * Robert's audit of 2026-10-24, finding F11. readEvent mapped every
 * checkout.session.completed straight to a charge, reading neither
 * payment_status nor a missing amount_total (which became 0). retrieveCheckout
 * in the same file already says "complete" is not "paid". With cards a session
 * is paid at completion, so this changes nothing today; it decides what the day
 * a delayed method such as a bank debit is switched on looks like.
 *
 * Driven through the real adapter with signed events, as
 * partner-billing-keeps-its-own-lane does. Nothing reaches Stripe.
 */
process.env.STRIPE_SECRET_KEY = "sk_test_paid_status_proof";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_paid_status_proof";

import Stripe from "stripe";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { stripeProvider } = await import("../../src/lib/payments-stripe.ts");
const signer = new Stripe("sk_test_paid_status_proof");
const provider = stripeProvider();
const deliver = (session, id) => {
  const payload = JSON.stringify({
    id,
    object: "event",
    type: "checkout.session.completed",
    livemode: false,
    data: { object: { id: `cs_test_${id}`, object: "checkout.session", payment_intent: `pi_${id}`, metadata: { order_id: "00000000-0000-4000-8000-0000000000e1" }, ...session } },
  });
  const header = signer.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  return provider.readEvent(payload, header);
};

const paid = deliver({ status: "complete", payment_status: "paid", amount_total: 78400 }, "evt_paid");
check("a completed, paid session is a charge of what Stripe took", paid?.kind === "checkout.completed" && paid.amountCents === 78400, JSON.stringify(paid));

const unpaid = deliver({ status: "complete", payment_status: "unpaid", amount_total: 78400 }, "evt_unpaid");
check("a completed session whose payment has not settled records no charge", unpaid === null, JSON.stringify(unpaid));

const noTotal = deliver({ status: "complete", payment_status: "paid", amount_total: null }, "evt_no_total");
check("a paid session with no total records no charge, never a charge of $0.00", noTotal === null, JSON.stringify(noTotal));

console.log("");
if (wrong === 0) {
  console.log("PASS: a completed checkout is recorded as paid only when Stripe says it was paid, and never as $0.00.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
