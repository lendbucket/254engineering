import type { Cents } from "./ops-money";
import { isKnown, money } from "./ops-money";

/**
 * Whether an account may place another order.
 *
 * WHY THIS IS PURE, AND WHY IT IS ITS OWN FILE
 * --------------------------------------------
 * It decides whether the firm takes on work it may not be paid for. That is a
 * commercial rule, it will be argued about, and it must be exercisable without a
 * database. order-audit walks every case below, including the ones where the
 * answer is "no", which are the ones that cost a customer an order.
 *
 * THE OPERATOR'S RULE, AND THE ONE INVERSION IT FORBIDS
 * -----------------------------------------------------
 * Credit terms are per organisation with a default of NONE. An account over its
 * limit or overdue is refused new orders with a clear reason.
 *
 * "Default of none" is load bearing and is the thing most likely to be got
 * wrong. A null credit limit means NO credit, not unlimited. Written the other
 * way round, every account created before somebody remembered to set a limit
 * would have an infinite one, and the first anybody would know is a large
 * unpaid balance. Null is the restrictive case here and the audit asserts it.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * No dunning, no collections, no escalation, no automatic suspension. The
 * operator ruled that the state is made visible and nothing chases it. A rule
 * that decides an account is delinquent and acts on it is a rule that will one
 * day be wrong about a customer who is on the telephone explaining why.
 */

export type BillingMode = "card" | "invoice";

export type CreditSubject = {
  billingMode: BillingMode;
  status: "active" | "suspended" | "closed";
  /** Null means no credit. Never unlimited. */
  creditLimitCents: Cents;
  /** What is on issued statements and unpaid, plus work not yet billed. */
  outstandingCents: Cents;
  /** Age in days of the oldest unpaid issued statement. Null when none. */
  oldestUnpaidDays: number | null;
  netDays: number;
};

export type CreditVerdict = {
  ok: boolean;
  /** Machine readable, for the audit and for a screen to branch on. */
  reason:
    | "ok"
    | "card_account"
    | "account_suspended"
    | "account_closed"
    | "no_credit_terms"
    | "over_limit"
    | "overdue"
    | "outstanding_unknown";
  /** Said to the customer. Plain, and it never blames them for a setting. */
  message: string;
};

const OK: CreditVerdict = { ok: true, reason: "ok", message: "" };

export function creditDecision(subject: CreditSubject, orderCents: Cents): CreditVerdict {
  if (subject.status === "closed") {
    return {
      ok: false,
      reason: "account_closed",
      message: "This account is closed. Speak to the firm before placing further work.",
    };
  }

  if (subject.status === "suspended") {
    return {
      ok: false,
      reason: "account_suspended",
      message: "This account is suspended. Speak to the firm before placing further work.",
    };
  }

  /*
   * A card account is not on credit at all, so none of the rest applies. It
   * pays at submission exactly as a consumer does, and refusing it for an
   * unpaid statement it can never have would be nonsense.
   */
  if (subject.billingMode === "card") return { ...OK, reason: "card_account" };

  /*
   * Overdue is checked BEFORE the limit, deliberately. An account that is
   * within its limit but has not paid a statement from ninety days ago is the
   * worse case, and telling them they are over their limit would be both wrong
   * and confusing.
   */
  if (subject.oldestUnpaidDays !== null && subject.oldestUnpaidDays > subject.netDays) {
    return {
      ok: false,
      reason: "overdue",
      message: `There is a statement outstanding beyond the ${subject.netDays} day terms on this account. Settling it opens ordering again.`,
    };
  }

  if (!isKnown(subject.creditLimitCents)) {
    return {
      ok: false,
      reason: "no_credit_terms",
      message:
        "This account is set to be invoiced and no credit limit has been agreed yet. The firm sets one before invoiced work can be placed.",
    };
  }

  /*
   * An unknown balance refuses rather than assuming zero. Assuming zero is
   * assuming the flattering direction, which is exactly the mistake Phase 6
   * exists to prevent: an absent figure is not a zero.
   */
  if (!isKnown(subject.outstandingCents)) {
    return {
      ok: false,
      reason: "outstanding_unknown",
      message:
        "The balance on this account could not be worked out, so nothing further is being placed against it until it can.",
    };
  }

  const projected = subject.outstandingCents + (isKnown(orderCents) ? orderCents : 0);
  if (projected > subject.creditLimitCents) {
    return {
      ok: false,
      reason: "over_limit",
      message: `This order would take the account to ${money(projected)} against a limit of ${money(
        subject.creditLimitCents,
      )}. Settling an outstanding statement, or agreeing a higher limit with the firm, opens ordering again.`,
    };
  }

  return OK;
}

/**
 * How much of an account's balance is not yet on a statement.
 *
 * Kept separate from the decision so a screen can show the two figures apart:
 * an operator asking "what do they owe" means something different from "what
 * have we not billed yet", and a single number hides which one is growing.
 */
export function outstandingOf(input: {
  issuedUnpaidCents: Cents;
  unbilledCents: Cents;
}): Cents {
  if (!isKnown(input.issuedUnpaidCents) || !isKnown(input.unbilledCents)) return null;
  return input.issuedUnpaidCents + input.unbilledCents;
}
