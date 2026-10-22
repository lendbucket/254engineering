/**
 * THE TEXT OF A PROTOCOL'S SOURCE DOCUMENT, WHATEVER FORM IT ARRIVED IN.
 *
 * ONE PROTOCOL TO MANY, operator ruling 2026-10-06. Until then the only source
 * document was 254-RC-001's signed PDF, read with `pdftotext` inside
 * protocol-registry-audit. The engineer's seven new protocols arrive as Word
 * files and are signed in the portal (ruling 2a), so the transcription is
 * checked against the .docx he sent. This reads either, and nothing else.
 *
 * WHAT IT RETURNS IS TEXT FOR COMPARISON, NEVER TEXT TO RENDER. It drops all
 * formatting and keeps every character of every run in document order, one
 * paragraph per line. A comparison against it is strict about words and
 * punctuation and indifferent to where a line wrapped, which is the same
 * standard the PDF comparison has always held.
 *
 * WHEN THE TOOL IS MISSING IT SAYS SO. `pdftotext` and `unzip` are the two
 * external tools. Either missing returns `{ ok: false, why }`, and the caller
 * reports COULD NOT TELL rather than a comparison over nothing.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * THE PRIVATE ORIGINALS, FETCHED INTO PLACE AND PROVED BEFORE ANYTHING READS
 * THEM. Operator rulings 2026-10-22, migration 0080: the signed RC-001 copies
 * and the letter templates left the public tree for the private bucket
 * eng-protocol-sources on development, and src/content/protocols/
 * private-sources.ts keeps each one's path, key, digest and size.
 *
 * For each source: a copy already at its path is hashed; otherwise it is
 * downloaded and written there (the paths are gitignored). Either way it is
 * accepted only when its SHA-256 AND its byte count equal the declaration's,
 * and a mismatch is refused by name, never repaired: a stored file that has
 * changed is a different document from the one the transcriptions were proved
 * against. Returns one result per source, `{ path, ok, how, why }`, and
 * `unreachable: true` when no development client could be made, so a caller
 * can report COULD NOT TELL rather than a finding about a document it never saw.
 *
 * Development only, always: the client is `neverProduction`, because the
 * originals were ruled onto development and nowhere else.
 */
export async function ensurePrivateSources(sources, bucket) {
  const results = [];
  let db;
  const client = async () => {
    if (db !== undefined) return db;
    try {
      const { auditClient } = await import("./db-target.mjs");
      db = auditClient("the protocol source documents", { neverProduction: true });
    } catch {
      db = null;
    }
    return db;
  };
  for (const s of sources) {
    const check = (buf) => {
      const sha = createHash("sha256").update(buf).digest("hex");
      if (buf.length !== s.bytes || sha !== s.sha256) {
        return `${s.path}: ${buf.length} bytes, sha256 ${sha.slice(0, 12)}; declared ${s.bytes} bytes, ${s.sha256.slice(0, 12)}`;
      }
      return null;
    };
    if (existsSync(s.path)) {
      const wrong = check(readFileSync(s.path));
      results.push({ path: s.path, ok: !wrong, how: "already on disk", why: wrong });
      continue;
    }
    const d = await client();
    if (!d) {
      results.push({ path: s.path, ok: false, unreachable: true, why: "no development database client, so it could not be fetched" });
      continue;
    }
    const { data, error } = await d.storage.from(bucket).download(s.key);
    if (error || !data) {
      /* A network fault is unreachable; a missing object is a finding, because
       * the document the transcriptions rest on is not where it was put. */
      const message = String(error?.message ?? "no data");
      results.push({
        path: s.path,
        ok: false,
        unreachable: /fetch failed|network|ECONN|timed? ?out/i.test(message),
        why: `${bucket}/${s.key} could not be downloaded (${message})`,
      });
      continue;
    }
    const buf = Buffer.from(await data.arrayBuffer());
    const wrong = check(buf);
    if (!wrong) {
      mkdirSync(dirname(s.path), { recursive: true });
      writeFileSync(s.path, buf);
    }
    results.push({ path: s.path, ok: !wrong, how: `fetched from ${bucket}/${s.key}`, why: wrong });
  }
  return results;
}

