/**
 * ===========================================================================
 * THE EMPLOYMENT RULES THIS FIRM IS SUBJECT TO, EACH CITED TO ITS SOURCE.
 * ===========================================================================
 *
 * Part C item 5, from `docs/audits/hr-lifecycle-2026-10-02.md`. Part B7 of that
 * report says what this file has to be and why the report could not be it:
 *
 *   "The operator's requirement is that the rules live in a file an audit reads.
 *    This is a report; an audit cannot act on it."
 *
 * So this is the declaration, in the shape `credential-inventory.ts` and
 * `stripe-console.ts` already use: one entry per rule, the rule itself, the
 * citation, when it was last checked against the source, who checked it, and
 * whether that citation is VERIFIED.
 *
 * ===========================================================================
 * NOTHING HERE IS VERIFIED, AND THAT IS THE MOST IMPORTANT FIELD IN THE FILE.
 * ===========================================================================
 *
 * Every citation below was written by reading the law as best I could and every
 * one carries a VERIFY in the Part B report. None has been checked against the
 * statute by a person. `verified` is therefore `false` on all seven, and the
 * proof beside this file ASSERTS THE COUNT, so the day one becomes true it is a
 * deliberate edit by somebody who looked it up rather than a flag that drifted.
 *
 * THE DANGER THIS FILE CREATES IF THAT FIELD IS IGNORED. A rule in a file an
 * audit reads looks settled. A check that enforced "overtime at 1.5 times over
 * 40 hours, per 29 U.S.C. 207(a)" would be asserting a legal conclusion nobody
 * confirmed, in the firm's own records, which is the fabricated-assurance
 * failure this repository already rules on for sealed work. So an UNVERIFIED
 * rule is enforceable as a REMINDER and never as a conclusion: the proof checks
 * that the declaration is complete and honest, not that the firm complies.
 *
 * WHAT THE FIRM ACTUALLY RELIES ON TODAY. Gusto runs payroll and contractor
 * payments and holds the SSN, EIN, bank details, W-9, W-4, I-9 and every tax
 * filing, by the operator's ruling of 2026-10-01. Several rules below are
 * therefore satisfied by Gusto rather than by this platform, and the entry says
 * which, because "we comply" and "our payroll provider complies" are different
 * sentences and only one of them is this repository's to make.
 */

/** Who or what actually discharges the obligation. */
export type HrRuleOwner =
  /** This platform has to do something, or refrain from something. */
  | "platform"
  /** Gusto discharges it, and the platform's job is to not duplicate the data. */
  | "gusto"
  /** A person does it off-platform. Recorded so it is not mistaken for built. */
  | "operator";

export type HrRule = {
  /** Stable key. The lifecycle steps below name these. */
  key: string;
  /** The obligation, in one sentence, as a person would state it. */
  rule: string;
  /** The statute, regulation or ruling it comes from. */
  source: string;
  /**
   * Whether somebody has checked that citation against the source itself.
   *
   * FALSE ON EVERY ENTRY TODAY. See the header: these were written from a
   * reading and every one carries a VERIFY in the Part B report.
   */
  verified: false | { on: string; by: string };
  /** What is uncertain, where it is. Empty only when `verified` is an object. */
  uncertain: string;
  owner: HrRuleOwner;
};

