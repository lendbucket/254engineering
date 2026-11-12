import { createHash, randomBytes } from "node:crypto";
import { validEpoch } from "./session-epoch-rules";

/**
 * THE STORE APP'S SIGN IN TOKEN, AND EVERY RULE ABOUT IT THAT NEEDS NO DATABASE.
 * Robert's answer of 2026-11-10, 06:11 Central, relayed on issue #1
 * (6766967932): "Yes, build it with its migration ... Each phone's token is
 * stored server side so sign out revokes it." Migration 0125; the design is in
 * the morning post, 6767214731.
 *
 * WHY A TOKEN AT ALL. The portal's session is an HttpOnly cookie, twelve hours
 * long, which the app's own code cannot read and so cannot keep anywhere safer
 * than the web view's cookie jar. A technician on a phone would sign in with a
 * password and a code every morning. So once a FULL session exists inside the
 * store app, the server makes a random token, keeps only its sha256 in
 * eng_device_sessions, and hands the raw token back once; the app puts it in
 * the phone's keystore (Android Keystore, iPhone Keychain). When the session
 * ends, the app presents the token and gets a fresh twelve hour session: the
 * same cookie, the same role read from the database on every call.
 *
 * WHAT ENDS ONE, decided by exchangeVerdict below and nowhere else:
 *   - sign out in the app, which stamps it revoked;
 *   - the profile's session epoch moving since it was issued (auth M2, 0120):
 *     a password change, a forced reset, a suspension, a replaced factor;
 *   - a suspended account, or one that is no longer a field technician;
 *   - thirty days from issue, the database's arithmetic (0125's default and
 *     check), never extended by use.
 *
 * THE RISK IT TAKES ON, stated rather than hidden: anybody holding the raw
 * token can sign in as that technician until one of the above ends it. The
 * keystore is what keeps it from other apps; the bounded life and the epoch are
 * what bound the damage of a token that leaks anyway. And a script running in
 * a technician's signed in page could ask for one, which is why issuing needs a
 * full session and is audited.
 */

/** Thirty days, fixed from issue (question 1 of 6767214731). 0125 holds the same figure as its default and its check. */
export const DEVICE_TOKEN_DAYS = 30;

/** Who may hold one: the store app opens My jobs, and only field technicians use it (question 5 of 6767214731). */
export const DEVICE_TOKEN_ROLES = ["field_tech"] as const;

export const DEVICE_PLATFORMS = ["android", "ios"] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

/** A token is "254d1." and 43 base64url characters: 32 random bytes. The prefix names what it is in a log, never what it opens. */
const PREFIX = "254d1.";
const TOKEN_SHAPE = /^254d1\.[A-Za-z0-9_-]{43}$/;

export function mintDeviceToken(): string {
  return `${PREFIX}${randomBytes(32).toString("base64url")}`;
}

/** Whether a presented value is even shaped like a token. Anything else is refused before the database is asked. */
export function wellFormedDeviceToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_SHAPE.test(value);
}

/** What is stored: the sha256 of the whole token, 64 lowercase hex characters, which is 0125's check. */
export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function knownPlatform(value: unknown): value is DevicePlatform {
  return typeof value === "string" && (DEVICE_PLATFORMS as readonly string[]).includes(value);
}

export function mayHoldDeviceToken(role: unknown): boolean {
  return typeof role === "string" && (DEVICE_TOKEN_ROLES as readonly string[]).includes(role);
}

export type DeviceRow = {
  revoked_at: string | null;
  /** Whether the database's now() is still before expires_at, read in the same query. */
  live: boolean;
  epoch_at_issue: unknown;
};

export type DeviceProfile = { role: unknown; status: unknown; session_epoch: unknown } | null;

/**
 * Whether a presented token may become a session, and if not, what to stamp.
 *
 * `revoke` names the reason a still-live row is stamped revoked as the exchange
 * refuses it, so a token that has died for good is never asked about again. A
 * row already revoked, or past its life, is refused with nothing to stamp.
 */
export type ExchangeVerdict =
  | { ok: true; epoch: number }
  | { ok: false; why: "unknown" | "revoked" | "expired"; revoke: null }
  | { ok: false; why: "no_profile" | "suspended" | "role" | "epoch"; revoke: string };

export function exchangeVerdict(row: DeviceRow | null, profile: DeviceProfile): ExchangeVerdict {
  if (!row) return { ok: false, why: "unknown", revoke: null };
  if (row.revoked_at !== null) return { ok: false, why: "revoked", revoke: null };
  if (!row.live) return { ok: false, why: "expired", revoke: null };
  if (!profile) return { ok: false, why: "no_profile", revoke: "the account no longer exists" };
  if (profile.status !== "active") return { ok: false, why: "suspended", revoke: "the account is not active" };
  if (!mayHoldDeviceToken(profile.role)) return { ok: false, why: "role", revoke: "the account is no longer a field technician" };
  if (!validEpoch(row.epoch_at_issue) || !validEpoch(profile.session_epoch) || row.epoch_at_issue !== profile.session_epoch) {
    return { ok: false, why: "epoch", revoke: "the account's sessions were ended after this phone signed in" };
  }
  return { ok: true, epoch: profile.session_epoch };
}

/** The reason sign out stamps. */
export const SIGNED_OUT = "signed out on this phone";
