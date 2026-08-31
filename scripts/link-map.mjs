// Internal link map. Counts contextual versus template inbound links per page.
//
//   BASE_URL=http://localhost:3225 node scripts/link-map.mjs
//   node scripts/link-map.mjs --baseline      write the current state to a file
//   node scripts/link-map.mjs --compare       diff against the recorded baseline
//
// WHY THE DISTINCTION IS THE WHOLE POINT
// --------------------------------------
// Search Console reports internal links as one number, and that number is
// dominated by navigation. Every page on this site is linked from the header and
// the footer, so every page shows roughly the same inbound count and the report
// says nothing about which pages the site actually argues for.
//
// A contextual link is different in kind: it sits in prose, at a point where a
// reader wanted it, and it is the only internal link that carries a real signal
// about what a page is for. This tool separates the two by looking at where in
// the document the link sits, so a linking pass can be measured rather than
// asserted.
//
// HOW CONTEXTUAL IS DETERMINED
// ----------------------------
// The header and footer are removed first, which drops the entire navigation and
// the footer's service and coverage columns. What remains is the page body, and
// within it a link counts as contextual only when it sits inside a paragraph or
// a list item that carries real prose around it. A link that is the whole of its
// container is a card or a button: it is a navigational affordance, it is
// counted separately as "template", and it is not evidence that anything was
// argued.
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3225";
const BASELINE = path.join(process.cwd(), "scripts", ".link-map-baseline.json");

const mode = process.argv.includes("--baseline")
  ? "baseline"
  : process.argv.includes("--compare")
    ? "compare"
    : "report";

async function get(pathname) {
  const res = await fetch(`${BASE}${pathname}`);
  return { status: res.status, html: await res.text() };
}

function stripChrome(html) {
  const mainStart = html.indexOf("<main");
  const footerStart = html.lastIndexOf("<footer");
  const from = mainStart === -1 ? 0 : mainStart;
  const to = footerStart === -1 ? html.length : footerStart;
  return html.slice(from, to);
}

const textOf = (fragment) =>
  fragment
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Every internal link on a page, with enough context to classify it later.
 *
 * WHY CLASSIFICATION IS NOT DONE HERE
 * -----------------------------------
 * The first version decided contextual versus template from the single page it
 * was looking at, using the ratio of container text to anchor text. It reported
 * 143 contextual links, and both of the biggest contributors were wrong:
 *
 *   The alphabetical county index on /coverage renders 254 rows of "Loving |
 *   West Texas". The row is short, the anchor is most of it, and the ratio
 *   happened to clear the threshold, so an index table was counted as 51
 *   contextual links to one region page. It then reported the resulting anchor
 *   repetition as a manipulation warning, about a table.
 *
 *   The prelaunch notice is a real sentence containing a real link, and it is
 *   rendered by a component on 21 pages. Judged one page at a time it is
 *   contextual every time. Judged across the site it is template: nobody wrote
 *   21 arguments for the waitlist, they wrote one component.
 *
 * Neither is visible from inside a single page, so this returns the raw links
 * and the classification happens once the whole crawl is in hand.
 */
function linksIn(html) {
  const body = stripChrome(html);
  const found = [];
  const claimed = new Set();

  /*
   * A LINK THAT IS A HEADING IS NAVIGATION, NEVER PROSE
   * ---------------------------------------------------
   * Card grids are marked up as lists, correctly: a list of links is a list.
   * That put every card link inside an li, where the prose heuristic saw a
   * container of fifteen or so words with a three word anchor and scored it as
   * contextual writing.
   *
   * The effect was not small. The windstorm cluster's sibling cards produced
   * four inbound "contextual" links to one page, all with the identical anchor,
   * and the anchor discipline check then correctly reported a repetition that
   * nobody had written into a sentence. The measurement was manufacturing both
   * the links and the violation.
   *
   * Headings are stripped from the container before anchors are read, so a link
   * that exists only as a card title falls through to the chrome pass and is
   * counted as template, which is what it is. A link inside a paragraph that
   * happens to sit in the same li is still found.
   *
   * This changed the numbers, so it is worth being explicit: the drop in the
   * contextual count at the moment this landed is the correction, not a
   * regression.
   */
  for (const c of body.matchAll(/<(p|li|dd)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const inner = c[2].replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi, " ");
    const containerText = textOf(inner);
    for (const a of inner.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const href = a[1];
      if (!href.startsWith("/")) continue;
      const anchor = textOf(a[2]);
      if (!anchor) continue;
      claimed.add(anchor + href);
      found.push({ href, anchor, containerText });
    }
  }

  // Everything else in the body: card links, buttons, breadcrumb trails. No
  // container prose at all, so they can never be contextual.
  for (const a of body.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = a[1];
    if (!href.startsWith("/")) continue;
    const anchor = textOf(a[2]);
    if (!anchor) continue;
    if (claimed.has(anchor + href)) continue;
    found.push({ href, anchor, containerText: "" });
  }

  return found;
}

/**
 * Does this link sit in enough prose to be a contextual link?
 *
 * Two conditions, both necessary. The container has to be a real sentence rather
 * than a label, and the anchor has to be a part of it rather than the whole of
 * it. A word count rather than a character ratio, because "Loving West Texas"
 * and "Coverage is stated by region because that is the honest unit" differ in
 * structure, not in the ratio of their lengths.
 */
function sitsInProse(link) {
  const containerWords = link.containerText.split(/\s+/).filter(Boolean).length;
  const anchorWords = link.anchor.split(/\s+/).filter(Boolean).length;
  if (containerWords < 12) return false;
  return anchorWords / containerWords <= 0.5;
}

