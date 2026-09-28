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
  /**
   * The branch TBPELS granted the licence in, as the roster prints it.
   *
   * NOT what he may seal. Texas restricts practice by competence rather than by
   * branch, so this is the board's fact and `sealsOnly` is the firm's.
   */
  disciplines: string[];
  /**
   * What this engineer will actually seal, and therefore what the firm may hold
   * out. Narrower than the branch wherever the engineer says so.
   *
   * Operator ruling, 2026-09-16: the firm declares structural and nothing else
   * while he is the only engineer, and the service lines are limited to
   * structural work until a second engineer is added.
   */
  sealsOnly: string[];
  /** ISO date the licence was granted, as the roster prints it. */
  granted: string;
  /** The roster's own status word. "Active" is the only one that may seal. */
  status: string;
  /**
   * Every employer the TBPELS roster lists for this engineer, unedited.
   * This firm appearing here is the registration reflected on his own record.
   */
  employersOnRoster: string[];
  /**
   * A KNOWN, DATED LAG BETWEEN THE FIRM'S RECORD AND THE ENGINEER'S.
   *
   * Present only while the board's person-side record has not caught up with a
   * reissuance. `compliance-audit` reports ACKNOWLEDGED instead of FAIL while
   * `expires` is in the future, and fails from the day after, because an
   * acknowledgement with no end date is an exemption nobody revisits.
   *
   * It records WHOSE statement the timing is, because no check here can read
   * the roster and a claim about how fast a board updates is not a fact this
   * repository owns.
   */
  rosterNameLag?: {
    /** The name the roster is expected to show once it catches up. */
    expectedName: string;
    acknowledgedOn: string;
    acknowledgedBy: string;
    /** ISO date. ACKNOWLEDGED through this day; a finding from the next. */
    expires: string;
    because: string;
  };
  /**
   * ISO date the licence expires, or NULL meaning NOT YET RECORDED.
   *
   * Added 2026-09-16 on the operator's ruling, and the asymmetry it closes is
   * the argument: a firm registration has always carried `expires` and
   * `activeFirmRegistration()` refuses a lapsed one, while an engineer carried
   * no expiry at all. The register would therefore have held a PE whose licence
   * expired years ago with nothing anywhere noticing, and every sealed letter
   * this firm ever issues rests on that licence being active.
   *
   * NULL IS NOT "FINE". It means nobody has recorded the date yet, and
   * `activeEngineer()` refuses to treat such an entry as in responsible charge,
   * which errs toward shut on a gate that only ever shuts things.
   * compliance-audit names it as unrecorded rather than letting the absence
   * read as an answer.
   */
  expires: string | null;
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
  /**
   * THE ASSUMED NAMES THE BOARD HOLDS, IN THE BOARD'S OWN SPELLING AND ORDER.
   * Operator ruling, 2026-09-21.
   *
   * Transcribed from the verification letter exactly as printed, which means
   * "Stamp My Plans" in three words where the sibling brand is StampMyPlans in
   * one. **The Board's spelling wins here and the brand keeps its own in
   * `business.ts`**, because these answer different questions: this list says
   * what the Board is prepared to confirm, and the brand list says what a
   * customer sees. Normalising either into the other would make one of them a
   * claim its source does not support.
   *
   * NOTHING RENDERS THESE YET. Whether and where the site states a registered
   * DBA is a copy ruling nobody has made. The list exists so the answer is
   * read off the record when somebody does.
   */
  dbas: string[];
  /** Exactly as the letter prints it, upper case included. */
  mailingAddress: string;
  /** ISO. The date the Board first registered this firm, as data not prose. */
  initialRegistrationDate: string;
  status: "active" | "expired" | "suspended";
  /** ISO date. The registration is not evidence of anything after this. */
  expires: string;
  /** ISO. The date on the Board's verification, not the date somebody read it. */
  verifiedOn: string;
  /** The named person at the Board who verified it. */
  verifiedBy: string;
  /**
   * THE DOCUMENT BEHIND ALL OF THE ABOVE.
   *
   * A register that records what a letter said, without recording WHICH letter,
   * is the `customer_link.issued` defect wearing a credential: it reads as
   * evidence and is a statement that somebody typed something. The digest binds
   * this record to one file, so a replaced PDF is detectable rather than
   * invisible.
   */
  evidence: { file: string; sha256: string; bytes: number };
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
/*
 * THE REGISTER IS THE ONE HOME OF A LICENCE NUMBER. Operator ruling,
 * 2026-09-16, and it is the FOURTH instance in a fortnight of one fact having
 * two homes.
 *
 * `peInResponsibleCharge()` used to read a `TBPELS_PE_LICENSE` environment
 * variable. That was harmless while no PE existed and became a live defect the
 * moment a real number entered this file, because a variable can differ between
 * a build and a deployment while this file cannot. It is the same defect the
 * 2026-09-10 ruling removed for the firm registration number, wearing a
 * different name.
 *
 * The variable is retired in src/config/credential-inventory.ts, the gate reads
 * this register, and compliance-audit refuses any source that reads the
 * variable again.
 */
