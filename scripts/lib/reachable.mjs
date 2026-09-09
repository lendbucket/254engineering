/**
 * UNREACHABLE IS NOT FAILED, AND THIS IS WHERE THE THREE ANSWERS ARE DECIDED.
 *
 * Operator ruling, 2026-09-08, carried into Phase 12 Section 4 as the third of
 * Section 0's four debts: an audit whose live half cannot run reports a third
 * verdict, COULD NOT TELL, rather than a failure.
 *
 * THE FAILURE THIS EXISTS BECAUSE OF, 2026-09-09
 * -----------------------------------------------
 * A board run lost its server partway through mobile-overflow-audit. The audit
 * caught every navigation error, wrote thirty one findings reading
 * `/portal/files @390: did not load`, and the board reported an audit that had
 * found thirty one layout defects. There were none. There was no app.
 *
 * The runner already re-checks the server before every phase one audit, and it
 * did: the server was answering when this one started and was gone a minute
 * later. A check before the audit says nothing about minute two, so the audit
 * itself has to be able to say which of the three things happened.
 *
 * THE THREE ANSWERS
 * ------------------
 *   PASS            the page loaded and the property held
 *   FAIL            the page loaded and the property did not
 *   COULD NOT TELL  the page never loaded, so this audit measured nothing
 *
 * WHY A NAVIGATION ERROR IS NOT A FINDING
 * ----------------------------------------
 * Every audit that reads this module asks a question about a RENDERED page:
 * does it overflow, does it carry its assets, does it behave like the native
 * shell. A navigation that never completed answers none of those. Recording it
 * as a failure of the property is a claim about layout made by something that
 * never saw a layout, which is this repository's recurring defect class wearing
 * a browser: a check answering about the wrong subject.
 *
 * WHY AN HTTP STATUS IS STILL A FAILURE
 * --------------------------------------
 * A non-200 is not in here, and deliberately. The server answered and said no.
 * That is a fact about the running application, measured, and the audits keep
 * recording it as a failure.
 *
 * WHY THE LIST IS EXPLICIT AND THE DEFAULT IS FAIL
 * -------------------------------------------------
 * An unknown error stays a FAILURE. The dangerous direction here is not a red
 * that should have been amber, it is a whole class of real defect quietly
 * reclassified as "could not tell" by a catch-all, and a verdict that swallows
 * anything it does not recognise is a verdict nobody can trust. So every
 * pattern below is one somebody looked at and named, and anything else is loud.
 *
 * A NAVIGATION TIMEOUT COUNTS AS UNREACHABLE, AND THAT IS A JUDGMENT
 * -------------------------------------------------------------------
 * Chromium answers a dead port with ERR_CONNECTION_REFUSED in milliseconds, so
 * a goto timeout means something accepted the connection and never finished
 * answering: a server mid rebuild, a hung route, a machine under load. None of
 * those is an overflow, a missing asset or a scroll container. The audit did
 * not measure, and saying so is the honest answer. A route that hangs every run
 * will report COULD NOT TELL every run, loudly and by name, which is a better
 * bug report than a false finding about layout.
 *
 * A timeout on anything OTHER than the navigation is a failure and stays one.
 * The reasoning is beside the pattern, because that is where somebody widening
 * it will be standing.
 */

/**
 * Each pattern is a way the browser says it never got an answer. The comment
 * beside it is what produces it, because a bare regex list is a thing the next
 * reader has to guess at.
 */
