/**
 * APPENDIX A OF 254-RC-001 v1.0, AS DATA. THE DOCUMENT IS THE AUTHORITY.
 *
 * Source: docs/254-RC-001-roof-certification-protocol-v1.0.pdf, signed by Aman
 * Dhakal, P.E., Engineer of Record, 09/14/2026.
 * sha256 f6d3ca925ddcb305292895c47249199ce86977644d3323d8a0d8ccc017803ba9
 *
 * WHAT THIS FILE IS, AND WHAT IT MAY NEVER BECOME. It is a transcription of a
 * signed document, not an interpretation of one. Every `ask` below is the
 * document's own wording, and `at` says where in the document it lives, so the
 * mapping can be proved in BOTH directions:
 *
 *   Anything in the portal that is not in the document is a defect.
 *   Anything in the document the portal silently drops is a worse defect.
 *
 * `protocol-registry-audit` proves that against this declaration and against
 * the text of the PDF itself, rather than against a list somebody typed twice.
 *
 * NOTHING HERE IS INVENTED, NORMALISED OR TIDIED. Where the document is
 * ambiguous it is transcribed ambiguous and the ambiguity is raised with the
 * engineer, because the engineer signed those words. See `AMBIGUITIES` at the
 * foot of this file: they are questions for him, not decisions for us.
 */

/** Which part of Appendix A Part 1 a question sits under, as the document groups them. */
export type IntakeGroup =
  | "purpose-and-recipient"
  | "property-basics"
  | "flags"
  | "access-and-safety"
  | "prior-paperwork";

export type IntakeQuestion = {
  /** The document's own number, 1 to 16. */
  number: number;
  group: IntakeGroup;
  /** The question exactly as the document asks it. Never reworded. */
  ask: string;
  /**
   * A YES here routes the job to the engineer BEFORE dispatch, per section 6
   * and the Appendix A heading over questions 8 to 12.
   */
  flag: boolean;
  /**
   * Recorded VERBATIM rather than normalised into a dropdown, where the
   * document requires it. Section 6: "The engineer records the purpose of the
   * letter and the recipient exactly as given at intake."
   */
  verbatim: boolean;
  /** Where this lives in the signed document. */
  at: string;
};

export const RC001_INTAKE_QUESTIONS: IntakeQuestion[] = [
  {
    number: 1,
    group: "purpose-and-recipient",
    ask: "What is the letter for? (insurance binding/renewal / home sale / lender / permit / other -- record exactly)",
    flag: false,
    /*
     * VERBATIM BY TWO INSTRUCTIONS AT ONCE: the question's own "record exactly",
     * and section 6's requirement that the purpose is recorded exactly as given.
     * A dropdown here would destroy the fact the letter is addressed for.
     */
    verbatim: true,
    at: "Appendix A, Part 1, question 1",
  },
  {
    number: 2,
    group: "purpose-and-recipient",
    ask: "Who will the letter be addressed to? (insurer name, buyer, lender, city)",
    flag: false,
    verbatim: true,
    at: "Appendix A, Part 1, question 2",
  },
  {
    number: 3,
    group: "purpose-and-recipient",
    ask: "What deadline is the customer working against, if any?",
    flag: false,
    verbatim: false,
    at: "Appendix A, Part 1, question 3",
  },
  {
    number: 4,
    group: "property-basics",
    ask: "Property address and county",
    flag: false,
    verbatim: false,
    at: "Appendix A, Part 1, question 4",
  },
  {
    number: 5,
    group: "property-basics",
    ask: "Property type (single family / duplex / townhome / small commercial) and number of stories",
    flag: false,
    verbatim: false,
    at: "Appendix A, Part 1, question 5",
  },
  {
    number: 6,
    group: "property-basics",
    ask: "Year built; roof age if known; year of last full replacement",
    flag: false,
    verbatim: false,
    at: "Appendix A, Part 1, question 6",
  },
  {
    number: 7,
    group: "property-basics",
    ask: "Covering type (shingle / metal / tile / flat-membrane / built-up / wood / other)",
    flag: false,
    verbatim: false,
    at: "Appendix A, Part 1, question 7",
  },

  /*
   * QUESTIONS 8 TO 12 ARE THE FLAGS. The document's own heading over them:
   * "Flags -- a YES on any of these routes to engineer review BEFORE dispatch".
   * That is a RULE and not a question, so it is enforced rather than displayed.
   */
  {
    number: 8,
    group: "flags",
    ask: "Is there an OPEN insurance claim on this roof? (open claim = engineer pre-review; potential forensic line instead)",
    flag: true,
    verbatim: false,
    at: "Appendix A, Part 1, question 8",
  },
  {
    number: 9,
    group: "flags",
    ask: "Is there active or threatened litigation involving the roof? (route to engineer; likely decline or forensic line)",
    flag: true,
    verbatim: false,
    at: "Appendix A, Part 1, question 9",
  },
  {
    number: 10,
    group: "flags",
    ask: "Any active leaks right now? (changes scope from certification to assessment conversation)",
    flag: true,
    verbatim: false,
    at: "Appendix A, Part 1, question 10",
  },
  {
    number: 11,
    group: "flags",
    ask: "Has another engineer or inspector already issued an adverse report? (must be disclosed and uploaded)",
    flag: true,
    verbatim: false,
    at: "Appendix A, Part 1, question 11",
  },
  {
    number: 12,
    group: "flags",
    ask: "Storm damage within the last 12 months? Date and type (hail/wind)",
    flag: true,
    verbatim: false,
    at: "Appendix A, Part 1, question 12",
  },

  {
    number: 13,
    group: "access-and-safety",
    ask: "Is attic access available and accessible?",
    flag: false,
    verbatim: false,
    at: "Appendix A, Part 1, question 13",
  },
  {
    number: 14,
    group: "access-and-safety",
    ask: "Number of Stories and Roof Steepness?",
    flag: false,
    verbatim: false,
    at: "Appendix A, Part 1, question 14",
  },
  {
    number: 15,
    group: "access-and-safety",
    ask: "Occupied or vacant? Accessible if occupied?",
    flag: false,
    verbatim: false,
    at: "Appendix A, Part 1, question 15",
  },
  {
    number: 16,
    group: "prior-paperwork",
    ask: "Do you have: prior roof certs, roofing invoices/warranty, permits, insurance letters, photos of any problems?",
    flag: false,
    verbatim: false,
    at: "Appendix A, Part 1, question 16",
  },
];

