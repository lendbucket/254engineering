// CTA audit. Asserts a primary conversion path on every route.
//
//   BASE_URL=http://localhost:3225 node scripts/cta-audit.mjs
//
// WHAT COUNTS AS A CONVERSION PATH
// --------------------------------
// A route passes when a reader who has decided to act can act without going
// back to the navigation. In practice that means a form on the page, or a link
// to the page that carries one. The site footer links to /contact from every
// route, and that deliberately does NOT count: a footer link is navigation, not
// a call to action, and counting it would make this audit pass on every page
// forever while measuring nothing.
//
// So the search is scoped to the page body with the header and footer removed,
// and what it looks for is a CTA element rather than any link to a CTA URL.
//
// THE PRELAUNCH RULE
// ------------------
// While the gate is active the honest conversion path is the waitlist, not an
// order. A page whose only CTA invites somebody to order a service the firm may
// not yet sell is a compliance failure as well as a conversion one, so under the
// gate the CTA has to be waitlist or notify language, and order language on a
// service surface is a finding.
const BASE = process.env.BASE_URL || "http://localhost:3225";
/*
 * THE MODE COMES FROM THE GATE. Same defect as voice-audit and found the same
 * way: this audit carried its own copy of the compliance gate, derived from
 * LAUNCH_MODE, which has not been the whole gate since 2026-09-10 and now gates
 * `open` alone. It was asserting waitlist language on a site that has no
 * waitlist.
 */
import "./lib/load-env.mjs";
const { launchMode } = await import("../src/lib/launch.ts");
const MODE = launchMode();
/*
 * AND THE CONSTANT MEANS SOMETHING DIFFERENT HERE THAN IN voice-audit, WHICH IS
 * WHY BOTH ARE WRITTEN OUT RATHER THAN SHARED.
 *
 * There it governs whether a regulated CLAIM is a failure, and the conservative
 * answer holds through trading. Here it governs whether the honest call to
 * action is the WAITLIST, and under trading it is not: the firm takes enquiries
 * and quotes, the operator has ruled the waitlist out of the site entirely, and
 * expecting waitlist wording would fail every page for having the right CTA.
 */
const GATE_ACTIVE = MODE === "prelaunch";

/**
 * Routes that legitimately carry no call to action.
 *
 * Legal documents are the whole list. A privacy policy with a conversion button
 * in it reads as a landing page pretending to be a legal document, and the
 * playbook's own linking law gives legal pages no inbound weight for the same
 * reason.
 */
const NO_CTA_EXPECTED = [
  { path: "/privacy", why: "A legal document. A CTA here would be a conversion device in a legal notice." },
  { path: "/terms", why: "Same as privacy." },
  { path: "/llms.txt", why: "Machine readable, not a page." },
  { path: "/llms-full.txt", why: "Machine readable, not a page." },
];

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, html: await res.text() };
}

/**
 * The page body with the site chrome removed.
 *
 * Everything before the first `<main` and everything from `<footer` onward is
 * dropped, so a header CTA and the footer's contact link cannot satisfy this
 * check on a page that has nothing of its own.
 */
function pageBody(html) {
  const mainStart = html.indexOf("<main");
  const footerStart = html.lastIndexOf("<footer");
  const from = mainStart === -1 ? 0 : mainStart;
  const to = footerStart === -1 ? html.length : footerStart;
  return html.slice(from, to);
}

// A link to a position page counts as a conversion path. The careers hub
// converts by routing to the position, which is where the application lives.
// The pattern used to require an exact /careers and so reported the rebuilt hub
// as having no conversion path at all, which was a finding about the audit.
/*
 * AN ORDER LINK AND A TELEPHONE LINK ARE CONVERSION PATHS TOO, AND THIS PATTERN
 * COULD NOT SEE EITHER. Found 2026-09-17 when nine service pages were reported
 * as having no conversion path at all while each carried an order button.
 *
 * The report was wrong and the pages were worse than the report: they had a CTA
 * and it led to a page that refuses, because no line has an approved protocol.
 * Both facts were invisible here, one because the pattern did not match an
 * order href and the other because no check asked where a CTA goes.
 *
 * `tel:` is included because on this site it is a first class call to action,
 * rendered as a button beside the primary one, and for a contractor on a roof
 * it is the likeliest path of the two.
 */
