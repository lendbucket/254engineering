// Transcribes the engineer's v1.1 protocols from their PDFs into
// src/content/protocols/<id>.ts. Run from the repository root:
//
//   node scripts/transcribe-received-protocols.mjs [ws-001 ...]
//
// Writes the files with fs, never through the shell. Every string is the
// document's own, as pdftotext -raw extracts it; nothing is reworded.
//
// THIS SCRIPT IS NOT THE PROOF. Its output is proved against the PDFs by
// protocol-registry-audit section 8, which reads the documents itself and never
// imports anything from here, so a defect in this reader is a red board rather
// than a transcription that agrees with its own mistakes. Four cell boundaries
// in WP-001 were wrong in the first version and that section is what said so.
//
// What is a reading rather than the document, and is said so in the output:
// which group a question belongs to, which column of the WP-001 table a
// fragment sits in, and that every WP-001 table item is photographed, which
// Appendix A's procedure states for every item rather than item by item.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const DIR = "docs/protocols/incoming/v1.1";
const PROTOCOLS = [
  { id: "ws-001", constName: "WS001", file: "254-WS-001_Windstorm_Certification_Protocol_v1_1.pdf", slug: "windstorm-wpi-8", tier: "completed" },
  { id: "mh-001", constName: "MH001", file: "254-MH-001_Manufactured_Home_Foundation_Certification_Protocol_v1_1.pdf", slug: "manufactured-home-foundation-certifications", tier: null },
  { id: "sl-001", constName: "SL001", file: "254-SL-001_Solar_Structural_Letter_Protocol_v1_1.pdf", slug: "solar-structural-letters", tier: null },
  { id: "pl-001", constName: "PL001", file: "254-PL-001_Structural_Letter_Protocol_v1_1.pdf", slug: "structural-letters", tier: null },
  { id: "rs-001", constName: "RS001", file: "254-RS-001_Repair_Specification_Protocol_v1_1.pdf", slug: "repair-specifications", tier: null },
  { id: "ds-001", constName: "DS001", file: "254-DS-001_Structural_Design_Protocol_v1_1.pdf", slug: "residential-light-commercial-design", tier: null },
  { id: "wp-001", constName: "WP001", file: "254-WP-001_Windstorm_Inspection_Protocol_v1_1.pdf", slug: "windstorm-wpi-8", tier: "ongoing" },
];

const FOOTER = /^254 Engineering Services \| 254-[A-Z]{2}-\d{3} .* \| Page \d+$/;
const BULLET = String.fromCodePoint(0xfffd);

