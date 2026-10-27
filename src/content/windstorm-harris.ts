/**
 * THE HARRIS COUNTY PART OF THE CATASTROPHE AREA, IN THE DEPARTMENT'S OWN WORDS.
 *
 * Robert's ruling, 2026-10-27 (issue #1, comment 6443269881, ruling 3): every
 * windstorm page says what TDI says, "certain cities east of State Highway 146
 * in Harris County (La Porte, Morgan's Point, Pasadena, Seabrook, Shoreacres)".
 *
 * Source: https://tdi.texas.gov/WIND/generalquestio.html, read 2026-10-27. On
 * that date the page named the same fourteen first tier counties as
 * FIRST_TIER_COASTAL in ./windstorm.ts, and this Harris sentence word for word.
 *
 * WHY THIS FILE HAS NO IMPORTS. ./windstorm.ts imports ./regions.ts, and the
 * region prose carries this sentence too, so a home inside windstorm.ts would
 * be a cycle. This file is the one home for the sentence; regions.ts,
 * windstorm-program.ts and services.ts render it, and the county tool answers
 * from it. The site used to say "the part of Harris County east of State
 * Highway 146", which is wider than the department's list: a property east of
 * the highway outside those five cities is not named.
 *
 * The cities are spelled as the department spells them. The Texas Windstorm
 * Insurance Association's overview writes "Shore Acres", and the insights that
 * quote the association keep its spelling, because they quote it.
 */
export const TDI_WINDSTORM_SOURCE = {
  url: "https://tdi.texas.gov/WIND/generalquestio.html",
  checked: "2026-10-27",
} as const;

export const HARRIS_DESIGNATED_CITIES = [
  "La Porte",
  "Morgan's Point",
  "Pasadena",
  "Seabrook",
  "Shoreacres",
] as const;

/** The department's phrase, built from the list so the two cannot disagree. */
export const HARRIS_DESIGNATION = `certain cities east of State Highway 146 in Harris County (${HARRIS_DESIGNATED_CITIES.join(", ")})`;
