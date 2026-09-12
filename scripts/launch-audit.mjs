// @runtime react-server
//
// Declared because this audit reaches a module carrying `server-only`, so it
// cannot run under plain node or under tsx without the react-server condition.
// scripts/lib/audit-runtime.mjs works the requirement out from the imports and
// the board refuses to start when package.json disagrees, so this line and the
// invocation cannot drift apart.
// Compliance gate audit. The most important check in this suite.
//
//   node scripts/launch-audit.mjs
//
// WHY THIS EXISTS AND WHY IT RUNS THE SITE TWICE
// ----------------------------------------------
// The firm's registration with the Texas Board of Professional Engineers and
// Land Surveyors is pending. Until it is active the site must not state that the
// firm offers or performs engineering services. That is a legal constraint on
// rendered copy, and the failure mode is not a broken page: it is a page that
// renders beautifully and says one sentence it is not entitled to say.
//
// Everything hangs off one environment variable, which produces two hazards that
// only a run of both modes can catch:
//
//   1. A page that forgets to consult the gate. It renders identically in both
//      modes, so a single-mode run cannot see it. Running both and diffing the
//      gated surfaces is what makes a forgetful page visible.
//   2. A live mode that was never exercised. LAUNCH_MODE=live is the flip that
//      happens once, under time pressure, on the day the registration lands. A
//      mode first executed in production on its most important day is not a
//      mode anybody has tested.
//
// So this runs the site in prelaunch, then in live, and asserts what each must
// say, what each must not say, and the claims neither may ever make.
//
// It runs `next dev` rather than `next start`, and that is load bearing. Most of
// this site is statically prerendered, so under `next start` the gate has
// already been resolved at build time and both runs would serve whatever mode
// the last build was made in. Dev renders each request, which is the only way to
// exercise two modes from one build. The practical consequence for deployment is
// stated in src/lib/launch.ts: flipping LAUNCH_MODE requires a rebuild.
import { startNextServer } from "./lib/dev-server.mjs";
import {
  NEVER_CLAIMS,
  PRESENT_TENSE_OFFER,
  PRESENT_TENSE_SEALING,
} from "./lib/regulatory.mjs";
import { withGateConditionsMet, FIXTURE_FIRM_NUMBER, FIXTURE_ENV } from "./lib/gate-fixture.mjs";

const PRELAUNCH_PORT = Number(process.env.LAUNCH_AUDIT_PORT || 3227);
const LIVE_PORT = Number(process.env.LAUNCH_AUDIT_LIVE_PORT || 3228);

/** A stand-in firm number for the live run. Never rendered anywhere else. */
const TEST_FIRM_NUMBER = FIXTURE_FIRM_NUMBER;
/** Stand-in PE licence for the live run. Same reasoning as the firm number. */
const TEST_PE_LICENSE = "AUDIT-FIXTURE-NOT-A-REAL-LICENCE";

const ROUTES = [
  "/",
  "/about",
  "/services",
  "/services/roof-inspections",
  "/services/windstorm-wpi-8",
  "/services/forensic-engineering",
  "/coverage",
  "/coverage/coastal-bend",
  "/government",
  "/careers",
  "/contact",
  "/waitlist",
  "/privacy",
  "/terms",
  "/llms.txt",
];

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

function visibleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function crawl(base) {
  const pages = new Map();
  for (const route of ROUTES) {
    const res = await fetch(base + route);
    const html = await res.text();
    pages.set(route, { status: res.status, html, text: visibleText(html) });
  }
  return pages;
}

/** Routes where a phrase appears, so a failure names the page. */
function routesMatching(pages, pattern) {
  const hits = [];
  for (const [route, page] of pages) {
    if (pattern.test(page.text)) hits.push(route);
  }
  return hits;
}

/*
 * The regulated claim patterns come from scripts/lib/regulatory.mjs.
 *
 * They used to be defined here, and scripts/voice-audit.mjs carried its own
 * copy of the same idea. The two disagreed within a day: this file learned the
 * passive voice sealing patterns and the voice audit did not. One definition,
 * consumed by both, and copied verbatim into the sibling repos.
 */

/**
 * Boot a server in one mode, crawl it, and shut it down before the next.
 *
 * Sequential rather than side by side, and not by preference. Next 16 refuses to
 * start a second `next dev` in a directory that already has one, so the obvious
 * design, two servers up at once and a diff between them, fails on the second
 * boot with "Another next dev server is already running". Crawling each mode
 * into a Map and comparing the Maps afterward gets the same comparison without
 * the two processes ever overlapping.
 */
