-- ===========================================================================
-- 0035: a mistyped suppression is corrected, not merely cancelled.
--
-- Phase 12 Section 3, operator ruling at gate 2, and it closes a hole 0034
-- opened by being only half of the job.
--
-- WHAT 0034 LEFT LOST
-- --------------------
-- 0034 made a mistyped suppression voidable rather than deletable, which was
-- right, and stopped there. Consider what actually happened in the room: a
-- person rang the firm and asked not to be contacted, and somebody wrote down
-- the wrong address. Voiding the wrong row un-suppresses an address that never
-- asked for anything, which is correct, AND LEAVES THE ORIGINAL REQUEST
-- UNRECORDED. The person who rang is still hearing from the firm, and now
-- nothing anywhere says they asked not to be.
--
-- The void made the list accurate about a mistake and lost the fact the mistake
-- was made about. That is a worse failure than the typo, because the typo was
-- visible and this is not.
--
-- SO A VOID CARRIES WHAT WAS MEANT, AND THE SCHEMA WILL NOT ACCEPT ONE THAT
-- DOES NOT
-- -------------------------------------------------------------------------
-- Exactly one of two things is true of every voided row, and a check constraint
-- makes the third case impossible rather than discouraged:
--
--   replaced_by_email       The address that should have been written down.
--                           Suppressed in the same motion, so the request the
--                           caller actually made is on the list before the
--                           screen returns.
--
--   no_replacement_because  There is no correct address, and here is why. It is
--                           a real case: an operator suppresses somebody by
--                           mistake who never asked for anything at all, or a
--                           record is confused with another and there was never
--                           a request. Saying so is not the same as saying
--                           nothing.
--
-- Neither, and the row is refused. Both, and the row is refused: an address AND
-- a reason there is no address is a row nobody can read.
--
-- WHY A COLUMN RATHER THAN LEAVING IT TO THE PROSE IN voided_because
-- -------------------------------------------------------------------
-- Because prose cannot be checked. "wrong address, should have been
-- bob@example.com" is a sentence a person understands and no constraint can
-- require, and the failure it invites is the quiet one: a void typed in a hurry
-- with no replacement, on a day nobody is looking, losing a request the firm was
-- told about out loud.
-- ===========================================================================

alter table eng_marketing_suppressions
  add column if not exists replaced_by_email      text,
  add column if not exists no_replacement_because text;

/*
 * THE ROWS THAT PREDATE THE RULE, AND WHY THEY ARE NOT GUESSED AT.
 *
 * Voided rows already exist, written between 0034 and this migration, and the
 * constraint below refuses every one of them: they carry neither a replacement
 * nor a reason there is none, because there was nowhere to put either.
 *
 * Applying this without a backfill fails outright, which is the migration
 * behaving correctly and was found by running it. The temptation is to relax
 * the constraint so old rows slip through, and that would make the rule
 * advisory for exactly the rows nobody can go back and ask about.
 *
 * So they are marked as what they are. It does NOT invent a replacement: this
 * platform cannot know which address was meant, and writing a guess into a
 * consent record is worse than recording that the answer was never captured.
 */
update eng_marketing_suppressions
set no_replacement_because =
      'Voided before 0035 existed, when there was nowhere to record what was meant instead. ' ||
      'Whether the caller gave a correct address was not captured and cannot now be recovered, ' ||
      'so it is not guessed at here.'
where voided_at is not null
  and replaced_by_email is null
  and no_replacement_because is null;

/*
 * A void says what was meant, or says there was nothing to mean. Never both,
 * never neither, and never on a row that is not voided at all.
 */
alter table eng_marketing_suppressions
  drop constraint if exists eng_marketing_suppressions_void_carries_intent;

alter table eng_marketing_suppressions
  add constraint eng_marketing_suppressions_void_carries_intent
  check (
    case
      when voided_at is null
        then replaced_by_email is null and no_replacement_because is null
      else
        (replaced_by_email is not null) <> (no_replacement_because is not null)
    end
  );

/* Lowercased on the way in, the same rule the email column itself carries. */
alter table eng_marketing_suppressions
  drop constraint if exists eng_marketing_suppressions_replacement_lowercase;

alter table eng_marketing_suppressions
  add constraint eng_marketing_suppressions_replacement_lowercase
  check (replaced_by_email is null or replaced_by_email = lower(replaced_by_email));

/* And a replacement is a different address. Correcting a row to itself is a
 * void that undoes a request and records that it meant to. */
alter table eng_marketing_suppressions
  drop constraint if exists eng_marketing_suppressions_replacement_differs;

alter table eng_marketing_suppressions
  add constraint eng_marketing_suppressions_replacement_differs
  check (replaced_by_email is null or replaced_by_email <> email);

comment on column eng_marketing_suppressions.replaced_by_email is
  'The address that should have been written down, suppressed in the same motion. A void without one loses the request the caller actually made, so a check constraint requires this or no_replacement_because and refuses both together.';
comment on column eng_marketing_suppressions.no_replacement_because is
  'Why there is no correct address: somebody was suppressed who never asked, or a record was confused with another. Saying so is not the same as saying nothing, which is why it is a column and not an absence.';
