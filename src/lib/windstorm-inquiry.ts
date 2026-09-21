/**
 * ===========================================================================
 * WHAT A WINDSTORM BRIEF ON AN EXISTING BUILDING CAN BE TOLD FROM A FORM.
 * ===========================================================================
 *
 * The answer is: very little, and saying so is the feature. What can be decided
 * from answers a person types is whether any WORK on the structure is in scope.
 * Everything else, what is covered up, what can be opened to verify it, and
 * whether the openings meet the standard, is the engineer's judgement about a
 * specific property.
 *
 * ===========================================================================
 * THE RULE IS KEYED ON THE DATE OF THE WORK, NEVER ON THE CONSTRUCTION YEAR.
 * Operator ruling, 2026-09-21, reversing the first encoding.
 * ===========================================================================
 *
 * **THE FIRST VERSION ASKED WHEN THE BUILDING WAS BUILT AND WAS BACKWARDS FOR
 * THE COMMONEST CASE.** It told the owner of a 1975 house that the building
 * predated the standards and could not be certified. The firm's own published
 * page says the opposite, and says it citing the statute:
 *
 *   "Subsection (a) makes compliance with the plan of operation the condition
 *    of eligibility for a structure constructed, altered, remodeled, enlarged,
 *    or repaired, or to which additions are made, on or after January 1, 1988.
 *    **The list of verbs is the point. The date that matters is the date of the
 *    work, and a structure can have more than one.**"
 *
 *   "The pre-1988 treatment belongs to the pre-1988 work. **A roof replaced
 *    last year on a house built in 1975 is work done on or after January 1,
 *    1988, and subsection (a) reaches it.**"
 *
 * So an old house with recent work is IN SCOPE, and the old rule turned away
 * the most common legitimate enquiry this form exists to receive. The
 * operator's ruling: for an inquiry form, which routes rather than certifies,
 * turning away the common legitimate case is not caution.
 *
 * **TWO CONDITIONS ON THIS RULE, BOTH RECORDED RATHER THAN ASSUMED.**
 *
 * First, `/insights/twia-coverage-homes-built-before-1988` was written by a
 * session and **has not been checked against the statute by a person**. This
 * rule now rests on that page's reading of Tex. Ins. Code 2210.251. That is a
 * second-hand authority and it is named as one. 2210.251 is in the bundle for
 * the engineer of record to confirm after orientation.
 *
 * Second, the form already asks WHAT WORK HAS BEEN DONE. The rule reads that,
 * and asks when each piece of work was done. It does not apply a date test to
 * the construction year, which is the field it was wrongly reading before.
 *
 * THE FORM EXISTS AND DOES NOT YET PERSIST ON `main`. On this branch the table
 * lands and the route saves. See `ops-windstorm-inquiries.ts`.
 */

/**
 * The statutory line. Work done ON OR AFTER this date is in scope.
 *
 * Tex. Ins. Code 2210.251 as `/insights/twia-coverage-homes-built-before-1988`
 * reads it: **January 1, 1988**, and "on or after" includes the day itself.
 * That is a different boundary from the first encoding, which excluded 1988
 * entirely, and the difference is one calendar year of legitimate enquiries.
 */
export const WINDSTORM_WORK_IN_SCOPE_FROM = "1988-01-01";

/** The year component, for prose and for a year-only answer. */
export const WINDSTORM_WORK_IN_SCOPE_YEAR = 1988;

/**
 * One piece of work on the structure. A structure can have several, which is
 * the whole reason this is a list rather than a field.
 */
export type WindstormWork = {
  /** What was done, in the person's own words. */
  what: string;
  /** The year it was done, where they know it. */
  year?: number;
};

export type WindstormScopeVerdict =
  /** At least one piece of work is on or after the line. */
  | { state: "in_scope"; because: string; inScope: WindstormWork[] }
  /** Every dated piece of work predates the line. */
  | { state: "all_pre_1988"; because: string }
  /** Nothing is dated, so nothing can be placed either side of the line. */
  | { state: "undated"; because: string };

/**
 * Whether any work on this structure falls on or after the statutory line.
 *
 * **A SINGLE PIECE OF QUALIFYING WORK PUTS THE STRUCTURE IN SCOPE.** That is
 * what "a structure can have more than one" means in practice: the enquiry does
 * not turn on the oldest date or on an average, it turns on whether any date
 * reaches the line.
 *
 * ABSENT IS NOT A PASS AND IT IS NOT A FAILURE. Work nobody has dated yields
 * `undated`, which routes to the same conversation as `in_scope` rather than to
 * a refusal. A person who cannot date their reroof is the ordinary case, not a
 * disqualifying one, and the date is established from the permit or the
 * appraisal record rather than from memory.
 */
export function windstormScopeVerdict(work: WindstormWork[]): WindstormScopeVerdict {
  const dated = work.filter((w) => typeof w.year === "number");
  const inScope = dated.filter((w) => (w.year as number) >= WINDSTORM_WORK_IN_SCOPE_YEAR);

  if (inScope.length > 0) {
    const years = inScope.map((w) => w.year).join(", ");
    return {
      state: "in_scope",
      because:
        `Work recorded in ${years} is on or after January 1, ${WINDSTORM_WORK_IN_SCOPE_YEAR}, so it is work the statute reaches whatever year the building itself went up. ` +
        "Whether it can be certified still depends on what is covered, what can be opened to verify it, and whether the openings meet the standard, none of which is knowable from a form.",
      inScope,
    };
  }

  if (dated.length === 0) {
    return {
      state: "undated",
      because:
        "None of the work described here carries a date, and the date of the work is what decides whether the statute reaches it. It is established from the permit or the appraisal record before anything is scoped, not from memory.",
    };
  }

  return {
    state: "all_pre_1988",
    because:
      `Every piece of work described here predates January 1, ${WINDSTORM_WORK_IN_SCOPE_YEAR}. Work before that line is treated differently and may be eligible without inspection at all, which is a better answer than a certification and is still a conversation rather than a form's verdict.`,
  };
}

/*
 * `windstormBriefReply` WAS HERE AND WENT, THE SAME DAY IT WAS WRITTEN.
 *
 * It composed the sentence a member of the public would be shown after
 * submitting: which side of the statutory line their work fell on. Two things
 * removed it. `useFormPost` discards the response body on success by design,
 * so it never reached a screen; and once that was noticed, the better question
 * was whether it SHOULD.
 *
 * **Telling a stranger their work is in scope under 2210.251, from a form, is
 * close to an opinion arriving from the wrong place.** The determination is
 * shown to STAFF on /portal/windstorm-inquiries, where somebody can act on it,
 * and it reaches the enquirer in a reply written by a person.
 *
 * Deleted rather than left unused, on the same rule that removed `heldOnTier`:
 * dead code that composes a sentence about a live case is a thing somebody
 * reads and believes.
 *
 * `windstormScopeVerdict` above is NOT dead. The portal screen calls it to
 * render each brief's scope chip, deliberately rather than comparing the year
 * itself, so the rule has one home and one reader.
 */