export const HR_RULES: HrRule[] = [
  {
    key: "protected-characteristics",
    rule: "An application asks for no date of birth, age, race, religion, national origin, sex, disability, or marital status.",
    source:
      "Title VII of the Civil Rights Act of 1964, the Age Discrimination in Employment Act, the Americans with Disabilities Act, and the Texas Labor Code.",
    verified: false,
    uncertain:
      "These are cited as the statutes that make these characteristics protected. The specific sections have not been read against the application form by a person.",
    owner: "platform",
  },
  {
    key: "criminal-history-after-offer",
    rule: "Criminal history is asked only after a conditional offer, and a consumer report requires disclosure, authorization, and a pre adverse action notice with a copy of the report.",
    source: "The FCRA at 15 U.S.C. 1681 and following, for the consumer report mechanics.",
    verified: false,
    uncertain:
      "The 'after a conditional offer' sequencing is a ban the FCRA itself does not impose. Whether it binds this firm in Texas is unresolved.",
    owner: "operator",
  },
  {
    key: "overtime",
    rule: "A non exempt employee is paid 1.5 times the regular rate over 40 hours in a week.",
    source: "The Fair Labor Standards Act, 29 U.S.C. 207(a).",
    verified: false,
    uncertain:
      "The federal minimum wage figure and the current salary threshold for exemption. Also note this binds EMPLOYEES: technicians are 1099 contractors by the ruling of 2026-10-01, so it does not reach most of the firm.",
    owner: "gusto",
  },
  {
    key: "payday-frequency",
    rule: "A non exempt employee is paid at least semimonthly.",
    source: "The Texas Payday Law, Texas Labor Code Chapter 61, section 61.011.",
    verified: false,
    uncertain: "Whether 61.011 is the provision that sets paydays.",
    owner: "gusto",
  },
  {
    key: "retention",
    rule: "Applications are kept one year. Payroll records three years. I-9 dates three years from hire or one year from separation, whichever is later.",
    source:
      "Applications: 29 C.F.R. 1602.14 for Title VII records. Payroll: the FLSA record keeping rules. I-9: the Form I-9 retention rule.",
    verified: false,
    uncertain:
      "All three citations, and in particular whether 1602.14 gives one year. NOTHING IN retention-policy.ts COVERS APPLICATIONS OR ONBOARDING RECORDS TODAY, which Part B5 records as missing entirely.",
    owner: "platform",
  },
  {
    key: "no-sensitive-identity-data",
    rule: "The platform stores no social security number, date of birth, bank details, identity document or I-9 image, in the database or in the repository.",
    source:
      "The operator's ruling of 2026-10-02. Its force comes from Gusto holding those records instead; the underlying exposure it manages is the breach notification obligation in Texas Business and Commerce Code Chapter 521.",
    verified: false,
    uncertain: "The chapter number and the notification thresholds.",
    owner: "platform",
  },
  {
    key: "new-hire-report",
    rule: "A new hire is reported to the Texas Attorney General's new hire program.",
    source: "The Texas new hire reporting requirement.",
    verified: false,
    uncertain:
      "Whether it applies to 1099 contractors at all. The operator marked this VERIFY and it is unresolved, which matters because technicians are contractors.",
    owner: "operator",
  },
];

/**
 * The lifecycle steps that carry a legal obligation, and which rule governs each.
 *
 * THIS IS THE HALF THAT MAKES THE FILE A CHECK RATHER THAN A LIST. Part B7 asks
 * for an audit that asserts "every lifecycle step carrying a legal obligation
 * names a rule in that file, so a step built without one is a red board rather
 * than a gap". The step numbers are the ones in the Part A report.
 */
export type HrStep = {
  step: number;
  name: string;
  /** Keys into HR_RULES. Empty is not allowed; a step with no rule is not listed. */
  rules: string[];
  /** EXISTS, PARTIAL or MISSING, as the Part A report found it. */
  state: "EXISTS" | "PARTIAL" | "MISSING";
};

export const HR_STEPS: HrStep[] = [
  { step: 2, name: "Applies", rules: ["protected-characteristics", "retention"], state: "EXISTS" },
  { step: 3, name: "Screening", rules: ["protected-characteristics"], state: "PARTIAL" },
  { step: 5, name: "Conditional offer", rules: ["criminal-history-after-offer"], state: "MISSING" },
  { step: 6, name: "Background check, Checkr, FCRA", rules: ["criminal-history-after-offer"], state: "MISSING" },
  { step: 8, name: "Onboarding", rules: ["no-sensitive-identity-data", "retention", "new-hire-report"], state: "PARTIAL" },
  { step: 10, name: "Active employment, admin configuration", rules: ["overtime", "payday-frequency"], state: "MISSING" },
  { step: 11, name: "Separation", rules: ["retention", "payday-frequency"], state: "PARTIAL" },
];
