/**
 * WRITE THE REFERENCE TEXT OF EVERY PROTOCOL PDF, AS xpdf 4.00 READS IT.
 *
 *   npx tsx scripts/protocol-reference-text.mjs
 *
 * Operator ruling (a), 2026-10-22. The transcriptions were proved against
 * pdftotext 4.00 (xpdf, as Git for Windows ships it in mingw64). Poppler and
 * xpdf 4.06 read the same PDFs differently (checkbox glyphs, dash forms, the
 * order of table cells), so the verbatim checks agree with 4.00 and nothing
 * else tried. Each PDF's 4.00 text, in both modes the audit reads (-layout and
 * -raw), is stored in docs/protocols/reference-text/ with a manifest pinning the
 * PDF's SHA-256 and the text's own SHA-256. scripts/lib/protocol-source.mjs
 * `pdfText` then serves the reference for a PDF whose digest it knows, refuses
 * any other, and re-derives the reference wherever 4.00 is present.
 *
 * REFUSES unless the pdftotext on Node's PATH prints "version 4.00", because a
 * reference written by any other extractor is a reference to nothing the
 * transcriptions were checked against. The private RC-001 copies are fetched
 * and proved first (migration 0080). Writes bytes exactly as the extractor
 * emitted them; .gitattributes keeps git from touching their line endings.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { ensurePrivateSources, REFERENCE_DIR, REFERENCE_MANIFEST, REFERENCE_EXTRACTOR } from "./lib/protocol-source.mjs";

const { RC001_VERSIONS } = await import("../src/content/protocols/rc-001.ts");
const { RECEIVED_PROTOCOLS } = await import("../src/content/protocols/received.ts");
const { PRIVATE_SOURCES, PROTOCOL_SOURCE_BUCKET } = await import("../src/content/protocols/private-sources.ts");

const version = spawnSync("pdftotext", ["-v"], { encoding: "utf8" });
const line = `${version.stdout ?? ""}${version.stderr ?? ""}`.split(/\r?\n/).find((l) => /version/i.test(l)) ?? "";
if (!line.includes(REFERENCE_EXTRACTOR)) {
  console.log(`REFUSED: pdftotext here is "${line || "absent"}", not ${REFERENCE_EXTRACTOR}. Nothing written.`);
  process.exit(1);
}

const fetched = await ensurePrivateSources(PRIVATE_SOURCES, PROTOCOL_SOURCE_BUCKET);
const bad = fetched.filter((r) => !r.ok);
if (bad.length) {
  console.log(`REFUSED: ${bad.map((r) => r.why).join("; ")}. Nothing written.`);
  process.exit(1);
}

const pdfs = [...new Set([...RC001_VERSIONS.map((v) => v.file), ...RECEIVED_PROTOCOLS.map((p) => p.declaration.sourceFile)])];
const sha = (b) => createHash("sha256").update(b).digest("hex");
mkdirSync(REFERENCE_DIR, { recursive: true });
const entries = [];
for (const pdf of pdfs) {
  const { readFileSync } = await import("node:fs");
  const pdfSha256 = sha(readFileSync(pdf));
  for (const mode of ["layout", "raw"]) {
    const run = spawnSync("pdftotext", [`-${mode}`, pdf, "-"], { maxBuffer: 64 * 1024 * 1024 });
    if (run.status !== 0) {
      console.log(`REFUSED: pdftotext -${mode} failed on ${pdf}. Nothing more written.`);
      process.exit(1);
    }
    const file = `${REFERENCE_DIR}/${basename(pdf, ".pdf")}.${mode}.txt`;
    writeFileSync(file, run.stdout);
    entries.push({ pdf, pdfSha256, mode, file, textSha256: sha(run.stdout), bytes: run.stdout.length });
    console.log(`  ${mode.padEnd(6)} ${run.stdout.length} bytes  ${file}`);
  }
}
writeFileSync(
  REFERENCE_MANIFEST,
  JSON.stringify({ extractor: line.trim(), written: new Date().toISOString().slice(0, 10), entries }, null, 2) + "\n",
);
console.log(`\n${entries.length} reference texts for ${pdfs.length} PDFs, by ${line.trim()}.`);
