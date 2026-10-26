// @runtime react-server
//
// Declared because it imports src/lib/ops-customer.ts, which carries
// server-only, by a dynamic import the runtime sniffer does not follow.

/**
 * A REPAIR SPECIFICATION ORDER UNDERWAY SAYS ITS SPECIFICATION IS BEING
 * PREPARED, AND GIVES NO DATE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-repair-specification-order-says-it-is-being-prepared.mjs
 *
 * Robert's ruling of 2026-10-25, 23:51 Central: until the engineer's own
 * document can be sealed, repair specification orders are taken and paid and
 * wait at sealing, and the status page says the specification is being
 * prepared, with no false date. Every other line underway keeps its own
 * sentence, and a repair specification that is not underway keeps the
 * sentence for its status.
 *
 * Every migration is replayed into PGlite and served as PostgREST by
 * scripts/lib/replay-rest.mjs, as a-pending-refund-is-said-and-counted does.
 * Nothing reaches development, Stripe or a mailbox.
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
check("every migration replays", files.length > 0, `${files.length} files`);

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CLIENT = id(1);
const EMAIL = "repair-spec-status-proof@audit-probe.invalid";
const ORDERS = {
  specUnderway: { n: 401, slug: "repair-specifications", status: "in_fulfilment" },
  specPaid: { n: 402, slug: "repair-specifications", status: "paid" },
  roofUnderway: { n: 403, slug: "roof-inspections", status: "in_fulfilment" },
};
const orderId = (k) => id(ORDERS[k].n);
const fileId = (k) => id(ORDERS[k].n + 100);

await db.exec(`
  insert into eng_clients (id, kind, name) values ('${CLIENT}', 'individual', 'Repair specification status proof client, not a real person');
`);
for (const [k, o] of Object.entries(ORDERS)) {
  await db.exec(`
    insert into eng_files (id, file_number, client_id, service_slug, property_address, county, status)
    values ('${fileId(k)}', '254-PROOF-RS-${o.n}', '${CLIENT}', '${o.slug}', '${o.n} Specification Way', 'Nueces', 'intake');
    insert into eng_service_orders
      (id, site, reference, service_slug, order_type, customer_name, customer_email, property_address, county,
       status, total_cents, file_id, client_id, paid_at, inspection_fee_cents)
    values
      ('${orderId(k)}', '254engineering', '254-PROOF-RS-${o.n}', '${o.slug}', 'field',
       'Repair specification status proof customer, not a real person', '${EMAIL}', '${o.n} Specification Way', 'Nueces',
       '${o.status}', 119500, '${fileId(k)}', '${CLIENT}', now(), 17500);
  `);
}

const rest = await startReplayRest(db, PORTS.replayRest);
process.env.SUPABASE_URL = rest.url;
process.env.SUPABASE_SERVICE_ROLE_KEY = "replay-stand-in";
try {
  const { issueCustomerLink } = await import("../../src/lib/ops-intake.ts");
  const { customerView } = await import("../../src/lib/ops-customer.ts");
  const { CUSTOMER_STATUS, CUSTOMER_STATUS_REPAIR_SPEC } = await import("../../src/lib/ops-orders.ts");
  const view = async (k) => {
    const link = await issueCustomerLink({ orderId: orderId(k) });
    return link ? customerView(link.token) : null;
  };

  check(
    "the line is Robert's sentence, and it carries no date and no number of days",
    CUSTOMER_STATUS_REPAIR_SPEC === "Underway. Your repair specification is being prepared." && !/\d/.test(CUSTOMER_STATUS_REPAIR_SPEC),
    CUSTOMER_STATUS_REPAIR_SPEC,
  );
  const spec = await view("specUnderway");
  check("a repair specification underway says its specification is being prepared", spec?.statusLine === CUSTOMER_STATUS_REPAIR_SPEC, spec?.statusLine);
  const paid = await view("specPaid");
  check("a repair specification not yet underway keeps the paid sentence", paid?.statusLine === CUSTOMER_STATUS.paid, paid?.statusLine);
  const roof = await view("roofUnderway");
  check("a roof inspection underway keeps its own underway sentence", roof?.statusLine === CUSTOMER_STATUS.in_fulfilment, roof?.statusLine);
} finally {
  await rest.close();
}

await db.close();
console.log("");
if (wrong) {
  console.log(`FAIL: ${wrong} check${wrong === 1 ? "" : "s"} wrong.`);
  process.exit(1);
}
console.log("PASS: a repair specification order underway says its specification is being prepared, with no date.");