async function crawlMode(label, port, env) {
  console.log(`Starting ${label} server on ${port} ...`);
  const server = await startNextServer({
    port,
    command: "dev",
    timeoutMs: 180_000,
    env,
  });
  try {
    return await crawl(server.base);
  } finally {
    await server.stop();
  }
}

async function run() {
  {
    const pre = await crawlMode("prelaunch", PRELAUNCH_PORT, {
      LAUNCH_MODE: "prelaunch",
      TBPELS_FIRM_NUMBER: "",
      TBPELS_PE_LICENSE: "",
    });
    // Live means both gates open: a registration AND an engineer of record. The
    // in-between state, registered but nobody able to seal, is real and is
    // handled by registrationLine(), but the live assertions below describe the
    // fully open site.
    /*
     * THE LIVE CRAWL RUNS WITH THE GATE'S CONDITIONS STATED TRUE IN THE FILE.
     *
     * Setting TBPELS_FIRM_NUMBER used to be enough. Operator ruling
     * 2026-09-10 made the gate a set of named conditions read from
     * configuration, so no variable opens it any more and this crawl was
     * rendering the PRELAUNCH site while asserting live things about it.
     *
     * withGateConditionsMet writes the register, runs, and puts it back,
     * which is what the ruling says opening the gate takes. LAUNCH_MODE is
     * still set here rather than by the fixture, because the switch is the
     * operator's and an audit that forgot it should get prelaunch.
     */
    const live = await withGateConditionsMet(() =>
      crawlMode("live", LIVE_PORT, {
        LAUNCH_MODE: "live",
        TBPELS_PE_LICENSE: TEST_PE_LICENSE,
        /*
         * The gate grew a phone condition on 2026-09-11, and a spawned server
         * reads it from its own environment rather than from the patched
         * files. Without this the live crawl renders the PRELAUNCH site and
         * asserts live things about it, which is the exact failure the 09-10
         * ruling produced and this comment exists to stop repeating.
         */
        ...FIXTURE_ENV,
      }),
    );

    const unreachablePre = [...pre.entries()].filter(([, p]) => p.status !== 200).map(([r]) => r);
    const unreachableLive = [...live.entries()].filter(([, p]) => p.status !== 200).map(([r]) => r);
    rec("every audited route answers 200 in prelaunch", unreachablePre.length === 0, unreachablePre.join(", "));
    rec("every audited route answers 200 in live mode", unreachableLive.length === 0, unreachableLive.join(", "));

    // ---------- prelaunch ----------

    /*
     * THE PRELAUNCH FOOTER NAMES THE REGISTRANT NOW, AND THESE TWO CHECKS
     * CHANGED WITH THE RULING RATHER THAN BEING LOOSENED.
     *
     * Operator ruling, 2026-09-11: until the board holds the operating name,
     * the public footer reads "254 Services LLC, TBPELS Firm F-29811" with the
     * brand above it, so the day the gate opens the sites already hold out
     * under the registered name.
     *
     * The old pair asserted that the footer said "pending" and that no page
     * rendered a firm number at all. Both are now the wrong question, and the
     * second had become WORSE than wrong: it matched "TBPELS Firm No." and the
     * ruled string is "TBPELS Firm F-29811", so it would have passed over every
     * page forever while measuring nothing.
     *
     * What replaces them is the property that actually matters and that neither
     * old check could see: the number appears, it appears beside the name the
     * BOARD issued it to, and it never appears beside the name the firm trades
     * under.
     */
    const REGISTRANT_LINE = "254 Services LLC, TBPELS Firm F-29811";
    const missingDisclosure = [...pre.entries()]
      .filter(([route, p]) => !route.endsWith(".txt") && !p.text.includes(REGISTRANT_LINE))
      .map(([route]) => route);
    rec(
      "prelaunch: the footer names the registrant and the number on every page",
      missingDisclosure.length === 0,
      missingDisclosure.join(", "),
    );

    /*
     * The hazard the gate exists to prevent, asserted directly. "254
     * Engineering Services" within a short distance of the number means the
     * board's number is sitting beside a name the board has no record of.
     */
    /*
     * MATCHED IN THE HTML AND WITHIN ONE ELEMENT, NOT IN THE EXTRACTED TEXT.
     *
     * The first version of this matched p.text and failed on all fourteen
     * routes, which was the check being wrong rather than the pages. The
     * footer renders the brand and the registrant line as two SEPARATE
     * paragraphs, exactly as the ruling asks, and flattening to text puts them
     * side by side with nothing between.
     *
     * [^<] stops at the first tag boundary, so this asks the question that
     * actually matters: does any single rendered element put the board number
     * and the trading name in one phrase.
     */
    const besideTradingName = [...pre.entries()]
      .filter(([, p]) =>
        /254 Engineering Services[^<]{0,60}F-29811|F-29811[^<]{0,60}254 Engineering Services/i.test(p.html),
      )
      .map(([route]) => route);
    rec(
      "prelaunch: no page puts the number beside the trading name",
      besideTradingName.length === 0,
      besideTradingName.join(", "),
    );

    /*
     * AND THE CREDENTIAL CLAIM SURFACES STILL CARRY NOTHING. tbpelsFirmNumber()
     * returns null while the gate is shut, which is a different answer from the
     * footer's on purpose: the footer discloses who the registrant is, these
     * assert what the firm may do.
     */
    /*
     * "TBPELS Firm No." and not "TBPELS Firm". The first version matched the
     * latter and failed on /government, which was the check reading that
     * page's own FOOTER rather than its capability statement.
     *
     * The two strings are genuinely different claims and that is the point:
     * the footer discloses who the registrant is, the capability statement
     * asserts the firm is registered, and only the second may not appear while
     * the gate is shut.
     */
    const claimLeak = ["/government"].filter((r) => /TBPELS Firm No./i.test(pre.get(r).text));
    rec(
      "prelaunch: the capability statement claims no firm number",
      claimLeak.length === 0,
      claimLeak.join(", "),
    );

    const servicePages = ["/services", "/services/roof-inspections", "/services/windstorm-wpi-8", "/services/forensic-engineering"];
    const missingNotice = servicePages.filter((r) => !/Opening soon/i.test(pre.get(r).text));
    rec(
      "prelaunch: every service surface carries the opening soon treatment",
      missingNotice.length === 0,
      missingNotice.join(", "),
    );

    const missingWaitlistCta = servicePages.filter((r) => !pre.get(r).html.includes('href="/waitlist'));
    rec(
      "prelaunch: every service surface routes its CTA to the waitlist",
      missingWaitlistCta.length === 0,
      missingWaitlistCta.join(", "),
    );

    const presentTense = [];
    for (const { pattern, why } of PRESENT_TENSE_OFFER) {
      for (const route of routesMatching(pre, pattern)) {
        presentTense.push(`${route}: ${why}`);
      }
    }
    rec(
      "prelaunch: no page claims the firm is currently offering or performing engineering work",
      presentTense.length === 0,
      presentTense.join("; "),
    );

    rec(
      "prelaunch: the waitlist page states plainly that work is not being accepted",
      /not yet accepting engineering work/i.test(pre.get("/waitlist").text),
    );

    // ---------- the engineer of record gate ----------

    const sealingClaims = [];
    for (const { pattern, why } of PRESENT_TENSE_SEALING) {
      for (const route of routesMatching(pre, pattern)) {
        sealingClaims.push(`${route}: ${why}`);
      }
    }
    rec(
      "prelaunch: no page claims a licensed engineer is already reviewing or sealing",
      sealingClaims.length === 0,
      sealingClaims.join("; "),
    );

    const turnaroundPromise = routesMatching(pre, /\b(?:reviewed and )?sealed within\b/i);
    rec(
      "prelaunch: no service page promises a turnaround for sealed work",
      turnaroundPromise.length === 0,
      turnaroundPromise.join(", "),
    );

    const PE_DISCLOSURE = /no engineer of record is yet in responsible charge/i;
    const missingPeDisclosure = [...pre.entries()]
      .filter(([route, p]) => !route.endsWith(".txt") && !PE_DISCLOSURE.test(p.text))
      .map(([route]) => route);
    rec(
      "prelaunch: every page states plainly that no engineer of record is in place",
      missingPeDisclosure.length === 0,
      missingPeDisclosure.join(", "),
    );

    rec(
      "prelaunch: llms.txt carries the registration status so a model summarizing the firm states it correctly",
      pre.get("/llms.txt").text.includes(REGISTRANT_LINE),
    );

    rec(
      "prelaunch: the capability statement states the registration as pending rather than omitting it",
      /Application pending with the Texas Board/i.test(pre.get("/government").text),
    );

    // ---------- live ----------

    const liveMissingNumber = [...live.entries()]
      .filter(([route, p]) => !route.endsWith(".txt") && !p.text.includes(`TBPELS Firm ${TEST_FIRM_NUMBER}`))
      .map(([route]) => route);
    rec(
      "live: the firm number appears in the footer of every page",
      liveMissingNumber.length === 0,
      liveMissingNumber.join(", "),
    );

    const liveLegalName = [...live.entries()]
      .filter(([route, p]) => !route.endsWith(".txt") && !p.text.includes("254 Engineering Services LLC"))
      .map(([route]) => route);
    rec(
      "live: the footer renders the legal entity name alongside the firm number",
      liveLegalName.length === 0,
      liveLegalName.join(", "),
    );

    /*
     * ======================================================================
     * THE CAPABILITY STATEMENT IS WHERE THIS HAZARD IS ACTUALLY REACHABLE.
     * Added 2026-09-11, after the prelaunch version of this check turned out
     * to be unreachable rather than passing.
     * ======================================================================
     *
     * /government renders its registration row only when tbpelsFirmNumber() is
     * non null, so in prelaunch there is nothing to catch and a check there is
     * measuring an empty set. In LIVE it renders "TBPELS Firm No. <number>" two
     * rows below "Legal entity: <business.legalName>", which is a government
     * buyer reading a board number beside an entity name.
     *
     * This asserts the pair is consistent: the entity named on the capability
     * statement must be the entity the registration was issued to. It is the
     * one page where a procurement officer checks exactly that.
     *
     * WHAT IS ASSERTED HERE IS ONLY THAT THE ROW RENDERS. Whether the entity it
     * names is the entity the registration was issued to is a question about
     * two CONFIGURED strings, not about a rendered page, so it is asserted in
     * compliance-audit where both declarations are in scope. Writing it here
     * produced a condition that was true whatever the page said, which is worse
     * than no check.
     */
    const gov = live.get("/government");
    const govClaimsNumber = /TBPELS Firm No\./i.test(gov.text);
    rec(
      "live: the capability statement claims the firm number",
      govClaimsNumber,
      govClaimsNumber ? "the registration row renders" : "it renders the pending branch in live mode",
    );

    /*
     * The pending sentence is its own constant now. It used to be DISCLOSURE,
     * which was both "what prelaunch must say" and "what live must not say",
     * and those stopped being the same string on 2026-09-11 when the prelaunch
     * footer began naming the registrant. One constant serving two opposite
     * assertions is how one of them quietly stops meaning anything.
     */
    const PENDING_SENTENCE =
      "Firm registration pending with the Texas Board of Professional Engineers and Land Surveyors";
    const liveDisclosureLeak = routesMatching(live, new RegExp(PENDING_SENTENCE, "i"));
    rec(
      "live: the pending disclosure is gone from every page",
      liveDisclosureLeak.length === 0,
      liveDisclosureLeak.join(", "),
    );

    const livePeDisclosureLeak = routesMatching(live, /no engineer of record is yet in responsible charge/i);
    rec(
      "live: the engineer of record disclosure is gone from every page",
      livePeDisclosureLeak.length === 0,
      livePeDisclosureLeak.join(", "),
    );

    const liveSealing = routesMatching(live, /\bis reviewed and sealed by\b/i);
    rec(
      "live: the present tense sealing language returns",
      liveSealing.length > 0,
      liveSealing.length === 0 ? "no page states that work is reviewed and sealed" : "",
    );

    const liveNoticeLeak = routesMatching(live, /Opening soon/i);
    rec(
      "live: the opening soon treatment is gone from every page",
      liveNoticeLeak.length === 0,
      liveNoticeLeak.join(", "),
    );

    const liveWaitlistCta = servicePages.filter((r) => live.get(r).html.includes('href="/waitlist'));
    rec(
      "live: service CTAs no longer route to the waitlist",
      liveWaitlistCta.length === 0,
      liveWaitlistCta.join(", "),
    );

    const liveContactCta = servicePages.filter((r) => !live.get(r).html.includes('href="/contact"'));
    rec(
      "live: service CTAs route to contact instead",
      liveContactCta.length === 0,
      liveContactCta.join(", "),
    );

    rec(
      "live: the waitlist URL still resolves and explains what it became, rather than 404ing old links",
      live.get("/waitlist").status === 200 && /now open/i.test(live.get("/waitlist").text),
    );

    // A page that ignores the gate renders identically in both modes. The gated
    // surfaces are the ones that must differ, and this is the check that finds a
    // page which quietly forgot to ask.
    const identical = servicePages.filter((r) => pre.get(r).text === live.get(r).text);
    rec(
      "the gate actually changes every service surface between the two modes",
      identical.length === 0,
      identical.length ? `${identical.join(", ")} render identically in both modes` : "",
    );

    // ---------- claims neither mode may make ----------

    for (const { pattern, why } of NEVER_CLAIMS) {
      const hits = [
        ...routesMatching(pre, pattern).map((r) => `prelaunch ${r}`),
        ...routesMatching(live, pattern).map((r) => `live ${r}`),
      ];
      rec(`no ${why} language on any page in either mode`, hits.length === 0, hits.join(", "));
    }

    rec(
      "the forensic page states the engineer's obligation runs to the facts rather than to the paying party",
      /obligation runs to the facts/i.test(pre.get("/services/forensic-engineering").text),
    );
  }
}

