/**
 * The heights the brand lockup is served at, and the files that carry them.
 *
 * Robert's answer 3 of 7099393468, 2026-11-23: the lockup becomes a resized
 * copy at twice its drawn size. The delivered files are 2262 by 1147, and the
 * perf run of 7082713762 found /brand/logo.png (52,290 bytes) drawn at 39 by
 * 20 on every partner and account screen. `next/image` optimisation is not the
 * answer here: Robert's answer 15 of 2026-10-26 took the mark off the
 * optimizer, because its request hung for fifteen seconds on three boards.
 *
 * So each TIER is a drawn height, and its file is the lockup resized to twice
 * that height. `<Wordmark>` serves the smallest tier at or above the height it
 * is asked for, so no mark is ever drawn from fewer than two source pixels per
 * CSS pixel. A height above the largest tier gets the delivered original.
 *
 * The files are written by `npx tsx scripts/wordmark-sizes.mjs` from
 * `brand-assets/logo.png` and `brand-assets/logo-dark.png`, and token-audit
 * asserts each one exists at the size this table names. The delivered originals
 * stay in `public/brand/` because the press page offers them for download.
 */

/** Drawn heights in CSS pixels, ascending. */
export const WORDMARK_TIERS = [20, 26, 44, 84] as const;

/** The delivered lockup's aspect, 2262 by 1147. */
export const WORDMARK_RATIO = 2262 / 1147;

/** The served file for a mark drawn `height` CSS pixels tall. */
export function wordmarkSrc(height: number, onDark: boolean): string {
  const base = onDark ? "logo-dark" : "logo";
  const tier = WORDMARK_TIERS.find((t) => t >= height);
  return tier === undefined ? `/brand/${base}.png` : `/brand/${base}-h${tier * 2}.png`;
}
