// Rasterize the placeholder wordmark into every bitmap the site needs.
//
//   npm run brand-rasters
//
// Produces:
//   src/app/icon.png          512  App Router icon convention
//   src/app/apple-icon.png    180  App Router apple-icon convention
//   src/app/favicon.ico       16/32/48
//   public/og/default.png     1200x630 Open Graph card
//
// PENDING: a commissioned logo will replace all of this. Rerun the script after
// dropping the real artwork into renderMark() and every surface updates at once,
// which is the reason these are generated rather than hand exported.
//
// WHY THE COLORS AND TYPE ARE RESTATED HERE
// -----------------------------------------
// This script runs in node, outside the Next build, so it cannot resolve the
// Tailwind theme or render the React <Wordmark>. The values below are therefore
// a second copy of three hex codes and one font stack, and that duplication is
// deliberate and time limited: the whole file is replaced when the real logo
// lands. It is recorded in BACKLOG.md so it is not discovered as a surprise.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const SLATE = "#14315d";
const SLATE_INK = "#0b1b36";
const LIMESTONE = "#ffffff";
const BRASS = "#d9a032";
const SLATE_MUTED = "#555e6b";

const SERIF = "Archivo, 'Segoe UI', system-ui, sans-serif";
const SANS = "'Segoe UI', system-ui, -apple-system, sans-serif";

const appDir = path.join(process.cwd(), "src", "app");
const ogDir = path.join(process.cwd(), "public", "og");

/**
 * The square mark, used for every icon size.
 *
 * THE REAL ARTWORK, CROPPED TO THE NUMERALS
 * -----------------------------------------
 * The delivered lockup is a wide horizontal mark: numerals, a gold rule, then
 * "254 ENGINEERING SERVICES" tracked out beneath. At 512 pixels square that
 * whole lockup would sit in a thin band across the middle, and at 16 pixels the
 * descriptor is not text any more, it is a grey smudge under the part that
 * matters.
 *
 * So the icon uses the reverse artwork cropped to the numerals only, on the deep
 * navy ground. The numerals plus the gold parallelogram are what survive being
 * scaled to a tab strip, and they are the distinctive half of the mark.
 *
 * NUMERAL_BAND is the fraction of the artwork height occupied by the numerals,
 * measured from the delivered file rather than guessed: the gold rule sits at
 * roughly 72 percent and everything below it is the descriptor.
 */
const NUMERAL_BAND = 0.7;

async function markPng(size) {
  const src = path.join(process.cwd(), "brand-assets", "logo-dark.png");
  const meta = await sharp(src).metadata();
  const cropH = Math.round(meta.height * NUMERAL_BAND);

  // The numerals inset inside the square. Leaving air around a mark is what
  // stops it looking like a screenshot of a logo.
  const inner = Math.round(size * 0.76);
  // Three pipelines rather than one chain. sharp applies extract relative to the
  // pipeline it is in, and extract followed by trim in a single chain throws
  // "bad extract area" because the second operation is reasoning about the
  // pre-extract dimensions.
  const band = await sharp(src)
    .extract({ left: 0, top: 0, width: meta.width, height: cropH })
    .toBuffer();
  const tight = await sharp(band).trim().toBuffer();
  const numerals = await sharp(tight)
    .resize({ width: inner, fit: "inside", withoutEnlargement: false })
    .toBuffer();

  const placed = await sharp(numerals).metadata();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: SLATE_INK,
    },
  })
    .composite([
      {
        input: numerals,
        left: Math.round((size - placed.width) / 2),
        top: Math.round((size - placed.height) / 2),
      },
    ])
    .png()
    .toBuffer();
}

/**
 * The Open Graph card.
 *
 * It carries the real lockup now, embedded as a data URI so the headless browser
 * needs no file access and no network. The typographic stand in it replaced was
 * there only because no artwork existed.
 *
 * The registration status is still deliberately absent. An OG image is cached
 * hard by every platform that renders it, and a status that changes should never
 * be baked into an artifact nobody can invalidate.
 */
