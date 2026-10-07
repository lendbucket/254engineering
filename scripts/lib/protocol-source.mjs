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
import { existsSync } from "node:fs";

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
    const run = spawnSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (run.error || run.status !== 0) {
      return { ok: false, why: `pdftotext could not read ${file} (${run.error?.message ?? `exit ${run.status}`})` };
    }
    return { ok: true, text: run.stdout, how: "pdftotext -layout" };
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
