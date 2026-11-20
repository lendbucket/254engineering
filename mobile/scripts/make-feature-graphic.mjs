/**
 * GOOGLE PLAY'S FEATURE GRAPHIC, 1024 BY 500, FROM THE FIRM'S OWN MARK.
 * Autopilot item 6 of 2026-11-14 (app store preparation that needs no
 * sign-in): docs/store-listing.md said it was "to be made from the same mark
 * when the listing is created". It is made here, from master() in
 * scripts/emit-favicons.mjs, the one function behind the site's favicons and
 * the app's icons, so the three cannot drift: the numerals and the gold rule,
 * white, centred on the footer navy, with no words added.
 *
 *   node scripts/make-feature-graphic.mjs     (from mobile/)
 *
 * Writes mobile/resources/play-feature-graphic.png.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const repo = join(process.cwd(), "..");
const { master, GROUND, DEFAULT_SOURCE } = await import(pathToFileURL(join(repo, "scripts", "emit-favicons.mjs")).href);
const sharp = createRequire(join(repo, "package.json"))("sharp");

const WIDTH = 1024;
const HEIGHT = 500;
/* The mark at the graphic's full height, filling the same share of it the app icon fills. */
const mark = await master(join(repo, DEFAULT_SOURCE), HEIGHT, 0.8);
const png = await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: GROUND } })
  .composite([{ input: mark, left: Math.round((WIDTH - HEIGHT) / 2), top: 0 }])
  .png()
  .toBuffer();

const out = join("resources");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "play-feature-graphic.png"), png);
const meta = await sharp(png).metadata();
console.log(`resources/play-feature-graphic.png: ${meta.width} by ${meta.height}, ground ${GROUND}`);
