/**
 * ===========================================================================
 * THE MARKETED PRICES. Operator ruling, 2026-09-17.
 * ===========================================================================
 *
 * These are the prices a customer is quoted, before card processing. Card
 * processing is a COST LINE in the price book and is never a line on the site:
 * a customer is not shown a fee for the firm's choice of payment provider.
 *
 * ONE HOME, WHICH IS THE WHOLE POINT. The operator's instruction was that a
 * price on the site derives from one place, so a price cannot be stated in two.
 * The price book in the portal reads this same file, so the number a customer is
 * charged and the number the margin is computed against cannot drift. That is
 * the fifth fact in this repository to get the treatment, after the firm
 * registration number, the telephone number, the firm name and the address, and
 * it is here BEFORE either consumer exists rather than after they disagreed.
 *
 * CENTS, NEVER DOLLARS AS A FLOAT. Phase 12 found amounts written in cents
 * reaching an accountant's spreadsheet as 67500, and the answer both ways is
 * that money is an integer of cents in the data and formatted exactly once on
 * the way out.
 *
 * A LINE WITH NO RULED PRICE HAS NO ENTRY, AND THAT IS NOT AN OVERSIGHT.
 * Forensic and insurance engineering is scoped per matter and the operator has
 * not ruled a number, so nothing here holds one and nothing on the site may
 * state one. `priceFor` returns null and the page says the work is quoted.
 * Inventing a plausible figure to fill the table is the exact defect the
 * placeholder audit exists to catch, applied to money.
 */

export type ServicePrice =
  | {
      kind: "fixed";
      /**
       * The marketed price in cents, PER CATALOGUE DELIVERABLE, keyed by the
       * deliverable's `tier`.
       *
       * A line selling one thing has one entry and reads no worse for it. A
       * line selling two, as WPI-8 does, has two, and that is the whole reason
       * this is a map rather than a number: see the note above `servicePrices`.
       */
      byTier: Record<string, number>;
      /**
       * Which deliverable the service page leads with, and the tier a per LINE
       * estimate is made at. Must be a key of `byTier`, which
       * `price-book-audit` asserts.
       */
      headlineTier: string;
      /** What moves it, in the words a customer would hear. Never empty. */
      whatChangesIt: string;
    }
  | {
      kind: "hourly";
      /** The hourly rate in cents. */
      rateCents: number;
      /** The minimum engagement in cents, below which the firm does not take it. */
      minimumCents: number;
      whatChangesIt: string;
    };

/**
 * Keyed by the slug in src/content/services.ts, which `compliance-audit` can
 * assert against so a price for a service that does not exist is a red board
 * rather than a dead entry.
 */
/**
 * Money as a person reads it. Formatted exactly once, on the way out, from an
 * integer of cents.
 *
 * Declared ABOVE the table because the table uses it, which is the fix for a
 * defect I introduced in the first draft of this file: the WPI-8 entry had
 * "$995" typed into its prose while `WPI8_ONGOING_CENTS` held the same number
 * twenty lines below. One fact, two homes, written by the session that spent
 * the night removing exactly that shape from four other facts. It was found by
 * reading the rendered page rather than the source, which is the only reason it
 * was found at all.
 */
export function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/*
 * =========================================================================
 * `WPI8_ONGOING_CENTS` IS RETIRED. Operator ruling, 2026-09-20.
 * =========================================================================
 *
 * It held $995 beside a table entry holding $795, because the line sells two
 * different jobs and the table was keyed by LINE and could not say so. That is
 * an EXCEPTION rather than a price, and this file had one, `engineer-pay.ts`
 * had another (`WPI8_ONGOING_TIER`, which nothing ever read), and
 * `trade-floors.ts` was about to need a third.
 *
 * **THREE FILES EACH BENDING AROUND ONE MISSING UNIT IS THE TELL THAT THE UNIT
 * IS WRONG, NOT THE THREE FILES.** The operator's ruling: widening the floor
 * key would fix the measurement and leave the price wrong, and widening both
 * rebuilds the tier system under a second name. So the deliverable splits,
 * `byTier` above is keyed the way the catalogue is keyed, and all three
 * exceptions retire into it.
 *
 * WPI-8 completed is `windstorm-wpi-8/completed` at $795, tier 2, floor $650.
 * WPI-8 ongoing is `windstorm-wpi-8/ongoing` at $995, tier 3, floor $925.
 */

/**
 * The two WPI-8 prices, named so the line's own prose can read them rather than
 * type them. This is the one fact and the sentence below is a view of it.
 */
const WPI8_BY_TIER: Record<string, number> = { completed: 79_500, ongoing: 99_500 };

/** The design minimum engagement, read by its own entry's prose rather than retyped. */
const DESIGN_MINIMUM_CENTS = 200_000;

