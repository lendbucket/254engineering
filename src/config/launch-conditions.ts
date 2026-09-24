/**
 * CONDITIONS OF THE LAUNCH GATE THAT ARE NOT CREDENTIALS.
 *
 * Phase 13. The gate's other conditions live in `credentials.ts`, because they
 * are facts about a registration. This one is a fact about a FEATURE, and it
 * needed a home of its own rather than being wedged into the credential
 * register where it does not belong.
 *
 * It carries no `server-only`, for the same reason
 * `credential-inventory.ts` does not: it holds no secret, and the gate reaches
 * it from a server component. Adding the marker would buy the bundler
 * constraint that has already broken one build here and nothing else.
 */

/**
 * MAY SELF SERVICE SIGN UP REACH PRODUCTION?
 *
 * Operator ruling, 2026-09-13, and it is deliberately SEPARATE from the ruling
 * about shared preview secrets made the same day.
 *
 * WHY THE TWO ARE NOT ONE DECISION
 * ---------------------------------
 * The operator ruled that `CUSTOMER_SESSION_SECRET`, `PARTNER_SESSION_SECRET`
 * and `MFA_ENCRYPTION_KEY` stay shared between Preview and Production. That is
 * a decision about a risk they have weighed and accepted, and the board reports
 * it as ruled rather than as a finding.
 *
 * This is a different question, and the operator said so in as many words: "sign
 * up does not reach production until I lift it. That is a different decision
 * from this one and I have not made it."
 *
 * The first condition ran off the sharing state, which meant lifting one would
 * have silently lifted the other. A gate where accepting a risk opens a feature
 * nobody cleared is a gate that grants something by side effect, which is the
 * shape the whole gate exists to refuse.
 *
 * WHAT MAKES IT TRUE
 * ------------------
 * The operator edits this file. There is no environment variable and no
 * derived answer, because a feature reaching the public is exactly the kind of
 * thing that should require somebody to open a file and type, and leave a
 * commit behind when they do.
 *
 * WHAT IT DOES NOT MEAN. `cleared: false` does not stop the code existing, being
 * exercised on development, or being audited. It stops the gate opening, which
 * stops the site holding itself out as a place where anybody can create an
 * account.
 */
export const selfServiceSignUp: {
  cleared: boolean;
  /** Who cleared it and when, once somebody has. Null while nobody has. */
  clearedBy: string | null;
  clearedOn: string | null;
  /** Why it stands where it stands. Never empty. */
  because: string;
} = {
  cleared: false,
  clearedBy: null,
  clearedOn: null,
  /*
   * CORRECTED 2026-09-24, BECAUSE THE REASON HAD OUTLIVED THE WORLD IT
   * DESCRIBED. Operator ruling.
   *
   * It read that the three identity secrets "stay shared with Preview: that
   * risk was weighed and accepted", and closed on the consequence that a
   * customer session signed on a preview is accepted by production. The
   * operator unticked Preview on CUSTOMER_SESSION_SECRET and
   * PARTNER_SESSION_SECRET on 2026-09-24, so the sentence a reader gets when
   * this gate refuses was describing a sharing that no longer exists.
   *
   * THE CONDITION DID NOT MOVE, AND THAT IS THE DESIGN WORKING RATHER THAN A
   * COINCIDENCE. Its first version ran off the sharing state, which meant
   * lifting one would silently have lifted the other. It was deliberately
   * separated so that accepting, or removing, a risk could not clear a feature
   * nobody had cleared. Removing the sharing therefore removes the risk this
   * reasoning cited and changes this condition not at all.
   *
   * WHAT IS STILL TRUE is the part that was always the real reason: nobody has
   * decided that anybody may create an account on this platform.
   */
  because:
    "Phase 13 built the three doors and the operator has not cleared the public one for production. " +
    "Nobody has decided that anybody may create an account on this platform, which is a decision about " +
    "who the firm does business with rather than about a secret. The preview sharing that the earlier " +
    "version of this sentence cited was ended on 2026-09-24, when CUSTOMER_SESSION_SECRET and " +
    "PARTNER_SESSION_SECRET were unticked from Preview; that removed the risk it named and left this " +
    "condition exactly where it stood, which is what holding the two decisions apart was for.",
};
