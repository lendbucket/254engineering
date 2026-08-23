// SEO audit. Two halves, and the second is the one that matters most on this
// build.
//
//   1. Lighthouse's SEO category on a sample of every template type, asserted at
//      100. This catches the mechanical faults: a missing description, a page
//      that is not crawlable, a link with no discernible name.
//   2. The budget and uniqueness rules Lighthouse does not check at all. A title
//      of 94 characters scores 100 and gets cut in the SERP. Two pages sharing a
//      description score 100 each and compete with each other. Those are the
//      failures this build treats as the highest priority, so they get an
//      explicit assertion rather than a proxy.
//
//   BASE_URL=http://localhost:3225 node scripts/seo-audit.mjs
import { chromium } from "playwright";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const BASE = process.env.BASE_URL || "http://localhost:3225";

/*
 * The playbook 3.4 bands, both ends enforced.
 *
 * The floor is the half this audit was missing. It checked a ceiling only, on
 * the reasoning that a short title cannot be truncated, which is true and beside
 * the point: a 39 character title leaves a third of the SERP line unused and the
 * brand never appears in it. A crawl of the live site found 25 of 26 titles
 * under 50 and exactly one in band, which no single page review would surface.
 *
 * The description floor moves from 110 to the playbook's 140, and a call to
 * action becomes mandatory. 24 of 26 descriptions had none.
 */
const MIN_TITLE = 50;
const MAX_TITLE = 60;
const MIN_DESC = 140;
const MAX_DESC = 160;

/** A description has to end somewhere a reader can act. */
const CTA_VERB = /\b(?:join|see|read|apply|send|call|contact|start|ask|request|explore|compare)\b/i;

/** One of every template type, plus enough breadth to be a real sample. */
const LIGHTHOUSE_TARGETS = [
  ["home", "/"],
  ["about", "/about"],
  ["services hub", "/services"],
  ["service: roof", "/services/roof-inspections"],
  ["service: windstorm", "/services/windstorm-wpi-8"],
  ["service: manufactured home", "/services/manufactured-home-foundation-certifications"],
  ["coverage hub", "/coverage"],
  ["region: coastal bend", "/coverage/coastal-bend"],
  ["region: panhandle", "/coverage/panhandle"],
  ["region: dallas fort worth", "/coverage/dallas-fort-worth"],
  ["government", "/government"],
  ["careers", "/careers"],
  ["contact", "/contact"],
  ["privacy", "/privacy"],
  ["terms", "/terms"],
];

async function sitemapRoutes() {
  const res = await fetch(`${BASE}/sitemap.xml`);
  if (res.status !== 200) return [];
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => m[1].replace(/^https?:\/\/[^/]+/, "") || "/",
  );
}

function extract(html) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
  const description =
    html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1]?.trim() ?? "";
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i)?.[1] ?? "";
  const ogSiteName =
    html.match(/<meta\s+property="og:site_name"\s+content="([^"]*)"/i)?.[1] ?? "";
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
  );
  const jsonLd = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => {
      try {
        return JSON.parse(m[1]);
      } catch {
        return null;
      }
    });
  return { title, description, canonical, ogSiteName, h1s, jsonLd };
}

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

// ---------- metadata pass ----------

const problems = [];
const rows = [];
const titles = new Map();
const descriptions = new Map();

const routes = await sitemapRoutes();
if (routes.length === 0) {
  console.error("seo-audit: sitemap returned no routes; refusing to report a pass on zero pages.");
  process.exitCode = 1;
}

