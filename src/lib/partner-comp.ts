/**
 * What a partner earned, and what a refund takes back.
 *
 * PURE, AND SEPARATE FROM THE WRITING OF IT, FOR THE REASON ATTRIBUTION IS
 * -----------------------------------------------------------------------
 * `attribution-rules.ts` decides who gets credit and `ops-partners.ts` writes it
 * down. This is the same split one step later: this module decides how much,
 * and `ops-partner-comp.ts` writes it down. Both halves of the money question
 * are then testable by calling them, which is the only kind of check that
 * cannot pass while the rule is broken.
 *
 * WHY ALL FOUR MODELS EXIST WHEN ONE OF THEM MAY TURN OUT TO BE ILLEGAL
 * ---------------------------------------------------------------------
 * Whether a percentage of an engineering fee may be paid to an unlicensed
 * referrer is a question for TBPELS or a licensing attorney, and it is not
 * answered yet. Every model is therefore a row in eng_partner_terms rather than
 * a code path somebody has to unpick. If the answer is "flat fees only",
 * `percent_of_order` and `tiered_by_volume` leave by deleting two values from a
 * check constraint and two branches here, and no schema and no screen moves.
 *
 * Nothing in this module knows about that question. It computes what the terms
 * say, and the terms are the operator's to set.
 */

export type CompModel =
  | "percent_of_order"
  | "flat_per_order"
  | "flat_per_qualified_lead"
  | "tiered_by_volume";

/** One step of a volume ladder. `min` is the count at which `bps` starts. */
export type Tier = { min: number; bps: number };

export type Terms = {
  model: CompModel;
  /** Basis points. 250 is 2.5 percent. Integers, so a rate is never a float. */
  percentBps: number | null;
  flatCents: number | null;
  tiers: Tier[] | null;
  holdbackDays: number;
};

/**
 * The answer, which is either a figure or a stated refusal to invent one.
 *
 * BLOCKED IS NOT ZERO, AND THIS IS THE WHOLE POINT OF THE TYPE
 * ------------------------------------------------------------
 * A delivered file whose order carries no total has a commission that is owed
 * and not yet knowable. Returning 0 for it would put a line on a partner's
 * statement saying the firm owes them nothing for a job they sent, and nobody
 * would ever look at it again. So the shape refuses: a caller cannot read
 * `amountCents` without first passing the discriminant, exactly as ops-money
 * refuses to let an absent figure be summed.
 */
export type Commission =
  | {
      ok: true;
      amountCents: number;
      model: CompModel;
      percentBps: number | null;
      flatCents: number | null;
      basisCents: number | null;
      explanation: string;
    }
  | {
      ok: false;
      /*
       * TWO DIFFERENT NOTS, AND CONFLATING THEM WOULD PUT THE WRONG NUMBER IN
       * THE FIRM'S MARGIN.
       *
       *   not_earned_here  Nothing is owed for this event. A partner paid per
       *                    qualified lead earns nothing from a delivery, and
       *                    the file's partner cost is a real, knowable ZERO.
       *
       *   unknown          Something is owed and its figure cannot be worked
       *                    out yet. The file's partner cost is ABSENT, the
       *                    margin is unknown, and the entry stands in the
       *                    ledger with no amount waiting for somebody.
       *
       * One value for both would mean the writer had to guess which, and it
       * would guess zero, because zero is what nets to nothing and looks tidy.
       */
      reason: "not_earned_here" | "unknown";
      model: CompModel;
      explanation: string;
    };

/**
 * Percentage arithmetic, in one place, on integers.
 *
 * Rounds half away from zero, which is what somebody checking the sum on paper
 * does. The alternative, banker's rounding, is more correct across a large
 * population and less explainable to one partner looking at one line, and this
 * is a program whose survival depends on lines being explainable.
 */
export function applyBps(cents: number, bps: number): number {
  const exact = (cents * bps) / 10000;
  return exact < 0 ? -Math.round(-exact) : Math.round(exact);
}

/**
 * Which tier a count falls in.
 *
 * The ladder is sorted here rather than trusted, because it arrives from a
 * jsonb column an operator typed. A count below every step earns nothing and
 * says so, rather than silently taking the lowest rate that happens to exist.
 */
