import { regions } from "@/content/regions";
import { FIRST_TIER_COASTAL } from "@/content/windstorm";

/**
 * County derivation for a property address, and the windstorm flag that follows
 * from it.
 *
 * WHY THIS IS NOT GEOCODING, AND SAYS SO
 * --------------------------------------
 * Dispatch matches a technician's coverage counties against the county on a
 * file, and the TWIA flag decides which protocol applies. Both need the county
 * on the row, indexed, at intake. There is no geocoder in this stack and adding
 * one is a paid dependency and a network call on a form submit.
 *
 * So this is a lookup, and it is honest about being one. A city it knows resolves
 * with confidence "city". A city it does not know resolves to nothing and the
 * intake form makes the person choose from the 254, which is a two second
 * interaction and always correct. What it never does is guess.
 *
 * The county geometry in this repo cannot help here even though it is county
 * shaped: those paths are projected screen coordinates for an SVG, not latitude
 * and longitude, so a point in polygon test against them would be meaningless.
 * Recorded because it is the obvious idea and it is wrong.
 *
 * EVERY ANSWER IS VALIDATED AGAINST THE CANONICAL 254
 * ---------------------------------------------------
 * Whether it came from the table or from a person, the county is checked against
 * the list in src/content/regions.ts, which coverage-audit already holds to an
 * independent canonical list. A typo cannot reach the database and quietly
 * exclude a file from every dispatch query.
 */

/** The 254, from the compliance reviewed coverage data. */
export const TEXAS_COUNTIES: string[] = [...new Set(regions.flatMap((r) => r.counties))].sort();

const COUNTY_SET = new Set(TEXAS_COUNTIES.map((c) => c.toLowerCase()));

/** county name -> region slug, for showing a file its regional conditions. */
const REGION_OF = new Map<string, string>();
for (const region of regions) {
  for (const county of region.counties) REGION_OF.set(county.toLowerCase(), region.slug);
}

/**
 * Cities this platform can resolve without asking.
 *
 * DELIBERATELY PARTIAL, AND WEIGHTED TO THE COAST
 * -----------------------------------------------
 * Texas has over 1,200 incorporated places. This holds the large ones and, more
 * importantly, the coastal ones, because the coast is where the county decides
 * whether a windstorm certificate is required at all. Getting Corpus Christi
 * wrong has consequences that getting a Panhandle village wrong does not.
 *
 * A city that is not here is not a failure. It means the person picks the county,
 * which they can always do and which is always right.
 *
 * Some names are genuinely ambiguous across counties. Those are absent on
 * purpose: an entry here is a claim that the answer is unambiguous.
 */
const CITY_TO_COUNTY: Record<string, string> = {
  // Coastal Bend and the designated area, the part that matters most
  "corpus christi": "Nueces",
  "port aransas": "Nueces",
  "robstown": "Nueces",
  "aransas pass": "San Patricio",
  portland: "San Patricio",
  sinton: "San Patricio",
  ingleside: "San Patricio",
  rockport: "Aransas",
  fulton: "Aransas",
  kingsville: "Kleberg",
  "port lavaca": "Calhoun",
  "port o'connor": "Calhoun",
  refugio: "Refugio",
  woodsboro: "Refugio",
  victoria: "Victoria",
  beeville: "Bee",
  goliad: "Goliad",
  cuero: "DeWitt",
  yoakum: "DeWitt",
  gonzales: "Gonzales",
  "port isabel": "Cameron",
  "south padre island": "Cameron",
  brownsville: "Cameron",
  harlingen: "Cameron",
  "san benito": "Cameron",
  raymondville: "Willacy",
  "port arthur": "Jefferson",
  beaumont: "Jefferson",
  nederland: "Jefferson",
  "groves": "Jefferson",
  galveston: "Galveston",
  "texas city": "Galveston",
  "league city": "Galveston",
  friendswood: "Galveston",
  "la marque": "Galveston",
  dickinson: "Galveston",
  "santa fe": "Galveston",
  freeport: "Brazoria",
  "lake jackson": "Brazoria",
  angleton: "Brazoria",
  clute: "Brazoria",
  pearland: "Brazoria",
  alvin: "Brazoria",
  bayCity: "Matagorda",
  "bay city": "Matagorda",
  palacios: "Matagorda",
  anahuac: "Chambers",
  winnie: "Chambers",

  // Greater Houston
  houston: "Harris",
  pasadena: "Harris",
  baytown: "Harris",
  "sugar land": "Fort Bend",
  "missouri city": "Fort Bend",
  richmond: "Fort Bend",
  rosenberg: "Fort Bend",
  katy: "Harris",
  conroe: "Montgomery",
  "the woodlands": "Montgomery",
  spring: "Harris",
  humble: "Harris",
  tomball: "Harris",
  cypress: "Harris",
  "league city tx": "Galveston",

  // Dallas Fort Worth
  dallas: "Dallas",
  "fort worth": "Tarrant",
  arlington: "Tarrant",
  plano: "Collin",
  frisco: "Collin",
  mckinney: "Collin",
  allen: "Collin",
  irving: "Dallas",
  garland: "Dallas",
  mesquite: "Dallas",
  richardson: "Dallas",
  denton: "Denton",
  lewisville: "Denton",
  "flower mound": "Denton",
  "grand prairie": "Dallas",
  mansfield: "Tarrant",
  keller: "Tarrant",
  euless: "Tarrant",
  bedford: "Tarrant",
  hurst: "Tarrant",
  "north richland hills": "Tarrant",
  waxahachie: "Ellis",
  "cedar hill": "Dallas",
  desoto: "Dallas",
  rockwall: "Rockwall",

  // Austin and Central
  austin: "Travis",
  "round rock": "Williamson",
  georgetown: "Williamson",
  "cedar park": "Williamson",
  leander: "Williamson",
  pflugerville: "Travis",
  "san marcos": "Hays",
  kyle: "Hays",
  buda: "Hays",
  bastrop: "Bastrop",
  waco: "McLennan",
  temple: "Bell",
  killeen: "Bell",
  belton: "Bell",
  "copperas cove": "Coryell",
  "college station": "Brazos",
  bryan: "Brazos",

  // San Antonio and the Hill Country
  "san antonio": "Bexar",
  "new braunfels": "Comal",
  schertz: "Guadalupe",
  seguin: "Guadalupe",
  boerne: "Kendall",
  kerrville: "Kerr",
  fredericksburg: "Gillespie",
  "san angelo": "Tom Green",
  uvalde: "Uvalde",
  "del rio": "Val Verde",

  // Rio Grande Valley and South
  mcallen: "Hidalgo",
  edinburg: "Hidalgo",
  mission: "Hidalgo",
  pharr: "Hidalgo",
  weslaco: "Hidalgo",
  laredo: "Webb",
  "eagle pass": "Maverick",
  alice: "Jim Wells",
  falfurrias: "Brooks",

  // West Texas and the Panhandle
  "el paso": "El Paso",
  midland: "Midland",
  odessa: "Ector",
  lubbock: "Lubbock",
  amarillo: "Potter",
  abilene: "Taylor",
  "wichita falls": "Wichita",
  "big spring": "Howard",
  plainview: "Hale",
  pampa: "Gray",
  borger: "Hutchinson",

  // East Texas
  tyler: "Smith",
  longview: "Gregg",
  marshall: "Harrison",
  texarkana: "Bowie",
  nacogdoches: "Nacogdoches",
  lufkin: "Angelina",
  paris: "Lamar",
  sherman: "Grayson",
  denison: "Grayson",
  huntsville: "Walker",
  "sulphur springs": "Hopkins",
};

