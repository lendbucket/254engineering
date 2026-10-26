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
const {
  ENGINEER_TIER_CENTS,
  ENGINEER_DESIGN_FEE_SHARE_BP,
  engineerDesignPayCents,
  TIER_BY_DELIVERABLE,
  SCOPE_ADDENDUM_REQUIRED,
  scopeAddendumMissing,
} = await import("../src/config/engineer-pay.ts");
const ENGINEER_PAY_MODULE = await import("../src/config/engineer-pay.ts");
const { CATALOG, orderBlockedReason } = await import("../data/catalog.ts");
const { readFileSync } = await import("node:fs");
const { TECHNICIAN_CALL_CENTS, PROCESSING_RATES, PROCESSING_READ_ON, PROCESSING_READ_FROM } =
  await import("../src/config/cost-inputs.ts");
const { stripeConsole } = await import("../src/config/stripe-console.ts");
const { marginForJob, estimateForLine } = await import("../src/lib/price-book.ts");
const { services } = await import("../src/content/services.ts");

/* ------------------------------------------- 1. the ruled prices, as literals */

/*
 * THE PRICES OF 2026-10-22, operator ruling with the 150% markup floor. Before:
 * roof $549, foundation $495, structural letter $549 (from $395 on 2026-10-07),
 * solar $445, manufactured home $645, repair specification $395. WPI-8 is
 * unchanged by his ruling.
 */
const RULED_PRICES = {
  "roof-inspections": 70_900,
  "foundation-inspections": 70_900,
  "structural-letters": 70_900,
  "solar-structural-letters": 70_900,
  "manufactured-home-foundation-certifications": 70_900,
  "windstorm-wpi-8": 79_500,
  "repair-specifications": 119_500,
};
const RULED_DESIGN_HOURLY = 22_500;
const RULED_DESIGN_MINIMUM = 200_000;
const RULED_WPI8_ONGOING = 99_500;

/*
 * WPI-8 ONGOING: FOUR STAGE VISITS INCLUDED, $150 FOR EACH FURTHER VISIT.
 * Operator ruling of 2026-10-06 on WP-001 v1.1 section 8, built 2026-10-07.
 * Literals, never read back from prices.ts: a constant compared with itself
 * cannot disagree. And the line's own sentence has to state both, so a buyer
 * reading the price learns what it includes.
 */
const RULED_WPI8_INCLUDED_VISITS = 4;
const RULED_WPI8_EXTRA_VISIT_CENTS = 15_000;
{
  const { WPI8_ONGOING_INCLUDED_VISITS, WPI8_EXTRA_VISIT_CENTS } = await import("../src/config/prices.ts");
  rec(
    "WPI-8 ongoing includes four stage visits and each further visit is $150, as ruled",
    WPI8_ONGOING_INCLUDED_VISITS === RULED_WPI8_INCLUDED_VISITS && WPI8_EXTRA_VISIT_CENTS === RULED_WPI8_EXTRA_VISIT_CENTS,
    `${WPI8_ONGOING_INCLUDED_VISITS} visits, ${money(WPI8_EXTRA_VISIT_CENTS)} each beyond`,
  );
  const sentence = servicePrices["windstorm-wpi-8"]?.whatChangesIt ?? "";
  rec(
    "and the windstorm line's own price sentence states both",
    sentence.includes(`includes ${RULED_WPI8_INCLUDED_VISITS} stage visits`) && sentence.includes("calls for is $150."),
    sentence.slice(sentence.indexOf("That price"), sentence.indexOf("That price") + 110),
  );
}

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
/*
 * SCHEDULE 2 OF THE SIGNED AGREEMENT, PINNED AS LITERALS. Operator ruling,
 * 2026-10-22: "Engineer pay must match the signed agreement's Schedule 2
 * exactly; the agreement wins over engineer-pay.ts." The whole map is pinned,
 * not a sample, so a row added, removed or moved is a deliberate second edit.
 * It replaced "design pays the engineer $100 an hour and takes no tier", which
 * was never the agreement's term.
 */
