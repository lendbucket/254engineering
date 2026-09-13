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
  because:
    "Phase 13 built the three doors and the operator has not cleared the public one for production. It is " +
    "held separately from the ruling of the same day that the three identity secrets stay shared with " +
    "Preview: that risk was weighed and accepted, and this is a decision nobody has made yet. A customer " +
    "session signed on a preview deployment is accepted by production, and self service sign up is what " +
    "turns that from a risk about accounts the operator created into a risk about accounts anybody can " +
    "create.",
};
