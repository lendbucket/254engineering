/**
 * JSON-LD PRICES EQUAL THE CATALOG, AND THE ENTITY NODE SAYS WHERE AND WHO.
 * Robert's GEO ruling of 2026-10-31, item 2: "Service + Offer with price on
 * each service page from catalog.ts ... Preflight rule: JSON-LD prices equal
 * catalog.ts", with his answers 1, 2 and 5 (sameAs keeps the sibling brands,
 * coordinates are constants in business.ts and left out until he supplies
 * them, offers carry the price and no availability claim).
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/json-ld-prices-equal-the-catalog.mjs
 *
 * It needs no server, so the preflight runs it. The structured data is built
 * by the same functions the pages call. The catalog is the declaration the
 * offers are compared against, and the entity facts (the three places, the
 * registration) are literals here, never read from the config.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { serviceSchema, organizationSchema } = await import("../../src/lib/schema.tsx");
const { services } = await import("../../src/content/services.ts");
const { CATALOG } = await import("../../data/catalog.ts");
const { business } = await import("../../src/config/business.ts");

/* Every priced deliverable, as the schema states it, against the catalog. */
let compared = 0;
const mismatched = [];
const withAvailability = [];
for (const s of services) {
  const node = serviceSchema({ name: s.name, description: s.summary, path: `/services/${s.slug}`, serviceSlug: s.slug });
  const offers = [].concat(node.offers ?? []);
  const priced = CATALOG.filter((e) => e.serviceSlug === s.slug && e.priceCents !== null);
  if (offers.length !== priced.length) mismatched.push(`${s.slug}: ${offers.length} offers for ${priced.length} priced deliverables`);
  for (const entry of priced) {
    const offer = offers.find((o) => o.name === entry.name);
    compared += 1;
    if (!offer) mismatched.push(`${s.slug}: no offer for ${entry.name}`);
    else if (offer.price !== (entry.priceCents / 100).toFixed(2) || offer.priceCurrency !== "USD")
      mismatched.push(`${s.slug}: ${entry.name} offered at ${offer.price} ${offer.priceCurrency}, catalog ${entry.priceCents} cents`);
  }
  for (const o of offers) if ("availability" in o) withAvailability.push(`${s.slug}: ${o.name}`);
}
check(`every service page's Offer prices equal the catalog (${compared} priced deliverables)`, compared >= 8 && mismatched.length === 0, mismatched.join("; "));
check("no Offer claims availability", withAvailability.length === 0, withAvailability.join(", "));
const quoted = CATALOG.filter((e) => e.priceCents === null);
check(
  `a quoted deliverable gets no Offer (${quoted.length} quoted)`,
  quoted.every((e) => ![].concat(serviceSchema({ name: "x", description: "x", path: "/x", serviceSlug: e.serviceSlug }).offers ?? []).some((o) => o.name === e.name)),
);

/* No price typed into the JSON-LD builders: every figure comes through the catalog. */
const schemaSrc = readFileSync("src/lib/schema.tsx", "utf8");
check("schema.tsx types no price", !/price:\s*["'`]?\d/.test(schemaSrc) && !/priceCents:\s*\d/.test(schemaSrc));

/* The entity node. */
const org = organizationSchema();
check("the entity node is Organization, ProfessionalService and LocalBusiness", JSON.stringify(org["@type"]) === JSON.stringify(["Organization", "ProfessionalService", "LocalBusiness"]), JSON.stringify(org["@type"]));
const served = [].concat(org.areaServed ?? []).map((a) => a.name);
check("it serves San Antonio, Corpus Christi and Texas", ["San Antonio", "Corpus Christi", "Texas"].every((p) => served.includes(p)), JSON.stringify(served));
check("its identifier is the TBPELS registration F-29811", org.identifier?.value === "F-29811" && /TBPELS/.test(org.identifier?.propertyID ?? ""), JSON.stringify(org.identifier));
check("its address and hours are present", org.address?.streetAddress === "11103 San Pedro Ave" && Array.isArray(org.openingHoursSpecification));
check(
  "sameAs is the two sibling brands and nothing else until the Google profile is verified",
  JSON.stringify(org.sameAs) === JSON.stringify(["https://sealedengineering.com", "https://stampmyplans.com"]),
  JSON.stringify(org.sameAs),
);

/* The coordinates: constants in business.ts, absent until supplied, never from the environment. */
check("the coordinates are declared in business.ts", "latitude" in business && "longitude" in business);
const geoSet = business.latitude !== null && business.longitude !== null;
check(
  geoSet ? "they are set, so geo is two numbers" : "they are not supplied yet, so geo is left out",
  geoSet ? typeof org.geo?.latitude === "number" && typeof org.geo?.longitude === "number" : !("geo" in org),
  JSON.stringify(org.geo ?? null),
);
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
/* A READ, not a mention: process.env.NAME, process.env["NAME"], or env("NAME"). Comments may name it. */
const READ = /(process\.env(\.|\[\s*["'])|\benv\(\s*["'])FIRM_(LATITUDE|LONGITUDE)/;
const readers = walk("src").filter((f) => READ.test(readFileSync(f, "utf8")));
check("nothing in src reads FIRM_LATITUDE or FIRM_LONGITUDE", readers.length === 0, readers.join(", "));

/*
 * FAQPage ON EVERY PAGE WITH VISIBLE Q&A, FROM THE SAME ARRAY. Item 2: "FAQPage
 * on every page with visible Q&A, matching it exactly". The visible answers are
 * rendered by FaqBlock; a page passing it one array and faqSchema another, or
 * none, is a page whose markup describes answers that are not on it.
 */
const pages = walk("src/app").filter((f) => f.endsWith(".tsx") && readFileSync(f, "utf8").includes("<FaqBlock"));
const unmatched = pages.filter((f) => {
  const src = readFileSync(f, "utf8");
  const shown = [...src.matchAll(/<FaqBlock faqs=\{([^}]+)\}/g)].map((m) => m[1].trim());
  return shown.length === 0 || shown.some((expr) => !src.includes(`faqSchema(${expr})`));
});
check(`every page that renders visible Q&A emits FAQPage from the same array (${pages.length} pages)`, pages.length >= 8 && unmatched.length === 0, unmatched.join(", "));

console.log(wrong === 0 ? "PASS: JSON-LD prices equal the catalog; the entity node says where it serves and who registered it." : `FAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
