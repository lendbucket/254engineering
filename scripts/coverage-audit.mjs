// Coverage audit. Proves the central claim of this brand.
//
//   BASE_URL=http://localhost:3225 node scripts/coverage-audit.mjs
//
// WHY A WHOLE AUDIT FOR ONE NUMBER
// --------------------------------
// The firm is named 254 Engineering Services and says it serves all 254 Texas
// counties. That is the one claim on this site that is checkable by anybody in
// about a minute, which makes it the most expensive one to get wrong. A region
// list that quietly loses Kenedy County, or lists Jim Hogg twice and Jim Wells
// not at all, still renders a page that looks complete and still counts to a
// number close enough that nobody notices.
//
// So this checks the coverage data against a canonical list of the counties of
// Texas held below, in both directions: nothing missing, nothing invented,
// nothing duplicated. Then it checks the rendered pages, because data being
// correct and the page displaying it correctly are two different facts.
const BASE = process.env.BASE_URL || "http://localhost:3225";

/**
 * The 254 counties of Texas.
 *
 * Kept here rather than imported from src/content/regions.ts on purpose. An
 * audit that derives its expectation from the thing it is auditing proves only
 * that the file is self consistent, which it would be with four counties
 * missing. This list is the independent second source that makes the check mean
 * something.
 */
const TEXAS_COUNTIES = [
  "Anderson", "Andrews", "Angelina", "Aransas", "Archer", "Armstrong", "Atascosa", "Austin",
  "Bailey", "Bandera", "Bastrop", "Baylor", "Bee", "Bell", "Bexar", "Blanco", "Borden", "Bosque",
  "Bowie", "Brazoria", "Brazos", "Brewster", "Briscoe", "Brooks", "Brown", "Burleson", "Burnet",
  "Caldwell", "Calhoun", "Callahan", "Cameron", "Camp", "Carson", "Cass", "Castro", "Chambers",
  "Cherokee", "Childress", "Clay", "Cochran", "Coke", "Coleman", "Collin", "Collingsworth",
  "Colorado", "Comal", "Comanche", "Concho", "Cooke", "Coryell", "Cottle", "Crane", "Crockett",
  "Crosby", "Culberson", "Dallam", "Dallas", "Dawson", "Deaf Smith", "Delta", "Denton", "DeWitt",
  "Dickens", "Dimmit", "Donley", "Duval", "Eastland", "Ector", "Edwards", "El Paso", "Ellis",
  "Erath", "Falls", "Fannin", "Fayette", "Fisher", "Floyd", "Foard", "Fort Bend", "Franklin",
  "Freestone", "Frio", "Gaines", "Galveston", "Garza", "Gillespie", "Glasscock", "Goliad",
  "Gonzales", "Gray", "Grayson", "Gregg", "Grimes", "Guadalupe", "Hale", "Hall", "Hamilton",
  "Hansford", "Hardeman", "Hardin", "Harris", "Harrison", "Hartley", "Haskell", "Hays", "Hemphill",
  "Henderson", "Hidalgo", "Hill", "Hockley", "Hood", "Hopkins", "Houston", "Howard", "Hudspeth",
  "Hunt", "Hutchinson", "Irion", "Jack", "Jackson", "Jasper", "Jeff Davis", "Jefferson",
  "Jim Hogg", "Jim Wells", "Johnson", "Jones", "Karnes", "Kaufman", "Kendall", "Kenedy", "Kent",
  "Kerr", "Kimble", "King", "Kinney", "Kleberg", "Knox", "La Salle", "Lamar", "Lamb", "Lampasas",
  "Lavaca", "Lee", "Leon", "Liberty", "Limestone", "Lipscomb", "Live Oak", "Llano", "Loving",
  "Lubbock", "Lynn", "Madison", "Marion", "Martin", "Mason", "Matagorda", "Maverick", "McCulloch",
  "McLennan", "McMullen", "Medina", "Menard", "Midland", "Milam", "Mills", "Mitchell", "Montague",
  "Montgomery", "Moore", "Morris", "Motley", "Nacogdoches", "Navarro", "Newton", "Nolan", "Nueces",
  "Ochiltree", "Oldham", "Orange", "Palo Pinto", "Panola", "Parker", "Parmer", "Pecos", "Polk",
  "Potter", "Presidio", "Rains", "Randall", "Reagan", "Real", "Red River", "Reeves", "Refugio",
  "Roberts", "Robertson", "Rockwall", "Runnels", "Rusk", "Sabine", "San Augustine", "San Jacinto",
  "San Patricio", "San Saba", "Schleicher", "Scurry", "Shackelford", "Shelby", "Sherman", "Smith",
  "Somervell", "Starr", "Stephens", "Sterling", "Stonewall", "Sutton", "Swisher", "Tarrant",
  "Taylor", "Terrell", "Terry", "Throckmorton", "Titus", "Tom Green", "Travis", "Trinity", "Tyler",
  "Upshur", "Upton", "Uvalde", "Val Verde", "Van Zandt", "Victoria", "Walker", "Waller", "Ward",
  "Washington", "Webb", "Wharton", "Wheeler", "Wichita", "Wilbarger", "Willacy", "Williamson",
  "Wilson", "Winkler", "Wise", "Wood", "Yoakum", "Young", "Zapata", "Zavala",
];