/**
 * Appendix A Part 2. The document's three tiers, kept as three rather than
 * flattened into "required" and "optional", because the middle one is
 * conditional on a FACT rather than on somebody's judgement.
 */
export type UploadTier =
  /** "Required". A job is not dispatched without it. */
  | "required"
  /** "Required if it exists". Required once the condition is true. */
  | "required-if-exists"
  /** "Collect when applicable". */
  | "when-applicable";

export type IntakeUpload = {
  key: string;
  /** The document's own wording. */
  what: string;
  tier: UploadTier;
  /** The condition the document states, where it states one. */
  when: string | null;
  at: string;
};

export const RC001_INTAKE_UPLOADS: IntakeUpload[] = [
  {
    key: "front-of-property",
    what: "Photo of the front of the property (confirms address/structure)",
    tier: "required",
    when: null,
    at: "Appendix A, Part 2, Required",
  },
  {
    key: "adverse-report",
    what: "Any adverse report, prior engineer letter, or insurer letter driving this request",
    tier: "required-if-exists",
    /*
     * Question 11 asks whether an adverse report exists and says it "must be
     * disclosed and uploaded". So a yes on 11 makes this upload REQUIRED, which
     * is why the tier is conditional rather than optional.
     */
    when: "An adverse report, prior engineer letter or insurer letter exists. Question 11 requires it to be disclosed and uploaded.",
    at: "Appendix A, Part 2, Required if it exists",
  },
  {
    key: "roofing-contract",
    what: "Roofing contract/invoice/warranty for the most recent roof work",
    tier: "when-applicable",
    when: "if work claimed",
    at: "Appendix A, Part 2, Collect when applicable",
  },
  {
    key: "permits-hoa",
    what: "Permits for roof work; HOA approval if applicable",
    tier: "when-applicable",
    when: "if applicable",
    at: "Appendix A, Part 2, Collect when applicable",
  },
  {
    key: "customer-photos",
    what: "Customer's own photos of problem areas",
    tier: "when-applicable",
    when: "if a leak or damage prompted the call",
    at: "Appendix A, Part 2, Collect when applicable",
  },
  {
    key: "prior-inspection-report",
    what: "Prior roof inspection report",
    tier: "when-applicable",
    when: "if one exists",
    at: "Appendix A, Part 2, Collect when applicable",
  },
];
