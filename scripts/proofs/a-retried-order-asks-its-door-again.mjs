// @runtime react-server
//
// Declared because the child imports src/lib/ops-intake.ts, which carries server-only.

/**
 * A RETRIED WEB ORDER ASKS ITS LINE'S MONEY DOOR AGAIN BEFORE CHECKOUT OPENS.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-retried-order-asks-its-door-again.mjs
 *
 * Robert's audit of 2026-10-24, finding F10. placeOrder returns an existing
 * order by its idempotency key before its own gate, and /api/order-flow then
 * opened checkout on it, so a line whose signature was voided after the first
 * attempt would still take a card (ruling 11: a voided signature closes the
 * line at once). duplicateStillSellable asks the order's own line, read from
 * the row, and the route asks it for every duplicate before startCheckout.
 *
 * Run with the gate genuinely open (the gate fixture) against a fake PostgREST,
 * so nothing reaches a database or Stripe.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { inOpenGateProcess } = await import("../lib/gate-fixture.mjs");
const child = await inOpenGateProcess(`
  process.env.SUPABASE_URL = "http://retry-proof.supabase.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "retry-proof-not-a-key";
  delete process.env.VERCEL_ENV;
  const state = { signed: {}, failOrder: false };
  const { transcriptionSha256 } = await import("./src/lib/protocol-sign.ts");
  const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  const param = (url, key) => (url.searchParams.get(key) || "").replace("eq.", "");
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    const table = url.pathname.replace("/rest/v1/", "");
    if (table === "rpc/eng_line_is_trained") return json(true);
    if (table === "eng_service_orders") {
      if (state.failOrder) return json({ message: "proof: the order read failed", code: "XX000" }, 500);
      return json([{ service_slug: "foundation-inspections", tier: null }]);
    }
    if (table === "eng_seal_acts") {
      const sha = state.signed[param(url, "protocol_document") + " " + param(url, "protocol_version")];
      return json(sha ? [{ created_at: "2026-10-20T15:00:00Z", content_sha256: sha }] : []);
    }
    if (table === "eng_protocol_templates") return json([{ id: "template-" + param(url, "document_number") }]);
    return json([]);
  };
  const { duplicateStillSellable } = await import("./src/lib/ops-intake.ts");
  const { isOpen } = await import("./src/lib/launch.ts");
  const ORDER = "00000000-0000-4000-8000-0000000000f1";
  state.signed = { "254-FC-001 1.0": transcriptionSha256("254-FC-001", "1.0") };
  const whileSigned = await duplicateStillSellable(ORDER);
  state.signed = { "254-FC-001 1.0": "a different text was signed" };
  const afterVoid = await duplicateStillSellable(ORDER);
  state.signed = {};
  const unsigned = await duplicateStillSellable(ORDER);
  state.failOrder = true;
  const unreadable = await duplicateStillSellable(ORDER);
  answer({ open: isOpen(), whileSigned, afterVoid, unsigned, unreadable });
`);

check("the open-gate child really has the gate open", child.open === true);
check("while the foundation line is signed and trained, its retried order may open checkout", child.whileSigned === null, String(child.whileSigned));
check("once its signature no longer covers the text, the retry is refused", typeof child.afterVoid === "string" && child.afterVoid.length > 0, String(child.afterVoid));
check("and with no signature at all, refused", typeof child.unsigned === "string" && child.unsigned.length > 0, String(child.unsigned));
check("a failed read of the order is the shut answer, and says nothing was charged", typeof child.unreadable === "string" && /Nothing has been charged/.test(child.unreadable), String(child.unreadable));

const route = readFileSync("src/app/api/order-flow/route.ts", "utf8");
const ask = route.indexOf("const refused = await duplicateStillSellable(result.orderId);");
check(
  "/api/order-flow asks every duplicate before it opens checkout",
  /if \(result\.duplicate\) \{/.test(route) && ask > 0 && ask < route.indexOf("await startCheckout(result.orderId)"),
);
const intake = readFileSync("src/lib/ops-intake.ts", "utf8");
check(
  "and the line asked is the order's own, read from its row, never the retry's body",
  /\.select\("service_slug, tier"\)\s*\.eq\("id", orderId\)/.test(intake) && /orderBlockedNow\(catalogFor\(order\.service_slug as string/.test(intake),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: a retried web order asks its own line's money door again, and a closed line opens no checkout.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
