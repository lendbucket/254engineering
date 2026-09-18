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
 * CARD PROCESSING IS A COST LINE AND ITS RATE IS NOT RULED.
 *
 * The operator's instruction was that processing is a cost in the book and
 * never a line on the site: a customer is not shown a fee for the firm's choice
 * of payment provider. What he has not given is the rate.
 *
 * SO THE BOOK STATES MARGIN "BEFORE CARD PROCESSING" RATHER THAN REFUSING, and
 * that is a decision taken and flagged rather than a default invented.
 *
 * The argument for computing: his own framing was that the marketed prices are
 * "before card processing", so a figure labelled the same way is complete as
 * stated rather than a figure with a hole in it. The argument against, which is
 * why this comment exists, is that every other missing input in this book
 * refuses outright, and an operator reading "margin" quickly will not read
 * "before card processing" slowly.
 *
 * It is therefore labelled at every render rather than in a footnote, and this
 * becomes a computed line the moment a rate is ruled. Two point nine percent
 * plus thirty cents is the common Stripe shape and is NOT written here as a
 * default, because a plausible number in a money file is how a guess becomes a
 * fact.
 */
export const CARD_PROCESSING_RATE: null = null;

/**
 * Fuel and mileage are not in the marketed price and are not in the book
 * either, by the same ruling. They are a cost of running a field operation
 * rather than a cost of a job, and attributing them per job would need a
 * mileage record nobody keeps yet. Named here so their absence is a decision
 * somebody can find rather than an omission somebody assumes.
 */
export const FUEL_AND_MILEAGE_IN_BOOK = false;
