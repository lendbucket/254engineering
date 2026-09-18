import { priceFor, money } from "@/config/prices";
import {
  ENGINEER_DESIGN_HOURLY_CENTS,
  defaultTierFor,
  engineerPayCents,
  type PayTier,
} from "@/config/engineer-pay";
import { TECHNICIAN_CALL_CENTS } from "@/config/cost-inputs";

/**
 * ===========================================================================
 * THE PRICE BOOK. One question per job: did this make money.
 * ===========================================================================
 *
 * Operator specification, 2026-09-17. The book holds, per service line, the
 * marketed price, the technician rate, the engineer production tier and any
 * adder, and computes cost, net and margin.
 *
 * NOTHING IN IT IS TYPED TWICE. The price a customer is charged and the price
 * in the book are the same value, read from src/config/prices.ts, which is also
 * what /structural-engineer/cost publishes. A second copy for the book would be
 * the defect this repository has removed from the firm name, the telephone
 * number, the licence number and the address in one fortnight.
 *
 * MARGIN IS COMPUTED FROM WHAT HAPPENED, NEVER FROM THE PLAN. Operator ruling:
 * "A job that needed two technician visits costs two technician calls. A job
 * that went to revise and came back costs what it actually cost." So this takes
 * the visits that actually occurred and the tier the job actually attracted,
 * and the estimate is a separate function with a different name, because a
 * figure that might be either is a figure nobody can act on.
 *
 * ABSENT IS NOT ZERO, AND HERE IT IS THE WHOLE POINT. Every refusal below names
 * the missing input rather than substituting a default or a zero. A margin that
 * silently omits the engineer's pay is not a smaller margin, it is a wrong one,
 * and it is wrong in the flattering direction, which is the direction nobody
 * checks.
 */

export type MarginInput = {
  serviceSlug: string;
  /** What the customer was actually charged, in cents. Null when unpriced. */
  chargedCents: number | null;
  /** Technician attendances that actually happened. Zero is a real answer. */
  technicianVisits: number;
  /**
   * The tier the job actually attracted, from the engineer's determination.
   * Null until he has made one, which is most jobs for most of their life.
   */
  tier: PayTier | null;
  /** Hours recorded against the job. The design line is paid on these. */
  designHours: number | null;
};

export type MarginVerdict =
  | {
      ok: true;
      revenueCents: number;
      technicianCents: number;
      engineerCents: number;
      costCents: number;
      netCents: number;
      /** Net as a percentage of revenue, rounded to one decimal. */
      marginPct: number;
      /** Always true today. Card processing has no ruled rate. */
      beforeCardProcessing: true;
    }
  | { ok: false; because: string; missing: string };

/** Is this line paid by the hour rather than by determination tier? */
function isHourly(serviceSlug: string): boolean {
  return priceFor(serviceSlug)?.kind === "hourly";
}

/**
 * What a job actually made, from what actually happened to it.
 *
 * Returns a refusal naming the missing input rather than a figure, whenever the
 * figure would be a guess.
 */
export function marginForJob(input: MarginInput): MarginVerdict {
  if (input.chargedCents === null) {
    return {
      ok: false,
      missing: "price",
      because:
        "No price is recorded against this job, so there is no revenue to compute a margin from. A job reaches a price when it is quoted and accepted, not when it is created.",
    };
  }

  const technicianCents = input.technicianVisits * TECHNICIAN_CALL_CENTS;

  let engineerCents: number;
  if (isHourly(input.serviceSlug)) {
    if (input.designHours === null) {
      return {
        ok: false,
        missing: "hours",
        because:
          "This line is paid by the hour and no hours are recorded against the job. The design line's margin is computed from the hours the engineer actually recorded, so until he records them there is no cost to subtract.",
      };
    }
    engineerCents = Math.round(input.designHours * ENGINEER_DESIGN_HOURLY_CENTS);
  } else {
    if (input.tier === null) {
      /*
       * THE DEFAULT IS NOT SUBSTITUTED HERE, AND THAT IS THE OPERATOR'S RULING.
       * A line has an estimating default and this function is not estimating.
       * Quietly using it would turn a plan into a record, which is the one
       * thing the whole design is arranged to prevent.
       */
      const fallback = defaultTierFor(input.serviceSlug);
      return {
        ok: false,
        missing: "tier",
        because:
          "The engineer has not recorded a determination on this job, so the tier it attracted is unknown and his production pay cannot be computed." +
          (fallback
            ? ` This line estimates at tier ${fallback}, which is what a quote would assume and is not what happened.`
            : " This line has no estimating default either."),
      };
    }
    engineerCents = engineerPayCents(input.tier);
  }

  const costCents = technicianCents + engineerCents;
  const netCents = input.chargedCents - costCents;

  return {
    ok: true,
    revenueCents: input.chargedCents,
    technicianCents,
    engineerCents,
    costCents,
    netCents,
    marginPct: Math.round((netCents / input.chargedCents) * 1000) / 10,
    beforeCardProcessing: true,
  };
}

export type EstimateVerdict =
  | {
      ok: true;
      revenueCents: number;
      technicianCents: number;
      engineerCents: number;
      costCents: number;
      netCents: number;
      marginPct: number;
      /** The tier assumed. Named so an estimate cannot be read as a record. */
      assumedTier: PayTier | null;
      assumedVisits: number;
    }
  | { ok: false; because: string };

/**
 * WHAT A LINE SHOULD MAKE ON A CLEAN JOB. A different function with a different
 * name and a differently shaped result, so an estimate cannot be mistaken for a
 * record by a caller that forgot which one it called.
 *
 * It assumes one technician visit and the line's estimating tier, and it says
 * both out loud in its result rather than burying them.
 */
export function estimateForLine(serviceSlug: string): EstimateVerdict {
  const price = priceFor(serviceSlug);
  if (!price) {
    return {
      ok: false,
      because:
        "No price is ruled for this line, so there is nothing to estimate against. Forensic and insurance work is scoped per matter.",
    };
  }
  if (price.kind === "hourly") {
    return {
      ok: false,
      because:
        "This line is hourly with a minimum engagement, so what it makes depends on the hours the engineer estimates for that job. An estimate per line would be a number with no job behind it.",
    };
  }

  const tier = defaultTierFor(serviceSlug);
  if (tier === null) {
    return {
      ok: false,
      because: "This line has no estimating tier, so the engineer's pay on it cannot be assumed.",
    };
  }

  const technicianCents = TECHNICIAN_CALL_CENTS;
  const engineerCents = engineerPayCents(tier);
  const costCents = technicianCents + engineerCents;
  const netCents = price.cents - costCents;

  return {
    ok: true,
    revenueCents: price.cents,
    technicianCents,
    engineerCents,
    costCents,
    netCents,
    marginPct: Math.round((netCents / price.cents) * 1000) / 10,
    assumedTier: tier,
    assumedVisits: 1,
  };
}

/** One line of the book, for the operator's screen. */
export type BookRow = {
  serviceSlug: string;
  priceLabel: string;
  estimate: EstimateVerdict;
};

/** Money, from the one formatter, so the book and the site agree character for character. */
export { money };
