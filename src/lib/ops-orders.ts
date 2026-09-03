import type { CatalogEntry, Qualifier } from "@data/catalog";
import { add, isKnown, money, type Cents } from "./ops-money";

/**
 * The order engine's pure core: qualification, price composition, the refund
 * rule, and the two state machines.
 *
 * Nothing here touches a database, a payment provider, or a request. That is
 * what lets `order-audit` assert the rules that carry money and professional
 * obligation without standing up a server, and it is why the refund rule can be
 * tested against every combination rather than the two a walkthrough happens to
 * produce.
 *
 * THE ONE PRINCIPLE ABOVE THE REST
 * --------------------------------
 * Operator ruling, 2026-09-02: no refund rule may create financial pressure on
 * the engineer toward a favourable conclusion.
 *
 * It is stated again here rather than only in the program document, because this
 * file is where somebody would change the rule, and a principle recorded three
 * directories away is one they will not read first. `refundFor` carries the
 * invariants that enforce it, and `order-audit` fails on any change that breaks
 * them.
 */

// ============================================================ qualification

export type QualifierAnswer = { qualifierId: string; optionIndex: number };

export type Qualification =
  | { ok: true }
  | { ok: false; qualifierId: string; message: string }
  | { ok: false; qualifierId: string; message: string; unanswered: true };

/**
 * Does this customer's set of answers let the firm take the order?
 *
 * AN UNANSWERED QUESTION IS NOT A PASS
 * ------------------------------------
 * The obvious implementation checks the answers it was given against the
 * disqualifying list, which quietly qualifies anybody who skipped the question.
 * The one that matters here is "can the roof be reached safely", and skipping it
 * would put a technician on a ladder the customer already knew was unsafe.
 *
 * So every qualifier must be answered, and an answer outside the option range is
 * a refusal rather than a fallback.
 */
export function qualify(entry: CatalogEntry, answers: QualifierAnswer[]): Qualification {
  const byId = new Map(answers.map((a) => [a.qualifierId, a.optionIndex]));

  for (const qualifier of entry.qualifiers) {
    const answer = byId.get(qualifier.id);

    if (answer === undefined) {
      return {
        ok: false,
        qualifierId: qualifier.id,
        message: `This one still needs an answer: ${qualifier.prompt}`,
        unanswered: true,
      };
    }
    if (!Number.isInteger(answer) || answer < 0 || answer >= qualifier.options.length) {
      return {
        ok: false,
        qualifierId: qualifier.id,
        message: `That is not one of the answers to: ${qualifier.prompt}`,
        unanswered: true,
      };
    }
    if (qualifier.disqualifyOn.includes(answer)) {
      return { ok: false, qualifierId: qualifier.id, message: qualifier.disqualifiedMessage };
    }
  }

  return { ok: true };
}

/** Questions with no disqualifying answer still have to be asked and recorded. */
export const isGating = (qualifier: Qualifier): boolean => qualifier.disqualifyOn.length > 0;

// ================================================================== pricing

export type PriceLine = {
  /** Shown to the customer exactly as written. */
  label: string;
  /** Why this line exists, in plain language. Never omitted on a surcharge. */
  note: string | null;
  amountCents: Cents;
};

export type Quote = {
  lines: PriceLine[];
  totalCents: Cents;
  /** Set when the total cannot be computed, and why. Never a zero total. */
  unavailable: string | null;
};

/**
 * The price a customer sees, as named lines.
 *
 * COASTAL IS ITS OWN LINE, NEVER A LARGER NUMBER
 * ----------------------------------------------
 * Operator ruling, 2026-09-02. A customer comparing a Nueces property against a
 * published inland price will notice the difference, and finding out afterwards
 * is how a fixed price stops feeling fixed. So the surcharge appears as its own
 * line with its own explanation, and the base line always shows the published
 * price unchanged.
 *
 * A missing price produces an unavailable quote rather than a total of zero.
 * There is no arithmetic here that can turn an absent figure into a number: the
 * total comes from `add`, which returns null the moment any part is unknown.
 */
export function quoteFor(entry: CatalogEntry, twiaCounty: boolean, countyName?: string): Quote {
  const lines: PriceLine[] = [
    { label: entryLabel(entry), note: null, amountCents: entry.priceCents },
  ];

  if (twiaCounty) {
    lines.push({
      label: "Coastal county",
      note: `${
        countyName ? `${countyName} County is` : "This county is"
      } inside the windstorm designated area. Work there carries requirements and evidence that inland work does not, and this line is that difference rather than a higher price hidden in the total.`,
      amountCents: entry.coastalSurchargeCents,
    });
  }

  const totalCents = add(...lines.map((l) => l.amountCents));

  let unavailable: string | null = null;
  if (!isKnown(entry.priceCents)) {
    unavailable = "A price has not been published for this service yet.";
  } else if (twiaCounty && !isKnown(entry.coastalSurchargeCents)) {
    unavailable =
      "This property is in a windstorm designated county and the coastal difference has not been published yet, so the firm will not quote a total it cannot stand behind.";
  }

  return { lines, totalCents, unavailable };
}

