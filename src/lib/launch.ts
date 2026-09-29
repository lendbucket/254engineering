import {
  verifiedFirmRegistrations,
  verifiedEngineers,
  verifiedCredentials,
  operatingNameOnBoardRecord,
  verifiedInsurance,
  insuranceOverride,
  verifiedTechnicianTraining,
  WINDSTORM_APPOINTMENT_CREDENTIAL,
  type VerifiedEngineer,
  type VerifiedFirmRegistration,
  type VerifiedInsurance,
} from "@/config/credentials";
import {
  stripeAccount,
  approvedProtocols,
  pointInTimeRecovery,
  placeholderPhonePatterns,
} from "@/config/launch-readiness";
import { business } from "@/config/business";
/*
 * THE FIRM'S CALENDAR DECIDES WHETHER A CREDENTIAL HAS EXPIRED.
 * Operator ruling, 2026-09-24.
 *
 * Both comparisons below read `new Date().toISOString().slice(0, 10)`, which is
 * UTC. Chicago is five or six hours behind it, so for those hours either side of
 * midnight the gate read TOMORROW's date and a registration or a licence expiring
 * today was already treated as lapsed.
 *
 * The harm is small and the direction is the safe one, which is exactly why it
 * would never have been noticed: a gate that shuts a few hours early looks like a
 * gate working. It is corrected because the expiry is a date somebody read off a
 * board's letter in Texas, and comparing it against a date in another zone is
 * comparing two different things.
 */
import { todayInFirmCalendar } from "./firm-calendar";
import { stripeAccountBlockedReason } from "./stripe-account";
import { contact } from "@/config/contact";
import { services } from "@/content/services";
import { offeredServiceLines, selfServiceSignUp } from "@/config/launch-conditions";

/**
 * The compliance gate.
 *
 * WHY THIS IS ONE FUNCTION AND NOT A CONDITIONAL PER PAGE
 * ------------------------------------------------------
 * The firm's registration with the Texas Board of Professional Engineers and
 * Land Surveyors is not yet active. Until it is, the site must not state that
 * the firm currently offers or performs engineering services. That is a legal
 * constraint on rendered copy, not a product preference, and the failure mode is
 * one page that says the wrong thing while the other forty say the right thing.
 *
 * So every surface that could make a present-tense offer reads this. One
 * environment variable moves the whole site, and a page that forgets to ask gets
 * the safe answer, because prelaunch is the default for any value that is not
 * exactly "live".
 *
 * LAUNCH_MODE is a plain server variable, not NEXT_PUBLIC_. A NEXT_PUBLIC_ gate
 * would be inlined into the client bundle, where it could be read by anyone and,
 * worse, could disagree with what the server believed. Every consumer of this is
 * a Server Component or a server module, so the value never reaches a browser.
 *
 * FLIPPING THE MODE REQUIRES A REBUILD, AND THAT IS FINE
 * ------------------------------------------------------
 * Almost every page on this site is statically prerendered, which means this
 * function runs during `next build` and its answer is baked into the HTML.
 * Changing LAUNCH_MODE on a running server therefore changes nothing until the
 * site is rebuilt. That is worth being explicit about rather than discovering on
 * the day it matters: on Vercel, editing an environment variable already
 * requires a redeploy to take effect, so the deployment story is unchanged. What
 * it rules out is flipping the firm from pending to open by restarting a
 * process, and a compliance state that could change without a deploy leaving an
 * audit trail is not one this firm should want.
 *
 * scripts/launch-audit.mjs exercises both modes against `next dev` for the same
 * reason: dev renders per request, so one build can be audited in both states.
 */
/**
 * ===========================================================================
 * THREE STATES, NOT TWO. Operator ruling, 2026-09-17.
 * ===========================================================================
 *
 * The firm is registered with TBPELS as F-29811, active, it has an engineer of
 * record on the register, and it has ruled prices. It accepts enquiries and
 * quotes work. None of that was expressible with a boolean, so the site went on
 * apologising for things that had stopped being true.
 *
 * What remains true is that no document can be sealed until the engineer
 * approves a protocol IN THE PLATFORM, and none is approved. So "open" is not
 * one event either: a line opens when its own protocol is approved.
 *
 *   prelaunch   the firm may not represent that it performs engineering
 *   trading     registered, engineer of record, present tense, prices,
 *               enquiries and quotes. No online order and no card.
 *   open        orders, per line, where that line's protocol is approved
 *
 * WHY THE MIDDLE STATE IS THE WHOLE POINT. A boolean forced every question to
 * be answered by the same answer: whether the firm may say it is registered,
 * whether it may quote, and whether it may take a card were one fact. They are
 * three, and two of them have been true for a week.
 */
export type LaunchMode = "prelaunch" | "trading" | "open";

/**
 * ===========================================================================
 * WHAT MUST BE TRUE BEFORE THE GATE CAN OPEN, AND IT IS NOT ONE VARIABLE.
 * Operator ruling, 2026-09-10, the day the firm registration issued.
 * ===========================================================================
 *
 * LAUNCH_MODE used to be the whole gate. It is now the operator's SWITCH, and
 * the switch is one of the conditions rather than all of them. Every other
 * condition is read from CONFIGURATION, so the flip is impossible until each is
 * stated true in a file somebody has to edit on purpose.
 *
 * The ruling came from a real gap. TBPELS issued F-29811 on 2026-09-10, which
 * looked like the day the gate opens, and it was not: the registration was then
 * in the name 254 Services LLC while all three sites held out as
 * 254 Engineering Services. Setting LAUNCH_MODE=live that afternoon would have
 * printed a registration number beside a name the board had no record of.
 *
 * That particular gap closed on 2026-09-21, when the Board reissued F-29811 to
 * 254 Engineering LLC and recorded the brand as an assumed name. The ruling it
 * produced did not close with it: the gate is still a list of conditions rather
 * than one variable, and that is the point of the paragraph.
 *
 * So each blocker returns a SENTENCE, not a boolean, because what a reader
 * needs when the gate will not open is the reason.
 */
export type LaunchCondition = {
  /** Stable key. compliance-audit pins these, so renaming one is deliberate. */
  id: string;
  /** What must be true, in one line. */
  what: string;
  /** Who can make it true. Not a role in this platform; a person or a body. */
  whoClears: string;
  /** Where it is stated true, exactly enough to open the file and edit it. */
  statedIn: string;
  /**
   * WHICH STATE THIS CONDITION GATES. Operator ruling, 2026-09-17.
   *
   *   trading   the firm may not hold itself out at all until this is met
   *   open      the firm may trade, and may not take orders until this is met
   *   naming    gates NOTHING. It decides which name the trading copy uses.
   *
   * The third value exists because of `trading-name`, and it is the honest
   * shape rather than a convenience. That condition used to gate everything on
   * whether the board held the name the firm trades under. It no longer does,
   * because every rendered sentence derives the name from the board's own
   * record, so the thing it was protecting is protected by construction. It
   * still belongs on the operator's screen, because a reissuance changes what
   * the copy says. A condition that blocks nothing and is deleted is a fact
   * nobody watches; a condition that blocks nothing and is labelled as such is
   * a fact on a screen.
   */
  gates: "trading" | "open" | "naming";
  /**
   * The sentence a reader gets when it is not met, or null when it is.
   *
   * A SENTENCE AND NOT A BOOLEAN, which is the whole design. What somebody needs
   * when the gate will not open is the reason, and a list of falses is a puzzle.
   */
  unmet: () => string | null;
};

