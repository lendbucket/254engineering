/**
 * THE FOUNDATION CERTIFICATION LETTER, IN THE ENGINEER OF RECORD'S WORDS.
 *
 * Template 4 of 8 of his answered letter templates file, the 2026-10-06 file
 * (`254_Letter_Templates.docx`), section 5.3. Every line below is his text,
 * carried exactly; `scripts/proofs/the-foundation-letter-is-his-words.mjs`
 * compares each one against the file itself.
 *
 * What the firm decided, not he (operator rulings of 2026-10-23):
 *   FC-1  pass gives option A; repairs required gives option B; a decline
 *         recorded at review after the inspection evidence is in gives option
 *         C, a sealed letter with his stated reason; revise and site revisit
 *         give no letter. A decline before dispatch is an email and a refund,
 *         never a letter.
 *   FC-4  crawlspace takes his second method sentence, the one naming the
 *         crawlspace inspection, as pier and beam does. Choosing between his
 *         two sentences is not editing his text.
 *   FC-2, FC-3  the recipient, the purpose and the foundation type come from
 *         the file (intake, and the type as he confirmed it at review).
 *
 * "Observed condition:" is followed by his own words, written at sealing in his
 * session: "The platform will not write this. It is the engineering finding
 * the letter exists to carry."
 */
export const FOUNDATION_LETTER_SECTION = "5.3 Body, Template 4 of 8: Foundation certification letter";

/** The option sentence for each determination that produces a letter (FC-1). */
export const FOUNDATION_LETTER_OPTION_SENTENCE = {
  /* [ENGINEER: option A] */
  pass: "Based on the evidence recorded, the slope, the levelness between survey points and the crack widths measured were within the limits of the protocol, and no condition requiring repair was observed as of the date of inspection.",
  /* [ENGINEER: option B] */
  "repairs-required":
    "Based on the evidence recorded, the conditions described above were observed and require repair. Certification is withheld until the repairs are made and verified. This letter does not specify the repair.",
  /* [ENGINEER: option C], a decline recorded at review after the evidence is in (FC-1) */
  decline: "Based on the evidence recorded, this firm declines to certify the foundation. The reason is stated above.",
} as const;
export type FoundationLetterDetermination = keyof typeof FOUNDATION_LETTER_OPTION_SENTENCE;

/** His two method values, and which foundation type takes which (FC-4). */
export const FOUNDATION_LETTER_METHOD = {
  visual: "Visual inspection with relative elevation survey.",
  crawlspace: "Visual inspection with relative elevation survey and crawlspace inspection.",
} as const;
export function methodFor(foundationType: string): string | null {
  if (foundationType === "slab-on-grade") return FOUNDATION_LETTER_METHOD.visual;
  if (foundationType === "pier-and-beam" || foundationType === "crawlspace") return FOUNDATION_LETTER_METHOD.crawlspace;
  return null;
}

/**
 * The lines, in his order. `observed` is where his written finding goes after
 * "Observed condition:", and `determination` where the option sentence goes.
 */
export const FOUNDATION_LETTER_LINES = [
  { kind: "date", text: "Date: {{determination_date}}" },
  { kind: "recipient", text: "{{recipient_name}} {{recipient_address}}" },
  { kind: "re", text: "Re: Foundation inspection, {{property_address}}, {{county}} County, Texas File {{file_number}}" },
  { kind: "salutation", text: "{{recipient_salutation}}," },
  {
    kind: "body",
    text: "This letter is addressed to {{recipient_name}} for the purpose recorded at intake: {{purpose_verbatim}}. It is issued for that recipient and that purpose only.",
  },
  {
    kind: "body",
    text: "At the request of {{requestor_name}}, this firm inspected the foundation of the property at {{property_address}} in {{county}} County, Texas, on {{inspection_date}}.",
  },
  { kind: "body", text: "Foundation type: {{foundation_type}} Method of inspection: {{method}}" },
  {
    kind: "body",
    text: "The inspection was performed to protocol {{protocol_number}} version {{protocol_version}}. {{evidence_count}} items of evidence were recorded against that protocol and are retained in file {{file_number}}.",
  },
  { kind: "body", text: "Observed condition:" },
  { kind: "observed", text: "" },
  { kind: "determination", text: "" },
  { kind: "heading", text: "Scope and limitations" },
  {
    kind: "body",
    text: "This letter is addressed only to the recipient and for the purpose recorded at intake and stated above. No other party may rely on it without the written consent of this firm.",
  },
  { kind: "body", text: "The inspection was visual and non-invasive." },
  { kind: "body", text: "This letter reflects the conditions observed on {{inspection_date}} only." },
  { kind: "body", text: "This firm makes no representation about concealed conditions or conditions below grade." },
  { kind: "body", text: "This letter contains no forecast of future movement." },
  { kind: "body", text: "This letter is not a warranty or a guarantee of any kind." },
  {
    kind: "body",
    text: "Items the protocol required that were not observed, and the reason recorded for each: {{items_not_observed}}.",
  },
] as const;

/** Every slot the lines name. A draft that cannot fill one is refused, never sealed with a gap. */
export const FOUNDATION_LETTER_SLOTS = [
  "determination_date",
  "recipient_name",
  "recipient_address",
  "recipient_salutation",
  "property_address",
  "county",
  "file_number",
  "purpose_verbatim",
  "requestor_name",
  "inspection_date",
  "foundation_type",
  "method",
  "protocol_number",
  "protocol_version",
  "evidence_count",
  "items_not_observed",
] as const;
export type FoundationLetterSlot = (typeof FOUNDATION_LETTER_SLOTS)[number];
