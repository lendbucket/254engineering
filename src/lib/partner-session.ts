import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The partner session cookie. The THIRD principal on this platform.
 *
 * A DELIBERATE MIRROR OF customer-session.ts, AND DELIBERATELY NOT SHARED
 * -----------------------------------------------------------------------
 * There are now three kinds of person who can hold a session here: a member of
 * staff, a customer, and a partner. The shapes are similar because the problem
 * is the same, an HMAC signed cookie so no browser holds a database credential.
 * Everything that could let one be mistaken for another is different on purpose:
 *
 *   the cookie NAME differs, so all three coexist in one browser
 *   the SECRET is its own environment variable
 *   the HMAC LABEL differs, so setting all three secrets to the same string
 *     still produces three different derived keys
 *   the PAYLOAD SHAPE differs again
 *
 * WHY A PARTNER IS NOT A CUSTOMER WITH A FLAG
 * -------------------------------------------
 * Because the two want opposite things from the platform. A customer sees their
 * own orders and the documents they bought. A partner sees who they referred and
 * what they earned, and must never see a client's evidence, an engineer's
 * findings, a sealed document, the firm's cost or the firm's margin.
 *
 * A flag on a customer row would mean every read in the customer surface asks
 * "and which sort of principal is this", which is the shape of a system where
 * one missing check leaks a client's file to a referrer. There is no flag. A
 * partner has no row in eng_customer_users, no row in eng_profiles, and no auth
 * user, so the customer and staff code cannot return one by accident.
 *
 * WHY A PARTNER HAS NO ROLE, LIKE A CUSTOMER
 * ------------------------------------------
 * Roles are what ops-authz grants capabilities from. A partner must never appear
 * in that system. What a partner may do is decided by which partner record they
 * are, and there is no matrix and no capability list that could be widened.
 *
 * THE SIGNING KEY
 * ---------------
 * PARTNER_SESSION_SECRET. Unset means no partner can sign in, ever. The failure
 * mode of a missing secret is a closed door, never an open one, and it is a
 * separate variable from the other two so rotating one does not sign out the
 * others.
 */

export const PARTNER_COOKIE = "eng_partner";

/**
 * Fourteen days.
 *
 * Between the staff session's twelve hours and the customer's thirty. A partner
 * checks their numbers occasionally rather than daily, so a short session is an
 * annoyance that gets a password written down; and the session carries the right
 * to see referral and earnings data for one partner, which is commercially
 * sensitive to that partner and to the firm in a way one customer's own order
 * history is not.
 *
 * Revocation is by suspending the partner, which takes effect on the next
 * request because the row is re-read every time.
 */
const TTL_SECONDS = 14 * 24 * 60 * 60;

const MIN_SECRET_LENGTH = 24;

export type PartnerClaims = {
  /** eng_partner_users.id */
  sub: string;
  /** eng_partners.id */
  partner: string;
  exp: number;
};

function signingKey(): Buffer | null {
  const secret = process.env.PARTNER_SESSION_SECRET;
  if (typeof secret !== "string" || secret.trim().length < MIN_SECRET_LENGTH) return null;
  return createHmac("sha256", secret).update("eng-partner-session-v1").digest();
}

export function partnerSessionConfigured(): boolean {
  return signingKey() !== null;
}

export function partnerSessionStatus(): string {
  const secret = process.env.PARTNER_SESSION_SECRET;
  if (!secret) {
    return "PARTNER_SESSION_SECRET is not set. No partner can sign in until it is.";
  }
  if (secret.trim().length < MIN_SECRET_LENGTH) {
    return `PARTNER_SESSION_SECRET is set but shorter than ${MIN_SECRET_LENGTH} characters. It is rejected as too weak.`;
  }
  return "PARTNER_SESSION_SECRET is configured.";
}

function sign(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/**
 * The payload carries a marker word the other two sessions do not have.
 *
 * A staff cookie is `sub.role.exp`, a customer's is `sub.account.exp`, and both
 * are three fields plus a signature. A partner's is `sub.partner.p.exp`: five
 * fields, with a literal "p" that neither reader will accept in its role or
 * account position.
 *
 * That is belt and braces on top of the different signing keys, and it is here
 * because three similar cookies is the point at which "they cannot be confused
 * because the keys differ" starts depending on nobody ever making the keys the
 * same. The marker does not depend on that.
 */
const MARKER = "p";

export function issuePartnerSession(
  sub: string,
  partner: string,
  now: number = Date.now(),
): { value: string; expiresAt: Date } | null {
  const key = signingKey();
  if (!key) return null;
  const exp = Math.floor(now / 1000) + TTL_SECONDS;
  const payload = `${sub}.${partner}.${MARKER}.${exp}`;
  return {
    value: `${payload}.${sign(payload, key)}`,
    expiresAt: new Date(exp * 1000),
  };
}

/**
 * Verify and decode. Null for anything not currently valid, with no partial
 * success and no "expired but otherwise fine" branch, exactly as the other two.
 */
export function readPartnerSession(
  value: string | undefined | null,
  now: number = Date.now(),
): PartnerClaims | null {
  if (!value) return null;
  const key = signingKey();
  if (!key) return null;

  const parts = value.split(".");
  if (parts.length !== 5) return null;
  const [sub, partner, marker, expRaw, provided] = parts;
  if (!sub || !partner || !expRaw || !provided) return null;
  if (marker !== MARKER) return null;

  const expected = sign(`${sub}.${partner}.${marker}.${expRaw}`, key);
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 <= now) return null;

  /*
   * The partner id must not be one of the staff role words, for the same reason
   * the customer reader checks it: nothing can currently produce such an id
   * because it is a uuid, and that is exactly why it is cheap insurance against
   * a future change to the payload shape.
   */
  if (partner === "admin" || partner === "engineer" || partner === "field_tech") return null;

  return { sub, partner, exp };
}

export function partnerCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}
