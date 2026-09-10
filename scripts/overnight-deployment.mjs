// @runtime react-server
/**
 * ROUND 2: THE DEPLOYMENT, NOT THE BUILD.
 *
 *   npx tsx --conditions=react-server scripts/overnight-deployment.mjs
 *
 * Read only, signed out, against the three live sites. Nothing here writes.
 *
 * WHY PLAYWRIGHT AND NOT curl
 * ----------------------------
 * 254engineering.com sits behind Vercel's bot checkpoint, which answers curl
 * with 403 and a JavaScript challenge page rather than the route asked for.
 * Chromium executes the challenge and gets 200. CLAUDE.md section 6 records
 * this after an operator and a session both assumed otherwise, and there is no
 * bypass header in this repository to go looking for.
 *
 * WHAT IS DELIBERATELY NOT TESTED HERE
 * -------------------------------------
 * The ACCEPT path of any form. A form that accepts writes a row, and on
 * production that row is a real lead in the firm's own intake. The overnight
 * limits are read only, so this exercises the REFUSALS, which by definition
 * write nothing, and confirms the accept path is reachable without pressing it.
 * That gap is stated in the report rather than quietly skipped.
 */

import { chromium } from "playwright";
import { SURFACES } from "./lib/surfaces.mjs";
import { ALL_REGULATED, NEVER_CLAIMS, findClaims } from "./lib/regulatory.mjs";

const SITES = [
  { name: "254engineering", base: "https://254engineering.com", primary: true },
  { name: "sealedengineering", base: "https://sealedengineering.com", primary: false },
  { name: "stampmyplans", base: "https://stampmyplans.com", primary: false },
];

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });
const findings = [];

console.log("");
console.log("================ ROUND 2: THE DEPLOYMENT ================");
console.log("");

/*
 * THE ROUTES THE DEPLOYMENT ITSELF PUBLISHES.
 *
 * THIS BLOCK IS A FIX, AND THE DEFECT IT FIXES IS THE ONE THIS REPOSITORY HUNTS.
 * The first version called routesOf("public", { include: "pages" }). routesOf
 * takes a SURFACE OBJECT and this passed a string, so every property it reads
 * was undefined; "pages" is not one of the three include values either. It
 * returned an empty array and the run reported
 *
 *   PASS: 254engineering: every declared route answers 200 (0 of 0)
 *
 * which is a green over nothing, on the primary site, in a round whose entire
 * job is the primary site. Found by reading the log rather than the result.
 *
 * The right source was never routesOf at all: the site surface declares
 * routesFrom: "sitemap" precisely because it is the one surface meant to be
 * indexed, and a directory walk would measure pages the sitemap deliberately
 * omits. Against a DEPLOYMENT that is better still, because the sitemap is what
 * search engines act on and it comes from the running app rather than the tree.
 *
 * And the floor below is the other half. A sitemap that fails to parse gives an
 * empty list, which is exactly the shape that just passed silently, so the run
 * says so rather than reporting a green over nothing a second time.
 */
const SITE_SURFACE = SURFACES.find((x) => x.key === "site");
if (SITE_SURFACE?.routesFrom !== "sitemap") {
  console.error(
    "REFUSED: the site surface no longer takes its routes from the sitemap, so this round is reading the wrong list.",
  );
  process.exit(1);
}

/** The minimum number of routes a live sitemap must carry to be believed. */
const ROUTE_FLOOR = 20;

async function sitemapRoutes(page, base) {
  const res = await page.request.get(base + "/sitemap.xml", { maxRedirects: 5, timeout: 30000 });
  if (res.status() !== 200) return { routes: [], why: `sitemap answered HTTP ${res.status()}` };
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)/g)].map((m) => m[1].trim());
  const routes = [
    ...new Set(
      locs
        .filter((u) => u.startsWith(base))
        .map((u) => u.slice(base.length) || "/")
        .map((r) => (r.length > 1 && r.endsWith("/") ? r.slice(0, -1) : r)),
    ),
  ].sort();
  return { routes, why: `${locs.length} <loc> entries` };
}

