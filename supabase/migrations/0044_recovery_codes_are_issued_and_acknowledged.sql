-- ============================================================================
-- RECOVERY CODES ARE ISSUED AT A TIME, AND SAVING THEM IS A FACT RATHER THAN A
-- DISABLED BUTTON.
-- ============================================================================
--
-- Operator instruction, 2026-09-13, the third of three ordered after the
-- production lockout:
--
--   "Recovery codes: on enrolment the flow does not complete until I confirm I
--    have saved them, and the record notes when they were last issued."
--
-- WHAT WAS ALREADY THERE, AND WHY IT WAS NOT ENOUGH
-- -------------------------------------------------
-- The enrolment screen already showed the codes with a checkbox reading "I have
-- saved these codes somewhere I can reach without my phone", and the continue
-- button was disabled until it was ticked. That is a real piece of design and
-- it protected nothing, because the FULL SESSION had already been issued by the
-- call that showed the codes. The enrolment was complete, the account was
-- enrolled, and the only thing the checkbox governed was a redirect the person
-- could perform by typing a URL.
--
-- So the acknowledgement moves to the server and becomes a row. `confirm` now
-- stops at the codes, and a second call carrying the acknowledgement is what
-- issues the session. The flow genuinely does not complete until it arrives.
--
-- WHY TWO COLUMNS AND NOT ONE
-- ----------------------------
-- They answer different questions and one cannot be derived from the other.
--
--   recovery_codes_issued_at        when this account was last handed a set.
--   recovery_codes_acknowledged_at  when somebody said they had saved them.
--
-- Issued and never acknowledged is the state that matters: an account holding
-- ten codes that nobody wrote down, which is indistinguishable from an account
-- with no recovery path at all until the day somebody needs one. On 2026-09-13
-- that was the operator's own account, and nothing anywhere recorded it.
--
-- Acknowledged is not proof the codes were saved. Nothing can be. What it is
-- is the difference between a person who was asked and answered and a person
-- who closed the tab, and that difference is readable now.
--
-- WHY NOT A COUNT OR A DERIVED VALUE
-- -----------------------------------
-- eng_mfa_recovery_codes already carries created_at per code, so the issue time
-- looks derivable. It is not, once codes are spent: a used code is marked
-- rather than deleted, but a REISSUE deletes the old set outright, and the
-- moment a set is replaced the old created_at values are gone. Deriving would
-- also make a fact about the ENROLMENT live in a table about individual codes,
-- and the acknowledgement has no per code home at all.
--
-- BOTH ARE NULLABLE, and every enrolment that exists today has null in both.
-- That is honest rather than convenient: the platform does not know when those
-- codes were issued, and backfilling created_at from the code rows would invent
-- an acknowledgement that never happened.

alter table eng_mfa_enrolments
  add column if not exists recovery_codes_issued_at timestamptz;

alter table eng_mfa_enrolments
  add column if not exists recovery_codes_acknowledged_at timestamptz;

comment on column eng_mfa_enrolments.recovery_codes_issued_at is
  'When this account was last handed a set of recovery codes. Null on every enrolment made before 2026-09-13, because the platform did not record it and inventing a date would be worse than not knowing.';

comment on column eng_mfa_enrolments.recovery_codes_acknowledged_at is
  'When somebody confirmed they had saved the codes. Issued with this null is an account whose recovery path nobody wrote down, which is the state that turns a lost phone into a lost account.';
