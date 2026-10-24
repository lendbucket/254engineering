/**
 * ===========================================================================
 * TEMPLATE 7 OF 8: THE STRUCTURAL LETTER FOR PERMIT, 254-PL-001 v1.1.
 * TRANSCRIBED, NEVER WRITTEN.
 * ===========================================================================
 *
 * The engineer of record's wording, section 8.4 of the letter templates file of
 * 2026-10-06 (docs/protocols/incoming/v1.1/254_Letter_Templates.docx, held in
 * the private eng-protocol-sources bucket since 0080). Every sentence is his,
 * with the {{slot}} names as the document prints them. Left out, as on the roof
 * letter: his bracketed [ENGINEER: ...] notes, the typed letterhead (derived),
 * and the typed seal block (read from the register).
 *
 * WHICH OPTION, operator ruling of 2026-10-22 from the engineer's email that
 * day (docs/rulings-2026-10-22.md):
 *   A  the element is acceptable with no conditions: a pass.
 *   B  acceptable only with a condition, a load limit or something the
 *      contractor must do: a pass, and the condition is listed in the letter's
 *      schedule. B with no condition listed is refused.
 *   C  repairs required: not a pass.
 * Revise, site revisit and decline produce no letter; a declined job is sent
 * an email with the reason and the refund per the published terms, never a
 * sealed letter (operator ruling, same day).
 *
 * The rule is src/lib/structural-letter-verdict.ts, and
 * scripts/proofs/the-permit-letter-takes-its-option.mjs pins all three.
 */
export const STRUCTURAL_LETTER_SECTION = "8.4 Body, Template 7 of 8: Structural letter for permit";

export const STRUCTURAL_LETTER_OPTION_SENTENCE = {
  /* [ENGINEER: option A] */
  A: "In my opinion, {{element_described}} satisfies the requirement stated above.",
  /* [ENGINEER: option B] */
  B: "In my opinion, {{element_described}} satisfies the requirement stated above subject to the conditions in the attached schedule.",
  /* [ENGINEER: option C] */
  C: "In my opinion, {{element_described}} does not satisfy the requirement stated above.",
} as const;

export type StructuralLetterOption = keyof typeof STRUCTURAL_LETTER_OPTION_SENTENCE;

/* The head of the letter, his lines with the slots as he printed them (section 8.4). */
export const STRUCTURAL_LETTER_HEAD = [
  "Date: {{determination_date}}",
  "{{authority_name}} {{authority_address}}",
  "Re: {{element_described}}, {{property_address}}, {{county}} County, Texas Permit {{permit_number}} | File {{file_number}}",
  "To {{authority_salutation}},",
] as const;

/* The quoted requirement, his slot on its own line after the opening. */
export const STRUCTURAL_LETTER_REQUIREMENT = "{{authority_requirement_verbatim}}";

export const STRUCTURAL_LETTER_OPENING = [
  "This letter is issued at the request of {{requestor_name}} in connection with permit {{permit_number}}.",
  "The requirement this letter addresses, as stated by the authority:",
] as const;

/* He triages every job as a site job or a desk job; one of these two follows the quoted requirement. */
export const STRUCTURAL_LETTER_BASIS = {
  visit:
    "The structure at {{property_address}} was inspected on {{visit_date}}, and {{evidence_count}} items of evidence were recorded and are retained in file {{file_number}}.",
  noVisit: "This opinion is based on the documents listed in the attached schedule. No site visit was made.",
} as const;

export const STRUCTURAL_LETTER_LIMITATIONS = {
  always: [
    "This letter addresses {{element_described}} only. It does not address any other element, system or part of the structure.",
    "This letter addresses the requirement quoted above. It states no opinion on any other requirement of the authority, and no opinion on whether the permit will be granted.",
    "It is not a warranty or a guarantee of any kind, and makes no prediction of remaining service life.",
    "Where the opinion rests on documents supplied by others, those documents are listed in the attached schedule and this firm has not verified their accuracy.",
    "The recipient decides how to use this letter.",
  ],
  /* [ENGINEER: Desk jobs only.] */
  deskOnly: ["No site visit was made. This opinion rests on the documents listed in the attached schedule."],
} as const;