const REGION_SLUGS = [
  "coastal-bend",
  "greater-houston",
  "dallas-fort-worth",
  "san-antonio",
  "austin-central-texas",
  "rio-grande-valley",
  "west-texas",
  "panhandle",
];

const problems = [];
const notes = [];

// The canonical list has to be right before it can judge anything else.
if (TEXAS_COUNTIES.length !== 254) {
  problems.push(
    `the canonical list in this audit holds ${TEXAS_COUNTIES.length} counties, not 254; fix the audit before trusting it`,
  );
}

function visibleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * The same text as one line, for phrase matching.
 *
 * Comments are stripped rather than left in place, because React separates
 * adjacent text nodes with `<!-- -->` and an interpolated count therefore renders
 * as `254<!-- --> counties listed`. Searching raw HTML for the sentence finds
 * nothing and reports a correct page as broken, which is what this audit did on
 * its first run.
 */
function flatText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * County names as rendered in a list.
 *
 * Matched against whole lines rather than searched for as substrings, because
 * "Houston" appears in Greater Houston prose on four pages and "Austin" appears
 * in the Austin region name. A substring search would report both as present in
 * the county list when neither had been listed.
 */
function listedCounties(html) {
  const lines = visibleText(html)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const set = new Set();
  for (const line of lines) {
    if (TEXAS_COUNTIES.includes(line)) set.add(line);
  }
  return set;
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, html: await res.text() };
}

// ---------- region pages ----------

const perRegion = new Map();

for (const slug of REGION_SLUGS) {
  const { status, html } = await get(`/coverage/${slug}`);
  if (status !== 200) {
    problems.push(`/coverage/${slug}: HTTP ${status}`);
    continue;
  }
  const counties = listedCounties(html);
  perRegion.set(slug, counties);

  // A region page that renders its own wind, soil, and permitting sections is
  // the difference between coverage and doorway content. Asserted, because a
  // template that silently drops a section still renders a page that looks fine.
  for (const heading of ["Wind", "Soil", "Permitting"]) {
    if (!html.includes(`>${heading}<`)) {
      problems.push(`/coverage/${slug}: no ${heading} section`);
    }
  }
  if (counties.size === 0) problems.push(`/coverage/${slug}: no counties listed on the page`);
}

// ---------- the union ----------

const union = new Map();
for (const [slug, counties] of perRegion) {
  for (const county of counties) {
    if (!union.has(county)) union.set(county, []);
    union.get(county).push(slug);
  }
}

const missing = TEXAS_COUNTIES.filter((c) => !union.has(c));
const invented = [...union.keys()].filter((c) => !TEXAS_COUNTIES.includes(c));
const duplicated = [...union.entries()].filter(([, where]) => where.length > 1);

if (missing.length) problems.push(`${missing.length} county(ies) appear on no region page: ${missing.join(", ")}`);
if (invented.length) problems.push(`${invented.length} name(s) are not Texas counties: ${invented.join(", ")}`);
for (const [county, where] of duplicated) {
  problems.push(`${county} appears in more than one region: ${where.join(", ")}`);
}

notes.push(`${union.size} distinct counties across ${perRegion.size} region pages`);

// ---------- the hub ----------

const hub = await get("/coverage");
if (hub.status !== 200) {
  problems.push(`/coverage: HTTP ${hub.status}`);
} else {
  const hubCounties = listedCounties(hub.html);
  const hubMissing = TEXAS_COUNTIES.filter((c) => !hubCounties.has(c));
  if (hubMissing.length) {
    problems.push(
      `/coverage lists ${hubCounties.size} of 254 counties; missing: ${hubMissing.slice(0, 12).join(", ")}${hubMissing.length > 12 ? `, and ${hubMissing.length - 12} more` : ""}`,
    );
  } else {
    notes.push("the coverage hub lists every one of the 254 counties");
  }

  // The hub states a number in prose. A number in prose that disagrees with the
  // list beneath it is exactly the kind of stale claim this audit exists for.
  if (!flatText(hub.html).includes("254 counties listed")) {
    problems.push("/coverage: the rendered county count sentence is missing or has changed wording");
  }
}

// ---------- no county pages ----------

// County pages are deliberately not built. A stray one is doorway content, and
// the point of asserting it is that adding a route is easy and remembering the
// policy three months from now is not.
for (const probe of ["/coverage/harris", "/coverage/travis-county", "/counties/bexar"]) {
  const { status } = await get(probe);
  if (status === 200) problems.push(`${probe} returns 200; individual county pages are not to be shipped`);
}
notes.push("no individual county pages are reachable");

// ---------- report ----------

console.log("=== COVERAGE AUDIT ===");
console.log(`checked ${BASE} against a canonical list of ${TEXAS_COUNTIES.length} Texas counties\n`);
for (const [slug, counties] of perRegion) {
  console.log(`  ${slug.padEnd(22)} ${String(counties.size).padStart(3)} counties`);
}
console.log("");
for (const note of notes) console.log(`  ${note}`);

console.log("\n=== RESULT ===");
if (problems.length === 0) {
  console.log("PASS: every Texas county appears exactly once, and the hub renders all 254.");
} else {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exitCode = 1;
}