/**
 * ===========================================================================
 * THE CONDITIONS, AS DATA.
 * Operator ruling, 2026-09-11.
 * ===========================================================================
 *
 * Five were added to the two that already existed, and they are a list rather
 * than a function body so that three things are possible at once: the gate maps
 * over them, the operator's launch screen renders them, and
 * `scripts/compliance-audit.mjs` asserts each one by id against a pinned list.
 *
 * The last of those is why `id` exists. An audit that iterates whatever the
 * array happens to hold would pass just as happily over an array somebody
 * shortened, which is the defect class this repository keeps finding: a check
 * that agrees with the thing it checks.
 */
export const LAUNCH_CONDITIONS: LaunchCondition[] = [
  {
    id: "switch",
    gates: "open",
    what: "The operator has thrown the switch.",
    whoClears: "The operator, in the deployment environment.",
    statedIn: "LAUNCH_MODE=live",
    /*
     * AN UNRECOGNISED VALUE SAYS SO, AND NAMES ITSELF. Operator ruling,
     * 2026-09-22.
     *
     * Every value that is not "live" holds the gate shut, which is the right
     * direction and was the whole of this condition until today. What it could
     * not do is tell the operator WHY. A typo reads exactly like a deliberate
     * prelaunch: "liv", "Live " with a stray character, and "prelaunch" all
     * produced the one sentence "LAUNCH_MODE is not live.", so somebody who
     * had thrown the switch and mistyped it would see a shut site and no
     * account of the mistake anywhere.
     *
     * This is the status function lesson pointed at the operator instead of at
     * a customer. The old sentence was true of every fault it could see and
     * said nothing about the fault it could not: that the value is neither of
     * the two this gate reads. Naming the value read is the only thing that
     * distinguishes them, so the value is printed rather than described.
     *
     * The normalisation is unchanged. `.trim().toLowerCase()` still decides, so
     * a tab or a capital is not a typo and does not become loud for one.
     */
    unmet: () => {
      const raw = process.env.LAUNCH_MODE;
      const value = raw?.trim().toLowerCase() ?? "";
      if (value === "live") return null;
      if (value === "" || value === "prelaunch") return "LAUNCH_MODE is not live.";
      return (
        `LAUNCH_MODE is ${JSON.stringify(raw)}, which this gate does not recognise. ` +
        "It reads live, prelaunch, or unset, so this value holds the gate shut exactly " +
        "as prelaunch would and may be a typo."
      );
    },
  },

  {
    /*
     * THE ENGINEER OF RECORD, ADDED 2026-09-17 ON THE OPERATOR'S RULING.
     *
     * It was never a condition, which is strange only until you see why: the
     * gate had `peInResponsibleCharge()`, and that function returned false
     * whenever the gate was shut. A condition built on it would have been
     * false BECAUSE the gate was shut, which is a gate that cannot open. The
     * circularity is removed in the same commit as this condition is added.
     *
     * An unrecorded expiry is not active, which `activeEngineer()` enforces, so
     * this condition answers no for a licence nobody has checked rather than
     * yes for one nobody has looked at.
     */
    id: "engineer-of-record",
    gates: "trading",
    what: "A licensed Professional Engineer with a current license is on the register.",
    whoClears: "The operator, by recording the engineer and the license expiry he read off the roster.",
    statedIn: "verifiedEngineers in src/config/credentials.ts",
    unmet: () =>
      activeEngineer()
        ? null
        : "No engineer with a current, recorded license is on the register in src/config/credentials.ts. An unrecorded expiry counts as not current, because sealing rests on the license being active.",
  },

  {
    id: "registration",
    gates: "trading",
    /*
     * A registration the board actually issued, read from the register rather
     * than from the environment. An environment variable can differ between a
     * build and a deployment; a file cannot.
     */
    what: "An active, unexpired firm registration is on record.",
    whoClears: "TBPELS issues it; the operator records it.",
    statedIn: "verifiedFirmRegistrations in src/config/credentials.ts",
    unmet: () =>
      activeFirmRegistration()
        ? null
        : "No active firm registration is recorded in src/config/credentials.ts, or the one recorded has expired.",
  },

  {
    id: "trading-name",
    gates: "naming",
    /*
     * RENAMED AND REFRAMED 2026-09-17, ON THE OPERATOR'S RULING, AND THE OLD
     * NAME IS THE REASON IT HAD TO BE RENAMED.
     *
     * As `operating-name` it gated everything, on the principle that a
     * registration in one name does not authorise holding out under another.
     * That principle is unchanged and is now enforced somewhere better: every
     * rendered sentence naming the firm calls `firmName()`, which reads
     * `issuedTo` off the board's own record, so the site cannot hold out under
     * a name the board does not have. The condition was guarding a hole that
     * got filled by the deriver.
     *
     * What it still decides is WHICH NAME the trading copy uses, which changes
     * the day TBPELS reissues F-29811 as 254 Engineering LLC. That is worth a
     * line on the operator's screen and is not a reason to keep the firm shut.
     *
     * It keeps its id stable enough to be pinned and changes it deliberately,
     * which costs two edits: this one and the pinned list in compliance-audit.
     * That is the mechanism working rather than friction.
     */
    what: "Which name the trading copy uses, which is the name on the board's record.",
    whoClears:
      "TBPELS, by reissuing F-29811 in the new name. Until then the copy names the registrant, which is correct and is not a blocker.",
    statedIn: "operatingNameOnBoardRecord in src/config/credentials.ts",
    unmet: () =>
      operatingNameOnBoardRecord.onRecord
        ? null
        : `The board does not hold the operating name. ${operatingNameOnBoardRecord.because}`,
  },

  {
    id: "stripe",
    gates: "open",
    what: "A live Stripe account belonging to 254, proven by one real charge and its refund.",
    whoClears: "The operator connects the account and makes the charge and the refund.",
    statedIn: "stripeAccount in src/config/launch-readiness.ts",
    unmet: () => {
      if (!stripeAccount.connected) return `No live Stripe account belongs to this firm. ${stripeAccount.because}`;
      if (!stripeAccount.accountName) {
        return "A Stripe account is marked connected but no account holder is named, so nobody can tell whose it is.";
      }
      if (!stripeAccount.proof) {
        return `The Stripe account ${stripeAccount.accountName} is connected but no charge and refund have been recorded, so the refund path has never been run.`;
      }
      return null;
    },
  },

  {
    id: "protocols",
    gates: "open",
    /*
     * The condition that decides what may be SOLD rather than what may be said.
     * A line with no approved protocol cannot be dispatched, so offering it is
     * taking money for work the firm has no agreed way to perform.
     */
    what: "Every service line offered at launch has one protocol approved by the engineer of record.",
    whoClears: "The Professional Engineer in responsible charge approves each protocol.",
    statedIn:
      "offeredServiceLines in src/config/launch-conditions.ts, and approvedProtocols in src/config/launch-readiness.ts",
    /*
     * OFFERED LINES, NOT EVERY LINE. Operator ruling, 2026-09-28.
     *
     * The `what` above has always said "offered". The code checked every line in
     * `services`, so eleven pages the firm is not selling held the gate shut.
     *
     * THE TWO GUARDS COME FIRST AND THEY FAIL LOUDLY, because both failures look
     * exactly like success from the outside. An empty list satisfies "every
     * offered line has a protocol" over nothing, and a mistyped slug is a line
     * nobody can dispatch reading as covered. Neither is reachable without
     * somebody editing the list, which is precisely when a mistake is made.
     */
    unmet: () => {
      if (offeredServiceLines.length === 0) {
        return "No service line is declared as offered, so this condition would pass over an empty list. Declare at least one in offeredServiceLines, or the firm is opening with nothing to sell.";
      }

      const unknown = offeredServiceLines.filter((slug) => !services.some((s) => s.slug === slug));
      if (unknown.length > 0) {
        return `offeredServiceLines names ${unknown.length} line(s) this platform does not have: ${unknown.join(", ")}. A slug that matches no service is a line nobody can order and nobody can dispatch.`;
      }

      const waiting = offeredServiceLines.filter((slug) => !approvedProtocolFor(slug));
      if (waiting.length === 0) return null;
      return `${waiting.length} of ${offeredServiceLines.length} OFFERED service line(s) have no approved protocol: ${waiting.join(", ")}. A line is offered when it is listed and its protocol is approved, and both are needed.`;
    },
  },

  {
    id: "phone",
    gates: "trading",
    what: "FIRM_PHONE is a real number, not a placeholder.",
    whoClears: "The operator, once there is a number somebody answers.",
    statedIn: "FIRM_PHONE in the deployment environment",
    unmet: () => {
      const phone = contact.phone;
      if (!phone) return "FIRM_PHONE is not set, so the firm publishes no telephone number.";
      const digits = phone.replace(/[^\d+]/g, "");
      const placeholder = placeholderPhonePatterns.find((p) => p.pattern.test(digits));
      if (placeholder) return `FIRM_PHONE is a placeholder. ${placeholder.why}`;
      if (digits.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "").length !== 10) {
        return "FIRM_PHONE is not ten digits, so it is not a number anybody can call.";
      }
      return null;
    },
  },

  {
    /*
     * ======================================================================
     * THE EIGHTH CONDITION, AND IT IS NOT THE ONE IT STARTED AS.
     * ======================================================================
     *
     * Phase 13 added a condition to the gate about the three identity secrets
     * shared between Preview and Production, because self service sign up means
     * anybody can mint a customer session and a shared preview secret turns that
     * into anybody minting a production one.
     *
     * Between writing it and rebasing it, the operator RULED that the sharing
     * stays: a decision they weighed rather than a gap waiting to be closed. So
     * a condition that blocked the gate on the sharing would now hold it shut
     * forever on something already decided, which is how a gate stops being read.
     *
     * The operator was explicit that these are TWO decisions and only one is
     * made: "sign up does not reach production until I lift it. That is a
     * different decision from this one and I have not made it."
     *
     * So the condition that survives is about the FEATURE, not the secret. The
     * sharing is recorded in src/config/credential-inventory.ts with a name, a
     * date and its consequence in full, and soc2-audit asserts every sharing is
     * ruled rather than that none exists.
     *
     * WHAT IT STILL PROTECTS. A customer session signed on any preview
     * deployment is accepted by production, and preview URLs are publicly
     * reachable. That is tolerable while every account is one the operator
     * created. Self service sign up is the thing that turns it from a risk about
     * a handful of known accounts into a risk about anybody who can reach a
     * preview URL, which is why this condition exists and why it is the
     * operator's alone to lift.
     */
    id: "insurance",
    gates: "open",
    what: "Professional liability cover is in force, on record, with an expiry.",
    whoClears: "The operator, by recording the certificate he has read.",
    statedIn: "verifiedInsurance in src/config/credentials.ts",
    /*
     * WHY IT GATES `open` AND NOT `trading`. Trading is quoting and taking
     * enquiries. `open` is the firm taking money for work that will carry an
     * engineer's seal, which is the moment a claim becomes possible. A
     * disclosed judgement, recorded in the overnight file for a ruling.
     *
     * AND AN UNKNOWN EXPIRY CANNOT REACH HERE, because the record has no null
     * expiry to offer. That is the 2026-09-16 ruling built into the shape
     * rather than checked at the edge.
     */
    unmet: () => {
      const stands = insuranceStandsOn();
      if (stands.on === "policy") return null;
      if (stands.on === "override") return null;
      return stands.why;
    },
  },

  {
    id: "technician-training",
    gates: "open",
    what: "Every approved protocol has somebody trained on that version of it.",
    whoClears: "The engineer of record, or somebody he names, by delivering it.",
    statedIn: "verifiedTechnicianTraining in src/config/credentials.ts",
    /*
     * IT ASKS ITS QUESTION OF THE APPROVED PROTOCOLS, NOT OF EVERY LINE, and
     * that has a consequence worth stating rather than discovering: while no
     * protocol is approved this condition is VACUOUSLY MET and contributes
     * nothing. That is correct, because a line with no approved protocol is
     * already shut by the `protocols` condition and naming it here as well
     * would report one fault twice. It becomes load bearing the moment the
     * first protocol is approved, which is exactly when a technician could
     * otherwise be dispatched to perform something nobody trained them on.
     *
     * THE VERSION IS PART OF THE MATCH. Training on v1.0 is not training on
     * v1.1, and a match on the document alone would read as current for ever.
     */
    unmet: () => {
      const untrained = linesWithNobodyTrained();
      return untrained.length === 0
        ? null
        : `No technician is recorded as trained on the approved protocol for: ${untrained.join(", ")}. Dispatching somebody to perform a protocol they have not been trained on is the firm putting its engineer's seal behind work nobody prepared for.`;
    },
  },

  {
    id: "self-service-signup",
    gates: "open",
    what: "Self service sign up is cleared to reach production.",
    whoClears: "The operator, and nobody else, by editing the file.",
    statedIn: "selfServiceSignUp in src/config/launch-conditions.ts",
    unmet: () =>
      selfServiceSignUp.cleared
        ? null
        : `Self service sign up is not cleared for production. ${selfServiceSignUp.because}`,
  },

  {
    id: "recovery",
    gates: "open",
    what: "Point in time recovery is enabled on the production project.",
    whoClears: "The operator, in the Supabase dashboard, and states it here with the date.",
    statedIn: "pointInTimeRecovery in src/config/launch-readiness.ts",
    unmet: () => {
      if (!pointInTimeRecovery.enabled) {
        return `Point in time recovery is not enabled on the production project. ${pointInTimeRecovery.because}`;
      }
      if (!pointInTimeRecovery.on) {
        return "Point in time recovery is marked enabled with no date, so nobody can tell when the window starts.";
      }
      return null;
    },
  },
];

