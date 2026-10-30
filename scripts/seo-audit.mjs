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
import { readFileSync, readdirSync } from "node:fs";
import { readSource } from "./lib/read-source.mjs";
import { chromium } from "playwright";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import { AUDIT_BASE_URL } from "./lib/ports.mjs";
import { napFindings } from "./lib/nap.mjs";
import { titleProblems, descriptionProblems, duplicateProblems } from "./lib/metadata-rules.mjs";

const BASE = process.env.BASE_URL || AUDIT_BASE_URL;

/*
 * ==========================================================================
 * THE STORED NUMBER IS READ IN TWO PLACES AND DERIVED EVERYWHERE ELSE.
 * ==========================================================================
 *
 * The rendered assertion further down catches a display string reaching the
 * JSON-LD of a page this audit fetches. It cannot catch a NEW consumer that
 * emits the raw value somewhere this audit never looks: an email footer, an API
 * response, a PDF. This is that guard, one level earlier.
 *
 * WHY AN ALLOWLIST OF FILES RATHER THAN A RULE ABOUT EMITTING. "Emits the raw
 * value" is the property that actually matters and it is not mechanically
 * detectable: telHref reads contact.phone raw and is CORRECT, because it strips
 * and rebuilds. So the checkable proxy is WHERE the raw value may be read at
 * all, and it is a proxy, which is said here rather than implied.
 *
 *   src/config/contact.ts  the three derivers. This is the one place that is
 *                          allowed to know what the stored shape is.
 *   src/lib/launch.ts      the gate's validator, which must see the raw value
 *                          because its whole job is judging whether the stored
 *                          string is a real number or a placeholder.
 *
 * Anything else reading it is a consumer that has not gone through a deriver,
 * which is how schema.tsx published a display string as the firm's
 * machine-readable number until 2026-09-14.
 */
{
  const ALLOWED_RAW_PHONE_READERS = ["src/config/contact.ts", "src/lib/launch.ts"];

  /* Block comments and line comments, so a mention in prose is not a consumer. */
  const stripComments = (text) =>
    text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  const walk = (dir, out = []) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(full, out);
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
  };

  const offenders = [];
  for (const file of walk("src")) {
    const rel = file.split("\\").join("/");
    if (ALLOWED_RAW_PHONE_READERS.some((a) => rel.endsWith(a))) continue;
    if (stripComments(readFileSync(file, "utf8")).includes("contact.phone")) offenders.push(rel);
  }

  if (offenders.length) {
    console.log("");
    console.log("FAIL: the stored phone number is read outside the two places allowed to read it:");
    for (const o of offenders) console.log("  " + o);
    console.log("");
    console.log("  Call a deriver instead: e164Phone() for anything a machine reads,");
    console.log("  displayPhone() for anything a person reads, telHref() for a link.");
    console.log("  src/config/contact.ts stores E.164 and derives every other form from it,");
    console.log("  and a consumer that reads the raw value is a consumer that can publish");
    console.log("  whatever happens to be in the environment variable.");
    process.exitCode = 1;
  } else {
    console.log("PASS: the stored phone number is read only by its derivers and the launch gate.");
  }
}

/*
 * ==========================================================================
 * THE PUBLIC ADDRESS AND THE MAILBOX A REPLY REACHES ARE ONE ADDRESS.
 * ==========================================================================
 *
 * Operator ruling, 2026-10-04. He reads support@254engineering.com, and
 * info@254engineering.com does not exist as a mailbox at all.
 *
 * WHAT HAPPENED, AND IT IS THE DEFECT THIS REPOSITORY MEETS MOST OFTEN. Every
 * email's Reply-To collapsed to support@ on 2026-09-08 and the reasoning was
 * written down in email-identity.ts in plain words. `business.email` stayed at
 * info@, so for twenty-six days thirty public surfaces and the FOOTER of every
 * outbound message printed an address that reached nobody, while every reply
 * went somewhere else. Two homes for one fact, and the drift landed in the one
 * nothing checked.
 *
 * THE LITERAL IS WRITTEN HERE AND NOT IMPORTED, which is the section 6c
 * mechanism rather than duplication for its own sake. This audit imports
 * neither config: an audit that reads its expectation from the module under
 * test compares a value to itself and cannot disagree with anything, which this
 * file already records about email-audit's From header. So the address is
 * stated, and both configs are read as TEXT and asserted to agree with it.
 * Changing the firm's address costs three deliberate edits.
 *
 * TWO CHECKS, BECAUSE THEY FAIL IN DIFFERENT WORLDS. The first asserts the two
 * configs agree with the ruling and with each other, which is the drift this
 * exists to prevent. The second asserts the RENDERED JSON-LD, further down,
 * because the source can be right while the render is not, and nobody reads
 * JSON-LD by eye.
 */
