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

console.log("");
if (wrong === 0) {
  console.log("PASS: the gate counts a portal-signed protocol, each line sells only on its own signature and training, and roof sells throughout.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