/*
 * ===========================================================================
 * A PROTOCOL PDF'S TEXT IS ITS REFERENCE, PINNED TO ITS DIGEST.
 * Operator ruling (a), 2026-10-22.
 * ===========================================================================
 *
 * The transcriptions were proved against pdftotext 4.00 (xpdf). Poppler and
 * xpdf 4.06 read the same PDFs differently, so a comparison is only meaningful
 * against 4.00's text. docs/protocols/reference-text/ holds that text for every
 * protocol PDF in both modes the audit reads, and manifest.json pins each PDF's
 * SHA-256 and each text's own SHA-256.
 *
 * `pdfText(file, mode)`:
 *   - a PDF whose digest no manifest entry names is REFUSED: a changed PDF is a
 *     different document, and its text is not served from anybody's memory;
 *   - a reference whose bytes do not hash to the manifest is REFUSED;
 *   - wherever the pdftotext on Node's PATH is 4.00, the PDF is re-read and must
 *     equal the reference byte for byte, or it is REFUSED;
 *   - otherwise the reference is served and `how` says whether 4.00 confirmed it.
 * `refused: true` is a finding for the caller to FAIL on, never COULD NOT TELL.
 */
export const REFERENCE_DIR = "docs/protocols/reference-text";
export const REFERENCE_MANIFEST = `${REFERENCE_DIR}/manifest.json`;
export const REFERENCE_EXTRACTOR = "pdftotext version 4.00";

let manifestCache;
let extractorLine;
export const referenceLog = [];

function hereIs400() {
  if (extractorLine === undefined) {
    const v = spawnSync("pdftotext", ["-v"], { encoding: "utf8" });
    extractorLine = `${v.stdout ?? ""}${v.stderr ?? ""}`.split(/\r?\n/).find((l) => /version/i.test(l))?.trim() ?? "absent";
  }
  return extractorLine.includes(REFERENCE_EXTRACTOR);
}

export function pdfText(file, mode) {
  const sha = (b) => createHash("sha256").update(b).digest("hex");
  if (!existsSync(file)) return { ok: false, refused: true, why: `${file} is not on disk` };
  if (manifestCache === undefined) {
    try {
      manifestCache = JSON.parse(readFileSync(REFERENCE_MANIFEST, "utf8"));
    } catch (err) {
      manifestCache = null;
      return { ok: false, refused: true, why: `${REFERENCE_MANIFEST} could not be read (${err.message})` };
    }
  }
  if (!manifestCache) return { ok: false, refused: true, why: `${REFERENCE_MANIFEST} could not be read` };
  const pdfSha256 = sha(readFileSync(file));
  const entry = manifestCache.entries.find((e) => e.pdfSha256 === pdfSha256 && e.mode === mode);
  if (!entry) {
    const result = { ok: false, refused: true, why: `${file} (sha256 ${pdfSha256.slice(0, 12)}) has no ${mode} reference; a PDF that changed is refused` };
    referenceLog.push({ file, mode, ...result });
    return result;
  }
  const bytes = readFileSync(entry.file);
  if (sha(bytes) !== entry.textSha256) {
    const result = { ok: false, refused: true, why: `${entry.file} does not hash to its manifest entry` };
    referenceLog.push({ file, mode, ...result });
    return result;
  }
  const text = bytes.toString("utf8");
  if (hereIs400()) {
    const fresh = spawnSync("pdftotext", [`-${mode}`, file, "-"], { maxBuffer: 64 * 1024 * 1024 });
    if (fresh.status !== 0 || !Buffer.from(fresh.stdout).equals(bytes)) {
      const result = { ok: false, refused: true, why: `${entry.file} is not what ${extractorLine} reads from ${file} today` };
      referenceLog.push({ file, mode, ...result });
      return result;
    }
  }
  const how = hereIs400()
    ? `reference text, confirmed byte for byte by ${extractorLine}`
    : `reference text (${extractorLine} here, so not re-derived)`;
  referenceLog.push({ file, mode, ok: true, how });
  return { ok: true, text, how };
}

