// @runtime react-server
//
// Declared because it imports src/lib/ops-payments.ts, which carries
// server-only, by a dynamic import the runtime sniffer does not follow.

/**
 * A CHARGEBACK REACHES A PERSON, AND A LOST ONE REACHES THE LEDGER.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-chargeback-reaches-a-person-and-a-lost-one-reaches-the-ledger.mjs
 *
 * Robert's ruling Q8 of 2026-11-02 (money audit F10): "dispute.created raises
 * a task, dispute.closed lost records a refund row." Before this, every
 * charge.dispute.* event was verified and ignored, so a lost dispute left a
 * charge with nothing against it and a later cancellation asked Stripe to
 * refund money already reversed.
 *
 * The adapter's parse is read in its source; the two effects run in this
 * process against every migration replayed into PGlite and served as
 * PostgREST, as a-pending-refund-is-said-and-counted does.
 */
process.env.STRIPE_SECRET_KEY = "sk_test_q8c_dispute_proof";

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
check("every migration replays, 0118 among them", files.some((f) => f.startsWith("0118_")), `${files.length} files`);

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CLIENT = id(1);
const ORDER = id(2);
const FILE = id(3);
const EMAIL = "q8c-dispute-proof@audit-probe.invalid";
await db.exec(`
  insert into eng_clients (id, kind, name) values ('${CLIENT}', 'individual', 'Q8c dispute proof client, not a real person');
  insert into eng_files (id, file_number, client_id, service_slug, property_address, county, status)
  values ('${FILE}', '254-PROOF-Q8C-2', '${CLIENT}', 'roof-inspections', '2 Dispute Way', 'Nueces', 'intake');
  insert into eng_service_orders
    (id, site, reference, service_slug, order_type, customer_name, customer_email, property_address, county,
     status, total_cents, file_id, client_id)
  values
    ('${ORDER}', '254engineering', '254-PROOF-Q8C-2', 'roof-inspections', 'field',
     'Q8c dispute proof customer, not a real person', '${EMAIL}', '2 Dispute Way', 'Nueces',
     'complete', 70900, '${FILE}', '${CLIENT}');
  insert into eng_order_payments (order_id, kind, amount_cents, provider, provider_ref, status)
  values ('${ORDER}', 'charge', 70900, 'stripe', 'pi_q8c_disputed', 'succeeded');
`);

const rest = await startReplayRest(db, PORTS.replayRest);
process.env.SUPABASE_URL = rest.url;
process.env.SUPABASE_SERVICE_ROLE_KEY = "replay-stand-in";
process.env.ORDER_PAYMENTS_FAKE = "";
const payments = await import("../../src/lib/ops-payments.ts");

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0] ?? null;
const code = (path) =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => (/^\s*\/\//.test(l) ? "" : l))
    .join("\n");

try {
  /* ============ the adapter reads both events ============ */
  {
    const adapter = code("src/lib/payments-stripe.ts");
    check(
      "the adapter parses charge.dispute.created and charge.dispute.closed, with the payment intent as the charge",
      /event\.type === "charge\.dispute\.created" \|\| event\.type === "charge\.dispute\.closed"/.test(adapter) &&
        /kind: "charge\.dispute\.created",/.test(adapter) &&
        /kind: "charge\.dispute\.closed",/.test(adapter) &&
        /outcome: dispute\.status \?\? "unknown",/.test(adapter) &&
        /typeof dispute\.payment_intent === "string"/.test(adapter),
    );
    const route = code("src/app/api/stripe/webhook/route.ts");
    check(
      "and the webhook records only a lost dispute as money",
      /if \(parsed\.outcome !== "lost"\) \{/.test(route) && /lostDispute: \{ disputedCents: parsed\.amountCents \}/.test(route),
    );
  }

  /* ============ opened: a task ============ */
  {
    const noticed = await payments.noticeDispute({
      disputeRef: "dp_q8c_open",
      chargeRef: "pi_q8c_disputed",
      amountCents: 70900,
      reason: "fraudulent",
      provider: "stripe",
    });
    const task = await one(`select title, description from eng_tasks where title like $1`, ["254-PROOF-Q8C-2%"]);
    check(
      "an opened dispute raises a staff task naming the order and the dispute",
      noticed.ok === true && Boolean(task) && /dp_q8c_open/.test(task?.description ?? "") && /\$709\.00/.test(task?.title ?? ""),
      `${JSON.stringify(noticed)}; task ${JSON.stringify(task)}`,
    );
  }

  /* ============ closed lost: a refund row of its own case ============ */
  {
    const lost = await payments.recordExternalRefund({
      eventId: "evt_q8c_closed_lost",
      chargeRef: "pi_q8c_disputed",
      refundRef: "dp_q8c_open",
      refundedToDateCents: 0,
      provider: "stripe",
      lostDispute: { disputedCents: 70900 },
    });
    const row = await one(`select amount_cents, refund_case, status from eng_order_payments where provider_ref = 'dp_q8c_open'`);
    const evt = await one(`select event_type from eng_payment_events where event_id = 'evt_q8c_closed_lost'`);
    const order = await one(`select status from eng_service_orders where id = $1`, [ORDER]);
    const said = await one(`select summary from eng_order_events where order_id = $1 and event = 'refund.recorded'`, [ORDER]);
    check(
      "a lost dispute records the disputed amount as a refund of case dispute_lost, under charge.dispute.closed",
      lost.ok === true && lost.recordedCents === 70900 && Number(row?.amount_cents) === 70900 && row?.refund_case === "dispute_lost" &&
        row?.status === "succeeded" && evt?.event_type === "charge.dispute.closed",
      `${JSON.stringify(lost)}; row ${JSON.stringify(row)}; event ${JSON.stringify(evt)}`,
    );
    check(
      "and the whole charge back marks the order refunded, telling the customer it went back through their bank",
      order?.status === "refunded" && /through a dispute with your bank/.test(said?.summary ?? ""),
      `order ${order?.status}; said ${JSON.stringify(said)}`,
    );

    const again = await payments.recordExternalRefund({
      eventId: "evt_q8c_closed_lost",
      chargeRef: "pi_q8c_disputed",
      refundRef: "dp_q8c_open",
      refundedToDateCents: 0,
      provider: "stripe",
      lostDispute: { disputedCents: 70900 },
    });
    const rows = await one(`select count(*)::int as n from eng_order_payments where kind = 'refund' and order_id = $1`, [ORDER]);
    check("and the same event delivered again writes nothing", again.ok === true && again.alreadyRecorded === true && rows?.n === 1, `${JSON.stringify(again)}; ${rows?.n} refund row(s)`);
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
console.log("PASS: an opened chargeback reaches a person, and a lost one reaches the ledger once, as dispute_lost.");
process.exit(0);
