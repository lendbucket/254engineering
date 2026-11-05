// @runtime react-server
//
// Declared because it imports src/lib/letter-seal.ts, which carries server-only.

/**
 * A LETTER COUNTS THE STANDING EVIDENCE, AND A LETTER THAT PRINTS A COUNT
 * REFUSES WHEN NONE STANDS.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-letter-counts-the-standing-evidence-and-refuses-none.mjs
 *
 * Robert's ruling Q1 of 2026-11-02, from audit field F1: "Count standing
 * evidence (not revision_requested) and refuse a draft at zero. Re-check every
 * live letter template's count line." The count had been the 'accepted' rows,
 * and nothing in the platform ever writes 'accepted', so every sealed letter
 * would have read "0 items of evidence were recorded".
 *
 *   A  the count is every row not sent back: submitted and accepted stand,
 *      revision_requested does not
 *   B  a file with no standing evidence gives the count slot null, never "0"
 *   C  every live template that prints {{evidence_count}} refuses a null count
 *      by name: roof, foundation, manufactured home, solar, and the permit
 *      letter on a site basis; the permit letter on a desk basis prints no
 *      count and still drafts with none
 *   D  nothing in letter-seal.ts counts 'accepted' any more, and no count slot
 *      is filled with a bare String(...)
 *
 * Against a fake PostgREST. Nothing reaches a database.
 */
process.env.SUPABASE_URL = "http://letter-count-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "letter-count-proof-not-a-key";
delete process.env.VERCEL_ENV;

import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { protocolByDocument } = await import("../../src/content/protocols/index.ts");
const roof = protocolByDocument("254-RC-001");
const FILE = "00000000-0000-4000-8000-00000000ee01";
const TEMPLATE = "00000000-0000-4000-8000-00000000ee02";
let EVIDENCE = [];
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const table = url.pathname.replace("/rest/v1/", "");
  if (table === "eng_files") {
    return json([{ id: FILE, file_number: "254-PROOF-Q1", property_address: "1 Proof Way", county: "Nueces", client_id: null, protocol_template_id: TEMPLATE }]);
  }
  if (table === "eng_protocol_templates") return json([{ document_number: "254-RC-001", version_label: roof.declaration.version }]);
  if (table === "eng_evidence_items") return json(EVIDENCE);
  return json([]);
};

const { letterFactsFor, evidenceCountSlot } = await import("../../src/lib/letter-seal.ts");
const { draftRoofLetter } = await import("../../src/lib/letter-draft.ts");
const { draftFoundationLetter, draftPermitLetter } = await import("../../src/lib/letter-draft-fc-pl.ts");
const { draftManufacturedHomeLetter, draftSolarLetter } = await import("../../src/lib/letter-draft-mh-sl.ts");
const { FOUNDATION_LETTER_SLOTS } = await import("../../src/content/letters/foundation-certification.ts");
const { MANUFACTURED_HOME_LETTER_SLOTS } = await import("../../src/content/letters/manufactured-home-certification.ts");
const { SOLAR_LETTER_SLOTS } = await import("../../src/content/letters/solar-structural-letter.ts");

const det = { id: "det-q1", file_id: FILE, protocol_document: "254-RC-001", determination: "pass", engineer_id: "eng-q1", decided_at: "2026-10-22T15:00:00Z", letter_option: null, letter_conditions: null, relied_on_evidence_ids: null };
const entered = { recipientAddress: "1 Proof Way", recipientSalutation: "Dear Proof" };
const row = (status, day) => ({ captured_at: `2026-10-${day}T15:00:00Z`, created_at: `2026-10-${day}T15:05:00Z`, status });

