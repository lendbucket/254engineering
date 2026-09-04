import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { supabaseAdmin, SITE_KEY } from "./supabase";
import {
  CUSTOMER_COOKIE,
  issueCustomerSession,
  readCustomerSession,
  customerSessionConfigured,
} from "./customer-session";

/**
 * Customer credentials, kept entirely away from the staff ones.
 *
 * WHY THE PASSWORD IS HASHED HERE AND NOT IN SUPABASE AUTH
 * --------------------------------------------------------
 * Supabase Auth is the staff credential store. Putting customers in it would
 * mean one auth.users table holding both the firm's engineers and its customers,
 * and from then on the only thing keeping a customer out of the portal would be
 * a query that remembers to check. The strongest version of this boundary is
 * that a customer has no row in auth.users at all, and that means this file owns
 * the hashing.
 *
 * scrypt, from Node's own crypto, with a per user salt. No dependency, and the
 * parameters are stated rather than defaulted so raising them later is a visible
 * change rather than an invisible one.
 *
 * WHAT THIS FILE CANNOT DO, BY CONSTRUCTION
 * -----------------------------------------
 * It cannot return an Actor. ops-authz's can() takes an Actor and there is no
 * path from a CustomerPrincipal to one. A route handler that wanted to give a
 * customer a staff capability would have to construct an Actor by hand, which is
 * the kind of thing a reviewer sees.
 */

/** Cost parameters, named so a change is deliberate. */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };

export const MIN_CUSTOMER_PASSWORD_LENGTH = 12;

export type CustomerPrincipal = {
  id: string;
  accountId: string;
  email: string;
  displayName: string;
  accountRole: "owner" | "member";
  status: "invited" | "active" | "suspended";
  account: {
    id: string;
    site: string;
    clientId: string;
    status: "active" | "suspended" | "closed";
    billingMode: "card" | "invoice";
    creditLimitCents: number | null;
    netDays: number;
  };
};

// ------------------------------------------------------------------ hashing

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT.maxmem,
  }).toString("base64");
}

export function newPasswordRecord(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("base64");
  return { hash: hashPassword(password, salt), salt };
}

/**
 * Constant time comparison, and it refuses rather than throwing when the stored
 * record is incomplete.
 *
 * An account that has been invited but never set a password has a null hash. The
 * naive version compares against an empty string and, with a short enough
 * password, could match. This returns false for a missing hash before it
 * compares anything.
 */
export function passwordMatches(password: string, hash: string | null, salt: string | null): boolean {
  if (!hash || !salt) return false;
  const computed = Buffer.from(hashPassword(password, salt));
  const stored = Buffer.from(hash);
  if (computed.length !== stored.length) return false;
  return timingSafeEqual(computed, stored);
}

// ------------------------------------------------------------------- tokens

const TOKEN_BYTES = 32;
export const CUSTOMER_TOKEN_TTL_HOURS = 72;

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Mint a one time link. Any outstanding link for that purpose dies. */
export async function issueCustomerToken(
  customerUserId: string,
  purpose: "set_password" | "reset_password",
): Promise<{ token: string; expiresAt: Date } | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  await db
    .from("eng_customer_auth_tokens")
    .delete()
    .eq("customer_user_id", customerUserId)
    .eq("purpose", purpose)
    .is("used_at", null);

  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + CUSTOMER_TOKEN_TTL_HOURS * 60 * 60 * 1000);

  const { error } = await db.from("eng_customer_auth_tokens").insert({
    customer_user_id: customerUserId,
    purpose,
    token_hash: hashToken(token),
    expires_at: expiresAt.toISOString(),
  });
  if (error) return null;
  return { token, expiresAt };
}

export type CustomerTokenResult =
  | { ok: true; userId: string; email: string; displayName: string }
  | { ok: false; reason: "invalid" | "expired" | "used" };

