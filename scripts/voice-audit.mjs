// Voice audit. Crawls rendered output and fails on the phrasing and the
// structure that mark copy as machine written, plus the regulatory phrase check
// that the prelaunch gate depends on.
//
//   BASE_URL=http://localhost:3225 node scripts/voice-audit.mjs
//
// WHAT THIS DOES THAT placeholder-audit DOES NOT
// -----------------------------------------------
// placeholder-audit owns the mechanical rules: dashes, emoji, phone numbers,
// off-domain email, credential strings. It is a character level check. This is
// a prose level check, and the two are composed rather than duplicated: nothing
// in this file re-tests a rule that one already enforces.
//
// THREE CLASSES OF FINDING, AND WHY THEY ARE WEIGHTED DIFFERENTLY
// ---------------------------------------------------------------
//   Banned phrase   A hard failure. The list is explicit and there is no
//                   defensible use of "seamless" on an engineering firm's site.
//
//   Regulatory      A hard failure while the prelaunch gate is active, because
//                   it is a legal constraint on what this firm may claim rather
//                   than a preference about how it reads.
//
//   Structural      A hard failure too, but on thresholds set deliberately loose
//                   and applied only where there is enough text to measure. A
//                   style heuristic that fires on good writing gets switched
//                   off, and a switched off check protects nothing.
import {
  STRUCTURAL,
  context,
  findBannedPhrases,
  findRegulatoryClaims,
  isRhetoricalTriad,
} from "./lib/voice-blocklist.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3225";
/*
 * THE MODE COMES FROM THE GATE, NOT FROM AN ENVIRONMENT VARIABLE.
 * Operator ruling, 2026-09-17, found when this audit printed "prelaunch gate
 * ACTIVE" while the server it was scanning was serving `trading`.
 *
 * This line read `process.env.LAUNCH_MODE || "prelaunch"`. That was correct in
 * September, when LAUNCH_MODE was the entire gate. It stopped being correct on
 * 2026-09-10, when the gate became seven conditions, and became actively wrong
 * on 2026-09-17, when LAUNCH_MODE was narrowed to gate `open` alone.
 *
 * So this audit carried its own copy of the compliance gate, and the copy
 * disagreed with the real one. That is the defect CLAUDE.md names about screens
 * with their own copy of the logic, wearing an audit: a second implementation
 * of the gate is a second answer to what the site may say.
 *
 * TWO CHANGES MAKE IT ONE ANSWER. It asks `launchMode()`, and it loads
 * `.env.local` first so it reads the same environment `next build` does. Without
 * the second, the gate here would answer prelaunch on a machine where the server
 * answers trading, which is how this was found.
 */
import "./lib/load-env.mjs";
const { launchMode } = await import("../src/lib/launch.ts");
const MODE = launchMode();
/*
 * REGULATED CLAIMS ARE FAILURES UNTIL THE FIRM IS OPEN, WHICH IS THE
 * CONSERVATIVE SIDE OF A SPLIT THE OPERATOR HAS NOT RULED YET.
 *
 * The patterns refuse present tense claims about SEALING and performing
 * engineering. Under `trading` the firm may say it is registered and may quote,
 * and it still cannot seal anything, because no protocol is approved. Some of
 * these patterns are about registration and are now satisfied; others are about
 * sealing and are not. Splitting them is the operator's ruling and the question
 * is in front of him with the sentences attached.
 *
 * Until he answers, this stays shut through trading. `!== "live"` would have
 * been the same answer by accident, since "live" is no longer a mode at all, and
 * an accident that gives the right answer is the thing this repository spends
 * its time removing.
 */
const GATE_ACTIVE = MODE !== "open";

/**
 * Routes exempt from the structural checks, with a reason.
 *
 * Legal documents are supposed to read as uniform numbered prose. Measuring
 * paragraph rhythm on a privacy policy and calling the result machine cadence
 * would be measuring the genre, not the writing.
 */
