/**
 * PROOF: THE COST GUIDE ANSWERS THREE PRICE QUESTIONS WITH THE CATALOG'S PRICES.
 *
 * Robert, 2026-11-01, round 3 item f: /insights/structural-inspection-cost-texas
 * answers "WPI-8 certificate cost", "foundation inspection cost" and "roof
 * certification cost", each under its own question H2 with the catalog price.
 *
 *   A  the post exists at that path, and each of the three questions is an H2
 *   B  the paragraph under each H2 states that line's catalog price, figure for
 *      figure against data/catalog.ts, and links the page that owns the topic
 *   C  the table carries every price and coastal total from the catalog
 *   D  no "5 year" wording, which is parked until Robert answers
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-cost-guide-answers-three-prices.mjs
 */
const { insights } = await import("../../src/content/insights.ts");
const { CATALOG, statedPriceCents } = await import("../../data/catalog.ts");

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok, note });
const dollars = (cents) => `$${(cents / 100).toLocaleString("en-US")}`;

const post = insights.find((p) => p.slug === "structural-inspection-cost-texas");
check("the cost guide is a post", Boolean(post));

const QUESTIONS = [
  ["What does a WPI-8 certificate cost?", "windstorm-wpi-8", "/insights/wpi-8-certificate"],
  ["What does a foundation inspection cost?", "foundation-inspections", "/insights/foundation-inspection-cost"],
  ["What does a roof certification cost?", "roof-inspections", "/insights/roof-inspection-cost"],
];
for (const [q, slug, owner] of QUESTIONS) {
  const at = post.body.findIndex((b) => b.kind === "h2" && b.text === q);
  check(`"${q}" is an H2`, at >= 0);
  const section = [];
  for (let i = at + 1; i < post.body.length && post.body[i].kind !== "h2"; i++) section.push(post.body[i].text ?? "");
  const text = section.join(" ");
  for (const e of CATALOG.filter((x) => x.serviceSlug === slug && x.priceCents != null)) {
    /* Robert's Q14 of 2026-11-02: a deliverable no order page offers states no figure and reads "quoted". */
    if (statedPriceCents(e) === null) {
      check(`under it, "${e.name}" is quoted and its ${dollars(e.priceCents)} is not printed`, !text.includes(dollars(e.priceCents)) && /ongoing construction is quoted/.test(text));
    } else {
      check(`under it, the catalog price ${dollars(e.priceCents)} for "${e.name}"`, text.includes(dollars(e.priceCents)));
    }
  }
  check(`under it, a link to the page that owns the topic, ${owner}`, text.includes(`](${owner})`));
}

const table = post.body.find((b) => b.kind === "table");
check("the post carries one table", post.body.filter((b) => b.kind === "table").length === 1);
const cells = JSON.stringify(table?.rows ?? []);
for (const e of CATALOG.filter((x) => ["windstorm-wpi-8", "foundation-inspections", "roof-inspections"].includes(x.serviceSlug) && x.priceCents != null)) {
  if (statedPriceCents(e) === null) {
    const row = (table?.rows ?? []).find((r) => r[0] === e.name);
    check(`the table carries ${e.name} as Quoted, with no ${dollars(e.priceCents)} and no coastal total`, JSON.stringify(row) === JSON.stringify([e.name, "Quoted", "Quoted"]) && !cells.includes(dollars(e.priceCents)) && (e.coastalSurchargeCents == null || !cells.includes(dollars(e.priceCents + e.coastalSurchargeCents))), JSON.stringify(row));
    continue;
  }
  check(`the table carries ${e.name} at ${dollars(e.priceCents)}`, cells.includes(dollars(e.priceCents)));
  if (e.coastalSurchargeCents != null) check(`and its coastal total ${dollars(e.priceCents + e.coastalSurchargeCents)}`, cells.includes(dollars(e.priceCents + e.coastalSurchargeCents)));
}

const all = JSON.stringify(post);
check("no 5 year wording", !/\b(5|five)[ -]year\b/i.test(all));

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note ? ` (${x.note})` : ""}`);
}
console.log(
  failed === 0
    ? "PASS: the cost guide answers the WPI-8, foundation and roof price questions under their own H2s with the catalog's prices, links each topic's owner, and carries every price in one table."
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
