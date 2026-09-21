/**
 * ===========================================================================
 * WHAT A WINDSTORM BRIEF ON AN EXISTING BUILDING CAN BE TOLD FROM A FORM.
 * Operator ruling, 2026-09-20, from the engineer of record's reply.
 * ===========================================================================
 *
 * The answer is: very little, and saying so is the feature. Three things decide
 * whether an existing building can be certified, and only ONE of them is
 * knowable from anything a person types:
 *
 *   1. Only buildings constructed after 1988 can be certified.
 *   2. The construction that needs inspecting is already covered up, so parts
 *      of it have to be opened before anything can be verified.
 *   3. Where opening protection falls short, doors and windows may need
 *      replacing before a certification is possible at all.
 *
 * The first is a date comparison. The second and third are the engineer's
 * judgement about a specific property. So this file answers the first, records
 * the inputs to the other two, and **never produces a quote or a verdict on the
 * job**. A form that told somebody their building could be certified would be
 * issuing an engineering opinion from a dropdown.
 *
 * THE FORM EXISTS AND DOES NOT YET PERSIST, DELIBERATELY.
 * ------------------------------------------------------
 * `eng_windstorm_inquiries` does not exist yet. A migration on `main` is never
 * pending, so the table waits for a sitting with the operator at a keyboard,
 * and the split was ruled deliberately: **the questions are settled and the
 * persistence is not.** Aman answered what to ask; the table is where answers
 * go.
 *
 * So `/api/windstorm-inquiry` validates a brief completely and then refuses to
 * accept it, telling the person to ring or email instead. It does NOT take
 * somebody's details and drop them. A form that accepts a submission it cannot
 * store is the `customer_link.issued` defect wearing a different hat, and that
 * one cost a paying customer a phone call to find out nothing had been sent.
 *
 * WHAT THE SITTING HAS TO DO, so nobody finds this half built and guesses:
 *   - a migration creating `eng_windstorm_inquiries`, with the columns this
 *     schema validates and the `respond_by` promise the design table carries
 *   - `src/lib/ops-windstorm-inquiries.ts`, the reader gated on `files.create`
 *     and `markResponded`, mirroring `ops-inquiries.ts`
 *   - the insert, replacing the refusal in the route
 *   - `/portal/windstorm-inquiries`, and **a `roleFor` entry for it in the same
 *     commit**: it is top level with no parent to inherit from, which is
 *     exactly the shape that shipped broken as `/portal/waiting`
 */

/**
 * The year a building must have been constructed AFTER to be certifiable.
 *
 * Stated as the operator stated it, "only buildings after 1988", so 1988 itself
 * does not qualify and 1989 does.
 *
 * THE BOUNDARY IS A QUESTION FOR THE ENGINEER AND IS RECORDED AS ONE. "After
 * 1988" is unambiguous as written and the thing it refers to may not be: if the
 * rule tracks a code adoption, the date that matters is more likely to be when
 * the structure was permitted or completed than the year somebody remembers. A
 * building finished in 1989 under a 1988 permit is the case that decides it.
 * The platform holds the strict reading until he says otherwise, because the
 * strict reading refuses and the loose one certifies.
 */
export const WINDSTORM_CERTIFIABLE_AFTER_YEAR = 1988;

export type WindstormAgeVerdict =
  | { state: "eligible"; because: string }
  | { state: "too_old"; because: string }
  | { state: "unknown"; because: string };

/**
 * What the building's age alone says, which is never the whole answer.
 *
 * ABSENT IS NOT A PASS AND IT IS NOT A FAILURE. A person who does not know when
 * their building was built gets `unknown`, which routes to the same
 * conversation as `eligible` does rather than to a refusal. Treating an unknown
 * year as too old would turn "I am not sure" into "no", and treating it as
 * eligible would put a certifiability claim on a building nobody has dated.
 */
export function windstormAgeVerdict(input: {
  yearBuilt?: number;
  yearBuiltUnknown: boolean;
}): WindstormAgeVerdict {
  if (input.yearBuiltUnknown || input.yearBuilt === undefined) {
    return {
      state: "unknown",
      because:
        "The year the building was constructed is not recorded, and it is the first thing that decides whether a certification is possible at all. It is established from the permit or the appraisal record before anything else is scoped.",
    };
  }
  if (input.yearBuilt <= WINDSTORM_CERTIFIABLE_AFTER_YEAR) {
    return {
      state: "too_old",
      because:
        `A building constructed in ${input.yearBuilt} predates the windstorm construction standards a certification rests on, and the engineer of record certifies only buildings constructed after ${WINDSTORM_CERTIFIABLE_AFTER_YEAR}. That is answered before a visit rather than after one.`,
    };
  }
  return {
    state: "eligible",
    because:
      `A building constructed in ${input.yearBuilt} is not ruled out on age. Whether it can be certified still depends on what is covered up, what can be opened to verify it, and whether the doors and windows meet the opening protection standard, none of which is knowable from a form.`,
  };
}

/**
 * The sentence a person is shown after a brief is validated.
 *
 * IT NEVER PROMISES A CERTIFICATION AND IT NEVER PROMISES A PRICE. The most it
 * says is that the age does not rule the building out, and the least it says is
 * that the age does.
 */
export function windstormBriefReply(verdict: WindstormAgeVerdict): string {
  if (verdict.state === "too_old") {
    return `${verdict.because} It is worth a conversation anyway, because a later addition or a reroof can sometimes be certified on its own, and that is a question about this property rather than about the rule.`;
  }
  return `${verdict.because} Somebody will be in touch to scope it.`;
}
