/**
 * ===========================================================================
 * ENGINEER PRODUCTION PAY. Operator ruling, 2026-09-18.
 * ===========================================================================
 *
 * The tiered production pay in the engineer of record's executed employment
 * agreement. Supplied by the operator, who holds the agreement. Nothing here is
 * derived, estimated, or inferred from a price.
 *
 * THE TIER IS A PROPERTY OF THE JOB, NOT OF THE SERVICE LINE, AND THAT IS THE
 * WHOLE DESIGN. Operator ruling, in his words:
 *
 *   "Which tier a job attracts is the engineer's work on that job, not a
 *    property of the service line, and a roof certification review that becomes
 *    a repairs-required determination with a written repair list is not the
 *    same work as a pass."
 *
 * So the book reads the tier the JOB actually attracted, and the per line tier
 * below is a default for ESTIMATING rather than a fact about what happened. It
 * is the same distinction as margin computed from what a job actually cost
 * rather than from the plan, one level down: the plan is allowed to guess and
 * the record is not.
 *
 * WHERE THE TIER IS NOT KNOWN, NO MARGIN IS STATED. Not a zero, not the
 * default silently substituted, not an estimate presented as an actual. The
 * book says which input is missing and refuses the figure, which is the
 * operator's ruling for any missing input and is the absent-versus-zero rule
 * applied to the one number the whole screen exists to answer.
 *
 * THE DEFAULTS ARE THE OPERATOR'S AND SO IS THEIR REASONING, recorded because
 * it is the part that generalises to a service line nobody has priced yet:
 *
 *   Tier 1  a condition determination from an evidence package
 *   Tier 2  a determination requiring the engineer to compute or specify
 *   Tier 3  staged work across multiple visits
 *
 * AND THEY ARE PROVISIONAL BY HIS OWN RULING: "If Aman reads these and
 * disagrees, his reading wins and the defaults change." The engineer of record
 * has not seen them. That is recorded here rather than left as an assumption,
 * because a default nobody has challenged reads exactly like one somebody
 * approved.
 */

export type PayTier = 1 | 2 | 3;

/** What each tier pays the engineer, in cents. */
export const ENGINEER_TIER_CENTS: Record<PayTier, number> = {
  1: 17_500,
  2: 35_000,
  3: 52_500,
};

/**
 * The engineer's hourly production pay for design work, in cents.
 *
 * Design takes no tier, because it is not a determination against an evidence
 * package: it is hours. The firm markets design at $225 an hour, so this is the
 * cost side of that line and the two live in different files on purpose, one
 * being what a customer pays and the other what the engineer is paid.
 */
export const ENGINEER_DESIGN_HOURLY_CENTS = 10_000;

/**
 * The tier a service line is ESTIMATED at, keyed by the slug in
 * src/content/services.ts.
 *
 * A line absent from this map has no default, which is a real state rather than
 * a gap: forensic and insurance engineering is scoped per matter and the
 * operator has ruled no price for it, so estimating it would be inventing both
 * halves. Design is absent because it is hourly.
 */
export const DEFAULT_TIER_BY_LINE: Record<string, PayTier> = {
  "roof-inspections": 1,
  "structural-letters": 1,
  "solar-structural-letters": 1,
  "foundation-inspections": 2,
  "manufactured-home-foundation-certifications": 2,
  "windstorm-wpi-8": 2,
  "repair-specifications": 2,
};

/*
 * WPI-8 ONGOING CONSTRUCTION IS TIER 3 AND IT IS NOT A SERVICE LINE.
 *
 * The line `windstorm-wpi-8` sells two different pieces of work: completed
 * construction, which is one visit to a finished structure, and ongoing
 * construction, which is staged attendance while the work is open. The operator
 * ruled tier 2 for the first and tier 3 for the second.
 *
 * The map above is keyed by LINE, so it cannot express that, and the honest
 * answer is that the line's default is the commoner of the two while the job's
 * actual tier decides what is paid. The estimate is allowed to be approximate
 * for exactly the reason the tier lives on the job.
 */
export const WPI8_ONGOING_TIER: PayTier = 3;

/** What the engineer is paid for a job at a given tier, in cents. */
export function engineerPayCents(tier: PayTier): number {
  return ENGINEER_TIER_CENTS[tier];
}

/** The estimating default for a line, or null when the operator has ruled none. */
export function defaultTierFor(serviceSlug: string): PayTier | null {
  return DEFAULT_TIER_BY_LINE[serviceSlug] ?? null;
}
