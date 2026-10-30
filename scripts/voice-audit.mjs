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
  isRhetoricalTriad,
} from "./lib/voice-blocklist.mjs";
import { OPEN_GATED, SEALING_GATED, TRADING_GATED, findClaims } from "./lib/regulatory.mjs";

const BASE = process.env.BASE_URL || AUDIT_BASE_URL;
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
import { modeUnderTest, announceMode } from "./lib/rendered-mode.mjs";
import { AUDIT_BASE_URL } from "./lib/ports.mjs";

/*
 * =========================================================================
 * THE MODE COMES FROM THE BUILD UNDER TEST, AND IS REFUSED RATHER THAN
 * GUESSED. Operator ruling, 2026-09-24.
 * =========================================================================
 *
 * This used to call `launchMode()` in THIS process. That is right when the
 * server was built here from the same env file, and silently wrong against a
 * remote deployment built from environment variables this machine cannot read,
 * where `launchMode()` answers `prelaunch` for want of FIRM_PHONE and the
 * answer is indistinguishable from a deployment that genuinely is prelaunch.
 *
 * A missing answer wearing a real answer's clothes is the defect this whole
 * file exists to hunt. `modeUnderTest` returns null instead, and a null makes
 * this audit report COULD NOT TELL and exit zero, because unreachable is not
 * failed and a compliance ruleset chosen by guesswork is worse than no verdict.
 */
const modeResult = await modeUnderTest(BASE);
const MODE = modeResult.mode;
/*
 * =========================================================================
 * THE SPLIT, RULED 2026-09-24. EACH GROUP HAS ITS OWN PREDICATE.
 * =========================================================================
 *
 * This read `MODE !== "open"`, and the comment that stood here said so: the
 * conservative side of a split the operator had not ruled, held deliberately
 * until he answered, with the question in front of him and the sentences
 * attached. He answered. The sealing sentences are correct in trading.
 *
 * WHAT THE OLD BOOLEAN COST. The board of 2026-09-24 reported six present
 * tense service claims on five routes, including the home page and
 * llms-full.txt, every one of them a sentence the firm is entitled to say.
 * `partner-audit` went red on four checks for the same reason. Those were not
 * defects in the copy; they were one ruleset applied to a mode it was not
 * written for.
 *
 * THE THREE GROUPS ALREADY EXISTED IN regulatory.mjs AND NOTHING USED THEM.
 * `findRegulatoryClaims` reads ALL_REGULATED, which is every pattern at once.
 * So the split was built, documented, and then asked under a single boolean,
 * which is the declared-inventory failure wearing a pattern set: the
 * distinction existed and nothing consulted it.
 *
 * Each group is now gated on the thing it is actually about:
 *
 *   TRADING_GATED   refused while the firm is not trading
 *   SEALING_GATED   refused while sealing is not available, which is an
 *                   APPROVED PROTOCOL and trading, not an open gate
 *   OPEN_GATED      refused while the firm is not open. Orders and money.
 *
 * `sealingIsAvailable()` rather than `isOpen()` is the load bearing choice. A
 * registered firm, trading, with an engineer and no approved protocol can seal
 * nothing, and every SEALING_GATED pattern says it is sealing.
 */
const { isTrading, isOpen, sealingIsAvailable } = await import("../src/lib/launch.ts");

const ACTIVE_GROUPS = [];
if (MODE !== null) {
  if (!isTrading()) ACTIVE_GROUPS.push(["trading", TRADING_GATED]);
  if (!sealingIsAvailable()) ACTIVE_GROUPS.push(["sealing", SEALING_GATED]);
  if (!isOpen()) ACTIVE_GROUPS.push(["open", OPEN_GATED]);
}
const GATE_ACTIVE = ACTIVE_GROUPS.length > 0;

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
// The design brief left the sitemap on 2026-10-25 (a noindex quote form), so it is read by name.
const allRoutes = [...routes, "/waitlist", "/design-inquiry", "/llms.txt", "/llms-full.txt"];

if (allRoutes.length <= 3) {
  console.error("voice-audit: sitemap contained no URLs; refusing to report a pass on zero routes");
  process.exitCode = 1;
}

/*
 * REFUSE TO JUDGE RATHER THAN JUDGE BY A GUESS. Operator ruling, 2026-09-24.
 *
 * The banned phrase and structural checks below are about WRITING and are true
 * in every mode, so they could in principle still run. They do not, and that is
 * deliberate: a run that measured two thirds of this audit and reported a
 * verdict would be a green whose scope nobody could see, which is the vacuous
 * green this file exists to hunt. One verdict, one scope, and the reason
 * printed.
 */
if (MODE === null) {
  console.log("=== VOICE AUDIT ===");
  announceMode(modeResult);
  console.log("");
  console.log(`COULD NOT TELL: ${allRoutes.length} route(s) were not judged, because the compliance`);
  console.log("ruleset depends on the mode the build under test was made in, and that could not be");
  console.log("established. Nothing here failed. Nothing here passed either.");
  process.exitCode = 0;
  process.exit(0);
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

  /*
   * Named by the group that refused it, so a finding says WHICH rule it broke
   * and therefore what would have to change for it to be allowed. "present
   * tense service claim" was one label over three different rules, and a
   * reader could not tell whether a sentence needed an approved protocol, a
   * registration or an open gate.
   */
  for (const [group, patterns] of ACTIVE_GROUPS) {
    for (const hit of findClaims(text, patterns)) {
      record(route, `${group}-gated claim`, `${hit.why} ("${hit.match}"): ${context(text, hit.index)}`);
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
 * The sweep lives in scripts/lib/us-spelling.mjs, with the ruling and its
 * reasoning, so the preflight runs the same function on the same subject.
 */
{
  const { usSpellingSweep } = await import("./lib/us-spelling.mjs");
  const sweep = usSpellingSweep();
  for (const f of sweep.findings) record(f.route, f.rule, f.detail);
  console.log("");
  for (const line of sweep.summary) console.log(line);
}

// ---------- report ----------

console.log("=== VOICE AUDIT ===");
console.log(`scanned ${allRoutes.length} routes against ${BASE}`);
/*
 * IT SAID "prelaunch gate ACTIVE" IN EVERY MODE THAT WAS NOT OPEN, INCLUDING
 * TRADING, and that cost a whole diagnosis. Reading that line on a trading
 * build, I concluded the audit had failed to load the environment and went
 * looking for an import ordering bug that did not exist. The audit had read
 * `trading` correctly and printed a label naming a different mode.
 *
 * A figure can be arithmetically correct and still be a false statement about
 * the thing it describes. So can a status line, and this one was read by a
 * person who then acted on it.
 */
announceMode(modeResult);
console.log(
  GATE_ACTIVE
    ? `gated groups ACTIVE: ${ACTIVE_GROUPS.map(([g]) => g).join(", ")}. Claims in these groups are failures.`
    : "every gated group is retired for this mode: the firm may make these claims.",
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
