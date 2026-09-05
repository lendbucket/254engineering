/**
 * IS THE BRAND MARK ACTUALLY VISIBLE ON THE THING BEHIND IT.
 *
 *   node scripts/asset-audit.mjs
 *
 * WHY THIS EXISTS
 * ---------------
 * The set password screen rendered the REVERSE lockup, which is white artwork,
 * on the light canvas. Ninety two percent of the mark sat at 1.10:1 and the
 * whole mark averaged 1.02:1. The first thing a new Professional Engineer ever
 * saw was a blank space with a gold slash floating in it.
 *
 * It was one word. `<Wordmark onDark />` on a surface that is not dark, twelve
 * characters from the sign in screen which is correct. Nothing caught it for
 * the length of a phase, and nothing WOULD have:
 *
 *   - token-audit reads files. Both screens use the tokens correctly.
 *   - contrast-audit visits no portal route, and would not have helped if it
 *     did: axe measures TEXT against its background. A logo is an <img>, and no
 *     rule anywhere measures the pixels inside an image against what is behind
 *     it.
 *   - mobile-overflow-audit visits the route and measures horizontal scroll.
 *
 * This is the third appearance of one defect class in this repository: the
 * right value in the wrong place, rendering as almost correct. The undeclared
 * --gold-wash token, which four screens asked for and no file defined, was the
 * second. Patching the screen would leave the class alive, so this measures the
 * PROPERTY rather than checking for the string "onDark".
 *
 * HOW IT MEASURES
 * ---------------
 * For every brand lockup on every surface, in a real browser:
 *
 *   1. Resolve which asset file is actually being served. Next rewrites the src
 *      through /_next/image, so the underlying file is read back out of the url
 *      parameter rather than assumed from the component.
 *   2. Ask the DOM what is behind it, by walking ancestors until something has a
 *      non transparent background, which is what the eye does.
 *   3. Decode the asset and take the mean of every pixel at alpha >= 200, which
 *      is the ink of the mark with its soft edges excluded.
 *   4. Composite that ink over the background the way a browser composites it,
 *      and take the WCAG contrast ratio.
 *
 * A mark below 4.5:1 against its own ground fails. That is the AA text
 * threshold, used deliberately: the lockup carries the firm's name, a reader
 * has to be able to read it, and a logo nobody can see is not decoration.
 *
 * It measures the ARTWORK rather than a screenshot on purpose. A screenshot
 * would have to guess which pixels are ink and which are ground, and on this
 * exact defect the guess fails: white ink on #f4f5f7 differs from the ground by
 * so little that a delta threshold would discard the invisible pixels and
 * measure only the gold, reporting the wrong number for the right reason.
 */

import { readFileSync, existsSync } from "node:fs";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3225";

/**
 * Surfaces to look at. Public pages plus every screen a person meets before
 * they hold a session, which is where the defect was.
 *
 * The signed in portal is not walked here. Its chrome renders one lockup from
 * one component on one surface, and mobile-overflow-audit already holds the
 * session machinery; duplicating a probe account for a check about artwork
 * would put a second account creation into the suite for no coverage.
 */
const SURFACES = [
  "/",
  "/about",
  "/contact",
  "/waitlist",
  "/careers",
  "/portal/login",
  "/portal/login?suspended=1",
  "/portal/login?reset=1",
  "/portal/set-password",
  "/portal/set-password?token=not-a-real-token",
];

/** The AA text threshold, and the reasoning is in the header. */
const MIN_RATIO = 4.5;

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

const toLinear = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const luminance = ([r, g, b]) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
const contrast = (a, b) => {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};

/** rgb(a) as the browser reports it, to a triple. Alpha is composited later. */
function parseColour(css) {
  const m = String(css).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  return { rgb: parts.slice(0, 3), alpha: parts.length > 3 ? parts[3] : 1 };
}

/**
 * The mean ink of an asset, cached because the same lockup appears on every
 * page and decoding a 2262 by 1147 png ten times would be the slowest part of
 * the suite for no additional information.
 */
const inkCache = new Map();
function meanInk(file) {
  if (inkCache.has(file)) return inkCache.get(file);
  if (!existsSync(file)) {
    inkCache.set(file, null);
    return null;
  }
  const png = PNG.sync.read(readFileSync(file));
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    /*
     * alpha >= 200 only. The soft edge of an antialiased mark is a blend of
     * the ink and whatever it was composited against when the artwork was
     * made, and including it drags the mean toward the middle grey that makes
     * every asset look acceptable.
     */
    if (png.data[i + 3] < 200) continue;
    r += png.data[i];
    g += png.data[i + 1];
    b += png.data[i + 2];
    n += 1;
  }
  const ink = n === 0 ? null : { rgb: [r / n, g / n, b / n], pixels: n };
  inkCache.set(file, ink);
  return ink;
}

