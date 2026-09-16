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
  /*
   * ANSWERED 2026-09-13, BY THE ONLY PERSON WHO COULD ANSWER IT.
   *
   * It was recorded rather than guessed because only the operator holds the
   * formation documents, and the guess available at the time would have been
   * wrong: the site's name was the invented one and the board's was real.
   *
   * OPERATOR RULING: the entity is 254 Services LLC. business.legalName was
   * wrong. The firm trades under its registered name, so no assumed name filing
   * is needed and the board already holds the name the firm operates under.
   *
   * KEPT RATHER THAN DELETED, with resolved true. A discrepancy that vanishes
   * looks like one nobody ever found, and the next reader meeting a legal name
   * that changed in one commit with no explanation would have to reconstruct
   * why from the git history. That is this file's own standing practice.
   */
  resolved: true,
  legalNameOnSite: "254 Services LLC",
  registrantOnRecord: "254 Services LLC",
  because:
    "ANSWERED 2026-09-13 by the operator, who holds the formation documents: the entity is 254 Services " +
    "LLC, and business.legalName was wrong. It had said 254 Engineering Services LLC since it was written " +
    "and no such entity exists. The two names now agree because the invented one was corrected to the real " +
    "one, not because a filing changed anything. 254 Engineering Services survives as the brand wordmark " +
    "and logo and is never the legal or firm name in a sentence.",
};

/**
 * THE ENTITY WAS RENAMED AT THE SECRETARY OF STATE, AND THE BOARD DOES NOT KNOW
 * YET. Operator ruling, 2026-09-15, recorded the day the stamped amendment came
 * back.
 *
 * This is a STATE record, not a BOARD record, and the difference is the whole
 * reason it gets its own constant instead of being written into the registration
 * above. The compliance gate asks what TBPELS holds. The Secretary of State can
 * rename the entity tomorrow and TBPELS still holds F-29811 in the old name
 * until it reissues, so nothing about this filing moves a rendered sentence.
 *
 * AND THAT PRODUCES A KNOWN, ACCEPTED WINDOW, WRITTEN DOWN RATHER THAN LEFT TO
 * BE DISCOVERED. Operator ruling, same day.
 *
 *   From 2026-09-16, every sentence on this site names 254 Services LLC. The
 *   board's record agrees with those sentences. The Secretary of State's record
 *   does not, because the entity is now 254 Engineering LLC.
 *
 * It is the correct trade and it is deliberate: the board's record is what the
 * compliance gate is about, and holding the copy still is what stops the sites
 * from claiming a name TBPELS has never registered, which is the exact
 * misstatement this whole gate exists to prevent. It CLOSES when TBPELS
 * reissues F-29811 in the new name, which is one edit to `issuedTo` above,
 * because `firmName()` in src/lib/launch.ts derives every one of those
 * sentences from it.
 *
 * `business.legalName` in src/config/business.ts is deliberately NOT moved to
 * the new name while this window is open, for the same reason and by the same
 * ruling. It is stale against the state and true against the board, on purpose.
 */
export const secretaryOfStateAmendment: {
  newName: string;
  formerName: string;
  /** ISO date the amendment takes effect. */
  effective: string;
  /** The file number on the stamped certificate. */
  fileNumber: string;
  /** What has been sent to TBPELS, and what is still owed. */
  boardNotified: string;
} = {
  newName: "254 Engineering LLC",
  formerName: "254 Services LLC",
  effective: "2026-09-16",
  fileNumber: "806765419",
  boardNotified:
    "Filed and stamped, recorded by the operator 2026-09-15. The amendment and the duplicate certificate " +
    "form go to TBPELS on 2026-09-16. F-29811 is still issued to 254 Services LLC until the board reissues " +
    "it, and no surface changes until it does.",
};

