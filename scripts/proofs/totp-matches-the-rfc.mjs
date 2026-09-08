/**
 * THE TOTP IMPLEMENTATION AGREES WITH RFC 6238's OWN TEST VECTORS.
 *
 *   node scripts/proofs/totp-matches-the-rfc.mjs
 *
 * WHY THIS AND NOT A ROUND TRIP TEST
 * ----------------------------------
 * A round trip proves this file agrees with itself. Generate a code, verify it,
 * green board, and a systematically wrong implementation passes every time,
 * because both halves are wrong in the same direction. The failure would then
 * appear on the day a real authenticator app was pointed at it, which is to say
 * on the day somebody enrolled and could not sign in.
 *
 * The vectors below are published in RFC 6238 Appendix B. They are what Google
 * Authenticator, 1Password, Authy and every other app compute. Agreeing with
 * them is the only claim worth making about this code.
 *
 * The RFC prints eight digit codes. This platform uses six, which is the last
 * six digits of the same truncation, so each expected value below is the RFC's
 * with its leading two characters dropped, and the full RFC value is kept in
 * the comment beside it so the derivation is checkable.
 */

import {
  base32Encode,
  base32Decode,
  codeForStep,
  stepAt,
  verifyTotp,
  otpauthUri,
  newTotpSecret,
  TOTP_PERIOD_SECONDS,
  TOTP_DIGITS,
  TOTP_DRIFT_STEPS,
} from "../../src/lib/totp.ts";

