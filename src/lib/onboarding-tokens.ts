import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Invite tokens for the onboarding flow.
 *
 * THE THREAT THIS IS BUILT AGAINST
 * --------------------------------
 * /onboarding/[token] is the only route on this site that shows one named
 * person's government identity documents back to them. It has no login. The
 * token IS the credential, so it has to behave like one.
 *
 * Four properties, and each is a deliberate choice rather than a default:
 *
 * ENTROPY. 32 random bytes from the OS CSPRNG, base64url encoded to 43
 * characters. Guessing one is not a thing an attacker can do. Math.random is not
 * used anywhere near this file, and randomBytes is the only source.
 *
 * THE PLAINTEXT IS NEVER STORED. The database holds sha256 of the token and
 * nothing else. A dump of eng_onboardings does not yield a working link. The
 * plaintext exists exactly once, in the response to the admin who generated it,
 * and is never recoverable afterwards: a lost link is regenerated, not looked
 * up.
 *
 * WHY SHA-256 AND NOT BCRYPT. A password is low entropy and human chosen, so it
 * needs a slow hash to survive an offline dictionary attack. A 256 bit random
 * token has no dictionary. Slow hashing it would buy nothing and would put a
 * deliberate delay on the hot path of every page load in the flow. This is the
 * same reasoning that applies to session tokens and API keys.
 *
 * CONSTANT TIME COMPARISON. Lookup is by hash equality in the database, which is
 * already not timing sensitive in a useful way, but `matchesHash` exists for the
 * paths that compare in application code and it does not short circuit.
 *
 * NO TOKEN, NO PAGE
 * -----------------
 * A missing, malformed, unknown, or expired token produces a 404 and not a 403
 * or a friendly "this link has expired" page at a distinct status. A 403 tells
 * an attacker the route exists and that the token space is worth probing. The
 * route behaves as though it does not exist, which is also true from the point
 * of view of anybody without a valid token.
 *
 * The expired case is the one exception worth naming: an expired token is a real
 * person with a real link that has aged out, and telling them nothing is hostile.
 * That is resolved in the route rather than here, by 404ing the flow and offering
 * a single "request a new link" path that reveals nothing about whether the token
 * ever existed.
 */

/** 32 bytes. Base64url of that is 43 characters with no padding. */
const TOKEN_BYTES = 32;

/** Tokens age out two weeks after they are issued. Regenerable from admin. */
export const INVITE_TTL_DAYS = 14;

export type GeneratedInvite = {
  /** Shown to the admin once. Never stored, never logged, never emailed twice. */
  token: string;
  tokenHash: string;
  expiresAt: Date;
};

/**
 * Mint a new invite.
 *
 * Returns the plaintext alongside the hash because the caller has to do two
 * things with them: put the hash in the database and put the token in a link.
 * The plaintext must not outlive that.
 */
export function generateInvite(now: Date = new Date()): GeneratedInvite {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { token, tokenHash: hashToken(token), expiresAt };
}

/** sha256, hex. The only form of a token that touches storage. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Constant time comparison of a token against a stored hash.
 *
 * timingSafeEqual throws on a length mismatch, which would itself leak, so both
 * sides are hashed to a fixed 32 bytes first and the comparison is always over
 * equal lengths.
 */
export function matchesHash(token: string, storedHash: string): boolean {
  const a = createHash("sha256").update(token, "utf8").digest();
  let b: Buffer;
  try {
    b = Buffer.from(storedHash, "hex");
  } catch {
    return false;
  }
  if (b.length !== a.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Is a token shaped like one this system issued?
 *
 * Cheap rejection before any database work, so a route being probed with junk
 * does not cost a query. It is a shape check and not a security control: a
 * string that passes still has to match a stored hash.
 */
export function looksLikeToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function isExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  const at = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return !Number.isFinite(at.getTime()) || at.getTime() <= now.getTime();
}

/** The absolute link handed to the admin. */
export function inviteUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/onboarding/${token}`;
}