export const servicePrices: Record<string, ServicePrice> = {
  "roof-inspections": {
    kind: "fixed",
    byTier: { standard: 54_900 },
    headlineTier: "standard",
    whatChangesIt:
      "A roof that cannot be safely walked and needs lift or drone access, a property outside the standard service area, or a return visit after repairs.",
  },
  "foundation-inspections": {
    kind: "fixed",
    byTier: { standard: 49_500 },
    headlineTier: "standard",
    whatChangesIt:
      "A structure over a certain size, a property outside the standard service area, or a second visit after remediation.",
  },
  "structural-letters": {
    kind: "fixed",
    byTier: { standard: 39_500 },
    headlineTier: "standard",
    whatChangesIt:
      "A desktop review assumes usable drawings or photographs exist. A site visit, where one is needed to answer the question honestly, is quoted before it is scheduled.",
  },
  "solar-structural-letters": {
    kind: "fixed",
    byTier: { standard: 44_500 },
    headlineTier: "standard",
    whatChangesIt:
      "An array on more than one structure, or a roof whose framing cannot be established from what is supplied.",
  },
  "manufactured-home-foundation-certifications": {
    kind: "fixed",
    byTier: { standard: 64_500 },
    headlineTier: "standard",
    whatChangesIt:
      "A multi section home, a property outside the standard service area, or a return visit after the anchoring is corrected.",
  },
  /*
   * TWO PRICES ON ONE LINE, AND THEY ARE DIFFERENT WORK RATHER THAN A TIER.
   * Completed construction is one visit to a finished structure. Ongoing
   * construction is inspected in stages while the work is open, which is more
   * attendance and a different obligation. The page leads with completed.
   *
   * THIS IS THE ENTRY `byTier` EXISTS FOR, and the sentence below no longer
   * types either number: both are read out of the map above, so the prose and
   * the price cannot say different things. The first draft of this file had
   * "$995" typed into this very sentence beside a constant holding the same
   * number, which is the defect the map removes rather than relocates.
   */
  "windstorm-wpi-8": {
    kind: "fixed",
    byTier: WPI8_BY_TIER,
    headlineTier: "completed",
    whatChangesIt: `This is the completed construction price, ${money(WPI8_BY_TIER.completed)}. Ongoing construction, inspected in stages while the work is open, is ${money(WPI8_BY_TIER.ongoing)} because it is more attendance rather than a premium on the same visit.`,
  },
  "repair-specifications": {
    kind: "fixed",
    byTier: { standard: 39_500 },
    headlineTier: "standard",
    whatChangesIt:
      "A specification covering more than one structural element, or one that has to be coordinated with a third party engineer's design.",
  },
  /*
   * THE PROSE READS THE MINIMUM RATHER THAN TYPING IT, and it used to type it.
   * This entry carried `minimumCents: 200_000` beside a sentence saying "The
   * minimum engagement is $2,000", which is one fact with two homes inside a
   * single object, in the file whose opening paragraph claims the treatment.
   * Found on 2026-09-20 while removing the same shape from the catalogue.
   */
  "residential-light-commercial-design": {
    kind: "hourly",
    rateCents: 22_500,
    minimumCents: DESIGN_MINIMUM_CENTS,
    whatChangesIt: `A fixed fee is quoted from the engineer's estimate of the hours before any work starts. The minimum engagement is ${money(DESIGN_MINIMUM_CENTS)}.`,
  },
};

/** The price for a service line, or null when none is ruled. */
export function priceFor(serviceSlug: string): ServicePrice | null {
  return servicePrices[serviceSlug] ?? null;
}

/**
 * The price a LINE leads with, in cents, or null for an hourly line.
 *
 * Replaces the old `price.cents`. A line selling one deliverable leads with it;
 * a line selling two leads with the one `headlineTier` names.
 */
export function headlinePriceCents(price: ServicePrice): number | null {
  if (price.kind === "hourly") return null;
  return price.byTier[price.headlineTier] ?? null;
}

/**
 * ===========================================================================
 * THE ONE ANSWER TO "WHAT DOES THIS DELIVERABLE COST". Operator ruling,
 * 2026-09-20.
 * ===========================================================================
 *
 * `data/catalog.ts` no longer types a price. It declares its deliverables
 * without one and fills `priceCents` by calling this, so the number a card is
 * charged is the number the site publishes, by construction rather than by
 * anybody remembering to change two files.
 *
 * **DESIGN FALLS OUT OF THE RULE RATHER THAN BEING TYPED**, which is the part
 * that makes this worth doing. An hourly line quotes every deliverable it sells,
 * because the price depends on hours nobody has estimated yet. Nothing in the
 * catalogue states that and nothing has to: the moment a line is `hourly`, its
 * deliverables are quoted. The operator's ruling that design comes off fixed
 * prices is therefore mechanical, and a future fixed price typed onto a design
 * deliverable cannot take effect.
 *
 * NULL IS QUOTED, AND IT IS NOT A GAP. Three states reach null and each is a
 * real answer: an hourly line, a line the operator has ruled no price for
 * (forensic, scoped per matter), and a deliverable whose line states a price for
 * other tiers but not this one. The third is a drift `price-book-audit` fails
 * on rather than a quote, which is why the audit asserts every catalogue
 * deliverable resolves rather than trusting that null means quoted.
 */
export function deliverablePriceCents(serviceSlug: string, tier: string): number | null {
  const price = priceFor(serviceSlug);
  if (!price) return null;
  if (price.kind === "hourly") return null;
  return price.byTier[tier] ?? null;
}

/** The minimum engagement for an hourly line, or null when the line is not hourly. */
export function minimumEngagementCents(serviceSlug: string): number | null {
  const price = priceFor(serviceSlug);
  return price && price.kind === "hourly" ? price.minimumCents : null;
}

/** The headline price sentence for a service page, or null when none is ruled. */
export function priceSentence(serviceSlug: string): string | null {
  const price = priceFor(serviceSlug);
  if (!price) return null;
  if (price.kind === "hourly") {
    return `${money(price.rateCents)} per hour, with a fixed fee quoted from the engineer's estimate before work starts. Minimum engagement ${money(price.minimumCents)}.`;
  }
  const headline = headlinePriceCents(price);
  return headline === null ? null : money(headline);
}
