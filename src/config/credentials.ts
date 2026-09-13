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
  /**
   * The entity name ON THE REGISTRATION, exactly as the board issued it.
   *
   * Recorded separately from the name this site trades under because on
   * 2026-09-10 they were not the same string, and that difference is the whole
   * reason the launch gate is still shut. See operatingNameOnBoardRecord.
   */
  issuedTo: string;
  status: "active" | "expired" | "suspended";
  /** ISO date. The registration is not evidence of anything after this. */
  expires: string;
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
 * ONE PLACE, AND THIS IS IT. Operator ruling, 2026-09-10.
 *
 * This file used to say the number goes into the TBPELS_FIRM_NUMBER environment
 * variable AND into this array, "two deliberate steps rather than one". That is
 * superseded: the number is configuration and lives here, and src/lib/launch.ts
 * reads it from here rather than from the environment.
 *
 * The old reasoning was that the gate controls what renders and the register
 * controls what is PERMITTED to render, which is a real distinction. It is now
 * kept somewhere better: compliance-audit pins the number as a literal, so
 * changing it still costs two edits made on purpose, and neither of them is an
 * environment variable that can differ between a build and a deployment.
 */
export const verifiedFirmRegistrations: VerifiedFirmRegistration[] = [
  {
    board: "Texas Board of Professional Engineers and Land Surveyors",
    number: "F-29811",
    issuedTo: "254 Services LLC",
    status: "active",
    expires: "2027-07-31",
    verified: "Issued 2026-09-10, recorded by the operator the same day.",
  },
];

/**
 * DOES THE BOARD HOLD THE NAME THIS FIRM TRADES UNDER?
 *
 * Operator ruling, 2026-09-10, and it is a named condition of the compliance
 * gate rather than a note.
 *
 * F-29811 was issued to **254 Services LLC**. Every one of the three sites
 * holds out as **254 Engineering Services**, and business.legalName says
 * "254 Engineering Services LLC". Those are not the same entity name.
 *
 * Texas regulates the use of "engineer" and "engineering" in a firm's name and
 * in how it holds itself out. A registration in one name does not authorise
 * holding out under another, so printing "TBPELS Firm No. F-29811" beside
 * "254 Engineering Services" would be asserting something the board's record
 * does not say.
 *
 * The gate does not open until the board HAS the operating name: either the
 * entity is renamed, or an assumed name is filed and recorded with the board.
 * Whichever happens, this becomes true and `because` says which, with the
 * board's record as the reason rather than somebody's judgement that it is
 * probably fine.
 *
 * It is a two field object rather than a boolean on purpose. A boolean can be
 * flipped by anybody in a hurry; this cannot be flipped without writing down
 * what the board now holds, and compliance-audit reads what is written.
 */
/**
 * AND THE LEGAL ENTITY NAME DOES NOT MATCH THE REGISTRANT EITHER.
 *
 * Found 2026-09-11 while wiring the launch conditions, and it is a SECOND
 * discrepancy rather than a restatement of the one below.
 *
 * `business.legalName` in src/config/business.ts says the registered entity is
 * **254 Engineering Services LLC**, and it renders as "Legal entity" on
 * /government, in the footer copyright line, and in contracts language. TBPELS
 * issued F-29811 to **254 Services LLC**.
 *
 * Those are two different claims about who this firm IS, not about what it
 * trades as, and exactly one of them can be right:
 *
 *   Either `business.legalName` is wrong and the entity is 254 Services LLC,
 *   in which case the capability statement has been naming the wrong company
 *   to government buyers.
 *
 *   Or there are genuinely two entities, in which case the registration
 *   belongs to one and the website describes the other, and that is a bigger
 *   question than a config value.
 *
 * NOTHING HERE GUESSES WHICH. The operator holds the formation documents and
 * this file will not invent an answer from a string comparison. What it does is
 * refuse to let the discrepancy go unrecorded: `resolved` stays false, and
 * `compliance-audit` asserts that while it is false the two names are named.
 *
 * WHY IT IS NOT A LAUNCH CONDITION. The gate already will not open, on the
 * operating name. Adding a second condition for the same underlying fact would
 * mean clearing one appears to make progress while the other silently holds,
 * and the launch screen would show two rows saying nearly the same thing. When
 * the operator resolves the entity question, BOTH are answered by the same act.
 */
export const legalEntityMatchesRegistrant: {
  resolved: boolean;
  /** What business.legalName says today. */
  legalNameOnSite: string;
  /** What the board's record says today. */
  registrantOnRecord: string;
  because: string;
} = {
  resolved: false,
  legalNameOnSite: "254 Engineering Services LLC",
  registrantOnRecord: "254 Services LLC",
  because:
    "The site states its legal entity is 254 Engineering Services LLC and TBPELS issued F-29811 to 254 " +
    "Services LLC. One of those is wrong, or there are two entities. The operator holds the formation " +
    "documents and this is theirs to answer; it is recorded rather than guessed because /government names " +
    "the legal entity to procurement officers.",
};

export const operatingNameOnBoardRecord: {
  onRecord: boolean;
  /** What the board's record says, or why it does not yet say it. */
  because: string;
} = {
  onRecord: false,
  because:
    "F-29811 is issued to 254 Services LLC. The sites hold out as 254 Engineering Services, and the board " +
    "has no record of that name. This becomes true when the entity is renamed or an assumed name is filed " +
    "and recorded with the board, and this sentence says which.",
};

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