/* Every same origin URL already checked, so a footer is walked once and not
 * once per page. */
const walked = new Set();

const browser = await chromium.launch();

/*
 * THE COMPLIANCE GATE, AND IT OUTRANKS EVERYTHING.
 *
 * CLAUDE.md section 1. The firm's TBPELS registration is pending and no
 * licensed PE is on staff. Nothing on the deployment may state or imply that
 * engineering services are currently offered or performed.
 *
 * Read on the DEPLOYED page rather than in the source, because what a visitor
 * sees is what matters and a build can be stale.
 *
 * THE PATTERNS ARE THE DECLARED ONES, AND THE FIRST VERSION WROTE ITS OWN.
 *
 * That version carried seven hand written regexes. scripts/lib/regulatory.mjs
 * carries twenty two, and it is the declaration both gates are stated in, read
 * by voice-audit and by launch-audit. Two accounts of one rule are two accounts
 * that will disagree, and the hand written seven were already the poorer one:
 * they had no NEGATION_GUARD, so "we do not seal" would have been reported as a
 * claim that the firm seals, and no CONDITIONAL_GUARD, so "once the firm is
 * registered it will perform" would have been too.
 *
 * Deriving from a DECLARATION is the idiom; importing from the IMPLEMENTATION
 * is the defect this repository hunts. regulatory.mjs is the first: it states
 * the rule, and no page's rendered copy is read back out of it.
 */

