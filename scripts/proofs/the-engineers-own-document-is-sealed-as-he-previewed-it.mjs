// @runtime react-server
//
// Declared because it imports src/lib/own-document-seal.ts and letter-seal.ts,
// which carry server-only.

/**
 * THE ENGINEER'S OWN DOCUMENT IS SEALED ONLY AS HE PREVIEWED IT, WITH NOTHING
 * DRAWN OVER HIS PAGES.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-engineers-own-document-is-sealed-as-he-previewed-it.mjs
 *
 * Robert's ruling of 2026-10-25, 23:51 Central, item C; docs/sealing-controls.md
 * controls 12 to 17. Three parts, none of which reaches a database:
 *
 *   1. The stamp, run: a two page PDF built here goes in, and what comes out
 *      has his two pages with their content streams byte identical and one
 *      added page carrying the brand, the registrant with F-29811, the title
 *      and the seal block. The preview carries outlined boxes and no seal or
 *      signature image; the sealed copy carries both images. A file that is not
 *      a PDF, a PDF with no pages, and one over the page limit are each refused
 *      with their own sentence.
 *   2. The digest, run: it changes with the draft's bytes, the title and the
 *      frame.
 *   3. The order of the sealing step, read from the source, because in this
 *      process the launch gate is shut and a run could only prove the gate (as
 *      a-letter-is-sealed-only-as-he-read-it does): the checks of control 12
 *      come first, the preview digest is compared before any code is spent and
 *      before his images are read, the seal act goes through the seventeen
 *      argument door naming his printed name and licence and no template, the
 *      draft goes once the seal is recorded, and delivery is the letters' own
 *      step. And the drafts bucket is 0092's, is not the deliverable store, and
 *      nothing but this module names it.
 */
process.env.SUPABASE_URL = "http://own-document-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "own-document-proof-not-a-key";
delete process.env.VERCEL_ENV;

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdtempSync, rmSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { PDFArray, PDFDocument, PDFName, StandardFonts } from "pdf-lib";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* A solid PNG, the same helper a-sealed-letter-carries-what-the-rule-asks uses. */
function png(w, h, rgbValue) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0).map((_, i) => rgbValue[i % 3])]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

const { stampOwnDocument, MAX_OWN_DOCUMENT_PAGES } = await import("../../src/lib/letter-pdf.ts");
const { ownDocumentDigest, DRAFTS_BUCKET } = await import("../../src/lib/own-document-seal.ts");
const { LETTERHEAD_MARK } = await import("../../src/content/letters/letterhead-mark.ts");