export const verifiedEngineers: VerifiedEngineer[] = [
  {
    name: "Aman Dhakal",
    licenseNumber: "143295",
    /*
     * THE BRANCH ON THE LICENCE AND THE COMPETENCE HE WILL SEAL ARE DIFFERENT
     * FACTS, AND BOTH BELONG IN THE RECORD. Operator ruling, 2026-09-16.
     *
     * TBPELS grants a licence in a BRANCH, and his is Civil. Texas does not
     * restrict practice by branch; it restricts it by COMPETENCE, which is the
     * engineer's own judgement about what he is qualified to seal and is the
     * thing the Practice Act actually binds.
     *
     * He confirmed on 2026-09-16 that his focus, experience and expertise are
     * structural only. So `disciplines` records the branch the board granted,
     * and `sealsOnly` records what this firm will hold out and he will seal.
     * Recording only one of them would be wrong in both directions: the branch
     * alone overstates what he will take, and the competence alone loses what
     * the board's record says.
     */
    disciplines: ["Civil"],
    sealsOnly: ["structural"],
    /*
     * PENDING, AND DELIBERATELY NOT GUESSED. The operator is reading it off the
     * licence copy. Until it is recorded, `activeEngineer()` does not treat this
     * entry as a PE in responsible charge, so recording the number cannot
     * accidentally assert something nobody has verified.
     */
    expires: "2028-01-31",
    granted: "2021-12-09",
    status: "Active",
    /*
     * THE ROSTER ALREADY NAMES THIS FIRM AS ONE OF HIS EMPLOYERS, which is the
     * firm registration reflected on the engineer's own record rather than only
     * on the firm's. It is compliance evidence in the direction nobody usually
     * looks: the board's record of the PERSON agreeing with the board's record
     * of the FIRM.
     *
     * Recorded as the roster lists them, including the employer that is not this
     * firm, because an edited list is not what the roster says.
     */
    /*
     * RECORDED AS THE ROSTER PRINTS IT, CAPITALS AND ALL. Operator ruling,
     * 2026-09-22. The second employer is shown in capitals on the roster and was
     * previously written here in title case, which is a small edit to a record
     * this firm does not own. An edited list is not what the roster says, and
     * the place that rule is easiest to break is punctuation nobody thinks of as
     * content.
     */
    /*
     * THE BOARD CAUGHT UP, AND THE ACKNOWLEDGEMENT IS GONE RATHER THAN
     * EXTENDED. Operator re-read, 2026-09-24.
     *
     * The firm's line on Aman Dhakal's roster entry now reads 254 Engineering
     * LLC. The second employer is unchanged and is still recorded exactly as
     * the roster prints it, capitals and all, because an edited list is not
     * what the roster says.
     *
     * THE ACKNOWLEDGEMENT BLOCK IS DELETED, NOT MARKED CLOSED, and that is the
     * design working rather than tidiness. Its own injection test asserts that
     * making the roster agree turns the check into a plain PASS with the block
     * GONE ENTIRELY, which is what proves an acknowledgement cannot outlive
     * the thing it covers. Leaving a retired one behind with a note under it
     * would be the first step toward an exemption nobody revisits, which is
     * the failure the expiry date exists to prevent.
     *
     * It expired at the end of this very day. Had nobody re-read the roster,
     * compliance-audit would have gone FAIL from 2026-09-25 naming the date,
     * which is the mechanism doing exactly what it was built to do.
     */
    employersOnRoster: ["254 Engineering LLC", "WILLIAMS SCOTSMAN INC."],
    verified:
      "Read from the TBPELS roster on 2026-09-16 by the operator: DHAKAL, AMAN, PE# 143295, status " +
      "Active, branch Civil, granted 12-09-2021, expires 01-31-2028, employers 254 Services LLC and " +
      "WILLIAMS SCOTSMAN INC. He signed 254-RC-001 v1.0 on 2026-09-14 as Engineer of Record, and " +
      "confirmed on 2026-09-16 that his focus, experience and expertise are structural only. " +
      "RE-READ 2026-09-22 by the operator, after the reissuance: the entry is unchanged and still " +
      "names 254 Services LLC. RE-READ AGAIN 2026-09-24 by the operator: the firm's line now reads " +
      "254 Engineering LLC, so the board's record of the PERSON agrees with its record of the FIRM " +
      "and the acknowledgement that covered the gap is retired. Nothing here can read the roster; " +
      "this is what a person read, on a date, and said.",
  },
];

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
    /*
     * REISSUED IN THE NEW NAME, 2026-09-21. This was "254 Services LLC" from
     * 2026-09-10 until the Board's verification letter of 2026-09-21, and the
     * whole compliance gate turned on that string: `firmName()` reads it, so
     * every rendered sentence naming the firm moved with this one line.
     */
    issuedTo: "254 Engineering LLC",
    /* Verbatim from the letter, in its order, semicolon separated there. */
    dbas: ["Sealed Engineering", "Stamp My Plans", "254 Engineering Services"],
    mailingAddress: "5601 SOUTH PADRE ISLAND DRIVE, SUITE E, CORPUS CHRISTI, TX 78412",
    initialRegistrationDate: "2026-09-10",
    status: "active",
    expires: "2027-07-31",
    verifiedOn: "2026-09-21",
    verifiedBy: "Jessica Nassour, Licensing Specialist",
    evidence: {
      file: "docs/compliance/F-29811 - 254 Engineering LLC.pdf",
      sha256: "962eaffd371ae69c65113cf65e26322a97be524b715926a2dfebe2bdddfc8d99",
      bytes: 709917,
    },
    verified:
      "Initially registered 2026-09-10. REISSUED in the name 254 Engineering LLC and verified on " +
      "2026-09-21 by Jessica Nassour, Licensing Specialist, on the Board's own Verification of Texas " +
      "Engineering Firm Registration letter, which is in the compliance file at the path in " +
      "`evidence` and is the Board's original PDF rather than a photograph of one. The letter records " +
      "three assumed names, no branch offices on file, and authority to provide Professional " +
      "Engineering services in Texas until 2027-07-31. Read field by field against what this record " +
      "already held: only `issuedTo` disagreed, which is the reissuance itself. The initial " +
      "registration date, the number, the board, the status and the expiry all agreed and always had.",
  },
];

