// @runtime react-server
//
// Declared because it imports src/lib/ops-intake.ts, which carries server-only.

/**
 * AN AGREED PRICE IS THE ORDER'S PRICE, WRITTEN ON THE ORDER AT PLACEMENT.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/an-agreed-price-is-the-orders-price.mjs
 *
 * Robert's answer on finding F3, 2026-10-25. A bulk order for an account with
 * an agreed price was previewed and charged at the agreed share, while
 * placeOrder knew no trade price and wrote the PUBLISHED price into the order's
 * price and total. An invoiced account's statement reads total_cents, so it
 * was billed the published price; the status page and the email showed it too.
 * The ruling: the agreed price is the order's price, written at placement, so
 * statements, receipts, the status page and email all read one figure.
 *
 * placeOrder runs here in a child with the gate genuinely open (the gate
 * fixture), against a fake PostgREST that records what the order insert
 * carried. A foundation inspection in a coastal county (Nueces), so the
 * surcharge is asserted to stay its own line beside an agreed price. Nothing
 * reaches a database.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { inOpenGateProcess } = await import("../lib/gate-fixture.mjs");
const child = await inOpenGateProcess(`
  process.env.SUPABASE_URL = "http://agreed-price-proof.supabase.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "agreed-price-proof-not-a-key";
  delete process.env.VERCEL_ENV;
  const { transcriptionSha256 } = await import("./src/lib/protocol-sign.ts");
  const signed = { "254-FC-001 1.0": transcriptionSha256("254-FC-001", "1.0") };
  const inserts = [];
  let n = 0;
  const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  const param = (url, key) => (url.searchParams.get(key) || "").replace("eq.", "");
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    const table = url.pathname.replace("/rest/v1/", "");
    const method = (init.method || "GET").toUpperCase();
    const wantsObject = String((init.headers && (init.headers.Accept || init.headers.accept)) || "").includes("vnd.pgrst.object");
    if (table === "rpc/eng_line_is_trained") return json(true);
    if (table === "eng_seal_acts") {
      const sha = signed[param(url, "protocol_document") + " " + param(url, "protocol_version")];
      return json(sha ? [{ created_at: "2026-10-20T15:00:00Z", content_sha256: sha }] : []);
    }
    if (table === "eng_protocol_templates") return json([{ id: "template-" + param(url, "document_number") }]);
    if (method === "POST" || method === "PATCH") {
      const body = init.body ? JSON.parse(init.body) : {};
      const rows = (Array.isArray(body) ? body : [body]).map((r) => ({ id: "00000000-0000-4000-8000-" + String(++n).padStart(12, "0"), ...r }));
      inserts.push({ table, method, rows });
      return json(wantsObject ? rows[0] : rows, 201);
    }
    return json(wantsObject ? null : []);
  };
  const { placeOrder } = await import("./src/lib/ops-intake.ts");
  const { isOpen } = await import("./src/lib/launch.ts");
  const { catalogFor } = await import("./data/catalog.ts");
  /* Every qualifier answered with its first option that does not disqualify. */
  const answers = (catalogFor("foundation-inspections")?.qualifiers ?? []).map((q) => ({
    qualifierId: q.id,
    optionIndex: q.options.findIndex((_, i) => !(q.disqualifyOn ?? []).includes(i)),
  }));
  const base = (id) => ({
    site: "254engineering",
    clientRequestId: "agreed-price-proof-" + id,
    serviceSlug: "foundation-inspections",
    customer: { name: "Agreed Price Probe", email: "agreed-price-" + id + "@audit-probe.invalid", phone: "", company: "" },
    property: { propertyAddress: "1 Proof Way", city: "Corpus Christi", county: "Nueces", postalCode: "78401" },
    answers,
  });
  const orderOf = (start) => inserts.slice(start).find((i) => i.table === "eng_service_orders" && i.method === "POST")?.rows[0] ?? null;
  const placedEvent = (start) => inserts.slice(start).filter((i) => i.table === "eng_order_events").flatMap((i) => i.rows).find((r) => r.event === "order.placed") ?? null;
  const s1 = inserts.length;
  const agreedResult = await placeOrder({ ...base("a"), agreedPriceCents: 60000 });
  const agreedOrder = orderOf(s1);
  const agreedEvent = placedEvent(s1);
  const s2 = inserts.length;
  const publishedResult = await placeOrder(base("p"));
  const publishedOrder = orderOf(s2);
  answer({ open: isOpen(), agreedResult, agreedOrder, agreedEvent, publishedResult, publishedOrder });
`);

check("the open-gate child really has the gate open", child.open === true);
const a = child.agreedOrder;
const p = child.publishedOrder;
check("an order placed with no agreed price records the published price", p?.price_cents === 70900 && p?.total_cents === 70900 + 7500, p ? `price ${p.price_cents}, total ${p.total_cents}` : JSON.stringify(child.publishedResult));
check("an order placed at an agreed price records that price as its own", a?.price_cents === 60000, a ? `price ${a.price_cents}` : JSON.stringify(child.agreedResult));
check("and its total is the agreed price with the coastal line beside it, unchanged", a?.total_cents === 60000 + 7500 && a?.coastal_surcharge_cents === 7500, a ? `total ${a.total_cents}, coastal ${a.coastal_surcharge_cents}` : "");
check("and the published price at placement stays in the catalogue snapshot", a?.catalog_snapshot?.priceCents === 70900, a ? String(a.catalog_snapshot?.priceCents) : "");
check("and the order's placed event names both figures", child.agreedEvent?.detail?.agreed_price_cents === 60000 && child.agreedEvent?.detail?.published_price_cents === 70900, JSON.stringify(child.agreedEvent?.detail ?? child.agreedEvent));
check("and placeOrder answers with the agreed total", child.agreedResult?.ok === true && child.agreedResult.totalCents === 67500, JSON.stringify(child.agreedResult));

const bulk = readFileSync("src/lib/ops-bulk.ts", "utf8");
const loop = bulk.slice(bulk.indexOf("for (const item of split.accepted)"), bulk.indexOf("batch_share_cents: item.priceCents"));
check("placeBatch passes the account's agreed price to every order it places", /agreedPriceCents: agreed,/.test(loop) && /const agreed = await tradePriceInForce\(/.test(bulk));
for (const route of ["src/app/api/order-flow/route.ts", "src/app/api/orders/route.ts"]) {
  check(`${route} cannot pass an agreed price`, !/agreedPriceCents/.test(readFileSync(route, "utf8")));
}
const statements = readFileSync("src/lib/ops-statements.ts", "utf8");
check("a statement line is the order's own total", /amount_cents: amount,/.test(statements) && /const amount = Number\(o\.total_cents\);/.test(statements));
const customer = readFileSync("src/lib/ops-customer.ts", "utf8");
check(
  "the status page labels an agreed price, judged against the price at placement",
  /catalog_snapshot/.test(customer) && /Number\(order\.price_cents\) !== snapshotPrice/.test(customer) && /\(agreed price\)/.test(customer),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: an agreed price is the order's price, so the charge, the statement and the status page read one figure.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
