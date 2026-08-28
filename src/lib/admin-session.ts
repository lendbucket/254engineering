import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The admin session cookie.
 *
 * WHY A SIGNED COOKIE AND NOT A SESSION TABLE
 * -------------------------------------------
 * There is one operator and no user table, by the decision recorded in
 * admin-auth.ts. A session table would exist to answer "is this session still
 * valid", and with one operator the answer is always "unless it expired or the
 * secret rotated", both of which a signed payload already carries.
 *
 * The cookie is signed, not encrypted. Its contents are an issue time and an
 * expiry and neither is a secret; what matters is that they cannot be edited.
 * HMAC over the payload gives exactly that, and encrypting a timestamp nobody
 * needs hidden would be work with no attacker cost attached.
 *
 * THE SIGNING KEY IS DERIVED FROM THE PASSPHRASE
 * ----------------------------------------------
 * Deliberately, and it buys a property worth having: changing ADMIN_PASSPHRASE
 * invalidates every outstanding session immediately. That is the behaviour an
 * operator expects from changing the password, and a separate SESSION_SECRET
 * would have to be rotated by hand at the same moment to get it. One secret,
 * one revocation.
 *
 * The key is HMAC'd with a fixed label rather than used raw, so the value that
 * signs cookies is not the value compared against a login attempt. That keeps a
 * signing oracle from being a passphrase oracle.
 *
 * httpOnly, Secure, SameSite=Lax
 * ------------------------------
 * httpOnly because no client script has any reason to read it and script access
 * is how an XSS becomes a session theft. SameSite=Lax because every admin action
 * is a same site POST from a page the operator is already on, and Lax blocks the
 * cross site form post that CSRF depends on while leaving normal navigation
 * working. Secure always: the site is HTTPS only in every environment that
 * matters, and a session cookie sent in the clear is a session handed over.
 */

export const ADMIN_COOKIE = "eng_admin";

/** Eight hours. A working day, after which the operator signs in again. */
const TTL_SECONDS = 8 * 60 * 60;

function signingKey(): Buffer | null {
  const secret = process.env.ADMIN_PASSPHRASE;
  if (typeof secret !== "string" || secret.trim().length < 12) return null;
  // A derived key, so the cookie signer is not the passphrase itself.
  return createHmac("sha256", secret).update("eng-admin-session-v1").digest();
}

function sign(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/**
 * Mint a session value.
 *
 * The random nonce makes two sessions issued in the same second distinguishable
 * in a log without carrying anything identifying.
 */
export function issueSession(now: Date = new Date()): string | null {
  const key = signingKey();
  if (!key) return null;
  const expires = Math.floor(now.getTime() / 1000) + TTL_SECONDS;
  const payload = `${expires}.${randomBytes(9).toString("base64url")}`;
  return `${payload}.${sign(payload, key)}`;
}

/**
 * Is this cookie value a session this server issued, and still current?
 *
 * Returns false for every malformed, unsigned, wrongly signed, or expired value,
 * and for every value at all when no passphrase is configured. There is no
 * branch that returns true without a verified signature.
 */
export function readSession(value: unknown, now: Date = new Date()): boolean {
  if (typeof value !== "string" || value.length > 400) return false;
  const key = signingKey();
  if (!key) return false;

  const cut = value.lastIndexOf(".");
  if (cut <= 0) return false;
  const payload = value.slice(0, cut);
  const provided = value.slice(cut + 1);

  const expected = sign(payload, key);
  // Equal length by construction, both base64url of 32 bytes, but a hostile
  // value can be any length, so the guard stays.
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const expires = Number(payload.split(".")[0]);
  if (!Number.isFinite(expires)) return false;
  return expires > Math.floor(now.getTime() / 1000);
}

/** The attributes every admin cookie is written with. */
export function sessionCookieOptions(maxAge: number = TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
