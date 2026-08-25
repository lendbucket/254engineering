import {
  COUNTY_MAP_VIEWBOX,
  REGION_ASSIGNMENT_FINGERPRINT,
  REGION_BOUNDARY_PATH,
  STATE_OUTLINE_PATH,
  countyShapes,
} from "@/content/county-geometry";
import { regions } from "@/content/regions";
import { regionAssignmentFingerprint } from "@/content/region-fingerprint";

/**
 * The 254 county map of Texas.
 *
 * WHY NOTHING IS COLOUR CODED
 * ---------------------------
 * There are eight regions and the brand has three colours. The first version of
 * this map filled each region with one of four tints of slate, and it was wrong
 * for two separate reasons that are both worth keeping written down.
 *
 * A monochrome ramp laid over categorical regions implies an ordering that does
 * not exist. A reader seeing four shades assumes the dark ones are more of
 * something. They are not. They are just a different region.
 *
 * And the four colouring underneath it was assigned by hand, from a guess about
 * which regions touch which. Rendered at 1280 the guess was visibly wrong:
 * Coastal Bend and Austin share a long border and had been given the same tint,
 * so two regions read as one.
 *
 * The version that survived is what a reference map has always done. Every
 * county carries the same pale fill and a hairline border. The lines separating
 * the regions are drawn heavier, and they are not drawn at all: topojson mesh()
 * extracted exactly the arcs where the counties on either side sit in different
 * regions, so the boundary is derived from the same assignment the county lists
 * are and cannot disagree with them.
 *
 * Gold is spent deliberately and differently by surface. On light it marks only
 * the region a page is about. On navy it draws the region borders themselves,
 * which is the one place on the site where gold carries structure rather than
 * accent, and it is legitimate there because on that band the borders ARE the
 * subject.
 *
 * WHAT THIS MAP IS NOT
 * --------------------
 * It is not the source of the coverage claim. The authoritative list is the 254
 * county text on /coverage, which scripts/coverage-audit.mjs checks against an
 * independent canonical list. The generator refuses to emit if the Census names
 * and the region data disagree, so a county cannot go missing from one side and
 * render as a hole in the map.
 */

/*
 * The staleness guard.
 *
 * REGION_BOUNDARY_PATH is derived from the region assignment, so it goes wrong
 * the moment a county moves between regions and nobody regenerates. A wrong
 * boundary does not look broken, it just draws a line in the wrong place
 * forever. Every page carrying this map is statically prerendered, so throwing
 * here fails the build rather than shipping the lie.
 */
const liveFingerprint = regionAssignmentFingerprint(regions);
if (liveFingerprint !== REGION_ASSIGNMENT_FINGERPRINT) {
  throw new Error(
    `TexasCountyMap: src/content/regions.ts has changed since the map geometry was generated ` +
      `(live ${liveFingerprint}, generated ${REGION_ASSIGNMENT_FINGERPRINT}). ` +
      `The region boundary is derived from that assignment and is now wrong. ` +
      `Run: npm run build-county-map`,
  );
}

/** county name -> region slug. Built once at module scope. */
const regionOfCounty = new Map<string, string>();
for (const region of regions) {
  for (const county of region.counties) regionOfCounty.set(county, region.slug);
}

/*
 * Two tones, because the map now has to work on both surfaces.
 *
 * On light it is a document: navy lines on off white. On navy it inverts and
 * the region borders become gold, which is the one place on the site where gold
 * carries structural information rather than accent. That is legitimate here
 * because the borders are the subject: the band exists to show the state
 * divided into eight.
 *
 * These are literal hex rather than theme tokens for the reason recorded in
 * BACKLOG: SVG presentation attributes do not resolve Tailwind utilities, and a
 * class on each of 254 paths costs more than it saves. They move with the
 * palette by hand, and they moved with it in this pass.
 */
const TONES = {
  light: {
    county: "#14315c12",
    hairline: "#c9bda6",
    boundary: "#14315c",
    boundaryOpacity: 0.55,
    outline: "#14315c",
    outlineOpacity: 0.85,
    active: "#d19a1e",
  },
  dark: {
    county: "#f6f3ec10",
    hairline: "#f6f3ec2e",
    boundary: "#e3b95a",
    boundaryOpacity: 0.85,
    outline: "#f6f3ec",
    outlineOpacity: 0.9,
    active: "#e3b95a",
  },
} as const;

export function TexasCountyMap({
  /** When set, that region is filled and every other county stays pale. */
  activeRegion,
  /** Which surface the map is sitting on. */
  tone = "light",
  /**
   * Draw the region borders on as the map scrolls into view.
   *
   * Scroll driven rather than time driven, and off entirely under
   * prefers-reduced-motion. See the motion block in globals.css. The borders are
   * one path containing every arc in the mesh, so this reads as the state
   * dividing itself rather than as 254 counties animating separately.
   */
  animateBorders = false,
  className = "",
}: {
  activeRegion?: string;
  tone?: "light" | "dark";
  animateBorders?: boolean;
  className?: string;
}) {
  const t = TONES[tone];
  const activeName = activeRegion
    ? regions.find((r) => r.slug === activeRegion)?.name
    : undefined;

  const label = activeName
    ? `Map of the 254 counties of Texas with the ${activeName} coverage region filled.`
    : "Map of the 254 counties of Texas, divided into the eight coverage regions.";

  return (
    <svg
      viewBox={`0 0 ${COUNTY_MAP_VIEWBOX.width} ${COUNTY_MAP_VIEWBOX.height}`}
      role="img"
      aria-label={label}
      className={`h-auto w-full ${className}`}
    >
      {/* Counties. Hairlines stay hairlines at 390 and at 1280: without
          non-scaling-stroke they thicken as the map scales up and vanish as it
          scales down. */}
      <g stroke={t.hairline} strokeWidth={0.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke">
        {countyShapes.map((county) => (
          <path
            key={county.fips}
            d={county.d}
            fill={
              activeRegion && regionOfCounty.get(county.name) === activeRegion
                ? t.active
                : t.county
            }
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      {/* Region boundaries, then the state outline over the top. Both are
          derived meshes, not drawn shapes. */}
      <path
        d={REGION_BOUNDARY_PATH}
        data-draw={animateBorders ? "" : undefined}
        fill="none"
        stroke={t.boundary}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={t.boundaryOpacity}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={STATE_OUTLINE_PATH}
        fill="none"
        stroke={t.outline}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={t.outlineOpacity}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
