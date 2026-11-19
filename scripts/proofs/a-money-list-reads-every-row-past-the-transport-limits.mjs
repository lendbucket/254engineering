/**
 * PROOF: A MONEY LIST READS EVERY ROW PAST THE TRANSPORT'S TWO LIMITS, OR SAYS
 * IT COULD NOT READ, AND NEVER RETURNS PART OF ITS SET.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-money-list-reads-every-row-past-the-transport-limits.mjs
 *
 * Robert's all-day prompt of 2026-11-19, job two, from the master undone list
 * (`docs/master-undone-2026-11-19.md`, N4 and the Orders screen's two panels):
 *
 *   A  partnerCostByFileRead, the partner ledger under every margin, was one
 *      .in() over every partner file. Past IN_FILTER_CHUNK ids the request is
 *      refused, and past 1,000 rows PostgREST cuts the answer short with no error.
 *   B  ordersWaitingForTravel, the Orders screen's "Waiting for travel" panel,
 *      read the first 500 travel requests with no order. Past 500, a customer's
 *      order held for travel could drop off the one panel that sends its link.
 *   C  ordersHeldForTravel, which both the panel and the expiry sweeps read,
 *      decides held from the LATEST travel event of each order, across chunks.
 *   D  refundsFailedAfterRefunded, the Orders screen's failed-refund panel,
 *      read the newest 500 and sent one .in() over their orders.
 *   F  ordersNeedingAttentionRead, the Orders screen's and the dashboard's
 *      unpaid orders, sent one .in() over every unpaid order, twice.
 *   G  pipelineReport's cycle time sent one .in() over every paid order's file.
 *   E  a failure on any one table makes each read answer null, never a part.
 *
 * The real functions run against a stub PostgREST held here. It honours the
 * filters these reads use (eq, in, not.is.null, not.like), offset and limit,
 * and the two limits of the real transport: it REFUSES an in() list longer than
 * 150 ids, as the measured cliff in src/lib/bounded-read.ts does, and it never
 * answers more than 1,000 rows, as PostgREST does. No request leaves this
 * process.
 */
const tables = {};
const failing = new Set();
let refusedForLength = 0;
let cappedAnswers = 0;

const unquote = (v) => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v);
function parseIn(value) {
  const inner = value.slice(value.indexOf("(") + 1, value.lastIndexOf(")"));
  const out = [];
  let cur = "";
  let quoted = false;
  for (const ch of inner) {
    if (ch === '"') quoted = !quoted;
    if (ch === "," && !quoted) {
      out.push(unquote(cur));
      cur = "";
    } else cur += ch;
  }
  if (cur.length) out.push(unquote(cur));
  return out;
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = (init.method ?? "GET").toUpperCase();
  const table = url.pathname.split("/rest/v1/")[1] ?? "";
  const json = { "content-type": "application/json" };
  if (failing.has(table)) {
    return new Response(JSON.stringify({ message: `stub failure on ${table}`, code: "XX000" }), { status: 500, headers: json });
  }
  let rows = [...(tables[table] ?? [])];
  for (const [key, raw] of url.searchParams) {
    if (["select", "order", "offset", "limit"].includes(key)) continue;
    if (raw.startsWith("in.")) {
      const values = parseIn(raw);
      if (values.length > 150) {
        refusedForLength += 1;
        return new Response(JSON.stringify({ message: "TypeError: fetch failed (stub: in() past the cliff)" }), { status: 400, headers: json });
      }
      rows = rows.filter((r) => values.includes(String(r[key])));
    } else if (raw.startsWith("eq.")) {
      const v = raw.slice(3);
      rows = rows.filter((r) => String(r[key]) === v);
    } else if (raw === "not.is.null") {
      rows = rows.filter((r) => r[key] !== null && r[key] !== undefined);
    } else if (raw.startsWith("not.like.")) {
      const prefix = raw.slice("not.like.".length).replace(/\*$/, "").replace(/%$/, "");
      rows = rows.filter((r) => !String(r[key] ?? "").startsWith(prefix));
    }
  }
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const asked = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : rows.length;
  const limit = Math.min(asked, 1000);
  if (asked > 1000 || (!url.searchParams.has("limit") && rows.length > 1000)) cappedAnswers += 1;
  const page = rows.slice(offset, offset + limit);
  const headers = { ...json, "content-range": `${page.length ? `${offset}-${offset + page.length - 1}` : "*"}/${rows.length}` };
  if (method === "HEAD") return new Response(null, { status: 200, headers });
  if (method !== "GET") return new Response("[]", { status: 200, headers });
  return new Response(JSON.stringify(page), { status: 200, headers });
};
process.env.SUPABASE_URL = "https://ythzaiqeoijlrdibnieo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "proof-not-a-key";
delete process.env.VERCEL_ENV;

