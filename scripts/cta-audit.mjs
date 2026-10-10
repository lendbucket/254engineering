// CTA audit. Asserts a primary conversion path on every route.
//
//   BASE_URL=http://localhost:4300 node scripts/cta-audit.mjs
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
const BASE = process.env.BASE_URL || AUDIT_BASE_URL;
/*
 * THE MODE COMES FROM THE GATE. Same defect as voice-audit and found the same
 * way: this audit carried its own copy of the compliance gate, derived from
 * LAUNCH_MODE, which has not been the whole gate since 2026-09-10 and now gates
 * `open` alone. It was asserting waitlist language on a site that has no
 * waitlist.
 */
import "./lib/load-env.mjs";
import { AUDIT_BASE_URL } from "./lib/ports.mjs";
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
/* Enquiry wording since 2026-10-10, when the waitlist became a redirect to /contact. */
const WAITLIST_LANGUAGE = /send an enquiry|taking enquiries|enquiries only/i;
const ORDER_LANGUAGE = /\border (?:a|an|your)\b|\bbuy now\b|\bschedule (?:an|your) inspection\b|\bstart your order\b/i;

const sm = await get("/sitemap.xml");
if (sm.status !== 200) {
  console.error(`cta-audit: cannot read sitemap (status ${sm.status})`);
  process.exitCode = 1;
}
const routes = [...sm.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (m) => m[1].replace(/^https?:\/\/[^/]+/, "") || "/",
);
const allRoutes = [...routes];

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
      `${route}: prelaunch CTA is enquiry language`,
      WAITLIST_LANGUAGE.test(bodyText),
      WAITLIST_LANGUAGE.test(bodyText) ? "" : "no enquiry wording found in the page body",
    );
  }

  const orderMatch = bodyText.match(ORDER_LANGUAGE);
  rec(
    `${route}: no order language while the gate is active`,
    !orderMatch,
    orderMatch ? `"${orderMatch[0]}"` : "",
  );
}

