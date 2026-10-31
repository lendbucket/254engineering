/**
 * PROOF: THE COUNTY MAP'S MARKUP STAYS LEAN, AND STILL DRAWS EVERY COUNTY.
 * 2026-10-30, after board 41118588757 measured /coverage/coastal-bend at LCP
 * 3402ms against the 3400ms ceiling, every sample over.
 *
 * Robert ruled at 09:26 that the map stays server rendered, so its markup was
 * made smaller without moving a point (see scripts/map-markup-audit.mjs, which
 * holds the points against what the live site drew). This proof holds the
 * size, so a later change cannot quietly put the 27KB back:
 *
 *   A  the standalone county group, as rendered, is under a byte bound set
 *      between the old size (61,365) and the new one (34,015)
 *   B  every county path is written with relative commands
 *   C  no county path carries its own fill or vector-effect on the standalone
 *      map; the group carries the fill and globals.css the vector-effect
 *   D  all 254 counties are drawn, in FIPS order, one path each
 *
 * The map draws no per county id or link: the coverage claim's county list is
 * the text on /coverage, which coverage-audit checks. So D is a count and an
 * order, not an id check.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-county-map-markup-stays-lean.mjs
 */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { TexasCountyMap } from "../../src/components/map/TexasCountyMap.tsx";
import { countyShapes } from "../../src/content/county-geometry.ts";

/** Set between the old standalone group (61,365 bytes) and the new (34,015). */
const MAX_GROUP_BYTES = 40000;

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok, note });

/**
 * Found by its hairline stroke, the way map-markup-audit finds it, and not by
 * the tx-counties class: a regression that dropped the class has to reach the
 * size and attribute checks below, not stop at "not found".
 */
function countyGroup(html) {
  const open = html.search(/<g stroke="[^"]+" stroke-width="0\.5"/);
  if (open === -1) return null;
  const close = html.indexOf("</g>", open);
  return close === -1 ? null : html.slice(open, close + 4);
}

for (const [label, props] of [
  ["standalone", {}],
  ["coastal-bend active", { activeRegion: "coastal-bend" }],
]) {
  const group = countyGroup(renderToStaticMarkup(createElement(TexasCountyMap, props)));
  check(`${label}: the county group is found`, group !== null);
  if (!group) continue;
  const bytes = Buffer.byteLength(group, "utf8");
  check(`${label}: A the county group is under ${MAX_GROUP_BYTES} bytes`, bytes < MAX_GROUP_BYTES, `${bytes} bytes`);
  const paths = [...group.matchAll(/<path ([^>]*?)\/?>/g)].map((m) => m[1]);
  check(`${label}: D 254 county paths are drawn`, paths.length === 254, `${paths.length}`);
  const ds = paths.map((a) => a.match(/\bd="([^"]+)"/)?.[1] ?? "");
  check(
    `${label}: D in FIPS order, one path per county`,
    ds.length === countyShapes.length && ds.every((d, i) => d === countyShapes[i].d),
  );
  check(
    `${label}: B every county path uses relative commands after its first move`,
    ds.every((d) => /^M[^MLlZz]*l/.test(d) && !/L/.test(d)),
  );
  check(
    `${label}: C no county path carries vector-effect`,
    paths.every((a) => !a.includes("vector-effect")),
  );
  const filled = paths.filter((a) => /\bfill=/.test(a)).length;
  check(
    `${label}: C only the active region's counties carry their own fill`,
    label === "standalone" ? filled === 0 : filled > 0 && filled < 254,
    `${filled} with a fill`,
  );
}

let failed = 0;
for (const r of out) {
  if (!r.ok) failed++;
  console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
}
if (failed === 0) {
  console.log(`PASS: ${out.length} checks. The county map's markup stays lean and still draws all 254 counties.`);
} else {
  console.log(`FAIL: ${failed} of ${out.length} checks.`);
  process.exit(1);
}
