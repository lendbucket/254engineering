import { priceFor } from "@/config/prices";

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
/*
 * =========================================================================
 * KEYED BY DELIVERABLE SINCE 2026-09-20, AND `WPI8_ONGOING_TIER` IS GONE.
 * =========================================================================
 *
 * This map was keyed by LINE, and carried this note beside it:
 *
 *   "WPI-8 ONGOING CONSTRUCTION IS TIER 3 AND IT IS NOT A SERVICE LINE. The
 *    map above is keyed by LINE, so it cannot express that, and the honest
 *    answer is that the line's default is the commoner of the two while the
 *    job's actual tier decides what is paid."
 *
 * So the ruling lived in `WPI8_ONGOING_TIER`, a constant beside the map.
 * **Nothing ever read it.** A tier 3 ruling sat in this file being true and
 * reaching no calculation, which is the quietest way a rule can fail: it was
 * written down, it was correct, and it was inert.
 *
 * It is keyed by DELIVERABLE now, the same key the catalogue prices on and the
 * same key the trade floors sit on, so the ruling is a row rather than an
 * exception and `engineerPayCents` reaches it like any other.
 */
/*
 * =========================================================================
 * THE MAPPING IS PROVISIONAL AND THE PAY AMOUNTS ARE NOT. Operator ruling,
 * 2026-09-20, and the distinction is the whole entry.
 * =========================================================================
 *
 * `ENGINEER_TIER_CENTS` above is what the engineer of record is paid at each
 * tier. Those figures are in the EXECUTED AGREEMENT and are not a session's to
 * touch, not the operator's to drift, and not provisional in any sense.
 *
 * **WHICH TIER A DELIVERABLE ATTRACTS IS A DIFFERENT KIND OF FACT.** It is the
 * operator's estimate of how much engineering a determination takes, and the
 * operator has recorded it as PROVISIONAL for a reason that should be read
 * before anybody changes it:
 *
 *   **NOBODY KNOWS HOW LONG THESE DETERMINATIONS TAKE, BECAUSE NONE HAS BEEN
 *   DONE.** Not one job has run through this platform. Every number here is an
 *   estimate of work nobody has performed yet, and an estimate that has never
 *   met a real job is a guess with a table around it.
 *
 * **IT IS REVISITED AFTER TEN REAL JOBS, AGAINST RECORDED TIME.** Not against
 * anybody's estimate, including the engineer's and including the one written
 * here. That is the condition, and it is written down so the revisit happens
 * because the condition was met rather than because somebody remembered.
 *
 * **AND THE ENGINEER WAS NOT ASKED, WHICH WAS DELIBERATE.** The operator's
 * ruling: asking him to grade his own work before any job has run is the wrong
 * way round. His pay per tier is agreed; how many tiers of work a repair
 * specification is, is the firm's judgement about its own product, and it is
 * answered by timing ten of them.
 *
 * On 2026-09-20 `foundation-inspections` and `repair-specifications` moved from
 * tier 2 to tier 1. At tier 2 they cost $435 against list prices of $495 and
 * $395, so one left $60 and the other lost money before any discount, and both
 * trade floors were held because of it. At tier 1 they cost $260 and their
 * floors are $425 and $325.
 */
export const TIER_BY_DELIVERABLE: Record<string, PayTier> = {
  "roof-inspections/standard": 1,
  "structural-letters/standard": 1,
  "solar-structural-letters/standard": 1,
  "foundation-inspections/standard": 1,
  "manufactured-home-foundation-certifications/standard": 2,
  "windstorm-wpi-8/completed": 2,
  "windstorm-wpi-8/ongoing": 3,
  "repair-specifications/standard": 1,
};

/** What the engineer is paid for a job at a given tier, in cents. */
export function engineerPayCents(tier: PayTier): number {
  return ENGINEER_TIER_CENTS[tier];
}

/** The tier a DELIVERABLE is paid at, or null when the operator has ruled none. */
export function tierForDeliverable(serviceSlug: string, tier: string): PayTier | null {
  return TIER_BY_DELIVERABLE[`${serviceSlug}/${tier}`] ?? null;
}

/**
 * The estimating default for a LINE, or null when the operator has ruled none.
 *
 * DERIVED FROM THE HEADLINE DELIVERABLE rather than stated, so a line selling
 * two jobs estimates at the one its page leads with and there is no second
 * place to edit. WPI-8 estimates at tier 2, completed construction, which is
 * what the old line-keyed map said and now says for a reason a reader can
 * follow rather than by being the commoner of two.
 */
export function defaultTierFor(serviceSlug: string): PayTier | null {
  const price = priceFor(serviceSlug);
  if (!price || price.kind !== "fixed") return null;
  return tierForDeliverable(serviceSlug, price.headlineTier);
}
