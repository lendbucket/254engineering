/*
 * 0131: A JOB TAKEN TWICE IS ONE FILE.
 *
 * Part 1 finding 6, fixed on Robert's answer 1 of 2026-11-14. New job had no
 * duplicate guard. A save that runs past the 20 second bound is answered "may
 * not have saved" while the first request may still be running, the button
 * comes back, and a second press made a second file and, once the gate is open,
 * a second payment link. The web door has had this guard on the order since
 * Phase 7 (eng_service_orders.client_request_id); the telephone door had none.
 *
 * One column and one index:
 *
 *   eng_files.intake_request_id   the New job form's own id for this sitting
 *                                 (its draftId, already minted once per form
 *                                 for uploads), written by takeJob. Null for
 *                                 every file opened any other way, and for
 *                                 every file before this migration.
 *   eng_files_intake_request_once a unique index over the non-null values, so
 *                                 two saves landing in the same instant cannot
 *                                 both make a file: the second meets the index,
 *                                 and createFile returns the first.
 *
 * takeJob also asks before it writes anything, so a sequential second press
 * returns the first file without touching the client, the answers, the partner
 * touch or the payment link. The client half was already guarded within two
 * minutes by createClient.
 *
 * Additive. No backfill: an old file has no request id and needs none.
 */

/* ------------------------------------------------------------- 0. the ground */
do $$
begin
  if not exists (
    select 1 from public.eng_role_grants where role_key = 'customer_service' and action = 'files.create'
  ) then
    raise exception 'eng: 0131 follows 0130, which grants customer_service files.create. It is not here.';
  end if;
end;
$$;

/* ------------------------------------------------------------ 1. the column */
alter table eng_files add column if not exists intake_request_id uuid;

comment on column eng_files.intake_request_id is
  'The New job form''s id for the sitting that opened this file (0131). One file per id: a second save returns the first. Null for files opened any other way.';

/* ------------------------------------------------------------- 2. the index */
create unique index if not exists eng_files_intake_request_once
  on eng_files (intake_request_id)
  where intake_request_id is not null;
