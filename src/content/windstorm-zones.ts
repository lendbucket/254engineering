import { FIRST_TIER_COASTAL } from "./windstorm";
import { HARRIS_DESIGNATED_CITIES } from "./windstorm-harris";

/**
 * THE 2006 CODE WIND ZONES, COUNTY BY COUNTY.
 *
 * Robert, 2026-11-01, round 3 item d and his answer 1: fold the county zone
 * table into /windstorm/catastrophe-area, with the Port Arthur fix and the WPI-8
 * price link, no new URL, and keep the sources list.
 *
 * Every entry is a selection of the communities the department's own map page
 * for that county lists, read on 2026-11-01. Each page was last updated in
 * February or March 2020, and each describes the zones under the 2006 IRC and
 * IBC with the Texas revisions, which the department applied from January 1,
 * 2008 to August 31, 2020. Since April 1, 2026 new work is certified to the
 * 2024 codes with the wind speed set for each structure, so these zones describe
 * what a certificate or a drawing from those years was designed to, not what new
 * work is designed to.
 *
 * KEYED BY COUNTY, NOT A SECOND LIST. src/content/windstorm.ts holds the
 * fourteen counties once, and src/content/windstorm-program.ts records why a
 * second typed list is the defect. So the zones are a record keyed by county
 * name, and the module throws at load if its keys and FIRST_TIER_COASTAL ever
 * disagree, which fails the build rather than printing a table that has lost or
 * gained a county. Harris County's cities are read from HARRIS_DESIGNATED_CITIES
 * for the same reason.
 *
 * "None listed" means the county's page lists no community in that zone. The
 * map image on the page may show more, and it was not read as an image.
 */

export type ZoneRow = {
  seaward: string;
  inlandI: string;
  inlandII: string;
  /** The department's map page file name, under https://www.tdi.texas.gov/wind/maps/ */
  page: string;
};

export const LEGACY_ZONES: Record<string, ZoneRow> = {
  Aransas: {
    seaward: "Port Aransas",
    inlandI: "Rockport, Fulton, Aransas Pass, Holiday Beach",
    inlandII: "None: all of the county is east of the dividing line",
    page: "aransas.html",
  },
  Brazoria: {
    seaward: "Quintana, Surfside Beach",
    inlandI: "Angleton, Freeport, Lake Jackson, Clute, Sweeny",
    inlandII: "Alvin, Pearland, Manvel, West Columbia, Iowa Colony",
    page: "brazoria.html",
  },
  Calhoun: {
    seaward: "None listed",
    inlandI: "Port Lavaca, Port O'Connor, Seadrift, Point Comfort",
    inlandII: "None listed",
    page: "calhoun.html",
  },
  Cameron: {
    seaward: "South Padre Island",
    inlandI: "Brownsville, Port Isabel, Laguna Vista, Los Fresnos",
    inlandII: "Harlingen, San Benito, La Feria, Rancho Viejo",
    page: "cameron.html",
  },
  Chambers: {
    seaward: "None listed",
    inlandI: "Anahuac, Mont Belvieu, Winnie, Smith Point",
    inlandII: "None listed",
    page: "chambers.html",
  },
  Galveston: {
    seaward: "Galveston, Crystal Beach, Jamaica Beach, Port Bolivar, Hitchcock",
    inlandI: "Texas City, League City, Dickinson, Kemah, Santa Fe",
    inlandII: "Friendswood",
    page: "galvesto.html",
  },
  Jefferson: {
    /* Robert's fix: Port Arthur is listed under Seaward AND Inland I on this page. */
    seaward: "Part of Port Arthur, Sabine Pass, Pleasure Island",
    inlandI: "Groves, Nederland, Port Neches, Port Arthur",
    inlandII: "Beaumont, Bevil Oaks, China, Nome",
    page: "jefferso.html",
  },
  Kenedy: {
    seaward: "Padre Island National Seashore",
    inlandI: "None listed",
    inlandII: "Sarita, Armstrong, Norias",
    page: "kenedy.html",
  },
  Kleberg: {
    seaward: "Padre Island National Seashore",
    inlandI: "Loyola Beach, Riviera Beach, Kingsville NAS",
    inlandII: "Kingsville, Riviera, Ricardo",
    page: "kleberg.html",
  },
  Matagorda: {
    seaward: "None listed",
    inlandI: "Palacios, Matagorda, Sargent, Collegeport",
    inlandII: "Bay City, Van Vleck, Blessing, Markham",
    page: "matagord.html",
  },
  Nueces: {
    seaward: "Port Aransas, Mustang Island State Park, part of Corpus Christi",
    inlandI: "Corpus Christi, Portland, Flour Bluff, Annaville",
    inlandII: "Robstown, Bishop, Driscoll, Agua Dulce",
    page: "nueces.html",
  },
  Refugio: {
    seaward: "None listed",
    inlandI: "Austwell, Tivoli, Bayside",
    inlandII: "Refugio, Woodsboro",
    page: "refugio.html",
  },
  "San Patricio": {
    seaward: "None listed",
    inlandI: "Portland, Ingleside, Aransas Pass, Gregory, Taft",
    inlandII: "Sinton, Mathis, Odem",
    page: "sanpatr.html",
  },
  Willacy: {
    seaward: "Padre Island National Seashore",
    inlandI: "Port Mansfield, San Perlita",
    inlandII: "Raymondville, Lyford, Sebastian",
    page: "willacy.html",
  },
};

