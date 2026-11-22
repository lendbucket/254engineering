// @runtime react-server
/**
 * PROOF: EVERY UNRELEASED PAYMENT IS LISTED, AT ANY COUNT, WITH ITS REFERENCE,
 * AND A FAILED READ IS NULL RATHER THAN A SHORTER LIST.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/every-unreleased-payment-is-counted.mjs
 *
 * Master list N15 and the .in() survey of 2026-11-22. `unreleasedPayments`
 * feeds the administrator's dashboard count and the payments alert. It read the
 * oldest 200 with nothing saying more existed, and sent their order ids in one
 * .in(), which the transport refuses past 150 ids, so from 151 unreleased
 * payments the whole read failed.
 *
 * The real function runs against a stub PostgREST held here, which refuses an
 * in() list past 150 ids and never answers more than 1,000 rows. The fixture
 * separates the two answers: 1,050 unreleased payments, past both limits and
 * the old cap of 200; 900 on orders and 150 on batches; plus payments that are
 * done or claimed too recently, which must not count. No request leaves this
 * process.
 */
const tables = { eng_payment_events: [], eng_service_orders: [], eng_order_batches: [] };
let failing = null;

function parseIn(value) {
  const inner = value.slice(value.indexOf("(") + 1, value.lastIndexOf(")"));
  return inner.split(",").map((v) => v.replace(/^"|"$/g, ""));
}
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const table = url.pathname.split("/rest/v1/")[1] ?? "";
  const json = { "content-type": "application/json" };
  if (failing === table) return new Response(JSON.stringify({ message: `stub failure on ${table}`, code: "XX000" }), { status: 500, headers: json });
  let rows = [...(tables[table] ?? [])];
  for (const [key, raw] of url.searchParams) {
    if (["select", "order", "offset", "limit"].includes(key)) continue;
    if (raw.startsWith("in.")) {
      const values = parseIn(raw);
      if (values.length > 150) return new Response(JSON.stringify({ message: "stub: in() past the cliff" }), { status: 400, headers: json });
      rows = rows.filter((r) => values.includes(String(r[key])));
    } else if (raw.startsWith("eq.")) {
      rows = rows.filter((r) => String(r[key]) === raw.slice(3));
    } else if (raw.startsWith("lt.")) {
      rows = rows.filter((r) => String(r[key]) < raw.slice(3));
    }
  }
  rows.sort((a, b) => ((a.claimed_at ?? a.id) < (b.claimed_at ?? b.id) ? -1 : 1));
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const asked = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : rows.length;
  const page = rows.slice(offset, offset + Math.min(asked, 1000));
  const headers = { ...json, "content-range": `${page.length ? `${offset}-${offset + page.length - 1}` : "*"}/${rows.length}` };
  if ((init.method ?? "GET").toUpperCase() === "HEAD") return new Response(null, { status: 200, headers });
  return new Response(JSON.stringify(page), { status: 200, headers });
};
process.env.SUPABASE_URL = "https://ythzaiqeoijlrdibnieo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "proof-not-a-key";
delete process.env.VERCEL_ENV;

const { unreleasedPayments } = await import("../../src/lib/payment-events.ts");

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures += 1;
};
const uuid = (p, i) => `${p}${String(i).padStart(7, "0")}-0000-4000-8000-000000000000`;
const NOW = Date.parse("2026-11-22T12:00:00Z");
const at = (minutesAgo) => new Date(NOW - minutesAgo * 60_000).toISOString();

for (let i = 0; i < 900; i += 1) {
  tables.eng_service_orders.push({ id: uuid("o", i), reference: `254-O-${i}` });
  /* The order payments are the OLDEST, so the old first-200 read takes 200 order ids and meets the 150-id cliff. */
  tables.eng_payment_events.push({ event_id: `evt_o${i}`, order_id: uuid("o", i), batch_id: null, status: "claimed", claimed_at: at(2000 + i), release_attempts: 1, last_error: null });
}
for (let i = 0; i < 150; i += 1) {
  tables.eng_order_batches.push({ id: uuid("b", i), reference: `254-B-${i}` });
  tables.eng_payment_events.push({ event_id: `evt_b${i}`, order_id: null, batch_id: uuid("b", i), status: "claimed", claimed_at: at(60 + i), release_attempts: 0, last_error: null });
}
for (let i = 0; i < 40; i += 1) tables.eng_payment_events.push({ event_id: `evt_done${i}`, order_id: uuid("o", i), batch_id: null, status: "done", claimed_at: at(500), release_attempts: 1, last_error: null });
for (let i = 0; i < 30; i += 1) tables.eng_payment_events.push({ event_id: `evt_new${i}`, order_id: uuid("o", i), batch_id: null, status: "claimed", claimed_at: at(2), release_attempts: 0, last_error: null });

console.log("the fixture separates the answers");
check("1,050 unreleased: past the old cap of 200, the 150-id cliff and the 1,000-row ceiling", 1050 > 1000);

console.log("every unreleased payment, with its reference");
const listed = await unreleasedPayments(NOW);
check("it answers", listed !== null);
check("all 1,050 are listed, not the oldest 200", listed?.length === 1050, `${listed?.length}`);
check("done and recently claimed payments are not listed", listed !== null && !listed.some((p) => /evt_(done|new)/.test(p.eventId)));
check("every order payment carries its order's reference", listed !== null && listed.filter((p) => p.eventId.startsWith("evt_o")).every((p) => /^254-O-/.test(p.reference)));
check("every batch payment carries its batch's reference", listed !== null && listed.filter((p) => p.eventId.startsWith("evt_b")).every((p) => /^254-B-/.test(p.reference)));

console.log("a failed read is null, never a shorter list");
for (const table of ["eng_payment_events", "eng_service_orders", "eng_order_batches"]) {
  failing = table;
  const r = await unreleasedPayments(NOW);
  failing = null;
  check(`a failure on ${table} answers null`, r === null);
}

console.log("");
if (failures === 0) {
  console.log("PASS: every unreleased payment is listed with its reference, and a failed read is null.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failures} check(s).`);
  process.exitCode = 1;
}