let fails = 0;
const rec = (name, ok, note = "") => {
  if (!ok) fails += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

console.log("");
console.log("========== TOTP AGAINST RFC 6238 ==========");

/* The RFC's SHA1 seed: the ASCII string "12345678901234567890". */
const SEED = Buffer.from("12345678901234567890", "ascii");

/* Appendix B, the SHA1 rows. [unix seconds, the RFC's 8 digit code] */
const VECTORS = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

console.log("\nTHE PUBLISHED VECTORS");
for (const [seconds, eight] of VECTORS) {
  const six = eight.slice(-6);
  const got = codeForStep(SEED, stepAt(seconds * 1000));
  rec(`t=${seconds} gives ${six}`, got === six, got === six ? `RFC ${eight}` : `got ${got}, RFC ${eight}`);
}

console.log("\nAND verify AGREES WITH generate, AT THE RIGHT STEP");
for (const [seconds] of VECTORS) {
  const ms = seconds * 1000;
  const step = stepAt(ms);
  const code = codeForStep(SEED, step);
  const v = verifyTotp(SEED, code, ms);
  rec(`t=${seconds} verifies and reports its own step`, v.ok && v.step === step, `step ${v.step}`);
}

console.log("\nTHE DRIFT WINDOW IS EXACTLY ONE STEP EITHER SIDE");
{
  const ms = 1234567890 * 1000;
  const now = stepAt(ms);
  for (const d of [-1, 0, 1]) {
    const v = verifyTotp(SEED, codeForStep(SEED, now + d), ms);
    rec(`a code from step ${d >= 0 ? "+" : ""}${d} is accepted`, v.ok && v.step === now + d);
  }
  for (const d of [-2, 2]) {
    const v = verifyTotp(SEED, codeForStep(SEED, now + d), ms);
    rec(`a code from step ${d > 0 ? "+" : ""}${d} is refused`, !v.ok, "the window is not wider than it says");
  }
  rec(`the window constant says ${TOTP_DRIFT_STEPS}`, TOTP_DRIFT_STEPS === 1);
}

console.log("\nWHAT IS NOT A CODE");
{
  const ms = 1234567890 * 1000;
  for (const bad of ["", "12345", "1234567", "abcdef", "12345a", "  ", "000000000"]) {
    rec(`refuses ${JSON.stringify(bad)}`, verifyTotp(SEED, bad, ms).ok === false);
  }
  /* Six digits that are simply wrong, as opposed to malformed. */
  const right = codeForStep(SEED, stepAt(ms));
  const wrong = String((Number(right) + 1) % 1000000).padStart(6, "0");
  rec("refuses a well formed code that is not the right one", verifyTotp(SEED, wrong, ms).ok === false);
}

console.log("\nBASE32 ROUND TRIPS, AND REFUSES WHAT IS NOT BASE32");
{
  const enc = base32Encode(SEED);
  rec("the RFC seed encodes to the published base32", enc === "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", enc);
  rec("and decodes back to the same bytes", Buffer.compare(base32Decode(enc), SEED) === 0);
  rec("tolerates the spaces a person retyping produces", Buffer.compare(base32Decode("GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ"), SEED) === 0);
  rec("tolerates lower case", Buffer.compare(base32Decode(enc.toLowerCase()), SEED) === 0);
  rec("refuses a string with a character outside the alphabet", base32Decode("GEZD1NBV") === null,
    "1 and 0 are not in RFC 4648 base32, and decoding a prefix would produce a secret that silently never matches");
  rec("refuses an empty string", base32Decode("") === null);
}

console.log("\nA FRESH SECRET IS THE RIGHT SHAPE");
{
  const { base32, bytes } = newTotpSecret();
  rec("160 bits, as RFC 4226 recommends for SHA1", bytes.length === 20);
  rec("its base32 decodes back to the same bytes", Buffer.compare(base32Decode(base32), bytes) === 0);
  const a = newTotpSecret().base32;
  const b = newTotpSecret().base32;
  rec("two secrets differ", a !== b, "a constant secret would be one secret for the whole firm");
}

console.log("\nTHE URI AN AUTHENTICATOR APP SCANS");
{
  const uri = otpauthUri("GEZDGNBVGY3TQOJQ", "someone@example.com", "254 Engineering Services");
  rec("is an otpauth totp uri", uri.startsWith("otpauth://totp/"));
  rec("carries the issuer in the label", uri.includes("254%20Engineering%20Services%3Asomeone%40example.com"));
  rec("and again as a parameter", /[?&]issuer=254\+Engineering\+Services/.test(uri), "apps use the parameter, and the label is what a person reads");
  rec("declares the algorithm rather than leaving it to a default", uri.includes("algorithm=SHA1"));
  /*
   * THE LITERALS ARE THE POINT, AND THIS IS A LOCKOUT RATHER THAN A TIDINESS
   * ISSUE.
   *
   * These two lines used to read `digits=${TOTP_DIGITS}` against a uri built by
   * otpauthUri from the same TOTP_DIGITS. They compared a value to itself, so
   * changing the constant to 8 would have kept both green while the QR told
   * every authenticator app to expect eight digits and codeForStep went on
   * emitting six.
   *
   * Nobody would notice at enrolment, because confirmEnrolment checks the code
   * with the same generator. It surfaces at the NEXT sign in, on a phone that is
   * working perfectly, for every account already enrolled. There is no recovery
   * from that except the recovery codes.
   *
   * So 6 and 30 are written out. They are also what the RFC vectors above
   * already assume: those vectors are 8 digit values sliced to the last 6 at a
   * 30 second step, so a change to either constant has to come here and argue
   * with this file rather than pass through it.
   */
  rec("declares 6 digits, as a literal", uri.includes("digits=6"));
  rec("declares the 30 second period, as a literal", uri.includes("period=30"));

  /* And the two constants still have to agree with the literals above, so a
   * drifted constant is reported as a drifted constant rather than as a broken
   * uri somewhere downstream. */
  rec(
    "and the module's own constants still say 6 and 30",
    TOTP_DIGITS === 6 && TOTP_PERIOD_SECONDS === 30,
    `TOTP_DIGITS=${TOTP_DIGITS}, TOTP_PERIOD_SECONDS=${TOTP_PERIOD_SECONDS}`,
  );

  /*
   * The generator and the advertisement, compared to each other. This is the
   * pairing that actually fails when the two drift, independent of what either
   * constant says.
   */
  rec(
    "and the generator emits exactly as many digits as the uri advertises",
    codeForStep(newTotpSecret().bytes, 1).length === 6,
  );
}

console.log("");
if (fails) {
  console.log(`FAIL: ${fails} case(s). This implementation does not agree with the RFC, so it does not agree with any authenticator app.`);
  process.exit(1);
}
console.log("PASS: the codes are the codes a real authenticator app would produce.");