/**
 * DOES THE BOARD HOLD THE NAME THIS FIRM TRADES UNDER?
 *
 * Operator ruling, 2026-09-10, and it is a named condition of the compliance
 * gate rather than a note.
 *
 * F-29811 was issued to **254 Services LLC**. Every one of the three sites
 * holds out as **254 Engineering Services**, and business.legalName said
 * "254 Engineering Services LLC" when this was written. Those were not the
 * same entity name.
 *
 * **THE SENTENCE ABOVE WAS STALE AND IS CORRECTED RATHER THAN DELETED.**
 * Found 2026-09-21 while reading the register against the Board's reissuance
 * letter. `business.legalName` had already been changed to "254 Services LLC"
 * at some point after this paragraph was written, and the paragraph went on
 * describing the value it used to hold. Three different strings have been the
 * legal name in this repository's history: 254 Engineering Services LLC, then
 * 254 Services LLC, and from 2026-09-21 the Board's own 254 Engineering LLC.
 *
 * It is an instance of the rule in CLAUDE.md section 6b: a recorded
 * explanation is a hypothesis until something re-checks it, and a wrong one is
 * worse than none because it makes the next session stop looking. Nothing
 * compared this comment to `business.ts`, so it decayed silently. The check
 * added in the same commit compares the two NAMES mechanically, which is the
 * only version of this that cannot rot.
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
  /*
   * MOVED TOGETHER 2026-09-21, AND THIS IS THE THIRD PAIR OF VALUES THIS
   * RECORD HAS HELD. Operator ruling.
   *
   * They agreed at 254 Services LLC from 2026-09-13. The Secretary of State
   * amendment made the ENTITY 254 Engineering LLC on 2026-09-16 while TBPELS
   * still held the old name, and that divergence was deliberately NOT recorded
   * here: `business.legalName` was left stale on purpose, true against the
   * board and stale against the state, because the gate's condition is the
   * board's record. TBPELS reissued on 2026-09-21 and both now read
   * 254 Engineering LLC.
   *
   * THEY ARE TWO FACTS THAT COINCIDE, NOT ONE FACT WITH TWO HOMES, and that is
   * why neither derives from the other. Two agencies keep two records. They
   * have already differed once, for five days, and a deriver would have made
   * that state unrepresentable rather than visible. What the audit enforces is
   * that they AGREE or that the difference is written down with both names, so
   * a silent drift is impossible and a real divergence is expressible.
   */
  resolved: true,
  legalNameOnSite: "254 Engineering LLC",
  registrantOnRecord: "254 Engineering LLC",
  because:
    "ANSWERED 2026-09-13 by the operator, who holds the formation documents: the entity was 254 Services " +
    "LLC, and business.legalName was wrong. It had said 254 Engineering Services LLC since it was written " +
    "and no such entity existed. " +
    "MOVED AGAIN 2026-09-21, and this time by a filing rather than a correction. The Secretary of State " +
    "amendment of 2026-09-16, file number 806765419, made the entity 254 Engineering LLC, and TBPELS " +
    "reissued F-29811 in that name on 2026-09-21 per the Board's verification letter, verified by " +
    "Jessica Nassour, Licensing Specialist. Both records now read 254 Engineering LLC, so the two agree " +
    "again for a different reason than they agreed before. " +
    "254 Engineering Services survives as the brand wordmark and logo, is never the legal or firm name " +
    "in a sentence, and is now ALSO held by the Board as an assumed name on F-29811.",
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

