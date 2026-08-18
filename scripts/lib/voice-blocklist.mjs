/**
 * The shared voice rules.
 *
 * WHY THIS IS A MODULE AND NOT A LIST INSIDE THE AUDIT
 * ----------------------------------------------------
 * Two surfaces produce prose on this project: the site and the outbound email.
 * They are written at different times, by different code paths, and they are the
 * two things a reader compares directly when an enquiry gets a reply. A banned
 * phrase list that lives inside the site audit protects one of them and leaves
 * the other free, and the drift is invisible because nobody reads the email
 * templates as prose.
 *
 * So the list lives here and both scripts/voice-audit.mjs and
 * scripts/email-audit.mjs import it. The two surfaces cannot disagree about what
 * good writing is, because there is only one definition of it.
 */

/**
 * The banned phrases.
 *
 * Every one of these is a tell. Not because the words are bad in isolation, but
 * because they are what a language model reaches for when it is filling space
 * rather than saying something, and a reader who has seen a thousand pages of
 * that recognizes it instantly even when they could not name why.
 *
 * Word boundaries matter here. "elevate" is banned and "elevation certificate"
 * is a real term this site has to use, so the patterns are anchored rather than
 * matched as substrings.
 */
export const BANNED_PHRASES = [
  { pattern: /\bunlock(?:s|ing|ed)?\b/i, why: "unlock" },
  { pattern: /\belevat(?:e|es|ing|ed)\b/i, why: "elevate (elevation is fine)" },
  { pattern: /\bseamless(?:ly)?\b/i, why: "seamless" },
  { pattern: /\bjourney\b/i, why: "journey" },
  { pattern: /\bempower(?:s|ing|ed|ment)?\b/i, why: "empower" },
  { pattern: /\bpassionate(?:ly)?\b/i, why: "passionate" },
  { pattern: /\btop[\s-]?notch\b/i, why: "top notch" },
  { pattern: /\bhassle[\s-]?free\b/i, why: "hassle free" },
  { pattern: /\bone[\s-]?stop\b/i, why: "one stop" },
  { pattern: /\bcutting[\s-]?edge\b/i, why: "cutting edge" },
  { pattern: /\bstate[\s-]?of[\s-]?the[\s-]?art\b/i, why: "state of the art" },
  { pattern: /\blook no further\b/i, why: "look no further" },
  { pattern: /\bin today'?s\b/i, why: "in today's" },
  { pattern: /\bwhen it comes to\b/i, why: "when it comes to" },
  { pattern: /\bwe'?ve got you covered\b/i, why: "we've got you covered" },
  { pattern: /\brest assured\b/i, why: "rest assured" },
  { pattern: /\bnot only\b[^.?!]{0,120}\bbut also\b/i, why: "not only X but also Y" },
  // Adjacent tells from the same family, added because they showed up in review
  // of comparable copy and are the same failure.
  { pattern: /\bdelve(?:s|d|ing)?\b/i, why: "delve" },
  { pattern: /\bnavigat(?:e|es|ing) the (?:complex|world|landscape)\b/i, why: "navigate the complex X" },
  { pattern: /\bseamlessly integrat/i, why: "seamlessly integrate" },
  { pattern: /\bin the ever[\s-]?(?:changing|evolving)\b/i, why: "in the ever changing" },
  { pattern: /\bpeace of mind\b/i, why: "peace of mind" },
  { pattern: /\btrusted partner\b/i, why: "trusted partner" },
  { pattern: /\bat the end of the day\b/i, why: "at the end of the day" },
];

/**
 * Present tense claims to performing engineering work.
 *
 * Re-exported from scripts/lib/regulatory.mjs rather than defined here. This
 * file used to carry its own copy, listing only the active voice forms, and a
 * site claiming in twenty places that work "is reviewed and sealed by a licensed
 * Texas Professional Engineer" passed it cleanly. The passive voice makes the
 * same claim with none of the same words.
 *
 * regulatory.mjs is the one definition, it carries both voices, and it is the
 * file the sibling repos consume. See the note at the top of it.
 */
import { ALL_REGULATED } from "./regulatory.mjs";

export {
  ALL_REGULATED,
  NEGATION_GUARD,
  NEVER_CLAIMS,
  PRESENT_TENSE_OFFER,
  PRESENT_TENSE_SEALING,
  findClaims,
} from "./regulatory.mjs";

export const REGULATORY_PRESENT_TENSE = ALL_REGULATED;

/**
 * Structural tells.
 *
 * These are thresholds rather than patterns, and they are set deliberately loose.
 * A style heuristic that fires on good writing gets switched off within a week,
 * and then it protects nothing. Each one only applies where there is enough
 * text for the measurement to mean anything.
 */
export const STRUCTURAL = {
  /** Question headings above this share of all headings reads as a listicle. */
  questionHeadingRatio: 0.4,
  /** Below this many headings the ratio is noise. */
  minHeadings: 5,

  /** Paragraph length variation below this reads as machine cadence. */
  minParagraphCoefficientOfVariation: 0.28,
  /** Below this many paragraphs the variation is noise. */
  minParagraphs: 8,

  /** Consecutive sentences that are each a three item list. */
  maxConsecutiveTriads: 3,

  /** Consecutive paragraphs opening with a bolded lead in. */
  maxConsecutiveBoldLeadIns: 3,
};

/** Every banned phrase found in a string, with its position. */
export function findBannedPhrases(text) {
  const hits = [];
  for (const { pattern, why } of BANNED_PHRASES) {
    const m = text.match(pattern);
    if (m) hits.push({ why, match: m[0], index: m.index ?? 0 });
  }
  return hits;
}

/** Every present tense service claim found in a string. */
export function findRegulatoryClaims(text) {
  const hits = [];
  for (const { pattern, why } of REGULATORY_PRESENT_TENSE) {
    const m = text.match(pattern);
    if (m) hits.push({ why, match: m[0], index: m.index ?? 0 });
  }
  return hits;
}

/**
 * Is this sentence a rhetorical triad?
 *
 * WHAT THE NAIVE VERSION GOT WRONG
 * --------------------------------
 * The first version asked "does this sentence contain two commas and an and",
 * and it reported four consecutive findings on a coverage page whose text was
 * "Travis, Williamson, and Hays counties" followed by "Waco, Temple, Killeen,
 * Bryan, and College Station operate conventional building departments". Those
 * are lists of real places, which is the most factual writing on the site, and
 * the check was flagging the specificity it exists to protect.
 *
 * The tell is a device, not a list: three SHORT items, usually adjectives or
 * verb phrases, stacked for cadence. So this requires exactly three items, each
 * of at most three words, and at least two of them starting lowercase, which is
 * what separates "fast, clean, and reliable" from "Travis, Williamson, and Hays".
 * A fourth item disqualifies it, because a four item list is somebody
 * enumerating rather than performing.
 */
export function isRhetoricalTriad(sentence) {
  const item = String.raw`[A-Za-z][\w'-]*(?:\s+[\w'-]+){0,2}`;
  const triad = new RegExp(`(^|[;:]\\s*|\\s)(${item}),\\s+(${item}),\\s+(?:and|or)\\s+(${item})\\b`);
  const m = sentence.match(triad);
  if (!m) return false;

  /*
   * Reject a match that is the tail of a longer enumeration.
   *
   * The regex can anchor mid-list: given "Waco, Temple, Killeen, Bryan, and
   * College Station" it happily matches "Killeen, Bryan, and College Station"
   * and reports a triad inside a five item list. The tell is the character
   * before the match: a list continuing into this one leaves a comma there.
   *
   * The first version of this guard instead counted commas before the
   * conjunction and required at most one, which is wrong in the other
   * direction: an Oxford comma triad has TWO commas ("fast, clean, and
   * precise"), so the guard rejected every genuine triad and the check silently
   * never fired. It passed its own injection test by doing nothing.
   */
  const start = m.index ?? 0;
  const precedingChar = start > 0 ? sentence.slice(0, start).trimEnd().slice(-1) : "";
  if (precedingChar === ",") return false;

  const items = [m[2], m[3], m[4]].map((s) => s.trim());

  /*
   * A contrast is not a list.
   *
   * "Timelines are set by review, not by design, and planning for that is part
   * of the work" has the shape of a triad and is doing the opposite job: the
   * middle term negates the first rather than joining it. An item opening on a
   * negation or a substitution marks the construction as contrastive.
   */
  if (items.some((s) => /^(?:not|never|nor|rather|instead|but)\b/i.test(s))) return false;

  // Proper nouns are places, agencies, and county names. Those lists are the
  // substance of this site and are not a stylistic device.
  const lowercaseItems = items.filter((s) => /^[a-z]/.test(s)).length;
  return lowercaseItems >= 2;
}

/** A short window of text around an index, for a readable finding. */
export function context(text, index, width = 55) {
  const from = Math.max(0, index - width);
  const to = Math.min(text.length, index + width);
  return `...${text.slice(from, to).replace(/\s+/g, " ").trim()}...`;
}
