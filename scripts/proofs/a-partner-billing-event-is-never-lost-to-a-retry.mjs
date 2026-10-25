// @runtime react-server
//
// Declared because it imports src/lib/partner-billing.ts, which carries server-only.

/**
 * A PARTNER BILLING EVENT WHOSE STATE WRITE FAILS IS APPLIED BY THE RETRY, AND
 * A REDELIVERED OLD EVENT STILL CHANGES NOTHING.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-partner-billing-event-is-never-lost-to-a-retry.mjs
 *
 * Robert's audit of 2026-10-24, finding F7. applyPartnerBillingEvent wrote the
 * event row first and the billing state second. When the state write failed it
 * answered an error, Stripe redelivered, the redelivery stopped at the event's
 * duplicate key, and the state never moved: a partner who paid stayed past due,
 * or one who stopped paying stayed active, and that state decides whether a
 * partner may order. Driven against a fake PostgREST that fails the state write
 * once and records every write.
 */
process.env.SUPABASE_URL = "http://partner-billing-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "partner-billing-proof-not-a-key";
delete process.env.VERCEL_ENV;

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const PARTNER = "00000000-0000-4000-8000-0000000000d1";
const db = {
  billing: { partner_id: PARTNER, status: "past_due", past_due_since: "2026-10-01T00:00:00Z", current_period_end: null, stripe_customer_ref: "cus_proof", stripe_subscription_ref: "sub_proof" },
  events: new Set(),
  failUpsertTimes: 0,
};
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = (init.method || "GET").toUpperCase();
  const table = url.pathname.replace("/rest/v1/", "");
  const body = init.body ? JSON.parse(init.body) : null;
  if (table === "eng_partner_billing") {
    if (method === "GET") return json([db.billing]);
    if (db.failUpsertTimes > 0) {
      db.failUpsertTimes -= 1;
      return json({ message: "proof: the billing state write failed", code: "XX000" }, 500);
    }
    db.billing = { ...db.billing, ...(Array.isArray(body) ? body[0] : body) };
    return json([db.billing], 201);
  }
  if (table === "eng_partner_billing_events") {
    if (method === "GET") {
      const id = (url.searchParams.get("stripe_event_id") || "").replace("eq.", "");
      return json(db.events.has(id) ? [{ stripe_event_id: id }] : []);
    }
    const row = Array.isArray(body) ? body[0] : body;
    if (db.events.has(row.stripe_event_id)) return json({ message: "duplicate key", code: "23505" }, 409);
    db.events.add(row.stripe_event_id);
    return json([row], 201);
  }
  return json([]);
};

const { applyPartnerBillingEvent } = await import("../../src/lib/partner-billing.ts");
const paid = { eventId: "evt_proof_paid", type: "invoice.paid", partnerId: PARTNER, customerRef: "cus_proof", subscriptionRef: "sub_proof", periodEnd: "2026-11-24T00:00:00Z" };
const failed = { ...paid, eventId: "evt_proof_failed_earlier", type: "invoice.payment_failed", periodEnd: null };

db.failUpsertTimes = 1;
const first = await applyPartnerBillingEvent(paid, "2026-10-24T20:00:00Z");
check("a delivery whose state write fails answers an error, so Stripe redelivers", first.ok === false, JSON.stringify(first));
check("and leaves nothing marking the event done", !db.events.has(paid.eventId));
check("and the partner is still past due, as before", db.billing.status === "past_due", db.billing.status);

const retry = await applyPartnerBillingEvent(paid, "2026-10-24T20:01:00Z");
check("the redelivery applies it: the partner is active", retry.ok === true && retry.duplicate === false && db.billing.status === "active", JSON.stringify(retry));
check("and the event is recorded once it has applied", db.events.has(paid.eventId));

const again = await applyPartnerBillingEvent(paid, "2026-10-24T20:02:00Z");
check("a third delivery of the same event is a duplicate and changes nothing", again.ok === true && again.duplicate === true && db.billing.status === "active", JSON.stringify(again));

db.events.add(failed.eventId);
const stale = await applyPartnerBillingEvent(failed, "2026-10-24T20:03:00Z");
check(
  "an older event already applied, delivered again, cannot put the partner back to past due",
  stale.ok === true && stale.duplicate === true && db.billing.status === "active",
  `${JSON.stringify(stale)} ${db.billing.status}`,
);

console.log("");
if (wrong === 0) {
  console.log("PASS: a partner billing event is never lost to a retry, and a redelivered old event changes nothing.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