const missing = FIRST_TIER_COASTAL.filter((c) => !(c in LEGACY_ZONES));
const extra = Object.keys(LEGACY_ZONES).filter((c) => !(FIRST_TIER_COASTAL as readonly string[]).includes(c));
if (missing.length > 0 || extra.length > 0) {
  throw new Error(
    `windstorm-zones: the zone table and FIRST_TIER_COASTAL disagree (missing ${JSON.stringify(missing)}, extra ${JSON.stringify(extra)})`,
  );
}

export const TDI_MAPS = "https://www.tdi.texas.gov/wind/maps/";

/**
 * Table rows in FIRST_TIER_COASTAL order, then the Harris County cities. Each
 * county's name links its own map page, which is that row's source: fifteen
 * separate entries in the source list would have added about 1,600px at phone
 * width to a page measured at 8,700px, with the table already adding about
 * 4,000, against the 16,000px ceiling.
 */
export function legacyZoneRows(): string[][] {
  const rows = FIRST_TIER_COASTAL.map((county) => {
    const z = LEGACY_ZONES[county];
    return [`[${county}](${TDI_MAPS}${z.page})`, z.seaward, z.inlandI, z.inlandII];
  });
  rows.push([`[Harris (${HARRIS_DESIGNATED_CITIES.length} cities)](${TDI_MAPS}harris.html)`, "None", HARRIS_DESIGNATED_CITIES.join(", "), "None"]);
  return rows;
}

/** The sources the section rests on, each with the claim it supports. */
export function legacyZoneSources(): { label: string; url: string; supports: string }[] {
  return [
    {
      label: "Texas Department of Insurance, building codes by zone",
      url: "https://tdi.texas.gov/wind/geninfo.html",
      supports: "The code editions and the dates each applied, including the 2006 IRC and IBC with the Texas revisions from January 1, 2008 to August 31, 2020, and the 2024 codes from April 1, 2026.",
    },
    {
      label: "Texas Department of Insurance, adoption of the 2024 building codes",
      url: "https://www.tdi.texas.gov/wind/adopted-codes.html",
      supports: "That wind speed is now determined for each structure from its location, and that every designated county is in the program in full except Harris County.",
    },
    {
      label: "Texas Department of Insurance, legacy designated catastrophe area county maps",
      url: `${TDI_MAPS}Legacy-designated-catastrophe-area-county-maps.html`,
      supports: `The fifteen county map pages for the 2003 and 2006 building codes, each linked from its county's name in the table: each county's zones, design wind speeds, communities, split city notes and dividing line, and the Harris County cities, all Inland I at 120 mph for work on or after June 1, 2008. Read on 2026-11-01.`,
    },
  ];
}