/**
 * The protocol approved for a service line, or null.
 *
 * Exported because the catalogue needs it to decide what may be ordered, which
 * is the operator's ruling that nobody can list a line that cannot be
 * dispatched.
 */
/**
 * MAY THE SELF SERVICE DOOR OPEN AT ALL.
 *
 * ======================================================================
 * A LAUNCH CONDITION THAT NOTHING CONSULTS IS A NOTE.
 * ======================================================================
 *
 * The eighth condition says self service sign up is not cleared to reach
 * production, and it is the operator's alone to lift. That sentence appears on
 * the operator's launch screen and in docs/launch-readiness.md, and until this
 * function existed it changed NOTHING about whether a stranger could open an
 * account.
 *
 * A gate that describes a door without being able to shut it is the shape this
 * repository keeps finding: a record that is not a check. So the door reads
 * this, the screen reads this, and the two cannot disagree because there is one
 * answer.
 *
 * IT IS SEPARATE FROM isPrelaunch ON PURPOSE. isPrelaunch answers "may this
 * firm hold itself out as offering engineering services", which is a
 * REGULATORY question about copy. This answers "may an anonymous stranger
 * create an account", which is a question about a session secret shared with
 * preview deployments. They are unmet together today and they are not the same
 * condition, and collapsing them would mean lifting one lifted the other.
 *
 * THE ROUTE CHECKS IT TOO, not only the screen. A screen that hides a form is a
 * screen; the route is what a person who reads HTML has to get past.
 */
