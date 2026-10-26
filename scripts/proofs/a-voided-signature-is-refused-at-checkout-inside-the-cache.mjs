// @runtime react-server
//
// Declared because it imports src/lib/line-gate.ts, which carries server-only.

/**
 * A VOIDED SIGNATURE IS REFUSED AT CHECKOUT INSIDE THE CACHE WINDOW, EVEN WHILE
 * /order STILL SHOWS THE LINE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-voided-signature-is-refused-at-checkout-inside-the-cache.mjs
 *
 * Robert, 2026-10-25, from the Ahrefs crawl: /order and /order/start/* read the
 * signed record for every line on every request (1.4 s and 1.1 s to first
 * byte). The answer those pages DISPLAY is now kept for at most 60 seconds. The
 * money door stays a live read every time, ruling 11.
 *
 * Against a fake PostgREST holding one signed protocol, 254-PL-001 v1.1 for
 * structural letters, which configuration offers. The display answer is read
 * (and kept), the signature is then voided, and inside the window:
 *   - the display still shows the line (the cache is doing its job), and
 *   - orderBlockedNow, which placeOrder calls before it takes money, refuses.
 * Then: an unreadable answer is never kept, the window is 60 seconds and no
 * more, and placeOrder still asks orderBlockedNow.
 *
 * Nothing reaches a database.
 */
process.env.SUPABASE_URL = "http://display-cache-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "display-cache-proof-not-a-key";
delete process.env.VERCEL_ENV;

import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const SLUG = "structural-letters";
const DOC = "254-PL-001";
const VERSION = "1.1";

const { transcriptionSha256 } = await import("../../src/lib/protocol-sign.ts");
const SHA = transcriptionSha256(DOC, VERSION);
check("the proof's protocol has a transcription to sign", typeof SHA === "string" && SHA.length === 64, String(SHA));

const state = { voided: false, failReads: false, sealReads: 0 };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const one = (req, rows) => {
  const accept = (req.headers?.get?.("accept") ?? "").toLowerCase();
  if (accept.includes("vnd.pgrst.object")) return rows.length ? json(rows[0]) : json({ code: "PGRST116", message: "0 rows" }, 406);
  return json(rows);
};
globalThis.fetch = async (input, init) => {
  const req = new Request(input, init);
  const url = new URL(req.url);
  const path = url.pathname.replace("/rest/v1/", "");
  if (path === "eng_seal_acts") {
    state.sealReads += 1;
    if (state.failReads) return json({ message: "proof: the database is paused", code: "XX000" }, 503);
    return one(req, state.voided ? [] : [{ created_at: "2026-10-20T15:00:00Z", content_sha256: SHA }]);
  }
  if (path === "eng_protocol_templates") return one(req, [{ id: "00000000-0000-4000-8000-0000000000c1" }]);
  if (path === "rpc/eng_line_is_trained") return json(true);
  return json([]);
};

const gate = await import("../../src/lib/line-gate.ts");
const { deliverablesFor } = await import("../../data/catalog.ts");
const entry = deliverablesFor(SLUG).find((d) => d.orderType !== "quote") ?? deliverablesFor(SLUG)[0];
check("the line has a deliverable to order", Boolean(entry), entry ? `${entry.serviceSlug} ${entry.tier ?? ""}` : "none");

const before = await gate.lineIsSellableForDisplay(SLUG, entry.tier);
check("signed: the display shows the line as orderable", before.ok === true, JSON.stringify(before));
const atCheckoutBefore = await gate.orderBlockedNow(entry, "open");
check("signed: checkout lets the order through", atCheckoutBefore === null, String(atCheckoutBefore));

state.voided = true;
const readsBefore = state.sealReads;
const shown = await gate.lineIsSellableForDisplay(SLUG, entry.tier);
check("voided, inside the window: the display still shows the line, from the kept answer", shown.ok === true && state.sealReads === readsBefore, `reads ${state.sealReads - readsBefore}`);
const shownStart = await gate.orderBlockedForDisplay(entry, "open");
check("and /order/start's display answer still shows it", shownStart === null, String(shownStart));

const atCheckout = await gate.orderBlockedNow(entry, "open");
check(
  "voided, inside the window: checkout refuses, reading the signed record live",
  typeof atCheckout === "string" && atCheckout.length > 0 && state.sealReads > readsBefore,
  String(atCheckout),
);

/* An unreadable answer is never kept. */
state.voided = false;
const realNow = Date.now;
Date.now = () => realNow() + gate.DISPLAY_ANSWER_MS + 1;
state.failReads = true;
const unreadable = await gate.lineIsSellableForDisplay(SLUG, entry.tier);
check("after the window, a failed read closes the line on display and says it could not tell", unreadable.ok === false && unreadable.unreadable === true, JSON.stringify(unreadable));
state.failReads = false;
const recovered = await gate.lineIsSellableForDisplay(SLUG, entry.tier);
check("and is not kept: the next request asks again and reopens it", recovered.ok === true, JSON.stringify(recovered));

/* The window is 60 seconds and no more. */
check("the display window is 60 seconds", gate.DISPLAY_ANSWER_MS === 60_000, String(gate.DISPLAY_ANSWER_MS));
state.voided = true;
Date.now = () => realNow() + 2 * gate.DISPLAY_ANSWER_MS + 2;
const expired = await gate.lineIsSellableForDisplay(SLUG, entry.tier);
check("past 60 seconds the display reads again and shows the void", expired.ok === false, JSON.stringify(expired));
Date.now = realNow;

/* placeOrder, the checkout, still asks the live door. */
const intake = readFileSync("src/lib/ops-intake.ts", "utf8");
const place = intake.slice(intake.indexOf("export async function placeOrder("), intake.indexOf("export async function placeOrder(") + 4000);
check("placeOrder asks orderBlockedNow, never the display answer", /await orderBlockedNow\(entry, launchMode\(\)\)/.test(place) && !/ForDisplay\(/.test(place));

console.log("");
if (wrong === 0) {
  console.log("PASS: a voided signature is refused at checkout inside the cache window, while the display may still show the line.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
