-- ===========================================================================
-- 0033: the manifest explains itself, and a plan nobody ran says so.
--
-- Phase 12 Section 3, two operator rulings from gate 2, both about the same
-- thing: the manifest is the artefact a person reads, so what a person needs
-- in order to read it correctly belongs on the manifest.
-- ===========================================================================


-- --------------------------------------------------------------------------
-- 1. WHAT A READER WOULD OTHERWISE GET WRONG, WRITTEN ON THE ROW.
--
-- Operator ruling. The gate 2 dry run was read line by line and four things in
-- it invited a wrong conclusion. Every one of them was answered in the report
-- and would have gone on inviting it forever, because a report is read once and
-- a manifest is read whenever somebody asks what a run did.
--
--   An empty plan carries no id range, so nothing is bounded by it, and its
--   hash is the sha256 of the empty string, which EVERY empty plan shares. Two
--   manifests with that hash are not a duplicate of each other.
--
--   A rollup section with no day lines reads as a guard that did not run. It
--   ran and had no days to check.
--
--   An intended count of zero on a table that plainly holds rows reads as a
--   broken rule. Usually it means nothing has aged past the floor yet, and the
--   honest answer is how old the oldest candidate actually is.
--
--   Two plans made in one pass carry cutoffs seconds apart, because each takes
--   its own clock. That is not an inconsistency.
--
-- Text rather than a code, and written at PLANNING time, because these are
-- statements about the plan rather than about the outcome. `note` is the
-- outcome and is written when the run ends; this column is never overwritten by
-- a run.
-- --------------------------------------------------------------------------

alter table eng_retention_runs
  add column if not exists plan_reading text;

comment on column eng_retention_runs.plan_reading is
  'What a person reading this manifest would otherwise get wrong: an empty set and its shared hash, a rollup with no days to check, an intended count of zero and how old the oldest candidate is. Written when the plan is made and never overwritten by the run.';


-- --------------------------------------------------------------------------
-- 2. A PLAN NOBODY RAN IS ABANDONED, NOT LEFT AT `planned`.
--
-- Operator ruling. A manifest sitting at `planned` is a deletion that is still
-- intended, and the board was leaving them behind: retention-audit plans six
-- times per run to prove the refusals, and a readout script left two more.
-- Development held ten of them, each one reading as a sweep waiting to happen.
--
-- `abandoned` is a fourth terminal status alongside complete and failed, and it
-- means something none of the other three do: nothing was attempted and nothing
-- will be. It is set by UPDATE, which this table allows and always has; DELETE
-- is what it refuses, and abandoning a manifest is exactly the case that would
-- otherwise tempt somebody to delete one.
--
-- Every script that plans without running now abandons what it planned before
-- it exits, with a reason, and retention-audit fails if it finds one of its own
-- left at `planned`.
-- --------------------------------------------------------------------------

alter table eng_retention_runs
  drop constraint if exists eng_retention_runs_status_check;

alter table eng_retention_runs
  add constraint eng_retention_runs_status_check
  check (status in ('planned', 'running', 'complete', 'failed', 'abandoned'));

comment on column eng_retention_runs.status is
  'planned, running, complete, failed, or abandoned. Abandoned means nothing was attempted and nothing will be, which is what a plan made to prove a refusal becomes. A manifest left at planned is a deletion still intended, so nothing may leave one behind.';