/**
 * ===========================================================================
 * IT REQUIRES THE GATE AS WELL AS ITS OWN FLAG. Operator ruling, 2026-09-24.
 * ===========================================================================
 *
 * WHAT IT DID. It read `selfServiceSignUp.cleared` and nothing else. That flag
 * is one of the nine launch conditions, so clearing it says "public sign up is
 * ready to reach production" and says nothing about whether the FIRM is open.
 *
 * WHY THAT IS WRONG IN THE DIRECTION THAT COSTS SOMETHING. The flag is a single
 * boolean in a configuration file. The moment the operator clears it, in
 * preparation for opening, self service sign up becomes live on the public site
 * WHILE THE GATE IS STILL SHUT: a member of the public could create an account
 * on a firm that is not yet taking orders, be told nothing is available, and be
 * left holding a credential for a service that does not exist yet. The account
 * surface exists to own orders, and in prelaunch and trading there are none.
 *
 * It is also the one condition a reasonable person would clear EARLY, because
 * clearing it is preparation rather than a commitment, which is exactly what
 * makes reading it alone dangerous.
 *
 * NO RECURSION, CHECKED RATHER THAN ASSUMED. `isOpen()` reads `openBlockers()`,
 * which reads each condition's `unmet()`, and the `self-service-signup`
 * condition reads `selfServiceSignUp.cleared` DIRECTLY rather than calling this
 * function. So this can call `isOpen()` safely, and the flag check below is
 * redundant by construction today and kept anyway: it states the intent locally
 * rather than relying on a condition list somebody could reorder.
 *
 * A DISCLOSED JUDGEMENT, AND IT IS IN THE OVERNIGHT FILE FOR A RULING. The bar
 * chosen is `open` rather than `trading`. The reasoning is that an account is
 * for owning orders and trading takes no orders, so an account opened in
 * trading can do nothing. If the operator wants sign up available as soon as
 * the firm is registered and quoting, this becomes `!isPrelaunch()` and the
 * error sentence stays as it is.
 */
export function selfServiceSignUpOpen(): boolean {
  return isOpen() && selfServiceSignUp.cleared === true;
}

/**
 * Why it is shut, for a person looking at the screen.
 *
 * Deliberately says nothing about preview deployments or session secrets. The
 * reader is somebody who wanted an account, and the reason it is shut is this
 * firm's business rather than theirs; what they need is what to do instead.
 */
export function selfServiceSignUpClosedSentence(): string {
  return "Accounts are not open for sign up yet. Call the office or send a message and somebody will open one for you.";
}

export function approvedProtocolFor(serviceSlug: string) {
  return approvedProtocols.find((p) => p.serviceSlug === serviceSlug) ?? null;
}

/**
 * IS THIS FIRM SEALING ANYTHING YET?
 *
 * ADDED 2026-09-17 BECAUSE THE BOARD CAUGHT WHAT MY ENUMERATION DID NOT, and
 * that is the argument for it rather than a note beside it.
 *
 * Removing the circularity from `peInResponsibleCharge()` made it answer true,
 * correctly: an engineer with a current licence is on the register. Six
 * rendered sentences read that fact and flipped to the present tense, and every
 * one of them claims work is being SEALED now:
 *
 *   "Every opinion, letter, certification, and drawing is reviewed and sealed"
 *   "Every deliverable is reviewed and sealed by a Texas licensed PE"
 *   "A licensed Texas Professional Engineer reviews the record"
 *
 * Nothing is being sealed. No protocol is approved, so `ops-review` refuses the
 * seal action on every line. The copy would have claimed a thing the platform
 * itself refuses, which is the exact disagreement between a page and the code
 * that section 2c exists to prevent.
 *
 * THE FIX IS THE PREDICATE, NOT THE SENTENCE. Whether an engineer EXISTS and
 * whether the firm can SEAL are two facts, and the copy was reading the first
 * to answer the second. An engineer in responsible charge with no approved
 * protocol can seal nothing, which is precisely the firm's position today.
 *
 * I had classified eleven dependants of `peInResponsibleCharge()` and named
 * three that must not flip. It was six. Verification tests what its author
 * already thought of; the board is what tests the rest.
 *
 * =============================================================================
 * AND IT WAS NOT ENOUGH. SECOND INSTANCE OF THE DORMANT REGISTER, 2026-09-24.
 * =============================================================================
 *
 * Operator ruling. The guard above held for a week and it held for one reason
 * only: `approvedProtocols` was EMPTY. On 2026-09-22 Aman approved 254-RC-001
 * and the register gained its first entry, `approvedProtocols.length > 0`
 * turned true, and all six sentences flipped to the present tense on a site
 * whose gate still reads PRELAUNCH.
 *
 * The board caught it and nothing else would have: `voice-audit` went red with
 * six findings across five routes including the home page, /services,
 * /government and llms-full.txt, and `partner-audit` went red on four checks
 * that assert a partner may not say work is being sealed. Main was never
 * affected, because main's register is still empty, so the live site never made
 * the claim and the defect was latent on the branch that introduces the entry.
 *
 * THE FIX IS THE MISSING CONJUNCT. Being able to seal and being allowed to SAY
 * SO are two facts, and this function was answering the first while three
 * rendered sentences read it for the second. An engineer in responsible charge
 * with an approved protocol can seal; a firm that is not yet trading may not
 * describe that in the present tense. So `isTrading()` joins the condition.
 *
 * `peInResponsibleCharge()` is kept although `isTrading()` subsumes it today,
 * because engineer-of-record gating trading is a property of the conditions
 * table rather than of this function, and a conjunct removed on the strength of
 * another file's current shape is a dependency nobody records.
 *
 * "EVERY" STAYS, and that was the operator's ruling rather than an oversight:
 * the sentence describes what the firm ISSUES, and everything it issues is
 * sealed. What it must not do is say so in the present tense before trading.
 */
export function sealingIsAvailable(): boolean {
  return isTrading() && peInResponsibleCharge() && approvedProtocols.length > 0;
}

/**
 * MAY A SENTENCE ON THIS SERVICE LINE'S OWN PAGE SAY ITS DELIVERABLE IS SEALED?
 *
 * Operator ruling, 2026-09-24, and it is the sitewide question narrowed to one
 * line. `sealingIsAvailable()` asks whether ANY protocol is approved, which is
 * the right question for a sentence about what the firm issues. It is the WRONG
 * question for a sentence about a particular deliverable: one approved line out
 * of eleven would license a present tense sealing claim on the ten that have no
 * protocol, and a line with no approved protocol seals nothing.
 *
 * NO RENDERED SENTENCE CALLS THIS TODAY, and that is said out loud rather than
 * dressed up. The per line copy in `services.ts` describes what a certification
 * IS, as a document type, which is definitional and not a claim about what this
 * firm is doing this week; `voice-audit` correctly leaves it alone. This exists
 * so the first sentence that DOES make the narrow claim has a correct predicate
 * to read, and the proof beside it exercises the function so it is a rule with
 * a caller rather than a comment. 0027 records what the other kind becomes.
 */