const entryLabel = (entry: CatalogEntry): string =>
  entry.orderType === "field" ? "Inspection and sealed document" : "Sealed document";

// ================================================================= refunds

export type ReviewOutcome = "seal" | "refuse";

export type RefundInput = {
  paidCents: Cents;
  inspectionFeeCents: Cents;
  outcome: ReviewOutcome;
  /** Did a technician actually attend? Not "was one dispatched". */
  technicianVisited: boolean;
};

export type Refund = {
  refundCents: Cents;
  retainedCents: Cents;
  /** The case this fell into, named the way the checkout disclosure names it. */
  caseName: string;
  /** Said to the customer. Plain language, no policy voice. */
  explanation: string;
  /** Whether the customer receives what the engineer found. */
  receivesFindings: boolean;
};

/**
 * The refund rule, in the three cases the operator ruled on 2026-09-02.
 *
 * | What happened                          | The customer receives             |
 * | Declined before any visit or review    | Full refund                       |
 * | Declined after a technician visited    | Refund less the inspection fee,   |
 * |                                        | and the engineer's findings       |
 * | Declined after desk review, no visit   | Full refund                       |
 *
 * WHY THE MIDDLE ROW IS WRITTEN THAT WAY
 * --------------------------------------
 * The technician drove out and was paid. If that visit were refunded on a
 * decline, the firm would be paid more for certifying than for refusing, and the
 * engineer would be deciding under exactly the pressure a professional practice
 * must not have. The customer pays for the inspection whether or not the answer
 * is the one they wanted, so the answer costs the firm nothing either way.
 *
 * THREE INVARIANTS THIS FUNCTION CARRIES, AND order-audit ENFORCES
 * ----------------------------------------------------------------
 * 1. A refusal with no visit is a full refund. Always, with no exceptions and no
 *    parameter that can change it.
 * 2. What the firm retains on a refusal is exactly the disclosed inspection fee,
 *    never a proportion of the price and never more than was paid.
 * 3. When the firm retains anything, the customer receives the engineer's
 *    findings. Keeping money and handing over nothing is not a refund policy.
 *
 * A change that breaks any of the three is a change to a professional ethics
 * rule, and it should be hard, visible, and argued for.
 */
export function refundFor(input: RefundInput): Refund {
  if (input.outcome === "seal") {
    return {
      refundCents: 0,
      retainedCents: input.paidCents,
      caseName: "Sealed",
      explanation:
        "The engineer sealed the document. It is yours, and there is nothing to refund.",
      receivesFindings: true,
    };
  }

  if (!input.technicianVisited) {
    /*
     * Covers both "declined before any visit or review" and "declined after desk
     * review, no visit". They are one case in the code because the money is the
     * same in both, and splitting them would be two branches that must never
     * diverge.
     */
    return {
      refundCents: input.paidCents,
      retainedCents: 0,
      caseName: "Declined with no site visit",
      explanation:
        "The engineer could not seal this and nobody attended the property, so the full amount is refunded. You keep what the engineer found.",
      receivesFindings: true,
    };
  }

  if (!isKnown(input.inspectionFeeCents) || !isKnown(input.paidCents)) {
    /*
     * Refuses to compute rather than guessing. A refund calculated from a
     * missing fee would be a number sent to a customer's card, and there is no
     * safe direction to guess in.
     */
    return {
      refundCents: null,
      retainedCents: null,
      caseName: "Declined after a site visit",
      explanation:
        "The engineer could not seal this. A technician did attend, and the refund cannot be worked out until the disclosed inspection fee is on record. Nobody should act on this until it is.",
      receivesFindings: true,
    };
  }

  /*
   * Never more than was paid. If somebody sets an inspection fee above the
   * price, the customer is refunded nothing rather than charged the difference,
   * and the catalog should not have allowed it in the first place; order-audit
   * checks that too.
   */
  const retained = Math.min(input.inspectionFeeCents, input.paidCents);

  return {
    refundCents: input.paidCents - retained,
    retainedCents: retained,
    caseName: "Declined after a site visit",
    explanation: `The engineer could not seal this. A technician attended and documented the property, and that inspection is ${money(
      retained,
    )} of what you paid. The rest is refunded, and you receive what the engineer found and why they could not seal it.`,
    receivesFindings: true,
  };
}

