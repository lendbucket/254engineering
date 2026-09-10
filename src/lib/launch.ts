import {
  verifiedFirmRegistrations,
  operatingNameOnBoardRecord,
  type VerifiedFirmRegistration,
} from "@/config/credentials";

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
export function launchBlockers(): string[] {
  const blockers: string[] = [];

  if (process.env.LAUNCH_MODE?.trim().toLowerCase() !== "live") {
    blockers.push("LAUNCH_MODE is not live.");
  }

  /*
   * A registration the board actually issued, read from the register rather
   * than from the environment. An environment variable can differ between a
   * build and a deployment; a file cannot.
   */
  const registration = activeFirmRegistration();
  if (!registration) {
    blockers.push(
      "No active firm registration is recorded in src/config/credentials.ts, or the one recorded has expired.",
    );
  }

  /*
   * AND THE BOARD HOLDS THE NAME THIS FIRM TRADES UNDER. The condition this
   * ruling exists for: a registration in one name does not authorise holding
   * out under another.
   */
  if (!operatingNameOnBoardRecord.onRecord) {
    blockers.push(`The board does not hold the operating name. ${operatingNameOnBoardRecord.because}`);
  }

  return blockers;
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
  const registration = isPrelaunch() ? null : activeFirmRegistration();
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
    return `${registration.issuedTo} TBPELS Firm No. ${registration.number}`;
  }

  // Both pendings are stated, and separately, because they are separate facts
  // and a reader who is checking one will want to know about the other. A
  // registration alone does not let a firm seal anything.
  if (registration && !pe) {
    return `${registration.issuedTo} TBPELS Firm No. ${registration.number}. No engineer of record is yet in responsible charge, and no work is being sealed.`;
  }
  if (!registration && pe) {
    return "Firm registration pending with the Texas Board of Professional Engineers and Land Surveyors.";
  }
  return "Firm registration pending with the Texas Board of Professional Engineers and Land Surveyors. No engineer of record is yet in responsible charge.";
}
