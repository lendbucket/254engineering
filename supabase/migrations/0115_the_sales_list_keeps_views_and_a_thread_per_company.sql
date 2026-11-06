/*
 * ===========================================================================
 * 0115: THE SALES LIST KEEPS EACH PERSON'S SAVED VIEWS, AND ONE THREAD PER
 * COMPANY. Robert's sales CRM ruling of 2026-11-02, item R4 (pipeline and
 * lists), with his answer 5 the same afternoon.
 * ===========================================================================
 *
 * R4, verbatim, in part: "a list view with search, filters ... sort,
 * pagination, saved views per person, bulk assign and bulk tag. Company page
 * with the full timeline, contacts, notes with mentions through the existing
 * threads, documents sent, and the linked account."
 *
 * His answer 5: one existing direct thread linked per company for notes with
 * mentions, rather than a new thread kind. So eng_threads and its kind check
 * are untouched: a company's notes are a 'direct' thread whose direct_key is
 * 'prospect:<id>' (0005's unique key on direct_key keeps it one per company),
 * and this file adds only the link from the company to it.
 *
 * TWO TABLES.
 *   eng_crm_saved_views   one person's named filter and sort, for the board or
 *                         the list. Read and written only for that person.
 *   eng_prospect_threads  one company, one thread, both unique.
 *
 * KEPT, PENDING COUNSEL, as eng_prospects is: retention-policy.ts declares
 * both. ADDITIVE ONLY: no drop, no change to an existing table.
 *
 * Development first, on stage/0115-crm-pipeline; production at the chat
 * counterpart's sitting after R4's board.
 */

/* ------------------------------------------------------------------- section 0 */

do $$
begin
  if to_regclass('public.eng_crm_import_runs') is null then
    raise exception 'eng: 0115 follows 0114, which adds eng_crm_import_runs. It does not exist here.';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'eng_threads' and column_name = 'direct_key'
  ) then
    raise exception 'eng: 0115 links a company to a direct thread by direct_key (0005), and eng_threads has no direct_key here.';
  end if;
  if exists (select 1 from public.eng_threads where direct_key like 'prospect:%') then
    raise exception 'eng: 0115 expects no thread keyed to a company before the link table exists.';
  end if;
end;
$$;

/* -------------------------------------------------------------- the saved views */

create table if not exists eng_crm_saved_views (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  profile_id  uuid not null references eng_profiles (id) on delete cascade,
  name        text not null
                constraint eng_crm_saved_views_named
                check (length(btrim(name)) between 1 and 80),
  /* Which view it opens: the stage board or the list. */
  view        text not null default 'list'
                constraint eng_crm_saved_views_view_known
                check (view in ('board', 'list')),
  /* The search, filters and sort, as the screen's own query parameters. */
  query       jsonb not null default '{}'::jsonb
                constraint eng_crm_saved_views_query_is_object
                check (jsonb_typeof(query) = 'object'),
  constraint eng_crm_saved_views_name_once unique (profile_id, name)
);

create index if not exists eng_crm_saved_views_profile_idx on eng_crm_saved_views (profile_id, created_at);

alter table eng_crm_saved_views enable row level security;
revoke all on eng_crm_saved_views from public, anon, authenticated;

comment on table eng_crm_saved_views is
  'One person''s named search, filters and sort on the sales list, for the board or the list. Read only for that person. 0115.';

/* ------------------------------------------------------ one thread per company */

create table if not exists eng_prospect_threads (
  prospect_id  uuid primary key references eng_prospects (id) on delete restrict,
  thread_id    uuid not null references eng_threads (id) on delete restrict,
  created_at   timestamptz not null default now(),
  created_by   uuid references eng_profiles (id) on delete set null,
  constraint eng_prospect_threads_thread_once unique (thread_id)
);

alter table eng_prospect_threads enable row level security;
revoke all on eng_prospect_threads from public, anon, authenticated;

comment on table eng_prospect_threads is
  'The direct thread that holds a company''s notes, keyed prospect:<id>. One company, one thread (Robert''s answer 5, 2026-11-02). 0115.';

/* ------------------------------------------------------------- closing assert */

do $$
begin
  if to_regclass('public.eng_crm_saved_views') is null or to_regclass('public.eng_prospect_threads') is null then
    raise exception 'eng: 0115 expects eng_crm_saved_views and eng_prospect_threads after it runs.';
  end if;
  if exists (
    select 1 from pg_class c
     where c.relname in ('eng_crm_saved_views', 'eng_prospect_threads') and not c.relrowsecurity
  ) then
    raise exception 'eng: 0115 expects row level security on both tables.';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eng_crm_saved_views_name_once') then
    raise exception 'eng: 0115 expects one saved view per person per name.';
  end if;
end;
$$;
