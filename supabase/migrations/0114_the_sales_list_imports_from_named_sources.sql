/*
 * ===========================================================================
 * 0114: THE SALES LIST IMPORTS FROM NAMED SOURCES, AND A PERSON WRITES IT.
 * Robert's sales CRM ruling of 2026-11-02, item R2 (import engine), with his
 * answers the same afternoon.
 * ===========================================================================
 *
 * R2, verbatim: "A job per source, scheduled, with a dry run that reports
 * adds, merges and conflicts before writing ... Dedupe by normalized name,
 * phone and address; merge keeps every source. CSV import (purchased lists)
 * through the same dedupe."
 *
 * His answers that shape this file: scheduled runs only preview, and a person
 * presses Write (answer 4); a company with no phone and no email is held on
 * the import screen until a phone is found, and the reachable check on
 * eng_prospects stays (answer 3).
 *
 * TWO TABLES. A run is one preview of one source, and what a person did with
 * it; its rows are one verdict per record the source gave: add, merge,
 * conflict, held or skip. The preview is the record of what Write will do,
 * and Write re-plans every row against the list as it is then and refuses if
 * any verdict moved, so a preview a person read is the preview that is
 * written.
 *
 * TELEMETRY IN SHAPE, KEPT PENDING COUNSEL. A run describes a pull rather
 * than a fact about a customer, so a deletion floor is defensible, and none is
 * ruled; the tables retention may delete from stay eng_cron_runs and eng_jobs
 * (CLAUDE.md 6c). retention-policy.ts declares both tables kept.
 *
 * ADDITIVE ONLY. New tables, their checks and indexes, and one foreign key
 * from eng_prospect_sources.import_run_id (0112, always null until now) to the
 * run that wrote it. No grant: crm.import is 0112's.
 *
 * Development first, on stage/0114-crm-imports; production at the chat
 * counterpart's sitting after R2's board.
 */

/* ------------------------------------------------------------------- section 0 */

do $$
begin
  if to_regclass('public.eng_prospect_sources') is null then
    raise exception 'eng: 0114 follows 0112, which adds eng_prospect_sources. It does not exist here.';
  end if;
  if exists (select 1 from public.eng_prospect_sources where import_run_id is not null) then
    raise exception 'eng: 0114 expects eng_prospect_sources.import_run_id to be null on every row before the runs table exists.';
  end if;
end;
$$;

/* -------------------------------------------------------------------- the runs */

create table if not exists eng_crm_import_runs (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  source          text not null
                    constraint eng_crm_import_runs_source_known
                    check (source in (
                      'permits_san_antonio', 'permits_corpus_christi', 'permits_houston',
                      'permits_dallas', 'permits_austin', 'permits_fort_worth',
                      'tdlr_electrical', 'tdlr_solar_retailers', 'tdlr_solar_salespeople',
                      'tdhca_mh', 'trec', 'csv', 'manual')),
  /* A scheduled preview has nobody behind it; a person's preview, and every write, does. */
  trigger         text not null
                    constraint eng_crm_import_runs_trigger_known
                    check (trigger in ('schedule', 'person')),
  status          text not null default 'previewing'
                    constraint eng_crm_import_runs_status_known
                    check (status in ('previewing', 'previewed', 'written', 'failed', 'refused')),
  requested_by    uuid references eng_profiles (id) on delete restrict,
  finished_at     timestamptz,
  written_at      timestamptz,
  written_by      uuid references eng_profiles (id) on delete restrict,
  /* Every record read, before the filter; the counts below are after it. */
  rows_read       integer not null default 0,
  records         integer not null default 0,
  adds            integer not null default 0,
  merges          integer not null default 0,
  conflicts       integer not null default 0,
  held            integer not null default 0,
  /* Held rows stored for the screen; held says how many there were. */
  held_kept       integer not null default 0,
  skipped         integer not null default 0,
  error           text,
  /* The terms date the source declared when this ran, copied, so a run says what it ran under. */
  terms_read_on   date,
  file_name       text,
  constraint eng_crm_import_runs_counts_whole check (
    rows_read >= 0 and records >= 0 and adds >= 0 and merges >= 0 and conflicts >= 0
    and held >= 0 and held_kept >= 0 and skipped >= 0 and held_kept <= held
    and records = adds + merges + conflicts + held + skipped),
  constraint eng_crm_import_runs_who_asked check (
    (trigger = 'schedule' and requested_by is null) or (trigger = 'person' and requested_by is not null)),
  /* Written names who and when, and only a written run does. */
  constraint eng_crm_import_runs_written_is_whole check (
    (status = 'written') = (written_at is not null and written_by is not null)),
  /* A run that failed or was refused says why. */
  constraint eng_crm_import_runs_failure_says_why check (
    status not in ('failed', 'refused') or length(btrim(coalesce(error, ''))) > 0),
  /* A run that finished has a finish; one still previewing has none. */
  constraint eng_crm_import_runs_finished_in_order check (
    (status = 'previewing') = (finished_at is null)),
  /* A source pulled from a public portal names the terms date it ran under; the firm's own spreadsheet has none. */
  constraint eng_crm_import_runs_terms_recorded check (
    source in ('csv', 'manual') or status in ('failed', 'refused', 'previewing') or terms_read_on is not null)
);

