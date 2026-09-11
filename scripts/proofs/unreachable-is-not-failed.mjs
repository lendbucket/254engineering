/**
 * UNREACHABLE IS NOT FAILED, EXERCISED ON THE ERRORS THAT PRODUCED THE RULING.
 *
 *   node scripts/proofs/unreachable-is-not-failed.mjs
 *
 * Pure. No Chrome, no server, no network, so it runs in under a second. Every
 * audit that reads the verdict CALLS this before it measures anything, so the
 * rule it is about to apply is verified on every run rather than on the day
 * somebody remembers to run this file. Same arrangement as the perf gate, and
 * for the same reason.
 *
 * WHAT THIS IS GUARDING AGAINST
 * ------------------------------
 * A third verdict is a licence to be quiet. The dangerous failure is not that
 * COULD NOT TELL fires too rarely, it is that it fires too often and becomes
 * the answer every broken thing gets. So the cases below are mostly spent on
 * errors that must STAY failures, and the sharpest of them is a click timeout,
 * because a click timeout and a navigation timeout are one word apart.
 *
 * THE STRINGS ARE REAL
 * ---------------------
 * Every message here was copied out of a board log from 2026-09-09, not
 * invented. A proof written against a made up error message proves that the
 * pattern matches the made up message.
 */

import { navigationVerdict, UNREACHABLE, COULD_NOT_TELL } from "../lib/reachable.mjs";

/**
 * @param {boolean} loud  Print every case. False when an audit calls it.
 * @returns {{failed: string[], total: number}}
 */
