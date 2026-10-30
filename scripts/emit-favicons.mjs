// The square favicon set, the manifest icons and the schema logo, from one
// piece of artwork.
//
//   node scripts/emit-favicons.mjs                       the committed set, from DEFAULT_SOURCE
//   node scripts/emit-favicons.mjs <artwork> <out-dir>   a candidate set somewhere else, for a person to look at
//
// THE SOURCE, Robert 13:09 Central 2026-10-29: the corrected lockup held on
// hold/logo-254-engineering (bf391d6), the one without "SERVICES". The icons
// need the REVERSE, white numerals for the navy ground, so DEFAULT_SOURCE is
// that branch's public/brand/254-engineering-logo-dark.png, brought in alone.
// The hold branch's Wordmark and email-layout changes are NOT part of this: the
// favicon needs only the artwork.
//
// Robert, 13:05 Central 2026-10-29: "build a square favicon set (favicon.ico
// with 16, 32 and 48; 48x48, 96x96, 144x144 and 192x192 PNG; apple-touch-icon
// 180x180; manifest icons), legible at 16 px, on the brand colors. Set
// Organization schema 'logo' to a square PNG of at least 112x112 on a crawlable
// URL."
//
// THE MARK IS THE NUMERALS, NOT THE LOCKUP
// ----------------------------------------
// Both lockups, the current one and the corrected one held on
// hold/logo-254-engineering, are numerals, a gold rule, and a tracked descriptor
// beneath. At 16 pixels the descriptor is a grey smudge, so every size here is
// the numerals and the gold parallelogram alone, white on the footer navy. The
// two lockups differ only BELOW the rule ("SERVICES" or not), so the mark this
// script produces is the same whichever lockup Robert picks; only the crop line
// moves, and it is found in the artwork rather than typed.
//
// WHY THE CROP LINE IS MEASURED
// -----------------------------
// brand-rasters.mjs cropped at a typed 70 percent, measured from the first file.
// The corrected lockup puts its rule at about 82 percent, so a typed fraction is
// right for one file and wrong for the other. The rule is the first row below
// the middle of the artwork where most of the width is opaque gold, and the band
// is everything above it.
//
// ONE MASTER. Every size is downsampled from one 512 render, so no two sizes can
// differ in anything but resolution, and the manifest copies in public/icons are
// the same bytes as the convention files in src/app, which the proof asserts.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

/** The footer navy, DESIGN_SPEC.md section 3 row 12. The ground every icon sits on. */
export const GROUND = "#0b1b36";

/**
 * The fraction of the square the numerals may fill. The numerals are about
 * twice as wide as tall, so at 16 pixels every point of width is legibility:
 * the tab and link icons fill 92 percent. Only the manifest's MASKABLE icon
 * keeps 76 percent, because a launcher crops it to a circle and the outer ring
 * is not guaranteed to survive.
 */
const INNER = 0.92;
const INNER_MASKABLE = 0.76;

/** Every PNG size Robert listed, plus the 512 master, and where each one goes. */
export const SIZES = [48, 96, 144, 192, 512];
export const APPLE = 180;
export const ICO_SIZES = [16, 32, 48];
export const SCHEMA_LOGO = "public/brand/logo-square-512.png";
export const DEFAULT_SOURCE = "public/brand/254-engineering-logo-dark.png";

/** The first row below the middle whose width is mostly opaque gold: the rule under the numerals. */
async function ruleRow(src) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  for (let y = Math.floor(height / 2); y < height; y++) {
    let gold = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      if (a > 200 && r > 170 && g > 120 && b < 110) gold++;
    }
    if (gold > width * 0.5) return y;
  }
  throw new Error(`${src}: no gold rule found below the middle, so the numeral band cannot be measured`);
}

/** The 512 master: the numerals above the rule, trimmed, centered on the ground. */
export async function master(src, size = 512, fill = INNER) {
  const meta = await sharp(src).metadata();
  const rule = await ruleRow(src);
  // Three pipelines, as brand-rasters.mjs found: extract then trim in one chain
  // reasons about the pre-extract dimensions and throws.
  const band = await sharp(src).extract({ left: 0, top: 0, width: meta.width, height: rule }).toBuffer();
  const tight = await sharp(band).trim().toBuffer();
  const inner = Math.round(size * fill);
  const numerals = await sharp(tight).resize({ width: inner, height: inner, fit: "inside" }).toBuffer();
  const placed = await sharp(numerals).metadata();
  return sharp({ create: { width: size, height: size, channels: 4, background: GROUND } })
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

const down = (buf, size) => sharp(buf).resize(size, size, { kernel: "lanczos3" }).png().toBuffer();

/** Writes the whole set under `root`; returns the files written, relative to it. */
export async function emit(src, root) {
  const m = await master(src, 512);
  const files = {};
  const put = (rel, bytes) => {
    const out = path.join(root, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, bytes);
    files[rel] = bytes.length;
  };
  put("src/app/icon.png", m);
  put("public/icons/icon-512.png", m);
  put("public/icons/icon-512-maskable.png", await master(src, 512, INNER_MASKABLE));
  put(SCHEMA_LOGO, m);
  // The numbered convention files give the head a link per size; Next sorts
  // them lexically, so the numbers follow the sizes upward.
  const numbered = [48, 96, 144, 192];
  for (const [i, size] of numbered.entries()) {
    const png = await down(m, size);
    put(`src/app/icon${i + 1}.png`, png);
    put(`public/icons/icon-${size}.png`, png);
  }
  put("src/app/apple-icon.png", await down(m, APPLE));
  const icoParts = [];
  for (const size of ICO_SIZES) icoParts.push(await down(m, size));
  put("src/app/favicon.ico", await pngToIco(icoParts));
  // A 16 pixel preview, because "legible at 16 px" is a claim somebody has to look at.
  if (root !== process.cwd()) put("preview-16.png", icoParts[0]);
  return files;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (invokedDirectly) {
  const src = process.argv[2] ?? path.join(process.cwd(), DEFAULT_SOURCE);
  const root = process.argv[3] ? path.resolve(process.argv[3]) : process.cwd();
  const files = await emit(src, root);
  for (const [rel, bytes] of Object.entries(files)) console.log(`  ${rel}  ${bytes} bytes`);
  console.log(`\nFavicon set written from ${path.relative(process.cwd(), src) || src}.`);
}
