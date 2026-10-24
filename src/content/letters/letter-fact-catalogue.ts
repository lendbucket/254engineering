/**
 * ===========================================================================
 * THE FACTS THE MANUFACTURED HOME, SOLAR AND WPI-8E DOCUMENTS PRINT, AND WHO
 * RECORDS EACH. Migration 0087, Robert's instruction of 2026-10-24.
 * ===========================================================================
 *
 * Each fact here is one the engineer's signed protocol (section 11) requires
 * the document to contain and the platform did not hold. The list is the one
 * posted on issue #1 on 2026-10-24 and repeated in section 5 of the drafts
 * document sent for his adoption. Facts the platform already holds are not
 * here and are never recorded twice: the inspection dates (eng_evidence_items),
 * the evidence relied on (the determination), the repair list.
 *
 * WHO RECORDS EACH IS THE ENGINEER'S CALL, AND NOT YET MADE. The default
 * below, until he rules: the office records what the customer or TDI states
 * (the ZIP, the Application ID, the purpose as stated); the engineer records,
 * at review, everything observed, measured or determined. 0087's capacity
 * check holds exactly this list, and the proof compares the two.
 *
 * No document prints any of these yet. A letter prints only from a template he
 * has signed (0088), and these three have none.
 */

export type FactCapacity = "office" | "engineer";
export type CatalogueLine = "254-MH-001" | "254-SL-001" | "254-WS-001";

export type CatalogueFact = {
  key: string;
  line: CatalogueLine;
  label: string;
  capacity: FactCapacity;
  /** Where the value is one of a fixed few, the few. */
  values?: readonly string[];
};

export const LETTER_FACT_CATALOGUE: readonly CatalogueFact[] = [
  /* 254-MH-001 section 11. */
  { key: "manufacturer", line: "254-MH-001", label: "Manufacturer", capacity: "engineer" },
  { key: "serial_number", line: "254-MH-001", label: "Serial number", capacity: "engineer" },
  { key: "hud_label_numbers", line: "254-MH-001", label: "HUD label numbers", capacity: "engineer" },
  { key: "date_of_manufacture", line: "254-MH-001", label: "Date of manufacture", capacity: "engineer" },
  { key: "section_count", line: "254-MH-001", label: "Sections", capacity: "engineer", values: ["single-section", "multi-section"] },
  { key: "foundation_as_observed", line: "254-MH-001", label: "Foundation and support system as observed", capacity: "engineer" },
  { key: "anchorage_as_observed", line: "254-MH-001", label: "Anchorage as observed", capacity: "engineer" },
  { key: "additions_as_observed", line: "254-MH-001", label: "Additions to the home", capacity: "engineer" },
  { key: "named_requirement", line: "254-MH-001", label: "The requirement certified against, where it is not HUD-7584", capacity: "engineer" },

  /* 254-SL-001 section 11. */
  { key: "purpose_verbatim", line: "254-SL-001", label: "Purpose, as stated when ordered", capacity: "office" },
  { key: "survey_date", line: "254-SL-001", label: "Date of the installer's site survey", capacity: "engineer" },
  { key: "framing_type", line: "254-SL-001", label: "Roof framing type", capacity: "engineer" },
  { key: "member_size", line: "254-SL-001", label: "Member size", capacity: "engineer" },
  { key: "member_spacing", line: "254-SL-001", label: "Member spacing", capacity: "engineer" },
  { key: "member_span", line: "254-SL-001", label: "Member span", capacity: "engineer" },
  { key: "adopted_code", line: "254-SL-001", label: "Adopted code", capacity: "engineer" },
  { key: "loads_used", line: "254-SL-001", label: "Loads used", capacity: "engineer" },
  { key: "array_design_date", line: "254-SL-001", label: "Array design date", capacity: "engineer" },
  { key: "array_design_revision", line: "254-SL-001", label: "Array design revision", capacity: "engineer" },
  { key: "module_make_model", line: "254-SL-001", label: "Module make and model", capacity: "engineer" },
  { key: "module_count", line: "254-SL-001", label: "Module count", capacity: "engineer" },
  { key: "racking", line: "254-SL-001", label: "Racking", capacity: "engineer" },
  { key: "attachment_type", line: "254-SL-001", label: "Attachment type", capacity: "engineer" },
  { key: "attachment_spacing", line: "254-SL-001", label: "Attachment spacing", capacity: "engineer" },
  { key: "array_layout", line: "254-SL-001", label: "Layout", capacity: "engineer" },
  { key: "array_description", line: "254-SL-001", label: "The array, as the letter describes it", capacity: "engineer" },

  /* 254-WS-001 sections 10 and 11, and 28 TAC 5.4604(b). */
  { key: "zip", line: "254-WS-001", label: "ZIP", capacity: "office" },
  { key: "tdi_application_id", line: "254-WS-001", label: "TDI Application ID", capacity: "office" },
  {
    key: "certification_scope", line: "254-WS-001", label: "Certification scope", capacity: "engineer",
    values: ["roof-covering", "building-products", "entire-building-or-addition"],
  },
  { key: "applicable_code", line: "254-WS-001", label: "Applicable code", capacity: "engineer" },
  { key: "wind_speed", line: "254-WS-001", label: "Wind speed", capacity: "engineer" },
  { key: "risk_category", line: "254-WS-001", label: "Risk category", capacity: "engineer", values: ["I", "II", "III", "IV"] },
  { key: "exposure_category", line: "254-WS-001", label: "Exposure category", capacity: "engineer", values: ["B", "C", "D"] },
  { key: "design_pressures", line: "254-WS-001", label: "Required design pressures", capacity: "engineer" },
  { key: "products_with_evaluations", line: "254-WS-001", label: "Each product in scope, with its evaluation", capacity: "engineer" },
  { key: "opened_locations", line: "254-WS-001", label: "Where concealed work was opened", capacity: "engineer" },
  { key: "noncompliance_reasons", line: "254-WS-001", label: "Why the improvement does not comply", capacity: "engineer" },
] as const;

export const catalogueFact = (key: string) => LETTER_FACT_CATALOGUE.find((f) => f.key === key) ?? null;