/*
 * THE LAUNCH ANNOUNCEMENT REFUSES TO SEND UNDER THE GATE, PROVEN BY ATTEMPTING
 * IT RATHER THAN BY READING THE CODE.
 *
 * Operator ruling, 2026-09-08. This is the only send in the build that goes to
 * a LIST, its subject is "254 Engineering is open for orders", and under the
 * gate that is a present tense service claim made to everybody who ever put
 * their name down. It is the single most damaging thing this platform could do
 * on the wrong day, and it is the one send that cannot be recalled.
 *
 * So the refusal is exercised: the module is loaded with LAUNCH_MODE set to
 * prelaunch and asked to send to a real shaped recipient, and it must refuse
 * AND say why. A check that only asserted a boolean would pass against a
 * function that returns the reason and sends anyway.
 *
 * The template still RENDERS under the gate, and that is deliberate rather than
 * an oversight: email-audit holds its voice, its layout and its regulated copy
 * to the same standard as everything else, which is exactly what is needed
 * while somebody is writing it and it cannot yet go out.
 */
{
  const had = process.env.LAUNCH_MODE;
  process.env.LAUNCH_MODE = "prelaunch";

  try {
    /*
     * No cache busting query on this import, and that is deliberate rather than
     * an omission. An earlier version appended ?gate=<now> to force a fresh
     * module, and it broke the module's own relative imports: tsx could not
     * resolve ./launch from a specifier carrying a query string, so this check
     * reported "the announcement module could be exercised: Cannot find module
     * src/lib/launch" inside the suite while passing standalone.
     *
     * It is not needed. launchMode() reads process.env.LAUNCH_MODE at CALL time
     * rather than at module load, so setting the variable above is enough and a
     * cached module still answers correctly.
     */
    const { sendLaunchAnnouncement, announcementBlockedReason } = await import(
      "../src/lib/ops-announce.ts"
    );

    const why = announcementBlockedReason();
    rec(
      "the announcement says it is blocked in prelaunch",
      typeof why === "string" && /registration/i.test(why),
      why ?? "it reported nothing blocking it",
    );

    const attempted = await sendLaunchAnnouncement([
      { name: "Audit Recipient", email: "audit@example.invalid" },
    ]);

    rec(
      "and attempting the send in prelaunch is refused",
      attempted.ok === false,
      attempted.ok
        ? `IT SENT. queued ${attempted.queued}, skipped ${attempted.skipped}. This is the one send that cannot be taken back.`
        : attempted.error.slice(0, 90),
    );

    rec(
      "and the refusal names the registration rather than failing vaguely",
      attempted.ok === false && /registration/i.test(attempted.error),
      attempted.ok ? "" : attempted.error.slice(0, 90),
    );
  } catch (err) {
    rec("the announcement module could be exercised", false, String(err?.message ?? err).slice(0, 120));
  } finally {
    if (had === undefined) delete process.env.LAUNCH_MODE;
    else process.env.LAUNCH_MODE = had;
  }
}

await run();

console.log("\n=== COMPLIANCE GATE AUDIT ===");
for (const r of out) {
  console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? `\n        ${r.note}` : ""}`);
}
const fails = out.filter((r) => !r.ok);
console.log(`\n${out.length - fails.length}/${out.length} pass`);
process.exitCode = fails.length ? 1 : 0;
