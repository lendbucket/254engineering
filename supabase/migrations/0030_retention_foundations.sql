-- ---------------------------------------------------------------------------
-- 0030: two things retention cannot be built without.
--
-- Phase 12 Section 3. A foreign key that would let retention undo Section 2's
-- work, and the permission that lets a retention run actually delete.
-- ---------------------------------------------------------------------------


-- --------------------------------------------------------------------------
-- 1. A LEDGER ENTRY WHOSE FILE IS GONE CANNOT BE SCOPED.
--
-- Operator ruling, 2026-09-09.
--
-- Both ledgers carry file_id with ON DELETE SET NULL, and Section 2 scopes a
-- person's pay figures THROUGH THAT FILE: an entry is a demonstration when the
-- work it is about is, and an entry with no file is COUNTED, deliberately,
-- because file_id is nullable and an inner join would quietly reduce somebody's
-- pay.
--
-- Put those two facts together and retention deleting a demonstration file
-- nulls its ledger entries' file_id, and that money starts counting in a real
-- person's pay figures. Retention would silently undo the scoping built three
-- days earlier, and nothing would report it.
--
-- SET NULL becomes RESTRICT. The consequence is accepted rather than worked
-- around: a demonstration file WITH EARNINGS is kept, permanently, and is_demo
-- keeps it out of every figure. Retention refuses such a file and names the
-- ledger entries as the reason.
--
-- The trade is deliberate. An undeleted demonstration file costs a row. An
-- unscopable money row costs somebody the right number on their own pay.
--
-- WHY THIS IS SAFE TO RUN
-- Neither ledger has any row on either database today, and production has no
-- files at all, so nothing existing can violate the new constraint. It is
-- applied now precisely because that is true: the same change made after the
-- firm is trading would have to reconcile live rows first.
-- --------------------------------------------------------------------------

alter table eng_production_ledger
  drop constraint if exists eng_production_ledger_file_id_fkey;
alter table eng_production_ledger
  add constraint eng_production_ledger_file_id_fkey
  foreign key (file_id) references eng_files(id) on delete restrict;

alter table eng_tech_pay_ledger
  drop constraint if exists eng_tech_pay_ledger_file_id_fkey;
alter table eng_tech_pay_ledger
  add constraint eng_tech_pay_ledger_file_id_fkey
  foreign key (file_id) references eng_files(id) on delete restrict;

comment on constraint eng_production_ledger_file_id_fkey on eng_production_ledger is
  'RESTRICT rather than SET NULL: a ledger entry whose file is gone cannot be scoped for is_demo, and an unscopable money row is worse than an undeleted demonstration file. Phase 12 Section 3.';

comment on constraint eng_tech_pay_ledger_file_id_fkey on eng_tech_pay_ledger is
  'RESTRICT rather than SET NULL, for the reason on eng_production_ledger.';


-- --------------------------------------------------------------------------
-- 2. DELETING IS A PERMISSION, AND ONLY THE ADMINISTRATOR HOLDS IT.
--
-- `retention.execute` is what turns a retention job from a dry run into a run
-- that removes rows. It is separate from every other grant on purpose: nothing
-- else in this platform destroys a record, so nothing else should imply the
-- right to.
--
-- Admin only. Not customer service, who hold suppressions.manage and take
-- deletion REQUESTS from customers; a request produces a task, and the deletion
-- itself is a retention job an administrator runs. The two are different acts
-- and this is where that separation is enforced.
-- --------------------------------------------------------------------------

insert into eng_role_grants (role_key, action) values
  ('admin', 'retention.execute')
on conflict (role_key, action) do nothing;
