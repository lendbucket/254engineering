import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { RoleKey } from "./ops-authz";
import { wellFormedRoleKey } from "./role-rules";

/**
 * The portal session cookie.
 *
 * WHY THE PLATFORM MINTS ITS OWN COOKIE INSTEAD OF STORING SUPABASE'S JWT
 * -----------------------------------------------------------------------
 * Supabase Auth is the credential store: it hashes passwords, it verifies them,
 * and it is where a password change actually happens. It is not the session.
 *
 * The usual integration puts an anon key and a project URL in the browser and
 * lets the client hold a JWT. This repo cannot do that and should not want to.
 * src/lib/supabase.ts records the reason: every eng_ table has RLS on with zero
 * policies, so a browser client would be a key with no permissions attached to a
 * codebase that now has to reason about two access paths. There is no
 * NEXT_PUBLIC_SUPABASE_URL and no anon key anywhere in this repo, and
 * `import "server-only"` makes that a build error rather than a review comment.
 *
 * So the server verifies the password against Supabase, and then issues this:
 * an HMAC signed cookie carrying the user id, the role, and an expiry. The
 * browser never holds a database credential of any kind.
 *
 * WHY THE ROLE IS IN THE COOKIE, AND WHY IT IS STILL RE-READ
 * ----------------------------------------------------------
 * The role rides along so src/proxy.ts can gate a route without a database
 * round trip on every request. It is a cache, not the truth. Every server action
 * and route handler loads the profile and uses THAT role, because a role changed
 * or an account suspended five minutes ago must take effect now rather than in
 * eight hours. A cookie that outranked the database would make suspension
 * advisory.
 *
 * THE SIGNING KEY
 * ---------------
 * OPS_SESSION_SECRET, hashed with a fixed label so the value that signs cookies
 * is not the value in the environment. Unset means nobody can sign in, ever.
 * The failure mode of a missing secret is a closed door, never an open one.
 *
 * Rotating the secret invalidates every outstanding session, which is the
 * behaviour an operator wants from a rotation and the reason it is a separate
 * variable from anything else.
 */

export const OPS_COOKIE = "eng_ops";

/** Twelve hours. Long enough for a working day in the field, short enough to matter. */
const TTL_SECONDS = 12 * 60 * 60;

/**
 * Ten minutes for a half authenticated session.
 *
 * Long enough to open an authenticator app, or to scan a QR code and copy the
 * recovery codes down, and short enough that a stolen password plus an
 * abandoned browser tab is not most of the way in. It is not a working session
 * and must not last like one.
 */
const PENDING_TTL_SECONDS = 10 * 60;


const MIN_SECRET_LENGTH = 24;

/**
 * THE ROLE FIELD IS A KEY, NOT A MEMBER OF A UNION, AND IT WAS BOTH FOR A WHILE
 * ----------------------------------------------------------------------------
 * This said `Role`, the union of the three roles that shipped in Phase 0, and
 * `readOpsSession` enforced it with a literal comparison against those three.
 * Phase 10 Section 2 made roles rows and the platform now ships seven.
 *
 * The effect, found on 2026-09-07 and reproduced before it was fixed: a
 * dispatcher, a salesperson, a customer service account and a read only account
 * could sign in completely successfully, with the password verified, the audit
 * row written, `last_sign_in_at` updated and the cookie set, and then the very
 * next request read that cookie, failed the membership test, and returned null.
 * They landed back on the sign in screen with no error, because from the
 * platform's point of view nothing had gone wrong. A success indistinguishable
 * from nothing happening, which is the defect class this repository hunts.
 *
 * It survived because `roles-audit`'s live half iterated `ROLES`, the same
 * three, while its pure half iterated all seven. The audit was looking at the
 * right thing in the wrong list.
 *
 * What replaces the membership test is a SHAPE test, which is the question this
 * layer actually has: the cookie is split on the dot, so the role segment has
 * to be something that survives that. Which roles EXIST is the database's
 * question, and `currentActor` asks it on every request.
 */
export type SessionClaims = {
  sub: string;
  role: RoleKey;
  exp: number;
};

/**
 * A SESSION THAT HAS NOT SATISFIED THE SECOND FACTOR IS NOT A SESSION.
 *
 * Phase 12 Section 1, and the brief's wording is implemented literally rather
 * than approximately, because the approximate version is the one this
 * repository keeps finding defects in.
 *
 * The cookie carries a FACTOR field. A password alone mints a PENDING session;
 * a verified code mints a FULL one. Then `readOpsSession` returns a session only
 * for a full one, and a pending cookie reads as null exactly like a forged or
 * expired one. `readPendingSession` is separate, and the only callers are the
 * challenge screen and the endpoint that verifies a code.
 *
 * WHY THAT SHAPE AND NOT A BOOLEAN ON THE ACTOR
 * ---------------------------------------------
 * Every existing caller of readOpsSession refuses a pending session with no
 * change to itself: the proxy over every portal route, and currentActor behind
 * every server action and route handler. There is no list of protected routes
 * to keep in step with a list of MFA exempt ones, because there is no such
 * list, and a route added tomorrow is covered by construction.
 *
 * A boolean each screen checks would work everywhere somebody remembered it and
 * nowhere else, and the failure would be silent. That is the shape of the
 * defect found in this very file on the same day: four of seven roles could not
 * hold a session because one check carried a stale list.
 *
 * FOUR SEGMENTS BECOME FIVE, AND EVERY CURRENT SESSION ENDS
 * ---------------------------------------------------------
 * A four segment cookie is REFUSED rather than read as pre MFA and let through.
 * Anything else would be a downgrade attack: strip the factor field and be
 * treated as legacy. Everyone signs in again once, which is the correct price
 * and is the same thing rotating the signing secret already does.
 */
