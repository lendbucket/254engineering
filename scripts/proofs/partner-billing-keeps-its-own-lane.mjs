/**
 * PROOF: PARTNER BILLING KEEPS ITS OWN LANE, AND STAYS OFF.
 *
 * Operator ruling of 2026-10-11, on docs/partner-billing-plan.md: a partner
 * pays $800 upfront and $99 a month. Billing stays off until the attorney
 * confirms the structure. On 2026-10-15 the operator ruled the open questions
 * (pinned below as literals) and moved partner billing to Craftline Brands
 * LLC doing business as 254 Partners, on its own Stripe account, which is not
 * wired; the lane below is proved as it stands until that wiring is built.
 *
 * NO STRIPE CALL. Every event below is a test-mode shape built here and signed
 * here with a throwaway secret; the adapter verifies the signature locally,
 * exactly as it does a real one. The database half runs in an in-process
 * replay of supabase/migrations, which is thrown away.
 *
 * What it proves:
 *   1. The ruled amounts, pinned as literals (CLAUDE.md 6c), and the flag off
 *      unless counsel's sign-off is recorded beside it.
 *   2. The lane: partner objects go to the partner lane, order objects to the
 *      orders lane, a mix is refused, through the REAL adapter's readEvent.
 *   3. The transitions, including that a second failure keeps the first date.
 *   4. Nothing is suspended while the grace period is unruled, and billing
 *      gates nothing while off.
 *   5. The checkout: subscription mode, the two ruled lines, the partner kind on
 *      the session AND on subscription_data, no order id anywhere.
 *   6. startPartnerCheckout refuses while off.
 *   7. 0074's constraints, in the replay.
 *   8. The partner lane imports nothing from the order path.
 */
process.env.STRIPE_SECRET_KEY = "sk_test_partner_billing_proof";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_partner_billing_proof";

import { readdirSync } from "node:fs";
import { join } from "node:path";
import Stripe from "stripe";
import { PGlite } from "@electric-sql/pglite";
import { readSource } from "../lib/read-source.mjs";
import { SUPABASE_REPLAY_STUBS } from "../lib/replay-stubs.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { PARTNER_BILLING } = await import("../../src/config/partner-billing.ts");
const rules = await import("../../src/lib/partner-billing-rules.ts");
const { stripeProvider } = await import("../../src/lib/payments-stripe.ts");
const { startPartnerCheckout } = await import("../../src/lib/partner-billing.ts");

/* 1. The ruling, as literals. */
check("the upfront fee is $800.00 (80000 cents), as ruled", PARTNER_BILLING.upfrontCents === 80000, String(PARTNER_BILLING.upfrontCents));
check("the monthly fee is $99.00 (9900 cents), as ruled", PARTNER_BILLING.monthlyCents === 9900, String(PARTNER_BILLING.monthlyCents));
check(
  "billing is on only beside counsel's recorded sign-off",
  PARTNER_BILLING.enabled === false || (PARTNER_BILLING.counselSignOff !== null && Boolean(PARTNER_BILLING.counselSignOff.by && PARTNER_BILLING.counselSignOff.on)),
  `enabled ${PARTNER_BILLING.enabled}, sign-off ${JSON.stringify(PARTNER_BILLING.counselSignOff)}`,
);
/*
 * The operator's rulings of 2026-10-15, as literals. Until that day this
 * asserted "the unruled terms are unruled: grace, refund and cancellation
 * null, no tax"; each null is now a ruled value, so each is pinned here and
 * a change costs this edit as well as the configuration's.
 */
check("the late fee is $24.75 (2475 cents), 25 percent of the monthly fee, charged once per missed payment",
  PARTNER_BILLING.lateFeeCents === 2475 && PARTNER_BILLING.lateFeeCents * 4 === PARTNER_BILLING.monthlyCents && PARTNER_BILLING.lateFeeCharged === "once-per-missed-payment",
  String(PARTNER_BILLING.lateFeeCents));
