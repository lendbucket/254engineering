/**
 * ONE SAMPLE COASTAL COUNTY PAGE, FOR ROBERT'S REVIEW. Run item 24, 2026-10-10.
 *
 * NOT A TEMPLATE THAT SHIPS. This branch does not merge: the page is noindex,
 * outside the sitemap, and exists so the operator can rule on whether county
 * pages are wanted on this brand, at what URL, and to what standard of
 * substance (CLAUDE.md section 5: true of this place specifically, and not
 * producible by find and replacing the name).
 *
 * EVERY FACT IS SOURCED, AND THE SOURCE IS BESIDE IT. Read 2026-10-10:
 *
 *   TSHA, Handbook of Texas, "Aransas County"
 *     https://www.tshaonline.org/handbook/entries/aransas-county
 *     "The county seat and largest city is Rockport."
 *     "Aransas County (P-18) is on the Gulf Coast northeast of Corpus Christi."
 *     "divided into three parts by Copano, St. Charles, and Aransas bays"
 *     Created from Refugio County in 1871.
 *   TDI, Windstorm, "Aransas County" (last updated 2/27/2020)
 *     https://tdi.texas.gov/WIND/maps/aransas.html
 *     Inland I: Aransas Pass, Copano Village, Estes, Fulton, Goose Island State
 *     Park, Holiday Beach, Lamar, Rockport. Seaward: Port Aransas. "All of
 *     Aransas County is east of the boundary line."
 *     ITS WIND SPEEDS ARE NOT USED: they are tied to the 2006 IBC/IRC, which
 *     TDI has replaced (below).
 *   TDI, Windstorm, adopted building codes (last updated 4/23/2026)
 *     https://www.tdi.texas.gov/wind/adopted-codes.html
 *     2024 IRC and IBC; "Starting April 1, 2026"; "The required wind speed must
 *     be determined for each structure based on the location of the structure."
 *   Tex. Ins. Code 2210.003: Aransas is a first tier coastal county (the
 *     statute src/content/insights-coastal.ts already cites).
 *   src/content/regions.ts, the compliance reviewed region copy: Hurricane
 *     Harvey made landfall near Rockport in 2017; Rockport runs its own
 *     building department.
 *
 * WHAT IS DELIBERATELY NOT HERE: population, a wind speed figure, flood zone
 * claims, and any named contractor, office or address, because nothing above
 * sources them.
 */
export type CountySample = {
  slug: string;
  regionSlug: string;
  name: string;
  title: string;
  description: string;
  h1: string;
  lede: string;
  place: string[];
  wind: string[];
  permitting: string[];
};

export const COUNTY_SAMPLE: CountySample = {
  slug: "aransas-county",
  regionSlug: "coastal-bend",
  name: "Aransas County",
  title: "Aransas County Windstorm Zones and Codes | 254 Engineering",
  description:
    "Aransas County sits inside the Texas windstorm catastrophe area. Which wind zone applies, what code governs, and who permits the work. Read before you build.",
  h1: "Aransas County: windstorm zones, codes and permitting",
  lede:
    "Aransas County is on the Gulf Coast northeast of Corpus Christi, and every part of it is inside the area where windstorm coverage through TWIA depends on a certificate of compliance.",
  place: [
    "Rockport is the county seat and the largest city. The county was divided from Refugio County in 1871, and Copano, St. Charles and Aransas bays split it into three parts, so a great deal of the county is bay frontage rather than open Gulf beach.",
    "Hurricane Harvey made landfall near Rockport in 2017, and it remains the event a reviewer in this county measures roof attachment and opening protection against.",
  ],
  wind: [
    "Aransas is one of the fourteen first tier coastal counties named in Texas Insurance Code section 2210.003, so construction and reroofing need a windstorm certificate of compliance before TWIA will write windstorm coverage.",
    "The Texas Department of Insurance places the whole county east of its inland boundary line. Its county page lists Rockport, Fulton, Aransas Pass, Copano Village, Estes, Holiday Beach, Lamar and Goose Island State Park in the Inland I zone, and Port Aransas as Seaward.",
    "The wind speed itself is no longer read from that page. Its figures were tied to the 2006 codes. From April 1, 2026, TDI certifies against the 2024 IRC and IBC and says the required wind speed must be determined for each structure from its location.",
  ],
  permitting: [
    "Rockport runs its own building department and inspects against the code edition it has adopted.",
    "A Rockport permit does not stand in for the state's windstorm certificate, or the certificate for the permit. One answers the city's adopted code and the other the code TDI certifies against, and a project in the city has to clear both.",
  ],
};