export function sealingIsAvailableFor(serviceSlug: string): boolean {
  return isTrading() && peInResponsibleCharge() && approvedProtocolFor(serviceSlug) !== null;
}

/**
 * Is this service line offered, or is it a waitlist?
 *
 * One function, so the order flow, the service pages and the gate cannot answer
 * it three ways.
 */
export function serviceLineIsOffered(serviceSlug: string): boolean {
  return approvedProtocolFor(serviceSlug) !== null;
}

/**
 * What stands between the firm and TRADING: holding itself out as a registered
 * firm, describing services in the present tense, publishing prices, and taking
 * enquiries. Not orders and not money.
 */
export function tradingBlockers(): string[] {
  return LAUNCH_CONDITIONS.filter((c) => c.gates === "trading")
    .map((c) => c.unmet())
    .filter((s): s is string => s !== null);
}

/**
 * What stands between the firm and OPEN, which is everything above plus the
 * money path, the switch, and a protocol per line. Naming conditions are
 * excluded by construction: they gate nothing.
 */
export function openBlockers(): string[] {
  return LAUNCH_CONDITIONS.filter((c) => c.gates !== "naming")
    .map((c) => c.unmet())
    .filter((s): s is string => s !== null);
}

/**
 * Kept as the name every existing caller knows, and it answers the OPEN
 * question, which is what it always answered. Reading it as "is anything at all
 * still shut" is the mistake this rename was designed to make impossible, and
 * the reason `tradingBlockers()` sits above it with a different name rather
 * than as a flag on this one.
 */
export function launchBlockers(): string[] {
  return openBlockers();
}

/**
 * The same answer with the conditions attached, for the operator's launch
 * screen. Kept beside launchBlockers rather than derived somewhere else,
 * because a screen computing its own version of the gate is a second gate.
 */
export function launchReadiness(): { condition: LaunchCondition; blocker: string | null }[] {
  return LAUNCH_CONDITIONS.map((condition) => ({ condition, blocker: condition.unmet() }));
}


/**
 * The active firm registration, or null.
 *
 * Expiry is checked rather than trusted. A registration is not evidence of
 * anything after the date the board put on it, and a site that goes on printing
 * a lapsed number is making a claim it cannot support.
 */
export function activeFirmRegistration(): VerifiedFirmRegistration | null {
  const today = todayInFirmCalendar();
  return (
    verifiedFirmRegistrations.find((r) => r.status === "active" && r.expires >= today) ?? null
  );
}

/**
 * THE FIRM'S CURRENT PROFESSIONAL LIABILITY COVER, OR NULL.
 *
 * It mirrors `activeFirmRegistration()` exactly, including the date comparison,
 * because they answer the same shape of question about two credentials the firm
 * holds from outside bodies. An entry that has lapsed, or whose expiry has
 * passed, is not cover.
 *
 * PROFESSIONAL LIABILITY ONLY. General liability is worth recording and is a
 * different promise: it covers the van in the car park, not the opinion in the
 * sealed letter. The condition that gates taking money for engineering work
 * asks about the second.
 */
/**
 * WHAT THE INSURANCE CONDITION IS STANDING ON, AND IT IS THREE ANSWERS RATHER
 * THAN TWO.
 *
 * Operator ruling, 2026-09-28. A policy and an owner override are not degrees of
 * one thing: one is cover, the other is a decision to trade without cover. The
 * gate treats both as "not blocking" and every reader that shows a human what
 * the firm is standing on must be able to tell them apart, so the answer carries
 * WHICH.
 *
 * Folding them into a boolean is the failure this repository names most often: a
 * status that collapses two different facts, after which the screen says
 * "insurance: met" over a firm with no insurance.
 *
 * THE POLICY IS READ FIRST, so recording real cover retires the override with no
 * edit and no deletion. An override that had to be removed by hand is an override
 * somebody forgets, and it would then be sitting there claiming a decision nobody
 * would make twice.
 *
 * THE EXPIRY IS AGAINST THE FIRM'S CALENDAR, never a build timestamp, so it goes
 * red on the day it says rather than on the day somebody next deploys.
 */
export type InsuranceStanding =
  | { on: "policy"; policy: VerifiedInsurance }
  | { on: "override"; override: NonNullable<typeof insuranceOverride>; expires: string }
  | { on: "nothing"; why: string };

export function insuranceStandsOn(today: string = todayInFirmCalendar()): InsuranceStanding {
  const policy = activeInsurance();
  if (policy) return { on: "policy", policy };

  if (insuranceOverride && insuranceOverride.expires >= today) {
    return { on: "override", override: insuranceOverride, expires: insuranceOverride.expires };
  }

  if (insuranceOverride) {
    return {
      on: "nothing",
      why:
        `The owner's decision to operate without professional liability cover expired on ` +
        `${insuranceOverride.expires} and today is ${today}. No cover is on record, so the firm ` +
        `would be taking money for sealed engineering work uninsured. Record the certificate in ` +
        `verifiedInsurance, or the owner re-rules with a new date.`,
    };
  }

  return {
    on: "nothing",
    why:
      "No professional liability cover is on record, so the firm would be taking money for sealed " +
      "engineering work uninsured. Record the certificate in verifiedInsurance.",
  };
}

export function activeInsurance(): VerifiedInsurance | null {
  const today = new Date().toISOString().slice(0, 10);
  return (
    verifiedInsurance.find(
      (p) => p.kind === "professional-liability" && p.status === "active" && p.expires >= today,
    ) ?? null
  );
}

/**
 * THE SERVICE LINES WHOSE APPROVED PROTOCOL NOBODY IS TRAINED ON.
 *
 * A line is only offered when its protocol is approved, so this asks its
 * question of the APPROVED protocols rather than of every line: a line with no
 * protocol is already shut by the `protocols` condition and naming it here too
 * would report one fault twice.
 *
 * MATCHED ON THE VERSION LABEL AS WELL AS THE DOCUMENT. Training on v1.0 is not
 * training on v1.1, and a match on the document alone would read as current for
 * ever across every future revision.
 */
export function linesWithNobodyTrained(): string[] {
  return approvedProtocols
    .filter(
      (p) =>
        !verifiedTechnicianTraining.some(
          (t) =>
            t.serviceSlug === p.serviceSlug && t.protocolVersion === p.version,
        ),
    )
    .map((p) => p.serviceSlug);
}

/**
 * The current mode. Prelaunch unless EVERY condition is satisfied, including a
 * missing variable, an empty one, and a typo.
 */
export function launchMode(): LaunchMode {
  if (tradingBlockers().length > 0) return "prelaunch";
  if (openBlockers().length > 0) return "trading";
  return "open";
}

/**
 * True while the firm may not represent that it is performing engineering work.
 *
 * THIS IS NARROWER THAN IT WAS, AND THAT IS THE ENTIRE POINT OF THE RULING.
 * Until 2026-09-17 it meant "anything at all is still shut", so it was used to
 * suppress the order button AND the present tense AND the prices. Those are
 * three questions. Use `isOpen()` for the money and the orders, and this only
 * for whether the firm may describe itself as practising at all.
 *
 * Every one of the 36 call sites was classified before this changed, in
 * docs/gate-call-sites.md, because a boolean widened to three states silently
 * keeps its old meaning at every site nobody reclassified.
 */
export function isPrelaunch(): boolean {
  return launchMode() === "prelaunch";
}