/** Whitespace removed entirely, for comparison. Every other character is kept, in order. */
export const squash = (s) => String(s).replace(/\s+/g, "");

const ENTITIES = { "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&amp;": "&" };
const decode = (s) => s.replace(/&(lt|gt|quot|apos|amp);/g, (m) => ENTITIES[m]);

/**
 * The plain text of a Word document's body, from its XML.
 *
 * Exported so the audit can prove it against a document it builds itself, with
 * a known answer, rather than trusting it the first time it meets a real one.
 */
export function docxXmlToText(xml) {
  const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  return paragraphs
    .map((p) => {
      let line = "";
      const runs = p.match(/<w:r[ >][\s\S]*?<\/w:r>/g) ?? [];
      for (const r of runs) {
        const parts = r.match(/<w:t(?: [^>]*)?>[\s\S]*?<\/w:t>|<w:tab\/>/g) ?? [];
        for (const part of parts) line += part === "<w:tab/>" ? "\t" : decode(part.replace(/<[^>]+>/g, ""));
      }
      return line;
    })
    .join("\n");
}

/** Read a source document as text. `{ ok: true, text, how }` or `{ ok: false, why }`. */
export function documentText(file) {
  if (!existsSync(file)) return { ok: false, why: `${file} is not on disk` };

  if (/\.pdf$/i.test(file)) {
    /* Served from its pinned reference text (ruling (a), 2026-10-22); a refusal
     * carries `refused: true` and is a finding, not an unreadable document. */
    return pdfText(file, "layout");
  }

  if (/\.docx$/i.test(file)) {
    const run = spawnSync("unzip", ["-p", file, "word/document.xml"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (run.error || run.status !== 0 || !run.stdout) {
      return { ok: false, why: `unzip could not read word/document.xml from ${file} (${run.error?.message ?? `exit ${run.status}`})` };
    }
    return { ok: true, text: docxXmlToText(run.stdout), how: "word/document.xml" };
  }

  return { ok: false, why: `${file} is neither a PDF nor a Word file, so there is no way to read it here` };
}

/**
 * Every string a declaration transcribes that does not appear in its source,
 * compared with whitespace removed. Grouped by what kind of string it is, so a
 * failure names what was dropped or invented rather than a count.
 *
 * Enforced rules are compared only where their `at` names the document, the
 * same scoping protocol-registry-audit has applied to RC-001 since 2026-09-18.
 */
export function transcriptionMisses(entry, sourceText) {
  const doc = squash(sourceText);
  const d = entry.declaration;
  const miss = (list, text, name) => list.filter((x) => !doc.includes(squash(text(x)))).map(name);

  const criteria = [];
  for (const det of d.determinations) {
    for (const c of det.criteria) if (!doc.includes(squash(c))) criteria.push(`${det.key}: ${c.slice(0, 40)}`);
  }

  const groups = {
    "intake questions": miss(d.intakeQuestions, (q) => q.ask, (q) => `Q${q.number}`),
    "checklist labels": miss(d.checklist, (i) => i.label, (i) => i.key),
    "determination criteria": criteria,
    "photo procedure steps": miss(d.photoProcedure, (p) => p.text, (p) => `step ${p.step}`),
    thresholds: miss(d.thresholds, (t) => t.states, (t) => t.key),
    "enforced rules from the document": miss(
      entry.enforced.filter((r) => /section|Appendix/.test(r.at)),
      (r) => r.rule,
      (r) => r.key,
    ),
  };

  const compared =
    d.intakeQuestions.length +
    d.checklist.length +
    d.determinations.reduce((n, det) => n + det.criteria.length, 0) +
    d.photoProcedure.length +
    d.thresholds.length +
    entry.enforced.filter((r) => /section|Appendix/.test(r.at)).length;

  return { groups, compared, documentNumberPresent: doc.includes(squash(d.documentNumber)) };
}
