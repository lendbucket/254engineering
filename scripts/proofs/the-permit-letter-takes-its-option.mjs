/**
 * THE STRUCTURAL LETTER FOR PERMIT TAKES THE OPTION HE CHOSE, AND OPTION B
 * NEVER GOES OUT WITH AN EMPTY SCHEDULE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-permit-letter-takes-its-option.mjs
 *
 * Operator ruling, 2026-10-22, from the engineer of record's email that day
 * (docs/rulings-2026-10-22.md):
 *   A  acceptable with no conditions: a pass.
 *   B  acceptable only with a condition (a load limit or something the
 *      contractor must do): a pass, and the condition is listed in the
 *      letter's schedule.
 *   C  repairs required: not a pass.
 *
 * Three things are proved: the rule (src/lib/structural-letter-verdict.ts),
 * against every determination and both edges of B; the three sentences, as
 * LITERALS typed here and never read back from the module; and that each
 * sentence is in his Word file, template 7, read from the file itself.
 */
import { documentText, ensurePrivateSources, squash } from "../lib/protocol-source.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { structuralLetterVerdict } = await import("../../src/lib/structural-letter-verdict.ts");
const { STRUCTURAL_LETTER_OPTION_SENTENCE } = await import("../../src/content/letters/structural-letter.ts");
const { PRIVATE_SOURCES, PROTOCOL_SOURCE_BUCKET } = await import("../../src/content/protocols/private-sources.ts");

/* His three sentences, typed here from template 7 so a drifted module cannot agree with itself. */
const HIS = {
  A: "In my opinion, {{element_described}} satisfies the requirement stated above.",
  B: "In my opinion, {{element_described}} satisfies the requirement stated above subject to the conditions in the attached schedule.",
  C: "In my opinion, {{element_described}} does not satisfy the requirement stated above.",
};

/* ------------------------------------------------------------ 1. the rule */

const v = (determination, option, conditions = []) => structuralLetterVerdict({ determination, option, conditions });

{
  const a = v("pass", "A");
  check("A: a pass with no conditions issues the letter with option A", a.ok && a.option === "A" && a.sentence === HIS.A);
  const b = v("pass", "B", ["Load limited to 40 psf live load."]);
  check(
    "B: a pass with a condition issues the letter with option B, and the condition is in its schedule",
    b.ok && b.option === "B" && b.sentence === HIS.B && b.conditions.length === 1,
  );
  const c = v("repairs-required", null);
  check("C: repairs required issues the letter with option C, and it is not a pass", c.ok && c.option === "C" && c.sentence === HIS.C);

  const bEmpty = v("pass", "B", []);
  check(
    "B with an empty schedule is refused, and says what to do",
    !bEmpty.ok && bEmpty.letter === true && /lists none/.test(bEmpty.why),
    bEmpty.ok ? "IT ISSUED" : bEmpty.why.slice(0, 70),
  );
  const bBlank = v("pass", "B", ["   ", ""]);
  check("and so is B whose only conditions are blank", !bBlank.ok, bBlank.ok ? "IT ISSUED" : "refused");
  const aWith = v("pass", "A", ["Install the specified hanger."]);
  check("A with a condition listed is refused: A says there is none", !aWith.ok && aWith.letter === true, aWith.ok ? "IT ISSUED" : "refused");
  const passNone = v("pass", null);
  check("a pass with no option chosen is refused: he chooses A or B", !passNone.ok, passNone.ok ? "IT ISSUED" : "refused");
  const passC = v("pass", "C");
  check("a pass cannot carry option C", !passC.ok, passC.ok ? "IT ISSUED" : "refused");
  const repairsA = v("repairs-required", "A");
  check("and repairs required cannot carry option A", !repairsA.ok, repairsA.ok ? "IT ISSUED" : "refused");
  for (const d of ["revise", "site-revisit", "decline"]) {
    const r = v(d, null);
    check(`${d} produces no letter`, !r.ok && r.letter === false, r.ok ? "IT ISSUED" : "no letter");
  }
}

/* ------------------------------------------- 2. the sentences are his, here */

for (const k of ["A", "B", "C"]) {
  check(`option ${k}'s sentence is his, word for word`, STRUCTURAL_LETTER_OPTION_SENTENCE[k] === HIS[k]);
}

/* ------------------------------------------- 3. and in his Word file */

{
  const path = "docs/protocols/incoming/v1.1/254_Letter_Templates.docx";
  const [fetched] = await ensurePrivateSources(PRIVATE_SOURCES.filter((s) => s.path === path), PROTOCOL_SOURCE_BUCKET);
  if (!fetched || fetched.unreachable) {
    console.log(`COULD NOT TELL: the template file was not available (${fetched?.why ?? "not declared"}).`);
    process.exit(3);
  }
  check("the letter templates are his file, by SHA-256 and size", fetched.ok, fetched.why ?? fetched.how);
  const read = documentText(path);
  if (!read.ok) {
    console.log(`COULD NOT TELL: the template file was not read, because ${read.why}.`);
    process.exit(3);
  }
  /* The body heading is followed by a line break; the table of contents' copy by a tab. */
  const start = read.text.indexOf("Template 7 of 8: Structural letter for permit\n");
  const end = read.text.indexOf("Template 8 of 8: ", start + 1);
  check("template 7 itself was found, not its line in the contents", start > 0 && end > start, `${start} to ${end}`);
  const section = squash(read.text.slice(start, end));
  for (const k of ["A", "B", "C"]) {
    check(`option ${k} is in template 7`, section.includes(squash(HIS[k])));
  }
}

console.log("");
if (wrong === 0) {
  console.log("PASS: the permit letter takes the option he chose, and option B never goes out with an empty schedule.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
