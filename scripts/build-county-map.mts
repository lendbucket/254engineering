/**
 * Generate the Texas county map geometry.
 *
 *   npm run build-county-map
 *
 * WHERE THE GEOMETRY COMES FROM
 * -----------------------------
 * us-atlas, which repackages the US Census Bureau TIGER/Line cartographic
 * boundary files. Census TIGER is a work of the United States government and is
 * in the public domain. The 10m file is the Census 1:10,000,000 generalization,
 * which is the right one for a state drawn at roughly 900 pixels: the 500k file
 * carries coastline detail that cannot be seen at this size and costs about
 * eight times the bytes.
 *
 * Nothing here is drawn by hand. If a boundary looks wrong on the rendered map,
 * it is wrong in the Census generalization, and the fix is a different source
 * file rather than an edit to the output.
 *
 * WHY THE REGION BOUNDARIES ARE COMPUTED HERE AND NOT DRAWN IN CSS
 * ----------------------------------------------------------------
 * The first version of this map tinted each region a different shade and let the
 * eight regions read as eight blocks of colour. That was wrong twice. A
 * monochrome ramp over categorical regions implies a quantity that does not
 * exist, and the four colouring it depended on was assigned by hand from a guess
 * about which regions touch. Rendered at 1280 the guess was visibly wrong:
 * Coastal Bend and Austin share a border and had been given the same step.
 *
 * The honest version is the one a reference map has always used. Every county is
 * the same pale fill with a hairline border, and the lines that separate the
 * regions are drawn heavier. topojson mesh() extracts exactly the arcs where the
 * counties on either side belong to different regions, so the boundary is
 * derived from the same assignment the county lists are, and it cannot drift
 * from them by being redrawn.
 *
 * THE COUPLING THIS CREATES, AND THE GUARD ON IT
 * ----------------------------------------------
 * Because the region boundary depends on the region assignment, this generated
 * file goes stale the moment a county moves between regions in
 * src/content/regions.ts. Nothing about a stale boundary looks broken; it just
 * draws a line in the wrong place forever.
 *
 * So the script emits REGION_ASSIGNMENT_FINGERPRINT, a hash of the sorted region
 * and county pairs. src/components/map/TexasCountyMap.tsx recomputes it from the
 * live region data at module scope and throws if the two disagree. Every page
 * carrying the map is statically prerendered, so a stale file fails the build
 * out loud rather than shipping a quiet cartographic lie.
 *
 * THE PROJECTION
 * --------------
 * Albers equal area, standard parallels 27.5 and 35, central meridian 100 west.
 * Those are the parameters of the Texas Centric Albers Equal Area projection the
 * state uses for statewide mapping. Equal area matters: the map exists to say
 * every county is served, and a projection that inflated the Panhandle relative
 * to the Valley would be making a quiet argument about which counties matter.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import { feature, mesh } from "topojson-client";
import { geoConicEqualArea, geoPath } from "d3-geo";
import { regions } from "../src/content/regions";
import { regionAssignmentFingerprint } from "../src/content/region-fingerprint";

const require = createRequire(import.meta.url);

/** The viewBox the component renders into. Aspect follows Texas. */
const WIDTH = 1000;
const HEIGHT = 1070;
/** Keeps the outer counties off the edge of the box. */
const PADDING = 10;
/** One decimal at this scale is sub pixel on any screen and halves the file. */
const PRECISION = 1;

const topo = require("us-atlas/counties-10m.json");

/** county name -> region slug, from the live content data. */
const regionOf = new Map<string, string>();
for (const region of regions) {
  for (const county of region.counties) regionOf.set(county, region.slug);
}

// Narrow the topology to Texas before meshing, so mesh() sees only Texas arcs
// and the exterior it produces is the state outline rather than the nation's.
const countiesObject = topo.objects.counties as {
  type: string;
  geometries: { id?: string | number; properties: { name: string } }[];
};
const texasGeometries = countiesObject.geometries.filter((g) =>
  String(g.id).padStart(5, "0").startsWith("48"),
);

if (texasGeometries.length !== 254) {
  console.error(
    `build-county-map: the source holds ${texasGeometries.length} counties with a Texas FIPS prefix, not 254. Refusing to emit.`,
  );
  process.exit(1);
}

const texasObject = { type: "GeometryCollection", geometries: texasGeometries } as never;

const collection = feature(topo, texasObject) as unknown as {
  features: { id?: string | number; properties: { name: string } }[];
};

const unknownNames = collection.features
  .map((f) => f.properties.name)
  .filter((n) => !regionOf.has(n));