/** /_next/image?url=%2Fbrand%2Flogo-dark.png&w=256 -> public/brand/logo-dark.png */
function fileFor(src) {
  if (!src) return null;
  let path = src;
  const m = src.match(/[?&]url=([^&]+)/);
  if (m) path = decodeURIComponent(m[1]);
  path = path.split("?")[0];
  if (!path.startsWith("/")) return null;
  return "public" + path;
}

console.log("");
console.log("================ BRAND MARK ON ITS GROUND ================");
console.log(`${BASE}, ${SURFACES.length} surfaces, minimum ${MIN_RATIO}:1\n`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

let marksSeen = 0;

for (const route of SURFACES) {
  const page = await ctx.newPage();
  let status = 0;
  try {
    const res = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 45000 });
    status = res?.status() ?? 0;
    await page.waitForTimeout(400);
  } catch (err) {
    rec(`${route} loads`, false, String(err.message).split("\n")[0]);
    await page.close();
    continue;
  }

  if (status !== 200) {
    rec(`${route} loads`, false, `HTTP ${status}`);
    await page.close();
    continue;
  }

  /*
   * Every brand lockup on the page, with the ground the DOM resolves for each.
   * The walk up the ancestors stops at the first non transparent background,
   * which is what decides what the eye sees behind a transparent png.
   */
  const marks = await page.evaluate(() => {
    const found = [];
    for (const img of document.querySelectorAll("img")) {
      const src = img.getAttribute("src") ?? "";
      if (!/brand|logo|wordmark/i.test(src)) continue;

      let node = img.parentElement;
      let ground = "rgb(255, 255, 255)";
      while (node) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg && bg !== "transparent" && !/rgba\(0, 0, 0, 0\)/.test(bg)) {
          ground = bg;
          break;
        }
        node = node.parentElement;
      }

      const r = img.getBoundingClientRect();
      found.push({
        src,
        ground,
        width: Math.round(r.width),
        height: Math.round(r.height),
        alt: img.getAttribute("alt") ?? "",
      });
    }
    return found;
  });

  if (marks.length === 0) {
    /*
     * Not a failure. Not every surface carries the lockup, and inventing one
     * would be this audit deciding the design.
     */
    console.log(`  ${route.padEnd(42)} no brand mark`);
    await page.close();
    continue;
  }

  for (const mark of marks) {
    marksSeen += 1;
    const file = fileFor(mark.src);
    const ink = file ? meanInk(file) : null;
    const groundColour = parseColour(mark.ground);

    if (!ink || !groundColour) {
      rec(
        `${route}: the mark's artwork and ground could be read`,
        false,
        `src ${mark.src} -> ${file ?? "unresolved"}, ground ${mark.ground}`,
      );
      continue;
    }

    /*
     * The ground itself may be translucent. Composite it over white first,
     * which is what the page ultimately sits on, rather than pretending an
     * alpha of 0.6 is opaque.
     */
    const groundRgb = groundColour.rgb.map((c) => c * groundColour.alpha + 255 * (1 - groundColour.alpha));
    const ratio = contrast(ink.rgb, groundRgb);
    const ok = ratio >= MIN_RATIO;

    const asset = (file ?? "").replace(/^public/, "");
    console.log(
      `  ${route.padEnd(42)} ${asset.padEnd(24)} ${mark.width}x${mark.height}  ` +
        `ink rgb(${ink.rgb.map((v) => Math.round(v)).join(",")}) on rgb(${groundRgb.map((v) => Math.round(v)).join(",")})  ` +
        `${ratio.toFixed(2)}:1 ${ok ? "" : "  <-- BELOW " + MIN_RATIO}`,
    );

    rec(
      `${route}: the brand mark is legible on its ground`,
      ok,
      `${asset} at ${ratio.toFixed(2)}:1 against rgb(${groundRgb.map((v) => Math.round(v)).join(",")})` +
        (ok ? "" : ". The reverse lockup is white artwork and belongs on a dark surface."),
    );
  }

  await page.close();
}

await ctx.close();
await browser.close();

/*
 * A run that found no marks at all is a run that measured nothing, and would
 * otherwise print a green line saying so.
 */
rec(
  "brand marks were actually found and measured",
  marksSeen > 0,
  `${marksSeen} mark(s) across ${SURFACES.length} surfaces`,
);

console.log("");
const failed = out.filter((c) => !c.ok);
for (const c of failed) console.log(`  FAIL: ${c.name} (${c.note})`);
if (failed.length === 0) {
  for (const c of out) console.log(`  PASS: ${c.name}${c.note ? ` (${c.note})` : ""}`);
}
console.log("");
console.log(
  failed.length
    ? `FAIL: ${failed.length} of ${out.length} checks.`
    : `PASS: ${out.length} checks. Every brand mark is legible on the surface it sits on.`,
);
process.exit(failed.length ? 1 : 0);
