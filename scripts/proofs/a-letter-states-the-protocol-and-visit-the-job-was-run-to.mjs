// @runtime react-server
//
// Declared because it imports src/lib/letter-seal.ts, which carries server-only.

/**
 * A LETTER STATES THE PROTOCOL VERSION AND THE VISIT THE JOB WAS RUN TO, AND
 * SEALS ONLY UNDER A CURRENT LICENCE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-letter-states-the-protocol-and-visit-the-job-was-run-to.mjs
 *
 * Robert's answers of 2026-10-25 on the letter claims. Aman's fixed wording
 * never changes; these are the facts filled into it.
 *
 * L2a. The printed protocol version was the code's current declaration, not
 *      the version the file ran under; checklist labels fell back to the raw
 *      item key. Now: the file's own protocol_template_id, refused when it is
 *      missing, names another protocol, or names another version; a missing
 *      label refuses the draft.
 * L2b. The visit date was the earliest capture across all evidence,
 *      revision-requested included, and evidence_count counted every row. Now:
 *      the earliest capture that was not sent back, in America/Chicago, and
 *      the accepted evidence only.
 * L2e. Sealing checked that the licence number is on the register and not its
 *      expiry. Asserted on the source here: the seal's own door is shut
 *      before it in this process, because the launch gate is.
 *
 * Against a fake PostgREST. Nothing reaches a database.
 */
process.env.SUPABASE_URL = "http://letter-facts-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "letter-facts-proof-not-a-key";
delete process.env.VERCEL_ENV;

import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { protocolByDocument } = await import("../../src/content/protocols/index.ts");
const roof = protocolByDocument("254-RC-001");
const CARRIED = roof.declaration.version;
const LABELLED = roof.declaration.checklist[0];

const FILE = "00000000-0000-4000-8000-00000000dd01";
const TEMPLATE = "00000000-0000-4000-8000-00000000dd02";
const state = {
  templateId: TEMPLATE,
  template: { document_number: "254-RC-001", version_label: CARRIED },
  exceptions: [{ item_key: LABELLED.key, kind: "not_observed", reason: "Snow on the north slope" }],
  failTemplate: false,
};
/* created_at is the server's receipt (0057); each is shortly after its capture unless a case below moves it. */
const EVIDENCE = [
  /* Sent back: its earlier capture is not the visit, and it is not counted. */
  { captured_at: "2026-10-18T15:00:00Z", created_at: "2026-10-18T15:05:00Z", status: "revision_requested" },
  { captured_at: "2026-10-20T15:00:00Z", created_at: "2026-10-20T15:05:00Z", status: "accepted" },
  /* 02:00 UTC on the 21st is 21:00 Central on the 20th; submitted, so not counted. */
  { captured_at: "2026-10-21T02:00:00Z", created_at: "2026-10-21T02:05:00Z", status: "submitted" },
  { captured_at: "2026-10-21T16:00:00Z", created_at: "2026-10-21T16:05:00Z", status: "accepted" },
];
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const table = url.pathname.replace("/rest/v1/", "");
  if (table === "eng_files") {
    return json([{ id: FILE, file_number: "254-PROOF-LF-1", property_address: "1 Proof Way", county: "Nueces", client_id: null, protocol_template_id: state.templateId }]);
  }
  if (table === "eng_protocol_templates") {
    if (state.failTemplate) return json({ message: "proof: the template read failed", code: "XX000" }, 500);
    return json(state.template ? [state.template] : []);
  }
  if (table === "eng_evidence_items") return json(EVIDENCE);
  if (table === "eng_checklist_exceptions") return json(state.exceptions);
  return json([]);
};

const { letterFactsFor } = await import("../../src/lib/letter-seal.ts");
const det = { id: "det-lf", file_id: FILE, protocol_document: "254-RC-001", determination: "pass", engineer_id: "eng-lf", decided_at: "2026-10-22T15:00:00Z", letter_option: null, letter_conditions: null, relied_on_evidence_ids: null };
const entered = { recipientAddress: "1 Proof Way", recipientSalutation: "Dear Proof" };

const good = await letterFactsFor(det, entered);
check("with the file's template on the carried version, the letter prints that version", good.ok === true && good.facts.protocol_version === CARRIED, good.ok ? good.facts.protocol_version : good.error);
check("the visit is the earliest capture that was not sent back, in Texas", good.ok === true && good.facts.visit_date === "October 20, 2026", good.ok ? good.facts.visit_date : "");
check("the evidence count is the accepted evidence only", good.ok === true && good.facts.evidence_count === "2", good.ok ? good.facts.evidence_count : "");
check("an item not observed prints with his label, never its key", good.ok === true && good.facts.items_not_observed.startsWith(`${LABELLED.label} (`), good.ok ? good.facts.items_not_observed : "");