/* A */
EVIDENCE = [row("submitted", 20), row("submitted", 20), row("accepted", 21), row("revision_requested", 19)];
const standing = await letterFactsFor(det, entered);
check("submitted and accepted rows stand and are counted; a sent-back row is not", standing.ok === true && standing.facts.evidence_count === "3", standing.ok ? standing.facts.evidence_count : standing.error);
EVIDENCE = [row("submitted", 20)];
const one = await letterFactsFor(det, entered);
check("one submitted capture counts as one, though nothing ever marks it accepted", one.ok === true && one.facts.evidence_count === "1", one.ok ? one.facts.evidence_count : one.error);

/* B */
check("evidenceCountSlot gives null for none, never \"0\"", evidenceCountSlot(0) === null && evidenceCountSlot(5) === "5", String(evidenceCountSlot(0)));
EVIDENCE = [row("revision_requested", 20), row("revision_requested", 21)];
const sentBack = await letterFactsFor(det, entered);
check("a file whose every item was sent back gives a null count slot", sentBack.ok === true && sentBack.facts.evidence_count === null, sentBack.ok ? String(sentBack.facts.evidence_count) : sentBack.error);
EVIDENCE = [];
const none = await letterFactsFor(det, entered);
check("a file with no evidence at all gives a null count slot", none.ok === true && none.facts.evidence_count === null, none.ok ? String(none.facts.evidence_count) : none.error);

/* C */
const filled = (slots) => Object.fromEntries(slots.map((s) => [s, "x"]));
const refusesCount = (draft) => draft.ok === false && draft.missing.includes("evidence_count");
if (none.ok) {
  const roofDraft = draftRoofLetter("pass", none.facts);
  check("the roof letter refuses a null count by name", refusesCount(roofDraft), roofDraft.ok ? "drafted" : roofDraft.why);
}
check("the foundation letter refuses a null count by name", refusesCount(draftFoundationLetter("pass", { ...filled(FOUNDATION_LETTER_SLOTS), evidence_count: null }, "Observed condition recorded at review")));
check("the manufactured home letter refuses a null count by name", refusesCount(draftManufacturedHomeLetter("pass", { ...filled(MANUFACTURED_HOME_LETTER_SLOTS), evidence_count: null })));
check("the solar letter refuses a null count by name", refusesCount(draftSolarLetter("pass", { ...filled(SOLAR_LETTER_SLOTS), evidence_count: null }, null)));
const permitFacts = {
  determination_date: "x", authority_name: "x", authority_address: "x", authority_salutation: "x", element_described: "x",
  property_address: "x", county: "x", permit_number: "x", file_number: "x", requestor_name: "x", authority_requirement_verbatim: "x",
  visit_date: "x", evidence_count: null,
};
check("the permit letter on a site basis refuses a null count by name", refusesCount(draftPermitLetter({ determination: "pass", option: "A", conditions: [], basis: "site", documents: [], facts: permitFacts })));
const desk = draftPermitLetter({ determination: "pass", option: "A", conditions: [], basis: "desk", documents: ["Beam calculation"], facts: { ...permitFacts, visit_date: null } });
check("the permit letter on a desk basis prints no count and still drafts with none", desk.ok === true, desk.ok ? "" : desk.why);

/* D */
const seal = readFileSync("src/lib/letter-seal.ts", "utf8");
check("nothing in letter-seal.ts counts 'accepted' evidence", !/status === "accepted"/.test(seal));
check("the count is every row not sent back", /count: evidence\.filter\(\(e\) => e\.status !== "revision_requested"\)\.length,/.test(seal));
const slots = [...seal.matchAll(/evidence_count: ([^,\n]+),/g)].map((m) => m[1]);
check("every count slot is filled through evidenceCountSlot (4 drafters)", slots.length === 4 && slots.every((s) => s.startsWith("evidenceCountSlot(")), slots.join(" | "));

console.log(
  wrong === 0
    ? "PASS: a letter counts the standing evidence, and every template that prints a count refuses when none stands."
    : `FAIL: ${wrong} check(s) above.`,
);
process.exitCode = wrong === 0 ? 0 : 1;
