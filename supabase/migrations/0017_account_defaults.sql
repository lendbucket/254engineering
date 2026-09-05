-- ===========================================================================
-- 0017: standing answers on an account
--
-- Phase 10 Section 1.5 Section C item 6, "extend them where it is honest".
-- ===========================================================================

-- eng_customer_accounts already carries preferred_urgency, access_instructions
-- and default_counties, so the idea that an account has standing preferences is
-- not new. What was missing is somewhere to put the ones that vary by field.
--
-- WHY ONE JSONB COLUMN AND NOT THREE NAMED ONES
-- ---------------------------------------------
-- The brief names an installer's standing racking specification, a lender's
-- addressing details, and an account's usual access arrangement. Those are
-- three examples of one thing: an answer this account always gives to a
-- question data/intake-fields.ts already defines.
--
-- Three columns would be three schema changes and a fourth example next month.
-- Keyed by the SAME field ids the definition uses, one column answers all of
-- them and cannot drift from the questions, because the keys are the questions.
--
-- Not a foreign key to anything, for the same reason eng_file_inputs.field_id
-- is not: the definition is code, and a field removed from it should leave an
-- account's stored preference harmless rather than cascading.
alter table eng_customer_accounts
  add column if not exists default_answers jsonb not null default '{}'::jsonb;

comment on column eng_customer_accounts.default_answers is
  'Standing answers keyed by field id from data/intake-fields.ts. One column rather than a named column per example, because the keys are the questions and cannot drift from them.';
