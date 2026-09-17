import { RC001_INTAKE_QUESTIONS, RC001_INTAKE_UPLOADS } from "./rc-001-intake";
import { RC001_CHECKLIST, RC001_SECTIONS, RC001_PHOTO_PROCEDURE } from "./rc-001-checklist";
import { RC001_DETERMINATIONS, RC001_THRESHOLDS } from "./rc-001-decisions";

/**
 * 254-RC-001 v1.0, THE SIGNED DOCUMENT, DECLARED.
 *
 * THE DOCUMENT IS THE AUTHORITY AND THE PORTAL IS ITS IMPLEMENTATION. Every
 * question, checklist item and decision rule the portal shows traces to a
 * numbered place here, and `protocol-registry-audit` proves the mapping in both
 * directions against the PDF's own text rather than against a hand list.
 *
 * WHERE THE DOCUMENT SAYS SOMETHING THE PLATFORM CANNOT DO, that is a finding
 * for the report and never a thing to quietly reinterpret. The engineer signed
 * those words.
 */
export const RC001 = {
  documentNumber: "254-RC-001",
  title: "Roof Certification Protocol for Existing Roofs",
  version: "1.0",
  issueDate: "2026-09-14",
  preparedBy: "Aman Dhakal, P.E., Engineer of Record",
  approvedBy: "Aman Dhakal, P.E., Engineer of Record",
  /** The licence as recorded in verifiedEngineers. The document does not print it. */
  approvedByLicense: "143295",
  appliesTo: "All roof certification engagements performed by 254 Engineering Services",
  supersedes: "None.",
  serviceSlug: "roof-inspections",

  /**
   * THE DISCIPLINE THIS PROTOCOL REQUIRES, AND IT IS NOT DECLARED YET.
   *
   * Operator ruling, 2026-09-16: a protocol declares the discipline it requires
   * and it is never inferred from the service line's name. Whether a roof
   * certification is structural work is the engineer's answer, not a reading of
   * the word "roof", and this session is not going to supply it by guessing.
   *
   * NULL BLOCKS THE LINE, which is the conservative direction and is the point.
   * roof-inspections stays a waitlist until Aman states what 254-RC-001
   * requires, and the block says exactly that rather than refusing vaguely.
   *
   * He signed this protocol and declares his competence structural only, so the
   * likely answer is structural. Likely is not declared.
   */
  requiresDiscipline: null as string | null,

  /**
   * The file this declaration was transcribed from, and its digest, so the
   * declaration cannot drift onto a different document without saying so.
   */
  sourceFile: "docs/254-RC-001-roof-certification-protocol-v1.0.pdf",
  sourceSha256: "f6d3ca925ddcb305292895c47249199ce86977644d3323d8a0d8ccc017803ba9",

  /**
   * THE FIRM NAME AS THE DOCUMENT PRINTS IT, RECORDED RATHER THAN CORRECTED.
   * Operator ruling, 2026-09-16.
   *
   * The document names the firm "254 Engineering Services" throughout: in
   * Prepared by, in Applies to, and in every page footer. TBPELS holds F-29811
   * in the name "254 Services LLC", and standing law here is that
   * 254 Engineering Services is the wordmark and the page titles and is NEVER
   * the legal or firm name in a sentence.
   *
   * THE DOCUMENT STANDS EXACTLY AS SIGNED. The operator's ruling: the naming is
   * his error before it is the engineer's, because the windstorm protocol he
   * sent as the format carried the same name. It is reissued as v1.1 with the
   * legal name corrected, in the same sitting as `issuedTo` when TBPELS
   * reissues the registration. Until then the discrepancy is recorded against
   * the protocol rather than hidden and rather than edited.
   *
   * `protocol-registry-audit` FLAGS any protocol whose document names the firm
   * in a name the board's register does not hold, so a future protocol cannot
   * arrive with the same defect unnoticed, and so this one goes red at
   * reissuance until v1.1 is recorded.
   */
  firmNameOnDocument: "254 Engineering Services",

  /**
   * THE DISCREPANCY, RECORDED RATHER THAN RESOLVED, and the check asserts the
   * RECORD rather than asserting the discrepancy is absent.
   *
   * A check that simply failed while the names differ would put a permanent red
   * on the board until reissuance, and a red everybody learns to ignore is
   * where the next real failure hides. So the shape is the one
   * `legalEntityMatchesRegistrant` already uses: an unresolved difference is
   * fine as long as it is WRITTEN DOWN with both names, and it becomes a
   * failure the moment the world moves and the record does not.
   */
  naming: {
    matchesBoardRegister: false,
    registrantWhenRecorded: "254 Services LLC",
    because:
      "254-RC-001 v1.0 names the firm 254 Engineering Services throughout, and TBPELS holds F-29811 in " +
      "the name 254 Services LLC. Operator ruling 2026-09-16: the document stands exactly as signed, the " +
      "naming is the operator's error before it is the engineer's because the windstorm protocol sent as " +
      "the format carried the same name, and it is reissued as v1.1 with the legal name corrected in the " +
      "same sitting as issuedTo when TBPELS reissues the registration.",
    closesWhen:
      "TBPELS reissues F-29811 in the new name and 254-RC-001 is reissued as v1.1 with the legal name corrected.",
  },

  sections: RC001_SECTIONS,
  photoProcedure: RC001_PHOTO_PROCEDURE,
  intakeQuestions: RC001_INTAKE_QUESTIONS,
  intakeUploads: RC001_INTAKE_UPLOADS,
  checklist: RC001_CHECKLIST,
  determinations: RC001_DETERMINATIONS,
  thresholds: RC001_THRESHOLDS,
} as const;

