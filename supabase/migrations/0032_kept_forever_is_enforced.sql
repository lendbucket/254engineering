-- ===========================================================================
-- 0032: the tables the declaration calls kept forever now refuse to be deleted
-- from, because a rule the database does not hold is a rule somebody can edit.
--
-- Phase 12 Section 3, operator ruling 2026-09-09, and it exists because of a
-- defect found by reading `retention-policy.ts` against `pg_constraint`.
--
-- WHAT WAS WRONG
-- ---------------
-- Twenty two tables were declared kept forever. Fifteen were held by a delete
-- refusing trigger or by an inbound ON DELETE RESTRICT. Seven were held by
-- nothing but the declaration itself, and THREE OF THOSE SEVEN SAID IN WRITING
-- THAT A FOREIGN KEY KEPT THEM, citing the key they hold on eng_profiles.
--
-- That sentence was true and it was about the wrong table. An outbound
-- reference with ON DELETE RESTRICT protects the table it POINTS AT: it keeps
-- eng_profiles, and does nothing whatever to stop a row in the ledger being
-- deleted. All three ledgers would have handed over every row to a plain
-- DELETE while the declaration read like a guarantee.
--
-- THE RULING
-- -----------
-- The declaration and the schema must say the same thing. So the five tables
-- that hold money or consent get a trigger now, because no ruling will ever
-- make them deletable, and the two that hold engineering evidence get a
-- NARROWER trigger, because their rows are not all in the same position.
--
-- WHAT THIS DOES NOT DO, SAID PLAINLY
-- ------------------------------------
-- It does not make retention safer. Retention already refused all seven, and
-- refuses everything the declaration does not mark `delete_after`. What it
-- stops is somebody with the service role, a migration, or a console, doing by
-- hand what retention was never going to do. The declaration was a promise
-- with nothing underneath it, and this is what goes underneath it.
-- ===========================================================================


-- --------------------------------------------------------------------------
-- 1. MONEY AND CONSENT. FIVE TABLES, NO CONDITION, NO EXCEPTION.
--
-- One function rather than five, and the message names the table it fired on,
-- because five identical functions are five places somebody has to remember to
-- change. `retention-policy.ts` cites this function by name for all five and
-- `migration-audit` compares the citation against the trigger actually
-- attached, so a rule naming a function that is not there fails the board.
--
-- Why each one:
--
--   eng_production_ledger   What an engineer is owed.
--   eng_tech_pay_ledger     What a technician is owed.
--   eng_time_log            The hours a person is paid for.
--   eng_marketing_suppressions  Somebody asked not to be written to. Deleting
--                           the row does not undo the asking, it resumes the
--                           writing, which is the one outcome that cannot be
--                           taken back once an email has gone.
--   eng_metrics_daily       The rollup that OUTLIVES its sources. A retention
--                           floor deletes cron rows once this table holds the
--                           day, so deleting a row here destroys the only
--                           remaining record of a day whose source is gone.
--                           It is the one table in this list that retention
--                           itself makes irreplaceable.
--
-- A correction is a new row, never a removed one. That is the same rule
-- eng_order_payments has carried since 0006: record a refund, do not delete the
-- charge.
-- --------------------------------------------------------------------------

create or replace function eng_forbid_record_delete()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  raise exception
    '% rows cannot be deleted. It is a money or consent record, and a correction is a new row rather than a removed one.',
    tg_table_name;
end;
$fn$;

drop trigger if exists eng_production_ledger_no_delete on eng_production_ledger;
create trigger eng_production_ledger_no_delete before delete on eng_production_ledger
  for each row execute function eng_forbid_record_delete();

drop trigger if exists eng_tech_pay_ledger_no_delete on eng_tech_pay_ledger;
create trigger eng_tech_pay_ledger_no_delete before delete on eng_tech_pay_ledger
  for each row execute function eng_forbid_record_delete();

drop trigger if exists eng_time_log_no_delete on eng_time_log;
create trigger eng_time_log_no_delete before delete on eng_time_log
  for each row execute function eng_forbid_record_delete();

drop trigger if exists eng_marketing_suppressions_no_delete on eng_marketing_suppressions;
create trigger eng_marketing_suppressions_no_delete before delete on eng_marketing_suppressions
  for each row execute function eng_forbid_record_delete();