const PUBLIC_EMAIL = "support@254engineering.com";

/*
 * ==========================================================================
 * ONE NAME, ADDRESS AND PHONE ON EVERY PUBLIC PAGE.
 * ==========================================================================
 *
 * Robert's instruction of 2026-10-26, 15:57 Central, piece 4: "254 Engineering",
 * "5601 South Padre Island Drive, Suite E, Corpus Christi, TX 78412" and
 * "(281) 940-4490", identical everywhere. Pinned here as literals, never read
 * from src/config/business.ts or contact.ts, for the reason PUBLIC_EMAIL above
 * gives: an expectation imported from the config agrees with the config by
 * construction. Every sitemap route's footer and its Organization node are read
 * by scripts/lib/nap.mjs, and the count of pages read is asserted after the
 * walk so the check cannot pass over none.
 *
 * MOVED AND JOINED BY THE HOURS, Robert, 12:50 Central 2026-10-29: the office
 * is "11103 San Pedro Ave, San Antonio, TX 78216", and the hours, "Mon-Sun,
 * 8:00 AM to 8:00 PM Central", are pinned beside the three in the same way.
 */
const NAP = {
  name: "254 Engineering",
  address: "11103 San Pedro Ave, San Antonio, TX 78216",
  phone: "(281) 940-4490",
  hours: {
    line: "Monday to Sunday, 8:00 AM to 8:00 PM Central",
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    opens: "08:00",
    closes: "20:00",
  },
};
let napPagesRead = 0;

/*
 * THE GUIDE PAGES THAT CARRY ARTICLE SCHEMA, as Robert named them on
 * 2026-10-25 (his message said fifteen and listed fourteen; these are the
 * fourteen listed). A literal, never read from the code that renders them.
 */
const ARTICLE_PAGES = new Set([
  "/what-is-a-structural-engineer",
  "/structural-engineer",
  "/structural-engineer/cost",
  "/structural-engineer/when-you-need-one",
  "/structural-engineer/inspection",
  "/structural-engineer/how-to-choose",
  "/windstorm/before-work-begins",
  "/windstorm/catastrophe-area",
  "/windstorm/completed-construction",
  "/windstorm/re-roofs-and-repairs",
  "/windstorm/appointed-engineers",
  "/windstorm/buying-and-selling",
  "/windstorm/opening-protection",
  "/windstorm/twia-coverage",
]);
let articlePagesSeen = 0;

/*
 * HOW MANY RENDERED PAGES ACTUALLY CARRIED AN email PROPERTY TO CHECK.
 *
 * The rendered assertion further down loops over each page's JSON-LD and
 * compares `node.email` when it is present. A loop that finds the property on
 * NO page passes exactly as cleanly as one that finds it correct everywhere,
 * and the first board that ran it could not tell me which had happened.
 *
 * That is the vacuous green this repository keeps meeting: a check on an empty
 * set, announcing nothing. So the count is carried out and asserted below, the
 * way surface-audit carries its own vacuity check for the same reason. If
 * schema.tsx stops emitting the property, or this audit stops reaching the page
 * that has it, the board says so instead of going quietly green.
 */
let schemaEmailsSeen = 0;

