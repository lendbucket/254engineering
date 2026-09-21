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

const { servicePrices, priceFor, money, deliverablePriceCents, headlinePriceCents, priceSentence } = await import(
  "../src/config/prices.ts"
);
const { ENGINEER_TIER_CENTS, ENGINEER_DESIGN_HOURLY_CENTS, TIER_BY_DELIVERABLE } = await import(
  "../src/config/engineer-pay.ts"
);
const { CATALOG } = await import("../data/catalog.ts");
const { readFileSync } = await import("node:fs");
const { TECHNICIAN_CALL_CENTS, PROCESSING_RATES, PROCESSING_READ_ON, PROCESSING_READ_FROM } =
  await import("../src/config/cost-inputs.ts");
const { stripeConsole } = await import("../src/config/stripe-console.ts");
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
    price?.kind === "fixed" && headlinePriceCents(price) === cents,
    price ? `${price.kind} ${price.kind === "fixed" ? money(headlinePriceCents(price) ?? 0) : ""}` : "no entry",
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
  /*
   * WPI-8 ONGOING, READ OFF THE DELIVERABLE RATHER THAN OFF A LOOSE CONSTANT.
   * It was `WPI8_ONGOING_CENTS`, an exception sitting beside a line-keyed
   * table. The line split into two deliverables on 2026-09-20 and the constant
   * retired into the one that carries it.
   */
  rec(
    "WPI-8 ongoing construction is ruled at its own price",
    deliverablePriceCents("windstorm-wpi-8", "ongoing") === RULED_WPI8_ONGOING,
    money(deliverablePriceCents("windstorm-wpi-8", "ongoing") ?? 0),
  );
  rec(
    "and completed construction is the cheaper of the two, which is what the page leads with",
    deliverablePriceCents("windstorm-wpi-8", "completed") === RULED_PRICES["windstorm-wpi-8"] &&
      servicePrices["windstorm-wpi-8"]?.headlineTier === "completed",
    `${money(deliverablePriceCents("windstorm-wpi-8", "completed") ?? 0)} leads`,
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
  const tierOrphans = Object.keys(TIER_BY_DELIVERABLE).filter((k) => !slugs.has(k.split("/")[0]));
  rec(
    "and every deliverable with a pay tier belongs to a service line that exists",
    tierOrphans.length === 0,
    tierOrphans.join(", ") || `${Object.keys(TIER_BY_DELIVERABLE).length} with a tier`,
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
    Object.keys(TIER_BY_DELIVERABLE).every((k) => !k.startsWith("residential-light-commercial-design/")),
  money(ENGINEER_DESIGN_HOURLY_CENTS),
);
/*
 * AND THE TWO WPI-8 DELIVERABLES ARE PAID DIFFERENTLY, WHICH IS THE WHOLE
 * REASON THE MAP IS KEYED ON DELIVERABLES.
 *
 * The operator ruled tier 2 for completed construction and tier 3 for ongoing
 * on 2026-09-18. That ruling lived in `WPI8_ONGOING_TIER`, a constant beside a
 * line-keyed map, and NOTHING EVER READ IT: it was written down, correct, and
 * inert for two days. These two lines are what make it reachable, and they are
 * pinned as literals for the reason section 6c gives, so moving either costs a
 * deliberate second edit.
 */
rec(
  "WPI-8 completed construction is tier 2",
  TIER_BY_DELIVERABLE["windstorm-wpi-8/completed"] === 2,
  String(TIER_BY_DELIVERABLE["windstorm-wpi-8/completed"]),
);
rec(
  "and ongoing construction is tier 3, which the line-keyed map could not say",
  TIER_BY_DELIVERABLE["windstorm-wpi-8/ongoing"] === 3,
  String(TIER_BY_DELIVERABLE["windstorm-wpi-8/ongoing"]),
);
/*
 * CARD PROCESSING HAS NO RATE AND THE BOOK SAYS SO. A number appearing here is
 * either a ruling the operator made, in which case this check asks whether it
 * was meant, or a plausible figure somebody typed, which is the thing that must
 * never happen in a money file.
 */
/*
 * THE RATES ARE RULED NOW, AND THEY ARE PINNED HERE AS LITERALS.
 *
 * This check used to assert `CARD_PROCESSING_RATE === null`, which was the
 * right assertion while no rate had been read: it stopped a plausible figure
 * being typed into a money file. The operator read the Stripe dashboard on
 * 2026-09-20 and the figure turned out to be exactly the 2.9% plus 30 cents
 * the old comment named as the "common Stripe shape" and refused to write.
 *
 * **BEING RIGHT ABOUT A GUESS IS NOT THE SAME AS KNOWING.** The only thing that
 * changed is that somebody opened the console, and that is why the provenance
 * is asserted below alongside the numbers.
 */
const RULED_CARD_FRACTION = 0.029;
const RULED_CARD_FIXED_CENTS = 30;
const RULED_INVOICE_FRACTION = 0.004;

rec(
  "the domestic card rate is the ruled rate",
  PROCESSING_RATES.card.fraction === RULED_CARD_FRACTION &&
    PROCESSING_RATES.card.fixedCents === RULED_CARD_FIXED_CENTS,
  `${(PROCESSING_RATES.card.fraction * 100).toFixed(1)}% plus ${money(PROCESSING_RATES.card.fixedCents)}`,
);
rec(
  "and the invoice rate is its own rate rather than the card one",
  PROCESSING_RATES.invoice.fraction === RULED_INVOICE_FRACTION &&
    PROCESSING_RATES.invoice.fraction !== PROCESSING_RATES.card.fraction,
  `${(PROCESSING_RATES.invoice.fraction * 100).toFixed(1)}% on a one-time invoice payment`,
);
/*
 * AND A CONSOLE RECORD WITH NO DATE IS A NOTE. The same rule section 6 makes
 * about Vercel and Stripe: a person read it, wrote down what it said and when,
 * and that is what makes it a fact this repository can hold and let go stale.
 */
rec(
  "and the rates say when they were read and from where",
  /^\d{4}-\d{2}-\d{2}$/.test(PROCESSING_READ_ON) && PROCESSING_READ_FROM.includes("acct_"),
  `${PROCESSING_READ_ON}, ${PROCESSING_READ_FROM}`,
);
rec(
  "and the account they were read from is the account the console record names",
  PROCESSING_READ_FROM.includes(stripeConsole.accountId),
  stripeConsole.accountId,
);

/* ------------------------------ 4. the refusals, which are the whole design */

const BASE = {
  serviceSlug: "roof-inspections",
  chargedCents: 54_900,
  technicianVisits: 1,
  tier: 1,
  designHours: null,
  paidBy: "card",
};

{
  const good = marginForJob(BASE);
  rec(
    "a complete job computes a margin",
    good.ok === true,
    good.ok ? `revenue ${money(good.revenueCents)}, cost ${money(good.costCents)}, net ${money(good.netCents)}, ${good.marginPct}%` : good.because,
  );
  /*
   * The arithmetic, pinned, and it MOVED on 2026-09-20 when processing became a
   * computed line. $549, less one $85 call, less $175 of tier 1, less $16.22 of
   * card processing, which is 2.9% of $549 rounded plus 30 cents, is $272.78 on
   * a cost of $276.22, or 49.7 percent.
   *
   * Computed by hand here rather than by calling the function, because a check
   * that recomputes with the code under test agrees with it by construction.
   * That is what makes these three numbers worth typing out.
   */
  rec(
    "and the arithmetic is the ruled arithmetic",
    good.ok && good.processingCents === 1_622 && good.costCents === 27_622 && good.netCents === 27_278 && good.marginPct === 49.7,
    good.ok
      ? `${money(good.costCents)} cost including ${money(good.processingCents)} processing, ${money(good.netCents)} net, ${good.marginPct}%`
      : "no figure",
  );
  rec(
    "and it says it is AFTER processing, and which rate it used",
    good.ok === true && good.afterCardProcessing === true && good.processingMethod === "card",
    "a margin that omits what the provider took is wrong in the flattering direction",
  );

  /*
   * THE SAME JOB PAID ON INVOICE IS A DIFFERENT MARGIN, which is the entire
   * reason the method is an input rather than an assumption. 0.4% of $549 is
   * $2.20 against $16.22 on a card: a $14 swing on one roof certification.
   */
  const onInvoice = marginForJob({ ...BASE, paidBy: "invoice" });
  rec(
    "the same job paid on invoice costs less to process and says so",
    onInvoice.ok === true &&
      onInvoice.processingCents === 220 &&
      onInvoice.processingMethod === "invoice" &&
      onInvoice.netCents > (good.ok ? good.netCents : 0),
    onInvoice.ok
      ? `${money(onInvoice.processingCents)} against ${money(good.ok ? good.processingCents : 0)} on a card, net ${money(onInvoice.netCents)}`
      : onInvoice.because,
  );

  /*
   * AND A JOB THAT DOES NOT SAY HOW IT WAS PAID REFUSES, like every other
   * missing input in this book. Defaulting to card would be the usually-right
   * figure that earns the trust it then spends.
   */
  const noMethod = marginForJob({ ...BASE, paidBy: null });
  rec(
    "a job with no recorded payment method refuses rather than assuming a card",
    noMethod.ok === false && noMethod.missing === "payment method",
    noMethod.ok ? "IT COMPUTED A FIGURE" : String(noMethod.because).slice(0, 80),
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
    paidBy: "invoice",
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
    paidBy: "invoice",
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

/*
 * =========================================================================
 * 5. ONE HOME, AND THIS IS THE HALF THAT DID NOT EXIST. Operator ruling,
 * 2026-09-20.
 * =========================================================================
 *
 * **THIS AUDIT WAS GREEN WHILE THE SITE PUBLISHED ONE PRICE AND A CARD WAS
 * CHARGED ANOTHER, ON EVERY PRICED LINE.** It imported `prices.ts`, asserted
 * every ruled figure was correctly stated there, and every assertion was true.
 * It had never read `data/catalog.ts`, which is what the order flow, the v1
 * API, bulk ordering, intake and `ops-payments` actually charge from. An audit
 * named after the price book never compared the price book to the thing that
 * takes the money.
 *
 * The widest gap was repair specifications: $395 advertised, $900 charged. The
 * gaps followed no rule, $5 to $505, so it was drift rather than a transform,
 * and it would have gone on drifting because nothing was looking.
 *
 * The operator's ruling was that the mechanism matters more than the
 * correction. Three checks, and the third is the one whose absence let this run.
 */

/* 5a. The catalogue types no price at all. */
{
  const source = readFileSync("data/catalog.ts", "utf8");
  const literals = source
    .split("\n")
    .map((line, i) => [i + 1, line])
    .filter(([, line]) => /^\s{4}priceCents:/.test(line));
  rec(
    "the catalogue types no price of its own",
    literals.length === 0,
    literals.length === 0
      ? "every entry is declared without one and CATALOG fills it from the price book"
      : `A PRICE IS TYPED IN THE CATALOGUE at line(s) ${literals.map(([n]) => n).join(", ")}`,
  );
}

/* 5b. Every catalogue deliverable resolves through the one function. */
{
  const mismatched = CATALOG.filter(
    (e) => e.priceCents !== deliverablePriceCents(e.serviceSlug, e.tier),
  ).map((e) => `${e.serviceSlug}/${e.tier}`);
  rec(
    `every catalogue deliverable takes its price from the price book (${CATALOG.length} deliverables)`,
    CATALOG.length > 5 && mismatched.length === 0,
    mismatched.length === 0
      ? `${CATALOG.length} compared, none stating a price of its own`
      : `DISAGREES WITH THE PRICE BOOK: ${mismatched.join(", ")}`,
  );

  /*
   * AND A DELIVERABLE WHOSE LINE IS PRICED MUST RESOLVE TO A NUMBER. Null has
   * three sources and only two are answers: an hourly line and an unpriced
   * line are quoted, but a deliverable whose line states prices for OTHER
   * tiers and not this one is a drift that would reach a customer as "quoted".
   */
  const unresolved = CATALOG.filter((e) => {
    const price = priceFor(e.serviceSlug);
    return price?.kind === "fixed" && deliverablePriceCents(e.serviceSlug, e.tier) === null;
  }).map((e) => `${e.serviceSlug}/${e.tier}`);
  rec(
    "and no deliverable on a priced line falls through to quoted",
    unresolved.length === 0,
    unresolved.length === 0
      ? "a fixed line prices every deliverable it sells"
      : `PRICED LINE, UNPRICED DELIVERABLE: ${unresolved.join(", ")}`,
  );
}

/*
 * 5c. THE CHECK WHOSE ABSENCE LET IT RUN. The number the site publishes and the
 * number the order flow charges, per line, with the count asserted.
 *
 * The count matters as much as the comparison: a version of this that derived
 * its subject from an empty list, or from a filter that happened to match
 * nothing, would print a green line about agreement it never tested. That is
 * the vacuous green this repository has met at a sitemap, a glob, a file list
 * and a 1000 row cap.
 */
/*
 * AND THE FIRST VERSION OF THIS CHECK WAS TAUTOLOGICAL, WHICH IS WORTH MORE
 * WRITTEN DOWN THAN QUIETLY FIXED.
 *
 * It compared the catalogue's `priceCents` against `headlinePriceCents`. Both
 * are now derived from the same `byTier` map, so they agree by construction and
 * the check could not fail for any edit anybody could make. It printed
 * "7 lines compared, every one agreeing" and proved nothing at all.
 *
 * That is the hazard of fixing a two-homes defect: the comparison that WOULD
 * have caught it becomes vacuous the moment there is one home, and it goes on
 * printing a reassuring line. A green that names the rigour it is not
 * performing is the worst kind, and this one had the shape exactly.
 *
 * So the comparison runs against the PINNED LITERALS at the top of this file,
 * which is the section 6c mechanism: a ruled figure is stated in the code and
 * again as a literal in the audit, so changing one costs two deliberate edits.
 * Those literals are independent of the derivation and CAN disagree with it,
 * which is what makes this a check rather than a sentence.
 */
{
  const pricedLines = Object.entries(servicePrices).filter(([, p]) => p.kind === "fixed");
  const disagreements = [];
  for (const [slug, price] of pricedLines) {
    const ruled = RULED_PRICES[slug];
    if (ruled === undefined) {
      disagreements.push(`${slug}: priced in the book and pinned nowhere in this audit`);
      continue;
    }
    const headline = CATALOG.find((e) => e.serviceSlug === slug && e.tier === price.headlineTier);
    if (!headline) {
      disagreements.push(`${slug}: the price book leads with "${price.headlineTier}", which the catalogue does not sell`);
      continue;
    }
    if (headline.priceCents !== ruled) {
      disagreements.push(
        `${slug}: the operator ruled ${money(ruled)} and the order flow charges ${money(headline.priceCents ?? 0)}`,
      );
    }
    if (priceSentence(slug) !== money(ruled)) {
      disagreements.push(`${slug}: the service page says ${priceSentence(slug)} against a ruled ${money(ruled)}`);
    }
  }
  rec(
    `what the site publishes and what the order flow charges are both the ruled figure (${pricedLines.length} priced lines)`,
    pricedLines.length >= 7 && disagreements.length === 0,
    disagreements.length === 0
      ? `${pricedLines.length} lines compared against their pinned rulings, page and checkout alike`
      : disagreements.join("; "),
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
