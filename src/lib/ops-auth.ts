import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { supabaseAdmin, supabaseCredentialCheck } from "./supabase";
import { OPS_COOKIE, readOpsSession } from "./ops-session";
import type { Action, Actor, Role } from "./ops-authz";

/**
 * Everything that turns a request into an actor, and an admin's intent into an
 * account.
 *
 * SUPABASE AUTH IS THE PASSWORD STORE AND NOTHING ELSE
 * ----------------------------------------------------
 * Passwords are verified by Supabase and set by Supabase. The platform never
 * hashes a password itself, never stores one, and never emails one. What it does
 * hold is the session, for the reasons in ops-session.ts.
 *
 * NO TEMPORARY PASSWORDS, EVER
 * ----------------------------
 * An admin creating an account does not choose a password and the platform does
 * not generate one. A one time link is issued instead, the person chooses their
 * own password behind it, and the link dies on use. A temporary password in an
 * email is a credential sitting in two mailboxes forever.
 *
 * The token is stored only as a SHA-256, so a database disclosure hands over
 * nothing usable. That is the same reasoning already recorded in
 * src/lib/onboarding-tokens.ts and it is deliberate that the two agree.
 */

const TOKEN_BYTES = 32;
export const SET_PASSWORD_TTL_HOURS = 72;
export const MIN_PASSWORD_LENGTH = 12;

export type ProfileRow = {
  id: string;
  email: string;
  display_name: string;
  phone: string | null;
  role: Role;
  status: "invited" | "active" | "suspended";
  license_number: string | null;
  tdi_appointment: string | null;
  coverage_counties: string[];
  base_city: string | null;
  base_county: string | null;
  certification_status: string | null;
  last_sign_in_at: string | null;
};

// ---------------------------------------------------------------- tokens

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function matchesHash(token: string, storedHash: string): boolean {
  const a = createHash("sha256").update(token, "utf8").digest();
  const b = Buffer.from(storedHash, "hex");
  if (b.length !== a.length) return false;
  return timingSafeEqual(a, b);
}

export function generateToken(hours = SET_PASSWORD_TTL_HOURS) {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
  };
}

// ---------------------------------------------------------------- the actor

/**
 * The signed in person, loaded fresh from the database on every call.
 *
 * The cookie carries a role so the proxy can gate without a query. This does not
 * trust it. A suspended account or a changed role has to take effect on the next
 * request, not when a twelve hour cookie expires, so the profile is read and the
 * profile wins. If the row is gone, so is the session.
 */
export async function currentActor(): Promise<(Actor & ProfileRow) | null> {
  const jar = await cookies();
  const claims = readOpsSession(jar.get(OPS_COOKIE)?.value);
  if (!claims) return null;

  const db = supabaseAdmin();
  if (!db) return null;

  const { data, error } = await db
    .from("eng_profiles")
    .select(
      "id, email, display_name, phone, role, status, license_number, tdi_appointment, coverage_counties, base_city, base_county, certification_status, last_sign_in_at",
    )
    .eq("id", claims.sub)
    .maybeSingle();

  if (error || !data) return null;
  const profile = data as ProfileRow;

  /*
   * The grants, read from eng_role_grants rather than compiled in.
   *
   * One query per request, alongside the profile this was already loading. A
   * FAILED read produces an EMPTY set, which is a closed door: the person can
   * sign in and do nothing, rather than inheriting whatever the last successful
   * read happened to hold. A permissions table that is briefly unreachable must
   * not become a permissions table that is briefly permissive.
   */
  const { data: grantRows, error: grantError } = await db
    .from("eng_role_grants")
    .select("action")
    .eq("role_key", profile.role);

  if (grantError) {
    console.error(`[ops-auth] could not read grants for ${profile.role}: ${grantError.message}`);
  }

  const grants = new Set(
    (grantRows ?? []).map((r) => r.action as Action),
  );

  return {
    ...profile,
    id: profile.id,
    role: profile.role,
    status: profile.status,
    grants,
  };
}

