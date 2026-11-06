// @runtime react-server
//
// Declared because it imports src/lib/ops-statements.ts, which carries
// server-only, by a dynamic import the runtime sniffer does not follow.

/**
 * AN ORDER IS ON ONE STATEMENT, AND A LOST DISPUTE NAMES ITS OWN CASE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/an-order-is-on-one-statement-and-a-lost-dispute-names-its-case.mjs
 *
 * Robert's ruling Q8 of 2026-11-02, money audit F8 and F10, migration 0120:
 *
 *   F8. eng_statement_lines is unique on order_id, so an order cannot be a
 *       line on two statements; and a period close that meets that index for
 *       an order another close just billed leaves the order with the
 *       statement that billed it.
 *   F10. eng_apply_refund writes the refund_case and event type the payload
 *       names, and a caller that names neither is recorded as before.
 *
 * Every migration replayed into PGlite and served as PostgREST by
 * scripts/lib/replay-rest.mjs; closePeriod runs in this process against it.
 */
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

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) await db.exec(readSource(join(DIR, f)));
check("every migration replays, 0120 among them", files.some((f) => f.startsWith("0120_")), `${files.length} files`);

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CLIENT = id(1);
const ACCOUNT = id(2);
const SEPTEMBER = id(3);
const ORDER = id(4);
const FILE = id(5);
const DISPUTED = id(6);
const DISPUTED_FILE = id(7);
const EMAIL = "q8b-money-proof@audit-probe.invalid";

await db.exec(`
  insert into eng_clients (id, kind, name) values ('${CLIENT}', 'individual', 'Q8b money proof client, not a real person');
  insert into eng_customer_accounts (id, site, client_id, billing_mode) values ('${ACCOUNT}', '254engineering', '${CLIENT}', 'invoice');
  insert into eng_statements (id, account_id, reference, period, status) values ('${SEPTEMBER}', '${ACCOUNT}', '254-S202609-PROOF', '2026-09', 'open');
  insert into eng_files (id, file_number, client_id, service_slug, property_address, county, status) values
    ('${FILE}', '254-PROOF-Q8B-4', '${CLIENT}', 'roof-inspections', '4 Statement Way', 'Nueces', 'intake'),
    ('${DISPUTED_FILE}', '254-PROOF-Q8B-6', '${CLIENT}', 'roof-inspections', '6 Statement Way', 'Nueces', 'intake');
  insert into eng_service_orders
    (id, site, reference, service_slug, order_type, customer_name, customer_email, property_address, county,
     status, total_cents, file_id, client_id, account_id, billing_mode)
  values
    ('${ORDER}', '254engineering', '254-PROOF-Q8B-4', 'roof-inspections', 'field',
     'Q8b money proof customer, not a real person', '${EMAIL}', '4 Statement Way', 'Nueces',
     'complete', 50000, '${FILE}', '${CLIENT}', '${ACCOUNT}', 'invoice'),
    ('${DISPUTED}', '254engineering', '254-PROOF-Q8B-6', 'roof-inspections', 'field',
     'Q8b money proof customer, not a real person', '${EMAIL}', '6 Statement Way', 'Nueces',
     'complete', 70900, '${DISPUTED_FILE}', '${CLIENT}', null, 'card');
  insert into eng_order_payments (order_id, kind, amount_cents, provider, provider_ref, status)
  values ('${DISPUTED}', 'charge', 70900, 'stripe', 'pi_q8b_disputed', 'succeeded');
`);

/*
 * The other close's half done state: its line for ORDER is on the September
 * statement, and its update of the order's statement_id has not landed yet, so
 * the October close below still gathers the order.
 */
await db.exec(`
  insert into eng_statement_lines (statement_id, order_id, description, amount_cents)
  values ('${SEPTEMBER}', '${ORDER}', '254-PROOF-Q8B-4: 4 Statement Way', 50000);
`);

const rest = await startReplayRest(db, PORTS.replayRest);
process.env.SUPABASE_URL = rest.url;
process.env.SUPABASE_SERVICE_ROLE_KEY = "replay-stand-in";
const { closePeriod } = await import("../../src/lib/ops-statements.ts");

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0] ?? null;

