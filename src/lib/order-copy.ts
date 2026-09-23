import type { LaunchMode } from "./launch";

/**
 * THE ORDER PAGE'S HEADING, WHICH FOLLOWS THE MODE.
 *
 * ===========================================================================
 * WHY THE HEADING MOVES. Operator ruling, 2026-09-23.
 * ===========================================================================
 *
 * The order page carried the H1 "Order roof certifications" above a card whose
 * entire content said the firm is not taking orders. Nothing about that is a
 * compliance defect and both `voice-audit` and `launch-audit` were right to pass
 * it: the gate forbids a present tense claim that the firm PERFORMS engineering,
 * and a heading naming the route is not one.
 *
 * It is a clarity defect, and it was found by reading the page as a visitor
 * would rather than by any check. Somebody scanning a page reads the heading and
 * the button, which here said "Order" and "Contact the firm", and has to read
 * the paragraph between them to learn that ordering is not available.
 *
 *   trading, prelaunch   "Roof certifications"
 *   open                 "Order roof certifications"
 *
 * The word "Order" appears when ordering is possible and not before.
 *
 * ===========================================================================
 * AND THE LOWERCASING WAS ALREADY WRONG, WHICH IS THE LARGER FIND.
 * ===========================================================================
 *
 * The heading was `Order {service.shortName.toLowerCase()}`. For seven of the
 * eight service lines that is fine. For the eighth it rendered, on production,
 * read off the live page rather than inferred:
 *
 *     Order windstorm wpi-8
 *     Read what windstorm wpi-8 covers before ordering
 *
 * **WPI-8 is a Texas Department of Insurance form name.** Rendering it `wpi-8`
 * in an H1 is the firm misspelling the regulated document it is offering to
 * produce, on the page where somebody decides whether to buy it. It is the same
 * class as the dash rule firing on a signed protocol: a house style applied
 * mechanically to a string that is not the firm's to restyle.
 *
 * So a word keeps its own casing when it carries any, which is what an acronym
 * or a form number does. Everything else is lowercased as before.
 */

/**
 * Does this word carry casing of its own?
 *
 * Two or more capitals is an acronym. A digit means a form number, a standard,
 * or a version. Either way the word was written that way on purpose and is not
 * this file's to change.
 *
 * MATCHED ON THE WORD, NOT ON A WINDOW over the whole name, because a test
 * against the full string would protect "Roof Certifications" from lowercasing
 * the moment any one word in it held an acronym.
 */
const carriesOwnCasing = (word: string): boolean => /[A-Z]{2,}/.test(word) || /\d/.test(word);

/**
 * A service name as it reads inside a sentence.
 *
 * "Roof Certifications" becomes "roof certifications".
 * "Windstorm WPI-8" becomes "windstorm WPI-8".
 */
export function serviceNameInSentence(shortName: string): string {
  return shortName
    .split(" ")
    .map((word) => (carriesOwnCasing(word) ? word : word.toLowerCase()))
    .join(" ");
}

/**
 * The H1 for the order page of one service line.
 *
 * ONE HOME FOR THE PHRASE. The page title and the H1 both render it, and a
 * heading that says "Order" beside a title that does not is one fact with two
 * accounts, which is the most frequently recurring defect in this build.
 */
export function orderHeading(shortName: string, mode: LaunchMode): string {
  const name = serviceNameInSentence(shortName);
  if (mode === "open") return `Order ${name}`;
  return name.charAt(0).toUpperCase() + name.slice(1);
}
