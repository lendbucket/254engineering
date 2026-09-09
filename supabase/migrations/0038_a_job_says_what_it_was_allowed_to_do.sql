-- ===========================================================================
-- 0038: a job records whether it was allowed to reach outside this platform.
--
-- Phase 12 Section 4, Section 0, debt one. Operator ruling: "Handlers that send
-- or charge run in a mode producing no external effect that says so in the
-- trail row; a handler with no such mode gets one."
--
-- WHY THERE IS A COLUMN AND NOT A FLAG
-- -------------------------------------
-- The obvious version is an environment variable read inside the handler. That
-- makes "did this send an email" a property of the PROCESS that ran the job,
-- and processes leave no record. Six months later the row says the job is done
-- and nothing anywhere says whether a person received anything.
--
-- It is also the shape that already cost this branch something. On 2026-09-09 a
-- retention dry run on development claimed the oldest jobs of any kind and sent
-- twenty real emails, because the worker takes whatever is oldest and nothing
-- in a job said what it was permitted to do. A flag set in one terminal cannot
-- protect a worker started in another.
--
-- So it is a column, written at enqueue, carried by the claim, and read by the
-- handler. A job that ran without external effect says so on its own row,
-- permanently, and a job that sent something says that.
--
-- WHAT THE TWO VALUES MEAN
-- -------------------------
--   live                 the handler may do everything it does: send, charge,
--                        call a provider. The default, because a job that
--                        silently did nothing is far worse than one that did.
--   no_external_effect   the handler does everything EXCEPT reach outside this
--                        platform. It still reads, still writes rows, still
--                        returns a real outcome, so the queue is exercised
--                        exactly as it runs in anger; what it does not do is
--                        put a message in somebody's inbox or money on a card.
--
-- NOT A DRY RUN, AND THE DIFFERENCE MATTERS
-- ------------------------------------------
-- retention.sweep already has a mode, and it is a different thing: plan versus
-- execute, about whether rows are deleted. This is about whether a person
-- outside the firm hears anything. A retention sweep in execute mode with
-- no_external_effect deletes exactly what it said it would and emails nobody
-- about it, and both of those are true at once.
--
-- WHY THE DEFAULT IS 'live' AND NOT THE SAFE ONE
-- -----------------------------------------------
-- Defaulting to no_external_effect would make every job written by every future
-- caller silently do nothing outside, and the failure would be invisible: a
-- customer waiting for a link that a green board says was sent. The dangerous
-- direction here is silence, not noise. Suppressing an effect is the thing that
-- has to be asked for.
-- ===========================================================================

alter table eng_jobs
  add column if not exists effect_mode text not null default 'live';

alter table eng_jobs
  drop constraint if exists eng_jobs_effect_mode_is_one_of_two;
alter table eng_jobs
  add constraint eng_jobs_effect_mode_is_one_of_two
  check (effect_mode in ('live', 'no_external_effect'));

/*
 * The index is partial and deliberately so. Almost every row is 'live', so an
 * index over the whole column would be a scan wearing an index's name. What
 * anybody ever asks is "show me the jobs that were not allowed to reach
 * outside", which is the small set.
 */
create index if not exists eng_jobs_no_external_effect
  on eng_jobs (created_at desc) where effect_mode = 'no_external_effect';

comment on column eng_jobs.effect_mode is
  'Whether this job was permitted to reach outside the platform. live is everything; no_external_effect does all the reading and writing and sends nothing and charges nothing. Written at enqueue and carried by eng_claim_jobs, so the row itself says what the job was allowed to do rather than that being a property of whichever process happened to run it. Phase 12 Section 4.';

/*
 * eng_claim_jobs is `returns setof eng_jobs`, so it returns the new column with
 * no change to the function. Recorded here because the next reader will look
 * for the function change and there is not one, and an absence somebody has to
 * work out is an absence somebody gets wrong.
 */