export function tierFor(count: number, tiers: Tier[] | null): Tier | null {
  if (!tiers || tiers.length === 0) return null;
  const ladder = [...tiers]
    .filter((t) => Number.isFinite(t.min) && Number.isFinite(t.bps))
    .sort((a, b) => a.min - b.min);
  let found: Tier | null = null;
  for (const step of ladder) {
    if (count >= step.min) found = step;
  }
  return found;
}

/**
 * TIERS APPLY FORWARD, NOT BACKWARD, AND THAT IS A RULING.
 *
 * A partner who reaches ten orders in a month moves to the higher rate for
 * what they send NEXT, not retroactively for the nine that came before.
 *
 * The retroactive reading was considered and rejected. It would mean no accrual
 * is final until the period closes, which contradicts the two rules this whole
 * phase is built on: an accrual is written at delivery, and it is never edited.
 * The firm would be telling a partner a figure it knew might move, which is the
 * exact thing that makes a statement uncheckable.
 *
 * The cost is real and worth stating: a partner near a boundary earns less than
 * a retroactive scheme would pay them. That is a term of the program, it is
 * legible in the ladder, and it is the operator's to set differently by setting
 * the boundaries where they want them.
 */
export function commissionForDelivery(input: {
  terms: Terms;
  /** The order total the percentage applies to. Null when there is no order. */
  orderTotalCents: number | null;
  /** How many of this partner's deliveries have already accrued this period. */
  priorQualifyingCount: number;
}): Commission {
  const { terms, orderTotalCents, priorQualifyingCount } = input;

  switch (terms.model) {
    case "flat_per_qualified_lead":
      /*
       * Not earned here. This partner is paid for leads, and a delivery is not
       * one; their accrual happened when the lead was qualified. Saying so is
       * better than returning zero, because zero on a delivery would read as
       * "this delivery was worth nothing to them" rather than "this is not what
       * they are paid for".
       */
      return {
        ok: false,
        reason: "not_earned_here",
        model: terms.model,
        explanation:
          "This partner is paid a flat fee for each qualified lead, which is earned when the lead is qualified rather than when the file is delivered. No commission arises from this delivery.",
      };

    case "flat_per_order": {
      if (terms.flatCents === null) {
        return {
          ok: false,
          reason: "unknown",
          model: terms.model,
          explanation:
            "The terms say a flat fee for each order and no amount is set on them, so the commission cannot be worked out. It is recorded as owed with no figure rather than as nothing.",
        };
      }
      return {
        ok: true,
        amountCents: terms.flatCents,
        model: terms.model,
        percentBps: null,
        flatCents: terms.flatCents,
        basisCents: orderTotalCents,
        explanation: `A flat fee of ${dollars(terms.flatCents)} for the order, under terms that pay per order rather than by value.`,
      };
    }

    case "percent_of_order": {
      if (terms.percentBps === null) {
        return {
          ok: false,
          reason: "unknown",
          model: terms.model,
          explanation:
            "The terms say a percentage of the order and no rate is set on them, so the commission cannot be worked out. It is recorded as owed with no figure rather than as nothing.",
        };
      }
      if (orderTotalCents === null) {
        return {
          ok: false,
          reason: "unknown",
          model: terms.model,
          explanation:
            "The terms pay a percentage of the order and this delivery has no order total to take a percentage of. The commission is owed and its figure is not knowable yet, so it is recorded with no amount rather than as nothing.",
        };
      }
      const amount = applyBps(orderTotalCents, terms.percentBps);
      return {
        ok: true,
        amountCents: amount,
        model: terms.model,
        percentBps: terms.percentBps,
        flatCents: null,
        basisCents: orderTotalCents,
        explanation: `${bpsText(terms.percentBps)} of the order value of ${dollars(orderTotalCents)}, which is ${dollars(amount)}.`,
      };
    }

    case "tiered_by_volume": {
      if (orderTotalCents === null) {
        return {
          ok: false,
          reason: "unknown",
          model: terms.model,
          explanation:
            "The terms pay a tiered percentage of the order and this delivery has no order total to take a percentage of. The commission is owed and its figure is not knowable yet, so it is recorded with no amount rather than as nothing.",
        };
      }
      const step = tierFor(priorQualifyingCount, terms.tiers);
      if (!step) {
        return {
          ok: false,
          reason: "unknown",
          model: terms.model,
          explanation:
            priorQualifyingCount === 0 && (terms.tiers?.length ?? 0) > 0
              ? "The volume ladder on these terms has no step that starts at zero, so the first delivery of the period falls outside every tier. The commission is recorded as owed with no figure rather than as nothing."
              : "The terms pay by volume tier and no usable ladder is set on them, so the commission cannot be worked out. It is recorded as owed with no figure rather than as nothing.",
        };
      }
      const amount = applyBps(orderTotalCents, step.bps);
      return {
        ok: true,
        amountCents: amount,
        model: terms.model,
        percentBps: step.bps,
        flatCents: null,
        basisCents: orderTotalCents,
        explanation: `${bpsText(step.bps)} of the order value of ${dollars(orderTotalCents)}, which is ${dollars(amount)}. That is the tier for a partner with ${priorQualifyingCount} delivery${priorQualifyingCount === 1 ? "" : "s"} already this period, and it applies to this order and the ones after it rather than to the earlier ones.`,
      };
    }
  }
}