/** Registered, engineer of record, present tense, prices, enquiries and quotes. */
export function isTrading(): boolean {
  return launchMode() !== "prelaunch";
}

/** Orders and money. A LINE is open only if its protocol is also approved. */
export function isOpen(): boolean {
  return launchMode() === "open";
}

/**
 * The TBPELS firm registration number, or null while the gate is shut.
 *
 * Returns null in prelaunch regardless of what the register holds. The number
 * being issued is not the same event as the firm being entitled to hold itself
 * out under the name beside it, and rendering the number before that would be a
 * worse misstatement than rendering none.
 */
export function tbpelsFirmNumber(): string | null {
  if (isPrelaunch()) return null;
  return activeFirmRegistration()?.number ?? null;
}

/**
 * Is a licensed Professional Engineer in responsible charge yet?
 *
 * THE SECOND GATE, WHICH THIS SITE WAS MISSING
 * --------------------------------------------
 * Firm registration and an engineer of record are two separate facts and the
 * site treated them as one. Every page said work is "reviewed and sealed by a
 * licensed Texas Professional Engineer in responsible charge", and nine service
 * pages promised it "within a few business days". Both are claims about a person
 * who has not been hired.
 *
 * That is its own regulatory problem, not a softer version of the firm
 * registration one. Sealing requires a PE. A firm with a registration and no
 * engineer still cannot seal anything, so the registration lifting must not lift
 * the sealing language with it.
 *
 * Gated on the licence being supplied rather than on a boolean, because the
 * thing that makes this true is a specific person with a specific number, and
 * requiring the number means the gate cannot be opened by optimism.
 */
export function peInResponsibleCharge(): boolean {
  /*
   * THE CIRCULARITY IS GONE. Operator ruling, 2026-09-17.
   *
   * This used to begin `if (isPrelaunch()) return false`. Whether a licensed
   * engineer is in responsible charge is a fact about the REGISTER and has
   * nothing to do with the launch mode, and reading the mode here made it
   * false BECAUSE the gate was shut. Once it became a condition of opening,
   * that is a gate that cannot open: the fact would have been false until the
   * gate lifted, and the gate would not lift until the fact was true.
   *
   * WHATEVER THE OLD BRANCH WAS PROTECTING BELONGS AT THE SURFACES. His ruling,
   * and it was right: the protection is that no sentence claims the firm is
   * currently sealing. That is now gated on the protocol per line, which is
   * what actually decides whether anything can be sealed, rather than on a fact
   * about a person's licence.
   *
   * Three of this function's eleven dependants would have asserted something
   * false the moment it answered honestly. They were found by enumerating the
   * dependants first, which the operator required, and are fixed in this same
   * commit rather than after it. See docs/gate-call-sites.md.
   */
  return activeEngineer() !== null;
}

/**
 * THE ENGINEER THE REGISTER HOLDS, ACTIVE BY THE SAME DEFINITION THE FIRM
 * REGISTRATION USES. Operator ruling, 2026-09-16.
 *
 * It mirrors `activeFirmRegistration()` on purpose, because the two questions
 * are the same question about different credentials, and two definitions of the
 * word active is how an audit and a gate end up disagreeing. That already
 * happened once: a register check filtered on status alone while the gate
 * checked the expiry, and only an injection found it.
 *
 * AN UNRECORDED EXPIRY IS NOT ACTIVE. `expires: null` means nobody has written
 * the date down, which is a different state from "current" and must not read as
 * it. Sealing rests on this being true, so the unknown answer is the shut one.
 *
 * THE LICENCE NUMBER HAS ONE HOME, and this is why the function reads a file
 * rather than an environment variable. `TBPELS_PE_LICENSE` was retired on
 * 2026-09-16: a variable can differ between a build and a deployment, which is
 * the same defect the 2026-09-10 ruling removed for the firm registration
 * number, and the fourth instance of one fact with two homes in a fortnight.
 */
export function activeEngineer(): VerifiedEngineer | null {
  const today = todayInFirmCalendar();
  return verifiedEngineers.find((e) => licenceIsCurrent(e.expires, today)) ?? null;
}

/**
 * IS A LICENCE CURRENT, AS A PURE RULE.
 *
 * Extracted from `activeEngineer` on 2026-09-16, the day a real expiry was
 * recorded, and the reason is the vacuous-green rule rather than tidiness.
 *
 * While the register held one engineer with `expires: null`, a check could
 * assert that an unrecorded expiry is not current by looking at the live
 * register. The moment the operator read the date off the TBPELS roster, no
 * engineer was in that state any more, and the check began passing over an
 * empty set: true today, and exercised for the first time on the day somebody
 * adds a second engineer without a date.
 *
 * So the RULE is exercisable without the register being in any particular
 * state. `compliance-audit` calls this with null, with a past date and with a
 * future one, which makes it true or false today and every day.
 */
export function licenceIsCurrent(expires: string | null, todayISO: string): boolean {
  if (typeof expires !== "string" || expires === "") return false;
  return expires >= todayISO;
}

/**
 * The registration line that appears in the footer on every page.
 *
 * Two different sentences, both true at the time they render. The prelaunch one
 * is a disclosure; the live one is a credential, and Texas rules require the
 * firm registration number to appear on the firm's public representations once
 * it exists.
 */
/**
 * THE REGISTRATION, AS A SENTENCE, READ OFF THE REGISTER. Operator ruling,
 * 2026-09-15.
 *
 * Seventeen places were reported as saying the registration was pending, as
 * literals, for five days after TBPELS issued F-29811; a full sweep found more.
 * Every one of them now renders this, so the sentence changes when the register
 * does and cannot be left behind by it.
 *
 * It says what the register records and nothing else. Not that the firm is
 * accepting work, not that anything is in force beyond the registration: the
 * launch gate governs those, separately, through `notYetAcceptingEngagements`.
 * With no active registration on record it returns null, and a caller says
 * nothing about registration rather than inventing a status.
 */
export function registrationStatement(): string | null {
  const registration = activeFirmRegistration();
  if (!registration) return null;
  return `${registration.issuedTo} is a Texas registered engineering firm, TBPELS Firm Registration ${registration.number}.`;
}

/**
 * ===========================================================================
 * A DBA NEVER STANDS ALONE AS THE FIRM. Operator ruling, 2026-09-22.
 * ===========================================================================
 *
 * TBPELS records three assumed names on F-29811: Sealed Engineering, Stamp My
 * Plans, and 254 Engineering Services. The board holding them is new, and it
 * changes what may be said, which is why the ruling came with a form attached:
 *
 *   "Partner contracts name the registrant. A DBA may appear only as
 *    '254 Engineering LLC, doing business as ...', never alone."
 *
 * WHY NEVER ALONE, AND IT IS NOT STYLE. A partner agreement, a referral page
 * and an engagement letter all answer one question for the reader: who is the
 * counterparty. A trade name answers it ambiguously even when the board holds
 * it, because the entity that can be sued, that holds the registration, and
 * that the engineer practises under is the REGISTRANT. A DBA alone invites an
 * argument about who was contracted with, and that argument happens during a
 * dispute rather than before one.
 *
 * SO THE FORM IS DERIVED RATHER THAN TYPED, and the registrant half comes from
 * `firmName()`, which reads the board's own record. Reissuance moves both
 * halves at once.
 *
 * IT REFUSES A NAME THE BOARD DOES NOT HOLD, and that is the load bearing
 * clause. Without it this would be a sentence generator for any string
 * somebody passed it, which is exactly how a brand nobody registered ends up
 * looking registered.
 */
