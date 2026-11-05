// @runtime react-server
//
// Declared because it imports src/lib/letter-seal.ts, which carries server-only.

/**
 * A VISIT DATE FROM AN UNCERTAIN CLOCK IS THE SERVER'S RECEIPT, AND THE ROOF
 * LETTER SAYS SO IN THE PROTOCOL'S OWN WORDS.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-visit-date-from-an-uncertain-clock-is-the-receipt.mjs
 *
 * Robert's ruling F9 of 2026-11-02: "do not refuse the draft. When the visit
 * capture's clock disagreed or was never measured, the letter states the
 * inspection date from the server's receipt of the first standing capture,
 * which is a recorded fact, and uses the protocol's own wording that the
 * device time was recorded as disagreeing. A draft is refused only if no
 * standing capture has a receipt time." His answer of 2026-11-03: "F9: yes,
 * template v1.1".
 *
 *   A  a clock recorded as disagreeing: the visit date is the first standing
 *      receipt, in Texas, and RC-001 section 9's line follows the visit sentence
 *   B  a clock never measured: the same
 *   C  a disagreeing clock that would have failed the L2b guard is not refused
 *   D  no standing capture with a receipt time refuses, saying so
 *   E  a sent-back capture's receipt is never the visit
 *   F  a clock recorded as agreeing keeps 1.0: the device date, the L2b guard,
 *      and no extra line
 *   G  the line quotes RC-001 section 9 exactly, and no other protocol's
 *      transcription carries the sentence, so only the roof letter may print it
 *   H  only the roof letter's facts ask for the receipt; the other letters keep
 *      today's guard
 *
 * Against a fake PostgREST. Nothing reaches a database, nothing is sealed.
 */
process.env.SUPABASE_URL = "http://visit-receipt-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "visit-receipt-proof-not-a-key";
delete process.env.VERCEL_ENV;

import { readFileSync, readdirSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { protocolByDocument } = await import("../../src/content/protocols/index.ts");
const roof = protocolByDocument("254-RC-001");
const FILE = "00000000-0000-4000-8000-00000000f901";
const TEMPLATE = "00000000-0000-4000-8000-00000000f902";
let EVIDENCE = [];
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const table = url.pathname.replace("/rest/v1/", "");
  if (table === "eng_files") {
    return json([{ id: FILE, file_number: "254-PROOF-F9", property_address: "1 Proof Way", county: "Nueces", client_id: null, protocol_template_id: TEMPLATE }]);
  }
  if (table === "eng_protocol_templates") return json([{ document_number: "254-RC-001", version_label: roof.declaration.version }]);
  if (table === "eng_evidence_items") return json(EVIDENCE);
  return json([]);
};

const { letterFactsFor } = await import("../../src/lib/letter-seal.ts");
const { draftRoofLetter } = await import("../../src/lib/letter-draft.ts");
const { ROOF_LETTER_LINES, ROOF_LETTER_CLOCK_LINE, ROOF_LETTER_CLOCK_SENTENCE, ROOF_LETTER_VERSION } = await import("../../src/content/letters/roof-certification.ts");

const det = { id: "det-f9", file_id: FILE, protocol_document: "254-RC-001", determination: "pass", engineer_id: "eng-f9", decided_at: "2026-10-22T15:00:00Z", letter_option: null, letter_conditions: null, relied_on_evidence_ids: null };
const entered = { recipientAddress: "1 Proof Way", recipientSalutation: "Dear Proof" };
const LINE = `Per protocol 254-RC-001 section 9: ${ROOF_LETTER_CLOCK_SENTENCE}`;

/* The drafted lines, with the recipient filled so the draft has no gap to refuse on. */
const draftOf = (r) => draftRoofLetter("pass", { ...r.facts, recipient_name: "Proof Recipient", items_not_observed: "none" }, { clockUncertain: r.clockUncertain });
const visitIndex = (lines) => lines.findIndex((l) => l.text.startsWith("At your request, this firm inspected the roof"));

/*
 * The visit capture (earliest device time) was received at 03:00 UTC on the
 * 21st, which is 22:00 Central on the 20th; its device says 10:00 UTC on the
 * 20th.
 */
const rows = (clock) => [
  { captured_at: "2026-10-17T15:00:00Z", created_at: "2026-10-19T12:00:00Z", status: "revision_requested", clock_disagrees: clock },
  { captured_at: "2026-10-20T10:00:00Z", created_at: "2026-10-21T03:00:00Z", status: "submitted", clock_disagrees: clock },
  { captured_at: "2026-10-22T16:00:00Z", created_at: "2026-10-22T16:05:00Z", status: "submitted", clock_disagrees: clock },
];

/* A */
EVIDENCE = rows(true);
const disagrees = await letterFactsFor(det, entered);
check(
  "a clock recorded as disagreeing gives the first standing receipt as the visit, in Texas",
  disagrees.ok === true && disagrees.facts.visit_date === "October 20, 2026" && disagrees.clockUncertain === true,
  disagrees.ok ? `${disagrees.facts.visit_date}, uncertain ${disagrees.clockUncertain}` : disagrees.error,
);
if (disagrees.ok) {
  const d = draftOf(disagrees);
  const at = d.ok ? visitIndex(d.lines) : -1;
  check(
    "and RC-001 section 9's line follows the visit sentence directly",
    d.ok === true && at >= 0 && d.lines[at + 1]?.text === LINE && d.lines.length === ROOF_LETTER_LINES.length + 1,
    d.ok ? (d.lines[at + 1]?.text ?? "no line after the visit sentence") : d.why,
  );
}