check("the account is suspended at 10 days unpaid", PARTNER_BILLING.gracePeriodDays === 10, String(PARTNER_BILLING.gracePeriodDays));
check("reinstatement takes the past due balance, the late fee and a $75.00 (7500 cents) fee",
  PARTNER_BILLING.reinstatement.feeCents === 7500 &&
    JSON.stringify(PARTNER_BILLING.reinstatement.requires) === JSON.stringify(["past-due-balance", "late-fee", "reinstatement-fee"]),
  JSON.stringify(PARTNER_BILLING.reinstatement));
check("the $800 is not refundable: all sales final", PARTNER_BILLING.upfrontRefundable === false);
check("no cancellation from the portal: written notice, ended by an administrator at the end of the paid period",
  PARTNER_BILLING.portalCancellation === false && PARTNER_BILLING.cancellation === "end-of-period" && /administrator/.test(PARTNER_BILLING.cancelledBy));
check("a partner who cancels or is ended earns on nothing further", PARTNER_BILLING.earnsAfterEnded === false);
check("no tax is collected, as the operator's ruling pending the accountant", PARTNER_BILLING.taxCollected === false && /accountant/.test(PARTNER_BILLING.taxRuling));
check("the receipt name is 254 Partners", PARTNER_BILLING.productName === "254 Partners");
check("the selling entity is one value, pending counsel",
  PARTNER_BILLING.sellingEntity === "Craftline Brands LLC doing business as 254 Partners" && PARTNER_BILLING.sellingEntityStatus === "pending counsel",
  PARTNER_BILLING.sellingEntity);
check("and the seller's own Stripe account is recorded as not existing yet, never 254 Engineering's",
  PARTNER_BILLING.seller.stripeAccount === "partner-account-does-not-exist-yet");

/* 2. The lane, through the real adapter. */
const signer = new Stripe("sk_test_partner_billing_proof");
const provider = stripeProvider();
const deliver = (event) => {
  const payload = JSON.stringify(event);
  const header = signer.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  return provider.readEvent(payload, header);
};
const P = "00000000-0000-4000-8000-0000000000b1";
const partnerMeta = { kind: "partner_billing", partner_id: P };
const evt = (id, type, object) => ({ id, object: "event", type, livemode: false, created: 1760000000, data: { object } });

const completed = deliver(evt("evt_pb_1", "checkout.session.completed", {
  id: "cs_test_pb", object: "checkout.session", mode: "subscription", payment_intent: null,
  customer: "cus_test_pb", subscription: "sub_test_pb", metadata: partnerMeta,
}));
check("a partner's subscription checkout reaches the partner lane, not the order path", completed?.kind === "partner_billing" && completed.event.type === "checkout.completed" && completed.event.partnerId === P, JSON.stringify(completed));

const paidNew = deliver(evt("evt_pb_2", "invoice.paid", {
  id: "in_test_pb", object: "invoice", customer: "cus_test_pb", metadata: {},
  parent: { type: "subscription_details", subscription_details: { subscription: "sub_test_pb", metadata: partnerMeta } },
  lines: { data: [{ period: { start: 1760000000, end: 1762592000 } }] },
}));
check("an invoice carrying the partner metadata under parent reaches the partner lane, with its period", paidNew?.kind === "partner_billing" && paidNew.event.subscriptionRef === "sub_test_pb" && paidNew.event.periodEnd === new Date(1762592000 * 1000).toISOString(), JSON.stringify(paidNew));

const failedOld = deliver(evt("evt_pb_3", "invoice.payment_failed", {
  id: "in_test_pb2", object: "invoice", customer: "cus_test_pb", subscription: "sub_test_pb",
  subscription_details: { metadata: partnerMeta }, lines: { data: [] },
}));
check("and so does one carrying it under subscription_details, the older shape", failedOld?.kind === "partner_billing" && failedOld.event.type === "invoice.payment_failed");

