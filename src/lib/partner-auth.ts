import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import {
  PARTNER_COOKIE,
  issuePartnerSession,
  readPartnerSession,
  partnerSessionConfigured,
} from "./partner-session";

/**
 * Partner credentials. The third credential store, and deliberately a third.
 *
 * WHY NOT SUPABASE AUTH, AND WHY NOT eng_customer_users
 * -----------------------------------------------------
 * The same reasoning `customer-auth.ts` records, one step further out. Staff
 * live in Supabase Auth. Customers live in eng_customer_users with their
 * passwords hashed here. A partner is neither, and the strongest form of that
 * boundary is that a partner has no row in either table, so no query in the
 * staff code and no query in the customer code can return one by accident.
 *
 * A partner is the principal with the least reason to be trusted with the
 * firm's data and the most commercial reason to want it: they are paid on what
 * the firm delivers, and they are not the firm.
 *
 * SCRYPT, THE SAME PARAMETERS, DELIBERATELY DUPLICATED
 * ----------------------------------------------------
 * The hashing is the same shape as the customer's and is written out again
 * rather than imported from it. Importing would mean one module owning the
 * credential handling for two kinds of principal, and the first change made for
 * one of them would silently apply to the other. The parameters are named
 * constants in both places, and if they diverge that is a visible difference in
 * two files rather than an invisible one in a shared default.
 *
 * A KNOWN LIMIT, WRITTEN DOWN RATHER THAN DISCOVERED
 * --------------------------------------------------
 * eng_customer_accounts carries `site` and a customer of a sibling brand
 * therefore cannot sign into this one. eng_partners has no such column, because
 * this firm is the only one of the three running a partner program. If a
 * sibling brand ever runs one out of the same database, this file needs the
 * same scoping the customer loader has, and BACKLOG carries the entry.
 */

/** Cost parameters, named so a change is deliberate. */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };

export const MIN_PARTNER_PASSWORD_LENGTH = 12;

export type PartnerPrincipal = {
  id: string;
  partnerId: string;
  email: string;
  displayName: string;
  status: "invited" | "active" | "suspended";
  partner: {
    id: string;
    organisation: string;
    code: string;
    status: "active" | "suspended" | "ended";
    payoutMethod: string | null;
    payoutReference: string | null;
    agreementVersion: string | null;
    agreementAcceptedAt: string | null;
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

export function newPartnerPasswordRecord(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("base64");
  return { hash: hashPassword(password, salt), salt };
}

/**
 * Constant time, and false for a missing hash before it compares anything.
 *
 * A partner user who was invited and never set a password has a null hash. The
 * naive version compares against an empty string, which a short enough password
 * can match.
 */
export function partnerPasswordMatches(
  password: string,
  hash: string | null,
  salt: string | null,
): boolean {
  if (!hash || !salt) return false;
  const computed = Buffer.from(hashPassword(password, salt));
  const stored = Buffer.from(hash);
  if (computed.length !== stored.length) return false;
  return timingSafeEqual(computed, stored);
}

// ------------------------------------------------------------------- tokens

const TOKEN_BYTES = 32;
export const PARTNER_TOKEN_TTL_HOURS = 72;

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Mint a one time link, killing any outstanding one for that purpose.
 *
 * The token is returned once and stored only as a hash, so the platform cannot
 * show somebody a link again later and nobody with database access can use one.
 */
export async function issuePartnerToken(
  partnerUserId: string,
  purpose: "set_password" | "reset_password",
  issuedBy?: string | null,
): Promise<{ token: string; expiresAt: Date } | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  await db
    .from("eng_partner_tokens")
    .delete()
    .eq("user_id", partnerUserId)
    .eq("purpose", purpose)
    .is("used_at", null);

  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + PARTNER_TOKEN_TTL_HOURS * 60 * 60 * 1000);

  const { error } = await db.from("eng_partner_tokens").insert({
    user_id: partnerUserId,
    purpose,
    token_hash: hashToken(token),
    expires_at: expiresAt.toISOString(),
    issued_by: issuedBy ?? null,
  });
  if (error) return null;
  return { token, expiresAt };
}

export type PartnerTokenResult =
  | { ok: true; userId: string; email: string; displayName: string; organisation: string }
  | { ok: false; reason: "invalid" | "expired" | "used" };