drop trigger if exists eng_metrics_daily_no_delete on eng_metrics_daily;
create trigger eng_metrics_daily_no_delete before delete on eng_metrics_daily
  for each row execute function eng_forbid_record_delete();


-- --------------------------------------------------------------------------
-- 2. SEALED WORK. A CONDITION, BECAUSE THESE ROWS ARE NOT ALL ALIKE.
--
-- The operator's ruling separates them from the five above: the evidence
-- binder of a SEALED file is kept forever and no configuration may shorten it,
-- while evidence on an unsealed file has no ruling yet and sits under pending
-- counsel with everything else. A blanket refusal would have decided the
-- second question by accident.
--
-- WHAT COUNTS AS SEALED: a row in eng_documents for that file with sealed_at
-- set. That column is the platform's whole record of sealing, written when a
-- named Professional Engineer's own sealed deliverable is UPLOADED. Nothing
-- here composes a seal and nothing here ever will; see CLAUDE.md section 1.
--
-- IT ALSO BLOCKS THE CASCADE, AND THAT IS THE POINT. Both tables reference
-- eng_files with ON DELETE CASCADE, and a BEFORE DELETE trigger fires on rows
-- removed by a cascade exactly as it does on a direct delete. So deleting a
-- sealed FILE is refused too, by the evidence it would have taken with it.
--
-- THESE TWO TRIGGERS REFUSE NOTHING TODAY, AND THAT IS SAID OUT LOUD RATHER
-- THAN LEFT TO BE DISCOVERED. The firm's TBPELS registration is pending, no
-- licensed PE is on staff, and nothing in this platform is sealed or can be.
-- Every row in both tables is therefore deletable right now, and will stop
-- being deletable the moment the first sealed deliverable is uploaded against
-- its file. That is the intended behaviour and not a gap: the rule is about
-- sealed work, and there is none yet.
--
-- Because they cannot be exercised against live data without writing a
-- fabricated regulatory record, which is forbidden, they are proved inside
-- migration-audit's replayed database, which is thrown away. That is the same
-- treatment eng_partner_entries has had since 0019 and for the same reason.
-- --------------------------------------------------------------------------

create or replace function eng_forbid_sealed_work_delete()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  sealed boolean;
begin
  /*
   * A sealed deliverable defends ITSELF whatever file it hangs off, and every
   * other row belonging to a file that has one is defended by that file.
   *
   * THE COLUMN IS READ THROUGH to_jsonb AND NOT AS old.sealed_at. One function
   * serves two tables and only one of them has that column, and plpgsql raises
   * `record "old" has no field "sealed_at"` when the row is an evidence item,
   * whatever the guard beside it says: the field reference is resolved when the
   * expression runs rather than being skipped by the AND. Caught by the
   * unsealed half of the proof in migration-audit, which is exactly what that
   * half is for. to_jsonb answers null for a key the row does not have.
   */
  if tg_table_name = 'eng_documents' and (to_jsonb(old) ->> 'sealed_at') is not null then
    raise exception
      'eng_documents row % is a sealed deliverable and cannot be deleted. A seal is a Professional Engineer''s own act and the record of it outlives everything else.',
      old.id;
  end if;

  select exists (
    select 1 from public.eng_documents d
    where d.file_id = old.file_id and d.sealed_at is not null
  ) into sealed;

  if sealed then
    raise exception
      '% rows belonging to file % cannot be deleted, because that file has a sealed deliverable and its evidence is kept with it.',
      tg_table_name, old.file_id;
  end if;

  return old;
end;
$fn$;

drop trigger if exists eng_documents_no_sealed_delete on eng_documents;
create trigger eng_documents_no_sealed_delete before delete on eng_documents
  for each row execute function eng_forbid_sealed_work_delete();

drop trigger if exists eng_evidence_items_no_sealed_delete on eng_evidence_items;
create trigger eng_evidence_items_no_sealed_delete before delete on eng_evidence_items
  for each row execute function eng_forbid_sealed_work_delete();


comment on function eng_forbid_record_delete() is
  'Refuses DELETE outright. Attached to the money and consent records: both ledgers, the time log, the suppression list and the daily rollup. A correction is a new row rather than a removed one.';
comment on function eng_forbid_sealed_work_delete() is
  'Refuses DELETE for a sealed deliverable and for anything belonging to a file that has one, including a delete cascading from eng_files. Evidence on an unsealed file is untouched, because that question is still with counsel.';
