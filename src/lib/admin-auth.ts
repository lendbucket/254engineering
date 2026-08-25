import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The operator passphrase.
 *
 * This file is the security primitive only. The session cookie, the middleware,
 * the rate limiting, and the login form are Section 3. What lives here is the
 * one comparison everything else depends on, kept separate so it can be reasoned
 * about and tested on its own.
 *
 * THERE IS NO USER TABLE AND THERE IS NOT GOING TO BE ONE
 * -------------------------------------------------------
 * One operator, one passphrase, held in the environment. No registration, no
 * password reset, no email verification, no account recovery. Every one of those
 * is an attack surface, and each exists to solve a problem that a single
 * operator with access to the Vercel dashboard does not have.
 *
 * CONSTANT TIME, AND WHY THE HASH STEP IS NOT DECORATION
 * ------------------------------------------------------
 * `timingSafeEqual` requires equal lengths and throws otherwise. Comparing raw
 * strings would therefore leak the passphrase LENGTH through the difference
 * between a throw and a comparison, which is a real if small disclosure. Hashing
 * both sides to a fixed 32 bytes first means every comparison is over the same
 * number of bytes whatever was submitted, so the only thing observable is that a
 * comparison happened.
 *
 * A plain `===` would additionally short circuit on the first differing
 * character, which is the classic leak this exists to avoid.
 *
 * UNSET IS A CLOSED DOOR, NOT AN OPEN ONE
 * ---------------------------------------
 * If ADMIN_PASSPHRASE is missing or blank, `verifyPassphrase` returns false for
 * every input including the empty string. The failure mode of a missing secret
 * is that nobody can log in, never that everybody can. `adminAuthConfigured`
 * exists so the login page can say so plainly rather than rejecting a correct
 * passphrase with no explanation.
 */

const MIN_PASSPHRASE_LENGTH = 12;

/** Whether a passphrase is configured at all. */
export function adminAuthConfigured(): boolean {
  const secret = process.env.ADMIN_PASSPHRASE;
  return typeof secret === "string" && secret.trim().length >= MIN_PASSPHRASE_LENGTH;
}

/**
 * Compare a submitted passphrase against the configured one.
 *
 * Returns false when nothing is configured. There is no bypass.
 */
export function verifyPassphrase(submitted: unknown): boolean {
  if (typeof submitted !== "string") return false;
  const secret = process.env.ADMIN_PASSPHRASE;
  if (typeof secret !== "string" || secret.trim().length < MIN_PASSPHRASE_LENGTH) return false;

  const a = createHash("sha256").update(submitted, "utf8").digest();
  const b = createHash("sha256").update(secret, "utf8").digest();
  return timingSafeEqual(a, b);
}

/**
 * A one line description of the auth state, for the operator rather than a
 * visitor. Never rendered on a public surface.
 */
export function adminAuthStatus(): string {
  if (!process.env.ADMIN_PASSPHRASE) {
    return "ADMIN_PASSPHRASE is not set. The admin portal cannot be signed into until it is.";
  }
  if (!adminAuthConfigured()) {
    return `ADMIN_PASSPHRASE is set but shorter than ${MIN_PASSPHRASE_LENGTH} characters. It is rejected as too weak and nobody can sign in.`;
  }
  return "ADMIN_PASSPHRASE is configured.";
}
