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

const SLATE = "#16324b";
const SLATE_INK = "#0e2234";
const LIMESTONE = "#f7f3ea";
const BRASS = "#a97c2a";
const BRASS_LIGHT = "#c9a44f";
const SLATE_MUTED = "#4a5b6b";

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Segoe UI', system-ui, -apple-system, sans-serif";

const appDir = path.join(process.cwd(), "src", "app");
const ogDir = path.join(process.cwd(), "public", "og");

/**
 * The square mark, used for every icon size.
 *
 * Slate ground rather than limestone: an icon sits on a browser tab strip and on
 * a home screen, both of which are usually light, and a pale mark on a pale
 * chrome disappears. The brass rule under the numerals is the one element that
 * survives being scaled to 16 pixels as anything other than mud, which is why it
 * is a rule and not a serif flourish.
 */
function markHtml(size) {
  const numeral = Math.round(size * 0.42);
  const rule = Math.max(1, Math.round(size * 0.035));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:${size}px;height:${size}px;}
    .mark{
      width:${size}px;height:${size}px;
      background:${SLATE_INK};
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:${Math.round(size * 0.06)}px;
    }
    .num{
      font-family:${SERIF};
      font-weight:700;
      font-size:${numeral}px;
      line-height:1;
      color:${LIMESTONE};
      letter-spacing:-0.02em;
    }
    .rule{width:${Math.round(size * 0.44)}px;height:${rule}px;background:${BRASS_LIGHT};}
  </style></head><body>
    <div class="mark"><div class="num">254</div><div class="rule"></div></div>
  </body></html>`;
}

/**
 * The Open Graph card.
 *
 * Typographic, because there is no logo yet and a card with a stretched
 * placeholder mark on it looks worse than one that is confidently just words.
 * The registration status is deliberately not on the card: an OG image is cached
 * hard by every platform that renders it, and a status that changes should never
 * be baked into an artifact nobody can invalidate.
 */
function ogHtml() {
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
      letter-spacing:0.19em;text-transform:uppercase;color:#7c5a15;
    }
    .lockup{display:flex;align-items:center;gap:26px;margin-top:6px;}
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
        <div class="lockup">
          <div class="num">254</div>
          <div class="bar"></div>
          <div class="name">Engineering<br>Services</div>
        </div>
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
    await shoot(browser, markHtml(512), 512, 512, path.join(appDir, "icon.png"));
    await shoot(browser, markHtml(180), 180, 180, path.join(appDir, "apple-icon.png"));
    await shoot(browser, ogHtml(), 1200, 630, path.join(ogDir, "default.png"));

    // The .ico carries three sizes because Windows and older browsers pick
    // different ones, and a single 32px entry upscaled to 48 is visibly soft in
    // a bookmarks bar. Rendered at 512 once and downsampled by sharp, which
    // produces a cleaner small size than asking a browser to lay out 16px text.
    const master = path.join(tmp, "mark-512.png");
    await shoot(browser, markHtml(512), 512, 512, master);

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
