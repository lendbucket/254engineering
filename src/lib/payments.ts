/**
 * The payment provider boundary.
 *
 * WHY THERE IS A BOUNDARY AT ALL, GIVEN THERE IS ONE PROVIDER
 * -----------------------------------------------------------
 * Not to make Stripe swappable. Nobody is swapping Stripe.
 *
 * It exists so the refund rule can be exercised without a network. The rule is
 * a professional ethics decision the operator ruled on, and the code that
 * carries it out is the code that moves a customer's money back. Testing that
 * only against a live provider means testing it rarely, from a preview, by
 * hand, and never in the audit suite. With a fake provider the whole path runs
 * in a second: order placed, charged, declined by an engineer, refunded less
 * the disclosed inspection fee, with rows to prove each step.
 *
 * The second reason is that the Stripe test keys live on the Preview
 * environment. Without a fake there is no way to verify any of this locally at
 * all, and "it worked when I clicked it on a preview" is not verification.
 *
 * WHAT THE BOUNDARY IS DELIBERATELY NOT
 * -------------------------------------
 * It is not an abstraction over payments in general. It has exactly the four
 * operations this firm performs, named in this firm's terms, and it returns
 * plain data. A generic gateway interface would invite the provider's concepts
 * back in and the whole point is to keep them on one side.
 */

export type CheckoutRequest = {
  /** Our order reference, shown on the customer's statement and in Stripe. */
  reference: string;
  orderId: string;
  amountCents: number;
  currency: string;
  customerEmail: string;
  /** What the customer is buying, in their words. */
  description: string;
  /** Named lines, so the coastal difference is visible in the checkout too. */
  lines: { label: string; amountCents: number }[];
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSession = {
  /** The provider's id for this attempt. Stored as provider_ref. */
  ref: string;
  /** Where to send the customer. */
  url: string;
};

export type RefundRequest = {
  /** The provider ref of the charge being refunded. */
  chargeRef: string;
  amountCents: number;
  /** Which of the three cases, for the provider's own record. */
  reason: string;
};

export type RefundResult = {
  ref: string;
  amountCents: number;
  status: "pending" | "succeeded" | "failed";
  failureReason?: string;
};

/**
 * A provider event, already verified and reduced to what this platform acts on.
 *
 * Everything else Stripe sends is ignored by name rather than by accident: the
 * adapter returns null for an event this firm has no behaviour for, so a new
 * webhook type cannot silently take a code path meant for another.
 */
export type PaymentEvent =
  | {
      kind: "checkout.completed";
      /** The session ref we handed out. */
      sessionRef: string;
      /** The charge or payment intent that actually took the money. */
      chargeRef: string;
      amountCents: number;
      orderId: string | null;
    }
  | { kind: "checkout.expired"; sessionRef: string; orderId: string | null }
  | {
      kind: "charge.refunded";
      chargeRef: string;
      refundRef: string;
      amountCents: number;
    };

export type PaymentProvider = {
  readonly name: string;
  /** True when it can actually reach the provider. */
  configured(): boolean;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  refund(request: RefundRequest): Promise<RefundResult>;
  /**
   * Verify a webhook and reduce it, or throw if the signature is wrong.
   *
   * Throwing on a bad signature rather than returning null is deliberate: an
   * unverified webhook is an attacker telling the platform an order was paid,
   * and the two must never be handled by the same branch as "an event I do not
   * care about".
   */
  readEvent(rawBody: string, signature: string | null): PaymentEvent | null;
};

// ---------------------------------------------------------------- the fake

/**
 * The in-memory provider used by the walkthrough and the audit.
 *
 * It records what it was asked to do so a test can assert the AMOUNT that would
 * have moved, which is the part that matters. A refund of the wrong amount is
 * the defect the refund rule exists to prevent, and it is invisible if the test
 * only checks that a refund happened.
 */
export type FakeLedgerEntry =
  | { kind: "checkout"; reference: string; amountCents: number; lines: { label: string; amountCents: number }[] }
  | { kind: "refund"; chargeRef: string; amountCents: number; reason: string };

export function fakeProvider(): PaymentProvider & { ledger: FakeLedgerEntry[] } {
  const ledger: FakeLedgerEntry[] = [];
  let n = 0;

  /*
   * Unique per process, because the refs go into a unique index that outlives
   * the process.
   *
   * The first version numbered from zero on every start, so a second run of the
   * walkthrough against the same development database collided on
   * (provider, provider_ref) and the refund row silently failed to insert. The
   * fake was wrong, not the schema, and a real provider never issues the same
   * id twice. It did surface a real defect in settleDecision, which used to
   * report a refund it had not recorded.
   */
  const run = Math.random().toString(36).slice(2, 10);

  return {
    name: "fake",
    ledger,
    configured: () => true,

    async createCheckout(request) {
      n += 1;
      ledger.push({
        kind: "checkout",
        reference: request.reference,
        amountCents: request.amountCents,
        lines: request.lines,
      });
      return {
        ref: `cs_fake_${run}_${n}`,
        url: `https://checkout.invalid/fake/${request.reference}`,
      };
    },

    async refund(request) {
      ledger.push({
        kind: "refund",
        chargeRef: request.chargeRef,
        amountCents: request.amountCents,
        reason: request.reason,
      });
      return { ref: `re_fake_${run}_${ledger.length}`, amountCents: request.amountCents, status: "succeeded" };
    },

    readEvent(rawBody, signature) {
      /*
       * The fake still refuses an unsigned body. A test that could skip the
       * signature would be a test of a code path production does not have.
       */
      if (signature !== "fake-signature") throw new Error("bad signature");
      const parsed = JSON.parse(rawBody) as PaymentEvent;
      return parsed;
    },
  };
}
