/**
 * THE ROOF LETTER IS HIS WORDS, IN HIS ORDER.
 *
 * src/content/letters/roof-certification.ts transcribes template 1 of the
 * engineer's reviewed letter templates. This reads the Word file itself, never
 * a second copy of the transcription, and asserts:
 *
 *   1. every fixed sentence appears in section 2.3 of the document, word for
 *      word, compared with whitespace removed (CLAUDE.md section 3: the
 *      document wins, punctuation included);
 *   2. they appear in the transcription's order;
 *   3. each determination sentence is the one the document prints under ITS
 *      option, so A cannot be filed under decline;
 *   4. every slot a line names is declared, and every declared slot is used.
 *
 * Exits non-zero on any failure, or prints COULD NOT TELL when the Word reader
 * cannot run, which is not a pass.
 */
import { documentText, ensurePrivateSources, squash } from "../lib/protocol-source.mjs";

const {
  ROOF_LETTER_SOURCE,
  ROOF_LETTER_LINES,
  ROOF_LETTER_DETERMINATION_SENTENCE,
  ROOF_LETTER_SLOTS,
} = await import("../../src/content/letters/roof-certification.ts");
const { PRIVATE_SOURCES, PROTOCOL_SOURCE_BUCKET } = await import("../../src/content/protocols/private-sources.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/*
 * The Word file left the public tree on 2026-10-22 (migration 0080). It is
 * fetched from the private bucket into its old path and proved by digest and
 * size first; a fetch that could not reach development is COULD NOT TELL.
 */
const [fetched] = await ensurePrivateSources(
  PRIVATE_SOURCES.filter((s) => s.path === ROOF_LETTER_SOURCE),
  PROTOCOL_SOURCE_BUCKET,
);
if (!fetched) {
  check("the letter templates are declared as a private source", false, `${ROOF_LETTER_SOURCE} is in no PRIVATE_SOURCES entry`);
} else if (fetched.unreachable) {
  console.log(`COULD NOT TELL: ${fetched.why}.`);
  process.exit(3);
} else {
  check("the letter templates are the engineer's file, by SHA-256 and size", fetched.ok, fetched.why ?? fetched.how);
}

const read = documentText(ROOF_LETTER_SOURCE);
if (!read.ok) {
  console.log(`COULD NOT TELL: the template file was not read, because ${read.why}.`);
  process.exitCode = 1;
} else {
  const text = read.text;
  /*
   * The table of contents repeats every heading, followed by a tab and a page
   * number. The body heading is followed by a line break, so anchoring on that
   * reads template 1 itself. The first version of this proof anchored on the
   * bare heading, landed in the contents, and failed every line: a proof
   * pointed at the wrong span, caught because it went red rather than green.
   */
  const start = text.indexOf("Template 1 of 8: Roof certification letter\n");
  const end = text.indexOf("Template 2 of 8: ", start + 1);
  check("section 2 of the document was found, so the comparison reads template 1", start > 0 && end > start, `${start} to ${end}`);
  const section = squash(text.slice(start, end));

  let at = 0;
  const outOfOrder = [];
  const missing = [];
  for (const line of ROOF_LETTER_LINES) {
    if (line.kind === "determination" || line.kind === "heading") continue;
    const k = section.indexOf(squash(line.text), at);
    if (k < 0) {
      if (section.includes(squash(line.text))) outOfOrder.push(line.text.slice(0, 50));
      else missing.push(line.text.slice(0, 50));
      continue;
    }
    at = k + squash(line.text).length;
  }
  check(
    "every fixed line of the letter is in his section 2.3, word for word",
    missing.length === 0,
    missing.length ? `NOT IN THE DOCUMENT: ${missing.join(" | ")}` : `${ROOF_LETTER_LINES.length} lines`,
  );
  check("and in his order", outOfOrder.length === 0, outOfOrder.join(" | ") || "");

  const LABEL = {
    pass: "[ENGINEER: option A, passing]",
    "repairs-required": "[ENGINEER: option B, repairs required]",
    decline: "[ENGINEER: option C, declined]",
  };
  for (const [key, sentence] of Object.entries(ROOF_LETTER_DETERMINATION_SENTENCE)) {
    check(
      `the ${key} sentence is the one he printed under ${LABEL[key]}`,
      section.includes(squash(`${LABEL[key]} ${sentence}`)),
      sentence.slice(0, 60),
    );
  }
  check(
    "there are exactly three determination sentences, because he wrote no option D",
    Object.keys(ROOF_LETTER_DETERMINATION_SENTENCE).length === 3 && section.includes(squash("[ENGINEER: No option D.")),
  );

  const used = new Set(ROOF_LETTER_LINES.flatMap((l) => [...l.text.matchAll(/{{([a-z_]+)}}/g)].map((m) => m[1])));
  const undeclared = [...used].filter((s) => !ROOF_LETTER_SLOTS.includes(s));
  const unused = ROOF_LETTER_SLOTS.filter((s) => !used.has(s));
  check("every slot a line names is declared, and every declared slot is used", undeclared.length === 0 && unused.length === 0, [...undeclared, ...unused].join(", "));

  console.log("");
  if (wrong === 0) {
    console.log("PASS: the roof letter is his words, in his order.");
    process.exitCode = 0;
  } else {
    console.log(`FAIL: ${wrong} check(s).`);
    process.exitCode = 1;
  }
}
