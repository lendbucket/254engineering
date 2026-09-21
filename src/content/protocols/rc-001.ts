import { RC001_INTAKE_QUESTIONS, RC001_INTAKE_UPLOADS } from "./rc-001-intake";
import { RC001_CHECKLIST, RC001_SECTIONS, RC001_PHOTO_PROCEDURE } from "./rc-001-checklist";
import { RC001_DETERMINATIONS, RC001_THRESHOLDS } from "./rc-001-decisions";

/**
 * =========================================================================
 * EVERY ISSUED VERSION, BECAUSE SECTION 13 REQUIRES THE COMPLIANCE FILE TO
 * HOLD THEM ALL. Operator ruling, 2026-09-20.
 * =========================================================================
 *
 * A superseded protocol is not a deleted one. A letter sealed under v1.0 was
 * sealed under v1.0's thresholds, and somebody asking years later what the firm
 * was required to do that day needs the document that was in force THEN, not
 * the one in force now. Replacing the record rather than extending it would
 * make that question unanswerable.
 *
 * `inForceFrom` is the date the engineer approved it, which is the date on the
 * approval page, and is not the issue date. v1.1 was issued on 18 September and
 * approved on the 20th; for two days the document existed and v1.0 was still
 * the authority.
 */
export const RC001_VERSIONS: {
  version: string;
  issueDate: string;
  inForceFrom: string;
  supersededOn: string | null;
  file: string;
  sha256: string;
}[] = [
  {
    version: "1.0",
    issueDate: "2026-09-14",
    inForceFrom: "2026-09-14",
    supersededOn: "2026-09-20",
    file: "docs/254-RC-001-roof-certification-protocol-v1.0.pdf",
    sha256: "f6d3ca925ddcb305292895c47249199ce86977644d3323d8a0d8ccc017803ba9",
  },
  {
    version: "1.1",
    issueDate: "2026-09-18",
    inForceFrom: "2026-09-20",
    supersededOn: null,
    file: "docs/254-RC-001-roof-certification-protocol-v1.1.pdf",
    sha256: "d050a21a2b2d43114de47989ca731f41e26951f195c90187e99c11705011e4ef",
  },
];

/**
 * =========================================================================
 * WHAT THE SIGNATURE ON THE PDF ESTABLISHES, AND WHAT IT DOES NOT.
 * Operator ruling, 2026-09-20. Recorded as a limitation of the EVIDENCE
 * rather than as a doubt about the engineer.
 * =========================================================================
 *
 * Verified by extracting the image objects from both PDFs and looking at them,
 * then deleting the extracts:
 *
 *   - A handwritten mark is present on v1.1's approval page, beside the typed
 *     date 09/20/2026. It is an ink signature, not a typed name or a blank rule.
 *   - **That image is byte-identical to the one in v1.0**, the same two JPEG
 *     objects with the same digests in both files.
 *   - **Neither document carries a cryptographic signature.** No `/Type /Sig`,
 *     no `/ByteRange`, nothing.
 *
 * **So the artifact cannot establish that he personally applied the signature
 * to v1.1.** A stored signature image placed by anyone is indistinguishable
 * from one he placed himself. Reusing a stored signature image is ordinary
 * practice and this is not an allegation; it is a statement of what this
 * evidence can and cannot support, written down so nobody later reads "signed"
 * as more than it is.
 *
 * **THE ACT THAT SETTLES IT IS THE APPROVAL IN THE PLATFORM, THROUGH HIS OWN
 * ACCOUNT**, which is what `approvedProtocols` requires and which no session
 * will ever perform on his behalf by any path. **The PDF is the DOCUMENT; the
 * platform approval is the ACT.** That is the stronger record and it is the one
 * this firm was always going to rely on.
 *
 * OWED, NOT MISSING: the operator is asking the engineer for a cryptographic
 * signature or a wet-signed scan on the next protocol, so the compliance file
 * can answer this question from the artifact rather than from anybody's word.
 */
export const RC001_SIGNATURE_EVIDENCE = {
  handwrittenMarkPresent: true,
  approvalPageDate: "2026-09-20",
  /** Identical to v1.0's, verified by digest on the extracted image objects. */
  signatureImageReusedFromPriorVersion: true,
  cryptographicSignature: false,
  establishesPersonalApplication: false,
  settledInsteadBy: "the engineer's approval in the platform, through his own account",
  owedOnNextProtocol: "a cryptographic signature or a wet-signed scan",
} as const;

