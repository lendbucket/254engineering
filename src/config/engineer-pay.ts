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
 * THE TIERS ARE THE SIGNED AGREEMENT'S, SCHEDULE 2. Operator ruling,
 * 2026-10-22: "Engineer pay must match the signed agreement's Schedule 2
 * exactly; the agreement wins over engineer-pay.ts."
 *
 *   Tier 1  a condition determination from an evidence package
 *   Tier 2  a determination requiring the engineer to compute or specify
 *   Tier 3  staged work across multiple visits
 *
 * WHAT THIS REPLACED, kept for its reasoning. The tier for each deliverable
 * was recorded here as PROVISIONAL, by the operator's ruling of 2026-09-18
 * ("If Aman reads these and disagrees, his reading wins and the defaults
 * change") and of 2026-09-20 (revisited after ten real jobs against recorded
 * time). Schedule 2 is signed, so neither condition is live: a deliverable's
 * tier is what the schedule says, and changing it is a change to the
 * agreement first and to this file second.
 */

export type PayTier = 1 | 2 | 3;

/** What each tier pays the engineer, in cents. */
export const ENGINEER_TIER_CENTS: Record<PayTier, number> = {
  1: 17_500,
  2: 35_000,
  3: 52_500,
};

/**
 * THE ENGINEER'S SHARE OF A CUSTOM DESIGN ENGAGEMENT: 35% OF THE ENGINEERING
 * FEE, UNDER A SIGNED SCOPE ADDENDUM. Operator ruling, 2026-10-22.
 *
 * It replaced `ENGINEER_DESIGN_HOURLY_CENTS`, $100 an hour, which was never
 * the agreement's term. A custom design engagement is paid as a share of the
 * fee the firm charges for it, and only once a scope addendum for that
 * engagement is signed: with none, nothing is owed and the price book says so
 * rather than estimating. In basis points so the arithmetic stays integral.
 *
 * Beam and header sizing is NOT this rule. Schedule 2 lists it at tier 2, so it
 * is a row in `TIER_BY_DELIVERABLE` like any other determination.
 */
export const ENGINEER_DESIGN_FEE_SHARE_BP = 3_500;

/** What the engineer is paid on a custom design engagement's fee, in cents. */
export function engineerDesignPayCents(engineeringFeeCents: number): number {
  return Math.round((engineeringFeeCents * ENGINEER_DESIGN_FEE_SHARE_BP) / 10_000);
}

/**
 * The tier a service line is ESTIMATED at, keyed by the slug in
 * src/content/services.ts.
 *
 * A line absent from this map has no default, which is a real state rather than
 * a gap: forensic and insurance engineering is scoped per matter and the
 * operator has ruled no price for it, so estimating it would be inventing both
 * halves. Design is absent as a line because it is quoted; its one tiered
 * deliverable, beam and header sizing, has its own row.
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
 * THE MAPPING IS SCHEDULE 2 OF THE SIGNED AGREEMENT. Operator ruling,
 * 2026-10-22, and it supersedes the 2026-09-20 ruling that called it
 * provisional.
 * =========================================================================
 *
 * `ENGINEER_TIER_CENTS` above is what each tier pays, and this map is which
 * tier each deliverable attracts. Both come from the signed agreement now, so
 * neither is a session's to touch or the operator's to estimate.
 *
 * WHAT THE 2026-09-20 RULING SAID, kept for its reasoning: the mapping was the
 * operator's estimate of how much engineering each determination takes, to be
 * revisited after ten real jobs against recorded time, and on that basis
 * `foundation-inspections` and `repair-specifications` were moved from tier 2
 * to tier 1 because at tier 2 one left $60 and the other lost money.
 *
 * THE AGREEMENT DECIDES, AND ON ONE OF THOSE TWO IT DECIDED THE OTHER WAY.
 * Schedule 2 puts the repair specification at tier 2, so it costs $350 plus the
 * $85 visit, $435, which was more than its $395 list price; the operator
 * re-ruled the price the same day (src/config/prices.ts). The manufactured
 * home certification is tier 1 under Schedule 2, where this map had tier 2.
 *
 * WPI-8 ONGOING CONSTRUCTION IS NOT IN SCHEDULE 2, so it has no row here and
 * pays nothing until a signed scope addendum covers it. See
 * `SCOPE_ADDENDUM_REQUIRED` below.
 */
export const TIER_BY_DELIVERABLE: Record<string, PayTier> = {
  "roof-inspections/standard": 1,
  "structural-letters/standard": 1,
  "solar-structural-letters/standard": 1,
  "foundation-inspections/standard": 1,
  "manufactured-home-foundation-certifications/standard": 1,
  "windstorm-wpi-8/completed": 2,
  "repair-specifications/standard": 2,
  "residential-light-commercial-design/beam-header-sizing": 2,
};

/**
 * DELIVERABLES THE AGREEMENT DOES NOT COVER, WHICH NEED A SIGNED SCOPE
 * ADDENDUM BEFORE ANY JOB. Operator ruling, 2026-10-22.
 *
 * A deliverable here pays nothing and is refused at every order door until the
 * engineer has signed a per_job scope addendum for it in the portal (0095,
 * Robert's ruling of 2026-10-26, 07:10 Central). The custom design engagement
 * is not listed: its rule, 35% of the fee, is agreed, and each engagement's
 * own addendum is what the price book asks for per job.
 *
 * `SIGNED_SCOPE_ADDENDA`, a typed list of signed addenda that a deploy would
 * have kept in step with the database, is removed: the signed record is the one
 * home, read by src/lib/line-addendum.ts at the money door.
 */
export const SCOPE_ADDENDUM_REQUIRED: Record<string, string> = {
  "windstorm-wpi-8/ongoing":
    "WPI-8 ongoing construction is not in Schedule 2 of the engineer's signed agreement, so it needs a signed scope addendum before any job and pays nothing until one exists.",
};

/**
 * Why a deliverable needs a signed scope addendum, or null when the agreement
 * already covers it. Configuration alone cannot tell whether one is signed, so
 * this never says "covered" for a listed deliverable; only the money door,
 * reading the signed record, can open it.
 */
export function scopeAddendumMissing(serviceSlug: string, tier: string): string | null {
  return SCOPE_ADDENDUM_REQUIRED[`${serviceSlug}/${tier}`] ?? null;
}

/**
 * THE ENGINEER'S MONTHLY RETAINER, $1,500. Operator ruling, 2026-10-06,
 * docs/rulings-2026-10-06.md section 7 item 2: reported "on its own line, not
 * divided into jobs". It is a cost of having an engineer of record, not of any
 * one job, so nothing per job reads it. Pinned in price-book-audit.
 */
export const ENGINEER_MONTHLY_RETAINER_CENTS = 150_000;

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
