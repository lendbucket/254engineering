/**
 * WHO GETS CREDIT FOR AN ORDER, AND WHY.
 *
 * Pure. No database, no environment, no network, so every rule below is
 * exercisable exactly rather than approximately, and the audit asserts the RULE
 * rather than the implementation.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM THE CODE THAT WRITES ROWS
 * --------------------------------------------------------------
 * If attribution is wrong, partners stop trusting the program and the program
 * dies. It has to be arguable, which means somebody has to be able to read the
 * rule, disagree with it, and point at the sentence they disagree with. A rule
 * spread across a capture handler, a checkout route and a reporting query is a
 * rule nobody can argue with, which in practice means a rule nobody trusts.
 *
 * So it is one function, and the four decisions it makes are written out below
 * in the order it makes them.
 */

/** How long a touch counts for. */
export const ATTRIBUTION_WINDOW_DAYS = 90;

export type Touch = {
  partnerId: string;
  /** The code as captured, already normalised. */
  code: string;
  occurredAtMs: number;
  /** "link" for a click, "code" for something typed at checkout. */
  kind: "link" | "code";
};

export type AttributionInput = {
  /** Every touch known for this buyer, in any order. */
  touches: Touch[];
  /**
   * When the order was placed. Everything is measured from here rather than
   * from "now", so re-running attribution on an old order gives the answer it
   * gave at the time.
   */
  orderAtMs: number;
  /**
   * When this buyer's FIRST paid order with the firm was placed, if any.
   * Null for somebody who has never bought before.
   */
  firstPaidOrderAtMs: number | null;
};

export type Attribution =
  | { attributed: true; partnerId: string; code: string; kind: Touch["kind"]; because: string }
  | { attributed: false; because: string };

/**
 * The rule, in the order it is applied.
 *
 * 1. A CODE TYPED AT CHECKOUT BEATS A CLICK.
 *
 *    Somebody typing a partner's code is making a deliberate statement about
 *    who sent them, and it is better evidence than a cookie set by whatever
 *    they last clicked. It is also the only capture available for the way most
 *    real referrals happen, which is somebody saying a name out loud.
 *
 * 2. OTHERWISE THE MOST RECENT TOUCH INSIDE THE WINDOW WINS.
 *
 *    Last touch rather than first, and the window is what makes that fair. A
 *    partner whose click was ninety one days ago did not cause this order; a
 *    partner whose click was yesterday probably did. First touch would mean a
 *    partner earning forever from one introduction the customer had forgotten,
 *    and would make the program impossible to explain to the second partner.
 *
 * 3. A TOUCH OUTSIDE THE WINDOW IS NOT A TOUCH.
 *
 *    Ninety days. Long enough for a roof certification somebody is arranging
 *    around a sale, short enough that it describes a real influence.
 *
 * 4. AN EXISTING CUSTOMER IS NOT A NEW CLIENT, AND THIS IS THE RULE THAT
 *    PROTECTS THE FIRM.
 *
 *    A buyer who already had a paid order BEFORE the partner's touch was not
 *    brought by that partner. Without this, a partner can send their link to
 *    the firm's existing customers and earn on business the firm already had,
 *    which is the single easiest way for this program to cost more than it
 *    makes.
 *
 *    The comparison is against the touch, not against the order: a partner who
 *    genuinely introduced somebody in March still earns when that customer
 *    orders again in April through the same partner. What is excluded is a
 *    touch that arrives after the relationship already existed.
 */
export function attribute(input: AttributionInput): Attribution {
  const windowMs = ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const inWindow = input.touches.filter(
    (t) =>
      t.occurredAtMs <= input.orderAtMs && input.orderAtMs - t.occurredAtMs <= windowMs,
  );

  if (inWindow.length === 0) {
    return {
      attributed: false,
      because: input.touches.length
        ? `every touch is outside the ${ATTRIBUTION_WINDOW_DAYS} day window`
        : "no partner touch was recorded",
    };
  }

  /*
   * Rule 4, applied before anything is chosen rather than after.
   *
   * Applied per touch, because "was this customer already ours when this
   * partner appeared" is a question about that touch and not about the buyer
   * in general.
   */
  const eligible = inWindow.filter(
    (t) => input.firstPaidOrderAtMs === null || t.occurredAtMs <= input.firstPaidOrderAtMs,
  );

  if (eligible.length === 0) {
    return {
      attributed: false,
      because:
        "this buyer already had a paid order before any partner touch, so no partner introduced them",
    };
  }

  // Rule 1: a typed code beats a click, whatever the timing.
  const typed = eligible.filter((t) => t.kind === "code");
  const pool = typed.length > 0 ? typed : eligible;

  // Rule 2: most recent wins. A stable tiebreak on partner id, so two touches
  // recorded in the same millisecond do not depend on array order.
  const winner = [...pool].sort(
    (a, b) => b.occurredAtMs - a.occurredAtMs || a.partnerId.localeCompare(b.partnerId),
  )[0];

  const others = new Set(eligible.map((t) => t.partnerId));
  others.delete(winner.partnerId);

  return {
    attributed: true,
    partnerId: winner.partnerId,
    code: winner.code,
    kind: winner.kind,
    because:
      typed.length > 0
        ? "a code was entered by hand, which beats a click"
        : others.size > 0
          ? `the most recent of ${others.size + 1} touches inside the ${ATTRIBUTION_WINDOW_DAYS} day window`
          : `the only touch inside the ${ATTRIBUTION_WINDOW_DAYS} day window`,
  };
}

/**
 * Codes are compared case insensitively and trimmed.
 *
 * A code is read down a phone and typed by somebody who was not concentrating.
 * "Bayside", "bayside " and "BAYSIDE" are one partner, and a program that
 * silently failed to attribute because of a capital letter would produce
 * exactly the disputes this module exists to prevent.
 */
export function normaliseCode(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Is this string shaped like a code at all?
 *
 * Checked before it reaches the database so a lookup is never attempted with
 * something that cannot be one. Letters, digits and hyphens, 3 to 32 characters.
 */
export function looksLikeCode(raw: string): boolean {
  return /^[a-z0-9-]{3,32}$/.test(normaliseCode(raw));
}
