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
const MODE = (process.env.LAUNCH_MODE || "prelaunch").trim().toLowerCase();
const GATE_ACTIVE = MODE !== "live";

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