/**
 * THE RULES THAT ARE ENFORCED RATHER THAN DISPLAYED.
 *
 * Each is a sentence the document states as a requirement, with the place it
 * states it. A rule shown to somebody is a rule they can forget; these are the
 * ones the platform must make impossible to break, and the audit asserts each
 * is named by something in the implementation.
 */
export const RC001_ENFORCED: { key: string; rule: string; at: string }[] = [
  {
    key: "flag-routes-to-engineer",
    rule: "A yes on any flag question routes the job to the engineer BEFORE dispatch. The engineer records accept, accept with conditions, or decline.",
    at: "section 6; Appendix A Part 1 heading over questions 8 to 12",
  },
  {
    key: "condition-of-acceptance-recorded",
    rule: "The engineer records any condition of acceptance in the job file, including any item the technician must capture beyond Appendix B.",
    at: "section 6",
  },
  {
    key: "no-dispatch-until-complete",
    rule: "A job is not dispatched until intake is complete and every upload required by Appendix A has been received.",
    at: "section 6",
  },
  {
    key: "purpose-and-recipient-verbatim",
    rule: "The purpose of the letter and the recipient are recorded exactly as given at intake. The letter is addressed only to that recipient and issued only for that purpose.",
    at: "section 6; section 11",
  },
  {
    key: "letter-never-reassigned",
    rule: "The letter is not reassigned to another recipient, another purpose, or another date. A new inspection is required.",
    at: "section 11",
  },
  {
    key: "schedule-within-two-business-days",
    rule: "The coordinator schedules an accepted job within two business days. The engineer may set a different interval for a job in the job file.",
    at: "section 7",
  },
  {
    key: "checklist-cannot-be-submitted-incomplete",
    rule: "The checklist cannot be submitted incomplete.",
    at: "Appendix B heading",
  },
  {
    key: "not-applicable-needs-a-reason",
    rule: "An item that does not apply to the property is marked with the reason it does not apply. No item is estimated, assumed, or left blank.",
    at: "section 7; section 8",
  },
  {
    key: "counts-are-counts",
    rule: "The counts called for on the checklist are recorded as counts, not as descriptions.",
    at: "section 8",
  },
  {
    key: "seal-bond-needs-temperature",
    rule: "The seal-bond check is performed and the ambient temperature at the time of the check is recorded, because the result is not meaningful without it.",
    at: "section 8",
  },
  {
    key: "wide-and-close-per-item",
    rule: "Every checklist item has at least one wide photograph placing the item on the structure and one close photograph showing its condition.",
    at: "section 9",
  },
  {
    key: "ruler-where-dimension-governs",
    rule: "Where a dimension, exposure, or thickness governs, a ruler or tape is in frame.",
    at: "section 9",
  },
  {
    key: "worst-condition-per-plane",
    rule: "The worst condition on each roof plane is photographed. A representative sample selected for appearance is not acceptable.",
    at: "section 9",
  },
  {
    key: "per-occurrence-capture",
    rule: "Every patch, prior repair, penetration, and flashing location is photographed individually.",
    at: "section 9",
  },
  {
    key: "photos-from-the-field-application-only",
    rule: "Photographs carry automatic timestamp and location from the field application. Photographs from other devices are not accepted.",
    at: "section 9",
  },
  {
    key: "incomplete-package-rejected-without-review",
    rule: "A package that does not cover every checklist item, with the photographs each item calls for, is rejected without review.",
    at: "section 9",
  },
  {
    key: "review-record-identifies-evidence",
    rule: "The engineer's review record identifies the checklist items and photographs relied on for the determination.",
    at: "section 9",
  },
  {
    key: "no-charge-for-incomplete-package-revisit",
    rule: "The customer is not charged for a re-inspection caused by an incomplete package.",
    at: "section 9",
  },
  {
    key: "no-letter-with-open-repair",
    rule: "No certification letter is issued with an open repair item. There is no conditional certification.",
    at: "section 10",
  },
  {
    key: "repairs-closed-individually",
    rule: "Corrections are verified on a site revisit to the same evidence standard, and the engineer closes each item individually.",
    at: "section 10",
  },
  {
    key: "letter-is-sealed-and-uploaded",
    rule: "On a pass determination, the engineer issues a sealed letter. The platform stores it and never composes one.",
    at: "section 11; CLAUDE.md standing law",
  },
  {
    key: "predetermined-conclusion-auto-decline",
    rule: "A customer request for a predetermined conclusion is an automatic decline and the request is logged verbatim.",
    at: "section 12; Appendix C DECLINE",
  },
  {
    key: "job-file-contents",
    rule: "Each job file contains the intake record and customer uploads, the engineer's acceptance record, the dispatch record, the completed Appendix B checklist, all photographs, the technician's notes, the engineer's review record and determination, any repair list and its closure records, and the issued letter.",
    at: "section 13",
  },
];

