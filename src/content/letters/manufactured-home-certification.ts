/**
 * THE MANUFACTURED HOME FOUNDATION CERTIFICATION, IN THE WORDING ON FILE.
 *
 * Section 1 of `docs/letter-drafts/letter-drafts-for-adoption-2026-10-24.md`,
 * the drafts document sent for the engineer of record's adoption on
 * 2026-10-24. Every line below is a line of that section, carried exactly:
 * the lines marked there as standing are his own words from the answered
 * letter templates of 2026-10-06 (template 5), and the lines marked as drafts
 * were written only to say what 254-MH-001 v1.1 section 11 requires.
 * `scripts/proofs/the-three-letters-are-the-wording-on-file.mjs` compares each
 * line against the drafts document, and each standing line against his file.
 *
 * HOW HE ADOPTS IT. Robert's ruling of 2026-10-25, 23:51 Central: the engineer
 * signs no templates; his seal on each live letter, after reading its full
 * preview, is his adoption of it (0091). The drafts document's own line that
 * "nothing is used until you sign the template in the portal" is superseded
 * by that ruling and is kept in the document as it was sent.
 *
 * WHAT IS NOT PRINTED, AND WHY.
 *   - The drafts document's notes, in parentheses and italics, are
 *     instructions to the engineer, not letter text.
 *   - The four template sentences it says "carry no confirmation mark from
 *     you", left for him to keep, edit or strike, are not among its lines and
 *     are not printed. Choosing them would be choosing for him.
 *   - A named requirement other than HUD-7584: his answer is "another
 *     requirement only where I approve it before dispatch", and no record holds
 *     that approval, so a draft with one recorded is refused.
 */
export const MANUFACTURED_HOME_LETTER_SECTION = "1. Manufactured home foundation certification (254-MH-001 v1.1)";

/**
 * The requirement every letter names, in his words (answered templates of
 * 2026-10-06, template 5): "The HUD Permanent Foundations Guide for
 * Manufactured Housing, HUD-7584." Printed as he wrote it, less the full stop
 * that ends his answer.
 */
export const MANUFACTURED_HOME_NAMED_REQUIREMENT = "The HUD Permanent Foundations Guide for Manufactured Housing, HUD-7584";

/** The determination sentences: option A on pass, option B on repairs required, each with what follows it. */
export const MANUFACTURED_HOME_LETTER_OPTION = {
  /* [Stands] option A, on pass */
  pass: [
    "Based on the evidence recorded, I certify that in my opinion the foundation and support system of the home conform to {{named_requirement}} as of the date of the visit.",
  ],
  "repairs-required": [
    /* [Stands] option B, on repairs required */
    "Based on the evidence recorded, the foundation and support system did not conform to {{named_requirement}} in the respects described in the attached record.",
    /* [DRAFT] option B, the sentence that follows it */
    "The attached repair list identifies each item, what governs it, and what is required to close it. A certification can follow only after the corrections are verified on a site revisit.",
  ],
} as const;
export type ManufacturedHomeLetterDetermination = keyof typeof MANUFACTURED_HOME_LETTER_OPTION;

/** Where the engineer records "none" for additions, the line his drafts give for that case. */
export const MANUFACTURED_HOME_NO_ADDITIONS = "Additions to the home: none observed.";

/** The lines, in the drafts document's order. `determination` is where the option's sentences go. */
export const MANUFACTURED_HOME_LETTER_LINES = [
  { kind: "date", text: "Date: {{determination_date}}" },
  { kind: "recipient", text: "{{recipient_name}} {{recipient_address}}" },
  { kind: "re", text: "Re: Manufactured home foundation certification, {{property_address}}, {{county}} County, Texas File {{file_number}}" },
  { kind: "salutation", text: "{{recipient_salutation}}," },
  {
    kind: "body",
    text: "At your request, this firm inspected the foundation and support system of the manufactured home at {{property_address}} in {{county}} County, Texas, on {{visit_date}}.",
  },
  {
    kind: "body",
    text: "The home is identified as follows. Manufacturer: {{manufacturer}}. Serial number: {{serial_number}}. HUD label numbers: {{hud_label_numbers}}. Date of manufacture: {{date_of_manufacture}}. Sections: {{section_count}}.",
  },
  {
    kind: "body",
    text: "The inspection was performed to protocol {{protocol_number}} version {{protocol_version}}. {{evidence_count}} items of evidence were recorded and are retained in file {{file_number}}.",
  },
  { kind: "body", text: "Foundation and support system as observed: {{foundation_as_observed}}." },
  { kind: "body", text: "Anchorage as observed: {{anchorage_as_observed}}." },
  { kind: "additions", text: "Additions to the home: {{additions_as_observed}}." },
  { kind: "determination", text: "" },
  {
    kind: "body",
    text: "This letter states conformance with {{named_requirement}} only. It states no opinion on any other standard, programme or requirement.",
  },
  {
    kind: "body",
    text: "The inspection was visual and non-invasive. It reflects the condition of the foundation and support system on the date of inspection only.",
  },
  { kind: "body", text: "No representation is made about concealed or below-grade conditions." },
  {
    kind: "body",
    text: "This letter does not address the home's own structure, and it does not forecast the future performance of the foundation.",
  },
  {
    kind: "body",
    text: "This certification is issued to the recipient named above. It may be re-sent to that recipient. It is not re-dated or re-addressed.",
  },
  { kind: "body", text: "It is not issued for another loan. A new inspection is required for that." },
] as const;

/** Which lines are his own words from template 5 (marked "Stands" in the drafts document), so the proof reads them against his file too. */
export const MANUFACTURED_HOME_STANDING = [
  "Date: {{determination_date}}",
  "{{recipient_name}} {{recipient_address}}",
  "Re: Manufactured home foundation certification, {{property_address}}, {{county}} County, Texas File {{file_number}}",
  "{{recipient_salutation}},",
  "At your request, this firm inspected the foundation and support system of the manufactured home at {{property_address}} in {{county}} County, Texas, on {{visit_date}}.",
  "The inspection was performed to protocol {{protocol_number}} version {{protocol_version}}. {{evidence_count}} items of evidence were recorded and are retained in file {{file_number}}.",
  MANUFACTURED_HOME_LETTER_OPTION.pass[0],
  MANUFACTURED_HOME_LETTER_OPTION["repairs-required"][0],
  "This letter states conformance with {{named_requirement}} only. It states no opinion on any other standard, programme or requirement.",
  "This certification is issued to the recipient named above. It may be re-sent to that recipient. It is not re-dated or re-addressed.",
] as const;

/** Every slot the lines carry. A draft that cannot fill one is refused by name. */
export const MANUFACTURED_HOME_LETTER_SLOTS = [
  "determination_date",
  "recipient_name",
  "recipient_address",
  "recipient_salutation",
  "property_address",
  "county",
  "file_number",
  "visit_date",
  "manufacturer",
  "serial_number",
  "hud_label_numbers",
  "date_of_manufacture",
  "section_count",
  "protocol_number",
  "protocol_version",
  "evidence_count",
  "foundation_as_observed",
  "anchorage_as_observed",
  "additions_as_observed",
  "named_requirement",
] as const;
export type ManufacturedHomeLetterSlot = (typeof MANUFACTURED_HOME_LETTER_SLOTS)[number];
