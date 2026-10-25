// @runtime react-server
//
// Declared because it imports src/lib/ops-reconcile.ts, which carries server-only.

/**
 * A FAILED READ OF THE ORDERS WAITING ON PAYMENT IS NEVER "NOTHING IS STUCK"
 * AND NEVER A SWEEP WITH NOTHING TO RECONCILE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-failed-orders-read-is-never-nothing-stuck.mjs
 *
 * Robert's audit of 2026-10-24. /portal/orders read ordersNeedingAttention,
 * the wrapper that folds a failed read into an empty list, and so said
 * "Nothing is stuck. Every order is either moving or was paid for." when it
 * could not read the orders at all; ordersNeedingAttentionRead, which says null
 * on a failure, sat beside it and only the dashboard used it. And
 * unreconciledOrders folded a failed read into [], so the reconcile sweep
 * reported nothing to reconcile on exactly the day it was needed.
 */
process.env.SUPABASE_URL = "http://orders-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "orders-proof-not-a-key";
delete process.env.VERCEL_ENV;

import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

let failing = false;
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const table = url.pathname.replace("/rest/v1/", "");
  if (failing && table === "eng_service_orders") return json({ message: "proof: the orders read failed", code: "XX000" }, 500);
  if (table === "eng_service_orders") {
    return json([{ id: "o1", reference: "254-PROOF-WAIT-1", status: "awaiting_payment", total_cents: 70900, created_at: "2026-10-20T12:00:00Z" }]);
  }
  return json([]);
};

const { unreconciledOrders } = await import("../../src/lib/ops-reconcile.ts");

failing = false;
const read = await unreconciledOrders();
check("the premise: with the read answering, the waiting order is listed", read.length === 1 && read[0].reference === "254-PROOF-WAIT-1");
failing = true;
let threw = null;
try {
  await unreconciledOrders();
} catch (err) {
  threw = err instanceof Error ? err.message : String(err);
}
check("a failed read throws, saying nothing was reconciled, never an empty set", typeof threw === "string" && /nothing was reconciled/.test(threw), String(threw));

const page = readFileSync("src/app/portal/(app)/orders/page.tsx", "utf8");
check(
  "/portal/orders reads the result-typed list and says a failed read before it can say nothing is stuck",
  /const ordersRead = await ordersNeedingAttentionRead\(\);/.test(page) &&
    page.indexOf("ordersRead === null ?") > -1 &&
    page.indexOf("ordersRead === null ?") < page.indexOf('title="Nothing is stuck"') &&
    !/await ordersNeedingAttention\(\)/.test(page),
);
const route = readFileSync("src/app/api/portal/orders/reconcile/route.ts", "utf8");
check(
  "the reconcile route answers a failed sweep with 503 and the reason, both times it reads",
  (route.match(/if \(report instanceof Error\) return NextResponse\.json\(\{ ok: false, error: report\.message \}, \{ status: 503 \}\);/g) ?? []).length === 2,
);

console.log("");
if (wrong === 0) {
  console.log("PASS: a failed read of the orders waiting on payment is said, never 'Nothing is stuck' or an empty sweep.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