/**
 * The disclosure shown at the price step, before payment.
 *
 * Operator ruling: in plain language, before payment, not in a terms link nobody
 * opens. It is generated from the same catalog entry the price came from, so a
 * disclosure can never describe a fee different from the one that would actually
 * be retained.
 */
export function refundDisclosure(entry: CatalogEntry): string[] {
  const lines = [
    "The engineer reviews what is gathered and decides. They may seal it, ask for revisions, ask for another visit, or decline to seal.",
  ];

  if (entry.orderType === "field") {
    lines.push(
      `If they decline before anyone attends the property, you are refunded in full.`,
      isKnown(entry.inspectionFeeCents)
        ? `If they decline after a technician has attended, you are refunded everything except the ${money(
            entry.inspectionFeeCents,
          )} inspection, and you receive what the engineer found and why they could not seal it.`
        : `If they decline after a technician has attended, an inspection fee is retained. That fee is not published yet, which is why this service cannot be ordered online today.`,
      "You are never charged more than the price shown above, and a decline is never a reason for a further charge.",
    );
  } else {
    lines.push(
      "There is no site visit on this service, so if they decline you are refunded in full and you still receive what the engineer found.",
    );
  }

  lines.push(
    "Paying does not buy a seal. It buys the review by a licensed Professional Engineer, and their conclusion is theirs.",
  );

  return lines;
}

// =========================================================== order lifecycle

export type OrderStatus =
  | "draft"
  | "awaiting_payment"
  | "paid"
  | "in_fulfilment"
  | "complete"
  | "refunded"
  | "cancelled";

export const ORDER_STATUSES: OrderStatus[] = [
  "draft",
  "awaiting_payment",
  "paid",
  "in_fulfilment",
  "complete",
  "refunded",
  "cancelled",
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "Started",
  awaiting_payment: "Waiting for payment",
  paid: "Paid",
  in_fulfilment: "Being worked",
  complete: "Complete",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

/**
 * What the customer is told, in their words rather than the firm's.
 *
 * "in_fulfilment" is a word nobody outside this repository uses. The customer
 * portal exists to stop the "where is my letter" call, and it does not do that
 * by showing somebody a status they have to interpret.
 */
export const CUSTOMER_STATUS: Record<OrderStatus, string> = {
  draft: "You have not finished placing this order.",
  awaiting_payment: "Nothing has been charged yet.",
  paid: "Paid. The firm is arranging the work.",
  in_fulfilment: "Underway. You will be told when the engineer has decided.",
  complete: "Finished. Your document is below.",
  refunded: "Refunded. What the engineer found is below.",
  cancelled: "Cancelled. Nothing is owed.",
};

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ["awaiting_payment", "cancelled"],
  awaiting_payment: ["paid", "cancelled"],
  paid: ["in_fulfilment", "refunded", "cancelled"],
  in_fulfilment: ["complete", "refunded"],
  complete: ["refunded"],
  refunded: [],
  cancelled: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

// =========================================================== quote lifecycle

export type QuoteStatus = "new" | "scoping" | "sent" | "accepted" | "declined" | "expired";

export const QUOTE_STATUSES: QuoteStatus[] = [
  "new",
  "scoping",
  "sent",
  "accepted",
  "declined",
  "expired",
];

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  new: "New request",
  scoping: "Being scoped",
  sent: "Sent to the customer",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};

const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  new: ["scoping", "declined"],
  scoping: ["sent", "declined"],
  sent: ["accepted", "declined", "expired"],
  accepted: [],
  declined: [],
  expired: ["scoping"],
};

export function canTransitionQuote(from: QuoteStatus, to: QuoteStatus): boolean {
  return QUOTE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Only an accepted quote becomes an order.
 *
 * A sent quote that somebody converts by hand is an order the customer never
 * agreed to at a price they never accepted, which is the shape of a billing
 * dispute.
 */
export const convertibleToOrder = (status: QuoteStatus): boolean => status === "accepted";

// ============================================================ where it lands

/**
 * Where a paid order goes.
 *
 * A field order needs a technician before an engineer has anything to look at. A
 * desk order already has everything, so it goes straight into the review queue
 * and a dispatch it does not need is never created.
 */
export function landingStatusFor(orderType: CatalogEntry["orderType"]): string | null {
  if (orderType === "field") return "needs_dispatch";
  if (orderType === "desk") return "evidence_submitted";
  return null;
}
