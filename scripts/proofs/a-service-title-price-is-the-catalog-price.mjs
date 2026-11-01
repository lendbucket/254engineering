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
 * THE ONE HELD TITLE, COUNTED AND NAMED. Robert's GEO ruling of 2026-10-31,
 * item 6, holds the solar page's words still, its title among them, and item
 * e's priced title for it waits on his answer. An exemption nobody counts
 * becomes the rule (CLAUDE.md section 6), so the held set is asserted to be
 * exactly this one line, carrying exactly the title main carries.
 */
const HELD = { "solar-structural-letters": "Solar Structural Engineering in Texas | 254 Engineering" };
for (const [slug, title] of Object.entries(HELD)) {
  check(`${slug} is held: its title is the one main carries`, services.find((s) => s.slug === slug)?.title === title);
}

for (const s of services) {
  if (s.slug in HELD) continue;
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
const heldCount = Object.keys(HELD).length;
check(`no service title is typed as a string except the ${heldCount} held`, typed.length === heldCount, `${typed.length} typed: ${typed.join(" | ")}`);
const calls = [...src.matchAll(/^\s+title:\s*pricedTitle\(/gm)].length;
check("every service not held carries a pricedTitle() call", calls === services.length - heldCount, `${calls} of ${services.length - heldCount}`);

const DESCRIBED = ["roof-inspections", "foundation-inspections", "manufactured-home-foundation-certifications"];
for (const slug of DESCRIBED) {
  const s = services.find((x) => x.slug === slug);
  const entry = CATALOG.find((e) => e.serviceSlug === slug && e.priceCents != null);
  check(`${slug}: the description states the catalog price`, s.description.includes(` for ${dollars(entry.priceCents)},`), s.description);
  check(`${slug}: it carries the catalog turnaround verbatim`, s.description.includes(entry.turnaround));
  check(`${slug}: it says a licensed Texas PE seals it`, s.description.includes("sealed by a licensed Texas PE"));
}

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note ? ` (${x.note})` : ""}`);
}
console.log(
  failed === 0
    ? "PASS: every service title not held names the catalog's lowest price for its line, or none for a quoted line, only the one held solar title is typed, and the three described lines state the catalog price, turnaround and seal."
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