export type CountyResolution = {
  county: string | null;
  /** How the answer was reached, so the form can say so rather than imply certainty. */
  source: "explicit" | "city" | "unknown";
  valid: boolean;
};

/**
 * Resolve a county from what intake knows.
 *
 * An explicit choice always wins. A person looking at the property knows more
 * than a lookup table, and overriding them would be the table asserting
 * authority it does not have.
 */
export function resolveCounty(input: { city?: string | null; county?: string | null }): CountyResolution {
  const explicit = (input.county ?? "").trim();
  if (explicit) {
    const canonical = canonicalCounty(explicit);
    return { county: canonical, source: "explicit", valid: canonical !== null };
  }

  const city = (input.city ?? "").trim().toLowerCase();
  if (city && CITY_TO_COUNTY[city]) {
    const canonical = canonicalCounty(CITY_TO_COUNTY[city]);
    return { county: canonical, source: "city", valid: canonical !== null };
  }

  return { county: null, source: "unknown", valid: false };
}

/** The canonically spelled county, or null if it is not one of the 254. */
export function canonicalCounty(name: string): string | null {
  const key = name.trim().replace(/\s+county$/i, "").toLowerCase();
  if (!COUNTY_SET.has(key)) return null;
  return TEXAS_COUNTIES.find((c) => c.toLowerCase() === key) ?? null;
}

/**
 * Whether a county sits in the TDI designated catastrophe area.
 *
 * HARRIS IS NOT A YES OR A NO
 * ---------------------------
 * The designated area is fourteen whole counties plus the part of Harris County
 * east of State Highway 146. A county name cannot answer that, and a platform
 * that returned true for all of Harris would put a windstorm protocol on files
 * in west Houston, while false would miss the ship channel entirely.
 *
 * So Harris returns "check", and the intake screen asks. Anything else is a
 * decision the software is not entitled to make from the data it has.
 */
export type TwiaStatus = "designated" | "not_designated" | "check";

export function twiaStatus(county: string | null): TwiaStatus {
  if (!county) return "not_designated";
  const canonical = canonicalCounty(county);
  if (!canonical) return "not_designated";
  if (canonical === "Harris") return "check";
  return (FIRST_TIER_COASTAL as readonly string[]).includes(canonical) ? "designated" : "not_designated";
}

/** The coverage region a county belongs to, for showing regional conditions. */
export function regionForCounty(county: string | null): string | null {
  if (!county) return null;
  return REGION_OF.get(county.trim().toLowerCase()) ?? null;
}

/** Cities the table can resolve, for the intake form's hint text. */
export const RESOLVABLE_CITY_COUNT = Object.keys(CITY_TO_COUNTY).length;
