/**
 * Zero horizontal document scroll, on every route, at phone widths.
 *
 *   BASE_URL=http://localhost:3225 node scripts/mobile-overflow-audit.mjs
 *
 * WHY THIS IS SEPARATE FROM mobile-audit
 * --------------------------------------
 * mobile-audit already asserts `documentElement.scrollWidth === clientWidth`,
 * but only over a hand written list of twenty template representatives. That is
 * the right shape for the checks it also runs, which are slow: tap target
 * geometry on every interactive element, and the menu behaviour.
 *
 * Horizontal overflow is not a template property. It is a content property. One
 * long county name, one unbroken email address, one wide table in one insights
 * post, and a route breaks while every other route on the same template stays
 * clean. So this walks EVERY url in the sitemap, which is the only list that
 * grows by itself when a page is added.
 *
 * MEASURED TWICE, BEFORE AND AFTER SCROLLING
 * ------------------------------------------
 * Overflow frequently does not exist at first paint. Lazy images have no
 * intrinsic width until they load, and anything mounted below the fold has not
 * laid out yet, so a check that measures the top of the page and moves on is
 * measuring the least likely moment for the failure to be present. This walks
 * the page to the bottom first and takes the worst number seen.
 *
 * MEASURED AGAINST clientWidth, NEVER AGAINST innerWidth
 * ------------------------------------------------------
 * The first version of this file compared scrollWidth to window.innerWidth, and
 * it could not fail. Under mobile emulation, and on a real phone, the LAYOUT
 * viewport expands to contain overflowing content: inject a 900px element into a
 * 390px viewport and innerWidth becomes 900 as well. The two numbers move
 * together, so the comparison was always false.
 *
 * That was caught by injecting the 900px element and watching the audit stay
 * green, which is the only reason this file is correct now.
 *
 * documentElement.clientWidth stays pinned at the layout viewport width, 390,
 * whatever the content does. That is the reference. The configured width is
 * asserted against it too, so an emulation change that moved clientWidth could
 * not quietly turn this check off.
 *
 * WHAT COUNTS AS A FAILURE
 * ------------------------
 * `documentElement.scrollWidth` or `body.scrollWidth` exceeding
 * `documentElement.clientWidth` by more than one pixel. One pixel of slack is
 * deliberate:
 * sub pixel layout rounding at some widths produces a scrollWidth one greater
 * than innerWidth with nothing actually scrollable, and failing the build on
 * that would train everyone to ignore this audit.
 *
 * On failure it names the widest offending elements rather than only the number,
 * because "some route is 12 pixels too wide" is not a finding anybody can act
 * on.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3225";
const WIDTHS = [360, 390];
const SLACK = 1;

async function routes() {
  const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const found = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => m[1].replace(/^https?:\/\/[^/]+/, "") || "/",
  );
  // The homepage and the waitlist are reachable and indexable; whether they are
  // in the sitemap is a separate question from whether they overflow.
  for (const extra of ["/", "/waitlist"]) if (!found.includes(extra)) found.push(extra);
  return found;
}

const findings = [];
const checks = [];

async function run() {
  const list = await routes();
  const browser = await chromium.launch();

  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: 800 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });

    for (const route of list) {
      const page = await ctx.newPage();
      const res = await page.goto(BASE + route, { waitUntil: "networkidle" });
      if (!res || res.status() !== 200) {
        findings.push(`${route} @${width}: HTTP ${res ? res.status() : "no response"}`);
        checks.push({ name: `${route} @${width}`, ok: false, detail: "not 200" });
        await page.close();
        continue;
      }

      const measure = () =>
        page.evaluate(() => ({
          doc: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
          // The reference. See the note above on why innerWidth is not usable.
          inner: document.documentElement.clientWidth,
          reportedInner: window.innerWidth,
        }));

      const top = await measure();
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 80));
        }
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise((r) => setTimeout(r, 200));
      });
      const bottom = await measure();

      const worst = Math.max(top.doc, top.body, bottom.doc, bottom.body);
      const over = worst - top.inner;
      const ok = over <= SLACK;

      // The reference itself must be the width that was asked for. If emulation
      // ever starts expanding clientWidth too, this check turns into the same
      // tautology it used to be, and this line is what would say so.
      if (top.inner !== width) {
        findings.push(
          `${route} @${width}: documentElement.clientWidth is ${top.inner}, not ${width}. The reference width moved, so this measurement cannot be trusted.`,
        );
      }

      let detail = `${worst} vs ${top.inner}`;
      if (!ok) {
        const culprits = await page.evaluate((inner) => {
          const out = [];
          for (const el of document.querySelectorAll("*")) {
            const r = el.getBoundingClientRect();
            const right = r.right + window.scrollX;
            if (right > inner + 1 && r.width > 0) {
              out.push(
                `<${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}> reaches ${Math.round(right)}px` +
                  ` class="${(el.getAttribute("class") || "").slice(0, 60)}"`,
              );
            }
          }
          return out.slice(0, 4);
        }, top.inner);
        detail = `${worst} vs ${top.inner} (+${over})`;
        findings.push(
          `${route} @${width}: document is ${over}px wider than the viewport. ${culprits.join(" | ") || "no element identified"}`,
        );
      }

      checks.push({ name: `${route} @${width}`, ok, detail });
      await page.close();
    }

    await ctx.close();
  }

  await browser.close();
}

await run();

console.log("================ MOBILE HORIZONTAL OVERFLOW ================");
console.log(`${BASE}, every sitemap route at ${WIDTHS.join(" and ")}\n`);
const failed = checks.filter((c) => !c.ok);
for (const c of failed) console.log(`  FAIL: ${c.name} (${c.detail})`);
console.log("");
if (findings.length === 0) {
  console.log(`PASS: ${checks.length} route and width combinations, zero horizontal document scroll.`);
  process.exitCode = 0;
} else {
  for (const f of findings) console.log(`  - ${f}`);
  console.log(`\nFAIL: ${findings.length} finding(s) across ${checks.length} checks.`);
  process.exitCode = 1;
}
