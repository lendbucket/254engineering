import Image from "next/image";

/**
 * The brand mark.
 *
 * THE PLACEHOLDER IS GONE
 * -----------------------
 * This component used to draw a typographic stand in: the numerals set in the
 * display face, a rule, and the descriptor tracked out beside it. That existed
 * because no artwork did, and it was built so that exactly one file would change
 * when artwork arrived. This is that change.
 *
 * The real lockup is `brand-assets/logo.png` and its reverse
 * `brand-assets/logo-dark.png`, delivered with the approved v5 design. Both are
 * 2262 by 1147 with alpha and neither has canvas padding to trim, so the mark
 * sits tight to its own bounds and can be positioned as a block.
 *
 * WHY TWO FILES AND NOT ONE RECOLOURED
 * ------------------------------------
 * The reverse is not the same artwork with a filter on it. In the light lockup
 * the numerals are navy and the descriptor is navy; in the reverse both are
 * white while the gold parallelogram and the gold rule stay gold. A CSS invert
 * would have turned the gold to blue. Two assets is what the designer delivered
 * and it is what is correct.
 *
 * `logo-dark.png` renders as almost nothing against a white background, which is
 * expected and is not a broken file: it is white artwork for dark surfaces.
 *
 * SIZING
 * ------
 * The aspect is fixed at 2262 by 1147, so height alone drives it and `width` is
 * computed. v5 sets the header mark to `clamp(58px, 9vw, 84px)` tall and the
 * footer mark to 74px, which are the two defaults here.
 *
 * `priority` is off by default. The header mark is above the fold on every page
 * and Next will fetch it early regardless; marking it priority as well competes
 * with the LCP image for the same preload budget.
 */

const RATIO = 2262 / 1147;

export function Wordmark({
  onDark = false,
  /** Rendered height in pixels. Width follows the fixed aspect. */
  height = 72,
  priority = false,
  className = "",
}: {
  onDark?: boolean;
  height?: number;
  priority?: boolean;
  className?: string;
}) {
  const src = onDark ? "/brand/logo-dark.png" : "/brand/logo.png";
  return (
    <Image
      src={src}
      alt="254 Engineering Services"
      width={Math.round(height * RATIO)}
      height={height}
      priority={priority}
      className={`block h-auto w-auto ${className}`}
      style={{ height, width: "auto" }}
    />
  );
}