/** Look at a token without spending it, so a link survives being opened twice. */
export async function inspectPartnerToken(token: string): Promise<PartnerTokenResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, reason: "invalid" };

  const { data } = await db
    .from("eng_partner_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!data) return { ok: false, reason: "invalid" };
  if (data.used_at) return { ok: false, reason: "used" };
  if (new Date(data.expires_at as string).getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const { data: user } = await db
    .from("eng_partner_users")
    .select("id, email, display_name, partner_id")
    .eq("id", data.user_id)
    .maybeSingle();
  if (!user) return { ok: false, reason: "invalid" };

  const { data: partner } = await db
    .from("eng_partners")
    .select("organisation")
    .eq("id", user.partner_id)
    .maybeSingle();

  return {
    ok: true,
    userId: user.id as string,
    email: user.email as string,
    displayName: user.display_name as string,
    organisation: (partner?.organisation as string | undefined) ?? "",
  };
}

/** Spend a token and set the password. The token is spent even on a weak one. */
export async function setPartnerPassword(
  token: string,
  password: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The partner system is not configured." };

  if (password.length < MIN_PARTNER_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Use at least ${MIN_PARTNER_PASSWORD_LENGTH} characters. The link still works.`,
    };
  }

  const inspected = await inspectPartnerToken(token);
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

  const { hash, salt } = newPartnerPasswordRecord(password);

  /*
   * Spent FIRST, conditionally on it still being unspent, so two requests
   * racing on the same link cannot both set a password. The loser is told the
   * link was used.
   */
  const { data: spent } = await db
    .from("eng_partner_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", hashToken(token))
    .is("used_at", null)
    .select("id");

  if (!spent || spent.length === 0) {
    return { ok: false, error: "That link has already been used." };
  }

  const { error } = await db
    .from("eng_partner_users")
    .update({ password_hash: hash, password_salt: salt, status: "active" })
    .eq("id", inspected.userId);

  if (error) return { ok: false, error: "The password could not be set." };
  return { ok: true, userId: inspected.userId };
}

// ------------------------------------------------------------------ sign in

const GENERIC_REFUSAL = "That email address and password do not match an account.";

export async function signInPartner(
  email: string,
  password: string,
): Promise<{ ok: true; principal: PartnerPrincipal } | { ok: false; error: string }> {
  if (!partnerSessionConfigured()) {
    return { ok: false, error: "The partner programme is not available on this deployment." };
  }

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The partner system is not configured." };

  /*
   * The same pair, the same lockout, and one more reason on this table.
   *
   * eng_partner_users.email is `text not null unique`, which is CASE SENSITIVE,
   * while every lookup against it is case insensitive. Two rows differing only
   * in case are therefore permitted by the schema and both match this query.
   * 0037 closes that with a unique index on lower(email), the same shape
   * eng_customer_users has carried since 0009; until it is applied the ordering
   * below is what decides.
   *
   * Oldest first, and the error is read rather than becoming a wrong password.
   */
  const { data: userRows, error: userErr } = await db
    .from("eng_partner_users")
    .select("id, partner_id, email, display_name, status, password_hash, password_salt")
    .ilike("email", email.trim())
    .order("created_at", { ascending: true })
    .limit(1);

  if (userErr) {
    console.error(`[partner-auth] could not read the partner user for a sign in attempt: ${userErr.message}`);
    return { ok: false, error: "That could not be checked just now. Try again shortly." };
  }
  const user = (userRows ?? [])[0] ?? null;

  /*
   * One refusal for every failure, and the hash is still computed when there is
   * no such user so a missing address does not answer measurably faster than a
   * wrong password. A partner list is commercially interesting to a competitor
   * in a way a staff list is not, because it names who is selling for this firm.
   */
  if (!user) {
    partnerPasswordMatches(password, null, null);
    hashPassword(password, "absent-partner-timing-salt");
    return { ok: false, error: GENERIC_REFUSAL };
  }

  if (
    !partnerPasswordMatches(
      password,
      user.password_hash as string | null,
      user.password_salt as string | null,
    )
  ) {
    return { ok: false, error: GENERIC_REFUSAL };
  }

  if (user.status !== "active") return { ok: false, error: GENERIC_REFUSAL };

  const principal = await loadPartnerPrincipal(user.id as string);
  if (!principal) return { ok: false, error: GENERIC_REFUSAL };

  /*
   * THE PARTNER'S OWN STATE, NOT ONLY THE PERSON'S.
   *
   * Suspending a partner is how the firm ends a relationship that has gone
   * wrong, and it has to close the door for every person who signs in on their
   * behalf. It is also what stops their code earning: `partnerByCode` refuses a
   * partner that is not active, so the two halves of a suspension agree.
   */
  if (principal.partner.status !== "active") {
    return {
      ok: false,
      error: "This partner account is not currently active. Speak to the firm.",
    };
  }

  await db
    .from("eng_partner_users")
    .update({ last_sign_in_at: new Date().toISOString() })
    .eq("id", user.id);

  return { ok: true, principal };
}

async function loadPartnerPrincipal(userId: string): Promise<PartnerPrincipal | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const { data: user } = await db
    .from("eng_partner_users")
    .select("id, partner_id, email, display_name, status")
    .eq("id", userId)
    .maybeSingle();
  if (!user) return null;

  const { data: partner } = await db
    .from("eng_partners")
    .select(
      "id, organisation, code, status, payout_method, payout_reference, agreement_version, agreement_accepted_at",
    )
    .eq("id", user.partner_id)
    .maybeSingle();
  if (!partner) return null;

  return {
    id: user.id as string,
    partnerId: partner.id as string,
    email: user.email as string,
    displayName: user.display_name as string,
    status: user.status as "invited" | "active" | "suspended",
    partner: {
      id: partner.id as string,
      organisation: partner.organisation as string,
      code: partner.code as string,
      status: partner.status as "active" | "suspended" | "ended",
      payoutMethod: (partner.payout_method as string | null) ?? null,
      payoutReference: (partner.payout_reference as string | null) ?? null,
      agreementVersion: (partner.agreement_version as string | null) ?? null,
      agreementAcceptedAt: (partner.agreement_accepted_at as string | null) ?? null,
    },
  };
}

/**
 * The signed in partner, loaded fresh from the database on every call.
 *
 * The cookie carries the ids so the proxy can gate a route without a round
 * trip. It is a cache and not the truth: a suspension applied five minutes ago
 * takes effect now, because the rows are re-read here and both statuses are
 * checked here.
 */
export async function currentPartner(): Promise<PartnerPrincipal | null> {
  const jar = await cookies();
  const claims = readPartnerSession(jar.get(PARTNER_COOKIE)?.value);
  if (!claims) return null;

  const principal = await loadPartnerPrincipal(claims.sub);
  if (!principal) return null;

  /*
   * The cookie's partner must still be the user's partner. Moving a person to
   * another partner organisation would otherwise leave an outstanding cookie
   * able to read the previous one's earnings until it expired, and earnings are
   * the commercially sensitive thing here.
   */
  if (principal.partnerId !== claims.partner) return null;

  if (principal.status !== "active") return null;
  if (principal.partner.status !== "active") return null;

  return principal;
}

export { issuePartnerSession };