/**
 * ===========================================================================
 * THE FIRM'S INSURANCE, WHICH THIS REPOSITORY HELD NOWHERE UNTIL 2026-09-24.
 * ===========================================================================
 *
 * CHECKED RATHER THAN ASSUMED BEFORE IT WAS WRITTEN: every match for
 * "insurance" under `src/config` and `src/lib` was a TECHNICIAN's own cover in
 * `ops-credentials.ts`, a form field, or an email template. The FIRM's policy
 * appeared nowhere at all, so nothing could ask about it and nothing did.
 *
 * IT MIRRORS `verifiedFirmRegistrations` DELIBERATELY. That record already
 * solves this exact problem for a credential the firm holds from an outside
 * body: a dated entry, the issuer named, an expiry, and a status, with a
 * deriver that refuses anything stale. Inventing a different shape for the same
 * kind of fact would mean two ways of recording "the firm holds a thing that
 * lapses".
 *
 * `expires` HAS NO NULL, AND THAT IS THE 2026-09-16 RULING. An engineer's
 * licence with no recorded expiry was treated as current, and the operator
 * ruled that an unknown is a different state from current: for a condition
 * gating whether the firm may take money, the unknown answer is the shut one.
 * A policy whose expiry nobody has read is therefore not recordable here, which
 * is the point.
 *
 * WHAT IS NOT ASSERTED. Whether TBPELS REQUIRES professional liability cover
 * for a registered firm is not established anywhere in this repository and is
 * not inferred here. It must be confirmed with the board or with counsel before
 * any sentence relies on it. Until then this condition is a business decision
 * the operator has made, not a regulatory one, and the distinction is recorded
 * so nobody later reads it as the second.
 */
export type VerifiedInsurance = {
  /** What the policy covers, in the words the industry uses. */
  kind: "professional-liability" | "general-liability";
  /** The carrier exactly as the certificate names it. */
  carrier: string;
  /** The policy number exactly as the certificate prints it. */
  policyNumber: string;
  /** Per claim and aggregate, in cents, so no figure is a rounded story. */
  limitPerClaimCents: number;
  limitAggregateCents: number;
  /** ISO dates. `expires` is never null: see the header. */
  effective: string;
  expires: string;
  status: "active" | "lapsed";
  /**
   * WHO READ THE CERTIFICATE, AND WHEN. Nothing here can see a carrier's
   * system, so this record is somebody's reading of a document, and it says so
   * rather than presenting itself as a fact the platform verified. It is the
   * same idiom as the Stripe console record and the Vercel inventory.
   */
  evidence: {
    seenBy: string;
    seenOn: string;
    /** Where the certificate lives, so a reader can go and look. */
    document: string;
  };
};