export const UNREACHABLE = [
  // Nothing is listening on the port. This is the killed server, and it is the
  // error that produced thirty one false findings.
  /net::ERR_CONNECTION_REFUSED/,
  // Listening, then dropped the connection. A process going down mid answer.
  /net::ERR_CONNECTION_RESET/,
  /net::ERR_CONNECTION_CLOSED/,
  /net::ERR_CONNECTION_ABORTED/,
  // Accepted and answered with nothing at all.
  /net::ERR_EMPTY_RESPONSE/,
  // The host does not resolve. A wrong BASE_URL rather than a broken page.
  /net::ERR_NAME_NOT_RESOLVED/,
  /net::ERR_ADDRESS_UNREACHABLE/,
  /net::ERR_INTERNET_DISCONNECTED/,
  // The node side of the same thing, which is what a fetch preflight sees.
  /ECONNREFUSED/,
  /ECONNRESET/,
  /socket hang up/,
  /fetch failed/,
  /*
   * Accepted the connection and never finished answering. See the judgment
   * above, and note how narrow this is: `page.goto` and nothing else.
   *
   * THE PATTERN THAT WAS WRITTEN FIRST AND TAKEN BACK OUT
   * ------------------------------------------------------
   * `/Timeout \d+ ?ms exceeded/` matches every Playwright timeout, and
   * Playwright spells a click timeout `locator.click: Timeout 15000ms
   * exceeded`. A control that never becomes clickable is a real defect, and in
   * this same section one of them killed a whole board run. Swallowing it as
   * "could not tell" would have hidden exactly the failure that cost the most
   * to find.
   *
   * That is the wide matcher defect this repository keeps meeting: a thing
   * looking at the right subject through a window bigger than the subject. The
   * window here is the one call whose failure means no page arrived.
   */
  /page\.goto: Timeout/,
];

/**
 * The verdict on one navigation error.
 *
 * Returns `unreachable: true` when the browser never got an answer, with the
 * first line of the error as the reason, because the reason is what tells the
 * next reader whether to restart a server or fix a route.
 */
export function navigationVerdict(err) {
  const message = String(err && err.message ? err.message : err);
  const first = message.split("\n")[0].trim();
  return {
    unreachable: UNREACHABLE.some((p) => p.test(message)),
    reason: first,
  };
}

/**
 * THE EXIT CODE FOR "I COULD NOT MEASURE".
 *
 * Zero would make the board green over a server that was not there, which is
 * the other way to lie about the same run. One would make it indistinguishable
 * from a content failure, which is the thing this module exists to stop. So it
 * is a third number, `npm run audit` reads it as a third column, and a
 * standalone run prints it and says the live half did not happen.
 */
export const COULD_NOT_TELL = 3;

/**
 * THE SETUP HALF, WHICH IS WHERE THIS ACTUALLY BITES FIRST.
 *
 * A browser audit signs a probe in before it measures anything, and signing in
 * is a fetch. Pointed at a dead port, mobile-overflow-audit did not report
 * COULD NOT TELL for fifty routes: it threw ECONNREFUSED out of the sign in and
 * died with a stack trace, having measured nothing and said nothing useful
 * about why. The route level verdict never got a chance to run.
 *
 * So the same three answers are available before the first page is opened. This
 * runs `fn`, and if it fails because nothing answered, it prints the verdict and
 * exits on the third code instead of crashing.
 *
 * Anything else is rethrown. A sign in that fails because the CREDENTIALS are
 * wrong is a real failure and must stay loud.
 */
export async function orCouldNotTell(fn, subject) {
  try {
    return await fn();
  } catch (err) {
    const verdict = navigationVerdict(err);
    if (!verdict.unreachable) throw err;
    console.log("");
    console.log(`  COULD NOT TELL: ${subject} could not be reached (${verdict.reason}).`);
    console.log("");
    console.log("  Nothing was measured, and that is not a pass and not a failure. Start the");
    console.log("  server, or run this through npm run audit, which starts its own.");
    process.exit(COULD_NOT_TELL);
  }
}

/**
 * The block a standalone audit prints when something was not measured. One
 * spelling in one place, so the three audits cannot drift into three wordings
 * of the same verdict.
 */
export function sayCouldNotTell(unmeasured, subject) {
  if (!unmeasured.length) return;
  console.log("");
  for (const u of unmeasured) console.log(`  COULD NOT TELL: ${u}`);
  console.log("");
  console.log(`  ${unmeasured.length} of these never loaded, so ${subject} was not measured on`);
  console.log("  them. That is not a pass and it is not a failure. The usual cause is a");
  console.log("  server that went away mid run: its own log ends cleanly when something");
  console.log("  killed it, and carries the error when it fell over by itself.");
}
