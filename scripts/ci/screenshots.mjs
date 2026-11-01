/**
 * BEFORE AND AFTER SCREENSHOTS, TAKEN IN THE BOARD. Robert's ruling on item l,
 * 2026-11-01: "Take the before and after screenshots in the board on GitHub
 * Actions instead of locally: Playwright ... for /, /coverage and
 * /services/windstorm-wpi-8 at 390 px and 1440 px, uploaded as board artifacts."
 *
 *   node scripts/ci/screenshots.mjs <out dir> <label>=<base url> [<label>=<base url> ...]
 *
 * Each target is photographed full page at both widths, after the network is
 * idle and every font and image on the page has finished, with animations and
 * transitions stopped so two runs of the same page compare. A target that cannot
 * be photographed is written into manifest.json with the reason, and the script
 * still exits 0: a screenshot is evidence for a person to look at, never a
 * verdict, and a failure here must not turn a board red (prior-green.mjs reads a
 * run's conclusion). A redirect off the target's own host is recorded as a
 * failure rather than photographed, so a sign in page can never pass for the
 * site (Vercel previews sit behind Vercel Authentication, which answers 302).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const ROUTES = ["/", "/coverage", "/services/windstorm-wpi-8"];
const WIDTHS = [390, 1440];

const [outDir, ...specs] = process.argv.slice(2);
if (!outDir || specs.length === 0) {
  console.log("usage: node scripts/ci/screenshots.mjs <out dir> <label>=<base url> ...");
  process.exit(0);
}
mkdirSync(outDir, { recursive: true });

const targets = specs.map((s) => {
  const at = s.indexOf("=");
  return { label: s.slice(0, at), base: s.slice(at + 1).replace(/\/$/, "") };
});

const slug = (route) => (route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "_"));
const manifest = { takenAt: new Date().toISOString(), shots: [] };

const browser = await chromium.launch();
for (const { label, base } of targets) {
  const host = new URL(base).host;
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await context.newPage();
    for (const route of ROUTES) {
      const file = `${label}-${slug(route)}-${width}.png`;
      const entry = { label, url: base + route, width, file: null, status: null, note: "" };
      try {
        const res = await page.goto(base + route, { waitUntil: "networkidle", timeout: 60000 });
        entry.status = res?.status() ?? null;
        const landed = new URL(page.url()).host;
        if (landed !== host) {
          entry.note = `redirected off ${host} to ${landed}; not photographed`;
        } else if (entry.status !== 200) {
          entry.note = `answered ${entry.status}; not photographed`;
        } else {
          await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
          /* Lazy images below the fold load only when scrolled to, so walk the page first. */
          await page.evaluate(async () => {
            for (let y = 0; y < document.body.scrollHeight; y += 600) {
              window.scrollTo(0, y);
              await new Promise((r) => setTimeout(r, 60));
            }
            window.scrollTo(0, 0);
          });
          await page.evaluate(async () => {
            await document.fonts.ready;
            await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
          });
          entry.fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family} ${f.style} ${f.weight}`));
          await page.screenshot({ path: join(outDir, file), fullPage: true });
          entry.file = file;
        }
      } catch (e) {
        entry.note = `could not photograph: ${String(e?.message ?? e).split("\n")[0]}`;
      }
      manifest.shots.push(entry);
      console.log(`${entry.file ? "SHOT" : "NOT TAKEN"}: ${label} ${route} @${width}${entry.note ? ` (${entry.note})` : ""}`);
    }
    await context.close();
  }
}
await browser.close();
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
const taken = manifest.shots.filter((s) => s.file).length;
console.log(`${taken} of ${manifest.shots.length} screenshots taken.`);