const { partnerCostByFileRead } = await import("../../src/lib/ops-partner-comp.ts");
const { ordersWaitingForTravel, ordersHeldForTravel, ORDER_TRAVEL_REQUESTED, ORDER_TRAVEL_SET } = await import(
  "../../src/lib/order-travel.ts"
);
const { refundsFailedAfterRefunded } = await import("../../src/lib/ops-payments.ts");
const { ordersNeedingAttentionRead } = await import("../../src/lib/ops-reconcile.ts");
const { pipelineReport } = await import("../../src/lib/ops-reports.ts");
const { IN_FILTER_CHUNK } = await import("../../src/lib/bounded-read.ts");

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures += 1;
}
const uuid = (prefix, i) => `${prefix}${String(i).padStart(8, "0")}-0000-4000-8000-000000000000`;
const iso = (minute) => new Date(Date.UTC(2026, 10, 1, 0, minute)).toISOString();

console.log("the stub's limits are the real transport's");
check("the chunk the code uses is under the stub's cliff", IN_FILTER_CHUNK <= 150, `IN_FILTER_CHUNK ${IN_FILTER_CHUNK}`);

/* ------------------------------------------------------------------ A */
console.log("A  the partner ledger under every margin");
{
  const files = [];
  tables.eng_partner_entries = [];
  for (let i = 0; i < 400; i += 1) {
    const id = uuid("a", i);
    files.push({ id, partnerId: "p1" });
    for (let k = 0; k < 3; k += 1) {
      tables.eng_partner_entries.push({ id: uuid(`e${k}`, i), file_id: id, amount_cents: 1000 + k, status: "accrued" });
    }
  }
  /* One file with no partner, whose cost is a known zero, and one with a blocked entry, whose cost is unknown. */
  files.push({ id: uuid("z", 0), partnerId: null });
  files.push({ id: uuid("b", 0), partnerId: "p1" });
  tables.eng_partner_entries.push({ id: uuid("eb", 0), file_id: uuid("b", 0), amount_cents: 500, status: "blocked" });

  const before = refusedForLength;
  const map = await partnerCostByFileRead(files);
  check("it answers rather than failing on 401 partner files", map !== null);
  if (map) {
    const wrong = files.slice(0, 400).filter((f) => map.get(f.id) !== 3003);
    check("every one of 400 partner files carries all three of its entries, 1,201 rows read past the 1,000 cap", wrong.length === 0, `${wrong.length} wrong`);
    check("a file with no partner is a known zero", map.get(uuid("z", 0)) === 0);
    check("a file with a blocked entry has no figure, not a smaller one", map.get(uuid("b", 0)) === null);
  }
  check("no request it sent was past the in() cliff", refusedForLength === before, `${refusedForLength - before} refused`);
}

