-- ===========================================================================
-- 0039: the four foreign keys 0001 declares and neither live database has.
--
-- Phase 12 Section 4, Section 0. Operator ruling, 2026-09-09, after the second
-- fingerprint found them on its first run.
--
-- WHAT WAS WRONG, AND FOR HOW LONG
-- ---------------------------------
-- 0001_ops_foundation.sql declares these four. Neither production nor
-- development has ever had them. The COLUMNS match, so the first fingerprint
-- has said since the day the two projects were split that these databases
-- agree, and on this they did not.
--
-- It is the residue of something already written down in CLAUDE.md: 0001 spent
-- a month unable to apply to an empty database while both live projects held
-- the objects it failed to create. Those objects were made by hand, and the
-- hands that made them did not make these.
--
-- THE ONE THAT MATTERS MOST
-- --------------------------
-- eng_responsible_charge_log.engineer_id -> eng_profiles ON DELETE RESTRICT.
-- That table is the firm's record of which Professional Engineer was in
-- responsible charge of what. RESTRICT is what stops an engineer being removed
-- while entries name them. Without it the database accepts the deletion, the
-- entry keeps a uuid that resolves to nobody, and the regulatory record says
-- responsible charge was held by somebody it can no longer name.
--
-- WHY NOT VALID, AND WHY THAT IS THE WHOLE POINT OF THIS MIGRATION
-- ----------------------------------------------------------------
-- Operator ruling: NO REGULATORY ROW IS EDITED TO MAKE A CONSTRAINT FIT.
--
-- Production holds 0 rows in both tables, so all four validate clean there and
-- this migration costs it nothing. Development holds 28 responsible charge rows
-- whose file_id ALL point at files that no longer exist. Those 28 are the
-- missing constraint's own residue: audits delete their fixture files, ON
-- DELETE SET NULL was never there to blank the link, and the rows kept a uuid
-- to nothing.
--
-- The obvious repair is to null those 28 file_id values and validate. That is
-- refused. Blanking a column on a responsible charge entry to make a constraint
-- apply is editing the firm's regulatory record for the convenience of a
-- migration, and the fact that these particular rows are audit residue is not
-- something this migration can know: it can only see that they are rows in that
-- table.
--
-- So every constraint goes on NOT VALID, which means it is ENFORCED FROM NOW ON
-- for every insert and every update, and simply does not re-examine what is
-- already there. Then each one is validated only where validation passes. A
-- database that cannot validate keeps the constraint, keeps its rows, and says
-- so in a notice.
--
-- WHAT NOT VALID DOES AND DOES NOT BUY
-- -------------------------------------
-- It buys the future completely: no new row can point at a profile, file or
-- document that is not there, and ON DELETE RESTRICT refuses the deletion of an
-- engineer named by any entry, old rows included, because that check runs
-- against the REFERENCED side and does not care whether the constraint was
-- validated.
--
-- It does not buy the past: the 28 existing rows on development keep their
-- dangling file_id until somebody decides what to do about them, and the ledger
-- entry names them so that decision is a decision rather than a discovery.
-- ===========================================================================

-- --------------------------------------------------------------- eng_file_events
-- The actor who did the thing. SET NULL rather than RESTRICT: a file's history
-- outliving the account of whoever acted is correct, and the entry's own body
-- carries what happened in words.
alter table eng_file_events
  drop constraint if exists eng_file_events_actor_id_fkey;
alter table eng_file_events
  add constraint eng_file_events_actor_id_fkey
  foreign key (actor_id) references eng_profiles(id) on delete set null
  not valid;

-- ------------------------------------------------- eng_responsible_charge_log
alter table eng_responsible_charge_log
  drop constraint if exists eng_responsible_charge_log_engineer_id_fkey;
alter table eng_responsible_charge_log
  add constraint eng_responsible_charge_log_engineer_id_fkey
  foreign key (engineer_id) references eng_profiles(id) on delete restrict
  not valid;

alter table eng_responsible_charge_log
  drop constraint if exists eng_responsible_charge_log_file_id_fkey;
alter table eng_responsible_charge_log
  add constraint eng_responsible_charge_log_file_id_fkey
  foreign key (file_id) references eng_files(id) on delete set null
  not valid;

alter table eng_responsible_charge_log
  drop constraint if exists eng_responsible_charge_log_document_id_fkey;
alter table eng_responsible_charge_log
  add constraint eng_responsible_charge_log_document_id_fkey
  foreign key (document_id) references eng_documents(id) on delete set null
  not valid;

/*
 * VALIDATE ONLY WHERE IT PASSES, AND SAY WHICH ONES DID NOT.
 *
 * `alter table ... validate constraint` takes a SHARE UPDATE EXCLUSIVE lock and
 * scans the table; it either succeeds or raises. Catching the raise is what
 * lets one migration file be correct on a database with clean rows and on one
 * without, which is the situation these two databases are actually in.
 *
 * The notice is not decoration. A constraint left unvalidated is a real state
 * with real consequences, and a migration that reached that state silently
 * would be one nobody could tell apart from a migration that validated.
 */
do $$
declare
  c text;
  validated int := 0;
  deferred  int := 0;
begin
  foreach c in array array[
    'eng_file_events|eng_file_events_actor_id_fkey',
    'eng_responsible_charge_log|eng_responsible_charge_log_engineer_id_fkey',
    'eng_responsible_charge_log|eng_responsible_charge_log_file_id_fkey',
    'eng_responsible_charge_log|eng_responsible_charge_log_document_id_fkey'
  ]
  loop
    begin
      execute format(
        'alter table %I validate constraint %I',
        split_part(c, '|', 1),
        split_part(c, '|', 2)
      );
      validated := validated + 1;
    exception when others then
      deferred := deferred + 1;
      raise notice
        'NOT VALIDATED: % on % (%). The constraint is in place and enforced for every new row; the existing rows that violate it are left exactly as they are, because editing a regulatory record to fit a constraint is not something a migration may decide.',
        split_part(c, '|', 2), split_part(c, '|', 1), sqlerrm;
    end;
  end loop;

  raise notice '0039: % of 4 constraints validated, % left enforced but unvalidated.', validated, deferred;
end
$$;

comment on constraint eng_responsible_charge_log_engineer_id_fkey on eng_responsible_charge_log is
  'RESTRICT. The firm''s record of who was in responsible charge must always name an engineer the database can still find. Declared in 0001 and absent from both live databases until 0039, which the first schema fingerprint could not see because the column shapes matched throughout.';
comment on constraint eng_file_events_actor_id_fkey on eng_file_events is
  'SET NULL. A file''s history outliving the account of whoever acted is correct; the entry''s own body carries what happened in words. Declared in 0001, added for real in 0039.';