const STRUCTURAL_EXEMPT = [
  { path: "/privacy", why: "A privacy policy is uniform by genre. Rhythm variation is not a quality signal here." },
  { path: "/terms", why: "Same as privacy. Legal prose is deliberately even." },
  { path: "/llms.txt", why: "Machine readable summary, not prose." },
  { path: "/llms-full.txt", why: "Machine readable summary, not prose." },
];

const findings = [];
const record = (route, rule, detail) => findings.push({ route, rule, detail });

// ---------- extraction ----------

function stripped(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

function decode(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

const textOf = (fragment) => decode(fragment.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

function visibleText(html) {
  return textOf(stripped(html));
}

function headings(html) {
  return [...stripped(html).matchAll(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((m) => textOf(m[2]))
    .filter(Boolean);
}

function paragraphs(html) {
  return [...stripped(html).matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => ({ html: m[1], text: textOf(m[1]) }))
    .filter((p) => p.text.length > 0);
}

// ---------- structural measurements ----------

/**
 * Coefficient of variation of paragraph length.
 *
 * Human prose varies: a one line paragraph next to a six line one. Generated
 * prose tends toward a single comfortable length and holds it, which is the
 * cadence a reader notices without being able to name. Measured as standard
 * deviation over mean so it is scale free.
 */
function paragraphRhythm(paras) {
  const lengths = paras.map((p) => p.text.split(/\s+/).length).filter((n) => n >= 5);
  if (lengths.length < STRUCTURAL.minParagraphs) return null;
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  if (mean === 0) return null;
  const variance = lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length;
  return { cv: Math.sqrt(variance) / mean, count: lengths.length, mean: Math.round(mean) };
}

/**
 * The longest run of consecutive rhetorical triads, measured within paragraphs.
 *
 * WHY THIS READS PARAGRAPHS AND NOT THE PAGE
 * ------------------------------------------
 * The first version flattened the whole page to text and split on sentence
 * punctuation. On a card grid that produces "sentences" like "Read more
 * Foundation Inspections and Certifications A sealed engineering opinion on how
 * a foundation is performing, supported by..." which is four separate DOM
 * elements welded together by the extractor. It reported a four deep run of
 * stacked triads on the homepage, where the real structure was a grid of nine
 * cards and no prose defect at all.
 *
 * A run only counts inside one paragraph, because that is the only place a
 * reader experiences cadence. Card summaries are not consecutive sentences.
 */
function triadRun(paras) {
  let best = 0;
  for (const p of paras) {
    const sentences = p.text.match(/[^.?!]+[.?!]/g) ?? [];
    let run = 0;
    for (const s of sentences) {
      run = isRhetoricalTriad(s) ? run + 1 : 0;
      if (run > best) best = run;
    }
  }
  return best;
}

/** Consecutive paragraphs that open with a bolded lead in. */
function boldLeadInRun(paras) {
  let best = 0;
  let run = 0;
  for (const p of paras) {
    const opensBold = /^\s*<(?:strong|b)\b/i.test(p.html);
    run = opensBold ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

// ---------- crawl ----------

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, html: await res.text() };
}

const sm = await get("/sitemap.xml");
if (sm.status !== 200) {
  console.error(`voice-audit: cannot read sitemap at ${BASE}/sitemap.xml (status ${sm.status})`);
  process.exitCode = 1;
}
const routes = [...sm.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (m) => m[1].replace(/^https?:\/\/[^/]+/, "") || "/",
);
// The waitlist is out of the sitemap by design and is the single most
// compliance sensitive page on the site, so it is crawled explicitly.
const allRoutes = [...routes, "/waitlist", "/llms.txt", "/llms-full.txt"];

if (allRoutes.length <= 3) {
  console.error("voice-audit: sitemap contained no URLs; refusing to report a pass on zero routes");
  process.exitCode = 1;
}

for (const route of allRoutes) {
  const { status, html } = await get(route);
  if (status !== 200) {
    record(route, "unreachable", `HTTP ${status}`);
    continue;
  }

  const isText = route.endsWith(".txt");
  const text = isText ? decode(html) : visibleText(html);

  for (const hit of findBannedPhrases(text)) {
    record(route, "banned phrase", `${hit.why}: ${context(text, hit.index)}`);
  }

  if (GATE_ACTIVE) {
    for (const hit of findRegulatoryClaims(text)) {
      record(route, "present tense service claim", `${hit.why} ("${hit.match}"): ${context(text, hit.index)}`);
    }
  }

  const exempt = STRUCTURAL_EXEMPT.find((e) => e.path === route);
  if (exempt || isText) continue;

  const heads = headings(html);
  if (heads.length >= STRUCTURAL.minHeadings) {
    const questions = heads.filter((h) => h.trim().endsWith("?")).length;
    const ratio = questions / heads.length;
    if (ratio > STRUCTURAL.questionHeadingRatio) {
      record(
        route,
        "question heading density",
        `${questions} of ${heads.length} headings are questions (${Math.round(ratio * 100)}%, limit ${Math.round(STRUCTURAL.questionHeadingRatio * 100)}%)`,
      );
    }
  }

  const paras = paragraphs(html);
  const rhythm = paragraphRhythm(paras);
  if (rhythm && rhythm.cv < STRUCTURAL.minParagraphCoefficientOfVariation) {
    record(
      route,
      "uniform paragraph rhythm",
      `${rhythm.count} paragraphs averaging ${rhythm.mean} words, variation ${rhythm.cv.toFixed(2)} (needs ${STRUCTURAL.minParagraphCoefficientOfVariation})`,
    );
  }

  const triads = triadRun(paras);
  if (triads >= STRUCTURAL.maxConsecutiveTriads) {
    record(route, "stacked rhetorical triads", `${triads} consecutive three item sentences`);
  }

  const bold = boldLeadInRun(paras);
  if (bold >= STRUCTURAL.maxConsecutiveBoldLeadIns) {
    record(route, "bolded listicle lead ins", `${bold} consecutive paragraphs opening in bold`);
  }
}

// ---------- US spelling in text this platform composes ----------

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
{
  const { readFileSync: readSrc } = await import("node:fs");
  const { execFileSync: git } = await import("node:child_process");

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

  /* British forms this firm composes. Code identifiers are never matched: the scan reads literals. */
  const BRITISH = [
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

  for (const s of spelt) {
    record(
      `${s.file}:${s.line}`,
      "us-spelling",
      `"${s.british}" should be "${s.american}" in text this platform composes: ${s.text}`,
    );
  }

  console.log("");
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
  console.log(
    `US SPELLING: string literals in ${composedFiles.length} composed file(s) swept, ` +
      `${protocolFiles.length} protocol file(s) exempt as the signed document's own text ` +
      `(${protocolFiles.map((f) => f.slice(PROTOCOL_DIR.length)).join(", ")}), ` +
      `${columnLists} column list(s) skipped as schema identifiers rather than prose.`,
  );
  console.log(
    "  NOT READ BY THIS CHECK: JSX text nodes, and template literals carrying an " +
      "interpolation. Both hold rendered copy. Its green covers string literals only.",
  );
}

// ---------- report ----------

console.log("=== VOICE AUDIT ===");
console.log(`scanned ${allRoutes.length} routes against ${BASE}`);
console.log(
  GATE_ACTIVE
    ? "prelaunch gate ACTIVE: present tense service claims are failures"
    : "live mode: regulatory phrase check relaxed",
);

if (findings.length === 0) {
  console.log("\nPASS: no banned phrases, no regulatory claims, no structural tells.");
  console.log(`structural checks skipped by design on: ${STRUCTURAL_EXEMPT.map((e) => e.path).join(", ")}`);
} else {
  const byRule = new Map();
  for (const f of findings) {
    if (!byRule.has(f.rule)) byRule.set(f.rule, []);
    byRule.get(f.rule).push(f);
  }
  for (const [rule, list] of byRule) {
    console.log(`\n-- ${rule}: ${list.length} finding(s)`);
    for (const f of list) console.log(`   ${f.route}\n     ${f.detail}`);
  }
  console.log(
    `\nFAIL: ${findings.length} finding(s) across ${new Set(findings.map((f) => f.route)).size} route(s).`,
  );
  process.exitCode = 1;
}
