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
 * ===========================================================================
 * WHICH SERVICE LINES THE FIRM OFFERS. EVERYTHING ELSE IS A WAITLIST.
 * ===========================================================================
 *
 * Operator ruling, 2026-09-28: the firm launches with roof certification only.
 *
 * WHY THIS LIST HAS TO EXIST RATHER THAN BEING DERIVED. The `protocols`
 * condition already said, in its own words, "every service line OFFERED at
 * launch has one protocol approved", and it checked every line that EXISTS in
 * `services`. So the declaration was right and the code was answering a
 * different question, which meant eleven service pages the firm is not selling
 * yet were holding the gate shut.
 *
 * Deriving "offered" from "has an approved protocol" is the obvious shortcut and
 * it is the one thing this must not do. It would make the condition compare a
 * value to itself, which is the tautological check this repository has already
 * paid for twice: every offered line would have an approved protocol by
 * construction, for ever, whatever anybody approved.
 *
 * ADDING A LINE IS TWO ACTS, DELIBERATELY. One edit here, and Aman approving the
 * protocol for it in his own account. Either alone does nothing: a slug added
 * here with no approved protocol shuts the gate and names itself, and a protocol
 * approved for a line nobody listed changes nothing at all.
 *
 * THE TWO GUARDS BELOW ARE NOT DEFENSIVE PROGRAMMING, they are the difference
 * between a check and a sentence. An empty list would satisfy "every offered
 * line has a protocol" vacuously and open the gate over nothing, and a mistyped
 * slug would offer a line that does not exist while reading as covered.
 */
export const offeredServiceLines: string[] = ["roof-inspections"];

/**
 * ===========================================================================
 * THE OPERATOR THREW THE SWITCH. RECORDED, BECAUSE NOTHING HERE CAN SEE IT.
 * ===========================================================================
 *
 * `LAUNCH_MODE` lives in the deployment environment, so the `switch` condition
 * is answered by whatever Vercel holds at build time and this repository has no
 * way to read it. Ten of the eleven conditions are stated in a file somebody
 * edits on purpose; this is the one that is not, and that asymmetry is
 * deliberate: it is the operator's own act.
 *
 * WHICH LEAVES THE ACT ITSELF UNRECORDED ANYWHERE, and that is what this closes.
 * Not the VALUE, which would be a second home for a variable the gate already
 * reads. The PROVENANCE: who set it, when, in which environment, and which
 * deployment carried it. It is the same idiom as `pointInTimeRecovery` and the
 * Stripe console record, and for the same reason: a fact in a console nobody
 * here can reach becomes a dated, attributed declaration or it is not a fact
 * this repository holds at all.
 *
 * PRODUCTION ONLY, AND THAT IS THE PART WORTH RECORDING. A preview inheriting
 * `LAUNCH_MODE=live` would hold the firm out as open on a URL anybody with the
 * link can reach, which is the shape `previewPointingAtProduction()` already
 * refuses for the database. Nothing enforces it for this variable, so the scope
 * is written down where a person will look.
 *
 * IT DOES NOT MAKE THE CONDITION MET AND MUST NOT BE READ AS DOING SO.
 * `launchMode()` goes on reading the environment. If this record and the
 * environment ever disagree, the environment is what the site was built with
 * and this record is what somebody believed, which is exactly the gap worth
 * being able to see.
 */
export const launchSwitchRecord: {
  setBy: string;
  setOn: string;
  /** Which Vercel environments received it. */
  scope: string;
  /** The deployment that carried it, so the claim is checkable in Vercel. */
  deployment: string;
  notice: string;
} = {
  setBy: "Robert Reyna, operator",
  setOn: "2026-09-28",
  scope: "Vercel Production only. Preview and Development did not receive it.",
  deployment: "dpl_7cWFjFGcZKnzExB4tQCccrRTWcuD, which reached READY on the redeploy that followed",
  notice:
    "PROVENANCE, NOT A CONDITION. LAUNCH_MODE is read from the deployment environment and this " +
    "record does not change what launchMode() answers. It records who threw the switch, when, in " +
    "which environment, and which deployment carried it, because nothing in this repository can " +
    "read a Vercel setting. Set at about 20:59 on 2026-09-28, with the redeploy READY four seconds " +
    "later on the operator's report. NOTE that the deployment it names was built from 8472ed8, " +
    "where stripeAccount.proof is still null, so that build's gate reads stripe as UNMET and the " +
    "firm as trading. The switch being on changed nothing visible until the proof reached main.",
};

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
  /*
   * CLEARED 2026-09-28. Operator ruling: public sign up is ON at launch.
   *
   * The decision this condition was waiting for has been made, and it is the one
   * the condition always said it was waiting for: somebody deciding that anybody
   * may create an account on this platform. It is a decision about who the firm
   * does business with, and the owner made it.
   *
   * A NARROWER OPTION WAS OFFERED AND REFUSED, and that is recorded because a
   * rejected alternative that leaves no trace reads as an option nobody thought
   * of. The suggestion was to treat "off, deliberately" as a decision, so the
   * condition would stop holding the gate without turning the door on, since
   * nothing about selling a roof certification needs public sign up: a customer
   * reaches an order through checkout, which creates a client, and an operator
   * converts it. The operator ruled for the door being open instead.
   */
  cleared: true,
  clearedBy: "Robert Reyna",
  clearedOn: "2026-09-28",
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
  /*
   * REWRITTEN ON CLEARING, because the old sentence said the operator had not
   * cleared it and that became false the moment he did. This field is the reason
   * a reader is given, and a reason describing the previous world is the defect
   * this very file was corrected for on 2026-09-24.
   */
  because:
    "Cleared by Robert Reyna on 2026-09-28 for launch. Phase 13 built the three doors and the public " +
    "one is now open: anybody may create an account on this platform. That is a decision about who the " +
    "firm does business with rather than about a secret, which is why it was always separate from the " +
    "preview secret sharing that an earlier version of this sentence cited. That sharing was ended on " +
    "2026-09-24, when CUSTOMER_SESSION_SECRET and PARTNER_SESSION_SECRET were unticked from Preview, " +
    "and it neither cleared this condition nor blocked it, which is what holding the two apart was for.",
};