/** For route handlers: the actor, or null, without throwing. */
export async function actorOrNull(): Promise<(Actor & ProfileRow) | null> {
  try {
    return await currentActor();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- sign in

export type SignInResult =
  | { ok: true; profile: ProfileRow }
  | { ok: false; reason: "unconfigured" | "invalid" | "suspended" | "no_profile" };

/**
 * Verify an email and password against Supabase Auth.
 *
 * The Supabase session that comes back is discarded on purpose: the tokens are
 * never written to a cookie, never returned to the browser, and never persisted.
 * All that is wanted from this call is the yes or no, and the user id attached
 * to the yes.
 *
 * WHY THE SAME ANSWER FOR A WRONG PASSWORD AND AN UNKNOWN EMAIL
 * -------------------------------------------------------------
 * Both return "invalid". Distinguishing them turns the sign in form into an
 * account enumerator, which for a firm whose staff are named on a public
 * careers page is a real disclosure rather than a theoretical one.
 *
 * A suspended account is the one case that answers differently, and only after
 * the password has been verified. Telling somebody who typed the right password
 * that they are suspended is useful; telling anybody who typed any password is a
 * different thing entirely.
 */
export async function verifyCredentials(email: string, password: string): Promise<SignInResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, reason: "unconfigured" };

  /*
   * A throwaway client for the password check, never the shared one. See the
   * note on supabaseCredentialCheck: signing in on the shared client turns it
   * into that user for every query afterwards, and under RLS with zero policies
   * that means the very next lookup returns nothing.
   */
  const auth = supabaseCredentialCheck();
  if (!auth) return { ok: false, reason: "unconfigured" };

  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  await auth.auth.signOut().catch(() => {});
  if (error || !data?.user) return { ok: false, reason: "invalid" };

  const { data: profile } = await db
    .from("eng_profiles")
    .select(
      "id, email, display_name, phone, role, status, license_number, tdi_appointment, coverage_counties, base_city, base_county, certification_status, last_sign_in_at",
    )
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) return { ok: false, reason: "no_profile" };
  if ((profile as ProfileRow).status === "suspended") return { ok: false, reason: "suspended" };

  return { ok: true, profile: profile as ProfileRow };
}

// ---------------------------------------------------------------- accounts

export type CreateAccountInput = {
  email: string;
  displayName: string;
  role: Role;
  phone?: string | null;
  licenseNumber?: string | null;
  tdiAppointment?: string | null;
  coverageCounties?: string[];
  baseCity?: string | null;
  baseCounty?: string | null;
};

export type CreateAccountResult =
  | { ok: true; profileId: string; token: string; expiresAt: Date; linked: false }
  /*
   * linked: the address already had credentials on this Supabase project, so no
   * new password is set and no link is issued. See the note on createAccount.
   */
  | { ok: true; profileId: string; token: null; expiresAt: null; linked: true }
  | { ok: false; error: string };

/**
 * Create an auth user and its profile, and mint the one time set password link.
 *
 * Account creation is admin only and there is no self registration anywhere in
 * this platform. A firm with three roles and a handful of people does not need a
 * sign up page, and a sign up page is a way in.
 *
 * The auth user is created with email_confirm true because the admin is the
 * confirmation: they typed the address and they are sending the invite. A
 * separate confirm step would be a second email that proves nothing extra.
 *
 * WHY THE PASSWORD IS RANDOM AND DISCARDED
 * ----------------------------------------
 * Supabase requires a password at creation. A long random one is generated,
 * never stored, never emailed, and never returned. It exists for the seconds
 * between creating the user and the person choosing their own, and nobody
 * including the admin ever knows it.
 *
 * THE AUTH TABLE IS SHARED WITH THE OTHER APPS ON THIS PROJECT
 * ------------------------------------------------------------
 * This Supabase project hosts several unrelated applications, which is why every
 * table in this schema carries the eng_ prefix. auth.users has no prefix and
 * cannot have one: it is one table, shared, and an address that already signs
 * into another app on this project already exists in it.
 *
 * So creating an account has two outcomes, and conflating them would be a
 * security mistake:
 *
 *   NEW address: an auth user is created, a one time link is issued, the person
 *   chooses a password that has never existed before.
 *
 *   EXISTING address: the auth user is left completely alone. A profile is
 *   created against it and the account is active immediately, because that
 *   person already has a working password. NO link is issued and NO password is
 *   touched, because the password is shared with the other application and
 *   resetting it here would silently lock them out of something else.
 *
 * The admin is told which happened, because "check your email for a link" to
 * somebody who will never receive one is the kind of small lie that costs an
 * afternoon.
 */
