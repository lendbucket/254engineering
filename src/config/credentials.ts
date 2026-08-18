/**
 * The verified credential register.
 *
 * WHAT THIS FILE IS FOR
 * ---------------------
 * Texas regulates who may call themselves an engineer, who may seal a document,
 * and what a firm may say about its registration. The failure mode this file
 * exists to prevent is not malice, it is drift: a plausible looking licence
 * number written into a page as a placeholder, or a PE's name added to a bio
 * before the hire is signed, and then nobody notices because the page looks
 * finished.
 *
 * So the rule is mechanical. `scripts/placeholder-audit.mjs` scans rendered
 * output for anything shaped like a PE name, a licence number, or a firm
 * registration number, and fails the build on any of them that is not listed
 * here. An empty register means no credential may appear anywhere on the site,
 * which is exactly correct today.
 *
 * ADDING SOMETHING HERE IS A DECLARATION
 * --------------------------------------
 * A value in this file asserts that somebody checked it against the issuing
 * authority. Do not add one because a page needs it to render. If the credential
 * is not yet real, the page states that it is pending, which is what every
 * surface on this site does today.
 */

export type VerifiedEngineer = {
  /** Full name as it appears on the licence. */
  name: string;
  /** Texas PE licence number, digits only. */
  licenseNumber: string;
  disciplines: string[];
  /** Who checked it, and when. Free text, but never left empty. */
  verified: string;
};

export type VerifiedFirmRegistration = {
  board: string;
  /** The registration number exactly as issued. */
  number: string;
  verified: string;
};

/**
 * Licensed Professional Engineers whose names and numbers may appear on this
 * site.
 *
 * EMPTY BY DESIGN. No PE has been hired. Until one is, no engineer's name and no
 * licence number may render anywhere, and the audit enforces that rather than
 * trusting it.
 */
export const verifiedEngineers: VerifiedEngineer[] = [];

/**
 * Firm registrations that may appear on this site.
 *
 * EMPTY BY DESIGN. The TBPELS firm registration is pending. When it issues, the
 * number goes into the TBPELS_FIRM_NUMBER environment variable for the launch
 * gate AND into this array for the audit, and those are two deliberate steps
 * rather than one, because the gate controls what renders and this controls what
 * is permitted to render.
 */
export const verifiedFirmRegistrations: VerifiedFirmRegistration[] = [];

/**
 * Strings that look like credentials, are not, and are allowed.
 *
 * Each needs a reason. These are matched as literals against the matched text,
 * so an allowed token cannot shelter a real finding next to it.
 */
export const credentialAllowlist: { literal: string; why: string }[] = [
  {
    literal: "Texas PE license number",
    why: "A form field label on the careers page. Asks an applicant for theirs; asserts nothing about the firm.",
  },
  {
    literal: "TBPELS Firm No.",
    why: "The live mode footer label. The number beside it is gated on the launch mode and on this register, and the label alone claims nothing.",
  },
];

/** Every credential string the site is currently permitted to render. */
export function permittedCredentialStrings(): string[] {
  return [
    ...verifiedEngineers.flatMap((e) => [e.name, e.licenseNumber]),
    ...verifiedFirmRegistrations.map((r) => r.number),
  ];
}
