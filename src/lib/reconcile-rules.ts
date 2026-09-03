import type { CheckoutStatus } from "./payments";
import { money } from "./ops-money";

/**
 * What to conclude when the provider answers, with no database and no network.
 *
 * This is separated from ops-reconcile for the same reason order-flow is
 * separated from the component that renders it: the decisions are the part that
 * can be wrong in a way nobody notices, and a decision that needs Stripe and a
 * Supabase project to exercise is a decision that gets exercised once, by hand,
 * on a preview.
 *
 * Every case below is walked by order-audit, including the ones that must do
 * nothing. The dangerous verdicts here are not the ones that record a payment;
 * they are the ones that could cancel an order somebody paid for.
 */

export type ReconcileVerdict =
  | "paid_unrecorded"
  | "abandoned"
  | "still_open"
  | "agrees"
  | "amount_disagrees"
  | "no_session"
  | "unknown_to_provider"
  | "unreachable";

/** What the platform should do about it. Separate from whether it did. */
export type ReconcileIntent = "none" | "record_payment" | "cancel";

/** What the provider said, reduced to the three shapes that matter. */
export type ProviderAnswer =
  | { known: true; status: CheckoutStatus }
  | { known: false; reason: "no_session" }
  | { known: false; reason: "unknown_to_provider" }
  | { known: false; reason: "unreachable"; message: string };

export type Judgment = {
  verdict: ReconcileVerdict;
  intent: ReconcileIntent;
  /** One sentence an operator can act on without opening the provider. */
  detail: string;
};

export function judge(
  order: { totalCents: number | null },
  answer: ProviderAnswer,
): Judgment {
  if (!answer.known) {
    if (answer.reason === "no_session") {
      return {
        verdict: "no_session",
        intent: "none",
        detail:
          "No checkout was ever started for this order, so no money moved through one. If the customer says otherwise, look for the charge by hand.",
      };
    }
    if (answer.reason === "unknown_to_provider") {
      /*
       * The dangerous one. A session the provider does not recognise is almost
       * always an id from the other mode, and reading it as "not paid" would
       * cancel an order that had in fact been paid for.
       */
      return {
        verdict: "unknown_to_provider",
        intent: "none",
        detail:
          "The provider has no session with that id, which is usually a session created in the other mode. That is not evidence nothing was paid, so nothing was changed.",
      };
    }
    return {
      verdict: "unreachable",
      intent: "none",
      detail: `The provider could not be asked about this session: ${answer.message}`,
    };
  }

  const status = answer.status;

  if (!status.paid) {
    if (status.state === "open") {
      return {
        verdict: "still_open",
        intent: "none",
        detail: "The customer can still pay this. Nothing is wrong with it yet.",
      };
    }
    return {
      verdict: "abandoned",
      intent: "cancel",
      detail: "The checkout is closed and was never paid. The order can be cancelled and nothing was charged.",
    };
  }

  /*
   * Paid, but with nothing to record it against. A payment with no charge ref
   * cannot be written to the ledger, and writing the order forward without the
   * ledger row is how an order ends up paid with no money behind it.
   */
  if (status.chargeRef === null || status.amountCents === null) {
    return {
      verdict: "amount_disagrees",
      intent: "none",
      detail:
        "The provider says this was paid but gave no amount or no charge to record it against. This one needs a person.",
    };
  }

  /*
   * A disagreement is a finding, not a correction. Accepting the provider's
   * figure would quietly rewrite what the customer agreed to pay, and the
   * difference is precisely the thing somebody has to look at.
   *
   * An order that was never priced is the same refusal. There is nothing to
   * disagree with, and recording a charge against no total would leave a paid
   * order whose price nobody can reconstruct.
   */
  if (order.totalCents === null) {
    return {
      verdict: "amount_disagrees",
      intent: "none",
      detail: `The provider took ${money(status.amountCents)} and this order has no total on it. Nothing was recorded.`,
    };
  }

  if (status.amountCents !== order.totalCents) {
    return {
      verdict: "amount_disagrees",
      intent: "none",
      detail: `The provider took ${money(status.amountCents)} and this order totals ${money(order.totalCents)}. Nothing was recorded, because the difference is the part somebody has to decide about.`,
    };
  }

  return {
    verdict: "paid_unrecorded",
    intent: "record_payment",
    detail: `The provider took ${money(status.amountCents)} and this platform never recorded it.`,
  };
}
