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
 * IS THE KEY THE ONE THIS CIPHERTEXT WAS ENCRYPTED UNDER?
 *
 * Phase 13, after the production lockout of 2026-09-13. The question mfaStatus
 * cannot answer, and the reason four hours went into a wrong diagnosis.
 *
 * mfaStatus checks that MFA_ENCRYPTION_KEY is PRESENT and at least 24
 * characters. Both were true. The value had been REPLACED with a different,
 * valid value during Vercel work the day before, so every stored secret became
 * undecryptable while the status sentence went on saying configured.
 *
 * WHY THIS NEEDS NO CANARY COLUMN AND NO MIGRATION. The ciphertext already IS
 * the canary. A stored secret that is well formed, with a key that is present
 * and long enough, that still will not decrypt, can only mean the key is not
 * the one it was encrypted under. Adding a column to store a second encrypted
 * value would be a second copy of a fact the first copy already carries.
 *
 * IT IS DELIBERATELY NARROW. It answers only for a row that HAS a secret. It
 * says nothing about whether a code is right, and it must not: a wrong code
 * with a good key has to keep reading as a wrong code, or this becomes the
 * next misleading sentence.
 */
export type KeyFault = "missing" | "too_short" | "changed" | null;

export function keyFaultFor(secretCipher: string | null): KeyFault {
  const secret = process.env.MFA_ENCRYPTION_KEY;
  if (typeof secret !== "string" || secret.trim().length === 0) return "missing";
  if (secret.trim().length < MIN_KEY_LENGTH) return "too_short";

  /* No stored secret is not a key fault. It is an account with no enrolment. */
  if (!secretCipher) return null;

  /*
   * A cipher that is not three parts is a corrupted or truncated ROW, which is
   * a different fault from a changed key and must not be reported as one.
   * decryptSecret folds them together because to IT they mean the same thing;
   * here they do not.
   */
  if (secretCipher.split(".").length !== 3) return null;

  return decryptSecret(secretCipher) === null ? "changed" : null;
}

/**
 * The sentence a person gets when the key is the problem.
 *
 * A PERSON WHOSE CORRECT CODE IS REFUSED MUST NOT BE TOLD THEIR CODE IS WRONG.
 * That rule was already written above mfaStatus and it was not enough, because
 * the sentence it produced for a replaced key was configured.
 */
export function keyFaultSentence(fault: Exclude<KeyFault, null>): string {
  if (fault === "missing") {
    return "MFA_ENCRYPTION_KEY is not set on this deployment, so no code can be verified. This is a deployment fault rather than a problem with your code or your phone.";
  }
  if (fault === "too_short") {
    return `MFA_ENCRYPTION_KEY is set but shorter than ${MIN_KEY_LENGTH} characters, so it is rejected and no code can be verified. This is a deployment fault rather than a problem with your code or your phone.`;
  }
  return (
    "THE SECOND FACTOR KEY ON THIS DEPLOYMENT IS NOT THE ONE THIS ACCOUNT ENROLLED UNDER. " +
    "MFA_ENCRYPTION_KEY has been replaced with a different value, which makes the stored secret " +
    "unreadable and makes every correct code look wrong. Your phone is fine and your code is fine. " +
    "Restore the previous value, or clear the enrolment and enrol again."
  );
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

  /**
   * When this account was last handed a set of recovery codes, and when
   * somebody said they had saved them. Null on every enrolment made before
   * 2026-09-13, because the platform did not record it.
   *
   * ISSUED WITH NO ACKNOWLEDGEMENT is the state worth reading: an account
   * holding ten codes nobody wrote down, which looks exactly like an account
   * with a recovery path until the day somebody needs one.
   */
  recoveryCodesIssuedAt: string | null;
  recoveryCodesAcknowledgedAt: string | null;
};

export async function mfaStateFor(userId: string): Promise<MfaState> {
  const db = supabaseAdmin();
  const empty: MfaState = {
    enrolled: false,
    pendingEnrolment: false,
    lastUsedAt: null,
    recoveryRemaining: 0,
    recoveryCodesIssuedAt: null,
    recoveryCodesAcknowledgedAt: null,
  };
  if (!db) return empty;

  const { data, error } = await db
    .from("eng_mfa_enrolments")
    .select(
      "secret_cipher, verified_at, pending_cipher, pending_started_at, last_used_at, recovery_codes_issued_at, recovery_codes_acknowledged_at",
    )
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
    recoveryCodesIssuedAt: (data.recovery_codes_issued_at as string | null) ?? null,
    recoveryCodesAcknowledgedAt: (data.recovery_codes_acknowledged_at as string | null) ?? null,
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

  /*
   * THE SAME FAULT, ONE DOOR EARLIER.
   *
   * This line had the defect that locked the operator out, and it is worth
   * fixing even though the window is ten minutes wide: a pending cipher is
   * written under one key and read back under whatever the deployment holds
   * when the person types their first code. A redeploy carrying a new key in
   * between is exactly what happened on 2026-09-12, and the person enrolling
   * would have been told the key "is configured" while their brand new secret
   * was unreadable.
   */
  const keyFault = keyFaultFor(data.pending_cipher as string);
  if (keyFault) return { ok: false, error: keyFaultSentence(keyFault) };

  const base32 = decryptSecret(data.pending_cipher as string);
  if (!base32) {
    return {
      ok: false,
      error: "The pending enrolment on this account is corrupted and cannot be read. Start the enrolment again.",
    };
  }
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

      /*
       * THE ISSUE TIME, AND THE ACKNOWLEDGEMENT CLEARED WITH IT.
       *
       * A reissue hands out a new set, so an acknowledgement of the OLD set
       * must not carry over. Leaving it would say somebody had saved codes
       * that no longer exist, which is worse than saying nothing.
       */
      recovery_codes_issued_at: DB_NOW,
      recovery_codes_acknowledged_at: null,
    })
    .eq("user_id", userId);
  if (activateError) return { ok: false, error: `The enrolment could not be completed: ${activateError.message}` };

  return { ok: true, recoveryCodes: codes };
}

