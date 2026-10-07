/**
 * ===========================================================================
 * TEMPLATE 1 OF 8: THE ROOF CERTIFICATION LETTER. TRANSCRIBED, NEVER WRITTEN.
 * ===========================================================================
 *
 * The engineer of record's wording, from section 2.3 of
 * docs/protocols/incoming/v1.1/254_Letter_Templates.docx, which he reviewed and
 * returned on 2026-10-05. Every sentence below is his, character for character,
 * with the {{slot}} names exactly as the document prints them. A slot is a fact
 * the platform reads from the file; it is never typed by anybody.
 *
 * WHAT IS LEFT OUT, AND WHY, so nobody reads an omission as a choice:
 *   - The bracketed [ENGINEER: ...] notes. They are his instructions about the
 *     letter, not sentences in it, and his own answers say so: "The platform
 *     fills the one that matches the determination I record."
 *   - The letterhead's typed registrant line. Section 2.1 says it is "derived,
 *     never typed": the rendered letter reads registrationLine().
 *   - The seal block's typed name and licence number. The rendered letter reads
 *     both from the credentials register, for the same reason.
 *
 * HIS ANSWERS OF 2026-10-05, recorded in docs/rulings-2026-10-06.md section 1:
 * options A, B or C filled from his determination, NO option D, the four
 * location shingle seal sentence, items not observed with their reasons, and
 * the not a warranty sentence. RC-001's other two determinations, revise and
 * site revisit, produce no letter: they send the job back, not to a customer.
 *
 * PROVED by scripts/proofs/the-roof-letter-is-his-words.mjs, which reads the
 * Word file itself and finds every sentence here in it, in order.
 */

export const ROOF_LETTER_SOURCE = "docs/protocols/incoming/v1.1/254_Letter_Templates.docx";
export const ROOF_LETTER_SECTION = "2.3 Body, Template 1 of 8: Roof certification letter";

/** The determinations that produce a letter, each with his fixed sentence. */
export const ROOF_LETTER_DETERMINATION_SENTENCE = {
  /* [ENGINEER: option A, passing] */
  pass: "Based on the evidence recorded, no active leak and no damage or deterioration requiring repair was observed on the roof covering as of the date of the visit.",
  /* [ENGINEER: option B, repairs required] */
  "repairs-required":
    "Based on the evidence recorded, certification is withheld pending completion of the repairs listed in the attached schedule. Each item requires verification before this firm will certify the roof.",
  /* [ENGINEER: option C, declined] */
  decline: "Based on the evidence recorded, this firm declines to certify the roof. The reason is stated in the attached record.",
} as const;

export type RoofLetterDetermination = keyof typeof ROOF_LETTER_DETERMINATION_SENTENCE;

/** The lines of the letter, in his order. `determination` marks where option A, B or C goes. */
export const ROOF_LETTER_LINES = [
  { kind: "date", text: "Date: {{determination_date}}" },
  { kind: "recipient", text: "{{recipient_name}} {{recipient_address}}" },
  { kind: "re", text: "Re: Roof certification, {{property_address}}, {{county}} County, Texas File {{file_number}}" },
  { kind: "salutation", text: "{{recipient_salutation}}," },
  {
    kind: "body",
    text: "At your request, this firm inspected the roof of the property at {{property_address}} in {{county}} County, Texas, on {{visit_date}}.",
  },
  {
    kind: "body",
    text: "The inspection was performed to protocol {{protocol_number}} version {{protocol_version}}, a written protocol approved by the engineer of record of this firm. {{evidence_count}} items of evidence were recorded against that protocol and are retained in file {{file_number}}.",
  },
  { kind: "determination", text: "" },
  { kind: "heading", text: "Scope and limitations" },
  {
    kind: "body",
    text: "This letter addresses the conditions documented on the date of the visit stated above. It is not a warranty or a guarantee of any kind.",
  },
  { kind: "body", text: "This letter makes no prediction of remaining service life." },
  {
    kind: "body",
    text: "The inspection was visual and non-destructive. On an asphalt shingle roof a designated representative from the firm checks the shingle seal by hand at four locations. No covering is removed and nothing is tested.",
  },
  {
    kind: "body",
    text: "Items the protocol required that were not observed, and the reason recorded for each: {{items_not_observed}}.",
  },
  {
    kind: "body",
    text: "The recipient decides how to use this letter. This firm gives no opinion on its sufficiency for any particular purpose, including insurance, lending or permit.",
  },
  {
    kind: "body",
    text: "This letter addresses the roof covering and the elements listed in the protocol. It does not address the structure as a whole, the foundation, or any element outside the scope of {{protocol_number}}.",
  },
] as const;

/** Every slot the lines name. A draft that cannot fill one is refused, never sent with a gap. */
export const ROOF_LETTER_SLOTS = [
  "determination_date",
  "recipient_name",
  "recipient_address",
  "recipient_salutation",
  "property_address",
  "county",
  "file_number",
  "visit_date",
  "protocol_number",
  "protocol_version",
  "evidence_count",
  "items_not_observed",
] as const;

export type RoofLetterSlot = (typeof ROOF_LETTER_SLOTS)[number];
