/**
 * PREFLIGHT RULE: A SERVICE PAGE TITLE'S PRICE IS THE CATALOG'S PRICE.
 *
 * Robert, 2026-11-01, round 3 item e: "Preflight rule: a service page title
 * price must equal catalog.ts."
 *
 * The titles are built by pricedTitle() from data/catalog.ts, so comparing the
 * built title to the catalog would agree by construction (CLAUDE.md section 7,
 * the tautological check). So this rule asks three things that can each fail:
 *
 *   A  every service title that names a price names exactly the lowest price
 *      the catalog states for that line, compared figure against figure
 *   B  every priced line's title names a price, and a quoted line's names none
 *   C  no title in src/content/services.ts is a typed string: each is a
 *      pricedTitle() call, so the price cannot be typed back in beside it
 *
 * And for the descriptions that carry the catalog's wording:
 *   D  each states the catalog price, the catalog turnaround verbatim, and
 *      "sealed by a licensed Texas PE"
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/a-service-title-price-is-the-catalog-price.mjs
 */
import { readFileSync } from "node:fs";

const { services } = await import("../../src/content/services.ts");
const { CATALOG } = await import("../../data/catalog.ts");

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok, note });
const dollars = (cents) => `$${(cents / 100).toLocaleString("en-US")}`;

check("the service list was read", services.length >= 8, `${services.length}`);

/*
 * NO TITLE IS HELD. The solar title was held under the 2026-10-31 solar ruling
 * until Robert's answer 3 of 2026-11-01 released the title and description;
 * that page's scope and wind uplift wording stay pinned by its own proof.
 */
for (const s of services) {
  const priced = CATALOG.filter((e) => e.serviceSlug === s.slug && e.priceCents != null).map((e) => e.priceCents);
  const lowest = priced.length ? Math.min(...priced) : null;
  const named = [...s.title.matchAll(/\$[\d,]+(?:\.\d{2})?/g)].map((m) => m[0]);
  if (lowest == null) {
    check(`${s.slug}: a quoted line's title names no price`, named.length === 0, s.title);
    continue;
  }
  check(`${s.slug}: the title names one price`, named.length === 1, s.title);
  check(`${s.slug}: that price is the catalog's lowest, ${dollars(lowest)}`, named[0] === dollars(lowest), `${named[0]} in "${s.title}"`);
  check(`${s.slug}: the title ends "| 254 Engineering"`, s.title.endsWith(" | 254 Engineering"));
}

const src = readFileSync("src/content/services.ts", "utf8");
const typed = [...src.matchAll(/^\s+title:\s*(["`])(.*)$/gm)].map((m) => m[2]);
check("no service title is typed as a string", typed.length === 0, `${typed.length} typed: ${typed.join(" | ")}`);
const calls = [...src.matchAll(/^\s+title:\s*pricedTitle\(/gm)].length;
check("every service carries a pricedTitle() call", calls === services.length, `${calls} of ${services.length}`);

/* The lines whose catalog turnaround fits a description carry it verbatim. */
const DESCRIBED = ["roof-inspections", "foundation-inspections"];
for (const slug of DESCRIBED) {
  const s = services.find((x) => x.slug === slug);
  const entry = CATALOG.find((e) => e.serviceSlug === slug && e.priceCents != null);
  check(`${slug}: the description states the catalog price`, s.description.includes(` for ${dollars(entry.priceCents)},`), s.description);
  check(`${slug}: it carries the catalog turnaround verbatim`, s.description.includes(entry.turnaround));
  check(`${slug}: it says a licensed Texas PE seals it`, s.description.includes("sealed by a licensed Texas PE"));
}

/*
 * The lines whose turnaround does not fit: price and seal, turnaround left to
 * the page (Robert's answer 2 of 2026-11-01). The manufactured home line is
 * here because its description names FHA, VA and USDA (his answer to
 * 6560030875), and the programs and the turnaround do not both fit. Design is
 * quoted with no catalog price, so its description is the one with neither.
 */
const PRICED_ONLY = ["windstorm-wpi-8", "solar-structural-letters", "structural-letters", "repair-specifications", "manufactured-home-foundation-certifications"];
for (const slug of PRICED_ONLY) {
  const s = services.find((x) => x.slug === slug);
  const lowest = Math.min(...CATALOG.filter((e) => e.serviceSlug === slug && e.priceCents != null).map((e) => e.priceCents));
  check(`${slug}: the description states the catalog's lowest price, ${dollars(lowest)}`, s.description.includes(` from ${dollars(lowest)},`), s.description);
  check(`${slug}: it says a licensed Texas PE seals it`, s.description.includes("sealed by a licensed Texas PE"));
}
check(`every service is accounted for: ${DESCRIBED.length} with turnaround, ${PRICED_ONLY.length} priced only, design quoted`, DESCRIBED.length + PRICED_ONLY.length + 1 === services.length);

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note ? ` (${x.note})` : ""}`);
}
console.log(
  failed === 0
    ? `PASS: every service title names the catalog's lowest price for its line, or none for a quoted line, no title is typed, ${DESCRIBED.length} descriptions state price, turnaround and seal, and ${PRICED_ONLY.length} state price and seal.`
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