if (unknownNames.length > 0) {
  console.error(
    `build-county-map: ${unknownNames.length} county name(s) in the Census data are absent from src/content/regions.ts: ${unknownNames.join(", ")}`,
  );
  process.exit(1);
}

const projection = geoConicEqualArea()
  .parallels([27.5, 35])
  .rotate([100, 0])
  .center([0, 31.5])
  .fitExtent(
    [
      [PADDING, PADDING],
      [WIDTH - PADDING, HEIGHT - PADDING],
    ],
    collection as never,
  );

const pathOf = geoPath(projection);

/** Trim coordinate noise without touching the shape. */
const round = (d: string) =>
  d.replace(/-?\d+\.\d+/g, (n) => String(Number(Number(n).toFixed(PRECISION))));

const sorted = [...collection.features].sort((a, b) =>
  String(a.id).localeCompare(String(b.id)),
);

const rows = sorted.map((f) => {
  const d = pathOf(f as never);
  if (!d) throw new Error(`no path generated for ${f.properties.name}`);
  const [cx, cy] = pathOf.centroid(f as never);
  return {
    fips: String(f.id).padStart(5, "0"),
    name: f.properties.name,
    d: round(d),
    cx: Number(cx.toFixed(1)),
    cy: Number(cy.toFixed(1)),
  };
});

// The arcs where the counties on either side sit in different regions. This is
// the region boundary, derived rather than drawn.
type NamedGeometry = { properties?: { name?: string } };
const nameOf = (g: unknown) => (g as NamedGeometry).properties?.name ?? "";

const regionMesh = mesh(
  topo,
  texasObject,
  (a, b) => regionOf.get(nameOf(a)) !== regionOf.get(nameOf(b)),
);

// The exterior. mesh with a === b returns arcs used exactly once, which on a
// collection narrowed to Texas is the state boundary and the coastline.
const outlineMesh = mesh(topo, texasObject, (a, b) => a === b);

const regionBoundaryPath = round(pathOf(regionMesh) ?? "");
const stateOutlinePath = round(pathOf(outlineMesh) ?? "");

if (!regionBoundaryPath || !stateOutlinePath) {
  console.error("build-county-map: a mesh came back empty. Refusing to emit.");
  process.exit(1);
}

const fingerprint = regionAssignmentFingerprint(regions);

const header = `/**
 * TEXAS COUNTY GEOMETRY. GENERATED FILE. DO NOT EDIT BY HAND.
 *
 * Written by scripts/build-county-map.mts from us-atlas counties-10m, which
 * repackages US Census Bureau TIGER/Line cartographic boundary files. Census
 * TIGER is a work of the United States government and is in the public domain.
 *
 * Projection: Albers equal area, standard parallels 27.5 and 35, central
 * meridian 100 west, which are the Texas Centric Albers parameters. Equal area
 * is deliberate; see the note in the generator.
 *
 * REGION_ASSIGNMENT_FINGERPRINT below is a hash of the region and county pairs
 * in src/content/regions.ts as they stood when this file was generated.
 * src/components/map/TexasCountyMap.tsx recomputes it from the live data and
 * throws if it has changed, because \`regionBoundaryPath\` is derived from that
 * assignment and goes silently wrong when a county moves between regions.
 *
 * Regenerate with: npm run build-county-map
 */

export const COUNTY_MAP_VIEWBOX = { width: ${WIDTH}, height: ${HEIGHT} } as const;

export const REGION_ASSIGNMENT_FINGERPRINT = ${JSON.stringify(fingerprint)};

/** Every arc where the counties on either side belong to different regions. */
export const REGION_BOUNDARY_PATH = ${JSON.stringify(regionBoundaryPath)};

/** The state boundary and coastline. */
export const STATE_OUTLINE_PATH = ${JSON.stringify(stateOutlinePath)};

export type CountyShape = {
  /** Five digit state plus county FIPS code. */
  fips: string;
  /** Census county name, without the word County. Join key against regions.ts. */
  name: string;
  /** SVG path data in the viewBox above. */
  d: string;
  /** Projected centroid, for labels and markers. */
  cx: number;
  cy: number;
};

export const countyShapes: CountyShape[] = `;

const out = `${header}${JSON.stringify(rows, null, 2)};\n`;

fs.writeFileSync("src/content/county-geometry.ts", out.replace(/\n/g, "\r\n"), "utf8");

console.log("build-county-map: wrote src/content/county-geometry.ts");
console.log(
  `  ${rows.length} counties, ${(Buffer.byteLength(out, "utf8") / 1024).toFixed(0)} KB, viewBox ${WIDTH}x${HEIGHT}`,
);
console.log(`  region assignment fingerprint ${fingerprint}`);