const sm = await get("/sitemap.xml");
if (sm.status !== 200) {
  console.error(`link-map: cannot read sitemap (status ${sm.status})`);
  process.exitCode = 1;
}
const routes = [...sm.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (m) => m[1].replace(/^https?:\/\/[^/]+/, "") || "/",
);

// Crawl first, classify second. See the note on linksIn.
const perRoute = new Map();
for (const route of routes) {
  const { status, html } = await get(route);
  if (status !== 200) continue;
  perRoute.set(route, linksIn(html));
}

/**
 * Sentences that appear verbatim on many pages are a component, not an argument.
 *
 * Keyed on the container text so that one component rendering the same sentence
 * across the site is recognized as one piece of writing rather than counted once
 * per page it appears on.
 */
const containerAppearances = new Map();
for (const [route, links] of perRoute) {
  for (const link of links) {
    if (!link.containerText) continue;
    const key = link.containerText;
    if (!containerAppearances.has(key)) containerAppearances.set(key, new Set());
    containerAppearances.get(key).add(route);
  }
}
/** Above this many pages, identical prose is a template. */
const TEMPLATE_APPEARANCE_THRESHOLD = 3;

/** target path -> { contextual: [{from, anchor}], template: number } */
const inbound = new Map();
for (const r of routes) inbound.set(r, { contextual: [], template: 0 });

for (const [route, links] of perRoute) {
  for (const link of links) {
    const target = link.href.split("#")[0].split("?")[0] || "/";
    if (!inbound.has(target)) inbound.set(target, { contextual: [], template: 0 });
    if (target === route) continue; // self links are not inbound

    const repeated =
      link.containerText &&
      (containerAppearances.get(link.containerText)?.size ?? 0) > TEMPLATE_APPEARANCE_THRESHOLD;

    if (sitsInProse(link) && !repeated) {
      inbound.get(target).contextual.push({ from: route, anchor: link.anchor });
    } else {
      inbound.get(target).template += 1;
    }
  }
}

const rows = [...inbound.entries()]
  .map(([target, data]) => ({
    target,
    contextual: data.contextual.length,
    template: data.template,
    anchors: data.contextual.map((c) => c.anchor),
  }))
  .sort((a, b) => b.contextual - a.contextual || a.target.localeCompare(b.target));

// ---------- anchor discipline ----------
//
// The playbook's linking law: no anchor phrasing repeated more than twice at the
// same target, and a target whose inbound anchors are overwhelmingly one phrase
// reads as manipulation. Reported rather than failed, because this is a tool for
// planning a linking pass, not a gate on the build.

const anchorWarnings = [];
for (const row of rows) {
  if (row.contextual === 0) continue;
  const counts = new Map();
  for (const a of row.anchors) {
    const key = a.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [anchor, n] of counts) {
    if (n > 2) anchorWarnings.push(`${row.target}: "${anchor}" used ${n} times`);
  }
  const top = Math.max(...counts.values());
  if (row.contextual >= 4 && top / row.contextual > 0.9) {
    anchorWarnings.push(
      `${row.target}: ${Math.round((top / row.contextual) * 100)}% of contextual anchors are one phrase`,
    );
  }
}

// ---------- output ----------

const snapshot = Object.fromEntries(rows.map((r) => [r.target, { contextual: r.contextual, template: r.template }]));

if (mode === "baseline") {
  fs.writeFileSync(BASELINE, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`link-map: baseline written to ${path.relative(process.cwd(), BASELINE)}`);
}

console.log("=== INTERNAL LINK MAP ===");
console.log(`${routes.length} routes crawled against ${BASE}`);
console.log("contextual = in prose, at a point a reader would want it");
console.log("template   = cards, buttons, breadcrumbs, and body navigation\n");
console.log("  ctx  tmpl  target");
console.log("  ---  ----  ------");
for (const r of rows) {
  console.log(`  ${String(r.contextual).padStart(3)}  ${String(r.template).padStart(4)}  ${r.target}`);
}

const orphans = rows.filter((r) => r.contextual === 0 && r.template === 0);
if (orphans.length) {
  console.log(`\nNo inbound internal links at all: ${orphans.map((o) => o.target).join(", ")}`);
}

const noContextual = rows.filter((r) => r.contextual === 0 && r.template > 0);
if (noContextual.length) {
  console.log(`\nTemplate links only, no contextual inbound (${noContextual.length}):`);
  console.log(`  ${noContextual.map((o) => o.target).join(", ")}`);
}

if (anchorWarnings.length) {
  console.log("\nAnchor discipline:");
  for (const w of anchorWarnings) console.log(`  ${w}`);
}

if (mode === "compare") {
  if (!fs.existsSync(BASELINE)) {
    console.error(`\nlink-map: no baseline at ${BASELINE}. Run with --baseline first.`);
    process.exitCode = 1;
  } else {
    const before = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
    console.log("\n=== CHANGE SINCE BASELINE ===");
    let changed = 0;
    for (const r of rows) {
      const was = before[r.target];
      if (!was) {
        console.log(`  NEW    ${r.target}  ctx ${r.contextual}, tmpl ${r.template}`);
        changed++;
        continue;
      }
      if (was.contextual !== r.contextual) {
        const delta = r.contextual - was.contextual;
        console.log(`  ${delta > 0 ? "+" : ""}${delta} ctx  ${r.target}  (${was.contextual} to ${r.contextual})`);
        changed++;
      }
    }
    for (const target of Object.keys(before)) {
      if (!rows.some((r) => r.target === target)) {
        console.log(`  GONE   ${target}`);
        changed++;
      }
    }
    if (changed === 0) console.log("  no change in contextual inbound links");
  }
}

const totalContextual = rows.reduce((a, r) => a + r.contextual, 0);
console.log(`\n${totalContextual} contextual internal links across ${rows.length} targets.`);
