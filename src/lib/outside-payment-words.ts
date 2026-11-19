/**
 * THE WORDS OF A PAYMENT RECEIVED OUTSIDE THE PLATFORM (0138), IN ONE PLACE.
 *
 * Shown to Robert for approval before the build (issue #1, 7002473972,
 * questions 9 and 10), built with these and staged, never merged, until he
 * approves or replaces them. Pure, so the customer's order page and the billing
 * code read the same sentences and the proof reads them without a database.
 *
 *   A, the staff record: the order's timeline (internal) and the audit row.
 *   B, the customer's order page, above the terms, which there read "The terms
 *      of your order" rather than "What you were told before you paid",
 *      because that heading would be false for an order paid this way.
 */

/** The order event carrying A (internal). */
export const OUTSIDE_PAYMENT_EVENT = "payment.recorded_outside";

/** The order event carrying B (customer visible), which the order page shows above the terms. */
export const TERMS_AFTER_PAYMENT_EVENT = "terms.stated_after_payment";

/** A, the staff record. */
export function outsidePaymentStaffRecord(input: {
  amount: string;
  reference: string;
  paidOn: string;
  recordedBy: string;
  recordedOn: string;
  reason: string;
}): string {
  return (
    `Paid outside the platform: ${input.amount} by Stripe invoice ${input.reference} on ${input.paidOn}, ` +
    `recorded by ${input.recordedBy} on ${input.recordedOn}. The refund terms below were stated after payment; ` +
    `they were not shown to the customer before they paid. Reason given: ${input.reason}`
  );
}

/** B, the line above the terms on the customer's order page. */
export function termsAfterPaymentLine(paidOn: string): string {
  return `These are the terms of your order. We set them out here after your payment, which you made by invoice on ${paidOn}.`;
}

/** The heading over the terms when B applies, in place of "What you were told before you paid". */
export const TERMS_AFTER_PAYMENT_HEADING = "The terms of your order";
