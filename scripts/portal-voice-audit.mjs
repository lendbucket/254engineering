/**
 * The standards file's voice rules, over portal copy.
 *
 *   npx tsx scripts/portal-voice-audit.mjs
 *
 * WHY THIS IS SEPARATE FROM voice-audit
 * -------------------------------------
 * voice-audit reads the RENDERED public site over HTTP and enforces the firm's
 * marketing voice and the compliance gate. This one reads portal SOURCE and
 * enforces a different, narrower set: the rules docs/PORTAL_DESIGN_STANDARDS.md
 * states for an operational interface.
 *
 * They are different jobs. Marketing copy may be warm; an operational interface
 * must not be, because a technician standing in a driveway at seven in the
 * morning does not want to be told "Great work!". The standards file's list is
 * short and absolute: no exclamation marks, no emoji, no reassurance, no
 * cleverness, no copy explaining the design's own philosophy, and sentence case
 * including buttons and column headers.
 *
 * WHY IT READS SOURCE RATHER THAN A RUNNING APP
 * ----------------------------------------------
 * Most portal screens need a signed in session of a particular role to render,
 * and standing up four sessions to read copy would make this the slowest audit
 * in the suite for the least reason. The strings are literals in the source.
 *
 * Pure. No server, no database, no network, so it runs in phase zero.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

// =========================================================================
// GATHERING THE COPY
// =========================================================================

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.tsx$/.test(entry)) acc.push(full.split("\\").join("/"));
  }
  return acc;
}

const FILES = [...walk("src/app/portal"), ...walk("src/components/portal")];
rec("there are portal components to read", FILES.length > 0, `${FILES.length} files`);

/**
 * Strings a person could read on screen.
 *
 * Comments are stripped first, because this file and the components it reads
 * are both thick with prose explaining WHY a rule exists, and prose about an
 * exclamation mark is not an exclamation mark. That mistake has been made in
 * this repository more than once.
 *
 * Class names, import paths, hrefs, keys and technical identifiers are excluded
 * by shape: a string with no space in it is not a sentence, and a string that
 * looks like a Tailwind class list is not copy.
 */
