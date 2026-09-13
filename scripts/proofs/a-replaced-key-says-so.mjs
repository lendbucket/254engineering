// @runtime react-server
//
// Declared because this proof imports src/lib/ops-mfa.ts, which carries
// `server-only`. scripts/lib/audit-runtime.mjs works the requirement out from
// the imports, so this line and the invocation cannot drift apart.
/**
 * A REPLACED KEY SAYS SO, AND A WRONG CODE STILL SAYS THAT.
 *
 *   npx tsx --conditions=react-server scripts/proofs/a-replaced-key-says-so.mjs
 *
 * WHAT THIS IS FOR
 * ----------------
 * On 2026-09-13 the operator was locked out of production. Their phone was
 * fine, their code was fine, and the challenge screen answered every attempt
 * with a red error reading
 *
 *     MFA_ENCRYPTION_KEY is configured.
 *
 * which is true, and is the least useful true sentence the platform could have
 * produced. `answerChallenge` returned `mfaStatus()` when decryption failed,
 * and `mfaStatus` looks at the key's PRESENCE and LENGTH. A key REPLACED with
 * another perfectly valid value passes both tests, so the one fault that had
 * actually happened was the one fault the sentence could not describe.
 *
 * Four hours went into the wrong diagnosis. The enrolment was cleared by hand
 * in the end, which is the right remedy and was reached the long way round.
 *
 * THE THREE ANSWERS THIS SEPARATES, WHICH IS THE WHOLE TEST
 * ---------------------------------------------------------
 * A fixture that cannot separate two answers proves neither, and this one has
 * three that a person must never confuse:
 *
 *   1. The key is the one this account enrolled under and the code is right.
 *   2. The key is right and the code is wrong.      -> "That code is not right."
 *   3. The key is NOT the one this account enrolled under, whatever the code.
 *
 * Before the fix, 2 and 3 were told apart by nothing a person could act on: one
 * said the code was wrong and the other said the key was configured, and
 * neither pointed at the key having changed. This asserts all three are
 * different sentences, and that the sentence for 3 names the replacement.
 *
 * WHAT IT CANNOT SEPARATE, STATED RATHER THAN HIDDEN
 * --------------------------------------------------
 * AES-GCM authenticates, so a ciphertext altered in the database and a
 * ciphertext read under the wrong key both fail the same way, with no
 * information about which. `keyFaultFor` therefore reports a tampered three
 * part cipher as changed. The case is asserted below so the conflation is on
 * the record rather than discovered by somebody debugging it. The remedy
 * sentence covers both: restore the previous value, or clear the enrolment and
 * enrol again.
 *
 * THE LIVE HALF
 * -------------
 * The pure half asks `keyFaultFor` directly. That is necessary and not
 * sufficient, because the defect was never in a helper; it was in which
 * sentence a screen printed. So the live half puts a real enrolment on the
 * development database, walks the real `answerChallenge`, and reads the three
 * sentences it returns. Development only, and it removes what it created.
 */

import { auditClient } from "../lib/db-target.mjs";
import { base32Decode, codeForStep, newTotpSecret, stepAt } from "../../src/lib/totp.ts";
import {
  encryptSecret,
  keyFaultFor,
  keyFaultSentence,
  mfaStatus,
  answerChallenge,
} from "../../src/lib/ops-mfa.ts";

/* Two keys, both valid by every test mfaStatus applies. That is the point. */
const KEY_A = "proof-key-alpha-000000000000000000";
const KEY_B = "proof-key-bravo-111111111111111111";
const SHORT = "too-short-here";

const PROBE_DOMAIN = "audit-probe.invalid";

/**
 * @param {boolean} loud
 * @returns {Promise<{failed: string[], total: number, notes: string[]}>}
 */
