// @runtime react-server
//
// Declared because it imports src/lib/letter-seal.ts, which carries server-only.

/**
 * A ROOF LETTER ATTACHES WHAT ITS SENTENCE SAYS IS ATTACHED, AND EVERY ROOF
 * LETTER WAITING FOR HIS SEAL CAN BE SEALED FROM THE REVIEW SCREEN.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-roof-letter-attaches-what-it-says-is-attached.mjs
 *
 * Robert's answer on F14 and L2f, 2026-10-25. Option B of the roof letter
 * reads "the repairs listed in the attached schedule" and option C "the
 * attached record", and nothing was attached; both were listed as waiting for
 * his seal on a screen that offered the seal only for a pass. Aman's sentences
 * are untouched. The page they name is built from what he recorded only (his
 * repair list, 0053; his reason and the items he relied on, 0051) and printed
 * as a page of the same sealed PDF.
 *
 * roofAttachment runs against a fake PostgREST; the real PDF renderer runs
 * with the letterhead mark's own bytes standing in for the seal and signature
 * images. Nothing reaches a database or storage.
 */
process.env.SUPABASE_URL = "http://roof-attachment-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "roof-attachment-proof-not-a-key";
delete process.env.VERCEL_ENV;

import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { protocolByDocument } = await import("../../src/content/protocols/index.ts");
const item = protocolByDocument("254-RC-001").declaration.checklist[1];
const state = { repairs: [], fail: false };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const table = url.pathname.replace("/rest/v1/", "");
  if (table === "eng_repair_items") {
    if (state.fail) return json({ message: "proof: the repair list read failed", code: "XX000" }, 500);
    return json(state.repairs);
  }
  return json([]);
};

const { roofAttachment, draftDigest } = await import("../../src/lib/letter-seal.ts");
const { renderLetterPdf } = await import("../../src/lib/letter-pdf.ts");
const { LETTERHEAD_MARK } = await import("../../src/content/letters/letterhead-mark.ts");
const det = (determination, extra = {}) => ({ id: "det-ra", file_id: "file-ra", protocol_document: "254-RC-001", determination, engineer_id: "eng-ra", decided_at: "2026-10-22T15:00:00Z", letter_option: null, letter_conditions: null, relied_on_evidence_ids: null, ...extra });

const pass = await roofAttachment(det("pass"), "254-PROOF-RA-1");
check("a pass attaches nothing", pass.ok === true && pass.attachment === undefined);

state.repairs = [
  { requirement: "Replace the cracked pipe boot at the kitchen vent", item_key: item.key, sort_order: 1 },
  { requirement: "Reseal the north valley flashing", item_key: null, sort_order: 2 },
];
const repairs = await roofAttachment(det("repairs-required"), "254-PROOF-RA-1");
check(
  "repairs required attaches his repair list, numbered, in his words, with the Appendix B label",
  repairs.ok === true &&
    repairs.attachment?.lines[0] === `1. Replace the cracked pipe boot at the kitchen vent (${item.label})` &&
    repairs.attachment?.lines[1] === "2. Reseal the north valley flashing",
  JSON.stringify(repairs),
);
state.repairs = [];
const empty = await roofAttachment(det("repairs-required"), "254-PROOF-RA-1");
check("a repairs required letter with no list recorded is refused, never sealed with an empty schedule", empty.ok === false && /no repair list/.test(empty.error), JSON.stringify(empty));
state.fail = true;
const unread = await roofAttachment(det("repairs-required"), "254-PROOF-RA-1");
check("a failed read of the list is refused, never an empty schedule", unread.ok === false && /could not be read/.test(unread.error), JSON.stringify(unread));
state.fail = false;
state.repairs = [{ requirement: "A repair keyed to nothing the declaration names", item_key: "not_a_declared_item", sort_order: 1 }];
const rawKey = await roofAttachment(det("repairs-required"), "254-PROOF-RA-1");
check("a repair keyed to an item with no label refuses, never prints the key", rawKey.ok === false && /has no label/.test(rawKey.error), JSON.stringify(rawKey));

const decline = await roofAttachment(det("decline", { note: "The deck is soft across the south slope.", relied_on_item_keys: [item.key] }), "254-PROOF-RA-1");
check(
  "a decline attaches the reason he recorded and the items he relied on",
  decline.ok === true && decline.attachment?.lines[0] === "The deck is soft across the south slope." && decline.attachment?.lines[1] === `Items relied on: ${item.label}.`,
  JSON.stringify(decline),
);
const noReason = await roofAttachment(det("decline", { note: "  ", relied_on_item_keys: [] }), "254-PROOF-RA-1");
check("a decline with no reason recorded is refused", noReason.ok === false && /no reason recorded/.test(noReason.error), JSON.stringify(noReason));

/* The page is in the sealed PDF itself. */
const png = new Uint8Array(Buffer.from(LETTERHEAD_MARK.pngBase64, "base64"));
const base = {
  brand: "254 Engineering", registrationLine: "254 Engineering LLC, TBPELS Firm F-29811",
  lines: [{ kind: "body", text: "A proof letter." }],
  sealBlock: { name: "Proof Engineer", licenseNumber: "000000", role: "Engineer of Record", date: "October 25, 2026" },
  sealPng: png, signaturePng: png, logoPng: png, title: "Proof letter",
};
const without = await renderLetterPdf(base);
const withPage = await renderLetterPdf({ ...base, attachment: repairs.ok ? repairs.attachment : { heading: "x", lines: [] } });
const pages = async (r) => (r.ok ? (await PDFDocument.load(r.bytes)).getPageCount() : -1);
check("a letter with nothing attached is one page", (await pages(without)) === 1, String(await pages(without)));
check("a letter with its schedule attached carries it as a second page of the same PDF", (await pages(withPage)) === 2, String(await pages(withPage)));
const frame = { letterhead: { brand: base.brand, registrationLine: base.registrationLine }, sealBlock: { name: "Proof Engineer", licenseNumber: "000000", role: "Engineer of Record" } };
check(
  "and the digest he reads covers the attached page",
  draftDigest({ title: "t", lines: base.lines, attachment: repairs.attachment }, frame) !==
    draftDigest({ title: "t", lines: base.lines, attachment: { ...repairs.attachment, lines: repairs.attachment.lines.slice(0, 1) } }, frame),
);

const review = readFileSync("src/app/portal/(app)/review/page.tsx", "utf8");
check("the review screen offers the seal for every letter waiting, roof B and C included", /const sealable = selectedAwaiting\[0\] \?\? null;/.test(review) && !/l\.determination === "pass"\) \?\?/.test(review));
const seal = readFileSync("src/lib/letter-seal.ts", "utf8");
check("the sealed PDF is rendered with the attachment", /attachment: draft\.attachment,/.test(seal));

console.log("");
if (wrong === 0) {
  console.log("PASS: a roof letter attaches what it says is attached, and every roof letter waiting can be sealed from the review screen.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