for (const route of routes) {
  const res = await fetch(`${BASE}${route}`);
  if (res.status !== 200) {
    problems.push(`${route}: HTTP ${res.status}`);
    continue;
  }
  const html = await res.text();
  const meta = extract(html);
  const title = decode(meta.title);
  const description = decode(meta.description);

  rows.push({ route, title, description, h1s: meta.h1s });

  if (!title) problems.push(`${route}: no <title>`);
  else if (title.length > MAX_TITLE)
    problems.push(`${route}: title is ${title.length} chars, over ${MAX_TITLE} ("${title}")`);
  else if (title.length < MIN_TITLE)
    problems.push(`${route}: title is only ${title.length} chars, under ${MIN_TITLE} ("${title}")`);
  else if (!title.includes("254 Engineering"))
    problems.push(`${route}: title carries no brand suffix ("${title}")`);

  if (!description) problems.push(`${route}: no meta description`);
  else if (description.length > MAX_DESC)
    problems.push(`${route}: description is ${description.length} chars, over ${MAX_DESC}`);
  else if (description.length < MIN_DESC)
    problems.push(`${route}: description is only ${description.length} chars, under ${MIN_DESC}`);
  else if (!CTA_VERB.test(description))
    problems.push(`${route}: description has no call to action ("${description.slice(-48)}")`);

  if (!meta.canonical) problems.push(`${route}: no canonical link`);
  if (meta.ogSiteName !== "254 Engineering Services")
    problems.push(`${route}: og:site_name is "${meta.ogSiteName}", expected "254 Engineering Services"`);

  if (meta.h1s.length !== 1)
    problems.push(`${route}: ${meta.h1s.length} h1 elements, expected exactly 1`);

  /*
   * The hasReviews false pattern, enforced permanently.
   *
   * No review or rating markup anywhere until real third party reviews exist.
   * Until now this rule lived only as a comment in src/lib/schema.tsx, which
   * means it was a convention rather than a guarantee: a future session adding
   * an aggregateRating to make a rich result appear would have shipped it
   * through a green suite.
   *
   * Rating markup is the single highest risk fabrication on a site like this.
   * It is invisible to a reader, it is read by Google as a factual claim about
   * third party sentiment, and inventing one is a manual action rather than an
   * embarrassment. So it is checked in the raw HTML across every serialization:
   * JSON-LD, microdata, and RDFa alike.
   */
  const ratingMarkup = [
    [/"@type"\s*:\s*"(?:AggregateRating|Review|Rating)"/i, "JSON-LD review or rating node"],
    [/"(?:aggregateRating|ratingValue|reviewCount|ratingCount|reviewBody|bestRating)"\s*:/i, "JSON-LD rating property"],
    [/itemprop=["'](?:aggregateRating|ratingValue|reviewCount|ratingCount|reviewBody)["']/i, "microdata rating property"],
    [/itemtype=["']https?:\/\/schema\.org\/(?:AggregateRating|Review|Rating)["']/i, "microdata review or rating type"],
    [/property=["']v:(?:rating|average|count)["']/i, "RDFa rating property"],
  ];
  for (const [pattern, label] of ratingMarkup) {
    if (pattern.test(html)) {
      problems.push(
        `${route}: ${label} present. No review or rating markup may exist until real third party reviews do.`,
      );
    }
  }

  // BreadcrumbList on every page. It is the one schema type that is easy to add
  // to a template and easy to lose on the page that does not use the template.
  const types = meta.jsonLd.filter(Boolean).map((d) => d["@type"]);
  if (!types.includes("BreadcrumbList")) problems.push(`${route}: no BreadcrumbList schema`);
  if (!types.includes("ProfessionalService")) problems.push(`${route}: no Organization schema`);
  if (!types.includes("WebSite")) problems.push(`${route}: no WebSite schema`);

  if (title) {
    if (!titles.has(title)) titles.set(title, []);
    titles.get(title).push(route);
  }
  if (description) {
    if (!descriptions.has(description)) descriptions.set(description, []);
    descriptions.get(description).push(route);
  }
}

for (const [title, where] of titles) {
  if (where.length > 1) problems.push(`duplicate title on ${where.join(", ")}: "${title}"`);
}
for (const [description, where] of descriptions) {
  if (where.length > 1)
    problems.push(`duplicate description on ${where.join(", ")}: "${description.slice(0, 60)}..."`);
}

console.log("=== METADATA BUDGET ===");
console.log(`${routes.length} routes from the sitemap against ${BASE}\n`);
for (const r of rows) {
  console.log(`${r.route}`);
  console.log(`  title  [${String(r.title.length).padStart(3)}] ${r.title}`);
  console.log(`  desc   [${String(r.description.length).padStart(3)}] ${r.description}`);
  console.log(`  h1          ${r.h1s.join(" | ")}`);
}

// ---------- lighthouse pass ----------

const chromePath = chromium.executablePath();
const chrome = await chromeLauncher.launch({
  chromePath,
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
});

const lhRows = [];
for (const [name, path] of LIGHTHOUSE_TARGETS) {
  try {
    const result = await lighthouse(
      `${BASE}${path}`,
      { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["seo"] },
      {
        extends: "lighthouse:default",
        settings: {
          formFactor: "mobile",
          screenEmulation: {
            mobile: true,
            width: 390,
            height: 844,
            deviceScaleFactor: 2,
            disabled: false,
          },
        },
      },
    );
    const seo = Math.round(result.lhr.categories.seo.score * 100);
    const failed = Object.values(result.lhr.audits)
      .filter(
        (a) =>
          a.score !== null &&
          a.score < 1 &&
          result.lhr.categories.seo.auditRefs.some((r) => r.id === a.id && r.weight > 0),
      )
      .map((a) => a.id);
    lhRows.push({ name, path, seo, failed });
  } catch (err) {
    lhRows.push({ name, path, seo: 0, failed: [`error: ${String(err.message).split("\n")[0]}`] });
  }
}
try {
  await chrome.kill();
} catch {}

console.log("\n=== LIGHTHOUSE SEO (mobile) ===");
for (const r of lhRows) {
  console.log(`  ${r.seo === 100 ? "pass" : "FAIL"}  ${String(r.seo).padStart(3)}  ${r.path}${r.failed.length ? `  <- ${r.failed.join(", ")}` : ""}`);
}
const under = lhRows.filter((r) => r.seo < 100);
for (const r of under) problems.push(`${r.path}: Lighthouse SEO ${r.seo} (${r.failed.join(", ") || "see report"})`);

// ---------- result ----------

console.log("\n=== RESULT ===");
if (problems.length === 0) {
  console.log(`PASS: ${routes.length} routes within budget and unique, ${lhRows.length} sampled pages at SEO 100.`);
} else {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exitCode = 1;
}
