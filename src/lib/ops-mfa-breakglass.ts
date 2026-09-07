import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * THE BREAK GLASS, WHICH IS A DECISION RATHER THAN AN OVERSIGHT.
 *
 * The question the brief insists on answering: the operator loses their second
 * factor and their recovery codes. What happens?
 *
 * Operator ruling, 2026-09-07: a one time environment variable reset.
 *
 * Setting MFA_BREAK_GLASS to `<email>:<token>` in the Vercel Production scope
 * lets that one account clear its own second factor on its next sign in, after
 * its password. The operator then removes the variable.
 *
 * WHY THIS ONE
 * ------------
 * Recovery requires access to the Vercel account, which is a second credential
 * the operator already holds and an attacker with a stolen password does not.
 * It adds no permanent bypass to the product, it needs no second administrator
 * to exist, and it is deliberately slow: a deployment's environment is
 * snapshotted at creation, so using it costs a redeploy.
 *
 * WHAT IT COSTS, STATED RATHER THAN DISCOVERED
 * --------------------------------------------
 * While it is set, it is a live bypass. So it names ONE account rather than
 * applying to anybody, using it clears the enrolment and forces a fresh one,
 * every use writes the audit trail, and the operator status surface reports
 * loudly for as long as the variable is present. A break glass left set is the
 * hazard, and it is made visible rather than trusted to be tidied away.
 *
 * It does not survive losing Vercel too. If both the second factor and the
 * Vercel account are gone, the firm is locked out and recovery is a database
 * statement run by whoever holds the service role key. That is written into
 * docs/disaster-recovery.md rather than left to be worked out at the time.
 *
 * THE THREE THAT WERE REJECTED are in docs/mfa-design.md section 6, because the
 * reasons they were rejected are what make this one right rather than merely
 * chosen.
 */

/** Long enough that guessing it is not the attack, stated so it is checkable. */
const MIN_TOKEN_LENGTH = 24;

export type BreakGlass = { email: string; token: string };

/**
 * Parse the variable. Null when unset or malformed, and malformed is treated as
 * unset rather than as an error: a half typed value must not become a bypass
 * that matches something unexpected.
 */
export function breakGlassConfigured(): BreakGlass | null {
  const raw = process.env.MFA_BREAK_GLASS;
  if (typeof raw !== "string") return null;

  const at = raw.lastIndexOf(":");
  if (at <= 0) return null;

  const email = raw.slice(0, at).trim().toLowerCase();
  const token = raw.slice(at + 1).trim();

  if (!email.includes("@") || token.length < MIN_TOKEN_LENGTH) return null;
  return { email, token };
}

/** For the status surface. A break glass left set is the thing to shout about. */
export function breakGlassStatus(): string {
  const parsed = breakGlassConfigured();
  if (!parsed) {
    const raw = process.env.MFA_BREAK_GLASS;
    if (typeof raw === "string" && raw.trim().length > 0) {
      return "MFA_BREAK_GLASS is set but malformed, so it does nothing. It should be removed or corrected.";
    }
    return "MFA_BREAK_GLASS is not set, which is the normal state.";
  }
  return `MFA_BREAK_GLASS IS SET for ${parsed.email}. This is a live bypass of the second factor. Remove it once the account is back.`;
}

/**
 * Does this attempt match the break glass.
 *
 * Constant time on the token, and it compares the EMAIL too, because the whole
 * point of naming an account is that the variable is not a skeleton key. Both
 * halves are checked even when the first fails, so a mismatch cannot be timed
 * to learn which half was wrong.
 */
export function breakGlassMatches(email: string, token: string): boolean {
  const parsed = breakGlassConfigured();
  if (!parsed) return false;

  const emailGiven = Buffer.from(email.trim().toLowerCase());
  const emailWant = Buffer.from(parsed.email);
  const tokenGiven = Buffer.from(token.trim());
  const tokenWant = Buffer.from(parsed.token);

  const emailOk =
    emailGiven.length === emailWant.length && timingSafeEqual(emailGiven, emailWant);
  const tokenOk =
    tokenGiven.length === tokenWant.length && timingSafeEqual(tokenGiven, tokenWant);

  return emailOk && tokenOk;
}
