/**
 * THE SHARED REGULATORY PATTERN LIBRARY
 *
 * SYNCHRONIZED FILE. Like data/keyword-registry.ts, this is copied verbatim into
 * sealedengineering and stampmyplans. All three brands are Texas engineering
 * firms operating under the same board, the same regulated vocabulary, and the
 * same pending gates, so a claim that is forbidden on one is forbidden on all
 * three. Editing it here creates a divergence until it is copied.
 *
 * WHY THESE PATTERNS EXIST IN ONE PLACE
 * -------------------------------------
 * Two detectors in this repo ask the same question from opposite directions.
 * scripts/launch-audit.mjs boots the site in both gate states and diffs them.
 * scripts/voice-audit.mjs crawls the running site and reads prose. Both need to
 * know what an unlicensed claim looks like, and when they each carried their own
 * list the two lists disagreed within a day. The half that mattered was the
 * stale one.
 *
 * THE LESSON THIS FILE ENCODES, WHICH IS WORTH MORE THAN THE PATTERNS
 * -------------------------------------------------------------------
 * The first regulatory check on this project looked for "we provide
 * engineering", "we seal", "our engineers". It passed on every page of a site
 * that claimed, in twenty places, that a licensed engineer was already reviewing
 * and sealing the work, and that promised the sealing "within a few business
 * days". No engineer had been hired.
 *
 * Every one of those claims was written in the PASSIVE VOICE. "Work is reviewed
 * and sealed by a licensed Professional Engineer" makes exactly the claim that
 * "we seal" makes, and contains none of its words. A phrase list catches the
 * phrasing somebody thought of while writing the list.
 *
 * So the patterns below are grouped by the CLAIM being made rather than by the
 * words used to make it, and each group carries both voices. When you add a
 * pattern here, write the passive form too, and ask what the sentence would look
 * like with the agent removed entirely.
 */

/**
 * A negation guard, for claims whose denial is a sentence a good site should
 * contain.
 *
 * The first run of the compliance audit failed on /llms.txt for the sentence
 * "This firm does not guarantee approvals, permits, or engineering conclusions
 * in advance", which is the disclaimer, not the claim. A check that matches a
 * promise and its denial identically teaches whoever runs it next to delete the
 * honest sentence to get a green board, which is the exact opposite of the
 * check's purpose.
 *
 * Variable length lookbehind is supported in V8, so the guard sits inline in the
 * pattern rather than requiring the text to be pre-processed. Apply it only to
 * claims that a site would legitimately deny. A firm never needs to write "we do
 * not maximize your claim", so that pattern takes no guard.
 */
export const NEGATION_GUARD = String.raw`(?<!\b(?:not|never|cannot|no|nor)\s)`;

/**
 * A conditional guard, for the same reason the negation guard exists.
 *
 * "A commission is earned when the firm delivers the work" is a statement about
 * when something becomes true, not a claim that it is true now. So is "once the
 * firm seals a package" and "until the firm performs the review". A check that
 * cannot tell a subordinate clause from an assertion teaches whoever runs it to
 * delete accurate sentences to get a green board.
 *
 * Deliberately narrow: only the words that introduce a condition or a sequence.
 * "The firm delivers within five days" takes no guard and should not.
 */
export const CONDITIONAL_GUARD = String.raw`(?<!\b(?:when|once|if|until|unless|before|after|whenever|while)\s)`;

/**
 * Claims no engineering firm may make, in any gate state, ever.
 *
 * Guaranteeing an approval or an opinion in advance is a professional conduct
 * problem rather than a marketing excess, and claim maximization language is how
 * an engineering firm ends up being read as a public adjuster by the Texas
 * Department of Insurance.
 */
export const NEVER_CLAIMS = [
  {
    pattern: new RegExp(`${NEGATION_GUARD}guarantee[ds]?\\s+(?:approval|permit|pass|certification|results?)`, "i"),
    why: "guaranteed approval",
  },
  { pattern: /\bwe guarantee\b/i, why: "unqualified guarantee" },
  {
    pattern: new RegExp(`${NEGATION_GUARD}guaranteed\\s+(?:pass|approval|turnaround)`, "i"),
    why: "guaranteed outcome",
  },
  { pattern: /maximi[sz]e\s+(?:your\s+)?(?:claim|settlement|payout|recovery)/i, why: "claim maximization" },
  { pattern: /\bget\s+(?:your\s+)?claim\s+(?:paid|approved)\b/i, why: "claim outcome promise" },
  { pattern: /\bfight\s+(?:your\s+)?insurance\b/i, why: "claim advocacy" },
  { pattern: /\bdenied claim\b/i, why: "claim solicitation" },
  { pattern: /\b100%\s+(?:approval|pass)\b/i, why: "approval rate claim" },
  { pattern: /\bno\s+(?:pass|approval)\s*,?\s*no\s+fee\b/i, why: "contingency on an engineering opinion" },
];

