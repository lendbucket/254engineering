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
    county: "#14315d12",
    hairline: "#c3c9d1",
    boundary: "#14315d",
    boundaryOpacity: 0.55,
    outline: "#14315d",
    outlineOpacity: 0.85,
    active: "#d9a032",
  },
  dark: {
    county: "#ffffff12",
    hairline: "#ffffff2e",
    boundary: "#e8b04a",
    boundaryOpacity: 0.85,
    outline: "#ffffff",
    outlineOpacity: 0.9,
    active: "#e8b04a",
  },
} as const;

/**
 * The id of the shared county geometry, when a page draws this map twice.
 *
 * WHY THIS EXISTS
 * ---------------
 * The homepage renders the map twice: once in the hero on navy, once in the
 * coverage section on light. Measured on the live site, that was two identical
 * 73.7KB inline SVGs in one document, and because the map is a server component
 * the same path data was serialized again into the RSC flight payload. One
 * county's path string appeared eight times in the homepage HTML.
 *
 * The homepage was the worst LCP of the eight sampled templates at 2.9s against
 * 1.5 to 2.2s elsewhere, and its document was 55KB transferred against 13 to
 * 14KB for a service page. The duplicated geometry was most of that difference.
 *
 * WHAT THIS DOES NOT DO
 * ---------------------
 * It does not change a pixel. The 254 paths are emitted once with no fill and no
 * stroke, and each instance draws them through a use element carrying its own
 * tone. Presentation attributes inherit through use, so the light map and the
 * dark map still paint exactly the colours they painted before.
 *
 * It is opt in and explicit rather than automatic. A component cannot know it is
 * the second map on a page, and a global registry that guessed would be a
 * hydration bug waiting to happen. The homepage says which instance defines the
 * geometry and which reuses it; every other page draws a standalone map exactly
 * as before.
 *
 * A map with an activeRegion cannot share geometry, because one region's
 * counties carry a different fill. That is only ever the region pages, which
 * draw a single map, so there is nothing to share there anyway.
 */
export const COUNTY_GEOMETRY_ID = "tx-county-shapes";

export function TexasCountyMap({
  /** When set, that region is filled and every other county stays pale. */
  activeRegion,
  /** Which surface the map is sitting on. */
  tone = "light",
  className = "",
  /**
   * "define" emits the shared geometry and uses it. "reuse" draws only a use
   * element and requires a "define" instance earlier in the same document.
   * Undefined is a standalone map, which is what every page except the homepage
   * renders. Ignored when activeRegion is set.
   */
  shared,
}: {
  activeRegion?: string;
  tone?: "light" | "dark";
  className?: string;
  shared?: "define" | "reuse";
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
        {activeRegion || !shared ? (
          countyShapes.map((county) => (
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
          ))
        ) : (
          <>
            {shared === "define" ? (
              <defs>
                <g id={COUNTY_GEOMETRY_ID}>
                  {countyShapes.map((county) => (
                    <path key={county.fips} d={county.d} vectorEffect="non-scaling-stroke" />
                  ))}
                </g>
              </defs>
            ) : null}
            {/* fill on the use element inherits down to every path inside the
                referenced group, which is what keeps the two tones distinct
                while the geometry is written once. */}
            <use href={`#${COUNTY_GEOMETRY_ID}`} fill={t.county} />
          </>
        )}
      </g>

      {/* Region boundaries, then the state outline over the top. Both are
          derived meshes, not drawn shapes. */}
      <path
        d={REGION_BOUNDARY_PATH}
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