/**
 * A qualified lead, which is the one accrual that does not arise from delivery.
 *
 * WHAT COUNTS AS QUALIFIED IS THE FIRM'S OWN ACT, NOT THE PARTNER'S CLAIM
 * -----------------------------------------------------------------------
 * A lead is qualified when somebody at the firm converts it into a client and a
 * file. That is a person looking at it and deciding it is real work, which is
 * the only definition that cannot be gamed by sending more forms.
 */
export function commissionForQualifiedLead(terms: Terms): Commission {
  if (terms.model !== "flat_per_qualified_lead") {
    return {
      ok: false,
      reason: "not_earned_here",
      model: terms.model,
      explanation:
        "These terms do not pay for leads, so converting one earns nothing on its own. What this partner earns arises when the file is delivered.",
    };
  }
  if (terms.flatCents === null) {
    return {
      ok: false,
      reason: "unknown",
      model: terms.model,
      explanation:
        "The terms say a flat fee for each qualified lead and no amount is set on them, so the commission cannot be worked out. It is recorded as owed with no figure rather than as nothing.",
    };
  }
  return {
    ok: true,
    amountCents: terms.flatCents,
    model: terms.model,
    percentBps: null,
    flatCents: terms.flatCents,
    basisCents: null,
    explanation: `A flat fee of ${dollars(terms.flatCents)} for a lead the firm qualified by converting it into a file.`,
  };
}

// ------------------------------------------------------------------ reversal

export type Reversal =
  | { reverse: true; amountCents: number; explanation: string }
  | { reverse: false; explanation: string };

/**
 * What a refund takes back, which is three different answers by model.
 *
 * These are rulings rather than arithmetic, so they are written out.
 *
 * A SHARE OF ORDER VALUE IS REVERSED IN THE PROPORTION RETURNED.
 * `percent_of_order` and `tiered_by_volume` both pay a share of what the
 * customer paid. If the customer got half of it back, the firm never earned
 * that half, and paying commission on it would be paying out of the firm's own
 * pocket for revenue that no longer exists. A full refund reverses the lot.
 *
 * A FLAT FEE PER ORDER IS ALL OR NOTHING.
 * It is not a share of anything, so there is no proportion to take. A full
 * refund means the order did not stand and the fee goes back. A partial refund
 * means the order stood and something was returned within it, and the partner
 * still brought the order.
 *
 * A QUALIFIED LEAD FEE IS NEVER REVERSED BY A REFUND.
 * The partner was paid for a lead the firm looked at and chose to convert. What
 * happened to the engineering afterwards, including an engineer declining to
 * certify, is not something the partner did or could have known. Clawing that
 * back would make the partner carry the firm's technical risk, which is not
 * what they were paid to carry.
 *
 * The counter entry is what all three produce. Nothing here edits an accrual.
 */