/**
 * EMPTY, AND THE EMPTINESS IS THE CURRENT ANSWER.
 *
 * No certificate has been recorded, so `activeInsurance()` returns null and the
 * `insurance` condition holds the gate shut. That is the intended state: the
 * firm does not take money for sealed engineering work uninsured, and the way
 * this repository says "nobody has checked" is an empty register rather than a
 * default that reads as satisfied.
 */
export const verifiedInsurance: VerifiedInsurance[] = [];

/**
 * ===========================================================================
 * OPERATING WITHOUT PROFESSIONAL LIABILITY COVER, BY OWNER DECISION, WITH A DATE
 * ===========================================================================
 *
 * Operator ruling, 2026-09-28, in his words: an owner override, not a record of
 * a policy.
 *
 * IT IS NOT AN INSURANCE RECORD AND MUST NEVER BE READ AS ONE. `verifiedInsurance`
 * stays EMPTY, and `activeInsurance()` goes on returning null, because there is
 * no cover. Writing a fake entry there to open the gate would put a policy on the
 * firm's own record that does not exist, which is the fabricated-assurance defect
 * this repository refuses everywhere else. What this does is let the OPERATOR
 * decide to trade anyway, in his own name, with an expiry.
 *
 * WHAT IS BEING ACCEPTED, STATED PLAINLY BECAUSE AN ACKNOWLEDGEMENT THAT SOFTENS
 * ITS OWN SUBJECT IS WORTH NOTHING. The firm takes money for work that will carry
 * a Professional Engineer's seal while carrying no professional liability cover.
 * The condition's own sentence says so.
 *
 * IT IS A COMMERCIAL EXPOSURE AND NOT A REGULATORY ONE. Operator ruling, Robert
 * Reyna, 2026-09-28: Texas does not require professional liability insurance for
 * a registered engineering firm, and carrying it is a business choice.
 *
 * That closes the question `BACKLOG.md` had carried as never verified, and it
 * narrows what this override covers to one thing rather than two. Recorded as HIS
 * RULING with his name and the date, which is not the same as verified against
 * the board or counsel, and the distinction is kept deliberately: this repository
 * has already been bitten by a claim written to serve an argument being read
 * later as an observation.
 *
 * THE EXPIRY IS THE ONLY THING THAT MAKES IT SAFE, which is the rule the 2026-09-22
 * ACKNOWLEDGED ruling already states: a third verdict that never expires is an
 * exemption. From the day after `expires` this stops satisfying the condition and
 * the gate shuts again, with no edit by anybody and no deploy required to make it
 * true, because the comparison is against the firm's calendar rather than a build
 * timestamp.
 *
 * IT ENDS EARLY THE MOMENT A REAL POLICY IS RECORDED. `insuranceStandsOn()` reads
 * the register FIRST, so recording cover in `verifiedInsurance` retires this
 * override without anybody having to remember to delete it.
 */
export type InsuranceOverride = {
  acknowledgedBy: string;
  acknowledgedOn: string;
  /** The day after which it stops working. A calendar date, never a duration. */
  expires: string;
  reason: string;
};

export const insuranceOverride: InsuranceOverride | null = {
  acknowledgedBy: "Robert Reyna, owner",
  acknowledgedOn: "2026-09-28",
  expires: "2026-10-28",
  reason: "no policy yet; not required by TBPELS; owner accepts the commercial risk",
};

/**
 * ===========================================================================
 * A TECHNICIAN TRAINED ON A PROTOCOL, AT A VERSION.
 * ===========================================================================
 *
 * THE VERSION IS THE PART THAT MATTERS AND IS EASIEST TO LEAVE OUT. 254-RC-001
 * is at v1.1 and was at v1.0 nine days earlier. Somebody trained on v1.0 is not
 * thereby trained on v1.1, and a record without a version reads as current for
 * ever, which is the same defect as a credential with no expiry.
 *
 * WHY IT IS HERE AND NOT IN THE DATABASE. Launch conditions are read from
 * CONFIGURATION by design, because the gate runs during `next build` and a
 * condition answered by a table would be answered by whatever that table said
 * at build time, with no record of what it said. So this is an ATTESTATION:
 * somebody trained somebody and wrote it down.
 *
 * AND AN ATTESTATION ALONE GOES STALE SILENTLY, which is why the design this
 * comes from pairs it with a check comparing the attested set against the
 * technicians and offered lines the database actually holds. That check needs a
 * database and is therefore not a gate condition; it is the second layer, in
 * the same shape as the protocol register's two layers.
 */
