/**
 * THE PRICE BOOK: DOES IT HOLD WHAT THE OPERATOR RULED, AND DOES IT REFUSE
 * WHEN IT SHOULD?
 *
 *   npx tsx scripts/price-book-audit.mjs
 *
 * WHY EVERY RULED NUMBER IS WRITTEN OUT AS A LITERAL HERE. CLAUDE.md section 6c:
 * a business ruling is stated in the code AND pinned in the audit that covers
 * it, so changing one costs two edits made deliberately. An audit that imported
 * the prices from the price file and compared them to the price file would
 * compare a value to itself and could not disagree with anything.
 *
 * These are decisions about money the operator made on 2026-09-17 and
 * 2026-09-18. If this audit fails on one of them, it is not wrong: it is asking
 * whether the change was meant.
 */
import "./lib/load-env.mjs";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("================ THE PRICE BOOK ================");
console.log("");

const { servicePrices, WPI8_ONGOING_CENTS, priceFor, money } = await import("../src/config/prices.ts");
const { ENGINEER_TIER_CENTS, ENGINEER_DESIGN_HOURLY_CENTS, DEFAULT_TIER_BY_LINE } = await import(
  "../src/config/engineer-pay.ts"
);
const { TECHNICIAN_CALL_CENTS, CARD_PROCESSING_RATE } = await import("../src/config/cost-inputs.ts");
const { marginForJob, estimateForLine } = await import("../src/lib/price-book.ts");
const { services } = await import("../src/content/services.ts");

/* ------------------------------------------- 1. the ruled prices, as literals */

const RULED_PRICES = {
  "roof-inspections": 54_900,
  "foundation-inspections": 49_500,
  "structural-letters": 39_500,
  "solar-structural-letters": 44_500,
  "manufactured-home-foundation-certifications": 64_500,
  "windstorm-wpi-8": 79_500,
  "repair-specifications": 39_500,
};
const RULED_DESIGN_HOURLY = 22_500;
const RULED_DESIGN_MINIMUM = 200_000;
const RULED_WPI8_ONGOING = 99_500;

for (const [slug, cents] of Object.entries(RULED_PRICES)) {
  const price = servicePrices[slug];
  rec(
    `${slug} is ruled at ${money(cents)}`,
    price?.kind === "fixed" && price.cents === cents,
    price ? `${price.kind} ${price.kind === "fixed" ? money(price.cents) : ""}` : "no entry",
  );
}

{
  const design = servicePrices["residential-light-commercial-design"];
  rec(
    "design is hourly at the ruled rate with the ruled minimum",
    design?.kind === "hourly" &&
      design.rateCents === RULED_DESIGN_HOURLY &&
      design.minimumCents === RULED_DESIGN_MINIMUM,
    design?.kind === "hourly"
      ? `${money(design.rateCents)} per hour, minimum ${money(design.minimumCents)}`
      : "not hourly",
  );
  rec(
    "WPI-8 ongoing construction is ruled at its own price",
    WPI8_ONGOING_CENTS === RULED_WPI8_ONGOING,
    money(WPI8_ONGOING_CENTS),
  );
}

/*
 * FORENSIC ENGINEERING HAS NO PRICE AND THAT IS ASSERTED RATHER THAN ASSUMED.
 * The operator ruled no number for it. An entry appearing here later would be
 * somebody inventing a price to fill a table, which is the placeholder defect
 * applied to money, so the absence is a check.
 */
rec(
  "forensic engineering carries no price, because the operator ruled none",
  priceFor("forensic-engineering") === null,
  priceFor("forensic-engineering") ? "a price appeared" : "quoted per matter",
);

/* --------------------------------------------- 2. every price names a real line */

{
  const slugs = new Set(services.map((s) => s.slug));
  const orphans = Object.keys(servicePrices).filter((s) => !slugs.has(s));
  rec(
    "every priced slug is a service line that exists",
    orphans.length === 0,
    orphans.join(", ") || `${Object.keys(servicePrices).length} priced of ${slugs.size} lines`,
  );
  const tierOrphans = Object.keys(DEFAULT_TIER_BY_LINE).filter((s) => !slugs.has(s));
  rec(
    "and every line with an estimating tier exists too",
    tierOrphans.length === 0,
    tierOrphans.join(", ") || `${Object.keys(DEFAULT_TIER_BY_LINE).length} with a tier`,
  );
}

/* ------------------------------------------- 3. the cost inputs, as literals */

rec("the field technician is ruled at $85 a call, flat", TECHNICIAN_CALL_CENTS === 8_500, money(TECHNICIAN_CALL_CENTS));
rec("engineer tier 1 is ruled at $175", ENGINEER_TIER_CENTS[1] === 17_500, money(ENGINEER_TIER_CENTS[1]));
rec("engineer tier 2 is ruled at $350", ENGINEER_TIER_CENTS[2] === 35_000, money(ENGINEER_TIER_CENTS[2]));
rec("engineer tier 3 is ruled at $525", ENGINEER_TIER_CENTS[3] === 52_500, money(ENGINEER_TIER_CENTS[3]));
rec(
  "design pays the engineer $100 an hour and takes no tier",
  ENGINEER_DESIGN_HOURLY_CENTS === 10_000 &&
    DEFAULT_TIER_BY_LINE["residential-light-commercial-design"] === undefined,
  money(ENGINEER_DESIGN_HOURLY_CENTS),
);
/*
 * CARD PROCESSING HAS NO RATE AND THE BOOK SAYS SO. A number appearing here is
 * either a ruling the operator made, in which case this check asks whether it
 * was meant, or a plausible figure somebody typed, which is the thing that must
 * never happen in a money file.
 */
