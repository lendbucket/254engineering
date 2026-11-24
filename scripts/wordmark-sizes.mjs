// The brand lockup at twice each drawn height <Wordmark> uses.
//
//   npx tsx scripts/wordmark-sizes.mjs
//
// Robert's answer 3 of 7099393468, 2026-11-23. The tiers are declared in
// src/components/brand/wordmark-sizes.ts, which <Wordmark> reads to pick a file;
// this writes one file per tier for each of the two delivered lockups:
//   public/brand/logo-h<2 x tier>.png and public/brand/logo-dark-h<2 x tier>.png
// token-audit asserts every one exists at the size the table names.
//
// Lanczos down from the 2262 by 1147 original, alpha kept, PNG at the highest
// zlib effort. Rerun it whenever a tier or the artwork changes, and commit the
// files it writes.
import path from "node:path";
import sharp from "sharp";
import { WORDMARK_TIERS, WORDMARK_RATIO } from "../src/components/brand/wordmark-sizes.ts";

const root = process.cwd();
let written = 0;
for (const base of ["logo", "logo-dark"]) {
  const src = path.join(root, "brand-assets", `${base}.png`);
  for (const tier of WORDMARK_TIERS) {
    const height = tier * 2;
    const width = Math.round(height * WORDMARK_RATIO);
    const out = path.join(root, "public", "brand", `${base}-h${height}.png`);
    const info = await sharp(src)
      .resize({ width, height, fit: "fill", kernel: "lanczos3" })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(out);
    console.log(`${base}-h${height}.png  ${info.width} x ${info.height}  ${info.size} bytes`);
    written += 1;
  }
}
if (written !== WORDMARK_TIERS.length * 2) {
  console.error(`wrote ${written} files, expected ${WORDMARK_TIERS.length * 2}`);
  process.exit(1);
}
