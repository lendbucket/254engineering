import { activeFirmRegistration, firmName } from "./launch";

/**
 * THE PARTNER SIGN-IN'S FIRM LINE, ONE SENTENCE. Robert's ruling 1 of
 * 2026-11-08 on the sign-in redesign: "Keep the partner firm line, but make it
 * one sentence and keep it in the future tense", for example "Referred work
 * will be performed and sealed by 254 Engineering LLC, TBPELS Firm F-29811."
 *
 * Future tense in every gate state, on his word, so it never flips to a
 * present tense claim. The name and the number are read off the register as
 * one pair, never typed, so the number is only ever printed beside the name the
 * board issued it to. With no active registration the number is left out
 * rather than guessed.
 *
 * ITS OWN FILE, NOT partner-copy.ts. partner-audit holds partner-copy.ts to
 * carrying no regulated phrase of its own ("and does not define regulated
 * patterns of its own"), so its vocabulary has one home in
 * scripts/lib/regulatory.mjs. This sentence is copy rather than a pattern, but
 * it contains the words that check looks for, and the check stays as strict
 * as it is.
 *
 * For now it is the sign-in page's line only; performingFirmLine() stays on
 * every other partner surface until Robert says whether this replaces it there
 * too.
 */
export function referredWorkLine(): string {
  const registration = activeFirmRegistration();
  return registration
    ? `Referred work will be performed and sealed by ${registration.issuedTo}, TBPELS Firm ${registration.number}.`
    : `Referred work will be performed and sealed by ${firmName()}.`;
}
