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
export const CONDITIONAL_GUARD = String.raw`(?<!\b(?:when|once|if|until|unless|before|after|whenever|while)\s(?:the\s|a\s|an\s|its\s|their\s|this\s)?)`;

/**
 * EVERY NAME THIS FIRM AND ITS SIBLINGS TRADE UNDER, AS ONE ALTERNATION.
 *
 * ======================================================================
 * A RENAME MUST NOT BE ABLE TO BLIND THESE PATTERNS.
 * ======================================================================
 *
 * The brand was written as a literal in two patterns below. On 2026-09-13 the
 * operator ruled that the firm trades under its REGISTERED name, 254 Services
 * LLC, and the site copy changed accordingly. Had these literals not changed
 * with it, both patterns would have gone on matching a name no sentence uses
 * any more, and voice-audit would have reported green over present-tense
 * service claims made under the new one.
 *
 * That is a regulatory check going silently blind, which is worse than the
 * misstatement it exists to catch: the misstatement is visible to anybody
 * reading the page, and the blind check is visible to nobody.
 *
 * BOTH NAMES STAY. The old one is still the brand on the wordmark, the page
 * titles and og:site_name, so a claim can still be written under it, and a
 * pattern that stopped looking for it would have the same hole pointed the
 * other way.
 */
/*
 * AND EVERY NAME THE FIRM HAS HELD OR IS ABOUT TO HOLD STAYS IN THIS LIST.
 * Operator ruling, 2026-09-15, recorded as a known hazard of renaming rather
 * than as a note.
 *
 * These patterns decide what `voice-audit` can SEE. A rename that changes
 * `issuedTo` in the register without adding the new name here does not make the
 * audit fail: it makes the audit stop matching, so it goes on passing while it
 * has stopped looking at anything. That is the vacuous green in its purest
 * form, and it would arrive on the one commit where the copy is most in flux.
 *
 * It happened once already, in the opposite direction, on 2026-09-13: the name
 * moved to 254 Services LLC and these patterns learned it in the same commit,
 * which is the only reason the audit was still measuring afterwards.
 *
 * 254 Engineering LLC was put here BEFORE any sentence used it, on 2026-09-15,
 * against a reissuance that had not happened yet. **It happened on 2026-09-21,
 * and this alternation is the reason `voice-audit` kept measuring through it.**
 * The entry that matched nothing for six days is the entry that made the
 * rename safe, which is the whole argument for adding a name early rather than
 * on the day it is needed.
 *
 * ===========================================================================
 * AND 254 Services LLC STAYS, THOUGH NO RECORD HOLDS IT ANY MORE.
 * Operator ruling, 2026-09-21. THIS LINE IS NOT PART OF THE RENAME.
 * ===========================================================================
 *
 * The rename swept eighteen occurrences of the old registrant out of
 * `scripts/`. This is the one that must not move, and removing it would be the
 * exact defect the paragraph above describes, arriving by way of a tidy-up:
 * copy anywhere in three repositories may still TYPE the old name, and these
 * patterns are what catches it. Dropping the alternative would make that copy
 * invisible to the audit rather than forbidden by it.
 *
 * The test to apply before ever shortening this list: a name comes OUT only
 * when nothing anywhere could still say it, which is a different question from
 * whether any record still holds it.
 */
const FIRM_NAMES =
  "254 Services LLC|254 Engineering LLC|254 Engineering Services|Sealed Engineering|StampMyPlans|the firm";

/**
 * Claims no engineering firm may make, in any gate state, ever.
 *
 * Guaranteeing an approval or an opinion in advance is a professional conduct
 * problem rather than a marketing excess, and claim maximization language is how
 * an engineering firm ends up being read as a public adjuster by the Texas
 * Department of Insurance.
 */