const SCHEDULE_2 = {
  "roof-inspections/standard": 1,
  "structural-letters/standard": 1,
  "solar-structural-letters/standard": 1,
  "foundation-inspections/standard": 1,
  "manufactured-home-foundation-certifications/standard": 1,
  "windstorm-wpi-8/completed": 2,
  "repair-specifications/standard": 2,
  "residential-light-commercial-design/beam-header-sizing": 2,
};
{
  const keys = new Set([...Object.keys(SCHEDULE_2), ...Object.keys(TIER_BY_DELIVERABLE)]);
  const differ = [...keys].filter((k) => SCHEDULE_2[k] !== TIER_BY_DELIVERABLE[k]);
  rec(
    "every deliverable's pay tier is Schedule 2's, and nothing else carries one",
    differ.length === 0,
    differ.map((k) => `${k}: code ${TIER_BY_DELIVERABLE[k] ?? "none"}, Schedule 2 ${SCHEDULE_2[k] ?? "none"}`).join("; ") ||
      `${keys.size} deliverables`,
  );
}
/*
 * =========================================================================
 * EVERY FLOOR IS A 150% MARKUP, WPI-8 APART. Operator ruling, 2026-10-22.
 * =========================================================================
 *
 * floor = ceil(2.5 x (pay + visit + 0.30) / 0.9275), whole dollars, where pay
 * is Schedule 2 and the visit is $85 when the line sends one. Computed HERE,
 * from this file's own literals and in floating point, never imported from
 * trade-floors.ts, whose integral version it is checked against. The ruled
 * figures are pinned as literals too, so the formula, the code and the ruling
 * each have to agree with the other two.
 */
{
  const { TRADE_FLOORS, markupFloorCents, SOLAR_DOCUMENTS_ONLY_FLOOR_CENTS } = await import(
    "../src/config/trade-floors.ts"
  );
  const { SOLAR_DOCUMENTS_ONLY_CENTS } = await import("../src/config/prices.ts");
  const PAY = { 1: 17_500, 2: 35_000, 3: 52_500 };
  const VISIT = 8_500;
  const formula = (payCents, visitCents) => Math.ceil((2.5 * ((payCents + visitCents) / 100 + 0.3)) / 0.9275 - 1e-9) * 100;
  const RULED_FLOORS = {
    "roof-inspections/standard": 70_200,
    "foundation-inspections/standard": 70_200,
    "structural-letters/standard": 70_200,
    "manufactured-home-foundation-certifications/standard": 70_200,
    "solar-structural-letters/standard": 70_200,
    "repair-specifications/standard": 117_400,
  };
  const EXEMPT = ["windstorm-wpi-8/completed", "windstorm-wpi-8/ongoing"];

  const wrongFormula = Object.entries(RULED_FLOORS).filter(
    ([k, cents]) => formula(PAY[SCHEDULE_2[k]], VISIT) !== cents,
  );
  rec(
    "the ruled floors are what the 150% formula gives, from Schedule 2 pay and one $85 visit",
    wrongFormula.length === 0,
    wrongFormula.map(([k, c]) => `${k}: ruled ${money(c)}, formula ${money(formula(PAY[SCHEDULE_2[k]], VISIT))}`).join("; ") ||
      "$702 at tier 1, $1,174 at tier 2",
  );

  const setFloors = Object.entries(TRADE_FLOORS).filter(([, f]) => f.state === "set");
  const below = setFloors.filter(
    ([k, f]) => !EXEMPT.includes(k) && (SCHEDULE_2[k] === undefined || f.floorCents < formula(PAY[SCHEDULE_2[k]], VISIT)),
  );
  rec(
    "and no line's floor sits below it, WPI-8 apart",
    below.length === 0,
    below.map(([k, f]) => `${k} at ${money(f.floorCents)}`).join("; ") || `${setFloors.length - EXEMPT.length} floors checked`,
  );
  const drift = Object.entries(RULED_FLOORS).filter(([k, c]) => TRADE_FLOORS[k]?.floorCents !== c);
  rec(
    "and every floor in trade-floors.ts is the ruled figure",
    drift.length === 0,
    drift.map(([k]) => `${k} reads ${TRADE_FLOORS[k]?.floorCents ?? "nothing"}`).join("; ") || "six floors",
  );
  const exemptSeen = setFloors.filter(([k]) => k.startsWith("windstorm-wpi-8/")).map(([k]) => k);
  rec(
    "WPI-8 is the only exception, and both of its floors keep the 2026-09-20 values",
    exemptSeen.length === 2 &&
      TRADE_FLOORS["windstorm-wpi-8/completed"]?.floorCents === 65_000 &&
      TRADE_FLOORS["windstorm-wpi-8/ongoing"]?.floorCents === 92_500,
    exemptSeen.join(", "),
  );
  /*
   * EVERY COST TO THE CENT, NOT SIX OF THEM. The first version compared the two
   * formulas on the three tiers with and without a visit, and an injected
   * off-by-one in the integral version passed it: none of those six costs
   * lands on the boundary where the two roundings part. Sweeping every cost
   * from $0 to $2,000 crosses every boundary in that range.
   */
  const disagree = [];
  for (let pay = 0; pay <= 200_000 && disagree.length < 3; pay += 1) {
    if (markupFloorCents(pay, 0) !== formula(pay, 0)) disagree.push(pay);
  }
  rec(
    "the code's integral formula agrees with this one at every cost from $0 to $2,000, to the cent",
    disagree.length === 0 && [1, 2, 3].every((t) => markupFloorCents(PAY[t], VISIT) === formula(PAY[t], VISIT)),
    disagree.map((c) => `cost ${c} cents: code ${markupFloorCents(c, 0)}, formula ${formula(c, 0)}`).join("; ") ||
      [1, 2, 3].map((t) => `tier ${t} ${money(markupFloorCents(PAY[t], VISIT))}`).join(", "),
  );
  rec(
    "the solar letter from documents only is $479 with a $473 floor, which is tier 1 with no visit",
    SOLAR_DOCUMENTS_ONLY_CENTS === 47_900 &&
      SOLAR_DOCUMENTS_ONLY_FLOOR_CENTS === 47_300 &&
      formula(PAY[1], 0) === 47_300,
    `${money(SOLAR_DOCUMENTS_ONLY_CENTS)}, floor ${money(SOLAR_DOCUMENTS_ONLY_FLOOR_CENTS)}`,
  );

  /* Every list price is at or above its floor, and at the floor the profit is at least 1.5 times cost. */
  const underList = CATALOG.filter((e) => e.priceCents !== null).filter((e) => {
    const f = TRADE_FLOORS[`${e.serviceSlug}/${e.tier}`];
    return f?.state === "set" && e.priceCents < f.floorCents;
  });
  rec(
    "no list price sits below its own floor",
    underList.length === 0,
    underList.map((e) => `${e.serviceSlug}/${e.tier} lists ${money(e.priceCents)}`).join("; ") || "every priced deliverable",
  );
  const thin = Object.entries(RULED_FLOORS).filter(([k, floor]) => {
    const cost = PAY[SCHEDULE_2[k]] + VISIT + floor * 0.029 + 30;
    return (floor - cost) / cost < 1.5;
  });
  rec(
    "and at each floor the profit is at least 1.5 times the cost, processing included",
    thin.length === 0,
    thin.map(([k]) => k).join("; ") || "all six",
  );

  console.log("Markup after the 2026-10-22 ruling (profit over cost, cost = Schedule 2 pay + visit + card processing):");
  for (const e of CATALOG.filter((x) => x.priceCents !== null)) {
    const key = `${e.serviceSlug}/${e.tier}`;
    const tier = TIER_BY_DELIVERABLE[key];
    if (!tier) {
      console.log(`  ${key}: list ${money(e.priceCents)}, no Schedule 2 tier, so no markup is stated`);
      continue;
    }
    const visits = e.orderType === "field" ? 1 : 0;
    const at = (price) => {
      const cost = PAY[tier] + visits * VISIT + Math.round(price * 0.029) + 30;
      return `${Math.round(((price - cost) / cost) * 1000) / 10}%`;
    };
    const f = TRADE_FLOORS[key];
    console.log(
      `  ${key}: list ${money(e.priceCents)} = ${at(e.priceCents)}` +
        (f?.state === "set" ? `, floor ${money(f.floorCents)} = ${at(f.floorCents)}` : ""),
    );
  }
  console.log("");
}

