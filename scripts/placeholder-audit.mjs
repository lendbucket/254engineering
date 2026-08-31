// Placeholder and content-rule audit. Crawls the rendered output of every
// sitemap route and fails loudly on anything that reads as unfinished
// scaffolding or breaks an absolute content rule.
//
//   BASE_URL=http://localhost:3225 node scripts/placeholder-audit.mjs
//
// WHY THIS READS RENDERED OUTPUT RATHER THAN SOURCE
// -------------------------------------------------
// A fabricated 555 phone number is invisible in review, because it looks exactly
// like a real number. Reading the source is not enough either: business facts
// come from config and from the environment, so a wrong value can render
// sitewide while the repo looks clean. The only place this class of defect
// reliably shows up is in what the server actually sends.
//
// WHAT IT ENFORCES
// ----------------
//   1. No em dashes and no en dashes, anywhere. This is a hard brand rule for
//      this firm, it is the single most reliable tell of machine written copy,
//      and it is invisible at a glance because an em dash and a hyphen look
//      similar at body size. Enforced against page text, meta tags, alt text,
//      and JSON-LD alike.
//   2. No emoji, on the same footing and for the same reason.
//   3. No fabricated phone numbers. Exactly one number may appear anywhere in
//      rendered output: the one configured as FIRM_PHONE and read through
//      src/config/contact.ts. Every other ten digit number in a phone shape is
//      a finding, not only a 555 one. When FIRM_PHONE is unset, which is the
//      default, the permitted set is empty and any number at all is a finding.
//   4. No email off the firm's own domain.
//   5. No TODO, TBD, FIXME, PLACEHOLDER, XXX, or lorem ipsum.
//   6. No PE name, licence number, or firm registration number that is not in
//      src/config/credentials.ts. Engineering is a regulated profession in
//      Texas, and a plausible looking licence number written in as a placeholder
//      is indistinguishable from a real one to every reader except the board.
import { credentialAllowlist, permittedCredentialStrings } from "../src/config/credentials.ts";
import { contact } from "../src/config/contact.ts";

/*
 * The one permitted phone number, as bare digits.
 *
 * Derived from the same config the pages render from, so the audit cannot
 * disagree with the site about what the number is. If the config is empty the
 * set is empty, and then every phone shaped string on the site is a finding,
 * which is the state this build is in and intends to stay in until Robert picks
 * a number.
 *
 * Both directions of this are injection verified. Setting FIRM_PHONE and
 * rendering a DIFFERENT number must fail, and rendering the configured one must
 * pass. An allowlist that has only ever been tested in the passing direction is
 * an allowlist that might be matching everything.
 */
const PERMITTED_PHONE_DIGITS = new Set(
  [contact.phone]
    .filter(Boolean)
    .map((v) => String(v).replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "")),
);

const BASE = process.env.BASE_URL || "http://localhost:3225";

/** The one domain company email may live on. */
const REAL_EMAIL_DOMAIN = "254engineering.com";

/**
 * Deliberate, reviewed exceptions.
 *
 * Each needs a reason, and each is matched as a literal against the matched
 * string rather than against the whole page, so an allowlisted token cannot hide
 * a real finding sitting next to it.
 */
const ALLOWLIST = [
  {
    literal: "notifications@254engineering.com",
    why: "The From address on notification email. On domain, never rendered to a visitor, and present only if it ever leaks into markup.",
  },
  // The credential allowlist lives in the config beside the register it guards,
  // so that adding a permitted credential and explaining why it is permitted are
  // the same edit.
  ...credentialAllowlist,
];

/**
 * Credential shaped strings.
 *
 * Anything matching these has to be in src/config/credentials.ts, which is
 * currently empty on purpose: no PE has been hired and the firm registration is
 * pending, so no credential may render anywhere on this site.
 *
 * The patterns are deliberately broad. A false positive costs a line in the
 * allowlist and a sentence explaining it. A false negative is a fabricated
 * licence number on a page that a procurement officer checks against the board.
 */
