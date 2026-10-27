// @runtime react-server
//
// Declared because it imports src/lib/ops-customer.ts, which carries
// server-only, by a dynamic import the runtime sniffer does not follow.

/**
 * THE CUSTOMER'S ORDER PAGE SAYS WHAT IT COULD NOT READ, AND NEVER SHOWS A
 * FAILED READ AS NOTHING.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-customers-page-says-what-it-could-not-read.mjs
 *
 * Robert's audit of 2026-10-24, finding F29. customerView read the order's
 * timeline, its payments and its pending refunds with every error ignored, and
 * customerLetters answered a failed read with an empty list. So a failed read
 * showed a paying customer no progress, no refund and no sealed letter, with
 * nothing saying anything was missing.
 *
 * Every migration replays into an in-process Postgres, served through the
 * replay REST stand-in; a real customer link is issued and read back; one read
 * at a time is failed at the fetch layer. Nothing reaches a database.
 */
process.env.STRIPE_SECRET_KEY = "sk_test_customer_page_proof";

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
const FILE = id(2);
const ORDER = id(3);
const EMAIL = "customer-page-proof@audit-probe.invalid";
await db.exec(`
  insert into eng_clients (id, kind, name) values ('${CLIENT}', 'individual', 'Customer page proof client, not a real person');
  insert into eng_files (id, file_number, client_id, service_slug, property_address, county, status)
  values ('${FILE}', '254-PROOF-CV-1', '${CLIENT}', 'roof-inspections', '1 Proof Way', 'Nueces', 'intake');
  insert into eng_service_orders
    (id, site, reference, service_slug, order_type, customer_name, customer_email, property_address, county,
     status, total_cents, file_id, client_id, paid_at)
  values
    ('${ORDER}', '254engineering', '254-PROOF-CV-1', 'roof-inspections', 'field',
     'Customer page proof customer, not a real person', '${EMAIL}', '1 Proof Way', 'Nueces',
     'in_fulfilment', 78400, '${FILE}', '${CLIENT}', now());
  insert into eng_order_payments (order_id, kind, amount_cents, provider, provider_ref, status)
  values ('${ORDER}', 'charge', 78400, 'stripe', 'pi_customer_page_proof', 'succeeded');
`);

/* The admin client binds the global fetch when it is first made, so the failure switch is armed first. */
let failTable = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = decodeURIComponent(String(input instanceof Request ? input.url : input));
  const method = (init?.method ?? "GET").toUpperCase();
  if (failTable && method === "GET" && url.includes(`/${failTable}?`)) {
    return new Response(JSON.stringify({ code: "PROOF", message: "the proof failed this read", details: null, hint: null }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  return realFetch(input, init);
};

const rest = await startReplayRest(db, PORTS.replayRest);
process.env.SUPABASE_URL = rest.url;
process.env.SUPABASE_SERVICE_ROLE_KEY = "replay-stand-in";
const { issueCustomerLink } = await import("../../src/lib/ops-intake.ts");
const { customerView } = await import("../../src/lib/ops-customer.ts");
const link = await issueCustomerLink({ orderId: ORDER });
check("a real customer link was issued for the order", Boolean(link?.token));

try {
  const healthy = await customerView(link.token);
  check("with every read answering, the page names nothing as unread", healthy?.unread.length === 0, JSON.stringify(healthy?.unread));

  for (const [table, words] of [
    ["eng_order_events", "the progress of your order"],
    ["eng_order_payments", "what has been paid and refunded"],
    ["eng_documents", "your sealed documents"],
  ]) {
    failTable = table;
    const view = await customerView(link.token);
    failTable = null;
    check(`a failed read of ${table} is said to the customer as "${words}"`, view?.unread.includes(words) === true, JSON.stringify(view?.unread ?? view));
  }
} finally {
  await rest.close();
}

const page = readFileSync("src/app/(order)/order/[reference]/page.tsx", "utf8");
check(
  "the order page puts what could not be read in front of the customer",
  /\{view\.unread\.length > 0 \? \(/.test(page) && /view\.unread\.join\(" or "\)/.test(page),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: the customer's order page says what it could not read, and never shows a failed read as nothing.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