/**
 * 254-RC-001 v1.1, THE SIGNED DOCUMENT, DECLARED.
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
  version: "1.1",
  issueDate: "2026-09-18",
  preparedBy: "Aman Dhakal, P.E., Engineer of Record",
  approvedBy: "Aman Dhakal, P.E., Engineer of Record",
  /** The licence as recorded in verifiedEngineers. The document does not print it. */
  approvedByLicense: "143295",
  appliesTo: "All roof certification engagements performed by 254 Engineering Services",
  supersedes: "Version 1.0, issued September 14, 2026.",
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
  sourceFile: "docs/254-RC-001-roof-certification-protocol-v1.1.pdf",
  sourceSha256: "d050a21a2b2d43114de47989ca731f41e26951f195c90187e99c11705011e4ef",

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
    rule: "A yes to any flag question in Appendix A routes the job to the engineer before dispatch. The engineer records accept, accept with conditions, or decline.",
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
    rule: "The engineer records the purpose of the letter and the recipient exactly as given at intake. The letter is addressed only to that recipient and issued only for that purpose.",
    at: "section 6; section 11",
  },
  {
    key: "letter-never-reassigned",
    rule: "The letter is not reassigned to another recipient, another purpose, or another date. A new inspection is required.",
    at: "section 11",
  },
  /*
   * TRANSCRIBED 2026-09-18 FROM SECTION 11 OF THE SIGNED PDF, VERBATIM, after
   * the operator ruled on a contradiction this registry could not see.
   *
   * services.ts had said in six places that a roof certification states
   * remaining service life, including in the deliverable and in a named buyer
   * segment. The signed protocol says the opposite and has since 09/14/2026.
   * The two disagreed for three days and nothing on the board could tell,
   * because this registry carried the protocol's PROCESS rules and not its
   * rules about what the letter may SAY.
   *
   * It is here so the check that now enforces it derives from the document
   * rather than from a list somebody typed. `protocol-registry-audit` compares
   * every rule here against `pdftotext` output with whitespace stripped, so a
   * transcription error is a red board rather than a new source of truth.
   */
  {
    key: "letter-states-observed-condition-only",
    rule: "The letter states observed condition only. It does not estimate remaining service life, forecast future performance, or represent that the roof will not leak.",
    at: "section 11",
  },
  {
    key: "letter-states-visual-and-non-destructive",
    rule: "The letter states that the inspection was visual and non-destructive, that it reflects condition on the date of inspection only, and that no representation is made about concealed conditions.",
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
    rule: "An item that does not apply to the property is marked with the reason it does not apply.",
    at: "section 8",
  },
  /*
   * SPLIT FROM THE ENTRY ABOVE ON 2026-09-18. The two sentences were one rule
   * with an `at` naming two sections, which is the tell: the document states
   * them in different places and the declaration had merged them into a
   * sentence the document does not contain. Each is now quoted from where it
   * actually appears.
   */
  {
    key: "no-item-estimated-or-blank",
    rule: "No item is estimated, assumed, or left blank.",
    at: "section 7",
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
    rule: "Photographs carry location and three time values from the field application: the time reported by the device, the server time at sync, and the difference between them. A device clock that disagrees with the server is recorded as disagreeing rather than presented as certain. Photographs from other devices are not accepted.",
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
    rule: "On a pass determination, the engineer issues a sealed letter addressed to the recipient recorded at intake, for the purpose recorded at intake.",
    at: "section 11",
  },
  /*
   * SPLIT FROM THE ENTRY ABOVE, AND THIS ONE IS THE INTERESTING HALF.
   *
   * The rule used to read "On a pass determination, the engineer issues a
   * sealed letter. The platform stores it and never composes one." and its
   * `at` said "section 11; CLAUDE.md standing law". That is honest about the
   * mixture and it makes the sentence a quotation from NEITHER: the document
   * does not say the platform never composes a letter, and CLAUDE.md does not
   * say anything about a pass determination.
   *
   * A rule sourced from standing law is not a quotation from the protocol and
   * must not pretend to be, so it is its own entry and the verbatim check
   * deliberately does not apply to it. The check reads `at` to decide, and a
   * rule attributed to the document is held to the document's words.
   */
  {
    key: "platform-never-composes-a-seal",
    rule: "The platform stores the sealed letter the engineer produced and never composes one.",
    at: "CLAUDE.md standing law",
  },
  {
    key: "predetermined-conclusion-auto-decline",
    rule: "A customer request for a predetermined conclusion. This is an automatic decline and the request is logged verbatim.",
    at: "section 12; Appendix C DECLINE",
  },
  {
    key: "job-file-contents",
    rule: "Each job file contains: the intake record and customer uploads, the engineer's acceptance record, the dispatch record, the completed Appendix B checklist, all photographs, the technician's notes, the engineer's review record and determination, any repair list and its closure records, and the issued letter.",
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
/**
 * =========================================================================
 * FIVE OF THE EIGHT ARE ANSWERED BY v1.1. THREE ARE NOT, AND SAYING SO IS
 * THE POINT OF KEEPING THEM. Checked against the document, 2026-09-20.
 * =========================================================================
 *
 * The operator's expectation was that v1.1 answered all eight. It answers
 * five, and each resolution below is quoted from the document rather than
 * taken from the covering email, because the email is not the authority and
 * will not be in the compliance file in ten years.
 *
 * **The three that remain open are recorded as open.** Closing a question
 * because a new version arrived, rather than because the new version answers
 * it, is how a resolved list stops meaning anything.
 */
export const RC001_AMBIGUITIES: {
  at: string;
  question: string;
  /** The document's own words, where v1.1 settles it. Null while open. */
  resolvedByV11: string | null;
}[] = [
  {
    at: "Appendix C, REPAIRS REQUIRED, with Appendix B, COVERING CONDITION",
    question:
      "Unsealed tabs at more than 25% of tested locations, against a seal-bond test at 3-4 spots. One of four is exactly 25% and does not trigger; one of three is 33% and does. The determination depends on how many spots the technician chose to test. A count, or a fixed number of test spots, would settle it. This is the sharpest of these and needs a rule rather than a percentage.",
    resolvedByV11:
      "Both halves moved, which is what it needed. The test is now \"gentle tab lift at 4 locations spread across different planes\" and the trigger is \"2 or more unsealed tabs of the 4 locations tested\". A fixed denominator and a count, so the determination no longer depends on how many spots the technician chose.",
  },
  {
    at: "Appendix C, REPAIRS REQUIRED",
    question:
      "Covering damage beyond 10 units on any plane. Units of what? Appendix B counts damaged shingles/tiles visible, which is the likely reading, but the rule does not say and the word units appears nowhere in Appendix B.",
    resolvedByV11:
      "\"10 or more damaged shingles or tiles on any plane; for metal, standing-seam, or membrane coverings, any breach of the water barrier\". The word units is gone, the likely reading is now the stated one, and the coverings it could not have counted are given their own rule.",
  },
  {
    at: "Appendix C, REPAIRS REQUIRED",
    question:
      "8 or more hail hits in a 10 by 10 test square. A 10 by 10 square in what units? Feet is the trade convention and the document does not state it.",
    resolvedByV11:
      "\"8 or more hail hits in a 10 foot by 10 foot (100 square foot) test square\". Stated, and stated twice over, so the trade convention no longer has to be assumed.",
  },
  {
    at: "Appendix A, Part 1, questions 5 and 14",
    question:
      "Number of stories is asked twice: question 5 asks property type and number of stories, question 14 asks number of stories and roof steepness. Should one of them drop the stories, and if the two answers disagree at intake, which governs?",
    /*
     * STILL OPEN. Both questions are word for word what they were in v1.0:
     * question 5 still asks "Property type (single family / duplex / townhome /
     * small commercial) and number of stories" and question 14 still asks
     * "Number of Stories and Roof Steepness?". The duplication stands and no
     * rule for a disagreement has been added.
     */
    resolvedByV11: null,
  },
  {
    at: "section 13",
    question:
      "Job files are retained ten years from the date of the letter. A job that is DECLINED never produces a letter, so it has no anchor. From what date is a declined job's file retained, and is it retained at all?",
    resolvedByV11:
      "\"For a job that produces no letter, the ten years run from the date of the last engineer determination recorded in the file.\" The anchor is given and the file is retained. v1.1 also adds that ten years is the firm's floor and that the engineer raises it where TBPELS rules or the professional liability policy require longer.",
  },
  {
    at: "section 2, with Appendix D",
    question:
      "Section 2 excludes windstorm inspections of ongoing construction on the basis that they are covered by the firm's windstorm inspection protocol, while Appendix D lists 254-WP-001 as a Firm document (Draft). Is a protocol in force allowed to defer scope to one that is not yet in force, and what happens to a job that falls in that gap today?",
    /*
     * STILL OPEN, AND ARGUABLY WIDER THAN IT WAS. v1.1 removes the "254-WP-001
     * Windstorm Inspection Protocol" row from Appendix D and drops the
     * "(Draft)" annotation, and changes section 14 from "the format established
     * by 254-WP-001" to "the firm's standard protocol format".
     *
     * So the visible CONTRADICTION is gone. The deferral is not: section 2
     * still excludes ongoing-construction windstorm work "covered by the firm's
     * windstorm inspection protocol", and that protocol is now not named
     * anywhere in the document. A scope exclusion pointing at an unnamed
     * document is harder to act on than one pointing at a named draft, not
     * easier, and the job that falls in the gap today still has no answer.
     */
    resolvedByV11: null,
  },
  {
    at: "Approval page",
    question:
      "The approval block prints the name and 09/14/2026 beside it, and the typed 'Date: ______' field below is left blank. Is the date beside the name the effective date, and should the blank field be removed at v1.1?",
    resolvedByV11:
      "Answered by what the page now does rather than by a sentence. The date beside the name is gone and the field is filled: \"Signature: ______ Date: 09/20/2026\". One date, in the field provided for it, and it is the date the protocol is in force from.",
  },
  {
    at: "Appendix D",
    question:
      "The references table's item-to-location pairings do not survive text extraction legibly, so this transcription does not assert them. A human eye on that table is needed before anything in the portal cites it.",
    /*
     * STILL OPEN. The table changed, losing the 254-WP-001 row and the
     * "(Draft)" annotation, and it still does not survive extraction legibly:
     * the column headers and the authority URLs interleave, so which location
     * belongs to which item cannot be read from the text layer. Nothing in the
     * portal cites it and nothing should until somebody reads the table itself.
     */
    resolvedByV11: null,
  },
];