rec(
  "a custom design engagement pays the engineer 35% of its fee",
  ENGINEER_DESIGN_FEE_SHARE_BP === 3_500 && engineerDesignPayCents(300_000) === 105_000,
  `${ENGINEER_DESIGN_FEE_SHARE_BP / 100}%, ${money(engineerDesignPayCents(300_000))} on a $3,000 fee`,
);
rec(
  "and no hourly engineer rate survives anywhere in the pay file",
  !/ENGINEER_DESIGN_HOURLY_CENTS\s*=/.test(readFileSync("src/config/engineer-pay.ts", "utf8")),
  "the 35% rule replaced it",
);
{
  const payFile = readFileSync("src/config/engineer-pay.ts", "utf8");
  const stale = ["THE MAPPING IS PROVISIONAL", "AND THEY ARE PROVISIONAL BY HIS OWN RULING"].filter((h) =>
    payFile.includes(h),
  );
  rec(
    "and the pay file no longer rules the mapping provisional or lets a reading override it",
    stale.length === 0,
    stale.join("; ") || "Schedule 2 is signed",
  );
}
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
/*
 * ONGOING CONSTRUCTION WAS TIER 3 HERE FROM 2026-09-18. Schedule 2 does not
 * list it, so since 2026-10-22 it carries no tier, needs a signed scope
 * addendum before any job, and is refused at every order door until one is
 * recorded (operator ruling). The refusal is asserted at the door itself, not
 * at the declaration, because a declaration nothing reads is the
 * `WPI8_ONGOING_TIER` failure this file already records.
 */
{
  const ongoing = CATALOG.find((e) => e.serviceSlug === "windstorm-wpi-8" && e.tier === "ongoing");
  rec(
    "and ongoing construction carries no tier, because Schedule 2 does not list it",
    !("windstorm-wpi-8/ongoing" in TIER_BY_DELIVERABLE) && "windstorm-wpi-8/ongoing" in SCOPE_ADDENDUM_REQUIRED,
    String(TIER_BY_DELIVERABLE["windstorm-wpi-8/ongoing"] ?? "no tier, addendum required"),
  );
  /*
   * 0095, Robert's ruling of 2026-10-26: the signed record is the one home.
   * Configuration keeps WHICH deliverables need an addendum and never a list of
   * signed ones, so nothing a deploy types can open the line or pay for it.
   */
  rec(
    "and configuration holds no list of signed addenda, so only the signed record can cover it",
    !("SIGNED_SCOPE_ADDENDA" in ENGINEER_PAY_MODULE) && scopeAddendumMissing("windstorm-wpi-8", "ongoing") !== null,
    "SIGNED_SCOPE_ADDENDA" in ENGINEER_PAY_MODULE ? "a typed SIGNED_SCOPE_ADDENDA is back in engineer-pay.ts" : "none; the door reads eng_line_pay",
  );
  const blocked = orderBlockedReason(ongoing, "open", true);
  rec(
    "and the order door refuses it even with the gate open and a protocol approved",
    Boolean(ongoing) && blocked !== null,
    blocked ?? "IT COULD BE ORDERED",
  );
  const coveredReason = orderBlockedReason(ongoing, "open", true, true);
  rec(
    "and only a money door that has read his live signed addendum lets it through",
    Boolean(ongoing) && coveredReason === null,
    coveredReason ?? "orderable once his signature is read at the door",
  );
  const completed = CATALOG.find((e) => e.serviceSlug === "windstorm-wpi-8" && e.tier === "completed");
  rec(
    "while completed construction, which Schedule 2 lists, is not refused for it",
    scopeAddendumMissing("windstorm-wpi-8", "completed") === null && orderBlockedReason(completed, "open", true) === null,
    orderBlockedReason(completed, "open", true) ?? "orderable when the gate and its protocol allow",
  );
}
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
  scopeAddendumSigned: null,
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
    scopeAddendumSigned: false,
    paidBy: "invoice",
  });
  rec(
    "a custom design job with no signed scope addendum refuses, rather than estimating the engineer's share",
    design.ok === false && design.missing === "scope addendum",
    design.ok ? "it computed one" : design.because.slice(0, 80),
  );

  const signed = marginForJob({
    serviceSlug: "residential-light-commercial-design",
    chargedCents: 300_000,
    technicianVisits: 0,
    tier: null,
    scopeAddendumSigned: true,
    paidBy: "invoice",
  });
  rec(
    "and under a signed addendum pays 35% of the fee charged",
    signed.ok === true && signed.engineerCents === 105_000,
    signed.ok ? `${money(signed.engineerCents)} on a $3,000 fee` : signed.because,
  );

  const sizing = marginForJob({
    serviceSlug: "residential-light-commercial-design",
    chargedCents: 200_000,
    technicianVisits: 0,
    tier: 2,
    scopeAddendumSigned: null,
    paidBy: "invoice",
  });
  rec(
    "while beam and header sizing pays its Schedule 2 tier, $350, and needs no addendum",
    sizing.ok === true && sizing.engineerCents === 35_000,
    sizing.ok ? money(sizing.engineerCents) : sizing.because,
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
 * EVERY PRICED LINE'S MARGIN AT LIST, PRINTED. Operator ruling, 2026-10-22:
 * report any line whose margin goes negative once pay matches Schedule 2. It
 * is a report rather than a check on purpose: a line losing money at list is a
 * pricing decision for the operator, and a red board would hold every branch
 * behind a ruling only he can make. Before processing, one visit, the
 * Schedule 2 tier.
 */
{
  console.log("Margin at list, Schedule 2 pay, one $85 visit, before processing:");
  for (const slug of Object.keys(servicePrices)) {
    const est = estimateForLine(slug);
    if (!est.ok) {
      console.log(`  ${slug}: not estimated (${est.because.slice(0, 70)})`);
      continue;
    }
    const flag = est.netCents < 0 ? "   NEGATIVE" : "";
    const net = est.netCents < 0 ? `-${money(-est.netCents)}` : money(est.netCents);
    console.log(
      `  ${slug}: ${money(est.revenueCents)} less ${money(est.costCents)} (tier ${est.assumedTier}) = ${net}, ${est.marginPct}%${flag}`,
    );
  }
  console.log("");
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

/* ------------------------------------------------------------ cost per job */

/*
 * COST PER JOB, operator ruling of 2026-10-06 (docs/rulings-2026-10-06.md
 * section 7 item 2). The expected figures are WORKED BY HAND here from pinned
 * literals, never read back from the report's own inputs: WP-001 ongoing is
 * $995, four visits at $85, tier 3 at $525, and 2.9% plus 30 cents on $995 is
 * $29.16 (28.855 rounds to 28.86), so the net is $100.84. A report that read
 * its expectation from the code it reports would agree with itself whatever
 * that code said.
 */
{
  const RULED_RETAINER_CENTS = 150_000;
  const { ENGINEER_MONTHLY_RETAINER_CENTS } = await import("../src/config/engineer-pay.ts");
  rec("the engineer's monthly retainer is ruled at $1,500", ENGINEER_MONTHLY_RETAINER_CENTS === RULED_RETAINER_CENTS, money(ENGINEER_MONTHLY_RETAINER_CENTS));

  const { costPerJob } = await import("../src/lib/cost-per-job.ts");
  const report = costPerJob();
  rec("and the report carries it on its own line, not in any row", report.retainerCents === RULED_RETAINER_CENTS);

  /*
   * WP-001 ONGOING WAS PINNED HERE AT TIER 3, NET $100.84, until Schedule 2
   * (operator ruling, 2026-10-22) left it out: it pays nothing until a signed
   * scope addendum exists, so its row keeps its revenue and visits and states
   * NO engineer fee and NO net, rather than a net computed without a cost.
   */
  const ongoing = report.rows.find((r) => r.serviceSlug === "windstorm-wpi-8" && r.tier === "ongoing");
  rec(
    "WP-001 ongoing: $995, four visits at $85, no Schedule 2 tier, so no engineer fee and no net",
    ongoing?.revenueCents === 99_500 &&
      ongoing.visits === 4 &&
      ongoing.technicianCents === 34_000 &&
      ongoing.engineerCents === null &&
      ongoing.netCents === null,
    ongoing ? `${money(ongoing.revenueCents)}, ${ongoing.visits} visits, net ${ongoing.netCents === null ? "none" : money(ongoing.netCents)}` : "NO ROW",
  );

  /*
   * THE LINE SCHEDULE 2 PUT UNDER WATER, AND ITS RE-RULED PRICE. At tier 2 the
   * repair specification cost $435 against $395 and lost money at list; the
   * operator re-ruled it to $1,195 the same day (2026-10-22). Worked by hand:
   * 2.9% of $1,195 is $34.655, which rounds to $34.66 in cents, plus 30 cents
   * is $34.96, so the net is $1,195 less $85, $350 and $34.96: $725.04.
   */
  const repair = report.rows.find((r) => r.serviceSlug === "repair-specifications");
  rec(
    "repair specification: $1,195, one $85 visit, tier 2 at $350, card processing, net $725.04",
    repair?.revenueCents === 119_500 &&
      repair.technicianCents === 8_500 &&
      repair.engineerCents === 35_000 &&
      repair.processingCents === 3_496 &&
      repair.netCents === 72_504,
    repair ? `net ${repair.netCents === null ? "none" : money(repair.netCents)}` : "NO ROW",
  );

  const extra = report.rows.find((r) => r.serviceSlug === "windstorm-wpi-8" && r.tier === null);
  rec(
    "the extra visit is its own row at $150 against $85, and its missing engineer fee states no net",
    extra?.revenueCents === 15_000 && extra.technicianCents === 8_500 && extra.engineerCents === null && extra.netCents === null && Boolean(extra.missing),
    extra ? extra.missing?.slice(0, 70) ?? "no missing note" : "NO ROW",
  );

  const guessed = report.rows.filter((r) => r.engineerCents === null && r.netCents !== null);
  rec("no row states a net while a fee is missing", guessed.length === 0, guessed.map((r) => r.label).join("; ") || `${report.rows.length} rows`);

  /*
   * The three lines whose protocol sends a technician (conflicts items 16 and
   * 17, 20, 23) showed $0 technician cost and the best margins in the book,
   * found by reading the report. Operator ruling 7 of 2026-10-07 made them
   * field work, so each must now carry exactly one $85 visit.
   */
  const VISIT_LINES = ["solar-structural-letters", "structural-letters", "repair-specifications"];
  const unvisited = VISIT_LINES.filter((slug) => {
    const r = report.rows.find((x) => x.serviceSlug === slug);
    return !r || r.visits !== 1 || r.technicianCents !== 8_500;
  });
  rec("solar, the structural letter and the repair specification each carry one $85 visit", unvisited.length === 0, unvisited.join(", ") || "all three, per ruling 7");

  const deskWithVisit = report.rows.filter((r) => CATALOG.find((e) => e.serviceSlug === r.serviceSlug && e.tier === r.tier)?.orderType === "desk" && r.visits !== 0);
  rec("a desk deliverable carries no technician visit", deskWithVisit.length === 0, deskWithVisit.map((r) => r.label).join("; ") || "none does");
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
