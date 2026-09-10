import "server-only";
import { DB_NOW } from "./db-now";
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { base32Decode, newTotpSecret, otpauthUri, verifyTotp } from "./totp";
import { business } from "@/config/business";

/**
 * The second factor: what is stored, how it is read back, and what refuses.
 *
 * The design and both operator rulings are in docs/mfa-design.md. What is
 * argued here is only what the CODE decides.
 *
 * WHY THE SECRET IS ENCRYPTED AND THE RECOVERY CODES ARE HASHED
 * -------------------------------------------------------------
 * They are different kinds of secret. A TOTP secret has to be READ to check a
 * code, so it can only be encrypted, reversibly, with a key that lives outside
 * the database. A recovery code is only ever compared, so it is hashed like a
 * password and nothing can recover it, which is strictly stronger.
 *
 * The encryption is not a defence against a live service role key: anybody
 * holding one can already create an administrator. It defends the case that
 * actually happens, which is a database copy separated from the environment
 * that produced it. A backup, an export, a snapshot handed to somebody for
 * debugging. The key is in Vercel and the rows are in Postgres, so a copy of
 * one without the other is inert.
 *
 * IT FAILS CLOSED AND LOUDLY
 * --------------------------
 * A missing or changed MFA_ENCRYPTION_KEY means no code can be verified.
 * `mfaStatus()` says exactly that, in the same shape `opsSessionStatus()`
 * already uses, so the sign in screen can say it plainly rather than rejecting
 * correct codes as though they were wrong. Rotating that key un-enrols
 * everybody, which is a real operation with a real consequence, written down
 * here and in the design rather than discovered.
 */

const MIN_KEY_LENGTH = 24;

/** Ten codes, which is the number a person can write on one line of a card. */
export const RECOVERY_CODE_COUNT = 10;

/** How long a started enrolment stays offerable before it has to be restarted. */
export const ENROLMENT_WINDOW_MINUTES = 15;

// --------------------------------------------------------------- the key

/**
 * The encryption key, derived from the environment value rather than used raw.
 *
 * Same reasoning as the session signing key: the value that encrypts is not the
 * value somebody pasted into Vercel, so the two cannot be confused and a short
 * human chosen string still yields 32 bytes.
 */
function encryptionKey(): Buffer | null {
  const secret = process.env.MFA_ENCRYPTION_KEY;
  if (typeof secret !== "string" || secret.trim().length < MIN_KEY_LENGTH) return null;
  return createHash("sha256").update(`eng-mfa-v1:${secret}`).digest();
}

/** Whether a second factor can be used at all. */
export function mfaConfigured(): boolean {
  return encryptionKey() !== null;
}

/**
 * What is wrong, in a sentence, for the status surface and the sign in screen.
 *
 * A person whose correct code is refused because an environment variable is
 * missing must not be told their code is wrong. That is the difference between
 * an outage somebody can fix and an outage that looks like a broken phone.
 */
export function mfaStatus(): string {
  const secret = process.env.MFA_ENCRYPTION_KEY;
  if (!secret) {
    return "MFA_ENCRYPTION_KEY is not set. No second factor can be enrolled or verified until it is.";
  }
  if (secret.trim().length < MIN_KEY_LENGTH) {
    return `MFA_ENCRYPTION_KEY is set but shorter than ${MIN_KEY_LENGTH} characters. It is rejected as too weak.`;
  }
  return "MFA_ENCRYPTION_KEY is configured.";
}

// -------------------------------------------------------- encrypt, decrypt

/**
 * AES-256-GCM, stored as iv.tag.ciphertext in base64.
 *
 * GCM rather than CBC because it authenticates: a ciphertext altered in the
 * database fails to decrypt rather than decrypting to different bytes. A
 * silently different secret would produce codes that never match and no
 * explanation anywhere.
 */
