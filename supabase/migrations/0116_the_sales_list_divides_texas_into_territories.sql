/*
 * ===========================================================================
 * 0116: THE SALES LIST DIVIDES TEXAS INTO TERRITORIES, AND REPS HOLD THEM.
 * Robert's sales CRM ruling of 2026-11-02, item R5 (territories and
 * assignment), with his answer 2 the same afternoon.
 * ===========================================================================
 *
 * R5, verbatim: "Territories by county grouped into regions; a rep holds one
 * or more; new imports assign round robin within the territory; ops_manager
 * and admin reassign singly or in bulk; a rep sees only their own and
 * unassigned in their territory, managers see all."
 *
 * His answer 2: ops_manager is the sales manager, and the rep is also the
 * account manager.
 *
 * THREE TABLES.
 *   eng_crm_territories        a named territory, with the round robin
 *                              cursor its imports advance.
 *   eng_crm_territory_counties the counties in a territory. A county is in
 *                              at most one territory, so an import's county
 *                              names one territory or none.
 *   eng_crm_territory_reps     who holds a territory. A rep holds one or more.
 *
 * THE REGION IS NOT STORED. A territory is counties; the region each county
 * sits in is read from src/content/regions.ts (the coverage map, which places
 * all 254 counties exactly once), so the two cannot disagree. Which strings are
 * Texas counties is decided by that map in code (territoryFor), and this file
 * keeps a county to one territory whatever its spelling, case or spacing.
 *
 * THESE ARE WORKING SETTINGS, NOT A RECORD: a manager redraws a territory or
 * moves a rep, so rows are edited and removed. Each change writes an audit row
 * first, from code. KEPT, PENDING COUNSEL, as eng_prospects is: declared in
 * retention-policy.ts. ADDITIVE ONLY: no drop, no change to an existing table.
 *
 * Development first, on stage/0116-crm-territories; production at the chat
 * counterpart's sitting after R5's board.
 */

/* ------------------------------------------------------------------- section 0 */

do $$
begin
  if to_regclass('public.eng_crm_saved_views') is null then
    raise exception 'eng: 0116 follows 0115, which adds eng_crm_saved_views. It does not exist here.';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'eng_prospects' and column_name = 'county'
  ) then
    raise exception 'eng: 0116 places a company by eng_prospects.county (0112), and that column does not exist here.';
  end if;
  if to_regclass('public.eng_crm_territories') is not null then
    raise exception 'eng: 0116 expects no territory table before it runs.';
  end if;
end;
$$;

/* --------------------------------------------------------------- territories */

create table if not exists eng_crm_territories (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  /* No updated_at: a rename is in the audit log, and a column written from the app's clock is one db-guard refuses. */
  name        text not null
                constraint eng_crm_territories_named
                check (length(btrim(name)) between 1 and 80),
  /*
   * How many companies the round robin has assigned in this territory. The
   * next rep is the holder at (rr_cursor mod holders), holders in a fixed
   * order; the cursor is advanced with a conditional update on its old value,
   * so two imports at once cannot hand out the same turn.
   */
  rr_cursor   bigint not null default 0
                constraint eng_crm_territories_cursor_counts
                check (rr_cursor >= 0),
  created_by  uuid references eng_profiles (id) on delete set null
);

create unique index if not exists eng_crm_territories_name_once
  on eng_crm_territories (lower(btrim(name)));

alter table eng_crm_territories enable row level security;
revoke all on eng_crm_territories from public, anon, authenticated;

comment on table eng_crm_territories is
  'A sales territory: a named set of Texas counties, with the round robin cursor its imports advance. The region is derived from the coverage map in code, never stored. 0116.';

/* ------------------------------------------------------ the counties in each */

create table if not exists eng_crm_territory_counties (
  territory_id  uuid not null references eng_crm_territories (id) on delete cascade,
  county        text not null
                  constraint eng_crm_territory_counties_named
                  check (length(btrim(county)) between 2 and 40),
  created_at    timestamptz not null default now(),
  created_by    uuid references eng_profiles (id) on delete set null,
  primary key (territory_id, county)
);

/* A county is in at most one territory, however it is spelled. */
create unique index if not exists eng_crm_territory_counties_county_once
  on eng_crm_territory_counties (lower(btrim(county)));

alter table eng_crm_territory_counties enable row level security;
revoke all on eng_crm_territory_counties from public, anon, authenticated;

comment on table eng_crm_territory_counties is
  'The counties in a sales territory. A county is in at most one territory (unique on its trimmed lower case name). 0116.';

/* ------------------------------------------------------- who holds each one */

create table if not exists eng_crm_territory_reps (
  territory_id  uuid not null references eng_crm_territories (id) on delete cascade,
  profile_id    uuid not null references eng_profiles (id) on delete cascade,
  created_at    timestamptz not null default now(),
  created_by    uuid references eng_profiles (id) on delete set null,
  primary key (territory_id, profile_id)
);

create index if not exists eng_crm_territory_reps_profile_idx on eng_crm_territory_reps (profile_id);

alter table eng_crm_territory_reps enable row level security;
revoke all on eng_crm_territory_reps from public, anon, authenticated;

comment on table eng_crm_territory_reps is
  'Who holds a sales territory. A rep holds one or more; a rep sees their own companies and the unassigned ones in counties they hold. 0116.';

/* ------------------------------------------------------------- closing assert */

do $$
begin
  if to_regclass('public.eng_crm_territories') is null
     or to_regclass('public.eng_crm_territory_counties') is null
     or to_regclass('public.eng_crm_territory_reps') is null then
    raise exception 'eng: 0116 expects its three territory tables after it runs.';
  end if;
  if exists (
    select 1 from pg_class c
     where c.relname in ('eng_crm_territories', 'eng_crm_territory_counties', 'eng_crm_territory_reps')
       and not c.relrowsecurity
  ) then
    raise exception 'eng: 0116 expects row level security on all three tables.';
  end if;
  if to_regclass('public.eng_crm_territory_counties_county_once') is null then
    raise exception 'eng: 0116 expects a county to be in at most one territory.';
  end if;
end;
$$;
