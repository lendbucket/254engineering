import {
  COUNTY_MAP_VIEWBOX,
  REGION_BOUNDARY_PATH,
  STATE_OUTLINE_PATH,
  countyShapes,
} from "@/content/county-geometry";
import { regions } from "@/content/regions";
import { TONES } from "./TexasCountyMap";

/**
 * THE COUNTY MAP AS A FILE, FOR THE TWO COVERAGE ROUTES.
 *
 * Robert, 2026-11-01, round 3 item a: "Serve the county map as a separate SVG
 * file. County names stay in the HTML as the text list. This amends the 'keep
 * the county map server rendered' ruling for the drawing only."
 *
 * Why: the board's LCP diagnostic names the masthead photograph on /coverage
 * and /coverage/coastal-bend, and the simulated run cannot start that request
 * until the document has arrived. The inline map was 42KB of path data in the
 * markup and the same again in the React flight payload, coordinates that
 * compress poorly. Measured against the live pages on 2026-11-01, taking it out
 * of the document moves /coverage from 61,096 to 33,744 gzipped bytes and
 * /coverage/coastal-bend from 50,430 to 22,706, which puts both near the
 * service page that reads 2,944ms with the same masthead.
 *
 * WHAT IS DRAWN IS THE COMPONENT'S DRAWING. The same viewBox, group attributes,
 * 254 paths in FIPS order, active fill, boundary and outline, in the light tone
 * the coverage routes use. scripts/proofs/the-county-map-file-draws-the-component.mjs
 * compares this string against TexasCountyMap rendered, path for path.
 *
 * One difference is required by the medium: an SVG loaded through <img> cannot
 * see globals.css, so the rule that keeps the hairlines at hairline width
 * (vector-effect does not inherit) is written inside the file.
 *
 * The map was never the coverage claim's evidence: its paths carry no county
 * names. The 254 names are server rendered text on /coverage and each region
 * page, which coverage-audit checks against an independent list.
 */

/** county name -> region slug. */
const regionOfCounty = new Map<string, string>();
for (const region of regions) {
  for (const county of region.counties) regionOfCounty.set(county, region.slug);
}

const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The accessible name, the same sentence the inline map carried. */
export function countyMapLabel(activeRegion?: string): string {
  const activeName = activeRegion ? regions.find((r) => r.slug === activeRegion)?.name : undefined;
  return activeName
    ? `Map of the 254 counties of Texas with the ${activeName} coverage region filled.`
    : "Map of the 254 counties of Texas, divided into the eight coverage regions.";
}

/** The file's published name: one statewide map, and one per region. */
export function countyMapFileName(activeRegion?: string): string {
  return activeRegion ? `texas-counties-${activeRegion}.svg` : "texas-counties.svg";
}

/** Every file the route serves, mapped to the region it fills (undefined is statewide). */
export function countyMapFiles(): Map<string, string | undefined> {
  const files = new Map<string, string | undefined>([[countyMapFileName(), undefined]]);
  for (const r of regions) files.set(countyMapFileName(r.slug), r.slug);
  return files;
}

/** The SVG document. Light tone, which is what the coverage routes draw. */
export function countyMapSvg(activeRegion?: string): string {
  const t = TONES.light;
  const paths = countyShapes
    .map((county) =>
      activeRegion && regionOfCounty.get(county.name) === activeRegion
        ? `<path d="${county.d}" fill="${t.active}"></path>`
        : `<path d="${county.d}"></path>`,
    )
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COUNTY_MAP_VIEWBOX.width} ${COUNTY_MAP_VIEWBOX.height}"` +
    ` width="${COUNTY_MAP_VIEWBOX.width}" height="${COUNTY_MAP_VIEWBOX.height}" role="img" aria-label="${escapeAttr(countyMapLabel(activeRegion))}">` +
    `<style>.tx-counties path{vector-effect:non-scaling-stroke}</style>` +
    `<g stroke="${t.hairline}" stroke-width="0.5" stroke-linejoin="round" vector-effect="non-scaling-stroke" fill="${t.county}" class="tx-counties">` +
    paths +
    `</g>` +
    `<path d="${REGION_BOUNDARY_PATH}" fill="none" stroke="${t.boundary}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" opacity="${t.boundaryOpacity}" vector-effect="non-scaling-stroke"></path>` +
    `<path d="${STATE_OUTLINE_PATH}" fill="none" stroke="${t.outline}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="${t.outlineOpacity}" vector-effect="non-scaling-stroke"></path>` +
    `</svg>`
  );
}