const CTA_HREF = /<a[^>]+href="(\/waitlist[^"]*|\/contact|\/order\/start\/[a-z0-9-]+|tel:[^"]+|\/careers(?:\/[a-z-]+)?|#apply)"[^>]*>/gi;
const FORM = /<form\b/i;
const WAITLIST_LANGUAGE = /join the waitlist|get notified|notify me|hear from us|opening soon/i;
const ORDER_LANGUAGE = /\border (?:a|an|your)\b|\bbuy now\b|\bschedule (?:an|your) inspection\b|\bstart your order\b/i;

const sm = await get("/sitemap.xml");
if (sm.status !== 200) {
  console.error(`cta-audit: cannot read sitemap (status ${sm.status})`);
  process.exitCode = 1;
}
const routes = [...sm.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (m) => m[1].replace(/^https?:\/\/[^/]+/, "") || "/",
);
const allRoutes = [...routes, "/waitlist"];

if (allRoutes.length <= 1) {
  console.error("cta-audit: sitemap contained no URLs; refusing to report a pass on zero routes");
  process.exitCode = 1;
}

for (const route of allRoutes) {
  const { status, html } = await get(route);
  if (status !== 200) {
    rec(`${route}: reachable`, false, `HTTP ${status}`);
    continue;
  }

  const exempt = NO_CTA_EXPECTED.find((e) => e.path === route);
  const body = pageBody(html);
  const ctaLinks = [...body.matchAll(CTA_HREF)].map((m) => m[1]);
  const hasForm = FORM.test(body);
  const hasCta = ctaLinks.length > 0 || hasForm;

  if (exempt) {
    // Stated as its own assertion rather than skipped, so that a legal page
    // quietly growing a conversion button is a finding rather than silence.
    rec(
      `${route}: correctly carries no call to action`,
      !hasCta,
      hasCta ? `found ${hasForm ? "a form" : ctaLinks.join(", ")}; ${exempt.why}` : exempt.why,
    );
    continue;
  }

  rec(
    `${route}: has a conversion path in the page body`,
    hasCta,
    hasCta ? (hasForm ? "form on page" : ctaLinks.join(", ")) : "no form and no CTA link outside the header and footer",
  );

  if (!GATE_ACTIVE || !hasCta) continue;

  const bodyText = body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

  // Under the gate, a service surface must offer the waitlist rather than a sale.
  const isServiceSurface = route === "/" || route.startsWith("/services") || route.startsWith("/coverage");
  if (isServiceSurface) {
    rec(
      `${route}: prelaunch CTA is waitlist or notify language`,
      WAITLIST_LANGUAGE.test(bodyText),
      WAITLIST_LANGUAGE.test(bodyText) ? "" : "no waitlist or notify wording found in the page body",
    );
  }

  const orderMatch = bodyText.match(ORDER_LANGUAGE);
  rec(
    `${route}: no order language while the gate is active`,
    !orderMatch,
    orderMatch ? `"${orderMatch[0]}"` : "",
  );
}

console.log("=== CTA AUDIT ===");
console.log(`${allRoutes.length} routes against ${BASE}`);
console.log(GATE_ACTIVE ? "prelaunch gate ACTIVE: the honest CTA is the waitlist" : "live mode");
console.log("");
for (const r of out) {
  console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
}
const fails = out.filter((r) => !r.ok);
console.log(`\n${out.length - fails.length}/${out.length} pass`);
process.exitCode = fails.length ? 1 : 0;
