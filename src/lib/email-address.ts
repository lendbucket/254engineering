import "server-only";

/**
 * THE LONGEST EMAIL ADDRESS THIS PLATFORM ACCEPTS, AND WHY IT IS THAT NUMBER.
 *
 * Phase 13, Section 0, debt one. The other half of the MFA lockout ruling: the
 * QR encoder was extended to version 17 so a long address can enrol a second
 * factor, and the ruling also said to CAP the accepted address and state the
 * cap. This is the cap.
 *
 * WHY A CAP AT ALL, WHEN THE ENCODER WAS THE THING THAT BROKE
 * -----------------------------------------------------------
 * `scripts/proofs/qr-decodes-to-what-it-encoded.mjs` records the gap in its own
 * words: "The platform sets no limit of its own: eng_profiles.email is text and
 * no input carries a maxLength, so the ceiling is the standard's."
 *
 * That was survivable while every account was one the operator created. Phase
 * 13 opens self-service sign up, so the addresses become arbitrary, and an
 * unbounded input reaching a fixed capacity encoder is the same failure waiting
 * at a different length. A 1,000 character address would not produce a 500 any
 * more; it would produce a refusal somewhere further in, at a moment nobody
 * chose.
 *
 * WHY 320 AND NOT A ROUND NUMBER
 * -------------------------------
 * It is RFC 5321's maximum: 64 octets of local part, 255 of domain, plus the @.
 * It is not this firm's opinion about how long an address should be, which is
 * the right posture for a limit that decides whether somebody can become a
 * customer. Choosing 254, or 200, or any of the other figures people reach for
 * would silently refuse addresses that are legal and deliverable.
 *
 * AND IT IS PROVEN TO FIT RATHER THAN ASSUMED TO
 * -----------------------------------------------
 * The QR proof encodes an address of exactly this length, and one whose every
 * local character percent encodes, and round trips both through jsQR at version
 * 17. Both come out at 474 bytes against a 504 byte ceiling.
 *
 * THAT HEADROOM IS NOT INFINITE AND IT IS NOT GUARDED BY THIS FILE. The issuer
 * string is in the URI too, so a longer firm name eats into the same 30 bytes.
 * The proof asserts the whole URI fits, which is the assertion that actually
 * matters, and it reads this constant rather than carrying its own copy.
 */
export const MAX_EMAIL_LENGTH = 320;

/**
 * The shortest thing that could be an address: a@b.c
 *
 * Not a validation rule so much as a floor under one. An empty string and a
 * single character both fail the shape check below; this exists so the refusal
 * can say something more useful than "that is not an email address" to somebody
 * who typed two characters.
 */
export const MIN_EMAIL_LENGTH = 5;

/**
 * Why an address is refused, or null if it is accepted.
 *
 * A SENTENCE RATHER THAN A BOOLEAN, which is the same construction the launch
 * gate uses and for the same reason: what somebody needs when their address is
 * refused is which part of it was the problem. "Invalid email" on a sign up
 * form is where people give up.
 *
 * This does NOT decide whether an address is deliverable. Nothing can, short of
 * sending to it, which is what the verification link is for.
 */
export function emailRefusal(raw: string): string | null {
  const email = raw.trim();

  if (email.length === 0) return "Enter an email address.";
  if (email.length < MIN_EMAIL_LENGTH) return "That is too short to be an email address.";

  /*
   * THE LENGTH CHECK COMES BEFORE THE SHAPE CHECK, deliberately. A 4,000
   * character string should be refused for being 4,000 characters rather than
   * run through a regular expression first, and a reader of the refusal learns
   * the actual problem rather than a shape complaint about a string nobody
   * could read anyway.
   */
  if (email.length > MAX_EMAIL_LENGTH) {
    return `That address is ${email.length} characters. The longest this platform accepts is ${MAX_EMAIL_LENGTH}, which is the maximum an email address may be.`;
  }

  const at = email.indexOf("@");
  if (at < 0) return "An email address needs an @ in it.";
  if (email.indexOf("@", at + 1) >= 0) return "An email address has one @ in it, and that one has more.";

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  /*
   * The two halves have their own limits in the same standard, and saying WHICH
   * half is too long is the difference between a person fixing a typo and a
   * person giving up. 64 and 255.
   */
  if (local.length === 0) return "There is nothing before the @.";
  if (local.length > 64) return `The part before the @ is ${local.length} characters. The longest allowed is 64.`;
  if (domain.length === 0) return "There is nothing after the @.";
  if (domain.length > 255) return `The part after the @ is ${domain.length} characters. The longest allowed is 255.`;

  if (!domain.includes(".")) return "The part after the @ needs a dot in it.";
  if (domain.startsWith(".") || domain.endsWith(".")) return "The part after the @ cannot start or end with a dot.";
  if (domain.includes("..")) return "The part after the @ has two dots together.";

  /*
   * Whitespace anywhere, checked explicitly rather than by a shape pattern,
   * because a trailing space pasted from a spreadsheet is the single most
   * common thing in this input and it deserves its own sentence. The trim above
   * has already removed the outer ones, so anything left is interior.
   */
  if (/\s/.test(email)) return "An email address cannot contain a space.";

  return null;
}

/**
 * The address as it is stored and compared.
 *
 * Lowercased and trimmed, which is what `normaliseEmail` in
 * marketing-suppression.ts already does for the same reason: two people typing
 * the same address differently are one person, and a suppression list that
 * thinks otherwise writes to somebody who asked it not to.
 */
export function normaliseAddress(raw: string): string {
  return raw.trim().toLowerCase();
}
