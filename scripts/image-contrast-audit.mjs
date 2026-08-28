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
 * A GRADIENT IS THE SAME PROBLEM AS A PHOTOGRAPH
 * ----------------------------------------------
 * The approved v5 design has no photography on the homepage. It has four bands
 * with gradient backgrounds, and axe cannot resolve a gradient either. The first
 * render of the rebuilt hero put the h1 in navy on a navy gradient, because
 * globals.css sets a colour on h1 through h4 at the base layer and a declaration
 * on the element beats the colour inherited from the section. It was invisible,
 * and contrast-audit passed.
 *
 * That is why every dark band on this page is a target below.
 *
 * HOW IT WORKS
 * ------------
 * For each declared target: read the rectangles the TEXT actually occupies and
 * its computed colour, then make the text transparent and screenshot the page.
 * Sampling inside those rectangles gives the true background under the glyphs,
 * photograph, scrim, gradients and all. The check compares the text colour
 * against the WORST pixel found, because a headline is only as legible as its
 * least legible letter.
 *
 * Only the extremes matter, so the sample is decimated: every third pixel in
 * both directions is plenty at this resolution and it keeps the run fast.
 *
 * WHY TEXT RECTANGLES AND NOT THE ELEMENT BOX
 * -------------------------------------------
 * The first version used getBoundingClientRect(). A block level element's box is
 * as wide as its column whatever the text inside it does, so an eyebrow reading
 * "Veteran owned. Statewide." reported a box 896 pixels wide for about 250
 * pixels of glyphs. The check was then sampling 650 pixels of open sky to the
 * right of the last letter and failing the element on a pixel no reader will
 * ever see type on.
 *
 * That produced a false FAIL on the bold hero that survived two rounds of
 * tuning the scrim, because no amount of scrim behind the TEXT could change a
 * verdict being decided somewhere else entirely.
 *
 * A Range over the element's text nodes returns getClientRects(), which is one
 * tight rectangle per rendered line. That is where the glyphs are, so that is
 * what gets measured.
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
    name: "hero gradient",
    selectors: [
      { label: "h1", css: "section#top h1" },
      { label: "status pill", css: "section#top span.uppercase" },
      { label: "lede", css: "section#top p.max-w-\\[56ch\\]" },
      { label: "stat figure", css: "section#top dd span:first-child" },
      { label: "stat label", css: "section#top dd span:last-child" },
    ],
  },
  {
    page: "/",
    name: "how it works gradient",
    selectors: [
      { label: "h2", css: "section#process h2" },
      { label: "lede", css: "section#process h2 + p" },
    ],
  },
  {
    page: "/",
    name: "windstorm gradient",
    selectors: [
      { label: "h2", css: "section#windstorm h2" },
      { label: "body", css: "section#windstorm p.max-w-\\[58ch\\]" },
    ],
  },
  {
    page: "/",
    name: "careers band",
    selectors: [
      { label: "h2", css: "section#careers h2" },
      { label: "lede", css: "section#careers h2 + p" },
    ],
  },
  {
    page: "/",
    name: "navy capability card",
    selectors: [{ label: "h3", css: "section#government h3" }],
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

      // Text rectangles and colours, before anything is hidden.
      const boxes = [];
      for (const sel of target.selectors) {
        const handles = await page.locator(sel.css).all();
        /*
         * Per selector, not just per target.
         *
         * The target level check below only fires when NOTHING on a band
         * matches, so a single stale selector went unreported: SectionHead
         * started rendering its lede in a div, `h2 + p` matched nothing, and the
         * how it works lede simply stopped being measured. The run still said
         * PASS, and the only visible trace was the pairing count dropping from
         * 32 to 30.
         *
         * A count that quietly shrinks is the same failure as a check that
         * quietly skips.
         */
        if (handles.length === 0) {
          const message = `${target.name} @${width}: selector ${sel.css} matched nothing, so ${sel.label} was not measured.`;
          checks.push({ name: `${target.name} @${width}: ${sel.label}`, ok: false, detail: "selector matched nothing" });
          findings.push(message);
          continue;
        }
        for (const [i, h] of handles.entries()) {
          if (!(await h.isVisible())) continue;

          // One tight rectangle per rendered line of text. See the note above on
          // why the element box is the wrong thing to measure.
          const rects = await h.evaluate((el) => {
            const out = [];
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
              if (!node.nodeValue || !node.nodeValue.trim()) continue;
              const range = document.createRange();
              range.selectNodeContents(node);
              for (const r of range.getClientRects()) {
                if (r.width >= 2 && r.height >= 2) {
                  // Page coordinates. getClientRects is relative to the viewport
                  // and the screenshot below is the full page, so anything below
                  // the fold would otherwise be sampled at the wrong offset or,
                  // worse, outside the image entirely.
                  out.push({
                    x: r.x + window.scrollX,
                    y: r.y + window.scrollY,
                    width: r.width,
                    height: r.height,
                  });
                }
              }
            }
            return out;
          });
          if (rects.length === 0) continue;

          const color = parseColor(await h.evaluate((el) => getComputedStyle(el).color));
          if (!color) continue;
          boxes.push({
            label: handles.length > 1 ? `${sel.label} #${i + 1}` : sel.label,
            rects,
            color,
          });
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
        /*
         * Every element, not a list of tag names.
         *
         * This rule used to name h1, h2, h3, p, span, a, dd, dt, li. PageHeader
         * renders its lede into a div, so the lede text stayed opaque and the
         * check sampled the glyphs themselves: it reported 1.00:1 against a
         * background that was the text colour. That is a false FAIL here and it
         * would be a false PASS anywhere the text happened to be lighter than
         * what is behind it, which is the more dangerous direction.
         *
         * Only `color` is touched, so button fills, borders, and photographs
         * are untouched and the sampled background is the real one.
         */
        content: `* { color: transparent !important; text-shadow: none !important; }`,
      });
      await page.waitForTimeout(200);

      const shot = path.join(tmp, `${width}.png`);
      // fullPage, because targets below the fold are the norm on a long page.
      await page.screenshot({ path: shot, fullPage: true });

      const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
      const channels = info.channels;

      for (const { label, rects, color } of boxes) {
        const textLum = luminance(color.r, color.g, color.b);
        let worst = Infinity;
        let worstPixel = null;

        for (const box of rects) {
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
        }

        /*
         * A target that sampled no pixels is a finding, never a skip.
         *
         * This was `continue`, and it hid four of the five bands on the rebuilt
         * homepage: they sit below the fold, the screenshot was viewport only, so
         * every sample coordinate fell outside the image and the loop ran zero
         * times. The audit reported a confident pass over the one band it could
         * see and said nothing about the rest.
         *
         * That is the exact failure this file exists to prevent, committed by
         * this file.
         */
        if (!Number.isFinite(worst)) {
          const message = `${target.name} @${width}: ${label} sampled no pixels, so nothing was measured. The element box is outside the captured image.`;
          checks.push({ name: `${target.name} @${width}: ${label}`, ok: false, detail: "sampled no pixels" });
          findings.push(message);
          continue;
        }

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
