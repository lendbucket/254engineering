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

const PRELAUNCH_PORT = Number(process.env.LAUNCH_AUDIT_PORT || 3227);
const LIVE_PORT = Number(process.env.LAUNCH_AUDIT_LIVE_PORT || 3228);

/** A stand-in firm number for the live run. Never rendered anywhere else. */
const TEST_FIRM_NUMBER = "F-000000";

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

/**
 * Claims this firm may never make, in either mode.
 *
 * These are not stylistic. Guaranteeing an approval or an engineering opinion in
 * advance is a professional conduct problem, and claim maximization language is
 * how an engineering firm ends up looking like a public adjuster to the Texas
 * Department of Insurance.
 */
/**
 * A negation guard for the claim patterns below.
 *
 * The first run of this audit failed on /llms.txt for the sentence "This firm
 * does not guarantee approvals, permits, or engineering conclusions in advance",
 * which is the disclaimer, not the claim. Matching a promise and its denial
 * identically would have taught whoever ran this next to delete the honest
 * sentence to get a green board, which is the exact opposite of what the check
 * is for. Variable length lookbehind is supported in V8, so the guard can sit
 * inline rather than requiring the text to be pre-processed.
 */
const NOT = String.raw`(?<!\b(?:not|never|cannot|no|nor)\s)`;

const NEVER = [
  {
    pattern: new RegExp(`${NOT}guarantee[ds]?\\s+(?:approval|permit|pass|certification|results?)`, "i"),
    why: "guaranteed approval",
  },
  { pattern: /\bwe guarantee\b/i, why: "unqualified guarantee" },
  { pattern: /maximi[sz]e\s+(?:your\s+)?(?:claim|settlement|payout|recovery)/i, why: "claim maximization" },
  { pattern: /\bget\s+(?:your\s+)?claim\s+(?:paid|approved)\b/i, why: "claim outcome promise" },
  { pattern: /\bfight\s+(?:your\s+)?insurance\b/i, why: "claim advocacy" },
  { pattern: /\bdenied claim\b/i, why: "claim solicitation" },
  {
    pattern: new RegExp(`${NOT}guaranteed\\s+(?:pass|approval|turnaround)`, "i"),
    why: "guaranteed outcome",
  },
  { pattern: /\b100%\s+(?:approval|pass)\b/i, why: "approval rate claim" },
  { pattern: /\bno\s+(?:pass|approval)\s*,?\s*no\s+fee\b/i, why: "contingency on an engineering opinion" },
];

/**
 * Present-tense claims to performing engineering work. Forbidden in prelaunch,
 * expected to be permissible in live mode.
 */
const PRESENT_TENSE_OFFER = [
  /\bwe (?:offer|provide|perform|deliver|issue|seal|inspect|certify)\b/i,
  /\bour engineers (?:will|can|seal|inspect|review)\b/i,
  /\border (?:a|an|your)\b/i,
  /\bschedule (?:an|your) inspection\b/i,
  /\bnow accepting\b/i,
];

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
    });
    const live = await crawlMode("live", LIVE_PORT, {
      LAUNCH_MODE: "live",
      TBPELS_FIRM_NUMBER: TEST_FIRM_NUMBER,
    });

    const unreachablePre = [...pre.entries()].filter(([, p]) => p.status !== 200).map(([r]) => r);
    const unreachableLive = [...live.entries()].filter(([, p]) => p.status !== 200).map(([r]) => r);
    rec("every audited route answers 200 in prelaunch", unreachablePre.length === 0, unreachablePre.join(", "));
    rec("every audited route answers 200 in live mode", unreachableLive.length === 0, unreachableLive.join(", "));

    // ---------- prelaunch ----------

    const DISCLOSURE = "Firm registration pending with the Texas Board of Professional Engineers and Land Surveyors";
    const missingDisclosure = [...pre.entries()]
      .filter(([route, p]) => !route.endsWith(".txt") && !p.text.includes(DISCLOSURE))
      .map(([route]) => route);
    rec(
      "prelaunch: the registration disclosure appears in the footer of every page",
      missingDisclosure.length === 0,
      missingDisclosure.join(", "),
    );

    const firmNumberLeak = routesMatching(pre, /TBPELS Firm No\./i);
    rec(
      "prelaunch: no page renders a TBPELS firm number",
      firmNumberLeak.length === 0,
      firmNumberLeak.join(", "),
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
    for (const claim of PRESENT_TENSE_OFFER) {
      for (const route of routesMatching(pre, claim)) {
        presentTense.push(`${route}: ${claim}`);
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

    rec(
      "prelaunch: llms.txt carries the registration status so a model summarizing the firm states it correctly",
      pre.get("/llms.txt").text.includes(DISCLOSURE),
    );

    rec(
      "prelaunch: the capability statement states the registration as pending rather than omitting it",
      /Application pending with the Texas Board/i.test(pre.get("/government").text),
    );

    // ---------- live ----------

    const liveMissingNumber = [...live.entries()]
      .filter(([route, p]) => !route.endsWith(".txt") && !p.text.includes(`TBPELS Firm No. ${TEST_FIRM_NUMBER}`))
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

    const liveDisclosureLeak = routesMatching(live, new RegExp(DISCLOSURE, "i"));
    rec(
      "live: the pending disclosure is gone from every page",
      liveDisclosureLeak.length === 0,
      liveDisclosureLeak.join(", "),
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

    for (const { pattern, why } of NEVER) {
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

await run();

console.log("\n=== COMPLIANCE GATE AUDIT ===");
for (const r of out) {
  console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? `\n        ${r.note}` : ""}`);
}
const fails = out.filter((r) => !r.ok);
console.log(`\n${out.length - fails.length}/${out.length} pass`);
process.exitCode = fails.length ? 1 : 0;