rec(
  "card processing carries no invented rate",
  CARD_PROCESSING_RATE === null,
  "every margin is stated before card processing",
);

/* ------------------------------ 4. the refusals, which are the whole design */

const BASE = {
  serviceSlug: "roof-inspections",
  chargedCents: 54_900,
  technicianVisits: 1,
  tier: 1,
  designHours: null,
};

{
  const good = marginForJob(BASE);
  rec(
    "a complete job computes a margin",
    good.ok === true,
    good.ok ? `revenue ${money(good.revenueCents)}, cost ${money(good.costCents)}, net ${money(good.netCents)}, ${good.marginPct}%` : good.because,
  );
  /*
   * The arithmetic, pinned. $549 less one $85 call less $175 of tier 1 is $289,
   * which is 52.6 percent. Computed by hand here rather than by calling the
   * function, because a check that recomputes with the code under test agrees
   * with it by construction.
   */
  rec(
    "and the arithmetic is the ruled arithmetic",
    good.ok && good.costCents === 26_000 && good.netCents === 28_900 && good.marginPct === 52.6,
    good.ok ? `${money(good.costCents)} cost, ${money(good.netCents)} net, ${good.marginPct}%` : "no figure",
  );
  rec(
    "and it says it is before card processing",
    good.ok === true && good.beforeCardProcessing === true,
    "the rate is not ruled, so the boundary is stated on the figure",
  );
}

{
  const noTier = marginForJob({ ...BASE, tier: null });
  rec(
    "a job with no determination refuses to state a margin and names the tier",
    noTier.ok === false && noTier.missing === "tier",
    noTier.ok ? "it computed one" : noTier.because.slice(0, 90),
  );
  /*
   * AND IT DOES NOT QUIETLY SUBSTITUTE THE LINE'S ESTIMATING DEFAULT, which is
   * the operator's ruling and the sharpest thing this audit checks. Using the
   * default would turn a plan into a record, and the figure would be right
   * often enough that nobody would notice the times it was not.
   */
  rec(
    "and it does not substitute the line's estimating tier",
    noTier.ok === false && /is not what happened/.test(noTier.because),
    "an estimate presented as a record is the defect this whole design prevents",
  );
}

{
  const noPrice = marginForJob({ ...BASE, chargedCents: null });
  rec(
    "a job with no price refuses and names the price",
    noPrice.ok === false && noPrice.missing === "price",
    noPrice.ok ? "it computed one" : noPrice.because.slice(0, 70),
  );
}

{
  const design = marginForJob({
    serviceSlug: "residential-light-commercial-design",
    chargedCents: 300_000,
    technicianVisits: 0,
    tier: null,
    designHours: null,
  });
  rec(
    "the design line refuses without recorded hours, rather than falling back to a tier",
    design.ok === false && design.missing === "hours",
    design.ok ? "it computed one" : design.because.slice(0, 80),
  );

  const withHours = marginForJob({
    serviceSlug: "residential-light-commercial-design",
    chargedCents: 300_000,
    technicianVisits: 0,
    tier: null,
    designHours: 12,
  });
  rec(
    "and computes from the hours the engineer actually recorded",
    withHours.ok === true && withHours.engineerCents === 120_000,
    withHours.ok ? `${money(withHours.engineerCents)} on 12 hours` : withHours.because,
  );
}

{
  const twoVisits = marginForJob({ ...BASE, technicianVisits: 2 });
  rec(
    "a second technician visit costs a second call",
    twoVisits.ok === true && twoVisits.technicianCents === 17_000,
    twoVisits.ok ? money(twoVisits.technicianCents) : twoVisits.because,
  );
}

/* --------------------------------- 5. an estimate cannot pass for a record */

{
  const est = estimateForLine("roof-inspections");
  rec(
    "an estimate states the tier and the visit count it assumed",
    est.ok === true && est.assumedTier === 1 && est.assumedVisits === 1,
    est.ok ? `tier ${est.assumedTier}, ${est.assumedVisits} visit` : est.because,
  );
  rec(
    "and a line with no ruled price cannot be estimated",
    estimateForLine("forensic-engineering").ok === false,
    "scoped per matter",
  );
  rec(
    "and an hourly line cannot be estimated per line either",
    estimateForLine("residential-light-commercial-design").ok === false,
    "what it makes depends on the hours estimated for that job",
  );
}

/* ----------------------------------------------------------------- verdict */

console.log("");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
console.log("");

const failed = out.filter((r) => !r.ok);
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. The book holds what was ruled, and refuses what it cannot know.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("A figure here is a decision about money. If one of these failed, the question is");
  console.log("whether the change was meant, not whether the audit is too strict.");
  process.exitCode = 1;
}