const PE_NAME = /\b[A-Z][a-z]+(?:\s+[A-Z]\.)?\s+[A-Z][a-z]+,\s*P\.?\s?E\.?(?![a-z])/g;
const LICENSE_NUMBER = /\b(?:P\.?E\.?|licen[sc]e|lic\.)\s*(?:no\.?|number|#)?\s*[:#]?\s*\d{4,7}\b/gi;
const FIRM_REGISTRATION =
  /\bF-\d{3,6}\b|\bfirm\s+(?:registration|reg\.?)\s*(?:no\.?|number|#)\s*[:#]?\s*[A-Za-z0-9-]{2,}/gi;
const TBPELS_NUMBER = /\bTBPELS\s+Firm\s+No\.?\s*[A-Za-z0-9-]+/gi;

const permitted = permittedCredentialStrings();

const allowed = (match) => ALLOWLIST.some((a) => match.includes(a.literal) || a.literal.includes(match));

// ---------- fetch + render helpers ----------

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, html: await res.text() };
}

/**
 * Visible text only: scripts, styles, and JSON-LD stripped, tags removed,
 * entities decoded. Word markers are checked against this rather than against
 * raw HTML so framework internals and the RSC payload cannot produce phantom
 * hits.
 */
function visibleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/\s+/g, " ")
    .trim();
}

/** Attribute values that are user visible or machine consumed, plus JSON-LD. */
function surfaces(html) {
  const out = [];
  for (const m of html.matchAll(/href="(tel:[^"]*)"/gi)) out.push(["tel: link", m[1]]);
  for (const m of html.matchAll(/href="(mailto:[^"]*)"/gi)) out.push(["mailto: link", m[1]]);
  for (const m of html.matchAll(/placeholder="([^"]*)"/gi)) out.push(["input placeholder", m[1]]);
  for (const m of html.matchAll(/\balt="([^"]*)"/gi)) out.push(["alt text", m[1]]);
  for (const m of html.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)) out.push(["title tag", m[1]]);
  for (const m of html.matchAll(/<meta[^>]+content="([^"]*)"/gi)) out.push(["meta tag", m[1]]);
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    out.push(["JSON-LD", m[1]]);
  }
  return out;
}

// ---------- the rules ----------

const WORD_MARKERS = /\b(TODO|TBD|FIXME|PLACEHOLDER|XXX|LOREM)\b/gi;
const LOREM = /lorem\s+ipsum/gi;
const THROWAWAY = /\b(?:example\.com|test@[\w.-]+|sample@[\w.-]+|you@[\w.-]+)/gi;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// Loose on separators, strict on shape, so (210) 446-5446, 210.446.5446, and
// 2104465446 all normalize to the same ten digits.
const PHONE = /(?:\+?1[\s.\-]?)?\(?\b\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}\b/g;
// Unseparated runs, which is how tel: hrefs are written. The separated pattern
// above cannot anchor inside an 11 digit run, so a fabricated number reachable
// only through a tel: link would slip past it.
const PHONE_RUN = /\+?1?\d{10}(?!\d)/g;
// U+2012 figure dash through U+2015 horizontal bar. Em and en are the two that
// matter; the neighbours are included because they are visually identical at
// body size and a paste from a word processor produces them just as easily.
const LONG_DASH = /[‒–—―]/g;
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu;

const findings = [];
const seen = new Set();
const record = (route, rule, match, where) => {
  const value = String(match).trim();
  if (allowed(value)) return;
  const key = `${route}|${rule}|${value}|${where}`;
  if (seen.has(key)) return;
  seen.add(key);
  findings.push({ route, rule, match: value, where });
};

/** Show a long dash in context, since the character itself is easy to miss. */
function dashContext(text, index) {
  const from = Math.max(0, index - 45);
  const to = Math.min(text.length, index + 45);
  return `...${text.slice(from, to).replace(/\s+/g, " ")}...`;
}