export function tradingAsLine(dba: string): string | null {
  const registration = activeFirmRegistration();
  if (!registration) return null;

  const held = registration.dbas.find((d) => d.toLowerCase() === dba.trim().toLowerCase());
  if (!held) return null;

  /* The board's spelling, not the caller's. "Stamp My Plans", not "StampMyPlans". */
  return `${firmName()}, doing business as ${held}`;
}

/** Every assumed name the board holds, for a caller that needs to ask. */
export function boardHeldDbas(): string[] {
  return activeFirmRegistration()?.dbas ?? [];
}

/**
 * ===========================================================================
 * THE TDI WINDSTORM APPOINTMENT, AS A SENTENCE, READ OFF THE REGISTER.
 * Operator ruling, 2026-09-21. Option A: derive from `verifiedCredentials`.
 * ===========================================================================
 *
 * THE SUBJECT IS THE ENGINEER, NOT THE FIRM, AND THAT IS THE RULING RATHER
 * THAN A WORDING PREFERENCE. TDI appoints individual engineers. A sentence
 * saying the FIRM holds no appointment describes a thing that cannot be held,
 * and a reader who later meets an appointed engineer working at an unappointed
 * firm would find the site had told them something that is not how the program
 * works.
 *
 * WHY IT IS DERIVED AT ALL. The sentence it replaces was typed into
 * `windstorm-program.ts`, which makes it the same shape as the portal sidebar
 * that went on saying "registration pending" for a day after TBPELS issued
 * F-29811. The day Aman is appointed, somebody updates the register because
 * that is where the appointment number goes, and a typed sentence on a page
 * about credentials would go on denying it. One fact, one home, for the sixth
 * time; this is the seventh.
 *
 * THE SHUT ANSWER IS THE DEFAULT AND EVERY UNEXPECTED STATE FALLS INTO IT.
 * No entry, several entries, held with no identifier: each renders the
 * negative. That is `an unknown is not a pass` applied to a disclosure, and it
 * errs toward the sentence that claims nothing. `compliance-audit` asserts
 * there is exactly ONE such entry, because a second one would make this
 * silently pick, and silently picking is how a disclosure stops being read.
 *
 * THE POSITIVE BRANCH NAMES NO ENGINEER, and it is not an oversight.
 * `HeldCredential` has no link to `verifiedEngineers`, so the register cannot
 * say WHICH engineer holds it, and standing law does not publish his name in
 * any case. It states the appointment number and the date somebody checked it
 * against TDI's own record, which is what a reader can verify.
 */
export function windstormAppointmentStatement(): string {
  const entries = verifiedCredentials.filter((c) => c.name === WINDSTORM_APPOINTMENT_CREDENTIAL);
  const held = entries.filter((c) => c.held && c.identifier !== null);

  if (entries.length !== 1 || held.length !== 1) {
    return `No engineer at ${firmName()} currently holds a Texas Department of Insurance windstorm appointment.`;
  }

  return (
    `An engineer at ${firmName()} holds a Texas Department of Insurance windstorm appointment, ` +
    `${held[0].identifier}, verified against the department's own record on ${held[0].verifiedOn}.`
  );
}

/**
 * ===========================================================================
 * WHETHER A PROFESSIONAL ENGINEER IS IN RESPONSIBLE CHARGE, AS A SENTENCE.
 * Operator ruling, 2026-09-21.
 * ===========================================================================
 *
 * IT REPLACES A LITERAL THAT HAD ALREADY GONE FALSE. `windstorm-program.ts`
 * carried "No Professional Engineer is yet in responsible charge." typed, in
 * TWO places, and `peInResponsibleCharge()` reads `activeEngineer() !== null`,
 * which has been true since a licence expiring 2028-01-31 was recorded. The
 * page was denying the firm's own engineer of record on a page about
 * credentials.
 *
 * THAT IS THE 2026-09-12 PORTAL SIDEBAR AGAIN, EXACTLY. Same defect, same
 * cause, same fix: a compliance sentence hardcoded anywhere is the defect, and
 * the copy is always the one nobody updates. This is the second time it has
 * been a sentence about responsible charge specifically.
 *
 * IT READS `peInResponsibleCharge()` RATHER THAN `activeEngineer()` DIRECTLY,
 * which is the operator's ruling honoured rather than sidestepped: that
 * function IS the derivation from `activeEngineer()`, and calling the register
 * again here would put a second reader of one fact in the file whose whole job
 * is having one.
 *
 * THE POSITIVE BRANCH NAMES NOBODY. Standing law: never publish the engineer's
 * name or licence number. What a reader needs is whether somebody licensed is
 * answerable, not who.
 */
export function responsibleChargeStatement(): string {
  return peInResponsibleCharge()
    ? "A Texas licensed Professional Engineer is in responsible charge."
    : "No Professional Engineer is yet in responsible charge.";
}

/**
 * ===========================================================================
 * WHAT THE FIRM CANNOT DO TODAY, WHICH IS TAKE AN ORDER. Operator ruling,
 * 2026-09-21, replacing a sentence that had outlived the fact behind it.
 * ===========================================================================
 *
 * WHAT IT REPLACES, AND WHY THAT SENTENCE HAD TO GO. Two public pages typed
 * "does not currently offer or perform engineering services". That sentence
 * PREDATES F-29811 and every clause of it is now false: the firm is registered
 * with TBPELS, an engineer of record is in responsible charge, and the site
 * publishes prices. A firm in that position is plainly offering engineering
 * services. Saying otherwise was not caution, it was a false statement in the
 * conservative direction, which is still a false statement and is exactly what
 * the gate exists to prevent.
 *
 * WHAT IS ACTUALLY TRUE IS NARROWER AND IT IS ABOUT ORDERS. `isOpen()` is the
 * only one of the three modes that gates money, and what a reader needs to
 * know is that they cannot buy yet. So the sentence says that and nothing
 * more.
 *
 * NOTHING WHEN OPEN, WHICH IS THE POINT OF RETURNING NULL. A disclosure that
 * survives the condition it discloses is the other way to mislead, and callers
 * already drop nulls through `.filter(Boolean)`. It is not a sentence that
 * gets rewritten when the gate lifts; it disappears.
 *
 * WHY NOT `notYetAcceptingEngagements()`, WHICH SAYS SOMETHING SIMILAR. That
 * one is for refusal paths: an order route, a checkout, a form that has just
 * declined to take money, where the reader has already tried. This is PAGE
 * copy, read by somebody who has not tried anything, and the operator ruled
 * its wording separately. Folding them together would mean one sentence
 * serving two audiences, and the next person to improve it for one would break
 * it for the other.
 */
export function notYetTakingOrders(): string | null {
  return isOpen() ? null : "We are not yet taking orders.";
}

