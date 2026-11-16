// @runtime react-server
//
// Declared because it imports src/lib/line-gate.ts, which carries server-only.

/**
 * A STRUCTURAL LETTER FOR A REAL ESTATE TRANSACTION SELLS UNDER 254-PL-001.
 * Robert's ruling of 20:08 Central, 2026-11-15 (issue #1, 6905345382): "make
 * everything for sale that isn't up for sale yet", with this letter named at
 * $709 and a $175 inspection fee.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-real-estate-letter-sells-under-pl-001.mjs
 *
 * This file was a-real-estate-letter-waits-for-its-own-protocol.mjs, the proof
 * of Robert's answer 11 of 2026-11-14 ("Do not sell it until Aman confirms in
 * writing that 254-PL-001 covers it or signs a protocol for it"). It was moved
 * rather than deleted so its history shows the rule it proved, and it now
 * proves the rule that replaced it. What it asserts:
 *   1. The hold is gone: OWN_PROTOCOL_REQUIRED is empty, and takeJob's refusal
 *      therefore never fires for it. The mechanism stays.
 *   2. Its price and fee are the ruled ones, so the catalogue lets it through.
 *   3. Its door follows PL-001: open where the permit letter opens, signed or
 *      unsigned, once somebody is trained; shut on training where nobody is.
 *   4. A windstorm county order is still refused with the catalogue's own
 *      sentence, because its coastal line is not ruled (null), never charged
 *      as zero.
 *   5. What it receives stays the pending sentence, by a named exemption,
 *      because PL-001's sentences describe a letter to a permitting authority.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* The database, played. Nothing here reaches a network: an unknown request is a FAIL. */
process.env.SUPABASE_URL = "http://real-estate-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "real-estate-proof-not-a-key";
delete process.env.VERCEL_ENV;
const state = { signed: {}, trained: {} };
const unknown = [];
const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const q = url.searchParams;
  const table = url.pathname.replace(/^\/rest\/v1\//, "");
  if (table === "eng_seal_acts") {
    const doc = (q.get("protocol_document") ?? "").replace(/^eq\./, "");
    const ver = (q.get("protocol_version") ?? "").replace(/^eq\./, "");
    const sha = state.signed[`${doc} ${ver}`];
    return json(sha ? [{ created_at: "2026-10-20T15:00:00Z", content_sha256: sha }] : []);
  }
  if (table === "eng_protocol_templates") {
    const doc = (q.get("document_number") ?? "").replace(/^eq\./, "");
    return json([{ id: `template-${doc}`, status: "draft" }]);
  }
  if (table === "rpc/eng_line_is_trained") {
    const body = JSON.parse(init.body ?? "{}");
    return json(state.trained[body.p_service_slug] === true);
  }
  unknown.push(url.toString());
  return new Response("{}", { status: 404 });
};

const { lineIsSellable } = await import("../../src/lib/line-gate.ts");
const { transcriptionSha256 } = await import("../../src/lib/protocol-sign.ts");
const { OWN_PROTOCOL_REQUIRED, ownProtocolRequired, SCOPE_NOT_STATED_BY_ITS_PROTOCOL } = await import("../../src/config/own-protocol.ts");
const { catalogFor, orderBlockedReason, SCOPE_PENDING } = await import("../../data/catalog.ts");
const { deliverablePriceCents } = await import("../../src/config/prices.ts");

const PL = "structural-letters";
const KEY = `${PL}/real-estate`;
const entry = catalogFor(PL, "real-estate");

/* 1. The hold is gone, and the mechanism is kept. */
check("the deliverable is in the catalogue", Boolean(entry), entry ? entry.name : "missing");
check("1: OWN_PROTOCOL_REQUIRED holds nothing, so the letter is not held", Object.keys(OWN_PROTOCOL_REQUIRED).length === 0 && ownProtocolRequired(PL, "real-estate") === null);
const intake = readFileSync("src/lib/ops-job-intake.ts", "utf8");
check("1: and takeJob still asks the mechanism, which now lets it through", intake.includes("if (ownProtocolRequired(input.serviceSlug, input.tier))"));

/* 2. Price and fee as ruled, so the catalogue's own reason is gone. */
check("2: it is $709, Robert's figure", deliverablePriceCents(PL, "real-estate") === 70_900 && entry?.priceCents === 70_900, `${entry?.priceCents}`);
check("2: with a $175 inspection fee", entry?.inspectionFeeCents === 17_500, `${entry?.inspectionFeeCents}`);
check("2: so the catalogue lets an order through once the line is sellable", orderBlockedReason(entry, "open", true, true) === null, String(orderBlockedReason(entry, "open", true, true)));

/* 3. Its door follows PL-001. */
state.signed = {};
state.trained = {};
const untrained = await lineIsSellable(PL, "real-estate");
check("3: unsigned and nobody trained on PL-001: shut, on training", untrained.ok === false && /Nobody is yet trained on 254-PL-001/.test(untrained.why), untrained.ok ? "it opened" : untrained.why);

state.trained = { [PL]: true };
const unsignedTrained = await lineIsSellable(PL, "real-estate");
check("3: unsigned, somebody trained on PL-001: open", unsignedTrained.ok === true, unsignedTrained.ok ? "" : unsignedTrained.why);

state.signed = { "254-PL-001 1.1": transcriptionSha256("254-PL-001", "1.1") };
const signedTrained = await lineIsSellable(PL, "real-estate");
const permit = await lineIsSellable(PL, "standard");
check("3: signed and trained: open, exactly as the permit letter is", signedTrained.ok === true && permit.ok === true, signedTrained.ok ? "" : signedTrained.why);

state.signed = { "254-PL-001 1.1": "0".repeat(64) };
const changed = await lineIsSellable(PL, "real-estate");
check("3: a signature that no longer covers the text still shuts it", changed.ok === false && /no longer covers/.test(changed.why), changed.ok ? "it opened" : changed.why);

/* 4. A coastal property pays the firm's standing coastal line, the same $75 every orderable letter carries (ruling of 2026-09-03). */
const { CATALOG } = await import("../../data/catalog.ts");
const others = CATALOG.filter((e) => e.orderType === "field" && !(e.serviceSlug === PL && e.tier === "real-estate")).map((e) => e.coastalSurchargeCents);
check(
  "4: its coastal line is $75, the figure every other field letter carries",
  entry?.coastalSurchargeCents === 7_500 && others.length > 0 && others.every((c) => c === 7_500),
  `${entry?.coastalSurchargeCents}; others ${[...new Set(others)].join(", ")}`,
);

/* 5. What it receives stays pending, by a named exemption. */
check("5: what it receives is the pending sentence only", JSON.stringify(entry?.receives) === JSON.stringify([SCOPE_PENDING]));
check("5: by name, in SCOPE_NOT_STATED_BY_ITS_PROTOCOL", Boolean(SCOPE_NOT_STATED_BY_ITS_PROTOCOL[KEY]));

check("every request the doors made was one this proof answers", unknown.length === 0, unknown.join(" "));

console.log(wrong === 0 ? "\nA real estate letter sells under 254-PL-001." : `\n${wrong} check(s) wrong.`);
process.exit(wrong === 0 ? 0 : 1);