function copyStringsOf(path) {
  const source = readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");

  const found = [];

  // Quoted string literals.
  for (const m of source.matchAll(/"([^"\\\n]{6,240})"/g)) found.push(m[1]);

  /*
   * JSX TEXT, INCLUDING TEXT THAT SITS BESIDE AN EXPRESSION.
   *
   * The first version matched `>text<` with braces forbidden inside, so it only
   * saw text immediately followed by a closing tag. Real copy is usually beside
   * an expression:
   *
   *     <p>Showing {count} of {total} records</p>
   *
   * and none of that prose was being read. An injection putting an em dash into
   * exactly that position went through unnoticed, which is the whole reason this
   * is done properly now: take the span between the tags, cut the {expressions}
   * out of it, and keep the literal text that remains.
   */
  for (const m of source.matchAll(/>([^<>]{4,600})</g)) {
    const literal = m[1]
      .replace(/\{[^{}]*\}/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (literal.length >= 6) found.push(literal);
  }

  /*
   * CODE IS NOT COPY, AND TELLING THEM APART IS THE WHOLE JOB HERE.
   *
   * The first version reported three exclamation marks that were TypeScript:
   * `actor!.phone`, a non null assertion, and `minCount !==`, a comparison. So a
   * guard was added rejecting any word followed by an exclamation mark.
   *
   * THAT GUARD THEN REJECTED "check back soon!", which is precisely the string
   * the exclamation rule exists to catch. A guard against false positives that
   * swallows the true positives is worse than the noise it removed, and the
   * injection run is what found it.
   *
   * So the guard names the two code shapes exactly, `!.` and `!=`, and an
   * exclamation mark anywhere else is copy and is reported.
   */
  /*
   * A NEGATION IS NOT AN EXCLAMATION, AND THE DIFFERENCE IS WHICH SIDE THE
   * LETTER IS ON.
   *
   *   !r.canOrder   bang then an identifier. Code.
   *   check soon!   a letter then bang. Copy, and a violation.
   *
   * The first guard rejected anything with a letter beside a bang, which threw
   * the true positives away with the false ones: an injection putting
   * "check back soon!" on a screen went through unnoticed. This one
   * distinguishes them, which is the only way the rule can be enforced at all.
   */
  const CODE_SHAPE =
    /![A-Za-z_(]|!==?|=>|\?\?|\$\{|::|&&|\|\||===|\bconst\b|\breturn\b|\btypeof\b|\bnull\b|\bundefined\b/;

  return found.filter((s) => {
    if (!/\s/.test(s)) return false;
    if (CODE_SHAPE.test(s)) return false;
    // Tailwind class lists and style strings.
    if (/(^|\s)(flex|grid|mt-|mb-|px-|py-|text-|bg-|border-|rounded-|w-|h-|gap-|font-|leading-|hover:|sm:|md:|lg:|absolute|relative|inline-)/.test(s))
      return false;
    if (/^https?:\/\//.test(s)) return false;
    if (/^[a-z0-9._/-]+$/.test(s)) return false;
    if (/^\/[a-z]/.test(s)) return false;
    // Must read as words: at least two runs of letters.
    if ((s.match(/[A-Za-z]{2,}/g) ?? []).length < 2) return false;
    return true;
  });
}

const COPY = new Map();
for (const f of FILES) COPY.set(f, copyStringsOf(f));

const all = [...COPY.entries()].flatMap(([file, strings]) => strings.map((s) => ({ file, s })));
rec("and copy was extracted from them", all.length > 50, `${all.length} strings`);

// =========================================================================
// THE RULES
// =========================================================================

const report = (name, hits, note = "") =>
  rec(
    name,
    hits.length === 0,
    hits.length === 0
      ? note || "none"
      : hits
          .slice(0, 5)
          .map((h) => `${h.file.split("/").slice(-1)[0]}: ${h.s.slice(0, 60)}`)
          .join("  |  "),
  );

// --- no exclamation marks -------------------------------------------------
report(
  "no exclamation mark in any portal string",
  all.filter((h) => h.s.includes("!")),
  "an operational interface does not exclaim",
);

// --- no emoji -------------------------------------------------------------
report(
  "no emoji in any portal string",
  all.filter((h) => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(h.s)),
);

// --- no em or en dashes ---------------------------------------------------
// The standing law's rule, applied here too. The standards file uses em dashes
// itself and is a quoted document; rendered copy does not get the exemption.
report(
  "no em or en dash in any portal string",
  all.filter((h) => /[\u2013\u2014]/.test(h.s)),
);

/*
 * --- no reassurance ------------------------------------------------------
 *
 * The standards file names this directly: "Action required", not "Needs you!".
 * The list is phrases that soothe rather than inform. Each one is a phrase this
 * platform would be worse for containing, because the reader is trying to find
 * out what happened.
 */
const REASSURANCE = [
  "don't worry",
  "do not worry",
  "no need to worry",
  "great work",
  "nice work",
  "well done",
  "you're all set",
  "you are all set",
  "all good",
  "everything looks good",
  "sit back",
  "we've got you",
  "we have got you",
  "hang tight",
  "just a moment",
  "oops",
  "whoops",
  "uh oh",
  "sorry about that",
  "thanks for your patience",
  "please be patient",

  /*
   * GREETINGS, ADDED AFTER ONE SHIPPED PAST THIS AUDIT.
   *
   * The owner dashboard's largest heading read "Good to see you, Shots" and
   * this check passed it, because the list held apologies and encouragements
   * and nobody had thought of a greeting. It is the same category: warmth in
   * place of information, in the one piece of type on a dashboard that has to
   * say what the screen is.
   *
   * A person opening an operations portal knows who they are. The name belongs
   * in the user menu, where it answers WHICH account is signed in.
   */
  "good to see you",
  "good morning",
  "good afternoon",
  "good evening",
  "welcome back",
  "welcome to",
  "hi there",
  "hello there",
  "happy to help",
  "we're here to help",
  "we are here to help",
];
report(
  "no reassurance copy",
  all.filter((h) => REASSURANCE.some((p) => h.s.toLowerCase().includes(p))),
  "the reader is trying to find out what happened",
);

/*
 * --- no copy explaining the design's own philosophy ----------------------
 *
 * A screen that tells you about its own design is a screen that has run out of
 * things to tell you about your work.
 */
const SELF_REGARD = [
  "we designed",
  "our design",
  "beautifully",
  "seamless",
  "intuitive",
  "delightful",
  "powerful platform",
  "cutting edge",
  "state of the art",
  "best in class",
];
report(
  "no copy about the design itself",
  all.filter((h) => SELF_REGARD.some((p) => h.s.toLowerCase().includes(p))),
);

/*
 * --- sentence case on buttons and headers --------------------------------
 *
 * Title Case Every Word is the tell of an interface assembled from a component
 * library rather than written. Detected as three or more consecutive
 * capitalised words in a short string, which is what a title cased button or
 * column header looks like and what a normal sentence does not.
 *
 * Proper nouns are the false positive to guard against, so the check needs at
 * least three in a row and skips strings containing a known proper noun.
 */
const PROPER = ["Texas", "Corpus", "Christi", "Stripe", "Supabase", "Vercel", "Resend", "Sentry", "TBPELS", "Board", "Professional", "Engineers", "Land", "Surveyors", "County", "Nueces", "Harris", "Bexar", "Travis", "Windstorm", "WPI", "Administrator", "Field", "Technician", "Engineer"];
const titleCase = all.filter((h) => {
  if (PROPER.some((p) => h.s.includes(p))) return false;
  if (h.s.length > 60) return false;
  return /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)/.test(h.s);
});
report("sentence case, not Title Case", titleCase, "including buttons and column headers");

/*
 * --- the AI cliche list the rest of the repo already bans ----------------
 *
 * Imported from the shared blocklist rather than re-listed, so the portal and
 * the public site cannot disagree about what is banned. That module exists
 * precisely because site copy and email templates had drifted apart once.
 */
{
  const blocklistPath = "scripts/lib/voice-blocklist.mjs";
  rec("the shared voice blocklist exists", existsSync(blocklistPath));

  if (existsSync(blocklistPath)) {
    /*
     * Its own matcher, not a reconstruction of its list.
     *
     * The first version of this block read the module's exported arrays and
     * looked for strings in them. Those arrays hold {pattern, why} objects, so
     * it found zero phrases and reported a passing check over an empty list,
     * which is the exact shape of a check that measures nothing while looking
     * green. findBannedPhrases is the function the site's own voice audit uses,
     * so the portal and the site now enforce the same list by construction
     * rather than by two transcriptions of it.
     */
    const { findBannedPhrases } = await import("../scripts/lib/voice-blocklist.mjs");
    rec("and exposes its matcher", typeof findBannedPhrases === "function");

    const probe = findBannedPhrases("Let us unlock the full potential of your workflow.");
    rec(
      "and the matcher demonstrably matches something",
      probe.length > 0,
      probe.length ? `caught ${probe.length} on a deliberately bad sentence` : "caught nothing on a sentence full of cliche",
    );

    report(
      "no banned phrase from the shared blocklist",
      all.filter((h) => findBannedPhrases(h.s).length > 0),
      "the portal and the site share one list so they cannot disagree",
    );
  }
}

// =========================================================================
// THE STANDARDS FILE'S POSITIVE RULES
// =========================================================================

{
  const standards = readFileSync("docs/PORTAL_DESIGN_STANDARDS.md", "utf8");

  rec(
    "the standards file still forbids exclamation marks and emoji",
    /Never: exclamation marks, emoji, reassurance/.test(standards),
    "if this changed, the checks above are enforcing a rule nobody holds any more",
  );

  rec(
    "and still asks for sentence case everywhere",
    /Sentence case everywhere/.test(standards),
  );

  /*
   * The corrections from gate 0 are still in place. A later edit that restored
   * the export's wording would put the evidence hash claim and the single case
   * refund sentence back, and both would then be built from.
   */
  rec(
    "the evidence hash claim is still recorded as false",
    /\*\*It does not\.\*\*/.test(standards),
    "the export claimed a hash the platform does not compute",
  );
  rec(
    "the refund rule still states all four cases",
    /Cancelled by the firm/.test(standards) && /Declined after desk review, no visit/.test(standards),
  );
  rec(
    "the roles are still recorded as three",
    /Three, not four/.test(standards) && /field_tech/.test(standards),
  );
  rec(
    "and the reason there is no 403 is still written down",
    /There is no 403, deliberately/.test(standards),
    "so a later reader does not restore it as a missing screen",
  );

  /*
   * The gate 2A rulings, and the code that has to keep matching them.
   *
   * Both are the kind of decision that reads as an omission to somebody who
   * finds the standards file later and not the reasoning: a header with no
   * title, and one alert where the prototype had three. Recorded there, and
   * asserted here so the recording and the code cannot part company.
   */
  rec(
    "the restricted mode wording ruling is recorded",
    /The restricted mode statement has one wording/.test(standards),
  );
  rec(
    "and the screen title ruling is recorded",
    /The screen title stays in PageHead/.test(standards),
  );

  /*
   * ONE WORDING MEANS ONE WORDING. No screen may describe the gate itself.
   *
   * Three did before the ruling, in three different sentences, and the one this
   * catches is a fourth appearing later: somebody adding a screen, wanting to
   * mention the gate, and writing it out rather than reaching for the
   * component.
   */
  const gateProse = all.filter(
    (h) =>
      /compliance gate active/i.test(h.s) ||
      (/sealing and order intake are disabled/i.test(h.s) &&
        !h.file.includes("design/RestrictedMode")),
  );
  report(
    "no screen states the compliance gate in its own words",
    gateProse,
    "RestrictedMode says it once, and a screen adds to it with `also` rather than restating it",
  );

  const restricted = "src/components/portal/design/RestrictedMode.tsx";
  rec("the RestrictedMode component exists", existsSync(restricted));
  if (existsSync(restricted)) {
    const source = readFileSync(restricted, "utf8");
    rec(
      "and it reads the gate itself rather than taking a boolean",
      /if \(!isPrelaunch\(\)\) return null;/.test(source),
      "a prop can be forgotten, and the screen that forgets it says sealing is available",
    );
    rec(
      "and it carries the shared sentence",
      /Sealing and order intake are disabled until an/.test(source),
    );
    rec(
      "and it lets a screen add without restating",
      /also\?: ReactNode/.test(source),
    );
  }
}

// =========================================================================

const failed = out.filter((o) => !o.ok);
for (const o of out) console.log(`  ${o.ok ? "PASS" : "FAIL"}: ${o.name}${o.note ? ` (${o.note})` : ""}`);
console.log("");

if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("An operational interface states the condition, then the consequence.");
  process.exit(1);
}

console.log(`PASS: ${out.length} checks. The portal says what happened and nothing else.`);