export function encryptSecret(plain: string): string | null {
  const key = encryptionKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${enc.toString("base64")}`;
}

/** Null for a missing key, a malformed value, or a failed tag. Never throws. */
export function decryptSecret(stored: string | null): string | null {
  const key = encryptionKey();
  if (!key || !stored) return null;
  const parts = stored.split(".");
  if (parts.length !== 3) return null;
  try {
    const [ivB64, tagB64, dataB64] = parts;
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    /* A wrong key, a tampered row, or a truncated value all land here, and all
     * of them mean the same thing to a caller: this secret is unusable. */
    return null;
  }
}

// ------------------------------------------------------- recovery codes

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };

/** Human transcribable: no vowels, so no code can spell anything. */
const CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ23456789";

/** `XXXXX-XXXXX`, which is short enough to read aloud and long enough to be one. */
export function newRecoveryCode(): string {
  const pick = () =>
    Array.from(randomBytes(5))
      .map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
      .join("");
  return `${pick()}-${pick()}`;
}

/** Normalised before hashing, so case and stray spaces do not decide a lockout. */
export function normaliseRecoveryCode(code: string): string {
  return code.replace(/[\s]/g, "").toUpperCase();
}

export function hashRecoveryCode(code: string, salt: string): string {
  return scryptSync(normaliseRecoveryCode(code), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT.maxmem,
  }).toString("base64");
}

/**
 * The salt is the user id, so a code cannot be moved between accounts.
 *
 * A shared or absent salt would mean the same code hashes identically for two
 * people, and a stolen hash from one account would be a working code on
 * another. It is not secret and does not need to be; it needs to be different
 * per account, and the id already is.
 */
export function recoveryCodeHash(userId: string, code: string): string {
  return hashRecoveryCode(code, `eng-mfa-recovery:${userId}`);
}

/** Constant time, and false for anything missing rather than a throw. */
export function recoveryCodeMatches(userId: string, code: string, storedHash: string | null): boolean {
  if (!storedHash) return false;
  const computed = Buffer.from(recoveryCodeHash(userId, code));
  const stored = Buffer.from(storedHash);
  if (computed.length !== stored.length) return false;
  return timingSafeEqual(computed, stored);
}

// ----------------------------------------------------------- the row state

export type MfaState = {
  /** A verified, usable second factor. */
  enrolled: boolean;
  /** An enrolment that has been started and not confirmed. */
  pendingEnrolment: boolean;
  lastUsedAt: string | null;
  /** How many recovery codes remain unspent. */
  recoveryRemaining: number;
};

export async function mfaStateFor(userId: string): Promise<MfaState> {
  const db = supabaseAdmin();
  const empty: MfaState = { enrolled: false, pendingEnrolment: false, lastUsedAt: null, recoveryRemaining: 0 };
  if (!db) return empty;

  const { data, error } = await db
    .from("eng_mfa_enrolments")
    .select("secret_cipher, verified_at, pending_cipher, pending_started_at, last_used_at")
    .eq("user_id", userId)
    .maybeSingle();

  /*
   * A failed read is NOT "not enrolled". Reporting no second factor because the
   * database was briefly unreachable would let somebody past the requirement
   * for the duration of an outage, which is the permissive direction and the
   * exact shape queue-watch was corrected for on the same day.
   */
  if (error) throw new Error(`the second factor state could not be read: ${error.message}`);
  if (!data) return empty;

  const { count } = await db
    .from("eng_mfa_recovery_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("used_at", null);

  return {
    enrolled: Boolean(data.secret_cipher && data.verified_at),
    pendingEnrolment: Boolean(data.pending_cipher),
    lastUsedAt: (data.last_used_at as string | null) ?? null,
    recoveryRemaining: count ?? 0,
  };
}

/** What a role demands. Unknown roles are treated as optional, never as off. */
export async function mfaRequirementFor(roleKey: string): Promise<"required" | "optional" | "off"> {
  const db = supabaseAdmin();
  if (!db) return "optional";
  const { data, error } = await db
    .from("eng_roles")
    .select("mfa_requirement")
    .eq("key", roleKey)
    .maybeSingle();
  if (error || !data) return "optional";
  const value = data.mfa_requirement as string;
  return value === "required" || value === "off" ? value : "optional";
}

// ------------------------------------------------------------- enrolment

/**
 * Start an enrolment. The secret goes in PENDING and nowhere near active.
 *
 * The ordering is the whole safety property and the obvious ordering is wrong.
 * Storing the secret as active and then asking for confirmation locks out
 * anybody who scans nothing, or scans it into an app on a phone they then lose.
 * Here the active secret is untouched until a code proves the new one works, so
 * beginning an enrolment is never a destructive act, and somebody replacing a
 * phone keeps the factor that currently works until the new one is proven.
 */
export async function beginEnrolment(
  userId: string,
  email: string,
): Promise<{ ok: true; secret: string; uri: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!mfaConfigured()) return { ok: false, error: mfaStatus() };

  const { base32 } = newTotpSecret();
  const cipher = encryptSecret(base32);
  if (!cipher) return { ok: false, error: mfaStatus() };

  const { error } = await db.from("eng_mfa_enrolments").upsert(
    {
      user_id: userId,
      pending_cipher: cipher,
      pending_started_at: DB_NOW,
      updated_at: DB_NOW,
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, error: `The enrolment could not be started: ${error.message}` };

  return { ok: true, secret: base32, uri: otpauthUri(base32, email, business.name) };
}

/**
 * Confirm it with a code, and only then does it become the active secret.
 *
 * The recovery codes are generated in the same call that confirms, because an
 * enrolment completing without them is the state that turns a lost phone into a
 * lost account. They are returned once and never again.
 */
export async function confirmEnrolment(
  userId: string,
  code: string,
): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const { data, error } = await db
    .from("eng_mfa_enrolments")
    .select("pending_cipher, pending_started_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { ok: false, error: `The enrolment could not be read: ${error.message}` };
  if (!data?.pending_cipher) return { ok: false, error: "There is no enrolment in progress. Start again." };

  const started = data.pending_started_at ? Date.parse(data.pending_started_at as string) : 0;
  if (!started || Date.now() - started > ENROLMENT_WINDOW_MINUTES * 60_000) {
    return { ok: false, error: "That enrolment has expired. Start again to get a fresh code." };
  }

  const base32 = decryptSecret(data.pending_cipher as string);
  if (!base32) return { ok: false, error: mfaStatus() };
  const bytes = base32Decode(base32);
  if (!bytes) return { ok: false, error: "The stored secret could not be read. Start the enrolment again." };

  const check = verifyTotp(bytes, code);
  if (!check.ok || check.step === null) {
    return { ok: false, error: "That code is not right. Check your authenticator app and try again." };
  }

  /*
   * The codes are minted before the enrolment is activated, so a failure to
   * write them leaves the person un-enrolled rather than enrolled with none.
   */
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => newRecoveryCode());

  await db.from("eng_mfa_recovery_codes").delete().eq("user_id", userId);
  const { error: codeError } = await db.from("eng_mfa_recovery_codes").insert(
    codes.map((c) => ({ user_id: userId, code_hash: recoveryCodeHash(userId, c) })),
  );
  if (codeError) return { ok: false, error: `The recovery codes could not be stored: ${codeError.message}` };

  const { error: activateError } = await db
    .from("eng_mfa_enrolments")
    .update({
      secret_cipher: data.pending_cipher,
      verified_at: DB_NOW,
      pending_cipher: null,
      pending_started_at: null,
      last_step: check.step,
      last_used_at: DB_NOW,
    })
    .eq("user_id", userId);
  if (activateError) return { ok: false, error: `The enrolment could not be completed: ${activateError.message}` };

  return { ok: true, recoveryCodes: codes };
}

// ---------------------------------------------------------- the challenge

export type ChallengeResult =
  | { ok: true; used: "code" }
  | { ok: true; used: "recovery"; remaining: number }
  | { ok: false; error: string };

/**
 * Check a code or a recovery code at sign in.
 *
 * THE REPLAY GUARD IS THE PART THAT IS EASY TO LEAVE OUT
 * ------------------------------------------------------
 * A TOTP code is valid for a window, so the same six digits work more than once
 * inside it: somebody who reads a code over a shoulder or off a screen share
 * can use it again while it is still live. `last_step` records the highest step
 * accepted for this person and a code at or below it is refused.
 */
export async function answerChallenge(userId: string, answer: string): Promise<ChallengeResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const { data, error } = await db
    .from("eng_mfa_enrolments")
    .select("secret_cipher, verified_at, last_step")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { ok: false, error: `The second factor could not be read: ${error.message}` };
  if (!data?.secret_cipher || !data.verified_at) {
    return { ok: false, error: "There is no second factor on this account." };
  }

  const cleaned = answer.trim();

  /* A recovery code carries the separator; a TOTP code is six digits. */
  if (cleaned.includes("-") || /[A-Za-z]/.test(cleaned)) {
    return await spendRecoveryCode(userId, cleaned);
  }

  const base32 = decryptSecret(data.secret_cipher as string);
  if (!base32) return { ok: false, error: mfaStatus() };
  const bytes = base32Decode(base32);
  if (!bytes) return { ok: false, error: "The stored secret could not be read." };

  const check = verifyTotp(bytes, cleaned);
  if (!check.ok || check.step === null) {
    return { ok: false, error: "That code is not right." };
  }

  const lastStep = (data.last_step as number | null) ?? null;
  if (lastStep !== null && check.step <= lastStep) {
    return { ok: false, error: "That code has already been used. Wait for your app to show the next one." };
  }

  await db
    .from("eng_mfa_enrolments")
    .update({ last_step: check.step, last_used_at: DB_NOW })
    .eq("user_id", userId);

  return { ok: true, used: "code" };
}

/**
 * Spend a recovery code. Marked rather than deleted, so the audit trail can
 * name the one that was used and when.
 */
async function spendRecoveryCode(userId: string, code: string): Promise<ChallengeResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const hash = recoveryCodeHash(userId, code);
  const { data, error } = await db
    .from("eng_mfa_recovery_codes")
    .select("id")
    .eq("user_id", userId)
    .eq("code_hash", hash)
    .is("used_at", null)
    .maybeSingle();

  if (error) return { ok: false, error: `The recovery codes could not be read: ${error.message}` };
  if (!data) return { ok: false, error: "That is not a recovery code we are holding, or it has been used." };

  /*
   * Marked with a guard on used_at, so two requests racing the same code cannot
   * both spend it. The update reports how many rows it changed, and zero means
   * somebody else got there first.
   */
  const { data: claimed, error: claimError } = await db
    .from("eng_mfa_recovery_codes")
    .update({ used_at: DB_NOW })
    .eq("id", data.id)
    .is("used_at", null)
    .select("id");

  if (claimError) return { ok: false, error: `That code could not be spent: ${claimError.message}` };
  if (!claimed || claimed.length === 0) return { ok: false, error: "That recovery code has already been used." };

  const { count } = await db
    .from("eng_mfa_recovery_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("used_at", null);

  await db
    .from("eng_mfa_enrolments")
    .update({ last_used_at: DB_NOW })
    .eq("user_id", userId);

  return { ok: true, used: "recovery", remaining: count ?? 0 };
}

/** Remove a second factor entirely. The caller writes the audit row. */
export async function clearEnrolment(userId: string): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  await db.from("eng_mfa_recovery_codes").delete().eq("user_id", userId);
  const { error } = await db.from("eng_mfa_enrolments").delete().eq("user_id", userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