/**
 * QUESTIONS FOR THE ENGINEER. NOT DECISIONS FOR THIS PLATFORM.
 *
 * Every one is a place where the signed document is ambiguous or where two of
 * its parts do not quite meet. Nothing here is resolved by choosing a reading,
 * because the engineer signed the words and the reading changes what the firm
 * certifies. They go to him with their section numbers.
 */
export const RC001_AMBIGUITIES: { at: string; question: string }[] = [
  {
    at: "Appendix C, REPAIRS REQUIRED, with Appendix B, COVERING CONDITION",
    question:
      "Unsealed tabs at more than 25% of tested locations, against a seal-bond test at 3-4 spots. One of four is exactly 25% and does not trigger; one of three is 33% and does. The determination depends on how many spots the technician chose to test. A count, or a fixed number of test spots, would settle it. This is the sharpest of these and needs a rule rather than a percentage.",
  },
  {
    at: "Appendix C, REPAIRS REQUIRED",
    question:
      "Covering damage beyond 10 units on any plane. Units of what? Appendix B counts damaged shingles/tiles visible, which is the likely reading, but the rule does not say and the word units appears nowhere in Appendix B.",
  },
  {
    at: "Appendix C, REPAIRS REQUIRED",
    question:
      "8 or more hail hits in a 10 by 10 test square. A 10 by 10 square in what units? Feet is the trade convention and the document does not state it.",
  },
  {
    at: "Appendix A, Part 1, questions 5 and 14",
    question:
      "Number of stories is asked twice: question 5 asks property type and number of stories, question 14 asks number of stories and roof steepness. Should one of them drop the stories, and if the two answers disagree at intake, which governs?",
  },
  {
    at: "section 13",
    question:
      "Job files are retained ten years from the date of the letter. A job that is DECLINED never produces a letter, so it has no anchor. From what date is a declined job's file retained, and is it retained at all?",
  },
  {
    at: "section 2, with Appendix D",
    question:
      "Section 2 excludes windstorm inspections of ongoing construction on the basis that they are covered by the firm's windstorm inspection protocol, while Appendix D lists 254-WP-001 as a Firm document (Draft). Is a protocol in force allowed to defer scope to one that is not yet in force, and what happens to a job that falls in that gap today?",
  },
  {
    at: "Approval page",
    question:
      "The approval block prints the name and 09/14/2026 beside it, and the typed 'Date: ______' field below is left blank. Is the date beside the name the effective date, and should the blank field be removed at v1.1?",
  },
  {
    at: "Appendix D",
    question:
      "The references table's item-to-location pairings do not survive text extraction legibly, so this transcription does not assert them. A human eye on that table is needed before anything in the portal cites it.",
  },
];