export const operatingNameOnBoardRecord: {
  onRecord: boolean;
  /** What the board's record says, or why it does not yet say it. */
  because: string;
} = {
  /*
   * CLEARED 2026-09-13, AND THE REASON IS NOT THAT A FILING HAPPENED.
   *
   * The condition asks whether the board holds the name this firm operates
   * under. It was unmet because the sites held out as 254 Engineering Services
   * and F-29811 is issued to 254 Services LLC.
   *
   * OPERATOR RULING: the firm trades under its REGISTERED name. So the name the
   * firm operates under is 254 Services LLC, the board has held it since
   * 2026-09-10, and no assumed name filing is needed or will be made. The
   * mismatch was resolved by correcting the sites rather than by asking the
   * board for anything.
   *
   * WHAT HAD TO BE TRUE ON DISK BEFORE THIS WAS SET, because a flag set over a
   * false state is this repository own recurring defect: 27 sentences across
   * src and data now name 254 Services LLC where they named the brand, and the
   * regulatory patterns in scripts/lib/regulatory.mjs learned the new name in
   * the same commit, so voice-audit did not go blind on the way past.
   *
   * THE BRAND SURVIVES AND IS NOT THE FIRM NAME. 254 Engineering Services is
   * the wordmark, the logo, the page title suffix and og:site_name. It is never
   * the legal or firm name in a sentence, and compliance-audit still refuses to
   * let F-29811 appear beside it.
   */
  /*
   * REOPENED 2026-09-15, BY THE RENAME, AND THE REASON IS THE POINT.
   *
   * It was cleared on 2026-09-13 with the reason "the firm trades under its
   * registered name". The Secretary of State amendment above makes the firm
   * 254 Engineering LLC on 2026-09-16, so from that date that recorded reason is
   * FALSE: the name the firm operates under is not the name the board holds.
   *
   * OPERATOR RULING: it flips false, and the argument is that leaving it true
   * would be a flag whose own stated reason contradicts the world, which is the
   * failure this gate exists to prevent rather than an exception to it. The
   * record should be true rather than convenient.
   *
   * This is the 2026-09-10 state reopened by a filing instead of by a
   * discovery, and it closes the same way it closed before: when the board
   * holds the operating name, which now means when TBPELS reissues F-29811 as
   * 254 Engineering LLC.
   *
   * SET AT FILING RATHER THAN ON THE EFFECTIVE DATE, AND THAT IS A DISCLOSED
   * JUDGEMENT. A date comparison here would flip a compliance state with no
   * deploy and no audit trail, which section 1 of CLAUDE.md refuses outright, so
   * it is a constant somebody edited on purpose. The cost is that it reads false
   * for one day while it is still arguably true. That errs toward SHUT on a gate
   * that only ever shuts things, which is the safe direction to be wrong in.
   *
   * NOTHING ELSE MOVES. No copy changes, because `firmName()` reads the
   * registrant rather than the entity. The gate was already shut on other
   * conditions, so the practical state of the platform is unchanged; what
   * changes is that the record now says something true.
   */
  onRecord: false,
  because:
    "REOPENED 2026-09-15 by the Secretary of State amendment: the entity becomes 254 Engineering LLC on " +
    "2026-09-16, file number 806765419, and TBPELS still holds F-29811 in the name 254 Services LLC, so " +
    "the board does not hold the name the firm operates under. It closes when the board reissues the " +
    "registration in the new name; the amendment and the duplicate certificate form go to TBPELS on " +
    "2026-09-16. It had been cleared on 2026-09-13 on the reason that the firm traded under its " +
    "registered name, which the rename makes false. Three names are now in play and each is a different " +
    "fact: the board holds 254 Services LLC, the state holds 254 Engineering LLC from 2026-09-16, and " +
    "254 Engineering Services remains the brand on the wordmark, the logo and the page titles, never the " +
    "legal or firm name in a sentence. Every rendered sentence names the one the BOARD holds, through " +
    "firmName(), which is why the rename moves no copy.",
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