export const NEVER_CLAIMS = [
  /*
   * A BENCH IS A CLAIM ABOUT CAPACITY NOBODY CAN MAKE. Operator ruling,
   * 2026-09-20, moving these two out of the gated sets where they had been
   * sitting as though they were waiting for something.
   *
   * They are not. THERE IS ONE ENGINEER. These do not become publishable when
   * the firm starts trading, and they do not become publishable when a protocol
   * is approved, because neither event produces a second person. A second
   * engineer would not release them either: the sentence would still be
   * describing a review desk rather than the person who takes responsible
   * charge, which is the fiction the whole gate exists to prevent.
   */
  { pattern: /\bour engineers\b/i, why: "plural engineer fiction, and there is one engineer" },
  { pattern: /\bthe same engineers\b/i, why: "implies a review bench, which is a capacity claim nobody can make" },
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
      `${CONDITIONAL_GUARD}\\b(?:${FIRM_NAMES})\\s+(?:currently\\s+)?(?:performs|provides|delivers|issues|seals|stamps|inspects|certifies)\\b`,
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
  /*
   * THE PASSIVE WITH THE WORK AS THE SUBJECT. Added 2026-09-05.
   *
   * Found by writing a sentence that passed. Seeding the partner asset library
   * needed a paragraph explaining who performs referred work, and the first
   * draft was "Engineering work referred through this programme is carried out
   * by 254 Engineering Services". Every pattern in this file passed it, and it
   * states that the firm is currently carrying out engineering work.
   *
   * "is reviewed and sealed by" was already here. "is carried out by" is the
   * same shape with a different verb, which is what happens when patterns are
   * written from the sentences somebody happened to write.
   *
   * The subject is named deliberately and narrowly. "Field work is carried out
   * by certified technicians" is a statement about how a process is specified
   * and is not the firm claiming to be performing engineering, so the subject
   * has to be the engineering rather than any work at all.
   */
  /*
   * THE AGENT MATTERS, AND THE FIRST VERSION IGNORED IT.
   *
   * That version failed on /terms, for "Field inspection work described on the
   * careers pages is performed by independent contractors rather than
   * employees". That sentence is about how the firm ENGAGES people, it names an
   * agent who is explicitly not the firm, and it is not a claim that the firm is
   * performing engineering.
   *
   * So the match requires either NO agent, which is the agentless passive this
   * file's header warns about, or an agent that is the firm or its engineers.
   * An explicit third party agent is not this claim.
   *
   * Read the lookahead as: not followed by "by somebody who is not us".
   */
  {
    pattern: new RegExp(
      `${CONDITIONAL_GUARD}\\b(?:engineering (?:work|services?)|inspections?|reviews?|sealed (?:work|deliverables?))[^.]{0,60}?\\b(?:is|are)\\s+(?:carried out|performed|undertaken|conducted|completed)\\b(?!\\s+by\\s+(?!${FIRM_NAMES}|our\\b|us\\b|a licensed|licensed|staff))`,
      "i",
    ),
    why: "states the engineering is being carried out now, passive",
  },
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

/**
 * ===========================================================================
 * THE THREE GATES, BECAUSE ONE GATE STOPPED MEANING ONE THING.
 * Operator ruling, 2026-09-20.
 * ===========================================================================
 *
 * ALL_REGULATED was checked under a single condition, and while the gate was a
 * boolean that was right. It is three states now, and the patterns above stopped
 * answering to the same question: some describe a firm that is not registered,
 * some describe work being sealed, and some invite an order. Those three become
 * true on three different days.
 *
 * Holding them together meant the conservative choice blocked sentences that are
 * TRUE. The firm is registered, F-29811 is active, and an engineer of record is
 * on the register: a partner writing "we provide" of that firm is stating a
 * fact, and a check calling it a regulated claim is a check that has stopped
 * describing the world.
 *
 * SO EACH SET NAMES THE CONDITION THAT RETIRES IT.
 *
 *   TRADING_GATED   false until the firm is registered with an engineer of
 *                   record. True today, so these no longer fire.
 *   SEALING_GATED   false until a protocol is approved and something can
 *                   actually be sealed. NOT true today and the sharpest of the
 *                   three: it ties the copy to the precondition that makes it
 *                   true rather than to the money switch, so these keep firing
 *                   through the whole of trading.
 *   OPEN_GATED      about orders and money, retired when the firm opens.
 *
 * AND TWO THAT NEVER RETIRE, moved to NEVER_CLAIMS where they belong. "our
 * engineers" and "the same engineers" are not waiting on a gate: THERE IS ONE
 * ENGINEER, and a bench is a claim about capacity nobody can make. A second
 * engineer would not release them either, because the sentence would still be
 * describing a review desk rather than a person.
 */

/**
 * Retired at TRADING. A firm with a registration and an engineer of record may
 * say it provides engineering, because it does.
 *
 * NOTHING HERE MAY LET A PARTNER TYPE THE FIRM NAME, and that is the operator's
 * caveat rather than a detail.
 *
 * The board and the state BOTH hold 254 Engineering LLC as of the reissuance of
 * 2026-09-21. The earlier wording of this note, that the two records differ,
 * has expired, and the caveat it supported is stronger without it: the firm
 * name has changed twice in eleven days, on 2026-09-16 at the Secretary of
 * State and on 2026-09-21 at the board. Partner copy that TYPES a name goes
 * stale the next time any record moves and nobody will re-read a brochure. So
 * the third person patterns naming the firm stay in SEALING_GATED: they are the
 * ones that would permit a typed name, and they stay blocked until the copy
 * derives it from firmName().
 */
export const TRADING_GATED = [
  { pattern: /\bwe (?:offer|provide|perform|deliver|issue|inspect|certify)\b/i, why: "first person service claim" },
  { pattern: /\bour licensed (?:pe|professional engineer)\b/i, why: "claims a PE on staff" },
];

/**
 * Retired when SEALING IS AVAILABLE, which is an approved protocol rather than
 * an open gate. A registered firm with an engineer and no approved protocol can
 * seal nothing, and every one of these says it is sealing.
 *
 * The third person patterns live here rather than in TRADING_GATED because they
 * name the firm. See the note above: a typed firm name is a stale firm name.
 */
export const SEALING_GATED = [
  ...PRESENT_TENSE_SEALING.filter(
    (r) => !/our engineers|the same engineers/i.test(r.why + String(r.pattern)),
  ),
  { pattern: /\bwe (?:seal|stamp)\b/i, why: "first person sealing claim" },
  PRESENT_TENSE_OFFER.find((r) => r.why === "third person service claim, naming the firm"),
  PRESENT_TENSE_OFFER.find((r) => r.why === "states the firm is performing and sealing now"),
  { pattern: /\bwe will seal\b/i, why: "promises a seal" },
].filter(Boolean);

/** Retired when the firm OPENS. Orders and money, and nothing else. */
export const OPEN_GATED = [
  { pattern: /\border (?:a|an|your)\b/i, why: "invites an order" },
  { pattern: /\bschedule (?:an|your) inspection\b/i, why: "invites a booking" },
  { pattern: /\bnow accepting\b/i, why: "states the firm is trading" },
  { pattern: /\bget started today\b/i, why: "invites an order" },
];

/** Matches from a pattern group, as { why, match, index }. */
export function findClaims(text, group) {
  const hits = [];
  for (const { pattern, why } of group) {
    const m = text.match(pattern);
    if (m) hits.push({ why, match: m[0], index: m.index ?? 0 });
  }
  return hits;
}
