import {
  verifiedFirmRegistrations,
  verifiedEngineers,
  operatingNameOnBoardRecord,
  type VerifiedEngineer,
  type VerifiedFirmRegistration,
} from "@/config/credentials";
import {
  stripeAccount,
  approvedProtocols,
  pointInTimeRecovery,
  placeholderPhonePatterns,
} from "@/config/launch-readiness";
import { business } from "@/config/business";
import { stripeAccountBlockedReason } from "./stripe-account";
import { contact } from "@/config/contact";
import { services } from "@/content/services";
import { selfServiceSignUp } from "@/config/launch-conditions";

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
 * looks like the day the gate opens, and it is not: the registration is in the
 * name 254 Services LLC while all three sites hold out as 254 Engineering
 * Services. Setting LAUNCH_MODE=live that afternoon would have printed a
 * registration number beside a name the board has no record of.
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
    unmet: () =>
      process.env.LAUNCH_MODE?.trim().toLowerCase() === "live" ? null : "LAUNCH_MODE is not live.",
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
    what: "A licensed Professional Engineer with a current licence is on the register.",
    whoClears: "The operator, by recording the engineer and the licence expiry he read off the roster.",
    statedIn: "verifiedEngineers in src/config/credentials.ts",
    unmet: () =>
      activeEngineer()
        ? null
        : "No engineer with a current, recorded licence is on the register in src/config/credentials.ts. An unrecorded expiry counts as not current, because sealing rests on the licence being active.",
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
    statedIn: "approvedProtocols in src/config/launch-readiness.ts",
    unmet: () => {
      const waiting = services.filter((s) => !approvedProtocolFor(s.slug)).map((s) => s.slug);
      if (waiting.length === 0) return null;
      if (waiting.length === services.length) {
        return `No service line has a protocol approved by an engineer of record, so all ${services.length} are a waitlist rather than an offer.`;
      }
      return `${waiting.length} of ${services.length} service lines have no approved protocol and are a waitlist: ${waiting.join(", ")}.`;
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
        return "FIRM_PHONE is not ten digits, so it is not a number anybody can ring.";
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
export function selfServiceSignUpOpen(): boolean {
  return selfServiceSignUp.cleared === true;
}

/**
 * Why it is shut, for a person looking at the screen.
 *
 * Deliberately says nothing about preview deployments or session secrets. The
 * reader is somebody who wanted an account, and the reason it is shut is this
 * firm's business rather than theirs; what they need is what to do instead.
 */
export function selfServiceSignUpClosedSentence(): string {
  return "Accounts are not open for sign up yet. Ring the office or send a message and somebody will open one for you.";
}

export function approvedProtocolFor(serviceSlug: string) {
  return approvedProtocols.find((p) => p.serviceSlug === serviceSlug) ?? null;
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
  const today = new Date().toISOString().slice(0, 10);
  return (
    verifiedFirmRegistrations.find((r) => r.status === "active" && r.expires >= today) ?? null
  );
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
  const today = new Date().toISOString().slice(0, 10);
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
 * is a different fact. The entity became 254 Engineering LLC on 2026-09-16 and
 * TBPELS still holds F-29811 in the name 254 Services LLC, so every sentence
 * naming the firm goes on saying what the board holds until the certificate is
 * reissued. Sourcing this from the registration is what makes that true
 * mechanically rather than by remembering.
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
   * public footer reads "254 Services LLC, TBPELS Firm F-29811" with the brand
   * above it, so the day the gate opens the sites already hold out under the
   * registered name.
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
   * LLC". F-29811 is issued to "254 Services LLC", so once the gate opened this
   * line would have put the board's number beside a name the board's record
   * does not carry, which is the exact misstatement the gate exists to prevent,
   * printed in the one place a reader goes to check.
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