export function reversalFor(input: {
  model: CompModel;
  /** The accrual being answered. Positive cents. */
  accruedCents: number;
  /** What the accrual was computed against, for the proportional models. */
  basisCents: number | null;
  refundedCents: number;
}): Reversal {
  const { model, accruedCents, basisCents, refundedCents } = input;

  if (refundedCents <= 0) {
    return { reverse: false, explanation: "Nothing was refunded, so nothing is reversed." };
  }

  if (model === "flat_per_qualified_lead") {
    return {
      reverse: false,
      explanation:
        "This fee was earned for a lead the firm qualified. A refund on the engineering that followed is not the partner's to carry, so the accrual stands.",
    };
  }

  if (model === "flat_per_order") {
    if (basisCents !== null && refundedCents < basisCents) {
      return {
        reverse: false,
        explanation: `A flat fee is paid for bringing the order rather than for its value, and ${dollars(refundedCents)} of ${dollars(basisCents)} was returned, so the order stands and the fee stands with it.`,
      };
    }
    return {
      reverse: true,
      amountCents: -accruedCents,
      explanation: `The order was refunded in full, so the flat fee of ${dollars(accruedCents)} is reversed by a counter entry. The accrual stands in the ledger beside it.`,
    };
  }

  // The two share-of-value models.
  if (basisCents === null || basisCents <= 0) {
    return {
      reverse: true,
      amountCents: -accruedCents,
      explanation: `This commission was a share of order value and the value it was taken from is not on the entry, so the whole accrual of ${dollars(accruedCents)} is reversed rather than a guessed portion of it.`,
    };
  }

  const returned = Math.min(refundedCents, basisCents);
  const share = Math.min(applyBps(accruedCents, Math.round((returned / basisCents) * 10000)), accruedCents);

  if (share <= 0) {
    return {
      reverse: false,
      explanation: `${dollars(returned)} of ${dollars(basisCents)} was returned, which rounds to nothing against a commission of ${dollars(accruedCents)}.`,
    };
  }

  return {
    reverse: true,
    amountCents: -share,
    explanation:
      returned >= basisCents
        ? `The order was refunded in full, so the whole commission of ${dollars(accruedCents)} is reversed by a counter entry.`
        : `${dollars(returned)} of the order value of ${dollars(basisCents)} was returned, so ${dollars(share)} of the commission of ${dollars(accruedCents)} is reversed by a counter entry.`,
  };
}

// -------------------------------------------------------------------- timing

/**
 * When an accrual becomes payable.
 *
 * The holdback exists for the same reason accrual happens on delivery: a refund
 * arriving after the fact must not leave the firm having paid commission on
 * money it returned. The window is the operator's per partner setting, stored
 * on the entry so that changing it later does not move what is already earned.
 */
export function payableAt(occurredAtMs: number, holdbackDays: number): number {
  const days = Number.isFinite(holdbackDays) && holdbackDays > 0 ? Math.floor(holdbackDays) : 0;
  return occurredAtMs + days * 24 * 60 * 60 * 1000;
}

export type LedgerEntry = { amountCents: number | null; status: "accrued" | "blocked" };

/**
 * What a set of entries nets to, and how much of itself it covers.
 *
 * The same refusal ops-money makes: an entry with no figure is not a zero, so a
 * total that contains one says how many it left out. A partner statement that
 * quietly omitted a blocked entry would be a bill for less than the firm owes,
 * which is the direction of error nobody complains about until they notice.
 */
export function netOf(entries: LedgerEntry[]): {
  netCents: number;
  counted: number;
  blocked: number;
} {
  let net = 0;
  let counted = 0;
  let blocked = 0;
  for (const entry of entries) {
    if (entry.status === "blocked" || entry.amountCents === null) {
      blocked += 1;
      continue;
    }
    net += entry.amountCents;
    counted += 1;
  }
  return { netCents: net, counted, blocked };
}

// --------------------------------------------------------------------- words

function dollars(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function bpsText(bps: number): string {
  /*
   * Trailing zeros trimmed. "2.50 percent" reads like a figure somebody
   * formatted; "2.5 percent" reads like the rate on the agreement, which is
   * what a partner is checking this sentence against.
   */
  const percent = (bps / 100).toFixed(2).replace(/\.?0+$/, "");
  return `${percent} percent`;
}
