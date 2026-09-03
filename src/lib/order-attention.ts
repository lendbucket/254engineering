/**
 * Which orders need a person, and how urgently.
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-09-03 three orders took six hundred and seventy five dollars each and
 * sat at awaiting_payment because the webhook that would have recorded the
 * money was not subscribed to the event. Nothing anywhere counted them. They
 * were found by somebody going to look for a row.
 *
 * A platform that can lose a payment silently is one where the customer finds
 * out first, by telephoning to ask where their document is. So this decides,
 * from an order's own fields and the clock, whether it has stopped moving.
 *
 * PURE, AND THAT IS THE POINT
 * ---------------------------
 * No database and no network. The dashboard tile, the attention list and the
 * orders screen all read the same function, so they cannot disagree about what
 * is wrong, and order-audit walks every case including the boundary hours
 * without seeding anything.
 *
 * THE THRESHOLD, AND WHY IT IS NOT SHORTER
 * ----------------------------------------
 * A Stripe Checkout session lives 24 hours by default. Before that expires, an
 * order at awaiting_payment is simply a customer who has not finished, which is
 * ordinary and must not be reported as a fault: an operator who is shown four
 * false alarms a day stops reading the fifth. After it, the session can never
 * be paid again, so the row is either an abandonment nobody closed or a payment
 * nobody recorded, and those two are indistinguishable from inside. Both need
 * the provider asked.
 */

export const CHECKOUT_SESSION_HOURS = 24;

/** How much attention an order needs, worst first. */
export type AttentionLevel = "none" | "watch" | "act";

export type OrderAttention = {
  level: AttentionLevel;
  /** Short, for a chip. Empty when level is none. */
  label: string;
  /** What a person should actually do, in a sentence. */
  detail: string;
};

export type AttentionSubject = {
  status: string;
  /** When the order was placed. Null for a draft nobody submitted. */
  placedAt: string | null;
  /** Whether any charge has been recorded against it. */
  hasPayment: boolean;
  /** Whether a checkout was ever started, so there is a session to ask about. */
  hasCheckout: boolean;
};

const HOUR = 60 * 60 * 1000;

function hoursSince(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (now - t) / HOUR;
}

/**
 * Judge one order.
 *
 * Only awaiting_payment is ever a fault here. Everything downstream of payment
 * has its own screen and its own owner: a file sitting in review is the review
 * queue's problem, and duplicating that judgment here would produce two places
 * that disagree about whether a file is late.
 */
export function attentionFor(order: AttentionSubject, now: number = Date.now()): OrderAttention {
  const none: OrderAttention = { level: "none", label: "", detail: "" };

  /*
   * A paid order is never stuck for this reason, whatever its status says. This
   * is checked before the status so that a row which took money and then failed
   * to advance is not also reported as an unpaid one, which would send somebody
   * to ask Stripe a question that is already answered.
   */
  if (order.hasPayment) return none;

  if (order.status !== "awaiting_payment") return none;

  const age = hoursSince(order.placedAt, now);

  /*
   * Placed with no timestamp. Rare, and a fault in its own right rather than
   * something to wave through: without placed_at nothing can decide whether
   * this is minutes or months old, and the safe reading of an unknown age on an
   * unpaid order is that somebody should look.
   */
  if (age === null) {
    return {
      level: "act",
      label: "No placed date",
      detail:
        "This order is waiting for payment and carries no placed date, so nothing can tell how long it has been waiting. Ask the provider about it.",
    };
  }

  if (age < CHECKOUT_SESSION_HOURS) {
    return none;
  }

  /*
   * Past the session's life and no checkout was ever started. There is nothing
   * to ask the provider about, so this is a different job: an order that never
   * reached payment at all.
   */
  if (!order.hasCheckout) {
    return {
      level: "watch",
      label: "Never reached checkout",
      detail:
        "Waiting for payment for more than a day with no checkout ever started. Nothing can have been charged, so this is an abandoned order to close rather than money to find.",
    };
  }

  const days = Math.floor(age / 24);
  return {
    level: "act",
    label: days >= 1 ? `Stuck ${days} day${days === 1 ? "" : "s"}` : "Stuck",
    detail:
      "A checkout was started more than a day ago and no payment was ever recorded. The session can no longer be paid, so this is either an abandonment nobody closed or a payment nobody recorded. Ask the provider which.",
  };
}

/** The worst level in a set, for a single chip on a dashboard. */
export function worstLevel(levels: AttentionLevel[]): AttentionLevel {
  if (levels.includes("act")) return "act";
  if (levels.includes("watch")) return "watch";
  return "none";
}

/** The tone a chip or tile should carry for a level. Shared so they agree. */
export function toneFor(level: AttentionLevel): "neutral" | "good" | "warn" | "bad" {
  if (level === "act") return "bad";
  if (level === "watch") return "warn";
  return "good";
}