{
  const businessSource = readSource("src/config/business.ts");
  const identitySource = readSource("src/config/email-identity.ts");

  /*
   * Matched on the FIELD and the CONSTANT, not on a bare mention, because both
   * files now discuss the old address in prose and a substring search would
   * find it there. CLAUDE.md records five instances of a matcher attaching to
   * its neighbour, and four of them were a pattern looking for a call that
   * matched a name.
   */
  const declared = businessSource.match(/email:\s*"([^"]+)"/);
  const replyTo = identitySource.match(/REPLY_TO\s*=\s*`([^`]+)`/);

  const publicAddress = declared ? declared[1] : null;
  /* `support@${business.domain}`, resolved against the domain this audit pins. */
  const replyAddress = replyTo ? replyTo[1].replace("${business.domain}", "254engineering.com") : null;

  const agree = publicAddress === PUBLIC_EMAIL && replyAddress === PUBLIC_EMAIL;

  if (!agree) {
    console.log("");
    console.log(`FAIL: the public address and the email reply-to must both be ${PUBLIC_EMAIL}.`);
    console.log(`  src/config/business.ts         email: ${publicAddress ?? "(could not read it)"}`);
    console.log(`  src/config/email-identity.ts   REPLY_TO: ${replyAddress ?? "(could not read it)"}`);
    console.log("");
    console.log("  These were two different addresses for twenty-six days: every reply reached");
    console.log("  support@ while thirty public surfaces and every email footer printed info@,");
    console.log("  a mailbox that does not exist. If the firm's address is genuinely changing,");
    console.log("  this literal moves too, and that third edit is the point of it.");
    process.exitCode = 1;
  } else {
    console.log(`PASS: the public address and the email reply-to are both ${PUBLIC_EMAIL}.`);
  }
}

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
/*
 * The bounds (titles 50 to 60, descriptions 140 to 160) and the call to action
 * pattern live in scripts/lib/metadata-rules.mjs since 2026-10-30, so the
 * preflight's static proof applies the same rules before a server runs.
 */

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

/* Every page's HTML as the crawl read it, for the link checks after the metadata pass. */
const pageHtml = new Map();

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
  pageHtml.set(route, { html, robotsHeader: res.headers.get("x-robots-tag") ?? "" });
  const meta = extract(html);
  napPagesRead += 1;
  problems.push(...napFindings(route, html, meta.jsonLd, NAP));
  const title = decode(meta.title);
  const description = decode(meta.description);

  rows.push({ route, title, description, h1s: meta.h1s });

  problems.push(...titleProblems(route, title));
  problems.push(...descriptionProblems(route, description));

  if (!meta.canonical) problems.push(`${route}: no canonical link`);
  // Ruled 2026-10-19: the site name is "254 Engineering". It was pinned as
  // "254 Engineering Services", the DBA, until then. A literal, never the
  // config value, so a drifted constant reads as drifted.
  if (meta.ogSiteName !== "254 Engineering")
    problems.push(`${route}: og:site_name is "${meta.ogSiteName}", expected "254 Engineering"`);

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
  /* A node's @type can be an array since 2026-10-25, so every type a node names is counted. */
  const types = meta.jsonLd.filter(Boolean).flatMap((d) => [].concat(d["@type"] ?? []));
  if (!types.includes("BreadcrumbList")) problems.push(`${route}: no BreadcrumbList schema`);
  if (!types.includes("ProfessionalService")) problems.push(`${route}: no Organization schema`);
  if (!types.includes("WebSite")) problems.push(`${route}: no WebSite schema`);

  /*
   * WHAT THE TWO NODES SAY, NOT ONLY THAT THEY EXIST. Operator ruling,
   * 2026-10-19. Google showed "254engineering.com" as the site name while both
   * nodes were present, because both said "254 Engineering Services". The
   * presence checks above were green throughout. Pinned as literals.
   */
  const websiteNode = meta.jsonLd.find((d) => d && d["@type"] === "WebSite");
  if (websiteNode) {
    if (websiteNode.name !== "254 Engineering")
      problems.push(`${route}: WebSite name is ${JSON.stringify(websiteNode.name)}, expected "254 Engineering"`);
    if (websiteNode.url !== "https://254engineering.com")
      problems.push(`${route}: WebSite url is ${JSON.stringify(websiteNode.url)}, expected "https://254engineering.com"`);
    if ("alternateName" in websiteNode)
      problems.push(`${route}: WebSite carries alternateName ${JSON.stringify(websiteNode.alternateName)}`);
  }
  /*
   * The organisation node is found by any type it names, and its types are then
   * pinned as the literal pair (Robert, 2026-10-25), so a node that drops either
   * one, or becomes a second entity, is named. A find on one string would have
   * matched nothing once the type became an array, and passed.
   */
  const orgNode = meta.jsonLd.find((d) => d && [].concat(d["@type"] ?? []).includes("ProfessionalService"));
  if (!orgNode) problems.push(`${route}: no node carries ProfessionalService`);
  else if (JSON.stringify(orgNode["@type"]) !== JSON.stringify(["Organization", "ProfessionalService"]))
    problems.push(`${route}: the organisation node's @type is ${JSON.stringify(orgNode["@type"])}, expected ["Organization","ProfessionalService"]`);
  const orgNodes = meta.jsonLd.filter((d) => d && [].concat(d["@type"] ?? []).some((t) => t === "Organization" || t === "ProfessionalService") && d["@id"]);
  if (orgNodes.length > 1) problems.push(`${route}: ${orgNodes.length} organisation nodes with an @id, expected one entity`);

  /*
   * ARTICLE ON THE GUIDE PAGES AND NOWHERE ELSE, BY THE ORGANISATION, DATED
   * FROM GIT (Robert, 2026-10-25). The dates' agreement with git is
   * guide-dates-audit's; this asserts what the page publishes.
   */
  const articles = meta.jsonLd.filter((d) => d && [].concat(d["@type"] ?? []).includes("Article"));
  if (ARTICLE_PAGES.has(route)) {
    articlePagesSeen += 1;
    if (articles.length !== 1) problems.push(`${route}: ${articles.length} Article nodes, expected exactly one on a guide page`);
    for (const a of articles) {
      const org = "https://254engineering.com/#organization";
      if (a.author?.["@id"] !== org || a.publisher?.["@id"] !== org)
        problems.push(`${route}: Article author and publisher must both be the organisation (${org}), got ${JSON.stringify({ author: a.author, publisher: a.publisher })}`);
      if (JSON.stringify(a).includes('"Person"')) problems.push(`${route}: Article names a Person`);
      for (const k of ["datePublished", "dateModified"]) {
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(a[k] ?? "")) problems.push(`${route}: Article ${k} is ${JSON.stringify(a[k])}, not a commit date`);
      }
      if (a.datePublished && a.dateModified && Date.parse(a.datePublished) > Date.parse(a.dateModified))
        problems.push(`${route}: Article was modified before it was published`);
      if (!a.headline || a.headline !== decode(meta.h1s[0] ?? "")) problems.push(`${route}: Article headline ${JSON.stringify(a.headline)} is not the page's h1 ${JSON.stringify(decode(meta.h1s[0] ?? ""))}`);
    }
  } else if (articles.length) {
    problems.push(`${route}: carries Article schema, which is for the fourteen guide pages only`);
  }
  if (orgNode) {
    if (orgNode.name !== "254 Engineering")
      problems.push(`${route}: Organization name is ${JSON.stringify(orgNode.name)}, expected "254 Engineering"`);
    if (orgNode.legalName !== "254 Engineering LLC")
      problems.push(`${route}: Organization legalName is ${JSON.stringify(orgNode.legalName)}, expected "254 Engineering LLC"`);
    if (orgNode.parentOrganization?.name !== "Craftline Brands")
      problems.push(`${route}: Organization parentOrganization is ${JSON.stringify(orgNode.parentOrganization ?? null)}, expected Craftline Brands`);
    if ("alternateName" in orgNode)
      problems.push(`${route}: Organization carries alternateName ${JSON.stringify(orgNode.alternateName)}`);
  }
  /*
   * The homepage title: the keyword leads and the brand follows, Robert's title
   * rule restated 2026-10-25, which superseded the brand-led title of
   * 2026-10-19. Pinned as the literal, so the order is moved on purpose or not
   * at all.
   */
  if (route === "/" && decode(meta.title) !== "Texas Engineering Services Statewide | 254 Engineering")
    problems.push(`/: homepage title is "${decode(meta.title)}", expected "Texas Engineering Services Statewide | 254 Engineering"`);

  /*
   * ========================================================================
   * A MACHINE-READABLE NUMBER IS E.164 OR IT IS NOT PUBLISHED.
   * ========================================================================
   *
   * Operator ruling, 2026-09-14. `schema.tsx` emitted `contact.phone` RAW into
   * the JSON-LD `telephone` property, so whatever string sat in the environment
   * variable became the firm's machine-readable number.
   *
   * IT WAS THE ONLY SURFACE THAT COULD BE WRONG WITHOUT LOOKING WRONG.
   * `displayPhone` and `telHref` both strip and rebuild, so a display string set
   * by mistake still renders as `(281) 940-4490` and still dials correctly. The
   * site is perfect and the structured data is a display string, and nobody
   * reads JSON-LD by eye, so no screenshot could ever find it.
   *
   * This asserts the RENDERED output rather than the source, because what a
   * consumer receives is the only thing that matters and the source can be
   * correct while the render is not.
   */
  for (const node of meta.jsonLd.filter(Boolean)) {
    const tel = node.telephone;
    if (tel === undefined || tel === null) continue;
    if (!/^\+1\d{10}$/.test(String(tel))) {
      problems.push(
        `${route}: schema telephone is "${tel}", which is not E.164. ` +
          "src/config/contact.ts stores E.164 and derives every display form from it; " +
          "a display string here is published to every machine that reads this page.",
      );
    }
  }

  /*
   * AND THE EMAIL PROPERTY, FOR THE SAME REASON AND AGAINST A PINNED LITERAL.
   *
   * schema.tsx emits business.email as the JSON-LD `email` on every page, so
   * this is the machine-readable half of the address: a crawler, a knowledge
   * panel, and anything reading structured data take it from here. It is
   * asserted against the literal rather than against the config, because the
   * config being self-consistent is the thing that was already true while the
   * address was wrong.
   */
  for (const node of meta.jsonLd.filter(Boolean)) {
    const mail = node.email;
    if (mail === undefined || mail === null) continue;
    schemaEmailsSeen += 1;
    if (String(mail) !== PUBLIC_EMAIL) {
      problems.push(
        `${route}: schema email is "${mail}" and the firm's one public address is ${PUBLIC_EMAIL}. ` +
          "Every machine that reads this page takes the address from here, and info@254engineering.com " +
          "is not a mailbox that exists.",
      );
    }
  }

  if (title) {
    if (!titles.has(title)) titles.set(title, []);
    titles.get(title).push(route);
  }
  if (description) {
    if (!descriptions.has(description)) descriptions.set(description, []);
    descriptions.get(description).push(route);
  }
}

