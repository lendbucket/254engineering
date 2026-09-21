/**
 * ===========================================================================
 * WHAT A JOB COSTS THE FIRM, OTHER THAN THE ENGINEER.
 * ===========================================================================
 *
 * Operator ruling, 2026-09-17. The engineer's production pay is in
 * src/config/engineer-pay.ts and is deliberately a separate file: it comes from
 * an executed employment agreement, which is a different authority from a rate
 * the operator sets, and the two should not be edited in one pass by somebody
 * adjusting one of them.
 */

/**
 * The field technician, per call, flat.
 *
 * FLAT PER CALL IS THE RULING AND IT IS WHY A SECOND VISIT COSTS AGAIN. A job
 * that needed two attendances cost two calls, which is the whole reason margin
 * is computed from what happened rather than from the plan. A rate per hour
 * would have made a long visit and a second visit indistinguishable in the
 * book, and they are not the same thing to the technician or to the customer.
 */
export const TECHNICIAN_CALL_CENTS = 8_500;

/**
 * ===========================================================================
 * PROCESSING IS RULED, AND IT IS A RATE PER PAYMENT METHOD RATHER THAN A RATE.
 * ===========================================================================
 *
 * **Operator ruling, 2026-09-20, read off the Stripe dashboard that day for
 * account `acct_1UFmIjA2kbTZN5C3`.** Recorded with its date and its source so
 * the next reader knows it came off the console and not from anybody's memory,
 * which is the rule section 6 makes about every external console this
 * repository cannot see.
 *
 * WHAT THIS REPLACES. Until today the rate was `null` and the book stated
 * margin "before card processing", a decision taken and flagged rather than a
 * default invented. The note that stood here said outright that 2.9% plus 30
 * cents "is the common Stripe shape and is NOT written here as a default,
 * because a plausible number in a money file is how a guess becomes a fact."
 * **The figure has turned out to be exactly that, and it still had to be read
 * before it could be written.** Being right about a guess is not the same as
 * knowing, and the difference is the dashboard.
 *
 * **IT IS THE DOMESTIC CARD RATE AND NOT THE RATE.** The dashboard says rates
 * vary by how a customer pays, so recording it as "the processing rate" would
 * flatten a real distinction: an account paying on invoice attracts the
 * invoicing rate instead. The book computes from how the job was ACTUALLY paid
 * and refuses when it cannot tell, the same as every other missing input.
 */
export type ProcessingRate = {
  /** Percentage of the charge, as a fraction. 2.9% is 0.029. */
  fraction: number;
  /** Fixed amount added per transaction, in cents. */
  fixedCents: number;
  /** What the dashboard calls it, so a reader can find the same line again. */
  dashboardName: string;
  /** Whether the order path uses it today. */
  inUse: boolean;
  /** What it applies to, in the dashboard's own terms. */
  applies: string;
};

/** When the dashboard was read, and by whom. A console record with no date is a note. */
export const PROCESSING_READ_ON = "2026-09-20";
export const PROCESSING_READ_FROM = "the Stripe dashboard, account acct_1UFmIjA2kbTZN5C3";
export const PROCESSING_READ_BY = "the operator";

/**
 * Keyed by how the job was paid. `marginForJob` looks the job's method up here
 * and refuses if the job does not say which it was.
 */
export const PROCESSING_RATES: Record<"card" | "invoice", ProcessingRate> = {
  card: {
    fraction: 0.029,
    fixedCents: 30,
    dashboardName: "Payments, standard pricing",
    inUse: true,
    applies: "domestic cards, per successful charge. The dashboard states that rates vary by how a customer pays.",
  },
  invoice: {
    fraction: 0.004,
    fixedCents: 0,
    dashboardName: "Invoicing Starter",
    inUse: true,
    applies: "one-time invoice payments",
  },
};

/**
 * ON THE ACCOUNT AND NOT IN USE ON THE ORDER PATH, recorded because a product
 * that is present and unused is a cost that can start applying without anybody
 * deciding to, and a record of what the console holds is the only thing that
 * would make that visible.
 */
export const PROCESSING_PRODUCTS_NOT_IN_USE: ProcessingRate[] = [
  {
    fraction: 0.007,
    fixedCents: 0,
    dashboardName: "Billing",
    inUse: false,
    applies: "0.7% of billing volume. The firm does not bill on subscription today.",
  },
  {
    fraction: 0,
    fixedCents: 0,
    dashboardName: "Radar Lite",
    inUse: false,
    applies: "$0.00 per screened transaction on this plan.",
  },
  {
    fraction: 0,
    fixedCents: 1.8,
    dashboardName: "Workflows",
    inUse: false,
    applies: "$0.018 per step with 10,000 free monthly. Nothing on the order path runs a Workflow.",
  },
];

/**
 * What processing costs on a charge of this size, paid this way, in cents.
 *
 * IT REFUSES AN UNKNOWN METHOD RATHER THAN READING UNDEFINED. The first version
 * indexed the table and returned `NaN` through a TypeError when handed anything
 * else, which is a money function failing in the least legible way available.
 * The audit is JavaScript, so the type on the parameter enforced nothing at its
 * call sites and a missing method reached here as `undefined`.
 */
export function processingCentsFor(method: "card" | "invoice", chargedCents: number): number {
  const rate = PROCESSING_RATES[method];
  if (!rate) {
    throw new Error(
      `processingCentsFor was asked for the rate on "${method}", which is not a payment method this firm has a rate for. ` +
        `The rates are keyed ${Object.keys(PROCESSING_RATES).join(" and ")}, and a job that does not say how it was paid should have been refused before reaching here.`,
    );
  }
  return Math.round(chargedCents * rate.fraction) + rate.fixedCents;
}

/**
 * Fuel and mileage are not in the marketed price and are not in the book
 * either, by the same ruling. They are a cost of running a field operation
 * rather than a cost of a job, and attributing them per job would need a
 * mileage record nobody keeps yet. Named here so their absence is a decision
 * somebody can find rather than an omission somebody assumes.
 */
export const FUEL_AND_MILEAGE_IN_BOOK = false;
