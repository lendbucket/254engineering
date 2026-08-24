/**
 * Contrast for text that sits on a photograph.
 *
 *   BASE_URL=http://localhost:3225 node scripts/image-contrast-audit.mjs
 *
 * WHY THIS EXISTS SEPARATELY FROM contrast-audit.mjs
 * --------------------------------------------------
 * axe-core computes contrast from COMPUTED STYLE. It walks up the tree looking
 * for a background colour and compares the text against it. When the real
 * background is a photograph, there is no background colour to find: axe either
 * reports the element as "incomplete" and moves on, or compares against whatever
 * solid colour is furthest up the tree and returns a number that has nothing to
 * do with what a person sees.
 *
 * So the design brief's requirement, verify every text over image pairing, is
 * not something the existing audit can do, and a green contrast-audit over a
 * hero with a photograph in it is a false green. This measures the actual
 * rendered pixels instead.
 *
 * HOW IT WORKS
 * ------------
 * For each declared target: read the element's box and its computed colour, then
 * make the text itself transparent and screenshot the page. Sampling the
 * resulting image inside the box gives the true background under the glyphs,
 * photograph, scrim, gradients and all. The check then compares the text colour
 * against the WORST pixel in that box rather than the average, because a
 * headline is only as legible as its least legible letter.
 *
 * Only the extremes matter, so the sample is decimated: every third pixel in
 * both directions is plenty at this resolution and it keeps the run fast.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const BASE = process.env.BASE_URL || "http://localhost:3225";
const WIDTHS = [390, 1280];

/**
 * What to check.
 *
 * Declared rather than discovered. A generic crawl cannot tell whether an
 * element's background is the photograph or an opaque panel sitting over it, and
 * a check that guesses wrong in the safe direction is the false green this file
 * exists to prevent. Every entry here is a place where type is knowingly over an
 * image.
 */
const TARGETS = [
  {
    page: "/",
    name: "home hero",
    selectors: [
      { label: "h1", css: "h1" },
      { label: "eyebrow", css: "section:first-of-type p.uppercase" },
      { label: "lede", css: "section:first-of-type p.max-w-xl" },
      { label: "figures", css: "section:first-of-type dd span:first-child" },
      { label: "figure labels", css: "section:first-of-type dd span:last-child" },
    ],
  },
];

const srgb = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const luminance = (r, g, b) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const contrast = (l1, l2) => {
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};

function parseColor(css) {
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b] = m[1].split(",").map((n) => parseFloat(n));
  return { r, g, b };
}

const findings = [];
const checks = [];

async function run() {
  const browser = await chromium.launch();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "imgcontrast-"));

  for (const target of TARGETS) {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width, height: 1000 },
        deviceScaleFactor: 1,
      });
      const page = await ctx.newPage();
      await page.goto(BASE + target.page, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      // Boxes and colours, before anything is hidden.
      const boxes = [];
      for (const sel of target.selectors) {
        const handles = await page.locator(sel.css).all();
        for (const [i, h] of handles.entries()) {
          if (!(await h.isVisible())) continue;
          const box = await h.boundingBox();
          if (!box || box.width < 2 || box.height < 2) continue;
          const color = parseColor(await h.evaluate((el) => getComputedStyle(el).color));
          if (!color) continue;
          boxes.push({ label: handles.length > 1 ? `${sel.label} #${i + 1}` : sel.label, box, color });
        }
      }

      if (boxes.length === 0) {
        findings.push(
          `${target.name} @${width}: no elements matched. The selectors are stale and this check measured nothing.`,
        );
        await ctx.close();
        continue;
      }

      // Make text transparent so the screenshot shows only what is behind it.
      await page.addStyleTag({
        content: `h1, h2, h3, p, span, a, dd, dt, li { color: transparent !important; text-shadow: none !important; }`,
      });
      await page.waitForTimeout(200);

      const shot = path.join(tmp, `${width}.png`);
      await page.screenshot({ path: shot });

      const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
      const channels = info.channels;

      for (const { label, box, color } of boxes) {
        const textLum = luminance(color.r, color.g, color.b);
        let worst = Infinity;
        let worstPixel = null;

        const x0 = Math.max(0, Math.floor(box.x));
        const y0 = Math.max(0, Math.floor(box.y));
        const x1 = Math.min(info.width, Math.ceil(box.x + box.width));
        const y1 = Math.min(info.height, Math.ceil(box.y + box.height));

        for (let y = y0; y < y1; y += 3) {
          for (let x = x0; x < x1; x += 3) {
            const i = (y * info.width + x) * channels;
            const l = luminance(data[i], data[i + 1], data[i + 2]);
            const c = contrast(textLum, l);
            if (c < worst) {
              worst = c;
              worstPixel = [data[i], data[i + 1], data[i + 2]];
            }
          }
        }

        if (!Number.isFinite(worst)) continue;

        // 4.5:1 is the AA floor for normal text. Large text is allowed 3:1, and
        // the h1 and the figures qualify, but they are held to 4.5 here anyway:
        // this is the one place on the site where the background can change
        // under the type without anybody editing the type.
        const ok = worst >= 4.5;
        checks.push({
          name: `${target.name} @${width}: ${label}`,
          ok,
          detail: `worst ${worst.toFixed(2)}:1 against rgb(${worstPixel?.join(", ")})`,
        });
        if (!ok) {
          findings.push(
            `${target.name} @${width}: ${label} measures ${worst.toFixed(2)}:1 at its worst pixel, under the 4.5 floor. Background there is rgb(${worstPixel?.join(", ")}).`,
          );
        }
      }

      await ctx.close();
    }
  }

  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

await run();

console.log("=== TEXT OVER IMAGE CONTRAST ===");
console.log(`${BASE}, sampling rendered pixels rather than computed style\n`);
for (const c of checks) {
  console.log(`  ${c.ok ? "PASS" : "FAIL"}: ${c.name} (${c.detail})`);
}
console.log("");
if (findings.length === 0) {
  console.log(`PASS: ${checks.length} text over image pairing(s) clear 4.5:1 at their worst pixel.`);
  process.exitCode = 0;
} else {
  for (const f of findings) console.log(`  - ${f}`);
  console.log(`\nFAIL: ${findings.length} finding(s).`);
  process.exitCode = 1;
}