export type Factor = "pending" | "full";

export type PendingClaims = SessionClaims & { factor: "pending" };

function signingKey(): Buffer | null {
  const secret = process.env.OPS_SESSION_SECRET;
  if (typeof secret !== "string" || secret.trim().length < MIN_SECRET_LENGTH) return null;
  return createHmac("sha256", secret).update("eng-ops-session-v1").digest();
}

/** Whether a session can be issued at all. The sign in screen says so plainly. */
export function opsSessionConfigured(): boolean {
  return signingKey() !== null;
}

export function opsSessionStatus(): string {
  const secret = process.env.OPS_SESSION_SECRET;
  if (!secret) {
    return "OPS_SESSION_SECRET is not set. Nobody can sign into the portal until it is.";
  }
  if (secret.trim().length < MIN_SECRET_LENGTH) {
    return `OPS_SESSION_SECRET is set but shorter than ${MIN_SECRET_LENGTH} characters. It is rejected as too weak and nobody can sign in.`;
  }
  return "OPS_SESSION_SECRET is configured.";
}

function sign(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/**
 * Mint a cookie value for a verified user.
 *
 * Returns null when unconfigured, and null for a role key that would not
 * survive the round trip. Refusing to mint is deliberately harsher than
 * minting something the reader will reject: the caller sees a 503 at sign in
 * and the operator sees a role that cannot be used, rather than a person who
 * signs in successfully and is not signed in.
 */
export function issueOpsSession(
  sub: string,
  role: RoleKey,
  factor: Factor = "full",
  now: number = Date.now(),
): { value: string; expiresAt: Date } | null {
  const key = signingKey();
  if (!key) return null;
  if (!wellFormedRoleKey(role)) return null;
  if (factor !== "pending" && factor !== "full") return null;

  /*
   * A pending session is short. It exists to carry somebody from a password to
   * a code, or to an enrolment they are required to complete, and nothing else.
   * Twelve hours of half authenticated session would be twelve hours in which a
   * stolen password is most of the way in.
   */
  const ttl = factor === "pending" ? PENDING_TTL_SECONDS : TTL_SECONDS;
  const exp = Math.floor(now / 1000) + ttl;
  const payload = `${sub}.${role}.${factor}.${exp}`;
  return {
    value: `${payload}.${sign(payload, key)}`,
    expiresAt: new Date(exp * 1000),
  };
}

/**
 * Verify and decode a cookie value.
 *
 * Returns null for anything that is not a currently valid, correctly signed
 * session: wrong shape, bad signature, expired, unknown role, or no secret
 * configured. There is no partial success and no "expired but otherwise fine"
 * branch for a caller to get wrong.
 */
export function readOpsSession(value: string | undefined | null, now: number = Date.now()): SessionClaims | null {
  const claims = readAnyFactor(value, now);
  /*
   * A pending session is not a session. See the note on Factor: this is the one
   * line that gives every caller in the codebase the enforcement without any of
   * them knowing about it.
   */
  return claims && claims.factor === "full" ? { sub: claims.sub, role: claims.role, exp: claims.exp } : null;
}

/**
 * The half authenticated session, for the two places that are allowed to see
 * one: the challenge screen and the endpoint that verifies a code.
 *
 * Deliberately a different function rather than a flag on the one above, so
 * reaching for it is a visible act in a diff. A parameter would let a caller
 * opt into seeing pending sessions by adding one word, which is exactly how a
 * boundary stops being one.
 */
export function readPendingSession(
  value: string | undefined | null,
  now: number = Date.now(),
): PendingClaims | null {
  const claims = readAnyFactor(value, now);
  return claims && claims.factor === "pending"
    ? { sub: claims.sub, role: claims.role, exp: claims.exp, factor: "pending" }
    : null;
}

/** Verify and decode without judging the factor. Private on purpose. */
function readAnyFactor(
  value: string | undefined | null,
  now: number,
): (SessionClaims & { factor: Factor }) | null {
  if (!value) return null;
  const key = signingKey();
  if (!key) return null;

  const parts = value.split(".");
  /*
   * FIVE, and a four segment cookie is refused rather than read as pre MFA.
   * Accepting the old shape would be a downgrade attack: strip the factor and
   * be treated as fully authenticated.
   */
  if (parts.length !== 5) return null;
  const [sub, role, factor, expRaw, provided] = parts;
  if (!sub || !role || !factor || !expRaw || !provided) return null;
  if (factor !== "pending" && factor !== "full") return null;

  const expected = sign(`${sub}.${role}.${factor}.${expRaw}`, key);
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 <= now) return null;

  /*
   * Shape, not membership. See the note on SessionClaims: asking "is this one
   * of the three roles I know about" is how four of seven roles were signed out
   * by their own first request. Whether the role still EXISTS, and what it may
   * do, are answered by currentActor against the database on every request,
   * which is where they belong and where a role deleted five minutes ago takes
   * effect immediately.
   */
  if (!wellFormedRoleKey(role)) return null;

  return { sub, role, exp, factor };
}

