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
/* Moved to info@ 2026-10-10, operator ruling: a live alias, public and Reply-To together. */
const PUBLIC_EMAIL = "info@254engineering.com";

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
const MIN_TITLE = 50;
const MAX_TITLE = 60;
/* 150 since 2026-10-10, operator ruling on the search appearance table (was 140). */
const MIN_DESC = 150;
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

/*
 * THE SITEMAP AND ROBOTS, operator ruling 2026-10-10 (and CLAUDE.md section 4).
 * robots.txt names the sitemap; the sitemap lists no route twice and not the
 * retired /waitlist; and a <lastmod> appears only on an insights post, the one
 * kind of page with a true per-page date, never a build time on everything.
 */
{
  const robots = await (await fetch(`${BASE}/robots.txt`)).text();
  if (!/^Sitemap:\s*https:\/\/254engineering\.com\/sitemap\.xml\s*$/m.test(robots))
    problems.push("robots.txt: does not point at https://254engineering.com/sitemap.xml");
  const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
  const locs = entries.map((e) => (e.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? "").replace(/^https?:\/\/[^/]+/, "") || "/");
  if (new Set(locs).size !== locs.length) problems.push("sitemap.xml: a route is listed twice");
  if (locs.includes("/waitlist")) problems.push("sitemap.xml: lists /waitlist, which is a permanent redirect");
  const datedNotPost = entries.filter((e, i) => /<lastmod>/.test(e) && !locs[i].startsWith("/insights/"));
  if (datedNotPost.length) problems.push(`sitemap.xml: ${datedNotPost.length} entr(ies) carry a lastmod with no true per-page date`);
  const dated = entries.filter((e) => /<lastmod>/.test(e)).length;
  console.log(`sitemap: ${locs.length} routes, ${dated} with a true lastmod (insights posts only)`);
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
  /* Sharpened 2026-10-10, operator ruling: titles END "| 254 Engineering", the brand
   * whole, never "254 Engineering Services" and never a truncation of it. */
  else if (!title.endsWith(" | 254 Engineering"))
    problems.push(`${route}: title does not end "| 254 Engineering" ("${title}")`);

  if (!description) problems.push(`${route}: no meta description`);
  else if (description.length > MAX_DESC)
    problems.push(`${route}: description is ${description.length} chars, over ${MAX_DESC}`);
  else if (description.length < MIN_DESC)
    problems.push(`${route}: description is only ${description.length} chars, under ${MIN_DESC}`);
  else if (!CTA_VERB.test(description))
    problems.push(`${route}: description has no call to action ("${description.slice(-48)}")`);

  if (!meta.canonical) problems.push(`${route}: no canonical link`);
  /* One canonical, not merely one present: two disagreeing canonicals are ignored by Google. */
  const canonicals = (html.match(/<link\s+rel="canonical"/gi) ?? []).length;
  if (canonicals > 1) problems.push(`${route}: ${canonicals} canonical links, expected exactly 1`);
  /* The brand, operator ruling 2026-10-10. Was "254 Engineering Services". */
  if (meta.ogSiteName !== "254 Engineering")
    problems.push(`${route}: og:site_name is "${meta.ogSiteName}", expected "254 Engineering"`);
  /* Every JSON-LD block parses. extract() answers a failed parse with null, which
   * the type checks below would otherwise read as simply absent. */
  const unparsed = meta.jsonLd.filter((d) => d === null).length;
  if (unparsed) problems.push(`${route}: ${unparsed} JSON-LD block(s) do not parse`);
  if (route === "/") {
    /* The homepage carries no publish or modified date, operator ruling 2026-10-10. */
    const dated =
      /<meta[^>]+(?:article:published_time|article:modified_time|date)[^>]*>/i.test(html) ||
      meta.jsonLd.some((d) => d && (d.datePublished || d.dateModified));
    if (dated) problems.push(`${route}: the homepage carries a publish or modified date`);
    if (meta.jsonLd.filter(Boolean).length < 3)
      problems.push(`${route}: expected the Organization, WebSite and BreadcrumbList nodes, found ${meta.jsonLd.filter(Boolean).length}`);
  }

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
  /*
   * THE ENTITY NODES LIVE ON THE HOMEPAGE, AND ON /corpus-christi UNDER THE SAME
   * @id. Operator ruling, 2026-10-10. Until then they shipped on every public
   * page from the site layout. Asserted in both directions: present where ruled,
   * absent everywhere else, so a layout that puts them back fails here.
   */
  const ENTITY_ROUTES = new Set(["/", "/corpus-christi"]);
  if (ENTITY_ROUTES.has(route)) {
    if (!types.includes("ProfessionalService")) problems.push(`${route}: no Organization schema`);
    if (route === "/" && !types.includes("WebSite")) problems.push(`${route}: no WebSite schema`);
  } else {
    if (types.includes("ProfessionalService")) problems.push(`${route}: Organization schema outside the homepage and /corpus-christi`);
    if (types.includes("WebSite")) problems.push(`${route}: WebSite schema outside the homepage`);
  }

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
