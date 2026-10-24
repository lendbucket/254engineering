/**
 * THE GATE COUNTS A PROTOCOL SIGNED IN THE PORTAL, AND EACH LINE STILL SELLS
 * ONLY WHEN ITS OWN SIGNATURE AND TRAINING ARE ON RECORD. ROOF SELLS THROUGH IT.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-gate-counts-a-protocol-signed-in-the-portal.mjs
 *
 * Robert's ruling 1 of 2026-10-24. The real money door, lineIsSellable(), and
 * the real protocols condition are run against a database played by a fetch
 * that answers PostgREST, in three states:
 *   a. foundation and permit unsigned: each door shut, the gate's protocols
 *      condition met, roof open;
 *   b. both signed, nobody trained: each door shut on training, the condition
 *      met, roof open;
 *   c. both signed and trained: both open, roof open.
 * Roof is $709 with the $75 coastal surcharge in every state, and its door
 * never asks the training function: its own path, exactly as it was.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* The database, played. Nothing here reaches a network: an unknown request is a FAIL. */
process.env.SUPABASE_URL = "http://gate-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "gate-proof-not-a-key";
delete process.env.VERCEL_ENV;

const state = { signed: {}, trained: {}, rc001: null };
const asked = [];
const unknown = [];
const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const q = url.searchParams;
  const table = url.pathname.replace(/^\/rest\/v1\//, "");
  asked.push(table);
  if (table === "eng_seal_acts") {
    const doc = (q.get("protocol_document") ?? "").replace(/^eq\./, "");
    const ver = (q.get("protocol_version") ?? "").replace(/^eq\./, "");
    const sha = state.signed[`${doc} ${ver}`];
    return json(sha ? [{ created_at: "2026-10-20T15:00:00Z", content_sha256: sha }] : []);
  }
  if (table === "eng_protocol_templates") {
    const doc = (q.get("document_number") ?? "").replace(/^eq\./, "");
    if (doc === "254-RC-001") return json(state.rc001 ? [state.rc001] : []);
    return json([{ id: `template-${doc}` }]);
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
const { LAUNCH_CONDITIONS, lineHasProtocolInForce, linesWithNobodyTrained } = await import("../../src/lib/launch.ts");
const { offeredServiceLines } = await import("../../src/config/launch-conditions.ts");
const { catalogFor } = await import("../../data/catalog.ts");
const { protocolForLine } = await import("../../src/content/protocols/index.ts");
const { verifiedEngineers } = await import("../../src/config/credentials.ts");

const ROOF = "roof-inspections";
const FC = "foundation-inspections";
const PL = "structural-letters";

/* The premise: the state this proof is about is the one configuration holds. */
check("the premise: roof, foundation and permit are the offered lines", [ROOF, FC, PL].every((s) => offeredServiceLines.includes(s)), offeredServiceLines.join(", "));
check("the premise: FC-001 and PL-001 have transcriptions he signs from", Boolean(transcriptionSha256("254-FC-001", "1.0")) && Boolean(transcriptionSha256("254-PL-001", "1.1")));

/* Roof's record, as its own path reads it. */
const rc = protocolForLine(ROOF);
const rcCurrent = rc.versions.find((v) => v.supersededOn === null);
state.rc001 = {
  version_label: rc.declaration.version,
  status: "published",
  approved_by: "engineer",
  approved_by_license: verifiedEngineers[0]?.licenseNumber ?? null,
  document_sha256: rcCurrent.sha256,
};

const protocols = LAUNCH_CONDITIONS.find((c) => c.id === "protocols");
check("the gate carries a protocols condition", Boolean(protocols));

async function roofEveryTime(label) {
  const roof = await lineIsSellable(ROOF, "standard");
  check(`${label}: roof is open at its door`, roof.ok === true, roof.ok ? "" : roof.why);
  const entry = catalogFor(ROOF, "standard");
  check(`${label}: roof is $709 with the $75 coastal surcharge`, entry?.priceCents === 70_900 && entry?.coastalSurchargeCents === 7_500, `${entry?.priceCents} and ${entry?.coastalSurchargeCents}`);
  check(`${label}: the gate's protocols condition is met, so roof is not held behind the other lines`, protocols.unmet() === null, protocols.unmet() ?? "");
}

/* a. Unsigned. */
state.signed = {};
state.trained = {};
for (const slug of [FC, PL]) {
  const s = await lineIsSellable(slug, null);
  check(`a: ${slug} unsigned keeps its own door shut`, s.ok === false && /has not been signed/.test(s.why), s.ok ? "it opened" : s.why);
}
await roofEveryTime("a");

/* b. Signed, nobody trained. */
state.signed = {
  "254-FC-001 1.0": transcriptionSha256("254-FC-001", "1.0"),
  "254-PL-001 1.1": transcriptionSha256("254-PL-001", "1.1"),
};
state.trained = {};
for (const slug of [FC, PL]) {
  const s = await lineIsSellable(slug, null);
  check(`b: ${slug} signed but untrained keeps its own door shut`, s.ok === false && /Nobody is yet trained/.test(s.why), s.ok ? "it opened" : s.why);
}
await roofEveryTime("b");

/* A signature that no longer covers the text closes the line too. */
state.signed = { "254-FC-001 1.0": "0".repeat(64) };
const voided = await lineIsSellable(FC, null);
check("a signature over different text keeps the door shut", voided.ok === false && /no longer covers/.test(voided.why), voided.ok ? "it opened" : voided.why);

/* c. Signed and trained. */
state.signed = {
  "254-FC-001 1.0": transcriptionSha256("254-FC-001", "1.0"),
  "254-PL-001 1.1": transcriptionSha256("254-PL-001", "1.1"),
};
state.trained = { [FC]: true, [PL]: true };
for (const slug of [FC, PL]) {
  const s = await lineIsSellable(slug, null);
  check(`c: ${slug} signed and trained opens`, s.ok === true, s.ok ? "" : s.why);
  const entry = catalogFor(slug);
  check(`c: ${slug} is $709 with the same $75 coastal surcharge as roof`, entry?.priceCents === 70_900 && entry?.coastalSurchargeCents === 7_500, `${entry?.priceCents} and ${entry?.coastalSurchargeCents}`);
}
await roofEveryTime("c");

/* Roof's path is its own, and training stays at the door. */
asked.length = 0;
state.trained = {};
await lineIsSellable(ROOF, "standard");
check("roof's door never asks the training function", !asked.includes("rpc/eng_line_is_trained"), asked.join(", "));
check("a line with no protocol at all is not counted", lineHasProtocolInForce("custom-package") === false && lineHasProtocolInForce(ROOF) && lineHasProtocolInForce(FC) && lineHasProtocolInForce(PL));
check("the gate's training condition still reads only roof's register, unchanged", JSON.stringify(linesWithNobodyTrained()) === "[]" && /const protocol = registeredProtocolFor\(slug\);/.test(readFileSync("src/lib/launch.ts", "utf8")));
check("every request the doors made was one this proof answers", unknown.length === 0, unknown.join(" "));

/*
 * ROBERT'S THREE CONDITIONS OF 2026-10-24, WITH THE GATE GENUINELY OPEN. For an
 * unsigned line: it is not offered on /order; its money door refuses before any
 * order or payment is created; roof stays orderable at $709 throughout. Run in a
 * child process with every gate condition met (the gate fixture), against the
 * same played database, recording every write and every Stripe request.
 */
const { inOpenGateProcess } = await import("../lib/gate-fixture.mjs");
const child = await inOpenGateProcess(`
  process.env.SUPABASE_URL = "http://gate-proof.supabase.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "gate-proof-not-a-key";
  delete process.env.VERCEL_ENV;
  const state = { signed: {}, trained: {} };
  const writes = [];
  const stripe = [];
  const { transcriptionSha256 } = await import("./src/lib/protocol-sign.ts");
  const { protocolForLine } = await import("./src/content/protocols/index.ts");
  const { verifiedEngineers } = await import("./src/config/credentials.ts");
  const rc = protocolForLine("roof-inspections");
  const rcRow = {
    version_label: rc.declaration.version, status: "published", approved_by: "engineer",
    approved_by_license: verifiedEngineers[0] ? verifiedEngineers[0].licenseNumber : null,
    document_sha256: rc.versions.find((v) => v.supersededOn === null).sha256,
  };
  const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  const param = (url, key) => (url.searchParams.get(key) || "").replace("eq.", "");
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    const method = (init.method || "GET").toUpperCase();
    if (url.hostname.includes("stripe")) { stripe.push(method + " " + url.pathname); return json({}, 500); }
    const table = url.pathname.replace("/rest/v1/", "");
    if (table === "rpc/eng_line_is_trained") return json(state.trained[JSON.parse(init.body || "{}").p_service_slug] === true);
    if (method !== "GET" && method !== "HEAD") { writes.push(method + " " + table); return json([], 201); }
    if (table === "eng_seal_acts") {
      const sha = state.signed[param(url, "protocol_document") + " " + param(url, "protocol_version")];
      return json(sha ? [{ created_at: "2026-10-20T15:00:00Z", content_sha256: sha }] : []);
    }
    if (table === "eng_protocol_templates") {
      const doc = param(url, "document_number");
      return json(doc === "254-RC-001" ? [rcRow] : [{ id: "template-" + doc }]);
    }
    return json([]);
  };
  const { isOpen } = await import("./src/lib/launch.ts");
  const { sellableLineOffers } = await import("./src/lib/line-gate.ts");
  const { placeOrder } = await import("./src/lib/ops-intake.ts");
  const pick = (offers) => offers.filter((o) => ["roof-inspections", "foundation-inspections", "structural-letters"].includes(o.slug))
    .map((o) => ({ slug: o.slug, orderable: o.orderable, href: o.href, price: o.price }));
  const unsigned = pick(await sellableLineOffers());
  /* The price sentence each row prints, rendered as /order renders it, with that row's own answer. */
  const { PublishedPrice } = await import("./src/components/services/PublishedPrice.tsx");
  const priceText = (row) => [].concat(PublishedPrice({ slug: row.slug, orderable: row.orderable }).props.children).join("");
  const unsignedPriceText = Object.fromEntries(unsigned.map((row) => [row.slug, priceText(row)]));
  const refused = await placeOrder({
    site: "254engineering", clientRequestId: "gate-proof-unsigned-1", serviceSlug: "foundation-inspections",
    customer: { name: "Gate proof, not a real person", email: "gate-proof@audit-probe.invalid", phone: "3615550100" },
    property: { address: "1 Proof Way", city: "Corpus Christi", county: "Nueces" }, answers: [],
  });
  const writesAfterRefusal = [...writes];
  state.signed = {
    "254-FC-001 1.0": transcriptionSha256("254-FC-001", "1.0"),
    "254-PL-001 1.1": transcriptionSha256("254-PL-001", "1.1"),
  };
  state.trained = { "foundation-inspections": true, "structural-letters": true };
  const signed = pick(await sellableLineOffers());
  answer({ open: isOpen(), unsigned, unsignedPriceText, signed, refused, writesAfterRefusal, stripe });
`);
const by = (rows, slug) => rows.find((o) => o.slug === slug) ?? {};
check("the open-gate child really has the gate open, so the rows below are not the shut gate's quote rows", child.open === true);
check(
  "/order: an unsigned foundation line is not offered, a quote with no price and no checkout link",
  by(child.unsigned, FC).orderable === false && by(child.unsigned, FC).price === null && !String(by(child.unsigned, FC).href).startsWith("/order/start/"),
  JSON.stringify(by(child.unsigned, FC)),
);
check("/order: nor is an unsigned permit line", by(child.unsigned, PL).orderable === false && by(child.unsigned, PL).price === null, JSON.stringify(by(child.unsigned, PL)));
check(
  "/order: roof is offered at $709 while they are unsigned",
  by(child.unsigned, ROOF).orderable === true && by(child.unsigned, ROOF).price === "$709" && by(child.unsigned, ROOF).href === "/order/start/roof-inspections",
  JSON.stringify(by(child.unsigned, ROOF)),
);
/*
 * EVERY ROW ON /order PRINTS ITS PUBLISHED PRICE (ruling 5 of 2026-10-18), so the
 * price sentence must also say the unsigned line is a quote. Configuration alone
 * calls it orderable; /order passes the door's answer to the component.
 */
const QUOTED = "Quoted at this price until it can be ordered online.";
check(
  "/order: the unsigned lines' prices say they are quoted, and roof's does not",
  [FC, PL].every((s) => String(child.unsignedPriceText?.[s]).includes(QUOTED)) && !String(child.unsignedPriceText?.[ROOF]).includes(QUOTED),
  JSON.stringify(child.unsignedPriceText),
);
check("and /order hands each row's own answer to the price", /<PublishedPrice slug=\{offer\.slug\} orderable=\{offer\.orderable\} \/>/.test(readFileSync("src/app/(site)/order/page.tsx", "utf8")));
check(
  "an order for the unsigned line is refused at its money door",
  child.refused?.ok === false && child.refused?.field === "serviceSlug",
  JSON.stringify(child.refused),
);
check("and before it, nothing was written and no payment was asked of Stripe", child.writesAfterRefusal.length === 0 && child.stripe.length === 0, `${child.writesAfterRefusal.join(", ")} | ${child.stripe.join(", ")}`);
check(
  "once signed and trained, both are offered at $709, and roof still is",
  [FC, PL, ROOF].every((s) => by(child.signed, s).orderable === true && by(child.signed, s).price === "$709"),
  JSON.stringify(child.signed),
);
const orderPage = readFileSync("src/app/(site)/order/page.tsx", "utf8");
check("/order reads its rows from sellableLineOffers and renders per request", /const offers = await sellableLineOffers\(\);/.test(orderPage) && /export const dynamic = "force-dynamic";/.test(orderPage));

console.log("");
if (wrong === 0) {
  console.log("PASS: the gate counts a portal-signed protocol, each line sells only on its own signature and training, and roof sells throughout.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