/* ------------------------------------------------------------------ B and C */
console.log("B  the Orders screen's Waiting for travel panel");
{
  tables.eng_order_events = [];
  tables.eng_service_orders = [];
  let serial = 1;
  for (let i = 0; i < 700; i += 1) {
    const id = uuid("o", i);
    tables.eng_service_orders.push({
      id,
      reference: `254-T-${i}`,
      county: "Bexar County",
      property_address: `${i} Example St`,
      service_slug: "roof-inspections",
      tier: "standard",
      customer_name: `Customer ${i}`,
      total_cents: 70900,
      status: "awaiting_payment",
      created_at: iso(10_000 - i),
    });
    tables.eng_order_events.push({ id: serial++, order_id: id, event: ORDER_TRAVEL_REQUESTED, created_at: iso(10_000 - i) });
  }
  /* Thirty of them have had travel set since, so they are no longer waiting. */
  for (let i = 0; i < 30; i += 1) {
    tables.eng_order_events.push({ id: serial++, order_id: uuid("o", i), event: ORDER_TRAVEL_SET, created_at: iso(20_000 + i) });
  }
  const before = refusedForLength;
  const waiting = await ordersWaitingForTravel();
  check("it answers rather than failing on 700 held orders", waiting !== null);
  if (waiting) {
    check("all 670 orders still held are on the panel, past the old 500", waiting.length === 670, `${waiting.length} on the panel`);
    const sorted = waiting.every((w, i) => i === 0 || waiting[i - 1].heldAt <= w.heldAt);
    check("oldest first across the whole set, not within a chunk", sorted);
    check("an order whose travel was set is not on the panel", !waiting.some((w) => w.id === uuid("o", 0)));
  }
  check("no request it sent was past the in() cliff", refusedForLength === before, `${refusedForLength - before} refused`);

  console.log("C  held is decided by each order's latest travel event");
  const held = await ordersHeldForTravel(tables.eng_service_orders.map((o) => o.id));
  check("it answers over 700 ids", held !== null);
  if (held) {
    check("670 held", held.size === 670, `${held.size}`);
    check("set after requested is not held", !held.has(uuid("o", 5)));
    check("requested and never set is held", held.has(uuid("o", 699)));
  }
  /* An order asked again after travel was set is held again: the latest event decides. */
  tables.eng_order_events.push({ id: serial++, order_id: uuid("o", 7), event: ORDER_TRAVEL_REQUESTED, created_at: iso(30_000) });
  const again = await ordersHeldForTravel([uuid("o", 7)]);
  check("asked again after it was set, it is held again", again?.has(uuid("o", 7)) === true);
}

/* ------------------------------------------------------------------ D */
console.log("D  the Orders screen's failed-refund panel");
{
  tables.eng_order_payments = [];
  for (let i = 0; i < 600; i += 1) {
    const order = tables.eng_service_orders[i];
    order.status = "refunded";
    order.refunded_at = iso(40_000);
    tables.eng_order_payments.push({
      id: uuid("r", i),
      order_id: order.id,
      kind: "refund",
      amount_cents: 70900,
      status: i % 2 ? "failed" : "cancelled",
      failure_reason: null,
      provider_ref: `re_${i}`,
      updated_at: iso(41_000 + i),
    });
  }
  /* A platform reservation that never reached Stripe is not a refund that failed there. */
  tables.eng_order_payments.push({
    id: uuid("r", 999),
    order_id: tables.eng_service_orders[650].id,
    kind: "refund",
    amount_cents: 70900,
    status: "failed",
    failure_reason: null,
    provider_ref: "platform-refund:x",
    updated_at: iso(41_999),
  });
  tables.eng_service_orders[650].status = "refunded";
  tables.eng_service_orders[650].refunded_at = iso(40_000);
  const before = refusedForLength;
  const panel = await refundsFailedAfterRefunded();
  check("it answers rather than failing on 600 failed refunds", panel !== null);
  if (panel) {
    check("all 600 are on the panel, past the old 500", panel.length === 600, `${panel.length} on the panel`);
    check("the platform reservation is not", !panel.some((p) => p.orderId === tables.eng_service_orders[650].id));
  }
  check("no request it sent was past the in() cliff", refusedForLength === before, `${refusedForLength - before} refused`);
}

/*
 * ------------------------------------------------------------------ E
 * Run here, against the fixtures A to D built, so each read reaches the table
 * that is failed. F and G rebuild the order tables afterwards, and a read that
 * returns early because its set is empty would answer [] and never meet the
 * failure, which is a check passing or failing for the wrong reason.
 */
console.log("E  a failed read is null, never a part");
for (const [name, run, table] of [
  ["the partner ledger", () => partnerCostByFileRead([{ id: uuid("a", 1), partnerId: "p1" }]), "eng_partner_entries"],
  ["waiting for travel, its events", () => ordersWaitingForTravel(), "eng_order_events"],
  ["waiting for travel, its orders", () => ordersWaitingForTravel(), "eng_service_orders"],
  ["the failed refunds", () => refundsFailedAfterRefunded(), "eng_order_payments"],
  ["the failed refunds, their orders", () => refundsFailedAfterRefunded(), "eng_service_orders"],
]) {
  failing.add(table);
  const result = await run();
  failing.delete(table);
  check(`${name}: a failure on ${table} answers null`, result === null);
}

