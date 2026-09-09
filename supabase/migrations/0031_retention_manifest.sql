-- ===========================================================================
-- 0031: what a retention run intended, written down before it touches a row.
--
-- Phase 12 Section 3. This is the only table in the schema whose purpose is to
-- make a DELETION accountable, and everything about its shape follows from
-- that one job.
--
-- THE ORDER IS THE WHOLE DESIGN
-- ------------------------------
-- The manifest is written FIRST and the rows go SECOND. A run that recorded
-- what it had done afterwards would be a run whose crash leaves no evidence at
-- all: rows gone, nothing saying which, nobody able to answer what was
-- removed. Written first, a crash leaves a planned run naming exactly what it
-- was about to take, and the resume picks it up rather than starting again
-- against a set that has moved underneath it.
--
-- WHAT IT HAS TO CARRY, AND WHY EACH ONE
-- ---------------------------------------
--   table_name, rule, floor_days, age_column, cutoff
--       The policy AS IT WAS when the run was planned. Copied rather than
--       looked up later, because retention-policy.ts is a file somebody edits
--       and a manifest that read today's floor would describe a run that never
--       happened.
--   intended_count, id_low, id_high, id_hash
--       The SET. The range says where it lived and the hash says which rows
--       exactly, so a set that changed between planning and running is caught
--       rather than deleted. A count alone would not: two different thousand
--       row sets have the same count.
--   rollup_metric, rollup_days
--       The operator's ruling that a source is never deleted before the thing
--       that replaces it exists AND reconciles. Verified at planning time and
--       recorded here per day, so a resume trusts what was proved rather than
--       re-proving it against a table this run has already taken rows out of.
--   mode
--       dry_run or execute, and it is a MODE rather than a flag. A boolean
--       defaulting to false is one missing argument away from a real deletion.
--   actor_id, actor_email, actor_role
--       Who authorised it. An execute run cannot exist without one; a dry run
--       records whoever asked for it.
--   planned_at, planned_at_ct
--       Both, and the second is written by the DATABASE rather than by the
--       application. The operator reads Central time, the column stores UTC,
--       and a stamp formatted in the app is a stamp that can disagree with the
--       instant beside it after a deploy from a machine in another timezone.
--
-- WHY IT REFUSES DELETE BUT ALLOWS UPDATE
-- ----------------------------------------
-- Append only would make the table unusable: the run's own progress, its
-- outcome and its reconciliation are all updates to the row that planned it.
-- What must never happen is a manifest DISAPPEARING, because a retention run
-- that can erase its own record is a retention run with no record. So DELETE
-- is refused outright by a trigger, the same construction eng_order_payments
-- uses, and this table is declared kept_forever in retention-policy.ts where
-- retention itself reads the rule.
--
-- Retention cannot age this table out. It is not in the deletable set, it
-- never will be, and both the declaration and this trigger say so.
-- ===========================================================================

create table if not exists eng_retention_runs (
  id              uuid primary key default gen_random_uuid(),

  -- ------------------------------------------------------- the policy, copied
  table_name      text not null,
  rule            text not null,
  floor_days      integer not null,
  age_column      text not null,
  cutoff          timestamptz not null,

  -- ------------------------------------------------------------------ the mode
  /* Not a boolean. A flag named execute defaulting to false reads as safe and
   * is one forgotten argument from the opposite. */
  mode            text not null check (mode in ('dry_run', 'execute')),

  -- ---------------------------------------------------------------- the intent
  intended_count  integer not null,
  /* Text rather than the source table's own type, because this one manifest
   * table serves tables keyed on bigint and on uuid alike. */
  id_low          text,
  id_high         text,
  /* sha256 over the planned ids in a stable order. The proof that the set which
   * ran is the set that was planned. */
  id_hash         text not null,

  -- ---------------------------------------------- what had to exist beforehand
  rollup_metric   text,
  /* One entry per day in the planned set: the day, how many rows were planned
   * for it, and what the rollup already holds. Proved at planning time. */
  rollup_days     jsonb not null default '[]'::jsonb,

  -- --------------------------------------------------------------------- who
  actor_id        uuid references eng_profiles(id) on delete set null,
  actor_email     text,
  actor_role      text,

  -- -------------------------------------------------------------------- when
  planned_at      timestamptz not null default now(),
  /* Written by the database from the same now(), so the two cannot disagree. */
  planned_at_ct   text not null
                  default to_char(now() at time zone 'America/Chicago',
                                  'YYYY-MM-DD HH24:MI:SS "CT"'),

  -- ----------------------------------------------------------------- the outcome
  status          text not null default 'planned'
                  check (status in ('planned', 'running', 'complete', 'failed')),
  /* In a dry run this is what WOULD have gone. The column means the same thing
   * in both modes on purpose: a dry run that recorded nothing would prove
   * nothing about the run it is rehearsing. */
  affected_count  integer not null default 0,
  /* The resume point: the highest id this run has finished with. */
  last_id         text,
  reconciled      boolean,
  finished_at     timestamptz,
  note            text
);

alter table eng_retention_runs enable row level security;

create index if not exists eng_retention_runs_table_idx
  on eng_retention_runs (table_name, planned_at desc);
create index if not exists eng_retention_runs_resumable_idx
  on eng_retention_runs (status, planned_at)
  where status in ('planned', 'running', 'failed');


-- --------------------------------------------------------------------------
-- A retention run cannot delete its own manifest.
-- --------------------------------------------------------------------------

create or replace function eng_forbid_retention_run_delete()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  raise exception 'eng_retention_runs rows cannot be deleted. A retention run that can erase its own record is a retention run with no record.';
end;
$fn$;

drop trigger if exists eng_retention_runs_no_delete on eng_retention_runs;
create trigger eng_retention_runs_no_delete before delete on eng_retention_runs
  for each row execute function eng_forbid_retention_run_delete();


comment on table eng_retention_runs is
  'One row per retention run, written before the run touches anything. Carries the policy as it stood, the exact set by range and hash, the rollups that were proved first, the mode, the actor and the outcome. Refuses DELETE and is declared kept_forever in retention-policy.ts.';
comment on column eng_retention_runs.mode is
  'dry_run or execute. A mode rather than a boolean flag, because a flag defaulting to false is one missing argument away from a real deletion.';
comment on column eng_retention_runs.id_hash is
  'sha256 over the planned ids in a stable order. A count alone cannot tell two different sets of the same size apart.';
comment on column eng_retention_runs.rollup_days is
  'Per day: the day, the rows planned for it, and the rollup value already held. Proved before planning finished, so a resume trusts it rather than re-proving it against a table this run has already taken rows out of.';
comment on column eng_retention_runs.affected_count is
  'Rows deleted, or in a dry run rows that would have been. The same meaning in both modes, so a rehearsal proves something about the run it rehearses.';