/*
 * ==========================================================================
 * THE ONE CLAIM ON THIS SITE THAT EXPIRES.
 *
 * JobPosting carries validThrough, Google shows it in a jobs surface, and a
 * posting whose date has passed is a stale claim in a place people act on. The
 * data file has said "OWNER VERIFICATION: refresh or close before it lapses"
 * since it was written, which is a reminder addressed to whoever happens to
 * open the file. Nothing was watching the date.
 *
 * This is what watches it, and it deliberately fails EARLY: while the posting
 * is still valid, inside the warning window, so the decision is made while the
 * answer is "yes, still hiring" or "no, close it" rather than after the listing
 * has quietly stopped being emitted.
 *
 * THE WINDOW IS READ FROM THE DATA FILE, NOT RESTATED HERE.
 * A second copy of the number is a second thing to change, and the one that
 * gets missed is the one in the audit, which then passes for a fortnight it
 * should have failed.
 * ==========================================================================
 */
{
  const source = readSource("data/positions.ts");
  const declared = source.match(/POSTING_WARNING_DAYS = (\d+)/);
  if (!declared) {
    problems.push(
      "positions: POSTING_WARNING_DAYS is not declared in data/positions.ts, so the lapse window cannot be checked",
    );
  }
  const windowDays = declared ? Number(declared[1]) : 30;

  const today = new Date();
  const warnFrom = new Date(today.getTime() + windowDays * 86_400_000).toISOString().slice(0, 10);

  const postings = [];
  for (const row of rows) {
    if (!row.route.startsWith("/careers")) continue;
    const res = await fetch(`${BASE}${row.route}`);
    const html = await res.text();
    for (const match of html.matchAll(
      /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    )) {
      let node;
      try {
        node = JSON.parse(match[1]);
      } catch {
        continue;
      }
      if (node?.["@type"] === "JobPosting") postings.push({ route: row.route, node });
    }
  }

  /*
   * NOT VACUOUS. If every posting lapsed, the pages would emit none and every
   * check below would pass over an empty list, which is the failure this
   * repository keeps finding. An empty jobs surface while the firm is hiring is
   * itself the thing to go and look at.
   */
  if (postings.length === 0) {
    problems.push(
      "careers: no JobPosting markup was served at all. Either every posting has lapsed, or the pages stopped emitting it.",
    );
  }

  for (const { route, node } of postings) {
    const validThrough = String(node.validThrough ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(validThrough)) {
      problems.push(`${route}: JobPosting validThrough is "${validThrough}", which is not a date`);
      continue;
    }
    const day = today.toISOString().slice(0, 10);
    if (validThrough < day) {
      problems.push(
        `${route}: JobPosting validThrough ${validThrough} has PASSED and is still being served. Refresh the date or close the role in data/positions.ts.`,
      );
    } else if (validThrough <= warnFrom) {
      problems.push(
        `${route}: JobPosting validThrough ${validThrough} is inside ${windowDays} days. Refresh it or set open: false in data/positions.ts before it lapses.`,
      );
    }
    if (!node.datePosted || node.datePosted >= validThrough) {
      problems.push(
        `${route}: JobPosting datePosted ${node.datePosted} is not before validThrough ${validThrough}`,
      );
    }
  }

  /*
   * AND THE MARKUP IS EMITTED FROM THE FILTERED LIST, by inspection, because
   * everything above is true of a page that happens to have no lapsed posting
   * today and would go on being true the day one lapses.
   */
  const hub = readSource("src/app/(site)/careers/page.tsx");
  if (!/schemaPositions\(\)\.map/.test(hub)) {
    problems.push(
      "careers hub: JobPosting is not emitted from schemaPositions, so a lapsed posting would still be claimed",
    );
  }
  const detail = readSource("src/app/(site)/careers/[slug]/page.tsx");
  if (!/postingState\(position\) !== "lapsed"/.test(detail)) {
    problems.push(
      "careers detail: JobPosting is emitted without checking whether the posting has lapsed",
    );
  }

  console.log("");
  console.log("=== JOB POSTINGS ===");
  for (const { route, node } of postings) {
    console.log(`${route}: valid through ${node.validThrough} (posted ${node.datePosted})`);
  }
  console.log(`warning window: ${windowDays} days, so anything on or before ${warnFrom} fails`);
}

