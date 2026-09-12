import {
  verifiedFirmRegistrations,
  operatingNameOnBoardRecord,
  type VerifiedFirmRegistration,
} from "@/config/credentials";
import {
  stripeAccount,
  approvedProtocols,
  pointInTimeRecovery,
  placeholderPhonePatterns,
} from "@/config/launch-readiness";
import { contact } from "@/config/contact";
import { services } from "@/content/services";

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
export type LaunchMode = "prelaunch" | "live";

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
    what: "The operator has thrown the switch.",
    whoClears: "The operator, in the deployment environment.",
    statedIn: "LAUNCH_MODE=live",
    unmet: () =>
      process.env.LAUNCH_MODE?.trim().toLowerCase() === "live" ? null : "LAUNCH_MODE is not live.",
  },

  {
    id: "registration",
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
    id: "operating-name",
    /*
     * AND THE BOARD HOLDS THE NAME THIS FIRM TRADES UNDER. The condition this
     * ruling exists for: a registration in one name does not authorise holding
     * out under another.
     */
    what: "The board holds the name this firm trades under.",
    whoClears:
      "The operator files an assumed name for 254 Engineering Services and gets TBPELS acknowledgement of it, or renames the entity.",
    statedIn: "operatingNameOnBoardRecord in src/config/credentials.ts",
    unmet: () =>
      operatingNameOnBoardRecord.onRecord
        ? null
        : `The board does not hold the operating name. ${operatingNameOnBoardRecord.because}`,
  },

  {
    id: "stripe",
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
    id: "recovery",
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

export function launchBlockers(): string[] {
  return LAUNCH_CONDITIONS.map((c) => c.unmet()).filter((s): s is string => s !== null);
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
  return launchBlockers().length === 0 ? "live" : "prelaunch";
}

/** True while the firm may not represent that it is performing engineering work. */
export function isPrelaunch(): boolean {
  return launchMode() === "prelaunch";
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
  if (isPrelaunch()) return false;
  return Boolean(process.env.TBPELS_PE_LICENSE?.trim());
}

/**
 * The registration line that appears in the footer on every page.
 *
 * Two different sentences, both true at the time they render. The prelaunch one
 * is a disclosure; the live one is a credential, and Texas rules require the
 * firm registration number to appear on the firm's public representations once
 * it exists.
 */
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
