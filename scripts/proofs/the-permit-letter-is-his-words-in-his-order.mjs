/**
 * THE PERMIT LETTER IS HIS WORDS, IN HIS ORDER, AND THE DRAFT TAKES ITS BASIS
 * ONLY FROM THE TRIAGE RECORD.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-permit-letter-is-his-words-in-his-order.mjs
 *
 * the-permit-letter-takes-its-option.mjs proves the three option sentences.
 * This proves the rest of template 7 (section 8.4): the head, the opening, the
 * quoted requirement, the two basis sentences and the limitations, word for
 * word and in his order, against the engineer's answered file; and then the
 * pure draft (src/lib/letter-draft-fc-pl.ts): a site job prints the visit
 * sentence, a desk job the no visit sentence and his desk only limitation, no
 * triage drafts nothing (PL-4), a desk job lists the documents he relied on and
 * option B its conditions (PL-5), and a decline drafts nothing.
 */
import { documentText, ensurePrivateSources, squash } from "../lib/protocol-source.mjs";

const { ROOF_LETTER_SOURCE } = await import("../../src/content/letters/roof-certification.ts");
const L = await import("../../src/content/letters/structural-letter.ts");
const { draftPermitLetter } = await import("../../src/lib/letter-draft-fc-pl.ts");
const { PRIVATE_SOURCES, PROTOCOL_SOURCE_BUCKET } = await import("../../src/content/protocols/private-sources.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const [fetched] = await ensurePrivateSources(PRIVATE_SOURCES.filter((s) => s.path === ROOF_LETTER_SOURCE), PROTOCOL_SOURCE_BUCKET);
if (!fetched || fetched.unreachable) {
  console.log(`COULD NOT TELL: ${fetched?.why ?? "the letter templates are in no PRIVATE_SOURCES entry"}.`);
  process.exit(3);
}
check("the letter templates are the engineer's file, by SHA-256 and size", fetched.ok, fetched.why ?? fetched.how);
const read = documentText(ROOF_LETTER_SOURCE);
if (!read.ok) {
  console.log(`COULD NOT TELL: the template file was not read, because ${read.why}.`);
  process.exit(1);
}
const start = read.text.indexOf("Template 7 of 8: Structural letter for permit\n");
const end = read.text.indexOf("Template 8 of 8: ", start + 1);
check("section 8 of the document was found, so the comparison reads template 7", start > 0 && end > start, `${start} to ${end}`);
const section = squash(read.text.slice(start, end));

/* His order: head, opening, requirement, basis (visit, then no visit), limitations (first, desk only, the rest). */
const ordered = [
  ...L.STRUCTURAL_LETTER_HEAD,
  ...L.STRUCTURAL_LETTER_OPENING,
  L.STRUCTURAL_LETTER_REQUIREMENT,
  L.STRUCTURAL_LETTER_BASIS.visit,
  L.STRUCTURAL_LETTER_BASIS.noVisit,
  L.STRUCTURAL_LETTER_LIMITATIONS.always[0],
  ...L.STRUCTURAL_LETTER_LIMITATIONS.deskOnly,
  ...L.STRUCTURAL_LETTER_LIMITATIONS.always.slice(1),
];
let at = 0;
const missing = [];
const outOfOrder = [];
for (const t of ordered) {
  const k = section.indexOf(squash(t), at);
  if (k < 0) (section.includes(squash(t)) ? outOfOrder : missing).push(t.slice(0, 50));
  else at = k + squash(t).length;
}
check("every fixed line of the letter is in his section 8.4, word for word", missing.length === 0, missing.length ? `NOT IN THE DOCUMENT: ${missing.join(" | ")}` : `${ordered.length} lines`);
check("and in his order", outOfOrder.length === 0, outOfOrder.join(" | "));

/* The draft. */
const facts = {
  determination_date: "October 23, 2026", authority_name: "City of Nowhere", authority_address: "1 Main St, Nowhere TX",
  authority_salutation: "Building Official", element_described: "the new beam over the kitchen opening", property_address: "1 Fictional Way",
  county: "Fictional", permit_number: "BP-1", file_number: "254-X-1", requestor_name: "Proof Requestor",
  authority_requirement_verbatim: "Provide an engineer's letter for the beam.", visit_date: "October 20, 2026", evidence_count: "12",
};
const site = draftPermitLetter({ determination: "pass", option: "A", conditions: [], basis: "site", documents: [], facts });
const text = (d) => (d.ok ? d.lines.map((l) => l.text).join("\n") : "");
check("a site job prints the visit sentence and not the no visit one", site.ok && text(site).includes("was inspected on October 20, 2026") && !text(site).includes("No site visit was made"), site.ok ? "" : site.why);
const desk = draftPermitLetter({ determination: "pass", option: "A", conditions: [], basis: "desk", documents: ["Beam calculation by the supplier"], facts: { ...facts, visit_date: null, evidence_count: null } });
check("a desk job prints the no visit sentence, his desk only limitation, and the documents he relied on", desk.ok && (text(desk).match(/No site visit was made/g) ?? []).length === 2 && text(desk).includes("Beam calculation by the supplier"), desk.ok ? "" : desk.why);
const deskNoDocs = draftPermitLetter({ determination: "pass", option: "A", conditions: [], basis: "desk", documents: [], facts });
check("a desk job with no documents relied on drafts nothing", !deskNoDocs.ok && deskNoDocs.missing.includes("documents_schedule"));
const untriaged = draftPermitLetter({ determination: "pass", option: "A", conditions: [], basis: null, documents: [], facts });
check("no triage on record drafts nothing: the basis comes only from it (PL-4)", !untriaged.ok && untriaged.missing.includes("triage"));
const b = draftPermitLetter({ determination: "pass", option: "B", conditions: ["Live load limited to 40 psf."], basis: "site", documents: [], facts });
check("option B lists its conditions in the schedule", b.ok && text(b).includes("Conditions:") && text(b).includes("Live load limited to 40 psf."));
const c = draftPermitLetter({ determination: "repairs-required", option: "C", conditions: [], basis: "site", documents: [], facts });
check("repairs required prints option C", c.ok && text(c).includes("does not satisfy the requirement stated above"));
const declined = draftPermitLetter({ determination: "decline", option: null, conditions: [], basis: "site", documents: [], facts });
check("a decline drafts no letter", !declined.ok);
const noPermit = draftPermitLetter({ determination: "pass", option: "A", conditions: [], basis: "site", documents: [], facts: { ...facts, permit_number: "" } });
check("a letter with no permit number drafts nothing, never a blank", !noPermit.ok && noPermit.missing.includes("permit_number"));

console.log("");
if (wrong === 0) {
  console.log("PASS: the permit letter is his words in his order, and its basis comes only from the triage record.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
