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
 *
 * UNOPTIMIZED, AND WIDTH AND HEIGHT SET TOGETHER
 * ----------------------------------------------
 * Robert's answer 15, 2026-10-26. Three cloud boards in a row failed
 * dashboard-speed-audit on one request left open for about fifteen seconds on
 * every load: `/_next/image?url=%2Fbrand%2Flogo-dark.png&w=64&q=75`, the image
 * optimizer serving this mark on the portal sidebar. The two files are 30 and
 * 52 KB and never change, so the optimizer buys nothing here; `unoptimized`
 * serves `/brand/logo.png` and `/brand/logo-dark.png` as the static files they
 * are, and that request no longer exists. Photographs keep the optimizer.
 *
 * The style sets BOTH dimensions. Next warns in development when the rendered
 * height differs from the `height` attribute while the width does not, or the
 * other way round, and `width: "auto"` with a responsive height produced 277 of
 * those warnings in one board's logs. The CSS width is the CSS height times the
 * ratio of the two attributes, so at the attributes' own size both match, and at
 * any other size both differ.
 */

const RATIO = 2262 / 1147;

export function Wordmark({
  onDark = false,
  /** Rendered height in pixels. Width follows the fixed aspect. */
  height = 72,
  cssHeight,
  priority = false,
  className = "",
}: {
  onDark?: boolean;
  height?: number;
  /**
   * A CSS length for the rendered height, used instead of `height` when given.
   *
   * IT EXISTS BECAUSE v5's HEADER RULE IS RESPONSIVE AND A NUMBER CANNOT BE.
   * The spec is `clamp(58px, 9vw, 84px)`, which is 84 at 1280 and 58 at 390. A
   * fixed `height` prop satisfies neither: measured on 2026-09-30, a header set
   * to 40 rendered 40 at both widths, short of the spec by 44 and by 18.
   *
   * `height` is still what sizes the intrinsic attributes Next needs, so the
   * caller passes the LARGEST value the clamp can reach. Asking Next for a
   * smaller source than the clamp will render is how a mark ends up upscaled
   * and soft at the wide end, which no audit would see and a screen would.
   */
  cssHeight?: string;
  priority?: boolean;
  className?: string;
}) {
  const src = onDark ? "/brand/logo-dark.png" : "/brand/logo.png";
  const width = Math.round(height * RATIO);
  return (
    <Image
      src={src}
      alt="254 Engineering"
      width={width}
      height={height}
      priority={priority}
      unoptimized
      className={`block ${className}`}
      style={
        cssHeight
          ? { height: cssHeight, width: `calc(${cssHeight} * ${width} / ${height})` }
          : { height, width }
      }
    />
  );
}
