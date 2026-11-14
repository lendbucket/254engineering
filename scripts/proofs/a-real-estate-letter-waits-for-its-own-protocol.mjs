// @runtime react-server
//
// Declared because it imports src/lib/line-gate.ts, which carries server-only.

/**
 * A STRUCTURAL LETTER FOR A REAL ESTATE TRANSACTION IS NOT SOLD ON 254-PL-001'S
 * SIGNATURE. Robert's answer 11 of 2026-11-14: "Do not sell it until Aman
 * confirms in writing that 254-PL-001 covers it or signs a protocol for it."
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-real-estate-letter-waits-for-its-own-protocol.mjs
 *
 * The gate falls back from a deliverable with no protocol of its own to its
 * line's general one, so without the hold this letter would open the moment
 * the permit letter does. The proof plays the database in the one state where
 * that matters: PL-001 signed over its text and somebody trained on it, so the
 * permit letter's real door OPENS. The real estate letter's door, asked of the
 * same rows, must stay shut naming the hold, and must not even read a
 * signature, because borrowing one is the thing refused.
 *
 * The catalogue's own refusal is no evidence here: it refuses this entry for
 * its unset inspection fee, which would hold with the gate hold deleted. So
 * the door is asked, and takeJob is read for the refusal coming first.
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
const { OWN_PROTOCOL_REQUIRED, ownProtocolRequired } = await import("../../src/config/own-protocol.ts");
const { SIGNABLE_PROTOCOLS } = await import("../../src/content/protocols/signable.ts");
const { catalogFor } = await import("../../data/catalog.ts");
const { deliverablePriceCents } = await import("../../src/config/prices.ts");

const PL = "structural-letters";
const KEY = `${PL}/real-estate`;

/* The premise: the state this proof is about. */
const entry = catalogFor(PL, "real-estate");
check("the premise: the deliverable is in the catalogue", Boolean(entry), entry ? entry.name : "missing");
check("the premise: it is $709, Robert's figure", deliverablePriceCents(PL, "real-estate") === 70_900 && entry?.priceCents === 70_900, `${entry?.priceCents}`);
check("the premise: it is held in configuration", Boolean(OWN_PROTOCOL_REQUIRED[KEY]) && ownProtocolRequired(PL, "real-estate") === OWN_PROTOCOL_REQUIRED[KEY]);
check(
  "the premise: no protocol is registered for its exact tier, so the hold is what decides",
  !SIGNABLE_PROTOCOLS.some((p) => p.serviceSlug === PL && p.serviceTier === "real-estate"),
);
check("the premise: PL-001 1.1 has a transcription he signs from", Boolean(transcriptionSha256("254-PL-001", "1.1")));

/* PL-001 signed and trained: the permit letter's own door opens. */
state.signed = { "254-PL-001 1.1": transcriptionSha256("254-PL-001", "1.1") };
state.trained = { [PL]: true };
const permit = await lineIsSellable(PL, "standard");
check("with PL-001 signed and trained, the permit letter opens", permit.ok === true, permit.ok ? "" : permit.why);

asked.length = 0;
const realEstate = await lineIsSellable(PL, "real-estate");
check(
  "the real estate letter stays shut on the same rows, naming the hold",
  realEstate.ok === false && realEstate.why === OWN_PROTOCOL_REQUIRED[KEY],
  realEstate.ok ? "it opened on PL-001" : realEstate.why,
);
check("and it is a refusal, not a failed read", realEstate.ok === false && realEstate.unreadable === false);
check(
  "and a customer reads that it is not available to order yet",
  realEstate.ok === false && /not available to order yet/.test(realEstate.says ?? ""),
  realEstate.ok ? "" : realEstate.says ?? "no sentence",
);
check("and its door read no signature, because borrowing PL-001's is what is refused", !asked.includes("eng_seal_acts"), asked.join(", ") || "nothing read");

/* The telephone door: takeJob refuses before it creates anything. */
const intake = readFileSync("src/lib/ops-job-intake.ts", "utf8");
const takeJobAt = intake.indexOf("export async function takeJob");
const holdAt = intake.indexOf("if (ownProtocolRequired(input.serviceSlug, input.tier))", takeJobAt);
const createAt = intake.indexOf("createFile(", takeJobAt);
check(
  "takeJob refuses a held deliverable before it creates a file",
  takeJobAt >= 0 && holdAt > takeJobAt && createAt > holdAt,
  `takeJob ${takeJobAt}, hold ${holdAt}, createFile ${createAt}`,
);

check("every request the doors made was one this proof answers", unknown.length === 0, unknown.join(" "));

console.log(wrong === 0 ? "\nA real estate letter waits for its own protocol." : `\n${wrong} check(s) wrong.`);
process.exit(wrong === 0 ? 0 : 1);
