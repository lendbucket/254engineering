/**
 * PROOF: THE FOUR INFORMATIONAL ARTICLES WITH THE MOST IMPRESSIONS EACH CLOSE ON
 * THE MATCHING SERVICE.
 *
 * Robert, 2026-11-01, round 3 item g: texas-pe-license-lookup,
 * texas-engineering-firm-registration, texas-professional-services-procurement-act
 * and texas-windstorm-certificate-lookup "each get one short closing section
 * linking to the matching service. No rewording of their existing text."
 *
 *   A  each article's body ends with exactly one new statement H2 and one
 *      paragraph, and that paragraph links its matching page
 *   B  the section is short: one paragraph of at most 60 words
 *   C  the WPI-8 one states the catalog prices for both tiers
 *
 * The "no rewording" half is the commit's own diff, which adds lines and
 * removes none; a proof that reads only today's text cannot see what the text
 * was, so it does not pretend to.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/four-informational-articles-close-on-their-service.mjs
 */
const { insights } = await import("../../src/content/insights.ts");
const { CATALOG, statedPriceCents } = await import("../../data/catalog.ts");

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok, note });
const dollars = (cents) => `$${(cents / 100).toLocaleString("en-US")}`;

const CLOSINGS = {
  "texas-pe-license-lookup": ["Structural letters from 254 Engineering", "/services/structural-letters"],
  "texas-engineering-firm-registration": ["254 Engineering's service lines", "/services"],
  "texas-professional-services-procurement-act": ["254 Engineering for public clients", "/government"],
  "texas-windstorm-certificate-lookup": ["WPI-8 inspections from 254 Engineering", "/services/windstorm-wpi-8"],
};

for (const [slug, [heading, target]] of Object.entries(CLOSINGS)) {
  const post = insights.find((p) => p.slug === slug);
  check(`${slug} is a post`, Boolean(post));
  const body = post.body;
  const [h, p] = body.slice(-2);
  check(`${slug}: the body ends with the closing H2 "${heading}"`, h?.kind === "h2" && h.text === heading, h?.text);
  check(`${slug}: the heading is a statement`, !heading.endsWith("?"));
  check(`${slug}: then one paragraph linking ${target}`, p?.kind === "p" && p.text.includes(`](${target})`), p?.text);
  const words = (p?.text ?? "").split(/\s+/).length;
  check(`${slug}: the paragraph is short`, words <= 60, `${words} words`);
  check(`${slug}: the heading appears once`, body.filter((b) => b.kind === "h2" && b.text === heading).length === 1);
}

const lookup = insights.find((p) => p.slug === "texas-windstorm-certificate-lookup");
const last = lookup.body.at(-1).text;
for (const e of CATALOG.filter((x) => x.serviceSlug === "windstorm-wpi-8" && x.priceCents != null)) {
  /* Robert's Q14 of 2026-11-02: a tier no order page offers is quoted, its figure not printed. */
  if (statedPriceCents(e) === null) {
    check(`the WPI-8 closing says ${e.name} is quoted, with no ${dollars(e.priceCents)}`, !last.includes(dollars(e.priceCents)) && last.includes("ongoing construction is quoted"));
  } else {
    check(`the WPI-8 closing states ${e.name} at ${dollars(e.priceCents)}`, last.includes(dollars(e.priceCents)));
  }
}

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note ? ` (${x.note})` : ""}`);
}
console.log(
  failed === 0
    ? "PASS: the four articles each end on one short closing section linking their matching service, and the WPI-8 one states each tier's catalog price or says it is quoted."
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