/*
 * ===========================================================================
 * EVERY PUBLIC PAGE OFFERS AN ORDER OR A QUOTE, AND WHERE A LINE IS OPEN THE
 * SITE ACTUALLY LEADS TO IT. Operator ruling, 2026-10-03.
 * ===========================================================================
 *
 * His instruction: "Check with the sweep that every public page has a path to
 * ordering or to a quote, and add that as a permanent check."
 *
 * THAT SENTENCE ALONE WOULD HAVE PASSED ON THE BROKEN SITE, and saying so is the
 * point of this comment. Every page already carried a /contact link in the
 * header, so "a path to ordering OR a quote" was satisfied everywhere on the day
 * he found that nothing anywhere led to the order flow. A check that cannot fail
 * on the state that prompted it is decoration.
 *
 * SO THIS IS HIS FLOOR AND THE GUARD WITH TEETH IS IN launch-audit. That check,
 * "with the gate open, the home page leads to the order flow", had to go where
 * the subject exists: this audit runs against the suite's server, which reads a
 * .env.local with no live LAUNCH_MODE and no FIRM_PHONE and therefore renders
 * PRELAUNCH, where nothing is orderable and nothing can be missing. launch-audit
 * is the one place that already builds and crawls the site with the gate's
 * conditions stated true.
 *
 * What stays here is the permanent floor, which is true in every mode: a reader
 * on any public page can always reach either the order flow or a quote. It is
 * the weaker of the two and it is the one that should never go red.
 */
{
  const ORDER_OR_QUOTE = /href="(\/order(?:\/start\/[a-z0-9-]+)?|\/contact(?:\?[^"]*)?)"/gi;

  const chooser = await get("/order");
  rec(
    "the chooser at /order is reachable",
    chooser.status === 200,
    chooser.status === 200
      ? "it is the page both the header button and Start a job now lead to"
      : `HTTP ${chooser.status}`,
  );

  /*
   * =========================================================================
   * THE HEADER BUTTON POINTS AT THE CHOOSER, AND THIS READS THE RAW PAGE.
   * Operator ruling, 2026-10-03: "cta-audit must assert the header target is
   * /order, not /contact."
   * =========================================================================
   *
   * EVERY OTHER CHECK IN THIS FILE USES pageBody(), WHICH STRIPS THE HEADER AND
   * THE FOOTER, and that is deliberate and still right: a footer link to
   * /contact on every page would satisfy a conversion check forever while
   * measuring nothing. This assertion is about the header itself, so it is the
   * one place that must read the whole document, and saying so here stops
   * somebody "fixing" it to match its neighbours.
   *
   * THE SUBJECT IS THE HEADER SLICE, not the whole page, or a /contact link
   * anywhere in the body would fail it. The slice runs to the first <main.
   *
   * It is skipped under the gate, where the honest header destination is the
   * waitlist rather than a chooser full of things nobody can buy yet. The skip
   * is stated as its own passing assertion rather than silence, so a reader can
   * see which of the two worlds the run was in.
   */
  const home = await get("/");
  const mainAt = home.html.indexOf("<main");
  const headerSlice = mainAt === -1 ? home.html : home.html.slice(0, mainAt);
  const headerToOrder = /href="\/order"/i.test(headerSlice);
  const headerToContact = /href="\/contact(?:\?[^"]*)?"/i.test(headerSlice);
  const headerToWaitlist = /href="\/waitlist"/i.test(headerSlice);

  if (GATE_ACTIVE) {
    rec(
      "the gate is shut, so the header offers an enquiry rather than the chooser",
      headerToContact && !headerToOrder && !headerToWaitlist,
      headerToContact && !headerToOrder
        ? "nothing is orderable, and an enquiry is the honest destination"
        : "the prelaunch header points at the chooser, or at the retired waitlist",
    );
  } else {
    /*
     * IT ASSERTS THE PRESENCE OF /order AND NOT THE ABSENCE OF /contact, and the
     * first version got that wrong in a way worth keeping a note on.
     *
     * It read `headerToOrder && !headerToContact` and failed on a correct header,
     * because the primary nav carries a "Contact" item pointing at /contact. That
     * link is right and should stay: a reader who wants to write to the firm
     * should find it in the navigation. What the operator's finding was about is
     * the BUTTON, and the button is the only thing in the header that would ever
     * point at /order.
     *
     * So the presence of /order is the precise assertion. If the button reverted
     * to /contact, nothing in the header would link to /order and this goes red.
     * The nav's Contact item cannot satisfy it and cannot break it.
     *
     * Third time today I matched a wider thing than I meant, after /order where I
     * meant /order/start, and before that a font size scan that swept a file the
     * audit never read. Match the thing you mean.
     */
    rec(
      "the header button targets the chooser",
      headerToOrder,
      headerToOrder
        ? `/order on every page, which is the bug the operator reported on 2026-10-03. The nav's own Contact item is untouched and still points at /contact (${headerToContact ? "present" : "absent"})`
        : "the header does not link to /order at all, so the button is still pointing somewhere else",
    );
  }

  /*
   * A FLOOR ON THE SUBJECT. If the sitemap or the chooser came back empty every
   * assertion below would pass over nothing, which is the vacuous green this
   * repository keeps meeting.
   */
  const publicRoutes = allRoutes.filter(
    (r) => !NO_CTA_EXPECTED.some((e) => e.path === r) && !r.endsWith(".txt"),
  );
  rec(
    "there are public pages to check for an ordering path",
    publicRoutes.length >= 10,
    `${publicRoutes.length} public route(s). Below the floor this check passes over an empty list`,
  );

  /*
   * TWO WAYS TO SATISFY IT, AND THE SECOND WAS FOUND BY RUNNING THE CHECK.
   *
   * The first version asked only for a LINK and went red on six pages: /contact,
   * /design-inquiry, /waitlist, and the three careers pages. Reading them is what
   * settled it, and the six split cleanly in two.
   *
   * /contact, /design-inquiry and /waitlist ARE the quote destination. Each
   * carries the form the link on every other page points AT. Requiring them to
   * link to themselves is requiring a signpost to the room you are standing in,
   * so a page carrying a form satisfies the rule by being the thing. That is
   * derived from the page rather than from a list of names.
   *
   * THE CAREERS PAGES ARE A REAL EXEMPTION AND ARE NAMED. A hiring page is not a
   * service surface: its reader is applying for a job, its conversion path is an
   * application, and an order button in the body of a job advertisement would be
   * a conversion device in the wrong conversation. The header carries "Start a
   * job" on every page of the site including these, which is what makes the body
   * rule safe to relax here and nowhere else.
   *
   * THE EXEMPTION IS COUNTED AND ITS MEMBERS ARE PRINTED, because an exemption
   * nobody counts becomes the rule. CLAUDE.md records that as the reason an
   * allowlist of names is refused outright elsewhere: this one is a prefix with
   * a stated subject rather than a growing list of individual pages.
   */
  const CAREERS_EXEMPT = /^\/careers(\/|$)/;
  const withoutPath = [];
  const exemptedCareers = [];
  const satisfiedByOwnForm = [];
  for (const route of publicRoutes) {
    const { status, html } = await get(route);
    if (status !== 200) continue;
    const body = pageBody(html);
    if ([...body.matchAll(ORDER_OR_QUOTE)].length) continue;
    if (FORM.test(body)) {
      satisfiedByOwnForm.push(route);
      continue;
    }
    if (CAREERS_EXEMPT.test(route)) {
      exemptedCareers.push(route);
      continue;
    }
    withoutPath.push(route);
  }
  rec(
    "every public page has a path to ordering or to a quote",
    withoutPath.length === 0,
    withoutPath.slice(0, 6).join(", ") ||
      `${publicRoutes.length} route(s). ${satisfiedByOwnForm.length} carry the quote form themselves (${satisfiedByOwnForm.join(", ") || "none"}), and ${exemptedCareers.length} are hiring pages whose conversion path is an application (${exemptedCareers.join(", ") || "none"})`,
  );

  /*
   * AND THE EXEMPTION HAS NOT GROWN. Pinned as a literal, the way section 6c
   * pins a business ruling: three careers pages today, and a fourth is either a
   * real new job advertisement or somebody putting a page out of reach of this
   * check. Either way it should cost an edit here.
   */
  rec(
    "the hiring exemption still covers only the careers pages",
    exemptedCareers.length <= 3 && exemptedCareers.every((r) => CAREERS_EXEMPT.test(r)),
    `${exemptedCareers.length} exempted, pinned at no more than 3. An exemption nobody counts becomes the rule`,
  );

}

console.log("=== CTA AUDIT ===");
console.log(`${allRoutes.length} routes against ${BASE}`);
console.log(GATE_ACTIVE ? "prelaunch gate ACTIVE: the honest CTA is an enquiry" : "live mode");
console.log("");
for (const r of out) {
  console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
}
const fails = out.filter((r) => !r.ok);
console.log(`\n${out.length - fails.length}/${out.length} pass`);
process.exitCode = fails.length ? 1 : 0;
