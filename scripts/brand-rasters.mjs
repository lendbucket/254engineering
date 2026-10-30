// Rasterize the placeholder wordmark into every bitmap the site needs.
//
//   npm run brand-rasters
//
// Produces:
//   every icon, through scripts/emit-favicons.mjs (the one writer of icons
//     since 2026-10-29; see that file for the sizes)
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
import { emit as emitFavicons, DEFAULT_SOURCE } from "./emit-favicons.mjs";

const SLATE = "#14315d";
const LIMESTONE = "#ffffff";
const BRASS = "#d9a032";
const SLATE_MUTED = "#555e6b";

const SERIF = "Archivo, 'Segoe UI', system-ui, sans-serif";
const SANS = "'Segoe UI', system-ui, -apple-system, sans-serif";

const ogDir = path.join(process.cwd(), "public", "og");

/*
 * THE SQUARE MARK MOVED to scripts/emit-favicons.mjs on 2026-10-29. Its crop
 * was a typed 70 percent of the old lockup's height; the corrected lockup puts
 * its gold rule lower, so that file finds the rule in the artwork instead.
 */

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

  try {
    // Every icon comes from scripts/emit-favicons.mjs, the one writer of them.
    // Two scripts writing one file would be two homes for one fact.
    const icons = await emitFavicons(path.join(process.cwd(), DEFAULT_SOURCE), process.cwd());
    for (const rel of Object.keys(icons)) console.log(`  ${rel}`);

    const logoDataUri =
      "data:image/png;base64," +
      fs.readFileSync(path.join(process.cwd(), "brand-assets", "logo.png")).toString("base64");
    await shoot(browser, ogHtml(logoDataUri), 1200, 630, path.join(ogDir, "default.png"));
  } finally {
    await browser.close();
  }

  console.log("\nBrand rasters written. Regenerate with `npm run brand-rasters` when the logo lands.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