for (const site of SITES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  /* Reachable at all. Everything below is meaningless otherwise. */
  let landed = null;
  try {
    const res = await page.goto(site.base, { waitUntil: "domcontentloaded", timeout: 60000 });
    landed = res?.status() ?? 0;
  } catch (err) {
    rec(`${site.name}: answers`, false, String(err.message).split("\n")[0]);
    await ctx.close();
    continue;
  }
  rec(`${site.name}: answers 200 at the apex`, landed === 200, `HTTP ${landed}`);

  /* Each site's own sitemap, which is each site's own declaration of what it
   * publishes. The siblings are separate repositories, so this repository's
   * inventory could never have described them; their sitemaps can. */
  const { routes: fromSitemap, why } = await sitemapRoutes(page, site.base);
  const routes = fromSitemap.length ? fromSitemap : ["/"];
  console.log(`${site.name}: ${fromSitemap.length} routes from the live sitemap (${why})`);
  rec(
    `${site.name}: the live sitemap carries a believable number of routes`,
    fromSitemap.length >= ROUTE_FLOOR,
    fromSitemap.length >= ROUTE_FLOOR
      ? `${fromSitemap.length} routes`
      : `ONLY ${fromSitemap.length}, which is below the floor of ${ROUTE_FLOOR}: everything measured below is measured over almost nothing`,
  );

  let checked = 0;
  let brokenLinks = 0;
  let brokenImages = 0;
  /* Deferred by loading="lazy" and proved fine by fetching. Counted rather than
   * silently dropped, so the note says how much of the green was the fetch. */
  let lazyNotBroken = 0;

  for (const route of routes) {
    let status = 0;
    try {
      const res = await page.goto(site.base + route, { waitUntil: "domcontentloaded", timeout: 60000 });
      status = res?.status() ?? 0;
      await page.waitForTimeout(250);
    } catch (err) {
      findings.push(`${site.name}${route}: did not load (${String(err.message).split("\n")[0]})`);
      continue;
    }
    checked += 1;

    if (status !== 200) {
      findings.push(`${site.name}${route}: HTTP ${status}`);
      continue;
    }

    const seen = await page.evaluate(() => ({
      text: document.body.innerText,
      /* Same origin links only. An outbound link failing is somebody else's
       * deployment and not a difference between this one and main. */
      links: [...document.querySelectorAll("a[href]")]
        .map((a) => a.getAttribute("href"))
        .filter((h) => h && !h.startsWith("#") && !h.startsWith("mailto:") && !h.startsWith("tel:")),
      images: [...document.querySelectorAll("img")].map((i) => ({
        src: i.currentSrc || i.src,
        loaded: i.complete && i.naturalWidth > 0,
        alt: i.getAttribute("alt"),
      })),
      title: document.title,
    }));

    for (const hit of findClaims(seen.text, ALL_REGULATED)) {
      findings.push(
        `${site.name}${route}: THE COMPLIANCE GATE. ${hit.why} ("${hit.match}"). ` +
          "The firm's TBPELS registration is pending and no licensed PE is on staff, so nothing on any of " +
          "these sites may state or imply that engineering services are currently offered or performed.",
      );
    }
    for (const hit of findClaims(seen.text, NEVER_CLAIMS)) {
      findings.push(
        `${site.name}${route}: A CLAIM NO GATE EVER LIFTS. ${hit.why} ("${hit.match}").`,
      );
    }

    /*
     * AN IMAGE IS BROKEN WHEN ITS URL DOES NOT SERVE ONE, NOT WHEN THE DOM HAS
     * NOT GOT ROUND TO IT YET.
     *
     * The first version asked the DOM, a quarter of a second after
     * domcontentloaded, whether every img was complete with a naturalWidth.
     * It reported six broken images on the primary site, including the home
     * page, and every one of them was the footer wordmark.
     *
     * That image is loading="lazy" and sits at y=6412. It had not loaded
     * because nothing had scrolled to it, which is the browser doing exactly
     * what the page asked. Proved by fetching it: the optimized URL answers
     * 200 with 5297 bytes of image/png, and scrolling to the footer and
     * waiting turns complete false into complete true.
     *
     * So a not-yet-complete image is not a finding, it is a question, and the
     * question is answered by fetching the URL. That is also viewport
     * independent, which the scroll-and-wait alternative is not: a lazy image
     * further down a longer page would need a longer scroll and the check
     * would go quietly blind again.
     */
    for (const img of seen.images) {
      if (!img.loaded) {
        if (!img.src) {
          brokenImages += 1;
          findings.push(`${site.name}${route}: an img element has no src at all`);
        } else {
          let verdict = null;
          try {
            const r = await page.request.get(img.src, { maxRedirects: 5, timeout: 30000 });
            const type = r.headers()["content-type"] ?? "";
            const bytes = (await r.body()).length;
            if (r.status() >= 400 || !type.startsWith("image/") || bytes === 0) {
              verdict = `HTTP ${r.status()}, ${type || "no content-type"}, ${bytes} bytes`;
            }
          } catch (err) {
            verdict = String(err.message).split("\n")[0];
          }
          if (verdict) {
            brokenImages += 1;
            findings.push(`${site.name}${route}: image did not load and its URL does not serve one (${img.src}) ${verdict}`);
          } else {
            lazyNotBroken += 1;
          }
        }
      }
      if (img.alt === null) {
        findings.push(`${site.name}${route}: an image carries no alt attribute (${img.src})`);
      }
    }

    /* Links, deduplicated across the whole run so a footer is not walked once
     * per page. HEAD through the browser context, so the checkpoint is already
     * satisfied by the session. */
    for (const href of seen.links) {
      const url = href.startsWith("http") ? href : site.base + href;
      if (!url.startsWith(site.base)) continue;
      if (walked.has(url)) continue;
      walked.add(url);
      try {
        const r = await page.request.get(url, { maxRedirects: 5, timeout: 30000 });
        if (r.status() >= 400) {
          brokenLinks += 1;
          findings.push(`${site.name}${route}: link to ${href} answers ${r.status()}`);
        }
      } catch (err) {
        brokenLinks += 1;
        findings.push(`${site.name}${route}: link to ${href} could not be fetched (${String(err.message).split("\n")[0]})`);
      }
    }
  }

  rec(
    `${site.name}: every declared route answers 200 (${checked} of ${routes.length})`,
    checked === routes.length,
    checked === routes.length ? "" : "see the findings",
  );
  rec(`${site.name}: every same origin link resolves`, brokenLinks === 0, `${brokenLinks} broken`);
  rec(
    `${site.name}: every image loads`,
    brokenImages === 0,
    `${brokenImages} broken` +
      (lazyNotBroken ? `, and ${lazyNotBroken} lazy image(s) were not loaded yet and their URLs were fetched instead` : ""),
  );

  await ctx.close();
}