export type TechnicianTraining = {
  /** The technician, as their profile records them. */
  technician: string;
  /** The protocol document number, for example 254-RC-001. */
  protocolDocument: string;
  /**
   * The version MATCHED ON, which is the integer the approved protocol register
   * carries and the row keys on. Training on version 1 is not training on
   * version 2.
   */
  protocolVersion: number;
  /**
   * The same version as the signed document states it, for example "1.1".
   *
   * FOR A READER, NOT FOR THE MATCH. The integer above is what the register and
   * the database row agree on; this is what the document is headed and what
   * anybody would say out loud. Both are held for the reason the approved
   * protocol register holds both: a record that can only say "version 2" about
   * a document headed v1.1 makes somebody choose the nearest lie.
   */
  protocolVersionLabel: string;
  /** The service line that protocol governs. Matches a slug in services.ts. */
  serviceSlug: string;
  /** ISO date the training was completed. */
  trainedOn: string;
  /** Who delivered it. The engineer of record, or somebody he named. */
  trainedBy: string;
  evidence: {
    seenBy: string;
    seenOn: string;
    document: string;
  };
};

/**
 * ONE ENTRY, RECORDED 2026-09-24 ON THE OPERATOR'S ATTESTATION.
 *
 * It was empty, and the sentence that stood here said that shut the gate:
 * 254-RC-001 v1.1 was approved and nobody was recorded as trained on it.
 *
 * WHAT THE OPERATOR ATTESTED, 2026-09-24, Robert Reyna: the technician training
 * and the supervised inspection with the engineer of record are complete.
 *
 * THE EVIDENCE IS AN ATTESTATION AND IS RECORDED AS ONE, which is the same
 * treatment the Stripe account status already gets. The engineer's written
 * confirmation is PENDING and, on the operator's ruling, is NOT required to
 * retire the condition. When it arrives it becomes the evidence and this entry
 * is updated to name it. An attestation dressed up as a document read would be
 * the failure this register exists to prevent; an attestation recorded as an
 * attestation is a fact with a name and a date on it.
 *
 * THE TECHNICIAN IS THE OPERATOR HIMSELF, and that is worth a line rather than
 * a raised eyebrow. A single operator firm training on its own first protocol
 * is the ordinary case at this size, and the record says who did what rather
 * than implying a roster that does not exist. The engineer of record delivered
 * it and supervised the inspection, which is the part that could not be
 * self-attested.
 *
 * THE VERSION INTEGER IS THE MATCH AND IT IS 2. `linesWithNobodyTrained()`
 * compares `t.protocolVersion === p.version` against the approved protocol
 * register, which carries version 2 for versionLabel "1.1". Recording the label
 * alone would leave the condition unmet against a document everybody calls
 * v1.1, which is the nearest-lie shape this pair of fields exists to prevent.
 */