function scanText(route, where, text) {
  if (!text) return;

  for (const m of text.matchAll(WORD_MARKERS)) record(route, "placeholder marker", m[0], where);
  for (const m of text.matchAll(LOREM)) record(route, "lorem ipsum", m[0], where);
  for (const m of text.matchAll(THROWAWAY)) record(route, "throwaway address", m[0], where);

  for (const m of text.matchAll(LONG_DASH)) {
    record(route, "em or en dash", dashContext(text, m.index ?? 0), where);
  }
  for (const m of text.matchAll(EMOJI)) record(route, "emoji", m[0], where);

  for (const m of text.matchAll(EMAIL)) {
    const domain = m[0].split("@")[1]?.toLowerCase();
    if (domain !== REAL_EMAIL_DOMAIN) record(route, "off-domain email", m[0], where);
  }

  // Credentials. A match is a finding unless the exact string is in the
  // verified register, so an empty register forbids all of them.
  for (const [pattern, rule] of [
    [PE_NAME, "unverified PE name"],
    [LICENSE_NUMBER, "unverified licence number"],
    [FIRM_REGISTRATION, "unverified firm registration"],
    [TBPELS_NUMBER, "unverified TBPELS firm number"],
  ]) {
    for (const m of text.matchAll(pattern)) {
      if (permitted.some((value) => m[0].includes(value))) continue;
      record(route, rule, m[0], where);
    }
  }

  for (const pattern of [PHONE, PHONE_RUN]) {
    for (const m of text.matchAll(pattern)) {
      const digits = m[0].replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
      if (digits.length !== 10) continue;
      // The one configured number is allowed to appear. Nothing else is.
      if (PERMITTED_PHONE_DIGITS.has(digits)) continue;
      // The 555 case is called out separately only because it names the specific
      // mistake, which makes the report faster to act on.
      if (/^\d{3}555\d{4}$/.test(digits)) {
        record(route, "fabricated 555 number", m[0], where);
      } else {
        record(
          route,
          PERMITTED_PHONE_DIGITS.size === 0
            ? "unexpected phone number (this site publishes none)"
            : "phone number that is not the configured FIRM_PHONE",
          m[0],
          where,
        );
      }
    }
  }
}

// ---------- crawl ----------

// process.exitCode rather than process.exit() throughout: an abrupt exit while
// keep-alive sockets from the crawl are still open trips a libuv assertion on
// Windows and replaces the intended status with a crash code.
const bail = (message) => {
  console.error(`placeholder-audit: ${message}`);
  process.exitCode = 1;
};

const sm = await get("/sitemap.xml");
const routes =
  sm.status === 200
    ? [...sm.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
        (m) => m[1].replace(/^https?:\/\/[^/]+/, "") || "/",
      )
    : [];

// The waitlist is not in the sitemap by design, and it is the single most
// compliance sensitive page on the site. Crawled explicitly so that the one page
// most likely to carry a slip is not the one page nobody checks.
const EXTRA_ROUTES = ["/waitlist", "/llms.txt", "/llms-full.txt"];

if (sm.status !== 200) {
  bail(`cannot read sitemap at ${BASE}/sitemap.xml (status ${sm.status})`);
} else if (routes.length === 0) {
  bail("sitemap contained no URLs; refusing to report a pass on zero routes");
}

const allRoutes = [...routes, ...EXTRA_ROUTES];

for (const route of allRoutes) {
  const { status, html } = await get(route);
  if (status !== 200) {
    findings.push({ route, rule: "unreachable", match: `HTTP ${status}`, where: "response" });
    continue;
  }
  // The plain text endpoints have no markup to strip, so they are scanned whole.
  if (route.endsWith(".txt")) {
    scanText(route, "plain text body", html);
    continue;
  }
  scanText(route, "page text", visibleText(html));
  for (const [where, value] of surfaces(html)) scanText(route, where, value);
}

// ---------- report ----------

console.log("=== PLACEHOLDER AND CONTENT RULE AUDIT ===");
console.log(`scanned ${allRoutes.length} routes against ${BASE}`);

if (allRoutes.length > 0 && findings.length === 0) {
  console.log(`\nPASS: no placeholder content, no long dashes, no emoji, no stray contact details.`);
  console.log(`allowlisted by design: ${ALLOWLIST.map((a) => `"${a.literal}"`).join(", ")}`);
}

// Group by rule so a failure reads as a problem, not a wall of routes.
const byRule = new Map();
for (const f of findings) {
  if (!byRule.has(f.rule)) byRule.set(f.rule, []);
  byRule.get(f.rule).push(f);
}
for (const [rule, list] of byRule) {
  console.log(`\n-- ${rule}: ${list.length} finding(s)`);
  for (const f of list) console.log(`   ${f.route}\n     [${f.where}] ${f.match}`);
}
if (findings.length > 0) {
  console.log(
    `\nFAIL: ${findings.length} finding(s) across ${new Set(findings.map((f) => f.route)).size} route(s).`,
  );
  process.exitCode = 1;
}
