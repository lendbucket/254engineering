/**
 * The US spelling sweep, one home for voice-audit and the preflight.
 *
 * Moved here from scripts/voice-audit.mjs on 2026-10-29, unchanged in logic,
 * after board 40969663851 missed on it: "licence holder" emitted into
 * src/content/procedures.ts reached a 70 minute board because the preflight
 * checked banned phrases and regulatory claims and not spelling. The sweep
 * reads files only, so it needs no server and the preflight runs it whole.
 *
 * The ruling it carries, as voice-audit wrote it:
 *
/*
 * ===========================================================================
 * US SPELLING IN TEXT THE PLATFORM COMPOSES. PROTOCOL TEXT IS EXEMPT.
 * Operator ruling, 2026-09-21.
 * ===========================================================================
 *
 * THE DISTINCTION IS BY ORIGIN, NOT BY PATH CONVENIENCE, and that is the whole
 * design. `src/content/protocols/` is the transcription of a document the
 * engineer of record signed. Standing law: its text is carried exactly,
 * punctuation included, and the house style loses to the document wherever the
 * two disagree. So a British spelling there is not a defect, it is the
 * document, and changing it would be altering a signed authority.
 *
 * Everything else under `src/` is text this firm wrote, and the operator's
 * ruling is US spelling.
 *
 * AN ALLOWLIST BY PATH WOULD HAVE BEEN THE WRONG SHAPE and was refused for the
 * reason recorded on 2026-09-20: a list somebody grows until the scan checks
 * nothing. This is not that. It is one directory, it is the directory whose
 * contents are verified verbatim against a PDF by `protocol-registry-audit`,
 * and the exemption is COUNTED and NAMED in the output below.
 *
 * WHAT IT READS: string literals only, comments excluded, because a comment is
 * not rendered and this repository's comments are where its reasoning lives.
 */
import { readFileSync as readSrc } from "node:fs";
import { execFileSync as git } from "node:child_process";

/* British forms this firm composes. Code identifiers are never matched: the scan reads literals. */
export const BRITISH = [
  ["licence", "license"], ["licences", "licenses"], ["colour", "color"], ["colours", "colors"],
  ["behaviour", "behavior"], ["behaviours", "behaviors"], ["recognise", "recognize"],
  ["recognised", "recognized"], ["organisation", "organization"], ["organisations", "organizations"],
  ["authorise", "authorize"], ["authorised", "authorized"], ["apologise", "apologize"],
  ["analyse", "analyze"], ["analysed", "analyzed"], ["defence", "defense"], ["centre", "center"],
  ["favourite", "favorite"], ["labour", "labor"], ["neighbour", "neighbor"], ["fulfil", "fulfill"],
  ["whilst", "while"], ["amongst", "among"], ["learnt", "learned"], ["practise", "practice"],
  ["normalise", "normalize"], ["normalised", "normalized"], ["summarise", "summarize"],
  ["prioritise", "prioritize"], ["utilise", "utilize"], ["minimise", "minimize"],
  ["maximise", "maximize"], ["realise", "realize"], ["emphasise", "emphasize"],
  ["standardise", "standardize"], ["optimise", "optimize"], ["programme", "program"],
  ["programmes", "programs"], ["cancelled", "canceled"], ["travelled", "traveled"],
];

/** True when the text carries a British form from the list, matched as a whole word. */
export const britishIn = (text) =>
  BRITISH.some(([british]) => new RegExp(`\\b${british}\\b`).test(text.toLowerCase()));

/**
 * Runs the sweep from the repository root. Returns the findings in the shape
 * voice-audit records ({ route, rule, detail }), the two summary lines it
 * prints, and the subject, so a caller can assert the subject is not empty.
 */