/* ---------------------------------------------------------------- 1. the stamp */
async function sourcePdf(pages) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i += 1) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Proof specification page ${i}, written by the engineer`, { x: 72, y: 700, size: 11, font });
    page.drawText("Location 1: sister the damaged rafter full length.", { x: 72, y: 60, size: 11, font });
  }
  return doc.save();
}
const contentsOf = (doc, i) => {
  const c = doc.getPage(i).node.get(PDFName.of("Contents"));
  const refs = c instanceof PDFArray ? c.asArray() : [c];
  return Buffer.concat(refs.map((r) => Buffer.from(doc.context.lookup(r).getContents())));
};
/*
 * Images a reader sees, not counting soft masks: a PNG with an alpha channel,
 * as the letterhead mark is, embeds as an image plus a grey SMask image that
 * only shapes it.
 */
const imageCount = (doc) => {
  const images = doc.context.enumerateIndirectObjects().filter(([, obj]) => obj?.dict?.get?.(PDFName.of("Subtype")) === PDFName.of("Image"));
  const masks = new Set(images.map(([, obj]) => obj.dict.get(PDFName.of("SMask"))?.toString()).filter(Boolean));
  return images.filter(([ref]) => !masks.has(ref.toString())).length;
};
const textOf = (bytes) => {
  const dir = mkdtempSync(join(tmpdir(), "own-document-"));
  const file = join(dir, "doc.pdf");
  writeFileSync(file, bytes);
  const run = spawnSync("pdftotext", ["-raw", file, "-"], { encoding: "utf8" });
  rmSync(dir, { recursive: true, force: true });
  return run.error || run.status !== 0 ? null : run.stdout.replace(/\s+/g, " ");
};

const SOURCE = await sourcePdf(2);
const source = await PDFDocument.load(SOURCE);
const BLOCK = { name: "Proof Engineer", licenseNumber: "990091", role: "Engineer of Record, Proof Firm LLC" };
const COMMON = {
  source: SOURCE,
  brand: "254 Engineering",
  registrationLine: "Proof Firm LLC, TBPELS Firm F-29811",
  logoPng: new Uint8Array(Buffer.from(LETTERHEAD_MARK.pngBase64, "base64")),
  title: "Repair specification",
};
const preview = await stampOwnDocument({ ...COMMON, sealBlock: { ...BLOCK, date: "the date of sealing" }, images: null });
const sealed = await stampOwnDocument({
  ...COMMON,
  sealBlock: { ...BLOCK, date: "October 26, 2026" },
  images: { sealPng: png(300, 300, [20, 40, 80]), signaturePng: png(400, 120, [10, 10, 10]) },
});
check("the preview and the sealed copy both render", preview.ok && sealed.ok, preview.ok ? (sealed.ok ? "" : sealed.why) : preview.why);

if (preview.ok && sealed.ok) {
  const p = await PDFDocument.load(preview.bytes);
  const s = await PDFDocument.load(sealed.bytes);
  check("each is his pages plus one", p.getPageCount() === 3 && s.getPageCount() === 3 && sealed.sourcePages === 2, `${p.getPageCount()}, ${s.getPageCount()}`);
  check(
    "and his pages' content streams are byte identical, so nothing was drawn over a line he wrote (control 16)",
    [0, 1].every((i) => contentsOf(source, i).equals(contentsOf(s, i)) && contentsOf(source, i).equals(contentsOf(p, i))),
  );
  check("the preview embeds no seal or signature image, only the mark (control 2)", imageCount(p) === 1, `${imageCount(p)} image(s)`);
  check("the sealed copy embeds the mark, the seal and the signature", imageCount(s) === 3, `${imageCount(s)} image(s)`);

  const st = textOf(sealed.bytes);
  const pt = textOf(preview.bytes);
  if (st === null || pt === null) {
    console.log("COULD NOT TELL: pdftotext could not read the stamped document, so its text layer was not checked.");
    wrong += 1;
  } else {
    const has = (t, x) => t.includes(x.replace(/\s+/g, " "));
    check("his own text is still there, page one and page two", has(st, "Proof specification page 1") && has(st, "Proof specification page 2"));
    check("the seal page carries the brand and the registrant with F-29811, 137.33(n)", has(st, "254 Engineering") && has(st, "Proof Firm LLC, TBPELS Firm F-29811"));
    check("and the title", has(st, "Repair specification"));
    check("and his printed name with P.E. and his licence number, 137.33(f)(3)", has(st, "Proof Engineer, P.E.") && has(st, "Texas P.E. No. 990091"));
    check("and his role and the date of sealing", has(st, "Engineer of Record, Proof Firm LLC") && has(st, "Date: October 26, 2026"));
    check("the sealed copy says nothing about being applied later", !has(st, "applied at sealing"));
    check("the preview marks where the seal and signature go, and dates nothing", has(pt, "Seal, applied at sealing") && has(pt, "Signature, applied at sealing") && has(pt, "Date: the date of sealing"));
    check("and the name 254 Engineering Services is on neither", !/254\s+engineering\s+services/i.test(st + pt));
  }
}

const notPdf = await stampOwnDocument({ ...COMMON, source: new Uint8Array(Buffer.from("this is not a PDF")), sealBlock: { ...BLOCK, date: "x" }, images: null });
check("a file that is not a PDF is refused, and told to export a PDF", !notPdf.ok && /could not be read as a PDF/.test(notPdf.why), notPdf.ok ? "it stamped" : notPdf.why);
/* pdf-lib adds a blank page to a document saved with none unless told not to. */
const empty = await stampOwnDocument({ ...COMMON, source: await (await PDFDocument.create()).save({ addDefaultPage: false }), sealBlock: { ...BLOCK, date: "x" }, images: null });
check("a PDF with no pages is refused", !empty.ok && /no pages/.test(empty.why), empty.ok ? "it stamped" : empty.why);
const tooLong = await stampOwnDocument({ ...COMMON, source: await sourcePdf(MAX_OWN_DOCUMENT_PAGES + 1), sealBlock: { ...BLOCK, date: "x" }, images: null });
check(`one over ${MAX_OWN_DOCUMENT_PAGES} pages is refused`, !tooLong.ok && /at most/.test(tooLong.why), tooLong.ok ? "it stamped" : tooLong.why);

/* --------------------------------------------------------------- 2. the digest */
const frame = { letterhead: { brand: "254 Engineering", registrationLine: "Proof Firm LLC, TBPELS Firm F-29811" }, sealBlock: BLOCK };
const base = ownDocumentDigest("a".repeat(64), "Repair specification", frame);
check("the digest is a SHA-256, and the same inputs give it again", /^[0-9a-f]{64}$/.test(base) && ownDocumentDigest("a".repeat(64), "Repair specification", structuredClone(frame)) === base);
check("a different upload changes it", ownDocumentDigest("b".repeat(64), "Repair specification", frame) !== base);
check("a different title changes it", ownDocumentDigest("a".repeat(64), "Repair specification.", frame) !== base);
check("a different registrant line changes it", ownDocumentDigest("a".repeat(64), "Repair specification", { ...frame, letterhead: { ...frame.letterhead, registrationLine: "Another" } }) !== base);
check("a different licence number changes it", ownDocumentDigest("a".repeat(64), "Repair specification", { ...frame, sealBlock: { ...BLOCK, licenseNumber: "990092" } }) !== base);

/* ------------------------------------------------- 3. the sealing step, read */
const src = readFileSync("src/lib/own-document-seal.ts", "utf8");
const at = (needle, from = 0) => src.indexOf(needle, from);
const forBody = src.slice(at("async function ownDocumentFor("), at("export function ownDocumentDigest("));
check("every step first asks for documents.seal", /holdsLicence\(actor, "documents\.seal"\)/.test(forBody));
check("and the letters' own reading of who may seal (sealerFor)", /sealerFor\(actor!, det\)/.test(forBody));
check("and a protocol whose deliverable is his own document", /OWN_DOCUMENT_PROTOCOLS as readonly string\[\]\)\.includes\(det\.protocol_document\)/.test(forBody));
check("and a pass, since section 11 issues the specification on a pass", /if \(det\.determination !== "pass"\)/.test(forBody));
check("and not already sealed, with a failed read refusing", /\.is\("voided_at", null\)/.test(forBody) && /if \(liveError\) return \{ ok: false/.test(forBody));
for (const fn of ["export async function ownDocumentUploadUrl(", "export async function previewOwnDocument(", "export async function sealOwnDocument("]) {
  const body = src.slice(at(fn), at("\n}\n", at(fn)));
  check(`${fn.replace("export async function ", "").replace("(", "")} goes through ownDocumentFor`, /await ownDocumentFor\(actor, (input\.)?determinationId\)/.test(body));
}
const previewBody = src.slice(at("export async function previewOwnDocument("), at("export type OwnDocumentSealResult"));
check(
  "the preview is stamped with no images and never reads them (control 2)",
  /images: null,/.test(previewBody) && !/readImageForSealing\(/.test(previewBody) && !/images: \{/.test(previewBody),
);
const sealBody = src.slice(at("export async function sealOwnDocument("));
const gateAt = sealBody.indexOf("isPrelaunch()");
const readyAt = sealBody.indexOf("await ownDocumentFor(");
const digestAt = sealBody.indexOf("ownDocumentDigest(draft.sha256, title, frame) !== input.previewSha256");
const codeAt = sealBody.indexOf("verifyFreshCode(actor!.id, input.code)");
const imagesAt = sealBody.indexOf('readImageForSealing(actor!.id, "seal")');
const rpcAt = sealBody.indexOf('db.rpc("eng_record_letter_seal"');
const removeAt = sealBody.indexOf("remove([draftKeyFor(det), previewKeyFor(det)])");
check("sealing refuses while the gate is shut, before anything else", gateAt > 0 && gateAt < readyAt);
check("and refuses with no preview digest at all", /if \(!input\.previewSha256\) \{\s*return \{ ok: false,/.test(sealBody));
check("and compares the draft he previewed before the code is spent and before his images are read (control 15)", digestAt > readyAt && digestAt < codeAt && digestAt < imagesAt);
const rpc = sealBody.slice(rpcAt, sealBody.indexOf("});", rpcAt));
check("the act goes through the seventeen argument door, with his printed name and licence", /p_printed_name: frame\.sealBlock\.name/.test(rpc) && /p_printed_license: frame\.sealBlock\.licenseNumber/.test(rpc));
check("and names no template (0091)", !/p_letter_template_act_id/.test(rpc));
check("and the sealed PDF carries the frame the digest covered", /brand: frame\.letterhead\.brand,/.test(sealBody) && /registrationLine: frame\.letterhead\.registrationLine,/.test(sealBody) && /\.\.\.frame\.sealBlock, date: letterDate\(fresh\.verifiedAt\)/.test(sealBody));
check("the draft and its preview go only after the seal is recorded (control 13)", removeAt > rpcAt);
check("and delivery is the letters' own step (control 17)", /deliverSealedFile\(actor!, det, input\.context \?\? \{\}, "specification"\)/.test(sealBody));

check("the drafts bucket is 0092's, and is not the deliverable store", DRAFTS_BUCKET === "eng-engineer-drafts" && DRAFTS_BUCKET !== "eng-documents");
const mig = readFileSync("supabase/migrations/0092_the_engineers_own_document_has_its_own_drafts_bucket.sql", "utf8");
check("0092 makes it private and PDF only", /values \('eng-engineer-drafts', 'eng-engineer-drafts', false, 26214400, array\['application\/pdf'\]\)/.test(mig) && /set public = false,/.test(mig));
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p.replaceAll("\\", "/")] : [];
});
const namers = walk("src").filter((f) => /eng-engineer-drafts|DRAFTS_BUCKET/.test(readFileSync(f, "utf8")));
check("and nothing but the sealing module names it (control 13)", namers.length === 1 && namers[0] === "src/lib/own-document-seal.ts", namers.join(", ") || "NOTHING NAMES IT");

const letterSeal = readFileSync("src/lib/letter-seal.ts", "utf8");
check("the awaiting list reads his own-document determinations too", /\[\.\.\.SEALABLE_PROTOCOLS, \.\.\.OWN_DOCUMENT_PROTOCOLS\]/.test(letterSeal));
check("and for those only a pass is waiting", /if \(\(OWN_DOCUMENT_PROTOCOLS as readonly string\[\]\)\.includes\(protocol\)\) return determination === "pass";/.test(letterSeal));
const page = readFileSync("src/app/portal/(app)/review/page.tsx", "utf8");
check("and the review screen offers the upload panel for them, the letter panel for the rest", /OWN_DOCUMENT_PROTOCOLS as readonly string\[\]\)\.includes\(sealable\.protocolDocument\) \? \(\s*<OwnDocumentSealPanel/.test(page));

console.log("");
if (wrong === 0) {
  console.log("PASS: the engineer's own document is sealed only as he previewed it, with nothing drawn over his pages.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