const order = deliver(evt("evt_pb_4", "checkout.session.completed", {
  id: "cs_test_order", object: "checkout.session", mode: "payment", payment_intent: "pi_test_order",
  amount_total: 54900, metadata: { order_id: "00000000-0000-4000-8000-0000000000c1", reference: "254-TEST" },
}));
check("an order's checkout still takes the order path", order?.kind === "checkout.completed" && order.orderId === "00000000-0000-4000-8000-0000000000c1", JSON.stringify(order));

const mixed = deliver(evt("evt_pb_5", "checkout.session.completed", {
  id: "cs_test_mix", object: "checkout.session", payment_intent: "pi_x",
  metadata: { ...partnerMeta, order_id: "00000000-0000-4000-8000-0000000000c2" },
}));
check("the partner kind beside an order id is refused, in neither lane", mixed?.kind === "partner_billing.refused", JSON.stringify(mixed));

const anonymous = deliver(evt("evt_pb_6", "customer.subscription.updated", { id: "sub_x", object: "subscription", metadata: { kind: "partner_billing" } }));
check("the partner kind with no partner id is refused", anonymous?.kind === "partner_billing.refused");

/* 3. The transitions. */
const now = "2026-10-12T05:00:00.000Z";
const later = "2026-10-15T05:00:00.000Z";
const e = (type, extra = {}) => ({ eventId: `x-${type}`, type, partnerId: P, customerRef: "cus", subscriptionRef: "sub", periodEnd: null, ...extra });
let row = rules.nextBillingRow(null, e("checkout.completed"), now);
check("a completed checkout makes the partner active", row?.status === "active" && row.past_due_since === null);
row = rules.nextBillingRow(row, e("invoice.payment_failed"), now);
check("a failed invoice makes them past due from that moment", row?.status === "past_due" && row.past_due_since === now);
const again = rules.nextBillingRow(row, e("invoice.payment_failed"), later);
check("a second failure keeps the first date, so grace counts from the first", again?.past_due_since === now, again?.past_due_since);
row = rules.nextBillingRow(again, e("invoice.paid"), later);
check("a paid invoice clears it", row?.status === "active" && row.past_due_since === null);
row = rules.nextBillingRow(row, e("subscription.deleted"), later);
check("the subscription ending cancels", row?.status === "cancelled");
check("a late invoice for the ended subscription changes nothing", rules.nextBillingRow(row, e("invoice.paid"), later) === null);
check("a new checkout reopens it", rules.nextBillingRow(row, e("checkout.completed"), later)?.status === "active");

/*
 * 4. The ruled ten days, at the edge, and nothing suspended on an unruled
 * number. The edge is built from `now` rather than a fixed date, so nine days
 * and ten days can be told apart: a partner a year overdue is out of grace
 * under any period anybody might choose.
 */
const daysBefore = (n) => new Date(Date.parse(now) - n * 86_400_000).toISOString();
const pastDueFor = (n) => ({ status: "past_due", past_due_since: daysBefore(n), current_period_end: null, stripe_customer_ref: null, stripe_subscription_ref: null });
check("nine days unpaid is not yet suspended under the ruled ten", rules.graceExpired(pastDueFor(9), now) === false);
check("ten days unpaid is", rules.graceExpired(pastDueFor(10), now) === true);
check("and with the period unruled, no partner is ever out of grace", rules.graceExpired(pastDueFor(400), now, null) === null);
check("while billing is off, every partner may order, a cancelled one included", ["active", "past_due", "suspended", "cancelled", null].every((s) => rules.billingAllowsOrdering(s, false)));
check(
  "once on, only active and past due may order, and no row at all may not",
  rules.billingAllowsOrdering("active", true) && rules.billingAllowsOrdering("past_due", true) &&
    !rules.billingAllowsOrdering("suspended", true) && !rules.billingAllowsOrdering("cancelled", true) && !rules.billingAllowsOrdering(null, true),
);