/* ------------------------------------------------------------------ F */
console.log("F  the Orders screen's and the dashboard's unpaid orders");
{
  tables.eng_service_orders = [];
  tables.eng_order_payments = [];
  tables.eng_order_events = [];
  let serial = 1;
  for (let i = 0; i < 400; i += 1) {
    const id = uuid("u", i);
    tables.eng_service_orders.push({
      id,
      reference: `254-U-${i}`,
      status: "awaiting_payment",
      service_slug: "roof-inspections",
      customer_email: `c${i}@example.com`,
      property_address: `${i} Unpaid St`,
      total_cents: 70900,
      placed_at: iso(i),
      created_at: iso(i),
    });
    /* Every fourth took money already, so it is not stuck for want of a payment. */
    if (i % 4 === 0) tables.eng_order_payments.push({ id: uuid("c", i), order_id: id, kind: "charge", created_at: iso(i + 1) });
    /* Half opened two checkouts; the one the panel names must be the newer. */
    if (i % 2 === 1) {
      tables.eng_order_events.push({ id: serial++, order_id: id, event: "checkout.started", detail: { session_ref: `cs_old_${i}` }, created_at: iso(i + 1) });
      tables.eng_order_events.push({ id: serial++, order_id: id, event: "checkout.started", detail: { session_ref: `cs_new_${i}` }, created_at: iso(i + 2) });
    }
  }
  const before = refusedForLength;
  const stuck = await ordersNeedingAttentionRead();
  check("it answers rather than failing on 400 unpaid orders", stuck !== null);
  if (stuck) {
    check("every one of the 300 that took no money is listed, and none of the 100 that did", stuck.length === 300 && !stuck.some((s) => s.id === uuid("u", 0)), `${stuck.length} listed`);
    const wrongSession = stuck.filter((s) => {
      const i = Number(s.reference.split("-").pop());
      return i % 2 === 1 ? s.sessionRef !== `cs_new_${i}` : s.sessionRef !== null;
    });
    check("each names its newest checkout, or none when it opened none, across chunks", wrongSession.length === 0, `${wrongSession.length} wrong`);
  }
  check("no request it sent was past the in() cliff", refusedForLength === before, `${refusedForLength - before} refused`);
  for (const table of ["eng_order_payments", "eng_order_events"]) {
    failing.add(table);
    const result = await ordersNeedingAttentionRead();
    failing.delete(table);
    check(`a failure on ${table} answers null, not a list that reads every order as unpaid or never checked out`, result === null);
  }
}

/* ------------------------------------------------------------------ G */
console.log("G  the pipeline report's cycle time");
{
  tables.eng_files = [];
  for (const o of tables.eng_service_orders) {
    const i = Number(o.reference.split("-").pop());
    o.status = "complete";
    o.paid_at = iso(i);
    o.file_id = uuid("f", i);
    o.is_demo = false;
    o.county = "Bexar";
    o.twia_county = false;
    tables.eng_files.push({ id: o.file_id, sealed_at: iso(i + 120) });
  }
  const before = refusedForLength;
  const report = await pipelineReport();
  const cycleFailed = report.unavailable.some((u) => u.startsWith("Cycle time could not be computed"));
  check("cycle time is computed over 400 paid orders' files, not refused", !cycleFailed, report.unavailable.join(" | ").slice(0, 200));
  check("no request it sent was past the in() cliff", refusedForLength === before, `${refusedForLength - before} refused`);
  failing.add("eng_files");
  const broken = await pipelineReport();
  failing.delete("eng_files");
  check(
    "a failure on eng_files makes cycle time absent and says so, rather than a mean over part of the set",
    broken.unavailable.some((u) => u.startsWith("Cycle time could not be computed")),
  );
}

console.log(`the stub refused ${refusedForLength} over-long in() request(s) and capped ${cappedAnswers} answer(s) in this run`);
if (failures) {
  console.log(`FAIL: ${failures} check(s).`);
  process.exit(1);
}
console.log("PASS: a money list reads every row past the transport's limits, or says it could not.");