try {
  /* ============ F8: the index ============ */
  {
    let refused = null;
    try {
      await db.exec(`
        insert into eng_statements (id, account_id, reference, period, status) values ('${id(8)}', '${ACCOUNT}', '254-S202608-PROOF', '2026-08', 'open');
        insert into eng_statement_lines (statement_id, order_id, description, amount_cents)
        values ('${id(8)}', '${ORDER}', 'a second line for the same order', 50000);
      `);
    } catch (e) {
      refused = e?.code ?? String(e);
    }
    check("an order cannot be a line on a second statement", refused === "23505", `the second line answered ${refused ?? "inserted"}`);
  }

  /* ============ F8: a close that meets it leaves the order where it was billed ============ */
  {
    const closed = await closePeriod(ACCOUNT, "2026-10");
    const order = await one(`select statement_id from eng_service_orders where id = $1`, [ORDER]);
    const lines = await one(`select count(*)::int as n from eng_statement_lines where order_id = $1`, [ORDER]);
    check(
      "a close that meets the index for an order another close billed does not take the order",
      closed.ok === true && closed.lines === 0 && order?.statement_id !== closed.statementId && lines?.n === 1,
      `${JSON.stringify(closed)}; order on ${order?.statement_id}; ${lines?.n} line(s)`,
    );
  }

  /* ============ F10: the refund names its case ============ */
  {
    const charge = await one(`select id from eng_order_payments where provider_ref = 'pi_q8b_disputed'`);
    const base = {
      source: "stripe_webhook",
      order_id: DISPUTED,
      batch_id: null,
      statement_id: null,
      charge_ref: "pi_q8b_disputed",
      charge_id: charge.id,
      provider: "stripe",
      reversals: [],
      mark_refunded: false,
      expected_order_status: null,
    };
    const lost = await one(`select public.eng_apply_refund($1::jsonb) as r`, [
      JSON.stringify({
        ...base,
        event_id: "evt_q8b_dispute_closed",
        event_type: "charge.dispute.closed",
        refund_case: "dispute_lost",
        expected_prior_cents: 0,
        delta_cents: 20000,
        refund_ref: "dp_q8b_lost",
        refund_summary: "$200.00 went back to your card through a dispute with your bank.",
        audit_summary: "a lost dispute, recorded",
      }),
    ]);
    const lostRow = await one(`select refund_case, amount_cents from eng_order_payments where provider_ref = 'dp_q8b_lost'`);
    const lostEvent = await one(`select event_type from eng_payment_events where event_id = 'evt_q8b_dispute_closed'`);
    check(
      "a lost dispute is written with its own case, under its own event type",
      lost?.r?.outcome === "applied" && lostRow?.refund_case === "dispute_lost" && Number(lostRow?.amount_cents) === 20000 && lostEvent?.event_type === "charge.dispute.closed",
      `${JSON.stringify(lost?.r)}; row ${JSON.stringify(lostRow)}; event ${JSON.stringify(lostEvent)}`,
    );

    const plain = await one(`select public.eng_apply_refund($1::jsonb) as r`, [
      JSON.stringify({
        ...base,
        event_id: "evt_q8b_refunded",
        expected_prior_cents: 20000,
        delta_cents: 10000,
        refund_ref: "re_q8b_plain",
        refund_summary: "$100.00 was refunded to your card.",
        audit_summary: "a dashboard refund, recorded",
      }),
    ]);
    const plainRow = await one(`select refund_case from eng_order_payments where provider_ref = 're_q8b_plain'`);
    const plainEvent = await one(`select event_type from eng_payment_events where event_id = 'evt_q8b_refunded'`);
    check(
      "and a caller that names neither is recorded exactly as before",
      plain?.r?.outcome === "applied" && plainRow?.refund_case === "issued_outside_the_platform" && plainEvent?.event_type === "charge.refunded",
      `${JSON.stringify(plain?.r)}; row ${JSON.stringify(plainRow)}; event ${JSON.stringify(plainEvent)}`,
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
console.log("PASS: an order is on one statement, a close that meets that leaves it where it was billed, and a lost dispute names its own case.");
process.exit(0);