/** The document as lines: raw extraction, page footers removed, blank lines dropped, the bullet glyph shown as a bullet. */
export function documentLines(pdf) {
  const raw = execFileSync("pdftotext", ["-raw", pdf, "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return raw
    .split(/\r?\n/)
    .map((l) => l.split("\f").join("").replace(/\s+$/, "").split(BULLET).join("•"))
    .filter((l) => l.trim() !== "" && !FOOTER.test(l.trim()));
}

/** Joins a wrapped line onto the one before it, with no space where a word was broken at a hyphen. */
function join(a, b) {
  if (/-$/.test(a) && /^[a-z]/.test(b)) return a + b;
  return `${a} ${b}`;
}

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/\[photo\]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 6)
    .join("-") || "item";

function uniqueKeys() {
  const seen = new Map();
  return (base) => {
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };
}

const indexOfLine = (lines, re, from = 0) => {
  for (let i = from; i < lines.length; i += 1) if (re.test(lines[i])) return i;
  return -1;
};

function header(lines) {
  const keys = ["Title", "Document number", "Version", "Issue date", "Prepared by", "Approval", "Applies to", "Supersedes"];
  const start = indexOfLine(lines, /^Document Value$/);
  const end = indexOfLine(lines, /^1\. Purpose$/);
  const out = {};
  let current = null;
  for (let i = start + 1; i < end; i += 1) {
    const line = lines[i];
    const key = keys.find((k) => line === k || line.startsWith(`${k} `));
    if (key) {
      current = key;
      out[key] = line.slice(key.length).trim();
    } else if (current) {
      out[current] = out[current] ? join(out[current], line) : line;
    }
  }
  return out;
}

const GROUPS = [
  [/^Purpose/, "purpose-and-recipient"],
  [/^(Property basics|Project basics|Proposed array)/, "property-basics"],
  [/^Flags/, "flags"],
  [/^Access/, "access-and-safety"],
  [/^(Prior paperwork|Documents prompt)/, "prior-paperwork"],
];
const groupKey = (heading) => (GROUPS.find(([re]) => re.test(heading)) ?? [null, "property-basics"])[1];

function intake(lines) {
  const a = indexOfLine(lines, /^Appendix A\. /);
  const p1 = indexOfLine(lines, /^PART 1: /, a);
  const p2 = indexOfLine(lines, /^PART 2: /, p1);
  const b = indexOfLine(lines, /^Appendix B\. /, p2);
  if (a < 0 || p1 < 0 || p2 < 0 || b < 0) return null;

  const questions = [];
  let group = null;
  let q = null;
  for (let i = p1 + 1; i < p2; i += 1) {
    const line = lines[i];
    const start = line.match(/^(\d+)\. (.*)$/);
    if (start) {
      q = { number: Number(start[1]), groupHeading: group, ask: start[2] };
      questions.push(q);
      continue;
    }
    if (/^Answer:/.test(line) || /^Yes No\b/.test(line)) {
      q = null;
      continue;
    }
    if (q) q.ask = join(q.ask, line);
    else group = group && !questions.some((x) => x.groupHeading === group) ? join(group, line) : line;
  }

  const TIERS = [
    [/^Required$/, "required"],
    [/^Required if it exists$/, "required-if-exists"],
    [/^Collect when applicable$/, "when-applicable"],
    [/^Required before the engineer calculates$/, "before-calculation"],
  ];
  const uploads = [];
  let tier = null;
  let u = null;
  for (let i = p2 + 1; i < b; i += 1) {
    const line = lines[i];
    const t = TIERS.find(([re]) => re.test(line));
    if (t) {
      tier = { key: t[1], heading: line };
      u = null;
      continue;
    }
    if (line.startsWith("-- ")) {
      u = { tier: tier.key, tierHeading: tier.heading, what: line.slice(3) };
      uploads.push(u);
      continue;
    }
    if (u) u.what = join(u.what, line);
  }
  return {
    part1: lines[p1],
    part2: lines[p2],
    questions: questions.map((x) => ({
      number: x.number,
      group: groupKey(x.groupHeading ?? ""),
      groupHeading: x.groupHeading,
      ask: x.ask,
      flag: /^Flags/.test(x.groupHeading ?? ""),
      verbatim: /record exactly/i.test(x.ask),
      at: "Appendix A, Part 1",
    })),
    uploads,
  };
}

const isHeading = (line) =>
  /^[A-Z][A-Z'&/ ]{2,}/.test(line) && !line.includes("____") && !line.startsWith("[ ]") && !/:$/.test(line);

function checklist(lines, nextAppendix) {
  const b = indexOfLine(lines, /^Appendix B\. /);
  const c = indexOfLine(lines, nextAppendix, b);
  if (b < 0 || c < 0) return null;
  const photos = indexOfLine(lines, /^PHOTOS$/, b);
  const procedure = [];
  let i = photos + 1;
  for (; i < c && !isHeading(lines[i]); i += 1) {
    if (lines[i].startsWith("-- ")) procedure.push({ step: procedure.length + 1, text: lines[i].slice(3), at: "Appendix B, PHOTOS" });
    else if (procedure.length) procedure[procedure.length - 1].text = join(procedure[procedure.length - 1].text, lines[i]);
  }

  const key = uniqueKeys();
  const sections = [];
  const items = [];
  const counts = [];
  let section = null;
  let item = null;
  let field = null;
  for (; i < c; i += 1) {
    const line = lines[i];
    if (line.startsWith("[ ]")) {
      field = null;
      item = { text: line.slice(3).trim(), section: section?.key ?? null };
      items.push(item);
      continue;
    }
    if (/^_+$/.test(line)) {
      continue;
    }
    if (line.includes("____") || /:$/.test(line)) {
      item = null;
      if (/^Technician notes \/ readings:$/.test(line)) {
        field = null;
        continue;
      }
      if (field && !/:\s*_/.test(line) && /^_/.test(line)) continue;
      field = { prompt: line, section: section?.key ?? null };
      counts.push(field);
      continue;
    }
    if (isHeading(line)) {
      item = null;
      field = null;
      if (section && /\([^)]*$/.test(section.heading)) {
        section.heading = join(section.heading, line);
        continue;
      }
      section = { key: key(slugify(line.replace(/\(.*$/, ""))), heading: line, at: "Appendix B" };
      sections.push(section);
      continue;
    }
    if (item) item.text = join(item.text, line);
    else if (section && /\([^)]*$/.test(section.heading)) section.heading = join(section.heading, line);
    else if (field) field.prompt = join(field.prompt, line);
  }

  const itemKey = uniqueKeys();
  const out = items
    .map((x) => {
      const photo = /\[PHOTO\]$/.test(x.text);
      const label = x.text.replace(/\s*\[PHOTO\]$/, "");
      return { label, photo, section: x.section };
    })
    .filter((x) => label(x).replace(/_/g, "").trim() !== "")
    .map((x) => ({
      key: itemKey(slugify(x.label)),
      section: x.section,
      label: x.label,
      photo: x.photo,
      ruler: /ruler in frame|tape in frame/i.test(x.label),
      perOccurrence: /^(Every|Each)\b/.test(x.label),
      coveringOnly: null,
      capture: null,
      at: "Appendix B",
    }));
  const blankJobListItems = items.filter((x) => x.text.replace(/\[PHOTO\]/, "").replace(/_/g, "").trim() === "").length;
  return {
    sections,
    photoProcedure: procedure,
    checklist: out,
    counts: counts.map((f, n) => ({ key: `field-${n + 1}`, prompt: f.prompt, at: "Appendix B" })),
    blankJobListItems,
  };
  function label(x) {
    return x.label;
  }
}

const DETERMINATIONS = [
  [/^PASS\b/, "pass"],
  [/^REVISE\b(?! AND REISSUE)/, "revise"],
  [/^REPAIRS REQUIRED\b/, "repairs-required"],
  [/^SITE REVISIT\b/, "site-revisit"],
  [/^DECLINE\b/, "decline"],
];
const OTHER_RULES = [/^ACCEPT WITH CONDITIONS$/, /^ACCEPT$/, /^DECLINE$/, /^ISSUE CHECK\b/, /^REVISE AND REISSUE$/];

function decisions(lines, design) {
  const c = indexOfLine(lines, /^Appendix C\. /);
  const d = indexOfLine(lines, /^Appendix D\. /, c);
  if (c < 0 || d < 0) return null;
  const rules = [];
  let rule = null;
  let crit = null;
  for (let i = c + 1; i < d; i += 1) {
    const line = lines[i];
    const det = design ? null : DETERMINATIONS.find(([re]) => re.test(line));
    const other = design ? OTHER_RULES.find((re) => re.test(line)) : null;
    if (det || other) {
      const paren = line.match(/\(([^)]*)\)/);
      rule = {
        key: det ? det[1] : slugify(line.replace(/\(.*$/, "")),
        heading: line,
        effect: paren ? paren[1] : null,
        criteria: [],
        at: "Appendix C",
      };
      rules.push(rule);
      crit = null;
      continue;
    }
    if (!rule) continue;
    if (line.startsWith("-- ")) {
      crit = line.slice(3);
      rule.criteria.push(crit);
      continue;
    }
    if (crit !== null) {
      rule.criteria[rule.criteria.length - 1] = join(rule.criteria[rule.criteria.length - 1], line);
      crit = rule.criteria[rule.criteria.length - 1];
    }
  }
  return rules;
}

/**
 * WP-001's checklist is a three column table per stage: Item, Record,
 * Reference. Read from the LAYOUT extraction, where columns keep their
 * positions. Cell boundaries are this function's reading of the table; the
 * words and their order are proved against the PDF by the audit, the
 * boundaries cannot be, and the file says so.
 */
function wpStages(pdf) {
  const layout = execFileSync("pdftotext", ["-layout", pdf, "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split(/\r?\n/)
    .map((l) => l.split("\f").join("").replace(/\s+$/, ""))
    .filter((l) => !FOOTER.test(l.trim()));
  const stages = [];
  const items = [];
  let stage = null;
  let row = null;
  let itemCol = 0;
  let recordCol = 24;
  let refCol = 81;
  const REF_START = /\b(IRC|TDI|Manufacturer|Construction|Truss|Adopted|Section|Table|construction|manufacturer)\b/g;
  const refFrags = new Set();
  const startA = layout.findIndex((l) => /^Appendix A\. /.test(l.trim()));
  const startB = layout.findIndex((l, k) => k > startA && /^Appendix B\. /.test(l.trim()));
  for (let i = startA; i < startB; i += 1) {
    const line = layout[i];
    if (line.trim() === "") continue;
    const st = line.trim().match(/^Stage (\d+)\. (.*)$/);
    if (st) {
      stage = { key: `stage-${st[1]}`, heading: line.trim(), at: "Appendix A" };
      stages.push(stage);
      row = null;
      continue;
    }
    if (!stage) continue;
    if (/^Item\s+Record\s+Reference$/.test(line.trim())) {
      itemCol = line.indexOf("Item");
      recordCol = line.indexOf("Record");
      refCol = line.indexOf("Reference");
      continue;
    }
    const cells = { item: "", record: "", reference: "" };
    const segs = [...line.matchAll(/\S+(?: \S+)*/g)].map((m) => ({ text: m[0], start: m.index, end: m.index + m[0].length }));
    for (const s of segs) {
      let text = s.text;
      let start = s.start;
      if (start < recordCol - 2 && s.end > recordCol + 2) {
        // An item cell running into the record with one space: the record starts at the next capitalised word.
        const words = text.split(" ");
        let k = 1;
        while (k < words.length && !/^[A-Z]/.test(words[k])) k += 1;
        cells.item = words.slice(0, k).join(" ");
        text = words.slice(k).join(" ");
        start = s.start + cells.item.length + 1;
        if (!text) continue;
      }
      if (start < refCol - 2 && s.end > refCol + 3) {
        // A record cell running into the reference with one space.
        let split = -1;
        for (const m of text.matchAll(REF_START)) if (start + m.index >= refCol - 12) { split = m.index; break; }
        if (split > 0) {
          cells.record = (cells.record ? `${cells.record} ` : "") + text.slice(0, split).trim();
          cells.reference = text.slice(split).trim();
          continue;
        }
      }
      if (start < recordCol - 2) cells.item = cells.item ? `${cells.item} ${text}` : text;
      else if (start < refCol - 2) cells.record = cells.record ? `${cells.record} ${text}` : text;
      else cells.reference = cells.reference ? `${cells.reference} ${text}` : text;
    }
    if (cells.reference) refFrags.add(cells.reference);
    if (line.search(/\S/) <= itemCol && cells.item) {
      row = { stage: stage.key, item: cells.item, record: cells.record, reference: cells.reference };
      items.push(row);
    } else if (row) {
      if (cells.item) row.item = join(row.item, cells.item);
      if (cells.record) row.record = row.record ? join(row.record, cells.record) : cells.record;
      if (cells.reference) row.reference = row.reference ? join(row.reference, cells.reference) : cells.reference;
    }
  }
  /*
   * SECOND PASS: the layout decides WHICH COLUMN a fragment is in, the raw
   * extraction decides WHICH ROW. In layout mode the reference column is
   * printed beside whatever row happens to share its baseline, so a reference
   * can sit a row early or late; the raw extraction keeps each row's cells
   * together in reading order. Item names come from the layout pass, which
   * reads the first column reliably.
   */
  const raw = documentLines(pdf);
  const rA = raw.findIndex((l) => /^Stage 1\. /.test(l));
  const rB = raw.findIndex((l, k) => k > rA && /^Appendix B\. /.test(l));
  const frags = [...refFrags].sort((a, b) => b.length - a.length);
  const rebuilt = [];
  const rawStages = [];
  let current = null;
  let inItem = false;
  let lastWasRef = true;
  for (const line of raw.slice(rA, rB)) {
    const st = line.match(/^Stage (\d+)\. (.*)$/);
    if (st) {
      rawStages.push({ key: `stage-${st[1]}`, heading: line, at: "Appendix A" });
      lastWasRef = true;
      current = null;
      continue;
    }
    if (line === "Item Record Reference") continue;
    const whole = frags.find((f) => line === f);
    const tail = whole ? null : frags.find((f) => line.endsWith(` ${f}`));
    const startsRow = lastWasRef && !whole && !/^[a-z(]/.test(line);
    let text = line;
    if (startsRow) {
      const words = line.split(" ");
      let k = 1;
      while (k < words.length && !/^[A-Z]/.test(words[k])) k += 1;
      current = { stage: rawStages[rawStages.length - 1].key, item: words.slice(0, k).join(" "), record: "", reference: "" };
      rebuilt.push(current);
      text = words.slice(k).join(" ");
      inItem = k === words.length;
      if (tail && text.endsWith(tail)) text = text.slice(0, text.length - tail.length).trim();
      if (text) current.record = text;
      if (tail) current.reference = tail;
      lastWasRef = Boolean(tail);
      continue;
    }
    if (inItem && /^[a-z]/.test(line) && !whole) {
      // An item name wrapped onto the next line: "Roof-mounted" / "equipment", then its record.
      const words = line.split(" ");
      let k = 0;
      while (k < words.length && !/^[A-Z]/.test(words[k])) k += 1;
      current.item = `${current.item} ${words.slice(0, k).join(" ")}`;
      text = words.slice(k).join(" ");
      inItem = k === words.length;
      if (text) current.record = current.record ? join(current.record, text) : text;
      continue;
    }
    inItem = false;
    if (whole) {
      current.reference = current.reference ? join(current.reference, whole) : whole;
      lastWasRef = true;
    } else if (tail) {
      const head = line.slice(0, line.length - tail.length - 1);
      current.record = current.record ? join(current.record, head) : head;
      current.reference = current.reference ? join(current.reference, tail) : tail;
      lastWasRef = true;
    } else {
      current.record = current.record ? join(current.record, text) : text;
      lastWasRef = false;
    }
  }
  stages.splice(0, stages.length, ...rawStages);
  items.splice(0, items.length, ...rebuilt);

  const procedure = [];
  for (let i = startA; i < layout.length; i += 1) {
    const t = layout[i].trim();
    if (/^Stage 1\. /.test(t)) break;
    const clean = t.split(BULLET).join("•");
    if (clean.startsWith("• ")) procedure.push({ step: procedure.length + 1, text: clean.slice(2), at: "Appendix A" });
    else if (procedure.length && clean) procedure[procedure.length - 1].text = join(procedure[procedure.length - 1].text, clean);
  }
  const key = uniqueKeys();
  return {
    sections: stages,
    photoProcedure: procedure,
    checklist: items.map((r) => ({
      key: key(`${r.stage}-${slugify(r.item)}`),
      section: r.stage,
      label: r.item,
      photo: true,
      ruler: false,
      perOccurrence: false,
      coveringOnly: null,
      capture: { key: `${r.stage}-${slugify(r.item)}-record`, prompt: r.record, kind: "text" },
      reference: r.reference,
      at: "Appendix A",
    })),
  };
}

function emit(p) {
  const pdf = `${DIR}/${p.file}`;
  const sha256 = createHash("sha256").update(readFileSync(pdf)).digest("hex");
  const lines = documentLines(pdf);
  const h = header(lines);
  const design = p.id === "ds-001";
  const isWp = p.id === "wp-001";
  const intakePart = isWp ? null : intake(lines);
  const listPart = isWp ? wpStages(pdf) : checklist(lines, /^Appendix C\. /);
  const rules = isWp ? [] : decisions(lines, design) ?? [];

  const declaration = {
    documentNumber: h["Document number"],
    title: h.Title,
    version: h.Version,
    issueDate: "2026-10-06",
    issueDateAsPrinted: h["Issue date"],
    preparedBy: h["Prepared by"],
    approvedBy: h.Approval,
    appliesTo: h["Applies to"],
    supersedes: h.Supersedes,
    serviceSlug: p.slug,
    serviceTier: p.tier,
    requiresDiscipline: null,
    sourceFile: pdf,
    sourceSha256: sha256,
    firmNameOnDocument: "254 Engineering Services",
    sections: listPart?.sections ?? [],
    photoProcedure: listPart?.photoProcedure ?? [],
    intakeQuestions: intakePart?.questions ?? [],
    intakeUploads: (intakePart?.uploads ?? []).map((u, n) => ({
      key: `${slugify(u.what)}-${n + 1}`,
      what: u.what,
      tier: u.tier,
      when: null,
      tierHeading: u.tierHeading,
      at: "Appendix A, Part 2",
    })),
    checklist: listPart?.checklist ?? [],
    determinations: design ? [] : rules,
    thresholds: [],
    text: lines,
  };
  const extra = {
    counts: listPart?.counts ?? [],
    otherRules: design ? rules : [],
    blankJobListItems: listPart?.blankJobListItems ?? 0,
  };

  const C = p.constName;
  const src = `/**
 * ${declaration.documentNumber} v${declaration.version}, ${declaration.title}.
 *
 * TRANSCRIBED, NEVER WRITTEN. Generated on 2026-10-07 from the engineer's own
 * PDF, ${pdf}, read with pdftotext -raw, sha256 ${sha256}. Every string below
 * is the document's own, with page footers removed and the bullet glyph shown
 * as a bullet; line wrapping is the extraction's, rejoined. The document is the
 * authority and this file is its implementation, proved against the PDF in both
 * directions by protocol-registry-audit, section 8. It is registered in
 * received.ts and nowhere else.
 *
 * UNSIGNED. Issued 2026-10-06 and not yet signed. The engineer signs it in the
 * portal, from his own session, under ruling 2a of 2026-10-06. Until then it
 * drives nothing: it adds no intake field and opens no line.
 *
 * DO NOT EDIT BY HAND. A change to this file is a change to what the engineer
 * will be asked to sign. Regenerate from the PDF, and only from a new PDF.
 */
export const ${C} = ${JSON.stringify(declaration, null, 2)} as const;

/** Capture fields printed on the checklist, verbatim, blanks included. */
export const ${C}_COUNTS = ${JSON.stringify(extra.counts, null, 2)};

/** Decision rules that are not the five determinations (DS-001 decides by acceptance and an issue check). */
export const ${C}_OTHER_RULES = ${JSON.stringify(extra.otherRules, null, 2)};

/** Checklist lines the document leaves blank for the engineer to write per job. */
export const ${C}_BLANK_JOB_LIST_ITEMS = ${extra.blankJobListItems};
`;
  writeFileSync(`src/content/protocols/${p.id}.ts`, src, "utf8");
  return {
    id: p.id,
    lines: lines.length,
    questions: declaration.intakeQuestions.length,
    flags: declaration.intakeQuestions.filter((q) => q.flag).length,
    uploads: declaration.intakeUploads.length,
    sections: declaration.sections.length,
    items: declaration.checklist.length,
    blank: extra.blankJobListItems,
    steps: declaration.photoProcedure.length,
    rules: rules.length,
    criteria: rules.reduce((n, r) => n + r.criteria.length, 0),
    counts: extra.counts.length,
    title: declaration.title,
    doc: declaration.documentNumber,
    version: declaration.version,
  };
}

const only = process.argv.slice(2);
for (const p of PROTOCOLS.filter((x) => only.length === 0 || only.includes(x.id))) {
  console.log(JSON.stringify(emit(p)));
}