export async function checkKeyFault(loud = false) {
  const failed = [];
  const notes = [];
  let total = 0;
  const say = (line) => {
    if (loud) console.log(line);
  };
  const rec = (name, ok, note = "") => {
    total += 1;
    if (ok) say(`  PASS  ${name}${note ? `  (${note})` : ""}`);
    else {
      failed.push(`${name}${note ? `: ${note}` : ""}`);
      say(`  FAIL  ${name}${note ? `  (${note})` : ""}`);
    }
  };

  const HAD = process.env.MFA_ENCRYPTION_KEY;
  const restoreKey = () => {
    if (HAD === undefined) delete process.env.MFA_ENCRYPTION_KEY;
    else process.env.MFA_ENCRYPTION_KEY = HAD;
  };

  /* ------------------------------------------------ the pure half */
  say("");
  say("keyFaultFor, against a ciphertext of known provenance");

  process.env.MFA_ENCRYPTION_KEY = KEY_A;
  const secret = newTotpSecret();
  const cipher = encryptSecret(secret.base32);
  rec("a secret encrypts under the first key at all", typeof cipher === "string" && cipher.split(".").length === 3);

  rec("the key it was written under is not a fault", keyFaultFor(cipher) === null);

  process.env.MFA_ENCRYPTION_KEY = KEY_B;
  rec(
    "a DIFFERENT key of valid length reads as changed",
    keyFaultFor(cipher) === "changed",
    "the fault that locked the operator out, and the one mfaStatus cannot see",
  );

  /*
   * THE CHECK THAT WOULD HAVE CAUGHT THE DEFECT ON ITS OWN.
   *
   * Pinned as a literal rather than compared to mfaStatus's own constant,
   * because an audit that imports its expectation from the thing it audits
   * compares a value to itself. This is the sentence that appeared in the red
   * error slot, written out, so the day it comes back the board says so.
   */
  rec(
    "and mfaStatus still reports that same key as configured, which is why it could not be the verifier",
    mfaStatus() === "MFA_ENCRYPTION_KEY is configured.",
    "true, and useless to somebody holding a working phone",
  );

  delete process.env.MFA_ENCRYPTION_KEY;
  rec("no key at all reads as missing", keyFaultFor(cipher) === "missing");

  process.env.MFA_ENCRYPTION_KEY = SHORT;
  rec("a key under the minimum reads as too short", keyFaultFor(cipher) === "too_short");

  process.env.MFA_ENCRYPTION_KEY = KEY_A;
  rec(
    "an account with no enrolment is not a key fault",
    keyFaultFor(null) === null,
    "or every signed out screen would accuse the deployment",
  );
  rec(
    "a cipher that is not three parts is a corrupt row rather than a key fault",
    keyFaultFor("this-is-not-a-cipher") === null,
  );

  /*
   * THE CONFLATION, ASSERTED SO IT IS ON THE RECORD.
   * A tampered three part cipher under the CORRECT key reads as changed,
   * because GCM cannot tell the two apart. See the header.
   */
  const parts = cipher.split(".");
  const tampered = `${parts[0]}.${parts[1]}.${Buffer.from("not the ciphertext").toString("base64")}`;
  rec(
    "a tampered cipher under the right key also reads as changed, which is stated rather than hidden",
    keyFaultFor(tampered) === "changed",
    "GCM authenticates without saying which of the two failed; the remedy sentence covers both",
  );

  /* The three sentences are three sentences. */
  const sMissing = keyFaultSentence("missing");
  const sShort = keyFaultSentence("too_short");
  const sChanged = keyFaultSentence("changed");
  rec(
    "the three key faults produce three different sentences",
    new Set([sMissing, sShort, sChanged]).size === 3,
  );
  rec(
    "and the one for a replaced key says the key was replaced, in those words",
    /replaced/i.test(sChanged) && /MFA_ENCRYPTION_KEY/.test(sChanged),
  );
  rec(
    "and tells the person their phone and their code are fine",
    /your code is fine/i.test(sChanged),
    "because the failure they are looking at is indistinguishable from a broken phone",
  );

  /* ------------------------------------------------ the live half */
  say("");
  say("answerChallenge, against a real enrolment on the development database");

  const db = auditClient("a-replaced-key-says-so", { neverProduction: true });
  if (!db) {
    notes.push("the live half did not run: no database client");
    say("  ....  the live half did not run, no database client");
    restoreKey();
    say("");
    return { failed, total, notes };
  }

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `probe-keyfault-${stamp}@${PROBE_DOMAIN}`;
  let userId = null;

  try {
    const made = await db.auth.admin.createUser({ email, password: `probe-${stamp}`, email_confirm: true });
    if (made.error || !made.data?.user) throw new Error(`could not create the probe account: ${made.error?.message}`);
    userId = made.data.user.id;

    const profile = await db.from("eng_profiles").insert({
      id: userId,
      email,
      display_name: "Audit Probe key fault",
      role: "admin",
      status: "active",
      is_demo: true,
    });
    if (profile.error) throw new Error(`could not create the probe profile: ${profile.error.message}`);

    /*
     * ENROLLED UNDER KEY A, written the way confirmEnrolment writes it: an
     * active cipher and a verified_at, which the table's own check constraint
     * requires to be set or null together.
     */
    process.env.MFA_ENCRYPTION_KEY = KEY_A;
    const liveSecret = newTotpSecret();
    const enrol = await db.from("eng_mfa_enrolments").insert({
      user_id: userId,
      secret_cipher: encryptSecret(liveSecret.base32),
      verified_at: new Date().toISOString(),
    });
    if (enrol.error) throw new Error(`could not write the enrolment: ${enrol.error.message}`);

    const bytes = base32Decode(liveSecret.base32);
    const rightNow = () => codeForStep(bytes, stepAt(Date.now()));

    /* 1. Right key, right code. */
    const good = await answerChallenge(userId, rightNow());
    rec("the right key and the right code lets the person in", good.ok === true, good.ok ? "" : good.error);

    /*
     * 2. Right key, wrong code. Deliberately a code from a step far enough back
     * that the drift window cannot accept it, rather than six zeroes, so this
     * tests a REFUSED code rather than a malformed one.
     */
    const stale = codeForStep(bytes, stepAt(Date.now()) - 50);
    const wrong = await answerChallenge(userId, stale);
    rec(
      "the right key and a wrong code still reads as a wrong code",
      wrong.ok === false && wrong.error === "That code is not right.",
      wrong.ok ? "it was accepted" : wrong.error,
    );
    rec(
      "and a wrong code never mentions the key",
      wrong.ok === false && !/MFA_ENCRYPTION_KEY/.test(wrong.error),
      "or every mistyped code would send somebody to the Vercel dashboard",
    );

    /* 3. The key replaced underneath a working phone. */
    process.env.MFA_ENCRYPTION_KEY = KEY_B;
    const replaced = await answerChallenge(userId, rightNow());
    rec(
      "a replaced key is reported as a replaced key",
      replaced.ok === false && /replaced/i.test(replaced.error),
      replaced.ok ? "the code was ACCEPTED under a key that cannot read the secret" : replaced.error.slice(0, 70),
    );
    rec(
      "and never as a wrong code",
      replaced.ok === false && replaced.error !== "That code is not right.",
      "which is the sentence that sends a person to buy a new phone",
    );
    rec(
      "and never as the key being configured, which is the sentence of 2026-09-13",
      replaced.ok === false && replaced.error !== "MFA_ENCRYPTION_KEY is configured.",
    );

    /* The separation, asserted rather than inferred from the three above. */
    rec(
      "the three outcomes are three distinguishable answers",
      good.ok === true && wrong.ok === false && replaced.ok === false && wrong.error !== replaced.error,
      "a fixture that cannot separate two answers proves neither",
    );
  } catch (err) {
    failed.push(`the live half could not run: ${err.message}`);
    total += 1;
    say(`  FAIL  the live half could not run  (${err.message})`);
  } finally {
    /*
     * TEARDOWN, and it sweeps every probe this proof has ever made rather than
     * only this id, so a run that died before reaching here is cleaned up too.
     * Permitted because these are rows this run created, on development. The
     * enrolment goes with the profile through `on delete cascade` and is
     * deleted first anyway, because a cascade that silently did nothing is the
     * shape this repository has been caught by before.
     */
    restoreKey();
    const { data: strays } = await db
      .from("eng_profiles")
      .select("id")
      .like("email", `probe-keyfault-%@${PROBE_DOMAIN}`);
    for (const row of strays ?? []) {
      await db.from("eng_mfa_enrolments").delete().eq("user_id", row.id);
      await db.from("eng_profiles").delete().eq("id", row.id);
      await db.auth.admin.deleteUser(row.id).catch(() => {});
    }
    const { data: left } = await db
      .from("eng_profiles")
      .select("id")
      .like("email", `probe-keyfault-%@${PROBE_DOMAIN}`);
    rec("the probe enrolment is removed", (left ?? []).length === 0, `${(left ?? []).length} left behind`);
  }

  restoreKey();
  say("");
  return { failed, total, notes };
}

/* Run directly: print everything and set an exit code. */
const invokedDirectly =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());

if (invokedDirectly) {
  const { failed, total, notes } = await checkKeyFault(true);
  for (const n of notes) console.log(`NOTE: ${n}`);
  if (failed.length) {
    console.log("");
    console.log(`FAIL: ${failed.length} of ${total} cases. A person holding a working phone would be told the wrong thing.`);
    process.exit(1);
  }
  console.log(`PASS: ${total} cases. A replaced key says so, a wrong code still says that, and the two are never the same sentence.`);
}
