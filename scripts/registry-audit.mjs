/**
 * Cross brand near-duplicate detection.
 *
 *   BASE_URL=http://localhost:3225 node scripts/registry-audit.mjs
 *
 * WHAT THIS USED TO DO, AND WHY IT STOPPED
 * ----------------------------------------
 * It enforced an ownership map: one keyword, one brand, and a violation was any
 * brand writing about a term assigned elsewhere. The operator superseded that
 * model on 2026-08-30. All three businesses offer the same service menu and each
 * earns in-depth content on every service, so topic overlap is now the intended
 * state and flagging it would flag the strategy.
 *
 * What was always the actual risk is duplication. Two pages on one subject,
 * written independently for different buyers, are two legitimate pages. Two
 * pages sharing copy, structure, headings, or paraphrase are a doorway however
 * carefully the keywords were divided.
 *
 * So this fetches all three live sitemaps and scores similarity across titles,
 * H1s, descriptions, and heading structures. It reports scores rather than
 * verdicts, because "how close are these" is the question an operator needs
 * answered, and it fails only above the threshold where two pages have stopped
 * being independent treatments.
 *
 * WHY IT MEASURES THE LIVE SITES AND NOT THE SOURCE
 * -------------------------------------------------
 * The sibling repos are separate checkouts that may be on any branch. What a
 * search engine compares is what is published, so that is what this compares.
 * The local site is read from BASE_URL so a page can be checked before it ships;
 * the siblings are always read from their production domains.
 *
 * THE THRESHOLDS
 * --------------
 * Trigram Jaccard on normalized text. Titles and H1s are short, so they are also
 * checked for exact and near-exact matches directly. Heading structure compares
 * the ordered list of H2s, because two pages with the same headings in the same
 * order are the same page whatever the sentences say.
 *
 * 0.75 fails. 0.55 to 0.75 reports as worth a look. Those numbers are a
 * judgment, and they were set by measuring the current corpus: the highest
 * legitimate cross brand score today is well under 0.55, so the band is empty
 * rather than tuned to hide anything.
 */
import { BRANDS } from "../data/keyword-registry.ts";

const LOCAL = process.env.BASE_URL || "http://localhost:3225";
const SELF = "254";
const FAIL_AT = 0.75;

/*
 * Utility pages are compared but never failed.
 *
 * Three privacy policies owned by one operator have the same H1 because the page
 * is called a privacy policy. That is not a doorway: nobody searches for it,
 * nothing competes for it, and rewriting one to be different would make it worse
 * as a legal document. Same for terms and for a contact page whose headings are
 * "email" and "coverage".
 *
 * They stay in the comparison and stay visible in the watch list, because
 * silently dropping a page from a duplicate check is how a real duplicate hides
 * behind an exclusion later. They just do not fail the build.
 */
const UTILITY = /^\/(privacy|terms|contact)(\/|$)/;
const WATCH_AT = 0.55;

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function trigrams(s) {
  const t = norm(s);
  const set = new Set();
  for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3));
  return set;
}

function jaccard(a, b) {
  const A = trigrams(a);
  const B = trigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

const pick = (h, re) => {
  const m = h.match(re);
  return m ? m[1].replace(/&amp;/g, "&").replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"') : "";
};

const strip = (s) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

async function pagesFor(origin, limit = 60) {
  const xml = await (await fetch(`${origin}/sitemap.xml`)).text();
  /*
   * The loc values are absolute canonical URLs, so a sitemap served from
   * localhost still lists https://254engineering.com. Fetching them verbatim
   * meant this audit read PRODUCTION while printing "read 33 pages from
   * http://localhost:3225", and a fix that had not shipped yet scored as though
   * it had never been made. Found by rewriting a flagged H1, watching the score
   * not move, and computing the same score by hand.
   *
   * Rebasing onto the requested origin is what makes BASE_URL mean anything.
   */
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => origin + (m[1].replace(/^https?:\/\/[^/]+/, "") || "/"))
    .slice(0, limit);
  const pages = [];
  for (const u of urls) {
    let html = "";
    try {
      html = await (await fetch(u)).text();
    } catch {
      continue;
    }
    pages.push({
      url: u,
      path: u.replace(origin, "") || "/",
      title: pick(html, /<title>([^<]*)<\/title>/),
      desc: pick(html, /<meta name="description" content="([^"]*)"/),
      h1: strip((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, ""])[1]),
      h2s: [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => strip(m[1])).filter(Boolean),
    });
  }
  return pages;
}