export async function createAccount(input: CreateAccountInput): Promise<CreateAccountResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return { ok: false, error: "That is not an email address." };

  // Does this address already exist in the shared auth table?
  const existingUserId = await findAuthUserId(db, email);

  if (existingUserId) {
    const { data: clash } = await db
      .from("eng_profiles")
      .select("id")
      .eq("id", existingUserId)
      .maybeSingle();
    if (clash) return { ok: false, error: "That email already has a portal account." };
  }

  let userId = existingUserId;

  if (!userId) {
    const { data: created, error: createError } = await db.auth.admin.createUser({
      email,
      password: randomBytes(24).toString("base64url"),
      email_confirm: true,
    });
    if (createError || !created?.user) {
      return { ok: false, error: createError?.message ?? "The account could not be created." };
    }
    userId = created.user.id;
  }

  const isTech = input.role === "field_tech";
  const isEngineer = input.role === "engineer";

  const { error: profileError } = await db.from("eng_profiles").insert({
    id: userId,
    email,
    display_name: input.displayName.trim(),
    phone: input.phone?.trim() || null,
    role: input.role,
    // An existing auth user already has a working password, so there is nothing
    // to invite them to do. A brand new one is invited until they set theirs.
    status: existingUserId ? "active" : "invited",
    license_number: isEngineer ? input.licenseNumber?.trim() || null : null,
    tdi_appointment: isEngineer ? input.tdiAppointment || "none" : null,
    coverage_counties: isTech ? (input.coverageCounties ?? []) : [],
    base_city: isTech ? input.baseCity?.trim() || null : null,
    base_county: isTech ? input.baseCounty?.trim() || null : null,
    certification_status: isTech ? "none" : null,
  });

  if (profileError) {
    /*
     * The auth user exists and the profile does not, which would be an account
     * that can authenticate here and has no role. Undo it.
     *
     * Only if WE created it. Deleting a pre-existing auth user because this
     * app's insert failed would take somebody's access to a different
     * application away, which is a far worse outcome than a failed create.
     */
    if (!existingUserId && userId) await db.auth.admin.deleteUser(userId).catch(() => {});
    return { ok: false, error: profileError.message };
  }

  if (existingUserId) {
    return { ok: true, profileId: userId!, token: null, expiresAt: null, linked: true };
  }

  const issued = await issueSetPasswordToken(userId!, "set_password");
  if (!issued) return { ok: false, error: "The account was created but the invite link could not be issued." };

  return { ok: true, profileId: userId!, token: issued.token, expiresAt: issued.expiresAt, linked: false };
}

/**
 * Find an auth user id by email, paging the admin list.
 *
 * The admin API has no "get by email", so this pages. The project holds a
 * handful of users across every application on it, so the loop is bounded in
 * practice and capped here regardless rather than being able to run away.
 */
async function findAuthUserId(
  db: ReturnType<typeof supabaseAdmin> & object,
  email: string,
): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) return null;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