export function checkNavigationVerdict(loud = false) {
  const failed = [];
  let total = 0;
  const say = (line) => {
    if (loud) console.log(line);
  };
  const rec = (name, ok, note = "") => {
    total += 1;
    if (!ok) failed.push(name);
    say(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
  };

  /** Both halves of the verdict, so a case cannot pass by being half right. */
  const unreachable = (name, message, note = "") => {
    const v = navigationVerdict(new Error(message));
    rec(name, v.unreachable === true && v.reason === message.split("\n")[0].trim(), note);
  };
  const stillAFailure = (name, message, note = "") => {
    const v = navigationVerdict(new Error(message));
    rec(name, v.unreachable === false, note || v.reason);
  };

  say("");
  say("========= UNREACHABLE IS NOT FAILED =========");

  say("\nTHE ERROR THAT WROTE THIRTY ONE FALSE FINDINGS");
  /*
   * Copied from the board of 2026-09-09 that lost its server inside
   * mobile-overflow-audit. Thirty one routes reported a layout defect.
   */
  unreachable(
    "a killed server is unreachable, not an overflow",
    "page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3225/portal/files",
    "this exact string, times thirty one, was the finding list that day",
  );

  say("\nTHE OTHER WAYS NOTHING ANSWERS");
  unreachable("a connection dropped mid answer", "page.goto: net::ERR_CONNECTION_RESET at http://localhost:3225/");
  unreachable("a connection closed", "page.goto: net::ERR_CONNECTION_CLOSED at http://localhost:3225/");
  unreachable("an answer with nothing in it", "page.goto: net::ERR_EMPTY_RESPONSE at http://localhost:3225/");
  unreachable(
    "a host that does not resolve, which is a wrong BASE_URL and not a broken page",
    "page.goto: net::ERR_NAME_NOT_RESOLVED at https://not-a-real-host.example/",
  );
  unreachable("the node side of the same refusal", "connect ECONNREFUSED 127.0.0.1:3225");
  unreachable("a socket that hung up", "socket hang up");
  unreachable("a preflight fetch with nothing to reach", "fetch failed");
  unreachable(
    "a navigation that was accepted and never finished",
    "page.goto: Timeout 45000ms exceeded.\nCall log:\n  - navigating to \"http://localhost:3225/portal\"",
    "something is listening and not answering; still nothing measured",
  );

  say("\nAND THE ONES THAT MUST STAY RED");
  /*
   * THE SHARPEST CASE IN THIS FILE.
   *
   * Copied from the board of 2026-09-09 that died inside careers-audit. A
   * generic /Timeout \d+ ?ms exceeded/ was written first and would have matched
   * this, reclassifying a submit button that never becomes clickable as "could
   * not tell". That is a real defect, it killed a whole board run, and it is
   * exactly the thing a wide matcher would have made quiet.
   */
  stillAFailure(
    "a click that timed out is a defect, not an unreachable server",
    "locator.click: Timeout 30000ms exceeded.\nCall log:\n  - waiting for getByTestId('application-flow')",
    "one word from page.goto, and the opposite verdict",
  );
  stillAFailure(
    "a locator that never appeared is a defect",
    "locator.waitFor: Timeout 20000ms exceeded.",
  );
  stillAFailure(
    "a navigation the app never completed after a press is a defect",
    "page.waitForURL: Timeout 20000ms exceeded.",
    "the server answered; the application did not go where it said it would",
  );
  stillAFailure(
    "a server that answered with a certificate it should not have",
    "page.goto: net::ERR_CERT_AUTHORITY_INVALID at https://254engineering.com/",
    "something answered, and what it said is a real finding",
  );
  stillAFailure(
    "a page that threw while being measured",
    "TypeError: Cannot read properties of null (reading 'scrollHeight')",
  );
  stillAFailure(
    "an error nobody has classified stays loud",
    "some entirely new failure mode nobody has seen before",
    "the default is FAIL, so a novel error cannot be swallowed as could not tell",
  );

  say("\nTHE VERDICT CARRIES THE REASON, BECAUSE THE REASON IS WHAT A READER ACTS ON");
  {
    const v = navigationVerdict(
      new Error("page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3225/portal\nCall log:\n  - navigating"),
    );
    rec(
      "the first line only, so a call log does not become the finding",
      v.reason === "page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3225/portal",
      v.reason,
    );
  }
  {
    /* A thrown string rather than an Error. Playwright throws Errors, but a
     * verdict that crashes on the one day something else is thrown is a verdict
     * that fails at the moment it is needed. */
    const v = navigationVerdict("net::ERR_CONNECTION_REFUSED");
    rec("a thrown string is read rather than crashed on", v.unreachable === true, v.reason);
  }

  say("\nTHE SHAPE OF THE DECLARATION ITSELF");
  rec(
    "the exit code is a third number, not zero and not one",
    COULD_NOT_TELL !== 0 && COULD_NOT_TELL !== 1,
    `${COULD_NOT_TELL}; zero would make a board green over a server that was not there, one would make it a content failure`,
  );
  rec(
    "every pattern is explicit rather than a catch all",
    UNREACHABLE.every((p) => !p.test("some entirely new failure mode nobody has seen before")),
    `${UNREACHABLE.length} named patterns`,
  );

  return { failed, total };
}

/**
 * EVERY AUDIT THAT READS THE VERDICT CHECKS THE RULE BEFORE IT MEASURES.
 *
 * Nineteen cases, pure, in well under a second, run on every invocation rather
 * than on the day somebody remembers this file exists. If the rule that decides
 * failure from unreachable is broken, everything the audit says afterwards is
 * worthless in both directions: it either invents defects in pages nobody saw
 * or goes quiet about real ones. So it aborts rather than printing a board.
 *
 * One wording in one place. Three audits calling this is three lines; three
 * audits carrying their own copy of the block would be three wordings of one
 * decision, which is how two accounts of one rule start to disagree.
 */
export function assertNavigationVerdictHolds() {
  const { failed, total } = checkNavigationVerdict(false);
  if (!failed.length) return;
  console.log("");
  console.log(`THE UNREACHABLE RULE IS BROKEN: ${failed.length} of ${total} cases fail.`);
  for (const f of failed) console.log(`  ${f}`);
  console.log("");
  console.log("Nothing was measured. An audit that cannot tell a missing server from a broken");
  console.log("page reports defects that are not there, or misses ones that are.");
  console.log("  node scripts/proofs/unreachable-is-not-failed.mjs");
  process.exit(1);
}

/* Run directly: print everything and set an exit code. Same basename compare as
 * the perf proof, because file:// URLs and Windows paths do not agree on how
 * many slashes a drive letter gets. */
const invokedDirectly =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());

if (invokedDirectly) {
  const { failed, total } = checkNavigationVerdict(true);
  console.log("");
  console.log(
    failed.length
      ? `FAIL: ${failed.length} of ${total} cases. ${failed.join("; ")}`
      : `PASS: ${total} cases. Unreachable answers could not tell, and everything else stays red.`,
  );
  process.exit(failed.length ? 1 : 0);
}