export const verifiedTechnicianTraining: TechnicianTraining[] = [
  {
    technician: "Robert Reyna",
    protocolDocument: "254-RC-001",
    protocolVersion: 2,
    protocolVersionLabel: "1.1",
    serviceSlug: "roof-inspections",
    trainedOn: "2026-09-23",
    trainedBy: "Aman Dhakal, PE 143295",
    evidence: {
      seenBy: "Robert Reyna, operator",
      seenOn: "2026-09-24",
      document:
        "Operator attestation, not a document read. The training and the supervised inspection with " +
        "the engineer of record were completed on 2026-09-23 and the operator states so on 2026-09-24. " +
        "The engineer's written confirmation is pending; the operator ruled it is not required to " +
        "retire this condition, and it replaces this line when it arrives.",
    },
  },
];

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
  /*
   * CLOSED 2026-09-21 BY THE BOARD'S OWN REISSUANCE, WHICH IS WHAT THE ENTRY
   * ABOVE SAID WOULD CLOSE IT. Operator ruling.
   *
   * It said: "It closes when the board reissues the registration in the new
   * name." TBPELS did, and the evidence is the Board's Verification of Texas
   * Engineering Firm Registration letter, verified 2026-09-21 by Jessica
   * Nassour, Licensing Specialist. The letter is in the compliance file and its
   * digest is recorded on the registration above.
   *
   * IT CLOSES TWICE OVER, AND THE SECOND WAY IS THE STRONGER ONE. The entity
   * name and the registrant name are now the same string, 254 Engineering LLC,
   * so the 2026-09-13 reason, that the firm trades under its registered name,
   * is true again rather than merely arguable. AND the Board separately holds
   * 254 Engineering Services as an assumed name, which is the other trigger
   * this condition always named: "either the entity is renamed, or an assumed
   * name is filed and recorded with the board." Both happened.
   *
   * THE BRAND IS NOW ON THE BOARD'S RECORD, and that is the part with the
   * longest reach. Until today, printing F-29811 beside "254 Engineering
   * Services" would have asserted something the Board's record did not say.
   * The Board now says it. That does not open the gate on its own, and nothing
   * in this file decides what the copy does with it; whether a registered DBA
   * is ever stated on a page is a copy ruling nobody has made.
   *
   * SET FROM THE LETTER RATHER THAN FROM A DATE OR FROM ANYBODY'S WORD, on the
   * same rule that set it false: a compliance state that flips without a
   * deliberate edit and an audit trail is refused here.
   */
  onRecord: true,
  because:
    "CLOSED 2026-09-21. TBPELS reissued F-29811 in the name 254 Engineering LLC, evidenced by the " +
    "Board's Verification of Texas Engineering Firm Registration letter, verified 2026-09-21 by " +
    "Jessica Nassour, Licensing Specialist, held at " +
    "docs/compliance/F-29811 - 254 Engineering LLC.pdf with its digest recorded on the registration. " +
    "The board now holds the name the firm operates under, by both of the routes this condition " +
    "named: the entity was renamed AND 254 Engineering Services is recorded with the board as an " +
    "assumed name, alongside Sealed Engineering and Stamp My Plans. The three names that were three " +
    "different facts are now two: the board and the state both hold 254 Engineering LLC, and " +
    "254 Engineering Services is a brand the board ALSO holds as a DBA rather than a name with no " +
    "record behind it. It had been reopened 2026-09-15 by the Secretary of State amendment, file " +
    "number 806765419, effective 2026-09-16, on the reason that the board did not yet hold the " +
    "operating name. That reason no longer holds.",
};

/**
 * ============================================================================
 * EVERY OTHER CREDENTIAL THIS FIRM MIGHT CLAIM, HELD OR NOT.
 * ============================================================================
 *
 * Operator ruling, 2026-09-17, after the SAM finding. The TBPELS registration
 * and the PE licence have registers above. Everything else a firm can claim, a
 * federal registration, a small business certification, a TDI appointment, had
 * no register at all, so each one was a boolean or a sentence sitting in the
 * component that rendered it.
 *
 * THE RULE THIS FILE NOW CARRIES, AND IT IS THE GENERAL ONE: nothing on this
 * site asserts a registration, a certification or an appointment unless this
 * register holds it, with a date somebody checked it and a reference a reader
 * could check it against. `compliance-audit` enforces it by scanning the source
 * rather than by trusting this comment.
 *
 * "IN PROGRESS" IS A CLAIM AND GETS THE SAME TREATMENT. That is the half a
 * careless reading loses. The SAM defect was not only that the site said
 * "registered"; it was that the false branch of the same boolean said
 * "registration in progress", which asserts that a registration has been
 * STARTED. Turning the claim off would have replaced one untrue sentence with
 * another. So `held: false` renders NOTHING, and there is deliberately no
 * "pending" state for anything in this register: a firm either holds a
 * credential or says nothing about it.
 *
 * A DISCLAIMER ABOUT A CERTIFICATION YOU HAVE NOT APPLIED FOR STILL IMPLIES YOU
 * APPLIED. Operator ruling, same day, on the SDVOSB line. `/government` carried
 * "certification is pending" followed by a careful sentence saying the firm does
 * not represent itself as an SDVOSB for set aside purposes. The second sentence
 * is honest and the pair is still a claim, because nobody writes a disclaimer
 * about a status they have no relationship with. Both halves came out.
 *
 * WHEN ONE BECOMES REAL, IT COMES BACK FROM HERE. Operator ruling: on
 * re-registration under 254 Engineering LLC after TBPELS reissues, a credential
 * returns by being recorded in this array and rendering from it. Never as a
 * hand placed badge, an image, or a literal in a component. That is how the
 * first one got onto the site.
 */
