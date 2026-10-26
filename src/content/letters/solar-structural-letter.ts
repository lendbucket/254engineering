/**
 * THE SOLAR STRUCTURAL LETTER, IN THE WORDING ON FILE.
 *
 * Section 2 of `docs/letter-drafts/letter-drafts-for-adoption-2026-10-24.md`,
 * the drafts document sent for the engineer of record's adoption on
 * 2026-10-24. Every line below is a line of that section, carried exactly:
 * standing lines are his own words from the answered letter templates of
 * 2026-10-06 (template 6), and draft lines were written only to say what
 * 254-SL-001 v1.1 section 11 requires. Proved by
 * `scripts/proofs/the-three-letters-are-the-wording-on-file.mjs`.
 *
 * HOW HE ADOPTS IT: his seal on the letter after reading its full preview
 * (Robert's ruling of 2026-10-25, 23:51 Central; 0091).
 *
 * WHAT IS NOT PRINTED, AND WHY. The drafts document's notes are instructions
 * to him. Where the installer's site survey photographs were used, it says
 * "the date sentence reads: The installer's site survey was made on
 * {{survey_date}}." The date sits inside a sentence of his own, so swapping it
 * would edit his sentence; a draft with a survey date recorded is refused
 * until he words that case.
 */
export const SOLAR_LETTER_SECTION = "2. Solar structural letter (254-SL-001 v1.1)";

/** The determination sentences: option A on pass, option C on repairs required, each with what follows it. */
export const SOLAR_LETTER_OPTION = {
  /* [Stands] option A, on pass */
  pass: ["Based on the evidence recorded and the array described above, the existing framing is adequate to carry the proposed array."],
  "repairs-required": [
    /* [Stands] option C, on repairs required */
    "Based on the evidence recorded and the array described above, the existing framing is not adequate to carry the proposed array.",
    /* [DRAFT] option C, the sentence that follows it */
    "The attached list identifies each item, what governs it, and what is required to close it.",
  ],
} as const;
export type SolarLetterDetermination = keyof typeof SOLAR_LETTER_OPTION;

/** The lines, in the drafts document's order. `determination` is where the option's sentences go. */
export const SOLAR_LETTER_LINES = [
  { kind: "date", text: "Date: {{determination_date}}" },
  { kind: "recipient", text: "{{recipient_name}} {{recipient_address}}" },
  { kind: "re", text: "Re: Structural review for proposed solar array, {{property_address}}, {{county}} County, Texas File {{file_number}}" },
  { kind: "salutation", text: "{{recipient_salutation}}," },
  {
    kind: "body",
    text: "At your request, this firm reviewed the existing roof framing of the structure at {{property_address}} in {{county}} County, Texas, for the purpose of the proposed solar array described below. Site evidence was collected on {{visit_date}} and {{evidence_count}} items of evidence were recorded and are retained in file {{file_number}}.",
  },
  { kind: "body", text: "This letter is issued for the following purpose, as stated when the work was ordered: {{purpose_verbatim}}." },
  { kind: "body", text: "Existing roof framing as observed: {{framing_type}}, {{member_size}} at {{member_spacing}} spacing, spanning {{member_span}}." },
  { kind: "body", text: "Adopted code: {{adopted_code}}. Loads used: {{loads_used}}." },
  { kind: "body", text: "The array reviewed: {{array_description}}" },
  {
    kind: "body",
    text: "The array design reviewed is dated {{array_design_date}}, revision {{array_design_revision}}: modules {{module_make_model}}, {{module_count}} modules; racking {{racking}}; attachment type {{attachment_type}}, at {{attachment_spacing}} spacing; layout {{array_layout}}.",
  },
  { kind: "determination", text: "" },
  {
    kind: "body",
    text: "This letter addresses the conditions documented on the date of the visit stated above and the array described above. It is not a warranty or a guarantee of any kind.",
  },
  {
    kind: "body",
    text: "This letter is void if the array changes. A change of module, count, layout, attachment pattern or standoff changes the load case, and this opinion does not carry to it.",
  },
  {
    kind: "body",
    text: "It is void if the modules, racking, attachment pattern or layout change from the array design dated {{array_design_date}}, revision {{array_design_revision}}.",
  },
  {
    kind: "body",
    text: "This letter addresses the existing structure's capacity to carry the proposed array. It does not address the array, its attachment design, its electrical work, its performance, or the weather-tightness of any penetration. It does not address wind uplift on the array or on the framing.",
  },
  { kind: "body", text: "This letter does not address the condition of the roof covering. A roof certification is a separate service of this firm." },
  {
    kind: "body",
    text: "The inspection was visual and non-destructive. Framing not visible on the date of the visit was not inspected, and what was not accessible is listed in file {{file_number}}.",
  },
  { kind: "body", text: "This letter does not forecast the future performance of the roof structure." },
  { kind: "body", text: "The recipient decides how to use this letter. This firm gives no opinion on its sufficiency for any particular permit or programme." },
] as const;

/** His own words from template 6 (marked "Stands" in the drafts document), read against his file by the proof. */
export const SOLAR_STANDING = [
  "Date: {{determination_date}}",
  "{{recipient_name}} {{recipient_address}}",
  "Re: Structural review for proposed solar array, {{property_address}}, {{county}} County, Texas File {{file_number}}",
  "{{recipient_salutation}},",
  SOLAR_LETTER_LINES[4].text,
  "The array reviewed: {{array_description}}",
  SOLAR_LETTER_OPTION.pass[0],
  SOLAR_LETTER_OPTION["repairs-required"][0],
  SOLAR_LETTER_LINES[11].text,
  SOLAR_LETTER_LINES[12].text,
  SOLAR_LETTER_LINES[14].text,
  SOLAR_LETTER_LINES[15].text,
  SOLAR_LETTER_LINES[16].text,
  SOLAR_LETTER_LINES[18].text,
] as const;

export const SOLAR_LETTER_SLOTS = [
  "determination_date",
  "recipient_name",
  "recipient_address",
  "recipient_salutation",
  "property_address",
  "county",
  "file_number",
  "visit_date",
  "evidence_count",
  "purpose_verbatim",
  "framing_type",
  "member_size",
  "member_spacing",
  "member_span",
  "adopted_code",
  "loads_used",
  "array_description",
  "array_design_date",
  "array_design_revision",
  "module_make_model",
  "module_count",
  "racking",
  "attachment_type",
  "attachment_spacing",
  "array_layout",
] as const;
export type SolarLetterSlot = (typeof SOLAR_LETTER_SLOTS)[number];
