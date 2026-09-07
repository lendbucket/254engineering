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
 * layer actually has: the cookie is `sub.role.exp.signature` split on the dot,
 * so the role segment has to be something that survives that. Which roles exist
 * is the database's question, and `currentActor` asks it on every request.
 */
export type SessionClaims = {
  sub: string;
  role: RoleKey;
  exp: number;
};

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
  now: number = Date.now(),
): { value: string; expiresAt: Date } | null {
  const key = signingKey();
  if (!key) return null;
  if (!wellFormedRoleKey(role)) return null;
  const exp = Math.floor(now / 1000) + TTL_SECONDS;
  const payload = `${sub}.${role}.${exp}`;
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
  if (!value) return null;
  const key = signingKey();
  if (!key) return null;

  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [sub, role, expRaw, provided] = parts;
  if (!sub || !role || !expRaw || !provided) return null;

  const expected = sign(`${sub}.${role}.${expRaw}`, key);
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

  return { sub, role, exp };
}

/**
 * Cookie attributes.
 *
 * httpOnly because no script has a reason to read it and script access is how an
 * XSS becomes a stolen session. SameSite=Lax because every portal action is a
 * same site request and Lax stops the cross site form post CSRF depends on.
 * Secure always.
 */
export function opsCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true as const,
    secure: true as const,
    sameSite: "lax" as const,
    path: "/",
    ...(expiresAt ? { expires: expiresAt } : { maxAge: 0 }),
  };
}
