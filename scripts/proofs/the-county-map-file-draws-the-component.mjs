/**
 * PROOF: THE COVERAGE ROUTES LOAD THE COUNTY MAP AS A FILE, AND THE FILE DRAWS
 * WHAT THE INLINE MAP DREW.
 *
 * Robert, 2026-11-01, round 3 item a: "Serve the county map as a separate SVG
 * file. County names stay in the HTML as the text list. This amends the 'keep
 * the county map server rendered' ruling for the drawing only."
 *
 *   A  for the statewide map and every region, the file's 254 county paths are
 *      the component's, in order, with the same fill on each, and the region
 *      boundary and state outline are the same paths
 *   B  the file carries the viewBox, the accessible name, and the hairline rule
 *      an image cannot get from globals.css
 *   C  the route serves exactly one file per region plus the statewide one
 *   D  /coverage and the region page draw CountyMapImage and no inline map,
 *      and both still render their county names as text
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-county-map-file-draws-the-component.mjs
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { TexasCountyMap } from "../../src/components/map/TexasCountyMap.tsx";
import { countyMapFiles, countyMapSvg, countyMapLabel } from "../../src/components/map/county-map-file.ts";
import { regions } from "../../src/content/regions.ts";

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok, note });

/** Every path in document order as "d|fill", fill empty when the path carries none. */
function pathsOf(svg) {
  return [...svg.matchAll(/<path\b([^>]*)>/g)].map((m) => {
    const d = /\bd="([^"]*)"/.exec(m[1])?.[1] ?? "";
    const fill = /\bfill="([^"]*)"/.exec(m[1])?.[1] ?? "";
    return `${d}|${fill}`;
  });
}

const cases = [undefined, ...regions.map((r) => r.slug)];
for (const region of cases) {
  const label = region ?? "statewide";
  const component = renderToStaticMarkup(createElement(TexasCountyMap, region ? { activeRegion: region } : {}));
  const file = countyMapSvg(region);
  const a = pathsOf(component);
  const b = pathsOf(file);
  check(`${label}: the component drew 256 paths, so the comparison is not over nothing`, a.length === 256, `${a.length}`);
  const firstDiff = a.findIndex((p, i) => p !== b[i]);
  check(`${label}: the file's paths and fills equal the component's, in order`, a.length === b.length && firstDiff === -1, firstDiff === -1 ? "" : `first difference at path ${firstDiff}`);
  const filled = b.filter((p) => p.endsWith("|#d9a032")).length;
  if (region) check(`${label}: its own counties are filled`, filled === regions.find((r) => r.slug === region).counties.length, `${filled}`);
  else check(`${label}: no county is filled`, filled === 0, `${filled}`);
  check(`${label}: the file names itself the way the inline map did`, file.includes(`aria-label="${countyMapLabel(region)}"`));
}

const sample = countyMapSvg();
check("the file is a standalone SVG document", sample.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1070"'));
check("the file carries the hairline rule an image cannot read from globals.css", sample.includes("<style>.tx-counties path{vector-effect:non-scaling-stroke}</style>"));

const files = countyMapFiles();
check("the route serves the statewide map and one per region", files.size === regions.length + 1, `${files.size}`);
for (const r of regions) check(`a file exists for ${r.slug}`, files.get(`texas-counties-${r.slug}.svg`) === r.slug);

const hub = readFileSync("src/app/(site)/coverage/page.tsx", "utf8");
const region = readFileSync("src/app/(site)/coverage/[slug]/page.tsx", "utf8");
for (const [name, src] of [["/coverage", hub], ["/coverage/[slug]", region]]) {
  check(`${name} draws CountyMapImage`, /<CountyMapImage\b/.test(src));
  check(`${name} draws no inline map`, !/<TexasCountyMap\b/.test(src));
}
check("/coverage still renders all 254 county names as text", /allCounties\.map\(\(county\)/.test(hub));
check("the region page still renders its county names as text", /region\.counties\.map\(\(county\)/.test(region));

let failed = 0;
for (const r of out) {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? "  PASS" : "  FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
}
console.log(
  failed === 0
    ? "PASS: both coverage routes load the county map as a file, the file draws the component's 254 paths, fills, boundary and outline for every region, and the county names stay in the HTML as text."
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
