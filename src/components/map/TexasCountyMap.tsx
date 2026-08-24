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
 * Brass is spent on one thing, the region a page is about, and is absent from
 * the hub entirely.
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

const COUNTY_FILL = "#16324b12";
const ACTIVE_FILL = "#a97c2a";
const HAIRLINE = "#c9bda6";
const BOUNDARY = "#16324b";

export function TexasCountyMap({
  /** When set, that region is filled brass and every other county stays pale. */
  activeRegion,
  className = "",
}: {
  activeRegion?: string;
  className?: string;
}) {
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
      <g stroke={HAIRLINE} strokeWidth={0.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke">
        {countyShapes.map((county) => (
          <path
            key={county.fips}
            d={county.d}
            fill={
              activeRegion && regionOfCounty.get(county.name) === activeRegion
                ? ACTIVE_FILL
                : COUNTY_FILL
            }
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      {/* Region boundaries, then the state outline over the top. Both are
          derived meshes, not drawn shapes. */}
      <path
        d={REGION_BOUNDARY_PATH}
        fill="none"
        stroke={BOUNDARY}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.55}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={STATE_OUTLINE_PATH}
        fill="none"
        stroke={BOUNDARY}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.85}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
