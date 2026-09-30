/**
 * MEASURE THE HEADER MARK AND THE HEADING COLOUR, FROM THE BROWSER.
 *
 * Operator order, 2026-09-30: "Read the rendered width of the header mark from
 * the browser and report it in pixels... Also report the computed color of the
 * Sign in heading."
 *
 * WHY THIS EXISTS RATHER THAN ANOTHER SCREENSHOT. A capture is read by eye, and
 * an eye cannot tell 78 pixels from 84, or #333A45 from #161B22. Both of those
 * differences are exactly the size of the question being asked, so the browser
 * is asked for the number instead.
 *
 * IT BUILDS NOTHING AND ASSUMES A FRESH BUILD. dev-server.mjs runs `next start`
 * and never builds, which is how two captures on 2026-09-29 were taken of a
 * stale artifact and nearly reported as verification of a fix. The BUILD_ID is
 * printed so the reader can tell which artifact was measured.
 */
process.loadEnvFile?.(".env.local");

import { readFileSync } from "node:fs";
import { chromium } from "playwright";

import { startNextServer } from "./lib/dev-server.mjs";
import { takeLock } from "./lib/machine-lock.mjs";

const WIDTHS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "390", width: 390, height: 844 },
];

/** v5's header mark rule, evaluated here so the expectation is arithmetic. */
const specHeight = (viewportWidth) => Math.min(84, Math.max(58, viewportWidth * 0.09));

const buildId = (() => {
  try {
    return readFileSync(".next/BUILD_ID", "utf8").trim();
  } catch {
    return "unknown";
  }
})();

const release = await takeLock({
  project: "254engineering",
  label: "wordmark measurement",
  onWait: (h) => console.log("  waiting on " + h.project + " pid " + h.pid),
});

let server = null;
try {
  server = await startNextServer({ port: 3231 });
  console.log(`BUILD_ID ${buildId}`);
  console.log("");

  const browser = await chromium.launch();

  for (const w of WIDTHS) {
    const context = await browser.newContext({ viewport: { width: w.width, height: w.height } });
    const page = await context.newPage();
    await page.goto(server.base + "/account/login", { waitUntil: "networkidle", timeout: 45_000 });

    const measured = await page.evaluate(() => {
      const header = document.querySelector("header");
      const img = header ? header.querySelector("img") : null;
      const h1 = document.querySelector("h1");
      const box = img ? img.getBoundingClientRect() : null;
      return {
        found: Boolean(img),
        width: box ? Math.round(box.width * 100) / 100 : null,
        height: box ? Math.round(box.height * 100) / 100 : null,
        naturalWidth: img ? img.naturalWidth : null,
        naturalHeight: img ? img.naturalHeight : null,
        headingText: h1 ? h1.textContent.trim().slice(0, 40) : null,
        headingColor: h1 ? getComputedStyle(h1).color : null,
        headingSize: h1 ? getComputedStyle(h1).fontSize : null,
      };
    });

    const spec = specHeight(w.width);
    console.log(`=== ${w.name} wide ===`);
    if (!measured.found) {
      console.log("  COULD NOT TELL: no <img> inside <header>. Nothing was measured.");
    } else {
      console.log(`  header mark rendered   ${measured.width} x ${measured.height} px`);
      console.log(`  its natural size       ${measured.naturalWidth} x ${measured.naturalHeight}`);
      console.log(`  v5 spec HEIGHT here    ${Math.round(spec * 100) / 100} px  (clamp(58px, 9vw, 84px))`);
      console.log(
        `  height vs spec         ${measured.height === spec ? "MATCHES" : `DOES NOT MATCH, off by ${Math.round((measured.height - spec) * 100) / 100}`}`,
      );
      /*
       * The width implied by the spec, stated because the operator asked for a
       * WIDTH and the spec as recorded in the Wordmark component is a HEIGHT.
       * The asset has a fixed aspect, so one determines the other; printing
       * both removes the guess about which he meant.
       */
      const impliedWidth =
        measured.naturalWidth && measured.naturalHeight
          ? Math.round(((measured.naturalWidth / measured.naturalHeight) * spec) * 100) / 100
          : null;
      console.log(`  width the spec implies ${impliedWidth} px`);
    }
    console.log(`  h1 "${measured.headingText}"`);
    console.log(`  its computed color     ${measured.headingColor}   size ${measured.headingSize}`);
    console.log("");

    await context.close();
  }

  await browser.close();
} finally {
  if (server) await server.stop();
  release();
  console.log("server stopped, lock released");
}
