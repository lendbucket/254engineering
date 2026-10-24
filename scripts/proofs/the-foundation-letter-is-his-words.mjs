/**
 * THE FOUNDATION LETTER IS HIS WORDS, IN HIS ORDER.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-foundation-letter-is-his-words.mjs
 *
 * Every fixed line, option sentence and method value in
 * src/content/letters/foundation-certification.ts is compared, whitespace
 * aside, against template 4 of the engineer's answered letter templates file
 * (the file the roof letter is proved against), read from the private source
 * by SHA-256. The firm's choices (FC-1 which option each determination takes,
 * FC-4 which method a crawlspace takes) are asserted as choices between his
 * sentences, never as words of the firm's.
 */
import { documentText, ensurePrivateSources, squash } from "../lib/protocol-source.mjs";

const { ROOF_LETTER_SOURCE } = await import("../../src/content/letters/roof-certification.ts");
const {
  FOUNDATION_LETTER_LINES,
  FOUNDATION_LETTER_OPTION_SENTENCE,
  FOUNDATION_LETTER_METHOD,
  FOUNDATION_LETTER_SLOTS,
  methodFor,
} = await import("../../src/content/letters/foundation-certification.ts");
const { PRIVATE_SOURCES, PROTOCOL_SOURCE_BUCKET } = await import("../../src/content/protocols/private-sources.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

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
  /* Anchored on the body heading followed by a line break, so the table of contents is never read. */
  const start = text.indexOf("Template 4 of 8: Foundation certification letter\n");
  const end = text.indexOf("Template 5 of 8: ", start + 1);
  check("section 5 of the document was found, so the comparison reads template 4", start > 0 && end > start, `${start} to ${end}`);
  const section = squash(text.slice(start, end));

  let at = 0;
  const outOfOrder = [];
  const missing = [];
  for (const line of FOUNDATION_LETTER_LINES) {
    if (["determination", "observed", "heading"].includes(line.kind)) continue;
    const k = section.indexOf(squash(line.text), at);
    if (k < 0) {
      if (section.includes(squash(line.text))) outOfOrder.push(line.text.slice(0, 50));
      else missing.push(line.text.slice(0, 50));
      continue;
    }
    at = k + squash(line.text).length;
  }
  check(
    "every fixed line of the letter is in his section 5.3, word for word",
    missing.length === 0,
    missing.length ? `NOT IN THE DOCUMENT: ${missing.join(" | ")}` : `${FOUNDATION_LETTER_LINES.length} lines`,
  );
  check("and in his order", outOfOrder.length === 0, outOfOrder.join(" | ") || "");

  const LABEL = { pass: "[ENGINEER: option A]", "repairs-required": "[ENGINEER: option B]", decline: "[ENGINEER: option C]" };
  for (const [key, sentence] of Object.entries(FOUNDATION_LETTER_OPTION_SENTENCE)) {
    check(`the ${key} sentence is the one he printed under ${LABEL[key]}`, section.includes(squash(`${LABEL[key]} ${sentence}`)), sentence.slice(0, 60));
  }
  check(
    "there are exactly three option sentences, because he wrote no option D",
    Object.keys(FOUNDATION_LETTER_OPTION_SENTENCE).length === 3 && section.includes(squash("[ENGINEER: No option D.")),
  );

  for (const [key, value] of Object.entries(FOUNDATION_LETTER_METHOD)) {
    check(`his method sentence "${key}" is his, word for word`, section.includes(squash(`"${value}"`)), value);
  }
  /* FC-4: the firm's choice between his two sentences, pinned. */
  check("slab-on-grade takes the visual method", methodFor("slab-on-grade") === FOUNDATION_LETTER_METHOD.visual);
  check("pier-and-beam takes the crawlspace method, as he wrote", methodFor("pier-and-beam") === FOUNDATION_LETTER_METHOD.crawlspace);
  check("crawlspace takes the crawlspace method (FC-4)", methodFor("crawlspace") === FOUNDATION_LETTER_METHOD.crawlspace);
  check("any other type takes no method, so the draft refuses", methodFor("basement") === null);

  /* The suggestions he declined are not on the letter. */
  check("the service life sentence he left out is not on the letter", !FOUNDATION_LETTER_LINES.some((l) => /service life/i.test(l.text)));

  const used = new Set(FOUNDATION_LETTER_LINES.flatMap((l) => [...l.text.matchAll(/{{([a-z_]+)}}/g)].map((m) => m[1])));
  const undeclared = [...used].filter((s) => !FOUNDATION_LETTER_SLOTS.includes(s));
  const unused = FOUNDATION_LETTER_SLOTS.filter((s) => !used.has(s));
  check("every slot a line names is declared, and every declared slot is used", undeclared.length === 0 && unused.length === 0, [...undeclared, ...unused].join(", "));

  console.log("");
  if (wrong === 0) {
    console.log("PASS: the foundation letter is his words, in his order.");
    process.exitCode = 0;
  } else {
    console.log(`FAIL: ${wrong} check(s).`);
    process.exitCode = 1;
  }
}
