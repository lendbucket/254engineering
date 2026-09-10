/**
 * WHO IS NOT A REAL PERSON.
 *
 * Operator ruling, 2026-09-09: work enqueued by a board fixture or a demo actor
 * is no_external_effect at creation, because the actor is not real. Real work on
 * development still sends.
 *
 * WHY THE RULE IS ABOUT THE ACTOR AND NOT ABOUT THE ENVIRONMENT
 * --------------------------------------------------------------
 * The obvious version suppresses everything on development. It was refused, and
 * the reason is the one that matters most on this platform: it makes production
 * and development behave differently on the exact path where a silent
 * difference means a customer never hears from the firm. A send that works
 * everywhere except where anybody tests it is a send nobody finds out about
 * until it is a support call.
 *
 * The actor rule has no such failure. A real person filling in a real form on
 * development still gets a real email, because that is the behaviour under test.
 * What stops is work whose subject was invented by a harness thirty seconds ago.
 *
 * WHAT THIS IS ANSWERING
 * -----------------------
 * 55 emails went out of development in one day, in two incidents, because a
 * worker claimed jobs nobody meant it to claim. 20 at 05:21 and 35 at 23:08.
 * Every one of them was about an application submitted by a fixture: a person
 * who does not exist, applying for a job that was never posted to them, with a
 * licence number out of a test file. The rows were suppressed afterwards by
 * hand, and the source went on producing more, four of them while the fix was
 * being written.
 *
 * WHY THESE PARTICULAR DOMAINS AND NOTHING WIDER
 * -----------------------------------------------
 * The dangerous direction is a suppression that catches real work, so nothing
 * here is a guess about what looks like a test address.
 *
 *   .invalid          RFC 2606 reserves this TLD as guaranteed never to
 *                     resolve. No person can hold an address there. It is what
 *                     scripts/lib/portal-probe.mjs uses for every probe.
 *   example.com/net/org  RFC 2606 reserves these for documentation, and
 *                     seed-field-demo's whole cast lives at example.com. An
 *                     address there cannot receive anything, so suppressing a
 *                     message TO one costs nothing at all; what it also does is
 *                     stop the notification ABOUT one, which is the half that
 *                     was going to the operator eighteen times.
 *   the audit mailboxes  Named one at a time below rather than matched by
 *                     shape, because they sit on the firm's REAL domain and a
 *                     pattern there could catch a colleague.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * ------------------------------
 * Free text. This is applied to ADDRESS fields, never to the body of a message.
 * A real enquiry that mentions example.com in a sentence is a real enquiry, and
 * a matcher wide enough to see that is a matcher wide enough to swallow it.
 */

/** Domains at which nobody real can be reached. */
export const FIXTURE_DOMAINS = [
  ".invalid",
  "example.com",
  "example.net",
  "example.org",
] as const;

/**
 * Named mailboxes on the firm's own domain that belong to the harness.
 *
 * One at a time, because a pattern on a real domain could catch a person.
 */
export const FIXTURE_ADDRESSES = [
  "forms.audit@254engineering.com",
  "demo-audit@254engineering.com",
  "audit@254engineering.com",
  "bot@254engineering.com",
] as const;

/**
 * Is this address one the harness made up?
 *
 * Absent or unparseable reads as REAL, deliberately. The failure that costs is
 * a suppression somebody did not ask for; an unrecognised address should send.
 */
export function isFixtureIdentity(address: string | null | undefined): boolean {
  if (typeof address !== "string") return false;
  const at = address.lastIndexOf("@");
  if (at <= 0) return false;
  const email = address.trim().toLowerCase();
  const domain = email.slice(email.lastIndexOf("@") + 1);
  if (!domain) return false;

  if (FIXTURE_ADDRESSES.some((a) => a === email)) return true;
  return FIXTURE_DOMAINS.some((d) =>
    d.startsWith(".") ? domain.endsWith(d) : domain === d,
  );
}

/**
 * The mode for work concerning these identities.
 *
 * ANY fixture among them suppresses the whole job, and that asymmetry is the
 * point. The eighteen notifications that reached the operator were addressed to
 * a real person and were ABOUT somebody who does not exist, so a rule that only
 * looked at the recipient would have sent every one of them again.
 */
export function effectModeFor(
  ...identities: (string | null | undefined)[]
): "live" | "no_external_effect" {
  return identities.some(isFixtureIdentity) ? "no_external_effect" : "live";
}