/** Mint (or re-mint) a one time link. Any outstanding link for that purpose dies. */
export async function issueSetPasswordToken(
  profileId: string,
  purpose: "set_password" | "reset_password",
  createdBy?: string,
): Promise<{ token: string; expiresAt: Date } | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  // One live link at a time. A resend must not leave the previous link working.
  await db.from("eng_auth_tokens").delete().eq("profile_id", profileId).eq("purpose", purpose).is("used_at", null);

  const { token, tokenHash, expiresAt } = generateToken();
  const { error } = await db.from("eng_auth_tokens").insert({
    profile_id: profileId,
    purpose,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
    created_by: createdBy ?? null,
  });
  if (error) return null;
  return { token, expiresAt };
}

export type ConsumeTokenResult =
  | { ok: true; profile: ProfileRow }
  | { ok: false; reason: "invalid" | "expired" | "used" };

/** Look a token up without spending it, so the set password page can render. */
export async function inspectToken(token: string): Promise<ConsumeTokenResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, reason: "invalid" };

  const { data } = await db
    .from("eng_auth_tokens")
    .select("id, profile_id, expires_at, used_at, token_hash")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!data) return { ok: false, reason: "invalid" };
  if (data.used_at) return { ok: false, reason: "used" };
  if (new Date(data.expires_at).getTime() <= Date.now()) return { ok: false, reason: "expired" };

  const { data: profile } = await db
    .from("eng_profiles")
    .select(
      "id, email, display_name, phone, role, status, license_number, tdi_appointment, coverage_counties, base_city, base_county, certification_status, last_sign_in_at",
    )
    .eq("id", data.profile_id)
    .maybeSingle();

  if (!profile) return { ok: false, reason: "invalid" };
  return { ok: true, profile: profile as ProfileRow };
}

/**
 * Spend the token and set the password.
 *
 * The token is marked used before the password is changed, and that order is
 * deliberate: if the update fails, the link is already dead and the person asks
 * for another one. The other order leaves a live link after a partial failure.
 */
export async function consumeTokenAndSetPassword(
  token: string,
  password: string,
): Promise<{ ok: true; profile: ProfileRow } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Choose at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const inspected = await inspectToken(token);
  if (!inspected.ok) {
    return {
      ok: false,
      error:
        inspected.reason === "expired"
          ? "That link has expired. Ask an administrator for a new one."
          : inspected.reason === "used"
            ? "That link has already been used."
            : "That link is not valid.",
    };
  }

  const { error: spendError } = await db
    .from("eng_auth_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", hashToken(token))
    .is("used_at", null);
  if (spendError) return { ok: false, error: "That link could not be used. Ask for a new one." };

  const { error: pwError } = await db.auth.admin.updateUserById(inspected.profile.id, { password });
  if (pwError) return { ok: false, error: "The password could not be set. Ask for a new link." };

  await db
    .from("eng_profiles")
    .update({ status: inspected.profile.status === "invited" ? "active" : inspected.profile.status })
    .eq("id", inspected.profile.id);

  return { ok: true, profile: { ...inspected.profile, status: "active" } };
}

/** A person changing their own password, already signed in. */
export async function changeOwnPassword(
  actorId: string,
  currentPassword: string,
  nextPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (nextPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Choose at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const { data: profile } = await db.from("eng_profiles").select("email").eq("id", actorId).maybeSingle();
  if (!profile) return { ok: false, error: "That account no longer exists." };

  // The current password is required, so a borrowed session cannot lock the
  // owner out of their own account. Throwaway client, for the reason above.
  const auth = supabaseCredentialCheck();
  if (!auth) return { ok: false, error: "The database is not configured." };
  const check = await auth.auth.signInWithPassword({ email: profile.email, password: currentPassword });
  await auth.auth.signOut().catch(() => {});
  if (check.error) return { ok: false, error: "That is not your current password." };

  const { error } = await db.auth.admin.updateUserById(actorId, { password: nextPassword });
  if (error) return { ok: false, error: "The password could not be changed." };
  return { ok: true };
}

/** The requester's IP and agent, for the audit trail. */
export async function requestContext(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return {
    ip: forwarded ? forwarded.split(",")[0]!.trim() : null,
    userAgent: h.get("user-agent"),
  };
}
