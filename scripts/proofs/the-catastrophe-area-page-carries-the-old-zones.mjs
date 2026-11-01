/**
 * PROOF: /windstorm/catastrophe-area CARRIES THE 2006 CODE ZONES, COUNTY BY
 * COUNTY, AND NO NEW URL WAS MADE FOR THEM.
 *
 * Robert, 2026-11-01, round 3 item d and his answer 1: fold the county zone
 * table, with the Port Arthur fix and the WPI-8 price link, into
 * /windstorm/catastrophe-area. No new URL. Keep its sources list.
 *
 *   A  the page has one table, with a row per first tier county in the order
 *      FIRST_TIER_COASTAL holds them and a last row for the Harris cities,
 *      each county's name linking its own TDI map page
 *   B  Jefferson's Seaward cell reads "Part of Port Arthur" while its Inland I
 *      cell lists Port Arthur, and the prose says the Jefferson page has no
 *      note deciding which applies; Corpus Christi is treated the same way, with
 *      the Nueces note that does decide it
 *   C  the one link to the firm states both WPI-8 catalog prices
 *   D  the page keeps a sources list with the code pages and the county map index
 *   E  no /insights page and no route exists at the draft's URL
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-catastrophe-area-page-carries-the-old-zones.mjs
 */
import { existsSync } from "node:fs";

const { windstormPages } = await import("../../src/content/windstorm-program.ts");
const { FIRST_TIER_COASTAL } = await import("../../src/content/windstorm.ts");
const { HARRIS_DESIGNATED_CITIES } = await import("../../src/content/windstorm-harris.ts");
const { CATALOG } = await import("../../data/catalog.ts");
const { insights } = await import("../../src/content/insights.ts");

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok, note });
const dollars = (cents) => `$${(cents / 100).toLocaleString("en-US")}`;

const page = windstormPages.find((p) => p.slug === "catastrophe-area");
check("the catastrophe area page exists", Boolean(page));
const tabled = page.sections.filter((s) => s.table);
check("the page carries exactly one table", tabled.length === 1, `${tabled.length}`);
const section = tabled[0];
const rows = section.table.rows;

check("one row per first tier county plus the Harris cities", rows.length === FIRST_TIER_COASTAL.length + 1, `${rows.length}`);
FIRST_TIER_COASTAL.forEach((county, i) => {
  check(`row ${i + 1} is ${county}, linking its TDI map page`, rows[i][0].startsWith(`[${county}](https://www.tdi.texas.gov/wind/maps/`));
});
const harris = rows.at(-1);
check("the last row is the Harris cities, linking the Harris map", harris[0].startsWith("[Harris (") && harris[0].includes("maps/harris.html"));
check("its Inland I cell is the designated cities, read from the list", harris[2] === HARRIS_DESIGNATED_CITIES.join(", "));

const jefferson = rows[FIRST_TIER_COASTAL.indexOf("Jefferson")];
check("Jefferson's Seaward cell reads 'Part of Port Arthur'", jefferson[1].startsWith("Part of Port Arthur"), jefferson[1]);
check("Jefferson's Inland I cell lists Port Arthur", /\bPort Arthur\b/.test(jefferson[2]), jefferson[2]);
const nueces = rows[FIRST_TIER_COASTAL.indexOf("Nueces")];
check("Nueces's Seaward cell reads 'part of Corpus Christi'", nueces[1].includes("part of Corpus Christi"), nueces[1]);

const prose = section.body.join(" ");
check("the prose says the Jefferson page has no note deciding Port Arthur", prose.includes("Jefferson County lists Port Arthur under both Seaward and Inland I, and its page has no note saying which applies"));
check("the prose gives the Nueces note that holds Corpus Christi to Inland I", prose.includes("Nueces County lists Corpus Christi under both Seaward and Inland I, and its note holds the city to Inland I"));

for (const e of CATALOG.filter((x) => x.serviceSlug === "windstorm-wpi-8" && x.priceCents != null)) {
  check(`the firm link states ${e.name} at ${dollars(e.priceCents)}`, prose.includes(dollars(e.priceCents)));
}
check("the firm is linked once, at its WPI-8 page", (prose.match(/\]\(\/services\/windstorm-wpi-8\)/g) ?? []).length === 1);

check("the page keeps a sources list", Array.isArray(page.sources) && page.sources.length >= 3, `${page.sources?.length}`);
for (const url of ["https://tdi.texas.gov/wind/geninfo.html", "https://www.tdi.texas.gov/wind/adopted-codes.html", "https://www.tdi.texas.gov/wind/maps/Legacy-designated-catastrophe-area-county-maps.html"]) {
  check(`the sources list carries ${url}`, page.sources?.some((s) => s.url === url));
}

check("no /insights post exists at the draft's slug", !insights.some((p) => p.slug === "texas-windstorm-certification-by-county"));
check("no route exists at the draft's URL", !existsSync("src/app/(site)/insights/texas-windstorm-certification-by-county"));

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note ? ` (${x.note})` : ""}`);
}
console.log(
  failed === 0
    ? "PASS: /windstorm/catastrophe-area carries the 2006 code zones for every first tier county and the Harris cities, with Port Arthur and Corpus Christi stated as their pages state them, the WPI-8 catalog prices on its one firm link, and its sources; no new URL exists."
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