create index if not exists eng_crm_import_runs_source_idx on eng_crm_import_runs (source, created_at desc);

alter table eng_crm_import_runs enable row level security;
revoke all on eng_crm_import_runs from public, anon, authenticated;

comment on table eng_crm_import_runs is
  'One preview of one source for the sales list, and what a person did with it. Scheduled runs only preview; a person with crm.import writes. 0114.';

/* --------------------------------------------------------------- the verdicts */

create table if not exists eng_crm_import_rows (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  run_id            uuid not null references eng_crm_import_runs (id) on delete cascade,
  line              integer not null check (line >= 1),
  source_record_id  text not null check (length(btrim(source_record_id)) > 0),
  verdict           text not null
                      constraint eng_crm_import_rows_verdict_known
                      check (verdict in ('add', 'merge', 'conflict', 'held', 'skip')),
  /* The company a merge goes to, or the one an add or a resolution created. */
  prospect_id       uuid references eng_prospects (id) on delete restrict,
  /* The companies a conflict could be; a person chooses. */
  candidate_ids     uuid[] not null default '{}',
  reason            text,
  /* The record as the source gave it, mapped: what Write and a person read. */
  payload           jsonb not null,
  resolved_at       timestamptz,
  resolved_by       uuid references eng_profiles (id) on delete restrict,
  resolution        text
                      constraint eng_crm_import_rows_resolution_known
                      check (resolution is null or resolution in ('added', 'merged', 'dismissed')),
  constraint eng_crm_import_rows_line_once unique (run_id, line),
  /* A conflict, a hold and a skip each say why. */
  constraint eng_crm_import_rows_says_why check (
    verdict in ('add', 'merge') or length(btrim(coalesce(reason, ''))) > 0),
  /* A conflict names at least two companies it could be. */
  constraint eng_crm_import_rows_conflict_has_candidates check (
    verdict <> 'conflict' or cardinality(candidate_ids) >= 2),
  /* A resolution names who and when, and only a held row or a conflict is resolved by a person. */
  constraint eng_crm_import_rows_resolution_is_whole check (
    (resolution is null) = (resolved_at is null and resolved_by is null)
    and (resolution is null or verdict in ('held', 'conflict')))
);

create index if not exists eng_crm_import_rows_run_idx on eng_crm_import_rows (run_id, verdict, line);

alter table eng_crm_import_rows enable row level security;
revoke all on eng_crm_import_rows from public, anon, authenticated;

comment on table eng_crm_import_rows is
  'One verdict per record a source gave in a run: add, merge, conflict, held (no phone and no email) or skip. 0114.';

/* --------------------------------------- a source row names the run that wrote it */

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'eng_prospect_sources_import_run_fkey') then
    alter table eng_prospect_sources
      add constraint eng_prospect_sources_import_run_fkey
      foreign key (import_run_id) references eng_crm_import_runs (id) on delete set null;
  end if;
end;
$$;

/* ------------------------------------------------------------- closing assert */

do $$
begin
  if to_regclass('public.eng_crm_import_runs') is null or to_regclass('public.eng_crm_import_rows') is null then
    raise exception 'eng: 0114 expects eng_crm_import_runs and eng_crm_import_rows after it runs.';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eng_prospect_sources_import_run_fkey') then
    raise exception 'eng: 0114 expects eng_prospect_sources.import_run_id to reference eng_crm_import_runs after it runs.';
  end if;
  if exists (
    select 1 from pg_class c
     where c.relname in ('eng_crm_import_runs', 'eng_crm_import_rows') and not c.relrowsecurity
  ) then
    raise exception 'eng: 0114 expects row level security on both import tables.';
  end if;
end;
$$;