/**
 * Cookie attributes.
 *
 * httpOnly because no script has a reason to read it and script access is how an
 * XSS becomes a stolen session. SameSite=Lax because every portal action is a
 * same site request and Lax stops the cross site form post CSRF depends on.
 * Secure always.
 */
/**
 * THE ENROLMENT COMPLETION TOKEN, AND WHY IT REPLACED A TIME COMPARISON.
 *
 * ======================================================================
 * THE BOARD CAUGHT THE FIRST VERSION OF THIS, AND IT WAS A SECURITY
 * BOUNDARY BUILT ON TWO CLOCKS.
 * ======================================================================
 *
 * Moving the session from `confirm` to the recovery code acknowledgement
 * created a call that upgrades a half authenticated session into a full one
 * with no code typed. Sound while the confirm and the acknowledgement are the
 * same sign in, and unsound the moment they are not, so the two had to be
 * bound together.
 *
 * The first binding compared the enrolment's `verified_at` against the moment
 * the calling session began, derived from the pending cookie's expiry. It
 * passed standalone twice and went RED on the board, which is exactly what a
 * flaky boundary looks like, and the structure says why: `verified_at` is
 * written by the DATABASE clock through transaction_timestamp(), and the cookie
 * is minted by the APPLICATION clock through Date.now(). Nothing synchronises
 * those two. The expiry is also whole seconds, so the derived start time is up
 * to 999ms early, and every millisecond of that slack is in the attacker's
 * favour.
 *
 * A boundary that depends on two unsynchronised clocks agreeing is not a
 * boundary. It is a race that usually goes the right way.
 *
 * SO THIS COMPARES NO CLOCKS FOR THE BINDING AT ALL. `confirm` mints a token
 * and only `confirm` can, because minting requires the signing key and the
 * call that mints it required a valid code from the authenticator app.
 * `codes_saved` will not complete an enrolment without one. Somebody holding a
 * stolen password has a pending session and no token, and cannot make one.
 *
 * THREE SEGMENTS, NEVER FIVE. A session cookie carries five and readAnyFactor
 * refuses anything else, so a completion token can never be presented as a
 * session, and a session can never be presented as a completion token. The
 * shapes are disjoint by construction rather than by a check somebody has to
 * remember to write.
 *
 * IT IS SINGLE USE, and not by anything in here: the acknowledgement refuses an
 * enrolment whose codes are already acknowledged, so a replayed token finds
 * nothing left to do. The expiry below is a second bound rather than the
 * mechanism, and it compares Date.now() with a value Date.now() produced, which
 * is one clock.
 */
const COMPLETION_TTL_SECONDS = 15 * 60;

/** Mint the token `confirm` hands back. Null when unconfigured. */
export function issueEnrolmentCompletion(sub: string, now: number = Date.now()): string | null {
  const key = signingKey();
  if (!key) return null;
  const exp = Math.floor(now / 1000) + COMPLETION_TTL_SECONDS;
  const payload = `${sub}.${exp}`;
  return `${payload}.${sign(payload, key)}`;
}

/**
 * Verify one, and say whose it is.
 *
 * Returns null for anything that is not a currently valid, correctly signed
 * token. There is no partial success, for the same reason readOpsSession has
 * none: a caller given an "expired but otherwise fine" branch will eventually
 * take it.
 */
export function readEnrolmentCompletion(
  value: string | undefined | null,
  now: number = Date.now(),
): { sub: string } | null {
  if (!value) return null;
  const key = signingKey();
  if (!key) return null;

  const parts = value.split(".");
  if (parts.length !== 3) return null;

  const [sub, expRaw, mac] = parts;
  const payload = `${sub}.${expRaw}`;
  const want = sign(payload, key);
  const got = Buffer.from(mac);
  const expect = Buffer.from(want);
  if (got.length !== expect.length || !timingSafeEqual(got, expect)) return null;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 <= now) return null;
  if (!sub) return null;

  return { sub };
}

export function opsCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true as const,
    secure: true as const,
    sameSite: "lax" as const,
    path: "/",
    ...(expiresAt ? { expires: expiresAt } : { maxAge: 0 }),
  };
}
