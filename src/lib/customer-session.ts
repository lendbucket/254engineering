import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The customer account session cookie.
 *
 * A DELIBERATE MIRROR OF ops-session.ts, AND DELIBERATELY NOT SHARED WITH IT
 * --------------------------------------------------------------------------
 * The shapes are similar because the problem is the same: an HMAC signed cookie
 * so the browser never holds a database credential. Everything that could let
 * one be mistaken for the other is different on purpose:
 *
 *   the cookie NAME differs, so they can coexist in one browser
 *   the SECRET is a separate environment variable
 *   the HMAC LABEL differs, so even if somebody sets both secrets to the same
 *     string the derived keys are still different
 *   the PAYLOAD SHAPE differs: this one carries an account id and no role at all
 *
 * That last one is the important one. readOpsSession validates the third field
 * against the three staff roles, and a customer cookie has an account id there
 * instead, so an ops session can never be forged from a customer one even if the
 * signing key were somehow shared. The audit asserts both directions.
 *
 * WHY A CUSTOMER HAS NO ROLE
 * --------------------------
 * Because roles are what ops-authz grants capabilities from, and a customer must
 * never appear in that system at all. What a customer may do is decided by which
 * account they belong to and nothing else. There is no matrix, no capability
 * list, and no value that could be widened into one by a well meaning change.
 *
 * THE SIGNING KEY
 * ---------------
 * CUSTOMER_SESSION_SECRET. Unset means no customer can sign in, ever. The
 * failure mode of a missing secret is a closed door, never an open one, and it
 * is a SEPARATE variable from OPS_SESSION_SECRET so rotating one does not sign
 * out the other.
 */

export const CUSTOMER_COOKIE = "eng_customer";

/**
 * Thirty days. Longer than the staff session's twelve hours, and the reason is
 * the opposite of a security relaxation: a buyer placing eight orders a month
 * who is signed out every day will keep the tab open forever or write the
 * password down. The session carries no capability beyond one account's own
 * orders, and revocation is by suspending the user, which takes effect on the
 * next request because the row is re-read every time.
 */
const TTL_SECONDS = 30 * 24 * 60 * 60;

const MIN_SECRET_LENGTH = 24;

export type CustomerClaims = {
  /** eng_customer_users.id */
  sub: string;
  /** eng_customer_accounts.id */
  account: string;
  exp: number;
};

function signingKey(): Buffer | null {
  const secret = process.env.CUSTOMER_SESSION_SECRET;
  if (typeof secret !== "string" || secret.trim().length < MIN_SECRET_LENGTH) return null;
  return createHmac("sha256", secret).update("eng-customer-session-v1").digest();
}

export function customerSessionConfigured(): boolean {
  return signingKey() !== null;
}

export function customerSessionStatus(): string {
  const secret = process.env.CUSTOMER_SESSION_SECRET;
  if (!secret) {
    return "CUSTOMER_SESSION_SECRET is not set. No customer can sign in until it is.";
  }
  if (secret.trim().length < MIN_SECRET_LENGTH) {
    return `CUSTOMER_SESSION_SECRET is set but shorter than ${MIN_SECRET_LENGTH} characters. It is rejected as too weak.`;
  }
  return "CUSTOMER_SESSION_SECRET is configured.";
}

function sign(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function issueCustomerSession(
  sub: string,
  account: string,
  now: number = Date.now(),
): { value: string; expiresAt: Date } | null {
  const key = signingKey();
  if (!key) return null;
  const exp = Math.floor(now / 1000) + TTL_SECONDS;
  const payload = `${sub}.${account}.${exp}`;
  return {
    value: `${payload}.${sign(payload, key)}`,
    expiresAt: new Date(exp * 1000),
  };
}

/**
 * Verify and decode. Null for anything that is not currently valid, with no
 * partial success and no "expired but otherwise fine" branch, exactly as the
 * ops session does.
 */
export function readCustomerSession(
  value: string | undefined | null,
  now: number = Date.now(),
): CustomerClaims | null {
  if (!value) return null;
  const key = signingKey();
  if (!key) return null;

  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [sub, account, expRaw, provided] = parts;
  if (!sub || !account || !expRaw || !provided) return null;

  const expected = sign(`${sub}.${account}.${expRaw}`, key);
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 <= now) return null;

  /*
   * The account id must not be one of the staff role words. Nothing can
   * currently produce such an id, because it is a uuid, and that is exactly why
   * this is cheap insurance: if the payload shape ever changes, this is the line
   * that stops a customer cookie shaped like an ops cookie.
   */
  if (account === "admin" || account === "engineer" || account === "field_tech") return null;

  return { sub, account, exp };
}

export function customerCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true as const,
    secure: true as const,
    sameSite: "lax" as const,
    path: "/",
    ...(expiresAt ? { expires: expiresAt } : { maxAge: 0 }),
  };
}