export type HeldCredential = {
  /** The credential as a reader would name it. */
  name: string;
  /** The body that issues it. */
  issuer: string;
  /**
   * Whether the firm HOLDS it today. Nothing renders unless this is true, and
   * there is no third state: not held means the site is silent, never "pending"
   * and never "in progress".
   */
  held: boolean;
  /** The identifier exactly as the issuer prints it. Null when not held. */
  identifier: string | null;
  /** ISO date somebody checked this against the issuer's own record. */
  verifiedOn: string;
  /** Where a reader could check it themselves. Null when not held. */
  reference: string | null;
  /** Who checked, what they saw, and what would change it. Never empty. */
  verified: string;
};

/**
 * THE KEY THE WINDSTORM DISCLOSURE LOOKS THIS CREDENTIAL UP BY.
 *
 * A constant rather than a literal typed in two places, which is the only
 * reason it exists. `windstormAppointmentStatement()` in src/lib/launch.ts
 * derives the rendered sentence from the entry below, and a lookup keyed on a
 * string typed at both ends is a fact with two homes: renaming the entry would
 * silently make the lookup miss, and a MISS here renders as the shut sentence,
 * which is the failure nobody would see. Reading it from one binding means a
 * rename is a type error at the other end instead.
 */
export const WINDSTORM_APPOINTMENT_CREDENTIAL = "TDI windstorm inspector appointment";

export const verifiedCredentials: HeldCredential[] = [
  {
    name: WINDSTORM_APPOINTMENT_CREDENTIAL,
    issuer: "Texas Department of Insurance",
    /*
     * NOT HELD, AND IT IS RECORDED HERE BECAUSE THE RULING NAMES IT. The
     * windstorm pages already disclose the absence, which they must: a WPI-8 on
     * ongoing construction is inspected by a TDI appointed engineer, so a
     * reader on that page is entitled to know before they enquire.
     *
     * The disclosure is the NEGATIVE form and `compliance-audit` asserts it
     * stays negative, rather than banning the phrase outright. Banning it would
     * delete a disclosure the reader needs; asserting the shape means flipping
     * it into a claim turns the board red.
     */
    held: false,
    identifier: null,
    verifiedOn: "2026-09-17",
    reference: null,
    verified:
      "No engineer at this firm holds a Texas Department of Insurance windstorm inspector " +
      "appointment as of 2026-09-17. The windstorm pages state the absence plainly. This becomes a " +
      "held credential only when an appointed engineer is on the roster and the appointment number " +
      "is recorded here from TDI's own record.",
  },
  {
    name: "SAM.gov registration",
    issuer: "System for Award Management, U.S. General Services Administration",
    /*
     * NOT REGISTERED, AND REGISTRATION HAS NOT BEEN STARTED. Operator
     * statement, 2026-09-17: "The firm is not registered and registration has
     * not been started, so neither registered nor in progress is true."
     *
     * WHAT WAS ON THE SITE UNTIL THIS RULING, because a defect that vanishes
     * without a trace is one the next session re-makes. `samRegistration.registered`
     * was true and rendered in SIX places: a footer badge on every page, a
     * homepage capability tile, the homepage credibility strip, the /government
     * registrations row, and the SAM line in llms-full.txt, which is published
     * for machines to read. Two further rows offered a contracting officer the
     * firm's UEI and CAGE code "on request", identifiers that do not exist.
     *
     * The declaration that carried it said of itself, in writing, that it was
     * asserted on the operator's instruction and had never been checked, and
     * that a procurement officer could refute it in fifteen seconds. It sat on
     * the one page written for the readers most able to check it.
     */
    held: false,
    identifier: null,
    verifiedOn: "2026-09-17",
    reference: null,
    verified:
      "The operator stated on 2026-09-17 that 254 has never been registered in SAM and that no " +
      "registration has been started. Nothing renders. This becomes a held credential only when the " +
      "firm is actually registered, which is expected to be under 254 Engineering LLC after TBPELS " +
      "reissues F-29811, and when the UEI and CAGE code are recorded here from the SAM record itself.",
  },
];

/** The credentials that may be rendered: held, identified, and referenced. */
export function heldCredentials(): HeldCredential[] {
  return verifiedCredentials.filter(
    (c) => c.held && c.identifier !== null && c.reference !== null,
  );
}

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
