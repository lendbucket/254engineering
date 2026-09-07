/**
 * TOTP, RFC 6238, from Node's own crypto.
 *
 * PURE, AND THAT IS THE POINT
 * ---------------------------
 * No database, no environment, no server-only import. Every rule in here is a
 * function of its arguments, so the audit exercises the RULE rather than a
 * setup around it, the same reasoning as attribution-rules.ts, role-rules.ts
 * and job-intake-rules.ts.
 *
 * It is also why this file can be imported by a test at all. The lesson cost
 * something twice this week: the bucket walk and the performance verdict were
 * both buried inside scripts that could not be imported, and both had to be
 * pulled out before they could be checked.
 *
 * WHY THE PARAMETERS ARE THE BORING ONES
 * --------------------------------------
 * SHA1, six digits, a thirty second period. Not because they are the strongest
 * available but because they are what every authenticator app implements with
 * no configuration. A platform that picks SHA256 and eight digits is a platform
 * whose enrolment screen sometimes produces codes that do not work, on a device
 * the firm cannot debug, for a person who is already locked out.
 *
 * WHY THE DRIFT WINDOW IS ONE STEP EITHER SIDE
 * --------------------------------------------
 * Clocks disagree. A zero drift implementation rejects a noticeable share of
 * honest attempts, which teaches people to distrust the mechanism, and the cost
 * is small: it widens the guess space from one code in a million to three.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO
 * ---------------------------------------
 * It does not decide whether a code is acceptable. `verify` reports WHICH step
 * matched and the caller decides, because the replay guard needs the step
 * number and a boolean cannot carry it. A code from a step already used is
 * arithmetically valid and must still be refused, and that refusal belongs
 * beside the row that records the last step, not here.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Thirty seconds, the period every authenticator app assumes. */
export const TOTP_PERIOD_SECONDS = 30;

/** Six digits, likewise. */
export const TOTP_DIGITS = 6;

/**
 * One step either side of now.
 *
 * Stated as a constant rather than inlined so that widening it is a visible
 * change with a number attached, rather than a loop bound somebody adjusted.
 */
export const TOTP_DRIFT_STEPS = 1;

/** 160 bits, which is what RFC 4226 recommends for SHA1. */
const SECRET_BYTES = 20;

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Base32, RFC 4648, without padding.
 *
 * Written out rather than pulled in, because it is twenty lines and a
 * dependency in the authentication path is a dependency in the authentication
 * path. Authenticator apps read this alphabet and no other.
 */
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

/**
 * Decode, tolerating the spaces and lower case a person retyping a secret by
 * hand will produce. Returns null for anything that is not base32 at all,
 * rather than silently decoding a prefix: a secret that decodes to the wrong
 * bytes produces codes that never match, which is the least debuggable failure
 * this system can have.
 */
export function base32Decode(input: string): Buffer | null {
  const clean = input.replace(/[\s-]/g, "").replace(/=+$/, "").toUpperCase();
  if (!clean.length) return null;

  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx === -1) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A fresh secret, as base32 for the person and bytes for the maths. */
export function newTotpSecret(): { base32: string; bytes: Buffer } {
  const bytes = randomBytes(SECRET_BYTES);
  return { base32: base32Encode(bytes), bytes };
}

/** Which time step a moment falls in. */
export function stepAt(nowMs: number): number {
  return Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);
}

/**
 * The code for one step. HOTP over the step counter, which is what TOTP is.
 */
export function codeForStep(secret: Buffer, step: number): string {
  const counter = Buffer.alloc(8);
  /* Big endian 64 bit. writeBigUInt64BE rather than two 32 bit writes, so the
   * high half is not quietly dropped in the year 2038 and beyond. */
  counter.writeBigUInt64BE(BigInt(step));

  const mac = createHmac("sha1", secret).update(counter).digest();

  /* Dynamic truncation, RFC 4226 section 5.3. */
  const offset = mac[mac.length - 1] & 0x0f;
  const binary =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff);

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

/**
 * Does this code match, and at which step.
 *
 * Returns the step so the caller can refuse a replay. A boolean would make that
 * impossible, and the window this scheme leaves open without it is real: the
 * same six digits are valid for ninety seconds, so a code read over a shoulder
 * or off a screen share works again while it is still live.
 *
 * Constant time on the comparison, and it checks EVERY step in the window even
 * after a match, so the number of steps examined does not depend on which one
 * matched.
 */
export function verifyTotp(
  secret: Buffer,
  code: string,
  nowMs: number = Date.now(),
): { ok: boolean; step: number | null } {
  const given = code.replace(/\s/g, "");
  if (!/^\d+$/.test(given) || given.length !== TOTP_DIGITS) return { ok: false, step: null };

  const now = stepAt(nowMs);
  let matched: number | null = null;

  for (let d = -TOTP_DRIFT_STEPS; d <= TOTP_DRIFT_STEPS; d += 1) {
    const step = now + d;
    const expected = Buffer.from(codeForStep(secret, step));
    const actual = Buffer.from(given);
    if (expected.length === actual.length && timingSafeEqual(expected, actual)) {
      if (matched === null) matched = step;
    }
  }

  return { ok: matched !== null, step: matched };
}

/**
 * The otpauth URI an authenticator app scans.
 *
 * The issuer appears twice, in the label and as a parameter, which is what the
 * Key Uri Format specifies and what makes an app show "254 Engineering
 * Services: someone@example.com" rather than a bare address among a dozen
 * others.
 */
export function otpauthUri(secretBase32: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