/** Look at a token without spending it, so a link survives being opened twice. */
export async function inspectCustomerToken(token: string): Promise<CustomerTokenResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, reason: "invalid" };

  const { data } = await db
    .from("eng_customer_auth_tokens")
    .select("id, customer_user_id, expires_at, used_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!data) return { ok: false, reason: "invalid" };
  if (data.used_at) return { ok: false, reason: "used" };
  if (new Date(data.expires_at as string).getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const { data: user } = await db
    .from("eng_customer_users")
    .select("id, email, display_name")
    .eq("id", data.customer_user_id)
    .maybeSingle();
  if (!user) return { ok: false, reason: "invalid" };

  return {
    ok: true,
    userId: user.id as string,
    email: user.email as string,
    displayName: user.display_name as string,
  };
}

/** Spend a token and set the password. The token is spent even on a weak one. */
export async function setCustomerPassword(
  token: string,
  password: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The account system is not configured." };

  if (password.length < MIN_CUSTOMER_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Use at least ${MIN_CUSTOMER_PASSWORD_LENGTH} characters. The link still works.`,
    };
  }

  const inspected = await inspectCustomerToken(token);
  if (!inspected.ok) {
    return {
      ok: false,
      error:
        inspected.reason === "expired"
          ? "That link has expired. Ask the firm for a new one."
          : inspected.reason === "used"
            ? "That link has already been used."
            : "That link is not valid.",
    };
  }

  const { hash, salt } = newPasswordRecord(password);

  /*
   * The token is spent FIRST, conditionally on it still being unspent. Two
   * requests racing on the same link both pass inspection; only one updates a
   * row here, and the loser is told the link was used rather than both being
   * allowed to set a password.
   */
  const { data: spent } = await db
    .from("eng_customer_auth_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", hashToken(token))
    .is("used_at", null)
    .select("id");

  if (!spent || spent.length === 0) {
    return { ok: false, error: "That link has already been used." };
  }

  const { error } = await db
    .from("eng_customer_users")
    .update({ password_hash: hash, password_salt: salt, status: "active" })
    .eq("id", inspected.userId);

  if (error) return { ok: false, error: "The password could not be set." };
  return { ok: true, userId: inspected.userId };
}

// ------------------------------------------------------------------ sign in

const GENERIC_REFUSAL = "That email address and password do not match an account.";

export async function signInCustomer(
  email: string,
  password: string,
): Promise<{ ok: true; principal: CustomerPrincipal } | { ok: false; error: string }> {
  if (!customerSessionConfigured()) {
    return { ok: false, error: "Accounts are not available on this deployment." };
  }

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The account system is not configured." };

  const { data: user } = await db
    .from("eng_customer_users")
    .select("id, account_id, email, display_name, account_role, status, password_hash, password_salt")
    .ilike("email", email.trim())
    .maybeSingle();

  /*
   * One refusal for every failure: no such address, wrong password, invited but
   * never set one, suspended. A message that distinguishes them is an oracle
   * that tells somebody which addresses have accounts.
   *
   * The password is still hashed when the user is absent, so a missing address
   * does not answer measurably faster than a wrong password.
   */
  if (!user) {
    passwordMatches(password, null, null);
    hashPassword(password, "absent-user-timing-salt");
    return { ok: false, error: GENERIC_REFUSAL };
  }

  if (!passwordMatches(password, user.password_hash as string | null, user.password_salt as string | null)) {
    return { ok: false, error: GENERIC_REFUSAL };
  }

  if (user.status !== "active") return { ok: false, error: GENERIC_REFUSAL };

  const principal = await loadPrincipal(user.id as string);
  if (!principal) return { ok: false, error: GENERIC_REFUSAL };

  /*
   * The ACCOUNT's state is checked as well as the user's. A suspended account
   * with active users is the case an operator creates when a business stops
   * paying, and it must close the door for all of them.
   */
  if (principal.account.status !== "active") {
    return {
      ok: false,
      error: "This account is not currently active. Speak to the firm.",
    };
  }

  await db
    .from("eng_customer_users")
    .update({ last_sign_in_at: new Date().toISOString() })
    .eq("id", user.id);

  return { ok: true, principal };
}

async function loadPrincipal(userId: string): Promise<CustomerPrincipal | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const { data: user } = await db
    .from("eng_customer_users")
    .select("id, account_id, email, display_name, account_role, status")
    .eq("id", userId)
    .maybeSingle();
  if (!user) return null;

  const { data: account } = await db
    .from("eng_customer_accounts")
    .select("id, site, client_id, status, billing_mode, credit_limit_cents, net_days")
    .eq("id", user.account_id)
    .maybeSingle();
  if (!account) return null;

  /*
   * An account belonging to another brand is not this brand's customer. The
   * eng_ tables are shared across the family, so without this a customer of
   * sealedengineering could sign into 254 with the same credentials.
   */
  if (account.site !== SITE_KEY) return null;

  return {
    id: user.id as string,
    accountId: account.id as string,
    email: user.email as string,
    displayName: user.display_name as string,
    accountRole: user.account_role as "owner" | "member",
    status: user.status as "invited" | "active" | "suspended",
    account: {
      id: account.id as string,
      site: account.site as string,
      clientId: account.client_id as string,
      status: account.status as "active" | "suspended" | "closed",
      billingMode: account.billing_mode as "card" | "invoice",
      creditLimitCents: account.credit_limit_cents === null ? null : Number(account.credit_limit_cents),
      netDays: Number(account.net_days),
    },
  };
}

/**
 * The signed in customer, loaded fresh from the database on every call.
 *
 * The cookie carries the ids so the proxy can gate a route without a round trip.
 * It is a cache, not the truth: a suspension applied five minutes ago takes
 * effect now, because the row is re-read here and the status is checked here.
 */
export async function currentCustomer(): Promise<CustomerPrincipal | null> {
  const jar = await cookies();
  const claims = readCustomerSession(jar.get(CUSTOMER_COOKIE)?.value);
  if (!claims) return null;

  const principal = await loadPrincipal(claims.sub);
  if (!principal) return null;

  /*
   * The cookie's account must still be the user's account. Re-parenting a user
   * to another organisation would otherwise leave an outstanding cookie able to
   * read the previous one's orders until it expired.
   */
  if (principal.accountId !== claims.account) return null;

  if (principal.status !== "active") return null;
  if (principal.account.status !== "active") return null;

  return principal;
}

export { issueCustomerSession };