/* --------------------------------------------- the two doors that must refuse */

{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const base = SITES[0].base;

  /*
   * A DEAD ORDER TOKEN SAYS SO IN WORDS.
   *
   * CLAUDE.md section 6 records the trap: this page answers 200 while saying
   * the link does not open an order, and the reference appears in the page text
   * even on the failure page. So a check asking for 200, or asking whether the
   * page names the order, passes on a dead link. The failure SENTENCE is what
   * has to be read.
   */
  try {
    await page.goto(`${base}/order/status?token=overnight-not-a-real-token`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(400);
    const text = await page.evaluate(() => document.body.innerText);
    const refuses = /does not open|no longer|expired|could not|not valid|cannot find/i.test(text);
    rec(
      "a dead order token is refused in words, not by a 200",
      refuses,
      refuses ? text.split("\n").filter(Boolean)[0]?.slice(0, 90) : text.slice(0, 120),
    );
  } catch (err) {
    rec("a dead order token is refused in words", false, String(err.message).split("\n")[0]);
  }

  /*
   * THE UNSUBSCRIBE ROUTE FAILS CLOSED.
   *
   * A bad or missing token must NOT suppress anything, and must not say it did.
   * The dangerous shape is a route that treats an unrecognised token as "job
   * done" and shows a confirmation, because the person who clicked then
   * believes they are unsubscribed.
   */
  try {
    const r = await page.request.get(`${base}/unsubscribe?token=overnight-not-a-real-token`, {
      maxRedirects: 5,
      timeout: 30000,
    });
    const body = await r.text();
    const claimsSuccess = /you (have been|are) unsubscribed|removed from|will no longer receive/i.test(body);
    rec(
      "the unsubscribe route fails closed on a bad token",
      !claimsSuccess,
      claimsSuccess
        ? "IT CLAIMS SUCCESS on a token that means nothing, so somebody who clicked believes they are unsubscribed"
        : `HTTP ${r.status()} and no confirmation sentence`,
    );
  } catch (err) {
    rec("the unsubscribe route fails closed on a bad token", false, String(err.message).split("\n")[0]);
  }

  /*
   * A FORM REFUSES WHAT IT SHOULD, WITHOUT SENDING.
   *
   * Submitted EMPTY, which writes nothing by definition: the refusal is the
   * whole point. The accept path is deliberately not exercised, because on
   * production it would put a real lead into the firm's intake.
   */
  try {
    await page.goto(`${base}/contact`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(600);
    const submit = page.locator('form button[type="submit"], form input[type="submit"]').first();
    if (await submit.count()) {
      await submit.click({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(900);
      const after = await page.evaluate(() => ({
        text: document.body.innerText,
        invalid: document.querySelectorAll("[aria-invalid='true'], :invalid").length,
      }));
      const falseSuccess = /thank you|we have your|received your|message sent/i.test(after.text);
      rec(
        "the contact form refuses an empty submission and claims nothing",
        !falseSuccess,
        falseSuccess ? "IT SHOWED A SUCCESS MESSAGE FOR AN EMPTY FORM" : `${after.invalid} field(s) marked invalid`,
      );
    } else {
      rec("the contact form refuses an empty submission and claims nothing", false, "no submit control found");
    }
  } catch (err) {
    rec("the contact form refuses an empty submission and claims nothing", false, String(err.message).split("\n")[0]);
  }

  await ctx.close();
}

await browser.close();

console.log("");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
console.log("");
console.log(`--- ${findings.length} difference(s) between the deployment and what main says it should be:`);
for (const f of findings) console.log(`  ${f}`);
console.log("");

const failed = out.filter((r) => !r.ok);
console.log(
  failed.length || findings.length
    ? `ROUND 2: ${failed.length} check(s) failed and ${findings.length} finding(s) recorded.`
    : `ROUND 2: ${out.length} checks, no differences.`,
);
process.exitCode = failed.length || findings.length ? 1 : 0;