/**
 * SOMEBODY SAYS THEY HAVE SAVED THE CODES, AND THAT IS WHEN THE FLOW COMPLETES.
 *
 * Operator instruction, 2026-09-13: "on enrolment the flow does not complete
 * until I confirm I have saved them."
 *
 * The screen already had a checkbox and a disabled button, and that protected
 * nothing, because confirmEnrolment had already issued the full session. The
 * enrolment was complete and the checkbox governed a redirect. So the
 * acknowledgement is a call now, and the session is issued by THIS step.
 *
 * IT IS NOT PROOF, AND THE COLUMN COMMENT SAYS SO. Nothing can prove a person
 * wrote something down. What it separates is somebody who was asked and
 * answered from somebody who closed the tab, and an account in the second state
 * is one whose recovery path nobody has, which is exactly where the operator
 * was on the day this was ordered.
 *
 * It refuses an account with no active enrolment rather than writing a
 * timestamp onto nothing, because an acknowledgement of codes that were never
 * issued is a record that would read as reassurance.
 */
export async function acknowledgeRecoveryCodes(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const { data, error } = await db
    .from("eng_mfa_enrolments")
    .select("secret_cipher, verified_at, recovery_codes_issued_at, recovery_codes_acknowledged_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { ok: false, error: `The enrolment could not be read: ${error.message}` };
  if (!data?.secret_cipher || !data.verified_at) {
    return { ok: false, error: "There is no second factor on this account to acknowledge codes for." };
  }
  if (!data.recovery_codes_issued_at) {
    return { ok: false, error: "No recovery codes have been issued for this account." };
  }

  /*
   * ALREADY ACKNOWLEDGED IS NOT AN ERROR WORTH A DIFFERENT SENTENCE, but it is
   * a refusal: a second acknowledgement would move the timestamp and lose the
   * one fact the column is for, and it would be a second free upgrade.
   */
  if (data.recovery_codes_acknowledged_at) {
    return { ok: false, error: "These recovery codes have already been confirmed as saved." };
  }

  /*
   * THE BINDING IS NOT HERE ANY MORE, AND THAT IS THE POINT.
   *
   * It used to compare verified_at against the moment the calling session
   * began. verified_at comes from the DATABASE clock and the session comes from
   * the APPLICATION clock, so it was a boundary resting on two unsynchronised
   * clocks agreeing. It passed standalone twice and went red on the board.
   *
   * The binding is now a token the route verifies before calling this, minted
   * by the confirm that produced these codes. See issueEnrolmentCompletion in
   * src/lib/ops-session.ts for the whole argument.
   *
   * What stays here is what belongs to the RECORD rather than to the session:
   * there must be an active enrolment, codes must have been issued, and they
   * must not already be acknowledged. The last of those is what makes a
   * replayed token find nothing left to do.
   */

  const { error: writeError } = await db
    .from("eng_mfa_enrolments")
    .update({ recovery_codes_acknowledged_at: DB_NOW })
    .eq("user_id", userId);
  if (writeError) return { ok: false, error: `It could not be recorded: ${writeError.message}` };

  return { ok: true };
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

  /*
   * THE LINE THAT CAUSED THE 2026-09-13 LOCKOUT.
   *
   * It used to return mfaStatus() here, and for a REPLACED key that sentence is
   * "MFA_ENCRYPTION_KEY is configured." It went into the red error slot on the
   * challenge screen and sent four hours in the wrong direction: a positive
   * status, entirely true, and the least useful true thing the platform could
   * have said to somebody holding a working phone.
   *
   * keyFaultFor asks the question that actually matters, which is whether this
   * key is the one this ciphertext was written under.
   */
  const fault = keyFaultFor(data.secret_cipher as string);
  if (fault) return { ok: false, error: keyFaultSentence(fault) };

  const base32 = decryptSecret(data.secret_cipher as string);
  if (!base32) {
    /*
     * Reached only when the stored row is malformed rather than the key wrong,
     * because keyFaultFor has already answered for the key. Its own sentence,
     * so the two faults can never be confused again.
     */
    return {
      ok: false,
      error: "The stored secret on this account is corrupted and cannot be read. It has to be enrolled again.",
    };
  }
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
