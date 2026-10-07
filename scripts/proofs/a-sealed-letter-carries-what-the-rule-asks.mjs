/**
 * A SEALED LETTER CARRIES WHAT 22 TAC 137.33 ASKS, AND THE SEAL IMAGES HAVE ONE
 * READER.
 *
 * Proves controls 2, 5 and 6 of docs/sealing-controls.md without a database:
 *
 *   1. The draft refuses a gap, and refuses a determination that produces no
 *      letter, rather than drafting around either.
 *   2. A rendered letter, read back out of the PDF by pdftotext rather than
 *      from the lines handed in, carries: the brand and the registrant line
 *      from registrationLine() (137.33(n)); his sentence for the determination;
 *      the engineer's printed name with "P.E.", his licence number and the date
 *      (137.33(f)(3)), all from the register, never typed here.
 *   3. The private eng-seals bucket is named by exactly two files, the upload
 *      (seal-store.ts) and the sealing step (letter-seal.ts), and is DOWNLOADED
 *      by the sealing step alone (control 2).
 *
 * The seal and signature images here are generated in memory, solid squares,
 * so no seal image exists anywhere in this repository.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdtempSync, rmSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const { draftRoofLetter } = await import("../../src/lib/letter-draft.ts");
const { renderLetterPdf } = await import("../../src/lib/letter-pdf.ts");
const { verifiedEngineers } = await import("../../src/config/credentials.ts");
const { registrationLine } = await import("../../src/lib/launch.ts");
const { ROOF_LETTER_DETERMINATION_SENTENCE } = await import("../../src/content/letters/roof-certification.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* A minimal valid PNG: one colour, w by h, built here. */
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

const FACTS = {
  determination_date: "October 7, 2026",
  recipient_name: "Probe Insurance Company",
  recipient_address: "1 Probe Plaza, Corpus Christi, Texas",
  recipient_salutation: "Dear Underwriter",
  property_address: "2 Probe Street",
  county: "Nueces",
  file_number: "254-PROBE-LETTER",
  visit_date: "October 1, 2026",
  protocol_number: "254-RC-001",
  protocol_version: "1.1",
  evidence_count: "41",
  items_not_observed: "Attic decking from below (no attic access)",
};

/* 1. The draft refuses. */
{
  const gap = draftRoofLetter("pass", { ...FACTS, county: "" });
  check("a draft with an empty slot is refused and names the slot", !gap.ok && gap.missing.includes("county"), gap.ok ? "drafted" : gap.why.slice(0, 80));
  const revise = draftRoofLetter("revise", FACTS);
  check("a revise determination produces no letter", !revise.ok, revise.ok ? "drafted" : revise.why.slice(0, 80));
}

/* 2. The rendered page. */
{
  const draft = draftRoofLetter("pass", FACTS);
  check("a pass determination with every fact drafts", draft.ok, draft.ok ? `${draft.lines.length} lines` : draft.why);
  const engineer = verifiedEngineers[0];
  const rendered = await renderLetterPdf({
    brand: "254 Engineering Services",
    registrationLine: registrationLine(),
    lines: draft.lines,
    sealBlock: { name: engineer.name, licenseNumber: engineer.licenseNumber, role: "Engineer of Record, the registrant", date: "October 7, 2026" },
    sealPng: png(300, 300, [20, 40, 80]),
    signaturePng: png(400, 120, [10, 10, 10]),
    title: "Probe roof letter",
  });
  check("the letter renders", rendered.ok, rendered.ok ? `${rendered.bytes.byteLength} bytes` : rendered.why);

  if (rendered.ok) {
    const dir = mkdtempSync(join(tmpdir(), "sealed-letter-"));
    const file = join(dir, "letter.pdf");
    writeFileSync(file, rendered.bytes);
    const run = spawnSync("pdftotext", ["-raw", file, "-"], { encoding: "utf8" });
    rmSync(dir, { recursive: true, force: true });
    if (run.error || run.status !== 0) {
      console.log("COULD NOT TELL: pdftotext could not read the rendered letter, so its text layer was not checked.");
      wrong += 1;
    } else {
      const text = run.stdout.replace(/\s+/g, " ");
      const has = (s) => text.includes(s.replace(/\s+/g, " "));
      check("it carries the firm's registrant line, 137.33(n)", has(registrationLine()), registrationLine());
      check("and the brand above it", has("254 ENGINEERING SERVICES"));
      check("and his own sentence for a pass, word for word", has(ROOF_LETTER_DETERMINATION_SENTENCE.pass));
      check("and the engineer's printed name with P.E., 137.33(f)(3)", has(`${engineer.name}, P.E.`));
      check("and his licence number from the register", has(`Texas P.E. No. ${engineer.licenseNumber}`));
      check("and the date", has("Date: October 7, 2026"));
      check("and the items not observed with their reasons", has("Attic decking from below (no attic access)"));
      check("and no bracketed instruction to the engineer reached the page", !has("[ENGINEER"));
    }
  }
}

/* 3. One reader of the seal images. */
{
  const files = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|mjs|js)$/.test(name)) files.push(p.split("\\").join("/"));
    }
  };
  walk("src");
  /*
   * The bucket's one home is the seal store, and the sealing step reads through
   * it. a-seal-image-is-read-only-by-sealing.mjs asserts the store's side; this
   * asserts the sealing step reads only through it and serves nothing itself.
   */
  const naming = files.filter((f) => readFileSync(f, "utf8").includes('"eng-seals"'));
  check(
    "the seal bucket is named by the seal store alone (control 2)",
    naming.length === 1 && naming[0] === "src/lib/seal-store.ts",
    naming.join(", "),
  );
  const sealing = readFileSync("src/lib/letter-seal.ts", "utf8");
  check(
    "and the sealing step reads the images only through readImageForSealing, never a link",
    sealing.includes("readImageForSealing(") && !sealing.includes("createSignedUrl") && !sealing.includes("getPublicUrl"),
  );
}

console.log("");
if (wrong === 0) {
  console.log("PASS: the letter carries what the rule asks, and the seal images have one reader.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