state.template = { document_number: "254-RC-001", version_label: "0.9" };
const otherVersion = await letterFactsFor(det, entered);
check("a file run under another version is refused, naming both", otherVersion.ok === false && /version 0\.9/.test(otherVersion.error) && otherVersion.error.includes(`version ${CARRIED}`), JSON.stringify(otherVersion));
state.template = { document_number: "254-FC-001", version_label: CARRIED };
const otherProtocol = await letterFactsFor(det, entered);
check("a file run under another protocol is refused", otherProtocol.ok === false && /ran under 254-FC-001/.test(otherProtocol.error), JSON.stringify(otherProtocol));
state.template = { document_number: "254-RC-001", version_label: CARRIED };
state.templateId = null;
const noTemplate = await letterFactsFor(det, entered);
check("a file that records no protocol is refused", noTemplate.ok === false && /records no protocol/.test(noTemplate.error), JSON.stringify(noTemplate));
state.templateId = TEMPLATE;
state.failTemplate = true;
const unread = await letterFactsFor(det, entered);
check("a failed template read is refused, never the code's version", unread.ok === false && /could not be read/.test(unread.error), JSON.stringify(unread));
state.failTemplate = false;
state.exceptions = [{ item_key: "an_item_the_declaration_never_named", kind: "not_observed", reason: "proof" }];
const raw = await letterFactsFor(det, entered);
check("an item with no label in the signed declaration refuses the draft", raw.ok === false && /has no label/.test(raw.error), JSON.stringify(raw));
state.exceptions = [{ item_key: LABELLED.key, kind: "not_observed", reason: "Snow on the north slope" }];

/*
 * Robert's guard on L2b, 2026-10-25: the visit capture's device time must not
 * be later than the server's receipt of it, nor more than 3 days earlier.
 */
const visitRow = EVIDENCE[1];
const keep = { ...visitRow };
visitRow.created_at = "2026-10-20T14:59:00Z";
const ahead = await letterFactsFor(det, entered);
check("a visit capture whose device time is later than the server received it refuses, saying so", ahead.ok === false && /later than the server received it/.test(ahead.error) && /office corrects/.test(ahead.error), JSON.stringify(ahead));
visitRow.created_at = "2026-10-23T15:00:01Z";
const stale = await letterFactsFor(det, entered);
check("and one taken more than 3 days before the server received it refuses, saying so", stale.ok === false && /more than 3 days before/.test(stale.error), JSON.stringify(stale));
visitRow.created_at = "2026-10-23T14:59:59Z";
const edge = await letterFactsFor(det, entered);
check("and one received just inside 3 days is the visit", edge.ok === true && edge.facts.visit_date === "October 20, 2026", JSON.stringify(edge.ok ? edge.facts.visit_date : edge));
Object.assign(visitRow, keep);
EVIDENCE[0].created_at = "2026-10-10T00:00:00Z";
const sentBack = await letterFactsFor(det, entered);
check("a sent-back capture with a bad clock does not refuse: it is not the visit", sentBack.ok === true, JSON.stringify(sentBack.ok ? "ok" : sentBack));
EVIDENCE[0].created_at = "2026-10-18T15:05:00Z";

const seal = readFileSync("src/lib/letter-seal.ts", "utf8");
check(
  "the foundation letter prints the version the file ran under and the accepted count",
  /protocol_version: base\.protocolVersion,/.test(seal) && /evidence_count: String\(base\.evidenceCount\),[\s\S]{0,80}items_not_observed/.test(seal),
);
/*
 * Since 2026-10-26 the check lives in sealerFor, the one reading of who may
 * seal that a letter and the engineer's own document share (item C). So the
 * property is read in two parts: sealerFor refuses a licence not current
 * today, and sealLetter asks sealerFor before it spends the code.
 */
const sealerBody = seal.slice(seal.indexOf("export function sealerFor("), seal.indexOf("export async function deliverSealedFile("));
const sealLetterBody = seal.slice(seal.indexOf("export async function sealLetter("), seal.indexOf("export function sealerFor("));
check(
  "sealing refuses a licence that is not current today, before the code is spent",
  /if \(!licenceIsCurrentToday\(engineer\.expires\)\) \{/.test(sealerBody) &&
    sealLetterBody.indexOf("sealerFor(actor!, det)") > 0 &&
    sealLetterBody.indexOf("sealerFor(actor!, det)") < sealLetterBody.indexOf("verifyFreshCode(actor!.id, input.code)"),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: a letter states the protocol version and the visit the job was run to, and seals only under a current licence.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