export function usSpellingSweep() {
  const findings = [];
  const record = (route, rule, detail) => findings.push({ route, rule, detail });
  const summary = [];

  const PROTOCOL_DIR = "src/content/protocols/";

  const everySource = git("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean)
    .filter((f) => f.startsWith("src/") && /\.(ts|tsx)$/.test(f));

  const protocolFiles = everySource.filter((f) => f.startsWith(PROTOCOL_DIR));
  const composedFiles = everySource.filter((f) => !f.startsWith(PROTOCOL_DIR));

  /*
   * VACUITY GUARDS, BOTH DIRECTIONS. A sweep over nothing passes forever, and
   * an exemption over nothing is an exemption that is not doing anything. Both
   * numbers are asserted rather than printed.
   */
  if (composedFiles.length < 100) {
    record("spelling", "us-spelling-sweep", `only ${composedFiles.length} composed files found, so this swept nothing`);
  }
  if (protocolFiles.length === 0) {
    record("spelling", "us-spelling-sweep", "no protocol files found, so the exemption is over an empty set");
  }


  /*
   * THE ENGINEER'S STANDING SENTENCES, EXEMPT BY EXACT TEXT AND NOT BY FOLDER.
   * Robert's ruling, 2026-10-26, 21:24 Central, after board 40431036823 went
   * red on three lines of `src/content/letters/` carrying "programme".
   *
   * Those lines are the engineer's own words, marked "[Stands: your words]" in
   * the drafts document sent for his adoption, and the letter files carry them
   * exactly, as `the-three-letters-are-the-wording-on-file.mjs` requires. So
   * the house spelling cannot be applied to them, and no question about it goes
   * to him.
   *
   * A FOLDER EXEMPTION WAS REFUSED. Every other line in `src/content/letters/`
   * is text this firm composed around his words, and stays under the sweep. The
   * exemption is the two standing lines below, verbatim, and nothing else.
   *
   * IT CANNOT GROW QUIETLY. The list must equal, in both directions, the set of
   * "[Stands" lines in the drafts document that carry a British form from the
   * list above, so a sentence added here without the drafts document changing
   * turns this red, and so does a standing line added there without this list
   * changing. Both counts are pinned as literals as well: the sentences (2) and
   * the lines they exempt (3), so a change to either costs an edit on purpose.
   */
  const LETTERS_DIR = "src/content/letters/";
  const DRAFTS_DOC = "docs/letter-drafts/letter-drafts-for-adoption-2026-10-24.md";
  const STANDING_SENTENCES = [
    "This letter states conformance with {{named_requirement}} only. It states no opinion on any other standard, programme or requirement.",
    "The recipient decides how to use this letter. This firm gives no opinion on its sufficiency for any particular permit or programme.",
  ];
  const STANDING_SENTENCE_COUNT = 2;
  const STANDING_LINE_COUNT = 3;

  if (STANDING_SENTENCES.length !== STANDING_SENTENCE_COUNT) {
    record(
      "spelling",
      "us-spelling-standing",
      `the standing exemption lists ${STANDING_SENTENCES.length} sentence(s) against a ruled ${STANDING_SENTENCE_COUNT}`,
    );
  }
  {
    const standingInDrafts = readSrc(DRAFTS_DOC, "utf8")
      .split("\n")
      .filter((l) => l.startsWith("[Stands"))
      .map((l) => l.slice(l.indexOf("] ") + 2).trim())
      .filter(britishIn);
    for (const s of standingInDrafts) {
      if (!STANDING_SENTENCES.includes(s)) {
        record(
          "spelling",
          "us-spelling-standing",
          `${DRAFTS_DOC} carries a standing line with a British form that the exemption does not list: ${s.slice(0, 90)}`,
        );
      }
    }
    for (const s of STANDING_SENTENCES) {
      if (!standingInDrafts.includes(s)) {
        record(
          "spelling",
          "us-spelling-standing",
          `the exemption lists a sentence that is not a standing line of ${DRAFTS_DOC}: ${s.slice(0, 90)}`,
        );
      }
    }
  }
  const standingExempt = [];

  const LITERAL = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\$]|\\.)*)`/g;

  /*
   * A COLUMN LIST IS CODE WITH SPACES IN IT, AND THAT COST A REAL DEFECT.
   *
   * The first version of this check treated "contains a space" as "is prose".
   * `eng_partners.organisation` is a column, and it appears in select strings
   * like "id, organisation, code, status", which contain spaces. The fixer
   * written against this check rewrote SEVEN of them to `organization`,
   * renaming a schema identifier as copy. `tsc` caught it because PartnerRow
   * still declared the real spelling; had the type been inferred, the queries
   * would have failed at runtime against a column that does not exist.
   *
   * Sixth instance of a matcher with a window wider than the thing it means.
   * The property that separates them is available and exact: a comma separated
   * list of snake_case names with no sentence punctuation is a column list,
   * not a sentence. Prose that legitimately says "organization" is unaffected.
   */
  /*
   * AND THE FIRST VERSION OF THIS PATTERN LET ONE THROUGH, WHICH BROKE A
   * REPORT. Widened 2026-09-22.
   *
   * It matched a plain "a, b, c" list and knew nothing about PostgREST's
   * embedded resource form. So
   *
   *   "reference, total_cents, status, period, eng_partners!inner(organisation, is_demo)"
   *
   * was treated as prose, `organisation` was rewritten to `organization`, the
   * partner report asked for a column the database does not have, and it
   * returned NO FIGURES AT ALL. `tsc` could not see it, because an embedded
   * select's result type is not checked against the schema. `demo-audit`
   * caught it, reporting that the control figure was "not on the report at
   * all", which is what a broken query looks like from outside.
   *
   * Seventh instance of a matcher narrower than the thing it means, and the
   * inverse of the usual one: this window was too NARROW, so the neighbour it
   * failed to cover got treated as prose. Same root, opposite sign.
   */
  const COLUMN_LIST = /^[a-z_]+(?:!\w+)?(?:\([a-z_,\s!]*\))?(?:\s*,\s*[a-z_]+(?:!\w+)?(?:\([a-z_,\s!]*\))?)*$/;

  const spelt = [];
  let columnLists = 0;
  for (const file of composedFiles) {
    const lines = readSrc(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/^\s*(\*|\/\/)/.test(line)) return;
      LITERAL.lastIndex = 0;
      let m;
      while ((m = LITERAL.exec(line)) !== null) {
        const s = m[1] ?? m[2] ?? m[3];
        /* Prose only: a literal with no space is a key, a class name or a path. */
        if (!s || !/\s/.test(s.trim())) continue;
        /* And a comma separated list of snake_case names is a column list. */
        if (COLUMN_LIST.test(s.trim())) {
          columnLists += 1;
          continue;
        }
        /* The engineer's standing sentences, by exact text, in the letters only. */
        if (file.startsWith(LETTERS_DIR) && STANDING_SENTENCES.includes(s)) {
          standingExempt.push({ file, line: i + 1, text: s });
          continue;
        }
        const lower = s.toLowerCase();
        for (const [british, american] of BRITISH) {
          if (new RegExp(`\\b${british}\\b`).test(lower)) {
            spelt.push({ file, line: i + 1, british, american, text: s.trim().slice(0, 90) });
            break;
          }
        }
      }
    });
  }

  if (standingExempt.length !== STANDING_LINE_COUNT) {
    record(
      "spelling",
      "us-spelling-standing",
      `the standing sentences exempted ${standingExempt.length} line(s) against a ruled ${STANDING_LINE_COUNT}: ` +
        standingExempt.map((e) => `${e.file}:${e.line}`).join(", "),
    );
  }
  for (const s of STANDING_SENTENCES) {
    if (!standingExempt.some((e) => e.text === s)) {
      record("spelling", "us-spelling-standing", `a standing sentence exempted no line, so it is listed over nothing: ${s.slice(0, 90)}`);
    }
  }

  for (const s of spelt) {
    record(
      `${s.file}:${s.line}`,
      "us-spelling",
      `"${s.british}" should be "${s.american}" in text this platform composes: ${s.text}`,
    );
  }

  /*
   * ===========================================================================
   * WHAT THIS CHECK DOES NOT READ, SAID IN ITS OWN OUTPUT.
   * Found 2026-09-22, the night it was written.
   * ===========================================================================
   *
   * It reads STRING LITERALS. It does not read JSX text nodes, and it does not
   * read template literals carrying `${...}`. Both are ordinary places for
   * rendered copy, and at the time of writing roughly nineteen "cancelled" and
   * eleven "licence" instances of real rendered text sit in exactly those two
   * shapes, unseen.
   *
   * SO THE GREEN WAS WIDER THAN THE SWEEP, and the line below used to say
   * "423 composed file(s) swept", which a reader takes to mean the copy in 423
   * files was checked. It means the string literals in 423 files were checked.
   * That is the defect this repository records as a green naming a rigour it is
   * not performing, and it is worse than a small sweep honestly described.
   *
   * The scope is not widened here, deliberately: doing it at the end of a long
   * run would produce another round of edits nobody has reviewed. What changes
   * now is that the output stops implying coverage it does not have. Widening
   * it is in the morning report under Rulings owed.
   */
  summary.push(
    `US SPELLING: string literals in ${composedFiles.length} composed file(s) swept, ` +
      `${protocolFiles.length} protocol file(s) exempt as the signed document's own text ` +
      `(${protocolFiles.map((f) => f.slice(PROTOCOL_DIR.length)).join(", ")}), ` +
      `${columnLists} column list(s) skipped as schema identifiers rather than prose, ` +
      `${standingExempt.length} line(s) exempt as the engineer's ${STANDING_SENTENCES.length} standing sentence(s) ` +
      `(${standingExempt.map((e) => `${e.file.slice(LETTERS_DIR.length)}:${e.line}`).join(", ")}).`,
  );
  summary.push(
    "  NOT READ BY THIS CHECK: JSX text nodes, and template literals carrying an " +
      "interpolation. Both hold rendered copy. Its green covers string literals only.",
  );
  return { findings, summary, composedFiles, protocolFiles };
}