/*
 * THE VACUITY GUARD ON THE RENDERED ADDRESS CHECK.
 *
 * Asserted after the routes have been walked, because only then is the count
 * real. A zero here means the loop above inspected nothing: either schema.tsx
 * stopped emitting the email property, or this audit stopped reaching any page
 * that carries it. Both of those are a check that has silently become a green
 * line about an empty set, which is worse than no check, because the line
 * scrolls past in a green run and everybody trusts the green.
 */
if (articlePagesSeen !== ARTICLE_PAGES.size) {
  problems.push(`the Article check reached ${articlePagesSeen} of the ${ARTICLE_PAGES.size} guide pages: the rest are missing from the sitemap`);
} else {
  console.log(`PASS: Article schema checked on all ${ARTICLE_PAGES.size} guide pages, and refused everywhere else.`);
}

if (napPagesRead === 0 || napPagesRead !== routes.length) {
  problems.push(
    `the name, address and phone check read ${napPagesRead} of ${routes.length} sitemap pages; ` +
      "every public page has to be read for it to mean anything",
  );
} else {
  console.log(`PASS: name, address and phone read on all ${napPagesRead} sitemap pages, footer and Organization node.`);
}

if (schemaEmailsSeen === 0) {
  problems.push(
    "the rendered schema email check inspected nothing: no page's JSON-LD carried an email " +
      "property, so that check would pass whatever address the firm published. schema.tsx emits " +
      `business.email as the Organization email, and ${PUBLIC_EMAIL} is the pinned value it has ` +
      "to equal.",
  );
} else {
  console.log(`PASS: the rendered schema email was checked on ${schemaEmailsSeen} JSON-LD node(s).`);
}