/* 5. The checkout. */
const { params, idempotencyKey } = rules.partnerCheckoutParams({ partnerId: P, email: "partner@audit-probe.invalid", successUrl: "https://x/ok", cancelUrl: "https://x/no" });
const recurring = params.line_items.filter((l) => l.price_data.recurring);
const once = params.line_items.filter((l) => !l.price_data.recurring);
check("the checkout is a subscription", params.mode === "subscription");
check("one monthly line at $99.00 and one one-time line at $800.00", recurring.length === 1 && recurring[0].price_data.unit_amount === 9900 && recurring[0].price_data.recurring.interval === "month" && once.length === 1 && once[0].price_data.unit_amount === 80000);
check("the partner kind and id ride on the session and on every later subscription event", params.metadata.kind === "partner_billing" && params.metadata.partner_id === P && params.subscription_data.metadata.kind === "partner_billing" && params.subscription_data.metadata.partner_id === P);
check("no order, batch or statement id anywhere in it", !/order_id|batch_id|statement_id/.test(JSON.stringify(params)));
check("a double click cannot open two subscriptions", idempotencyKey === `partner-billing:${P}`);

/* 6. Refused while off. */
const refused = await startPartnerCheckout({ partnerId: P, email: "partner@audit-probe.invalid", successUrl: "https://x/ok", cancelUrl: "https://x/no" });
check("starting a checkout is refused while billing is off, before Stripe is asked", PARTNER_BILLING.enabled || (refused.ok === false && /not open/.test(refused.error)), JSON.stringify(refused));

/* 7. The tables, in the replay. */
const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
for (const f of readdirSync("supabase/migrations").filter((x) => x.endsWith(".sql")).sort()) await db.exec(readSource(join("supabase/migrations", f)));
const { rows: [partner] } = await db.query(
  "insert into eng_partners (organisation, contact_name, contact_email, code) values ('Billing proof', 'Nobody', 'billing@audit-probe.invalid', 'billing-proof') returning id",
);
const refusedBy = async (sql, params = []) => {
  try { await db.query(sql, params); return null; } catch (err) { return err.message; }
};
check("a past due row without a start is refused", (await refusedBy("insert into eng_partner_billing (partner_id, status) values ($1, 'past_due')", [partner.id])) !== null);
check("an unknown state is refused", (await refusedBy("insert into eng_partner_billing (partner_id, status) values ($1, 'grace')", [partner.id])) !== null);
check("an active row is accepted", (await refusedBy("insert into eng_partner_billing (partner_id, status) values ($1, 'active')", [partner.id])) === null);
await db.query("insert into eng_partner_billing_events (stripe_event_id, partner_id, event_type, status_after) values ('evt_replay', $1, 'invoice.paid', 'active')", [partner.id]);
check("the same Stripe event cannot be recorded twice", (await refusedBy("insert into eng_partner_billing_events (stripe_event_id, partner_id, event_type) values ('evt_replay', $1, 'invoice.paid')", [partner.id])) !== null);
check("a recorded event cannot be edited", (await refusedBy("update eng_partner_billing_events set status_after = 'cancelled' where stripe_event_id = 'evt_replay'")) !== null);
check("or deleted", (await refusedBy("delete from eng_partner_billing_events where stripe_event_id = 'evt_replay'")) !== null);

/* 8. The lanes cannot cross in code either. */
const ORDER_PATH = /from\s+["'][^"']*(ops-payments|ops-orders|ops-files|ops-statements|ops-evidence|ops-refunds|letter-seal)["']/;
for (const f of ["src/lib/partner-billing.ts", "src/lib/partner-billing-rules.ts"]) {
  check(`${f} imports nothing from the order path`, !ORDER_PATH.test(readSource(f)));
}

console.log("");
if (wrong) {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exit(1);
}
console.log("PASS: partner billing keeps its own lane, and stays off.");