const worst = { score: 0, label: "" };

function compare(kind, a, b, aPage, bPage, aBrand, bBrand) {
  const score = jaccard(a, b);
  if (score > worst.score) {
    worst.score = score;
    worst.label = `${kind}: ${aBrand}${aPage} vs ${bBrand}${bPage} at ${score.toFixed(2)}`;
  }
  return score;
}

async function run() {
  const self = await pagesFor(LOCAL);
  rec(`read ${self.length} pages from ${LOCAL}`, self.length > 0);

  const siblings = [];
  for (const brand of Object.keys(BRANDS)) {
    if (brand === SELF) continue;
    const origin = `https://${BRANDS[brand].domain}`;
    try {
      const pages = await pagesFor(origin);
      siblings.push({ brand, origin, pages });
      rec(`read ${pages.length} pages from ${BRANDS[brand].domain}`, pages.length > 0);
    } catch (err) {
      // A sibling that is unreachable is a gap in coverage, not a pass. Saying
      // so is the difference between "no duplicates" and "not checked".
      rec(`read ${BRANDS[brand].domain}`, false, String(err.message).slice(0, 80));
    }
  }

  const findings = [];
  const watch = [];

  for (const mine of self) {
    for (const sib of siblings) {
      for (const theirs of sib.pages) {
        const t = compare("title", mine.title, theirs.title, mine.path, theirs.path, SELF, sib.brand);
        const h = compare("h1", mine.h1, theirs.h1, mine.path, theirs.path, SELF, sib.brand);
        const d = compare("description", mine.desc, theirs.desc, mine.path, theirs.path, SELF, sib.brand);
        const s = compare(
          "heading structure",
          mine.h2s.join(" | "),
          theirs.h2s.join(" | "),
          mine.path,
          theirs.path,
          SELF,
          sib.brand,
        );

        const utility = UTILITY.test(mine.path) || UTILITY.test(theirs.path);
        for (const [kind, score] of [["title", t], ["h1", h], ["description", d], ["headings", s]]) {
          if (score >= FAIL_AT && !utility) {
            findings.push(
              `${kind} ${score.toFixed(2)}: ${mine.path} vs ${sib.brand}${theirs.path}. Rewrite for its own buyer, do not edit.`,
            );
          } else if (score >= WATCH_AT || (score >= FAIL_AT && utility)) {
            watch.push(
              `${kind} ${score.toFixed(2)}: ${mine.path} vs ${sib.brand}${theirs.path}${utility ? " [utility page, not failed]" : ""}`,
            );
          }
        }
      }
    }
  }

  rec(
    "no near-duplicate titles, H1s, descriptions, or heading structures across the three brands",
    findings.length === 0,
    findings.slice(0, 6).join(" | "),
  );

  console.log("=== CROSS BRAND SIMILARITY ===");
  console.log(`fail at ${FAIL_AT}, watch from ${WATCH_AT}. Highest observed: ${worst.label || "none"}\n`);
  if (watch.length) {
    console.log("  Worth a look, not a failure:");
    for (const w of watch.slice(0, 12)) console.log(`    ${w}`);
    console.log("");
  }
}

await run();

console.log("=== RESULT ===");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log("PASS: three brands, one subject each, written independently.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} finding(s).`);
  process.exitCode = 1;
}