/*
 * ==========================================================================
 * NO PUBLIC PAGE CARRIES NOFOLLOW, AND EVERY SITEMAP PAGE HAS TWO INBOUND
 * LINKS. Robert, 2026-10-25, from the Ahrefs crawl of 2026-10-26 00:18 UTC.
 * ==========================================================================
 *
 * The crawl found /windstorm-inquiry marked "noindex, nofollow", the sole cause
 * of four warnings across the 22 pages linking to it, and two pages nothing
 * linked to enough: /what-is-a-structural-engineer with no internal link at
 * all, /windstorm/twia-coverage with one. Nothing here measured either.
 *
 * The pages read are the sitemap plus the public pages kept out of it on
 * purpose: the waitlist, the two quote forms, and the /order/start page of
 * every service line the catalogue declares (read from data/catalog.ts, never
 * listed here). A noindex page
 * is still followed, so it counts as a source of links like any other.
 *
 * An inbound link is an <a href> on ANOTHER page naming the route, after the
 * origin, the query, the fragment and a trailing slash are taken off. Two
 * distinct source pages is the floor. Template links count, as they do for a
 * crawler.
 */
{
  const ORIGINS = [BASE, "https://254engineering.com", "https://www.254engineering.com"];
  const normalise = (href) => {
    let h = href.replace(/&amp;/g, "&");
    for (const o of ORIGINS) if (h.startsWith(o)) h = h.slice(o.length) || "/";
    if (!h.startsWith("/") || h.startsWith("//")) return null;
    h = h.split("#")[0].split("?")[0];
    if (h.length > 1) h = h.replace(/\/+$/, "");
    return h || "/";
  };
  const anchors = (html) => [...html.matchAll(/<a\b([^>]*)>/gi)].map((m) => m[1]);
  const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1] ?? null;

  /*
   * THE START PAGES COME FROM THE CATALOGUE'S DECLARATION, NOT FROM /order's
   * LINKS. The first board of this check (40260283202) read them off the order
   * chooser and went red on its own floor: with the gate shut, /order lists
   * every line as a quote and links no start page at all, while production,
   * with a different gate, linked three. Every line the catalogue declares has
   * a start page that renders in every mode ("the gate is rendered, not linked
   * around"), so the subject is the declaration and does not depend on the
   * environment the audit happens to run in.
   */
  const catalogSlugs = [...new Set([...readFileSync("data/catalog.ts", "utf8").matchAll(/serviceSlug: "([a-z0-9-]+)"/g)].map((m) => m[1]))];
  const orderLinks = catalogSlugs.map((s) => `/order/start/${s}`);
  const OFF_SITEMAP = ["/waitlist", "/design-inquiry", "/windstorm-inquiry", ...orderLinks];
  for (const route of OFF_SITEMAP) {
    if (pageHtml.has(route)) continue;
    const res = await fetch(`${BASE}${route}`);
    if (res.status !== 200) {
      problems.push(`${route}: HTTP ${res.status} (a public page kept out of the sitemap)`);
      continue;
    }
    pageHtml.set(route, { html: await res.text(), robotsHeader: res.headers.get("x-robots-tag") ?? "" });
  }
  if (orderLinks.length < 8)
    problems.push(`the catalogue declared ${orderLinks.length} service line(s), below the 8 of 2026-10-25, so the start pages were not all read`);

  const problemsBefore = problems.length;
  let nofollowRead = 0;
  for (const [route, { html, robotsHeader }] of pageHtml) {
    nofollowRead += 1;
    const robotsMeta = [...html.matchAll(/<meta\b[^>]*>/gi)]
      .map((m) => m[0])
      .filter((t) => /name="(robots|googlebot)"/i.test(t))
      .map((t) => attr(t, "content") ?? "");
    for (const content of robotsMeta) {
      if (/nofollow|\bnone\b/i.test(content)) problems.push(`${route}: meta robots is "${content}", which tells a crawler not to follow its links`);
    }
    if (/nofollow|\bnone\b/i.test(robotsHeader)) problems.push(`${route}: X-Robots-Tag is "${robotsHeader}"`);
    for (const a of anchors(html)) {
      const href = normalise(attr(a, "href") ?? "");
      const rel = attr(a, "rel") ?? "";
      if (href && /nofollow/i.test(rel)) problems.push(`${route}: an internal link to ${href} carries rel="${rel}"`);
    }
  }

  const inbound = new Map(routes.map((r) => [r, new Set()]));
  let linksSeen = 0;
  for (const [source, { html }] of pageHtml) {
    for (const a of anchors(html)) {
      const href = normalise(attr(a, "href") ?? "");
      if (!href || href === source) continue;
      linksSeen += 1;
      inbound.get(href)?.add(source);
    }
  }
  const thin = [...inbound].filter(([, from]) => from.size < 2);
  for (const [route, from] of thin) {
    problems.push(`${route}: ${from.size} page(s) link to it${from.size ? ` (${[...from].join(", ")})` : ""}; every sitemap page needs at least two`);
  }
  if (linksSeen === 0 || nofollowRead < routes.length) {
    problems.push(`the link checks read ${nofollowRead} page(s) and ${linksSeen} internal link(s): a check over nothing`);
  } else if (problems.length === problemsBefore) {
    console.log(`PASS: no nofollow on ${nofollowRead} public pages, and all ${routes.length} sitemap pages are linked from two or more (${linksSeen} internal links counted).`);
  } else {
    console.log(`the link checks read ${nofollowRead} public pages and ${linksSeen} internal links, and name ${problems.length - problemsBefore} problem(s) in the result below.`);
  }
}

problems.push(...duplicateProblems(titles, descriptions));

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
