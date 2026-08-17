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
 * The current mode. Anything other than the literal "live" is prelaunch,
 * including a missing variable, an empty one, and a typo.
 */
export function launchMode(): LaunchMode {
  return process.env.LAUNCH_MODE?.trim().toLowerCase() === "live" ? "live" : "prelaunch";
}

/** True while the firm may not represent that it is performing engineering work. */
export function isPrelaunch(): boolean {
  return launchMode() === "prelaunch";
}

/**
 * The TBPELS firm registration number, or null while it is pending.
 *
 * Returns null in prelaunch regardless of what the variable holds. The number
 * arriving in the environment is not the same event as the registration being
 * active, and rendering a number the board has not issued would be a worse
 * misstatement than rendering none.
 */
export function tbpelsFirmNumber(): string | null {
  if (isPrelaunch()) return null;
  const value = process.env.TBPELS_FIRM_NUMBER?.trim();
  return value ? value : null;
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
  const firmNumber = tbpelsFirmNumber();
  if (firmNumber) {
    return `${businessLegalName} TBPELS Firm No. ${firmNumber}`;
  }
  return "Firm registration pending with the Texas Board of Professional Engineers and Land Surveyors.";
}

const businessLegalName = "254 Engineering Services LLC";