/* B */
EVIDENCE = rows(null);
const unmeasured = await letterFactsFor(det, entered);
check(
  "a clock never measured does the same",
  unmeasured.ok === true && unmeasured.facts.visit_date === "October 20, 2026" && unmeasured.clockUncertain === true,
  unmeasured.ok ? unmeasured.facts.visit_date : unmeasured.error,
);
EVIDENCE = rows(true).map(({ clock_disagrees, ...r }) => r);
const absent = await letterFactsFor(det, entered);
check("and a row carrying no clock column at all is never measured", absent.ok === true && absent.clockUncertain === true, absent.ok ? String(absent.clockUncertain) : absent.error);

/* C */
EVIDENCE = rows(true);
/* Received at 09:00, an hour before its device time: the L2b guard refuses exactly this on an agreeing clock (F). */
EVIDENCE[1].created_at = "2026-10-20T09:00:00Z";
const ahead = await letterFactsFor(det, entered);
check(
  "a disagreeing clock that the L2b guard would refuse is not refused, and its receipt is the visit",
  ahead.ok === true && ahead.clockUncertain === true && ahead.facts.visit_date === "October 20, 2026",
  ahead.ok ? ahead.facts.visit_date : ahead.error,
);

/* D */
EVIDENCE = rows(true).map((r) => ({ ...r, created_at: r.status === "revision_requested" ? r.created_at : null }));
const noReceipt = await letterFactsFor(det, entered);
check("no standing capture with a receipt time refuses, saying so", noReceipt.ok === false && /No standing capture has a server receipt time/.test(noReceipt.error), noReceipt.ok ? "drafted" : noReceipt.error);

/* E */
EVIDENCE = rows(true);
EVIDENCE[0].created_at = "2026-10-10T12:00:00Z";
const sentBack = await letterFactsFor(det, entered);
check("a sent-back capture's earlier receipt is never the visit", sentBack.ok === true && sentBack.facts.visit_date === "October 20, 2026", sentBack.ok ? sentBack.facts.visit_date : sentBack.error);

/* F */
EVIDENCE = rows(false);
EVIDENCE[1].created_at = "2026-10-20T10:05:00Z";
const agrees = await letterFactsFor(det, entered);
check("a clock recorded as agreeing keeps the device date", agrees.ok === true && agrees.facts.visit_date === "October 20, 2026" && agrees.clockUncertain === false, agrees.ok ? `${agrees.facts.visit_date}, uncertain ${agrees.clockUncertain}` : agrees.error);
if (agrees.ok) {
  const d = draftOf(agrees);
  check("and its letter is the 1.0 wording, line for line, with no section 9 line", d.ok === true && d.lines.length === ROOF_LETTER_LINES.length && !d.lines.some((l) => l.text === LINE), d.ok ? `${d.lines.length} lines` : d.why);
}
EVIDENCE = rows(false);
/* Received at 09:00, an hour before the device says it took it: the visit capture stays the earliest. */
EVIDENCE[1].created_at = "2026-10-20T09:00:00Z";
const agreesAhead = await letterFactsFor(det, entered);
check("and the L2b guard still refuses an agreeing clock later than its receipt", agreesAhead.ok === false && /later than the server received it/.test(agreesAhead.error), agreesAhead.ok ? "drafted" : agreesAhead.error);

/* G */
const rule = roof.declaration.enforced?.find?.((r) => r.key === "photos-from-the-field-application-only") ?? null;
const rcSource = readFileSync("src/content/protocols/rc-001.ts", "utf8");
check(
  "the line quotes RC-001 section 9 exactly",
  ROOF_LETTER_CLOCK_LINE === `Per protocol {{protocol_number}} section 9: ${ROOF_LETTER_CLOCK_SENTENCE}` &&
    rcSource.includes(ROOF_LETTER_CLOCK_SENTENCE) &&
    /key: "photos-from-the-field-application-only",\s*rule: "[^"]*A device clock that disagrees with the server is recorded as disagreeing rather than presented as certain\.[^"]*",\s*at: "section 9",/.test(rcSource),
  rule ? rule.at : "read from the transcription",
);
const others = readdirSync("src/content/protocols")
  .filter((f) => f.endsWith(".ts") && !f.startsWith("rc-001"))
  .filter((f) => readFileSync(`src/content/protocols/${f}`, "utf8").replace(/\s+/g, " ").includes(ROOF_LETTER_CLOCK_SENTENCE));
check("and no other protocol's transcription carries the sentence", others.length === 0, others.join(", "));
check("the roof letter is template version 1.1", ROOF_LETTER_VERSION === "1.1");

/* H */
const seal = readFileSync("src/lib/letter-seal.ts", "utf8");
const asks = [...seal.matchAll(/visitAndCount\(evidence \?\? \[\], \{ receiptWhenClockUncertain: true \}\)/g)].length;
const plain = [...seal.matchAll(/visitAndCount\(evidence \?\? \[\]\);/g)].length;
check("only the roof letter's facts ask for the receipt; the foundation, permit, manufactured home and solar facts keep the guard", asks === 1 && plain === 1, `${asks} asking, ${plain} plain`);
const factsAt = seal.indexOf("export async function letterFactsFor(");
const askAt = seal.indexOf("{ receiptWhenClockUncertain: true }");
const nextFn = seal.indexOf("\nasync function fileFactsFor(");
check("and the one that asks is inside letterFactsFor", factsAt >= 0 && askAt > factsAt && askAt < nextFn);

console.log(
  wrong === 0
    ? "PASS: a visit date from an uncertain clock is the server's receipt, and the roof letter says so in RC-001 section 9's own words."
    : `FAIL: ${wrong} check(s) above.`,
);
process.exitCode = wrong === 0 ? 0 : 1;
