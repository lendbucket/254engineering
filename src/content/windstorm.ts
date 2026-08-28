import { regions } from "./regions";

/**
 * The first tier coastal counties, where a WPI-8 is required.
 *
 * NOT A NEW FACT, AND DELIBERATELY NOT TYPED FRESH
 * ------------------------------------------------
 * Every one of these fourteen is already named in the prose of
 * src/content/regions.ts, which is the compliance reviewed copy: seven in the
 * Coastal Bend, five in Greater Houston, and two in the Rio Grande Valley. That
 * prose is the source and this list is an index into it.
 *
 * Writing the list out again by hand would create a second place for the same
 * regulatory claim to live, and the two would eventually disagree about a county
 * line without anybody noticing which one was right. The assertion below fails
 * the build if a name here stops appearing in the region prose it came from.
 *
 * The approved v5 design names the same fourteen independently, which is a
 * useful cross check rather than a source: the design and the content data agree.
 */
export const FIRST_TIER_COASTAL = [
  "Aransas",
  "Brazoria",
  "Calhoun",
  "Cameron",
  "Chambers",
  "Galveston",
  "Jefferson",
  "Kenedy",
  "Kleberg",
  "Matagorda",
  "Nueces",
  "Refugio",
  "San Patricio",
  "Willacy",
] as const;

/**
 * Each of the fourteen has to be a real Texas county in the coverage data, and
 * has to be named in the windstorm prose of the region that holds it.
 *
 * This runs at module scope, so a county quietly dropped from the region prose
 * fails the build rather than leaving a regulatory list that cites a source no
 * longer saying it.
 */
const allCounties = new Set(regions.flatMap((r) => r.counties));
const windstormProse = regions
  .flatMap((r) => [...r.wind, ...r.permitting])
  .join(" ");

for (const county of FIRST_TIER_COASTAL) {
  if (!allCounties.has(county)) {
    throw new Error(
      `windstorm.ts: "${county}" is listed as a first tier coastal county but is not in the coverage data.`,
    );
  }
  if (!windstormProse.includes(county)) {
    throw new Error(
      `windstorm.ts: "${county}" is listed as a first tier coastal county but no region's wind or permitting prose names it. ` +
        `That prose is the source for this list; if the claim changed there, change it here too.`,
    );
  }
}

export const FIRST_TIER_COUNT = FIRST_TIER_COASTAL.length;
