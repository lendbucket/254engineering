/**
 * ===========================================================================
 * THE REPAIR SPECIFICATION COMPLETION LETTER, 254-RS-001 v1.1. A DRAFT FOR THE
 * ENGINEER'S APPROVAL, AND NOT IN USE.
 * ===========================================================================
 *
 * Operator ruling, 2026-10-22, from the engineer of record's email that day:
 * he approved the approach and reviews the letter itself. SEALING OF
 * COMPLETION LETTERS STAYS CLOSED until the operator says he approved the
 * actual letter, which is what `RS_COMPLETION_LETTER_APPROVED` records and
 * nothing in src/lib/letter-seal.ts routes this line to sealing in the
 * meantime.
 *
 * EVERY SENTENCE IS DRAWN FROM HIS OWN DOCUMENTS, and each names where:
 *   [1] Template 8 body opening, 2026-10-06 templates file, with "inspected"
 *       made "verified" and the specification's date added.
 *   [2] 254-RS-001 v1.1 section 9, "the engineer issues a sealed letter stating
 *       that the repairs observed conform to the specification", in the "Based
 *       on the evidence recorded" form of his roof option A.
 *   [3] His note in template 8: "Photograph any work that will be covered
 *       before covering it. Verification of completed repairs relies on those
 *       photographs."
 *   [4] Template 8, 9.4.1 scope and limitations, "this specification" made
 *       "this letter", "does not supervise" made "did not supervise".
 *   [5] The items-not-observed sentence he asked for in his roof and
 *       foundation letters.
 *
 * Whatever he changes replaces the sentence here, and this header records it.
 */
export const RS_COMPLETION_LETTER_APPROVED = false;

export const RS_COMPLETION_RE = "Re: Completion of specified repairs, {{property_address}}, {{county}} County, Texas. File {{file_number}}";

export const RS_COMPLETION_BODY = [
  /* [1] */
  "At your request, this firm verified the repairs specified in its repair specification of {{specification_date}} for the structure at {{property_address}} in {{county}} County, Texas. {{evidence_count}} items of evidence were recorded on {{verification_dates}} and are retained in file {{file_number}}.",
  /* [2] */
  "Based on the evidence recorded, the repairs observed conform to the specification. Each item listed in the specification was verified and closed.",
] as const;

export const RS_COMPLETION_LIMITATIONS = [
  /* [3] */
  "Verification of work that was covered relies on the photographs taken before it was covered.",
  /* [4] */
  "This letter addresses the items listed in the specification and no others. It is not a warranty or a guarantee of any kind.",
  /* [5] */
  "Items the protocol required that were not observed, and the reason recorded for each: {{items_not_observed}}.",
  /* [4] */
  "This letter makes no prediction of remaining service life and no prediction of future movement.",
  /* [4] */
  "This firm did not supervise construction. The contractor is responsible for means and methods, temporary shoring and site safety.",
  /* [4] */
  "The recipient decides how to use this letter.",
] as const;