/**
 * THE FIRM'S NAME IN A SENTENCE, READ OFF THE BOARD'S RECORD. Operator ruling,
 * 2026-09-15.
 *
 * THE ARGUMENT FOR IT IS ITS OWN HISTORY. This is the fourth deriver of this
 * exact shape: `registrationLine()`, `e164Phone()`, `registrationStatement()`,
 * and now this. Each exists because one fact had two accounts and the copy was
 * the one nobody updated. The name was the last fact still written as a
 * literal, in twenty rendered sentences, and renaming the firm on 2026-09-13
 * cost twenty seven edits. The audits pinning those literals catch an
 * ACCIDENTAL change and do nothing for a deliberate one, which is the gap: a
 * pin makes a rename expensive rather than safe.
 *
 * IT READS THE REGISTRANT, NOT THE ENTITY, AND THAT IS THE WHOLE DESIGN.
 * Operator ruling, 2026-09-15, on the Secretary of State amendment: the
 * compliance gate is about what the BOARD's record says, and the state's record
 * is a different fact. The entity became 254 Engineering LLC on 2026-09-16
 * while TBPELS still held F-29811 in the older name, so every sentence naming
 * the firm went on saying what the board held until the certificate was
 * reissued. Sourcing this from the registration is what makes that true
 * mechanically rather than by remembering.
 *
 * THE TWO RECORDS AGREED AGAIN ON 2026-09-21, and the deriver is why nothing
 * had to be edited for the copy to follow: `issuedTo` moved and twenty
 * rendered sentences moved with it. That is the argument for this function
 * stated as an outcome rather than as an intention, which is the only version
 * worth having.
 *
 * So reissuance is ONE VALUE: `issuedTo` in the register, and every rendered
 * sentence, both email templates, the JSON-LD block and the report export
 * header follow it. `compliance-audit` asserts that no source outside the
 * config writes the name as a literal, because a deriver nothing enforces is a
 * deriver the next sentence quietly ignores.
 *
 * THE HAZARD OF ACTUALLY DOING THE RENAME, RECORDED HERE BECAUSE IT HAS BITTEN
 * ONCE. `scripts/lib/regulatory.mjs` carries the firm name in the patterns
 * `voice-audit` matches on. It learned the name in the same commit last time,
 * and if it does not, the audit goes blind on the way past: it keeps passing
 * while it has stopped looking at anything. Whoever changes `issuedTo` changes
 * those patterns in the same commit.
 *
 * The fallback is the legal entity, for the state this repository was in before
 * 2026-09-10, when no registration was on record and the pages still had to
 * name the firm.
 */
export function firmName(): string {
  const registration = activeFirmRegistration();
  return registration ? registration.issuedTo : business.legalName;
}

/**
 * WHY THE FIRM IS NOT TAKING WORK, WHICH IS LAUNCH MODE AND NOT REGISTRATION.
 *
 * The order refusals used to give registration as the reason, which conflated
 * two facts: a registration issued, and the gate stayed shut for other reasons.
 * Callers use this only inside an `isPrelaunch()` branch.
 */
export function notYetAcceptingEngagements(): string {
  return "The firm is not yet accepting engagements.";
}

/**
 * THE ONE QUESTION EVERY PATH THAT CAN TAKE MONEY ASKS. Operator ruling,
 * 2026-09-15, the day a live Stripe secret key went on Production.
 *
 * Until then the gate sat upstream of two of the three charge paths, in the
 * order routes and in `orderBlockedReason`, and `startStatementCheckout` had
 * none at all: it checked that the provider was configured, that the statement
 * was awaiting payment and added up, and charged. Nothing was exposed only
 * because production held no statements, which is a fact about today's data
 * rather than a control.
 *
 * So the question moves to the three functions that actually reach the payment
 * provider, where it cannot be skipped by a new caller, and `money-audit`
 * enumerates them from the source rather than from a list: every function whose
 * body calls `createCheckout(` must also call this.
 *
 * REFUNDS DELIBERATELY DO NOT ASK. Money going back to somebody must keep
 * working while the gate is shut; a gate that blocked refunds would trap a
 * customer's money, which is the opposite of what it is for.
 */
export function chargesBlockedReason(): string | null {
  /*
   * A PROVEN STRIPE ACCOUNT MISMATCH STOPS NEW CHARGES. Operator ruling,
   * 2026-09-16, and it is checked BEFORE the launch gate on purpose: it is true
   * in both modes, and it is the one that costs a customer money rather than
   * costing the firm a sale.
   *
   * It blocks only on a definitive `resource_missing`. An outage, a timeout or
   * any other error reads as "could not tell" and blocks nothing, because a
   * check that shuts the firm on a transient error is its own defect. The
   * reasoning is in stripe-account.ts.
   */
  const mismatch = stripeAccountBlockedReason();
  if (mismatch) return mismatch;

  if (!isPrelaunch()) return null;
  return `${notYetAcceptingEngagements()} No payment can be taken until it opens for work.`;
}

export function registrationLine(): string {
  /*
   * THE REGISTRATION IS STATED WHILE THE GATE IS SHUT, AND THAT IS A CHANGE.
   * Operator ruling, 2026-09-11: until the board holds the operating name, the
   * public footer states the REGISTRANT and the number with the brand above it,
   * so the day the gate opens the sites already hold out under the registered
   * name. It read "254 Services LLC, TBPELS Firm F-29811" then and reads
   * "254 Engineering LLC, TBPELS Firm F-29811" since the reissuance of
   * 2026-09-21. The line is derived, so it moved on its own; the sentence above
   * quoted one of those values as though it were the rule and went stale, which
   * is exactly what deriving it was meant to prevent happening to the COPY.
   *
   * WHY THIS IS NOT THE THING THE GATE PREVENTS. The hazard was never printing
   * the number. It was printing the number BESIDE A NAME THE BOARD HAS NO
   * RECORD OF. Naming the registrant exactly as the board issued it, with the
   * brand on its own line above, asserts only what the board's record says.
   *
   * It also removes a cliff. The alternative is a footer that says "pending"
   * for months and then changes to a registered firm on the day a filing is
   * acknowledged, which is the version where somebody has to remember to make
   * the change and the sites disagree with each other while they deploy.
   *
   * `tbpelsFirmNumber()` still returns null while the gate is shut and that is
   * deliberate: it feeds the government page, the credentials strip and the
   * schema block, which are CLAIMS OF CAPABILITY rather than a disclosure of
   * who the registrant is. The two answers are different because the two
   * questions are.
   */
  const registration = activeFirmRegistration();
  const pe = peInResponsibleCharge();

  /*
   * THE NAME PRINTED IS THE NAME ON THE REGISTRATION, not the one this site
   * trades under. Operator ruling, 2026-09-10.
   *
   * This used to print a module constant reading "254 Engineering Services
   * LLC". F-29811 was issued to "254 Services LLC", so once the gate opened
   * this line would have put the board's number beside a name the board's
   * record did not carry, which is the exact misstatement the gate exists to
   * prevent, printed in the one place a reader goes to check.
   *
   * The registrant has since moved once, to "254 Engineering LLC" on
   * 2026-09-21, and this function needed no edit for it. That is the whole
   * argument for reading the register rather than a constant, demonstrated
   * rather than asserted.
   *
   * Reading it off the registration means the two cannot disagree: whatever
   * name the board holds is the name that appears next to its number, and if
   * that name changes the line changes with it.
   */
  if (registration && pe) {
    return `${registration.issuedTo}, TBPELS Firm ${registration.number}`;
  }

  // Both pendings are stated, and separately, because they are separate facts
  // and a reader who is checking one will want to know about the other. A
  // registration alone does not let a firm seal anything.
  if (registration && !pe) {
    return `${registration.issuedTo}, TBPELS Firm ${registration.number}. No engineer of record is yet in responsible charge, and no work is being sealed.`;
  }
  if (!registration && pe) {
    return "Firm registration pending with the Texas Board of Professional Engineers and Land Surveyors.";
  }
  return "Firm registration pending with the Texas Board of Professional Engineers and Land Surveyors. No engineer of record is yet in responsible charge.";
}
