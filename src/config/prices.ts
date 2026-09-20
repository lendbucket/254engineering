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
      /** The marketed price in cents. */
      cents: number;
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

/** The ongoing construction WPI-8 price, which is a second number on one line. */
export const WPI8_ONGOING_CENTS = 99_500;

export const servicePrices: Record<string, ServicePrice> = {
  "roof-inspections": {
    kind: "fixed",
    cents: 54_900,
    whatChangesIt:
      "A roof that cannot be safely walked and needs lift or drone access, a property outside the standard service area, or a return visit after repairs.",
  },
  "foundation-inspections": {
    kind: "fixed",
    cents: 49_500,
    whatChangesIt:
      "A structure over a certain size, a property outside the standard service area, or a second visit after remediation.",
  },
  "structural-letters": {
    kind: "fixed",
    cents: 39_500,
    whatChangesIt:
      "A desktop review assumes usable drawings or photographs exist. A site visit, where one is needed to answer the question honestly, is quoted before it is scheduled.",
  },
  "solar-structural-letters": {
    kind: "fixed",
    cents: 44_500,
    whatChangesIt:
      "An array on more than one structure, or a roof whose framing cannot be established from what is supplied.",
  },
  "manufactured-home-foundation-certifications": {
    kind: "fixed",
    cents: 64_500,
    whatChangesIt:
      "A multi section home, a property outside the standard service area, or a return visit after the anchoring is corrected.",
  },
  /*
   * TWO PRICES ON ONE LINE, AND THEY ARE DIFFERENT WORK RATHER THAN A TIER.
   * Completed construction is one visit to a finished structure. Ongoing
   * construction is inspected in stages while the work is open, which is more
   * attendance and a different obligation. The higher number is the one the
   * page leads with only where the reader is buying that.
   */
  "windstorm-wpi-8": {
    kind: "fixed",
    cents: 79_500,
    whatChangesIt:
      `This is the completed construction price. Ongoing construction, inspected in stages while the work is open, is ${money(WPI8_ONGOING_CENTS)} because it is more attendance rather than a premium on the same visit.`,
  },
  "repair-specifications": {
    kind: "fixed",
    cents: 39_500,
    whatChangesIt:
      "A specification covering more than one structural element, or one that has to be coordinated with a third party engineer's design.",
  },
  "residential-light-commercial-design": {
    kind: "hourly",
    rateCents: 22_500,
    minimumCents: 200_000,
    whatChangesIt:
      "A fixed fee is quoted from the engineer's estimate of the hours before any work starts. The minimum engagement is $2,000.",
  },
};

/** The price for a service line, or null when none is ruled. */
export function priceFor(serviceSlug: string): ServicePrice | null {
  return servicePrices[serviceSlug] ?? null;
}

/** The headline price sentence for a service page, or null when none is ruled. */
export function priceSentence(serviceSlug: string): string | null {
  const price = priceFor(serviceSlug);
  if (!price) return null;
  if (price.kind === "hourly") {
    return `${money(price.rateCents)} per hour, with a fixed fee quoted from the engineer's estimate before work starts. Minimum engagement ${money(price.minimumCents)}.`;
  }
  return money(price.cents);
}