/**
 * ACTIVE VOICE. The firm says it sells engineering services.
 *
 * Forbidden while the firm registration gate is down. These are the obvious ones
 * and they are the ones a writer notices themselves.
 */
export const PRESENT_TENSE_OFFER = [
  { pattern: /\bwe (?:offer|provide|perform|deliver|issue|seal|stamp|inspect|certify)\b/i, why: "first person service claim" },
  /*
   * THIRD PERSON, NAMING THE FIRM. Added 2026-09-05, and it was found the way
   * the header of this file predicts.
   *
   * Phase 9 Section 4 put "254 Engineering Services performs and seals every
   * engagement referred through this programme" on three partner screens. It is
   * the same claim as "we seal", made by naming the firm instead of saying we,
   * and not one pattern in this library matched it.
   *
   * The lists were written from the first person and the passive. A brand
   * writing about itself in the third person is the obvious third voice, and it
   * is the one a partner programme reaches for constantly, because the whole
   * point of a partner surface is telling somebody else which firm does the
   * work.
   */
  {
    pattern: new RegExp(
      `${CONDITIONAL_GUARD}\\b(?:254 Engineering Services|Sealed Engineering|StampMyPlans|the firm)\\s+(?:currently\\s+)?(?:performs|provides|delivers|issues|seals|stamps|inspects|certifies)\\b`,
      "i",
    ),
    why: "third person service claim, naming the firm",
  },
  {
    pattern: new RegExp(`${CONDITIONAL_GUARD}\\bperforms and seals\\b`, "i"),
    why: "states the firm is performing and sealing now",
  },
  { pattern: /\bour engineers\b/i, why: "plural engineer fiction" },
  { pattern: /\bour licensed (?:pe|professional engineer)/i, why: "claims a PE on staff" },
  { pattern: /\border (?:a|an|your)\b/i, why: "invites an order" },
  { pattern: /\bschedule (?:an|your) inspection\b/i, why: "invites a booking" },
  { pattern: /\bnow accepting\b/i, why: "states the firm is trading" },
  { pattern: /\bget started today\b/i, why: "invites an order" },
  { pattern: /\bwe will seal\b/i, why: "promises a seal" },
];

/**
 * PASSIVE VOICE. A licensed engineer is already doing the work.
 *
 * Forbidden while the engineer of record gate is down, which is a SEPARATE gate:
 * a registered firm with nobody able to seal still cannot seal. Every pattern
 * here was found live on a site that passed the active voice list above.
 *
 * Read them as a checklist of ways to make a claim without a subject.
 */
export const PRESENT_TENSE_SEALING = [
  { pattern: /\bis reviewed and sealed by\b/i, why: "states work is being sealed now" },
  { pattern: /\bare reviewed and sealed by\b/i, why: "states work is being sealed now" },
  { pattern: /\bis sealed by a\b/i, why: "states work is being sealed now" },
  { pattern: /\bthe same engineers\b/i, why: "implies engineers already on staff" },
  { pattern: /\blets the firm hold specialists\b/i, why: "implies specialists already retained" },
  { pattern: /\bengineer reviews the record\b/i, why: "present tense review by a PE" },
  { pattern: /\b(?:reviewed and )?sealed within\b/i, why: "turnaround promise for sealed work" },
  { pattern: /\bby licensed (?:Texas )?Professional Engineers\b/i, why: "plural engineer fiction, passive" },
  { pattern: /\bsealed by our\b/i, why: "claims a PE on staff, passive" },
  { pattern: /\bevery deliverable is sealed\b/i, why: "states sealing is happening" },
];

/** Every regulated claim for a site with both gates down. */
export const ALL_REGULATED = [...PRESENT_TENSE_OFFER, ...PRESENT_TENSE_SEALING];

/** Matches from a pattern group, as { why, match, index }. */
export function findClaims(text, group) {
  const hits = [];
  for (const { pattern, why } of group) {
    const m = text.match(pattern);
    if (m) hits.push({ why, match: m[0], index: m.index ?? 0 });
  }
  return hits;
}