function ogHtml(logoDataUri) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:1200px;height:630px;}
    .card{
      width:1200px;height:630px;background:${LIMESTONE};
      display:flex;flex-direction:column;justify-content:space-between;
      padding:76px 84px;box-sizing:border-box;
      border-bottom:14px solid ${SLATE};
    }
    .eyebrow{
      font-family:${SANS};font-size:22px;font-weight:600;
      letter-spacing:0.19em;text-transform:uppercase;color:#8d610f;
    }
    .lockup{display:flex;align-items:center;gap:26px;margin-top:6px;}
    .lockup-img{height:150px;width:auto;display:block;margin-top:10px;}
    .num{font-family:${SERIF};font-weight:700;font-size:132px;line-height:1;color:${SLATE};letter-spacing:-0.02em;}
    .bar{width:3px;height:104px;background:${BRASS};}
    .name{
      font-family:${SANS};font-size:30px;font-weight:600;line-height:1.28;
      letter-spacing:0.17em;text-transform:uppercase;color:${SLATE};
    }
    .tag{
      font-family:${SERIF};font-size:40px;line-height:1.3;color:${SLATE};
      max-width:900px;margin-top:34px;
    }
    .foot{
      font-family:${SANS};font-size:23px;color:${SLATE_MUTED};
      display:flex;justify-content:space-between;align-items:flex-end;
    }
  </style></head><body>
    <div class="card">
      <div>
        <div class="eyebrow">Veteran owned. Statewide.</div>
        <img class="lockup-img" src="${logoDataUri}" alt="">
      </div>
      <div class="tag">Texas engineering services in all 254 counties.</div>
      <div class="foot">
        <span>254engineering.com</span>
        <span>Inspections. Sealed letters. Certifications. Design.</span>
      </div>
    </div>
  </body></html>`;
}

async function shoot(browser, html, width, height, file) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: file });
  await page.close();
  console.log(`  ${path.relative(process.cwd(), file)}  ${width}x${height}`);
}

async function main() {
  fs.mkdirSync(ogDir, { recursive: true });
  const browser = await chromium.launch();
  const tmp = path.join(process.cwd(), "scripts", ".raster-tmp");
  fs.mkdirSync(tmp, { recursive: true });

  try {
    // Icons come from sharp compositing the real artwork. No browser needed for
    // them any more, which also means they are deterministic rather than subject
    // to a headless font stack.
    fs.writeFileSync(path.join(appDir, "icon.png"), await markPng(512));
    console.log(`  ${path.relative(process.cwd(), path.join(appDir, "icon.png"))}  512`);
    fs.writeFileSync(path.join(appDir, "apple-icon.png"), await markPng(180));
    console.log(`  ${path.relative(process.cwd(), path.join(appDir, "apple-icon.png"))}  180`);

    const logoDataUri =
      "data:image/png;base64," +
      fs.readFileSync(path.join(process.cwd(), "brand-assets", "logo.png")).toString("base64");
    await shoot(browser, ogHtml(logoDataUri), 1200, 630, path.join(ogDir, "default.png"));

    // The .ico carries three sizes because Windows and older browsers pick
    // different ones, and a single 32px entry upscaled to 48 is visibly soft in
    // a bookmarks bar. Rendered at 512 once and downsampled by sharp, which
    // produces a cleaner small size than asking a browser to lay out 16px text.
    // The 512 icon written above is the master. Rendering it a second time would
    // be a second chance for the two to differ.
    const master = path.join(appDir, "icon.png");

    const icoSources = [];
    for (const size of [16, 32, 48]) {
      const out = path.join(tmp, `mark-${size}.png`);
      await sharp(master).resize(size, size, { kernel: "lanczos3" }).png().toFile(out);
      icoSources.push(out);
    }
    const ico = await pngToIco(icoSources);
    fs.writeFileSync(path.join(appDir, "favicon.ico"), ico);
    console.log(`  ${path.relative(process.cwd(), path.join(appDir, "favicon.ico"))}  16/32/48`);
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log("\nBrand rasters written. Regenerate with `npm run brand-rasters` when the logo lands.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
