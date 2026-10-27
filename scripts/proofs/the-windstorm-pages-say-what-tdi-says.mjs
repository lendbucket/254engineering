/**
 * THE WINDSTORM PAGES AND THE COUNTY CHECK SAY WHAT TDI SAYS.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-windstorm-pages-say-what-tdi-says.mjs
 *
 * Robert's ruling 3 of 2026-10-27 (issue #1, comment 6443269881): every
 * windstorm page says what TDI says, "certain cities east of State Highway 146
 * in Harris County (La Porte, Morgan's Point, Pasadena, Seabrook, Shoreacres)",
 * and the county tool is built against that wording.
 *
 * THE EXPECTATIONS ARE PINNED HERE AS LITERALS, read off
 * https://tdi.texas.gov/WIND/generalquestio.html on 2026-10-27, and never
 * imported from the code under test: a proof that compared the sentence to
 * itself could not fail. If TDI changes its list, this proof is edited on
 * purpose, after reading the page again, and the source date moves with it.
 *
 * No database and no network.
 */

const TDI_HARRIS = "certain cities east of State Highway 146 in Harris County (La Porte, Morgan's Point, Pasadena, Seabrook, Shoreacres)";
const TDI_CITIES = ["La Porte", "Morgan's Point", "Pasadena", "Seabrook", "Shoreacres"];
const TDI_FIRST_TIER = [
  "Aransas", "Brazoria", "Calhoun", "Cameron", "Chambers", "Galveston", "Jefferson",
  "Kenedy", "Kleberg", "Matagorda", "Nueces", "Refugio", "San Patricio", "Willacy",
];
const OLD_WORDING = /the part of Harris County east of State Highway 146|Harris County east of State Highway 146\./;

const { HARRIS_DESIGNATION, TDI_WINDSTORM_SOURCE } = await import("../../src/content/windstorm-harris.ts");
const { FIRST_TIER_COASTAL } = await import("../../src/content/windstorm.ts");
const { windstormCountyAnswer, windstormCountyAnswers } = await import("../../src/content/windstorm-county-tool.ts");
const { windstormPages, windstormHub } = await import("../../src/content/windstorm-program.ts");
const { regions } = await import("../../src/content/regions.ts");
const { services } = await import("../../src/content/services.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

console.log("The sentence");
check("the site's Harris sentence is TDI's, word for word", HARRIS_DESIGNATION === TDI_HARRIS, HARRIS_DESIGNATION);
check("the source names TDI's page and the date it was read", TDI_WINDSTORM_SOURCE.url === "https://tdi.texas.gov/WIND/generalquestio.html" && TDI_WINDSTORM_SOURCE.checked === "2026-10-27");
check(
  "the first tier list is TDI's fourteen, in order",
  JSON.stringify([...FIRST_TIER_COASTAL]) === JSON.stringify(TDI_FIRST_TIER),
  [...FIRST_TIER_COASTAL].join(", "),
);

console.log("The pages");
const area = windstormPages.find((p) => p.slug === "catastrophe-area");
const areaText = JSON.stringify(area);
check("the catastrophe area page carries TDI's sentence", areaText.includes(TDI_HARRIS));
check("and carries the county check", area?.countyCheck === true);
const wpi8 = services.find((s) => s.slug === "windstorm-wpi-8");
check("the WPI-8 capability page's county answer carries it", JSON.stringify(wpi8?.faqs ?? []).includes(TDI_HARRIS));
const houston = regions.find((r) => r.wind.some((w) => w.includes("Harris")));
check("the Greater Houston region's windstorm prose carries it", JSON.stringify(houston?.wind ?? []).includes(TDI_HARRIS), houston?.slug ?? "no region");

const rendered = JSON.stringify({ windstormPages, windstormHub, regions, services });
const stale = rendered.match(OLD_WORDING);
check("no windstorm, region or service page keeps the old wording", stale === null, stale ? stale[0] : "");

console.log("The county check");
for (const county of TDI_FIRST_TIER) {
  const a = windstormCountyAnswer(county);
  check(`${county} is designated`, a?.status === "designated" && a.text.startsWith(`${county} County is one of the 14`), a?.status ?? "null");
}
for (const county of ["Travis", "Bexar", "Fort Bend"]) {
  const a = windstormCountyAnswer(county);
  check(`${county}, inland, is not designated`, a?.status === "not-designated" && a.text.includes("outside the designated catastrophe area"), a?.status ?? "null");
}
const harris = windstormCountyAnswer("Harris");
check("Harris is split, not designated and not refused", harris?.status === "part");
check("the Harris answer carries TDI's sentence", harris?.text.includes(TDI_HARRIS) === true);
for (const city of TDI_CITIES) check(`and names ${city}`, harris?.text.includes(city) === true);
check("and says the county alone cannot settle it", /county alone cannot settle/.test(harris?.text ?? ""));
check("a county typed with its suffix and in lower case is answered", windstormCountyAnswer("harris county")?.county === "Harris");
check("a name that is not a Texas county is not answered", windstormCountyAnswer("Atlantis") === null);

const all = windstormCountyAnswers();
check("every one of the 254 counties is answered once", all.length === 254 && new Set(all.map((a) => a.county)).size === 254, String(all.length));
check(
  "exactly fourteen are designated and one is split",
  all.filter((a) => a.status === "designated").length === 14 && all.filter((a) => a.status === "part").length === 1,
);
const rogue = all.filter((a) => /we |our |order a|schedule an/i.test(a.text));
check("no answer makes a claim about the firm's services", rogue.length === 0, rogue.map((a) => a.county).join(", "));

console.log(wrong === 0 ? "\nPASS: the windstorm pages and the county check say what TDI says" : `\nFAIL: ${wrong} check(s)`);
process.exit(wrong === 0 ? 0 : 1);
