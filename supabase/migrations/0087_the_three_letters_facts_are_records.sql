/*
 * ===========================================================================
 * 0087  WHAT THE MANUFACTURED HOME, SOLAR AND WPI-8E DOCUMENTS PRINT IS A
 *       RECORD, EACH FACT RECORDED BY WHOEVER IS NAMED FOR IT.
 * ===========================================================================
 *
 * Robert's instruction of 2026-10-24: build the records for every fact listed
 * on issue #1 (the 0085 pattern), no letters. The facts are those 254-MH-001,
 * 254-SL-001 and 254-WS-001 section 11 require their documents to contain and
 * the platform did not hold. They are declared once, with who records each, in
 * src/content/letters/letter-fact-catalogue.ts; the lists below were emitted
 * from it, and the proof compares the two.
 *
 * WHO RECORDS EACH IS THE ENGINEER'S CALL AND IS NOT YET MADE. Until he rules,
 * the office records what the customer or TDI states (the ZIP, the TDI
 * Application ID, the purpose as stated) and the engineer records at review
 * everything observed, measured or determined. A ruling that moves a fact is a
 * new migration that widens or narrows these checks.
 *
 * WHAT THIS DOES
 *   1. eng_letter_facts' fact check widened from 0085's four to 41.
 *   2. Its capacity check widened the same way: five office facts, 36 engineer
 *      facts, the 0085 four keeping exactly the capacities ruled for them.
 *   3. The facts with a fixed few values hold to them.
 *
 * Each check is dropped and re-added widened in one statement, the 0082
 * pattern. No row on development or production can fail the wider checks,
 * because every row today carries one of 0085's four facts. No table, no
 * column, no function, no trigger is added.
 */

alter table eng_letter_facts
  drop constraint if exists eng_letter_facts_fact_check,
  add constraint eng_letter_facts_fact_check check (fact in (
      'authority_address', 'authority_salutation', 'purpose_verbatim', 'zip', 'tdi_application_id',
      'foundation_type', 'element_described', 'manufacturer', 'serial_number', 'hud_label_numbers',
      'date_of_manufacture', 'section_count', 'foundation_as_observed', 'anchorage_as_observed',
      'additions_as_observed', 'named_requirement', 'survey_date', 'framing_type', 'member_size',
      'member_spacing', 'member_span', 'adopted_code', 'loads_used', 'array_design_date',
      'array_design_revision', 'module_make_model', 'module_count', 'racking', 'attachment_type',
      'attachment_spacing', 'array_layout', 'array_description', 'certification_scope',
      'applicable_code', 'wind_speed', 'risk_category', 'exposure_category', 'design_pressures',
      'products_with_evaluations', 'opened_locations', 'noncompliance_reasons'
  ));

alter table eng_letter_facts
  drop constraint if exists eng_letter_facts_capacity_ck,
  add constraint eng_letter_facts_capacity_ck check (
    (fact in ('authority_address', 'authority_salutation', 'purpose_verbatim', 'zip', 'tdi_application_id')
      and capacity = 'office')
    or (fact in (
      'foundation_type', 'element_described', 'manufacturer', 'serial_number', 'hud_label_numbers',
      'date_of_manufacture', 'section_count', 'foundation_as_observed', 'anchorage_as_observed',
      'additions_as_observed', 'named_requirement', 'survey_date', 'framing_type', 'member_size',
      'member_spacing', 'member_span', 'adopted_code', 'loads_used', 'array_design_date',
      'array_design_revision', 'module_make_model', 'module_count', 'racking', 'attachment_type',
      'attachment_spacing', 'array_layout', 'array_description', 'certification_scope',
      'applicable_code', 'wind_speed', 'risk_category', 'exposure_category', 'design_pressures',
      'products_with_evaluations', 'opened_locations', 'noncompliance_reasons'
    ) and capacity = 'engineer')
  );

alter table eng_letter_facts
  add constraint eng_letter_facts_values_ck check (
    (fact <> 'section_count' or value in ('single-section', 'multi-section'))
    and (fact <> 'certification_scope' or value in ('roof-covering', 'building-products', 'entire-building-or-addition'))
    and (fact <> 'risk_category' or value in ('I', 'II', 'III', 'IV'))
    and (fact <> 'exposure_category' or value in ('B', 'C', 'D'))
  );

comment on table eng_letter_facts is
  'Facts a sealed letter or report prints that the platform did not otherwise hold, each recorded by the office or the engineer as the rulings say: 0085 for the foundation and permit letters (2026-10-23), 0087 for the manufactured home, solar and WPI-8E documents (2026-10-24, capacities by default until the engineer rules). The newest row for a file and fact is the value. Append only.';
