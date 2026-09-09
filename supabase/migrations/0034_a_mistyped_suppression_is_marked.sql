-- ===========================================================================
-- 0034: correcting a mistyped suppression without deleting a consent record.
--
-- Phase 12 Section 3, and it repairs something 0032 broke the same day.
--
-- WHAT BROKE
-- -----------
-- 0032 attached a delete refusal to eng_marketing_suppressions, on the ruling
-- that a consent record is never deletable. It is right. It also broke a screen
-- that had shipped and been approved: /portal/suppressions has a Remove action
-- for exactly one case, an operator taking a request over the telephone and
-- typing the address wrong, and `removeOperatorEntry` implemented it as a
-- DELETE.
--
-- Verified rather than reasoned about. With the service role, on development,
-- removing an operator entered suppression now answers:
--
--   "eng_marketing_suppressions rows cannot be deleted. It is a money or
--    consent record, and a correction is a new row rather than a removed one."
--
-- The person taking the call would have seen that sentence and had no way
-- forward, and the customer they mistyped would have gone on hearing nothing.
--
-- WHY THE ANSWER IS NOT TO PUT THE DELETE BACK
-- ---------------------------------------------
-- The trigger's own message says what to do instead, and it is better than what
-- was there. A deleted typo left NO TRACE that anybody had mistyped: the
-- address vanished and the mistake with it. Marking it keeps both facts, that
-- somebody was suppressed and that it was wrong, which is what an audit of the
-- firm's marketing consent would actually want to see.
--
-- So the row stays and gains three columns saying it was a mistake, who said
-- so, and when. `isSuppressed` ignores a voided row, so the customer starts
-- hearing from the firm again, which is the outcome the screen was for.
--
-- THE ONE THING THIS MUST NEVER DO, AND IT IS A CONSTRAINT RATHER THAN A CHECK
-- ----------------------------------------------------------------------------
-- A row carrying a token_hash came from a person clicking the unsubscribe link
-- in an email addressed to them. That is the strongest evidence this system has
-- of anything, and voiding it would be the platform asserting a consent nobody
-- gave. `removeOperatorEntry` already refused that case in application code.
-- Here it becomes UNREPRESENTABLE: a check constraint means there is no row
-- that is both clicked and voided, so a screen that forgot the filter, a script,
-- or a console cannot produce one.
--
-- That is the same construction LicensedAction uses in ops-authz and for the
-- same reason: an exclusion enforced by a filter is an exclusion somebody can
-- delete.
-- ===========================================================================

alter table eng_marketing_suppressions
  add column if not exists voided_at      timestamptz,
  add column if not exists voided_because text,
  add column if not exists voided_by      uuid references eng_profiles(id) on delete set null;

/*
 * A clicked suppression can never be voided. Not "is not", cannot be.
 */
alter table eng_marketing_suppressions
  drop constraint if exists eng_marketing_suppressions_clicked_stays;

alter table eng_marketing_suppressions
  add constraint eng_marketing_suppressions_clicked_stays
  check (voided_at is null or token_hash is null);

/*
 * And a void says why. A row marked as a mistake with no reason is a row the
 * next reader cannot tell from a row somebody voided to make a number look
 * better.
 */
alter table eng_marketing_suppressions
  drop constraint if exists eng_marketing_suppressions_void_says_why;

alter table eng_marketing_suppressions
  add constraint eng_marketing_suppressions_void_says_why
  check (voided_at is null or (voided_because is not null and length(btrim(voided_because)) > 0));

create index if not exists eng_marketing_suppressions_live
  on eng_marketing_suppressions (email) where voided_at is null;

comment on column eng_marketing_suppressions.voided_at is
  'Set when an operator entered row was a typing mistake. The row stays, because a consent record is never deleted, and isSuppressed ignores it so the address hears from the firm again. Never set on a row with a token_hash: a check constraint makes that unrepresentable rather than filtered.';
comment on column eng_marketing_suppressions.voided_because is
  'Why it was a mistake, in the words of whoever said so. Required by a check constraint, because a void with no reason cannot be told from one made to move a number.';
comment on column eng_marketing_suppressions.voided_by is
  'Who marked it. Null only if that profile is later removed.';
