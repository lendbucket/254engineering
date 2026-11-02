/*
 * ===========================================================================
 * 0111: THE SALES LIST KNOWS COMPANIES, THEIR PEOPLE AND WHERE EACH CAME FROM.
 * Robert's sales CRM ruling of 2026-11-02, item R1 (data model), with his
 * answers the same afternoon.
 * ===========================================================================
 *
 * R1, verbatim: "Companies and contacts (several people per company), vertical
 * (roofer, solar, manufactured home dealer, foundation repair, real estate,
 * lender, insurance agent, other), source and source record id, territory
 * (county and region from the existing region map), owner, stage (new,
 * attempted, connected, interested, account_opened, ordering, dormant,
 * do_not_contact), score, next_action_at, tags, website, address with county,
 * permit activity (count and last permit date), and a link to the converted
 * account. Activities table for every call, email, note and stage change,
 * written through the existing contact log. Unique on normalized (name, phone)
 * and on (source, source record id)."
 *
 * ONE CRM, NOT TWO. He said "extend eng_prospects ... do not start a second
 * CRM beside the one that exists". So the company IS an eng_prospects row,
 * extended; the activities ARE eng_contact_log rows, extended; and the only
 * new tables are the two things a row cannot hold: several people per
 * company (eng_prospect_contacts) and several sources per company
 * (eng_prospect_sources).
 *
 * ADDITIVE ONLY. Nothing is dropped and no existing check is replaced. The
 * prospect kind check (roofer, agent, title, contractor) cannot hold the eight
 * verticals; replacing it is a destructive operator sitting he ruled for
 * separately (answer 8). Until it sits, the vertical lives in its own column
 * with its own check, and prospect_type is derived from it on write so the old
 * check keeps holding. Nothing here depends on that sitting.
 *
 * THE TWO KEYS ARE COMPUTED BY THE DATABASE. name_normalized and
 * phone_normalized are generated columns over two immutable functions, so the
 * unique key and the value it is computed from cannot disagree, and no code
 * path can write a normalized value that differs from the rule. The TypeScript
 * mirror in src/lib/crm-rules.ts is for searching before a write; the proof
 * compares the two on the same inputs.
 *
 * THE TERRITORY is the county, stored; the region is derived from the county
 * by the region map in src/content/regions.ts and never stored, so a region
 * redrawn there moves every prospect with it.
 *
 * STAGE AND STATUS. status (open, converted, not_interested) stays: the
 * conversion check and every existing screen read it. stage is the CRM's own
 * word, and two checks keep them from contradicting each other: converted is
 * exactly the stages account_opened and ordering, and do_not_contact is always
 * not_interested. A dormant prospect may be open (a sequence that ran out) or
 * not interested (a refusal).
 *
 * Development first, on stage/0111-crm-data-model; production at the chat
 * counterpart's sitting after R1's board.
 */

/* --------------------------------------------------------------- the two rules */

create or replace function eng_crm_normalize_name(p text)
returns text
language sql
immutable
set search_path = ''
as $fn$
  select btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]+', ' ', 'g'),
        '\m(l l c|llc|inc|incorporated|co|corp|corporation|company|ltd|limited|pllc|lp|llp|dba)\M', ' ', 'g'
      ),
      '\s+', ' ', 'g'
    )
  );
$fn$;

create or replace function eng_crm_normalize_phone(p text)
returns text
language sql
immutable
set search_path = ''
as $fn$
  select case
    when length(d) = 11 and left(d, 1) = '1' then substr(d, 2)
    when length(d) = 10 then d
    else null
  end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) digits;
$fn$;

/* As 0073: no eng_ function is callable without the service role. The generated columns run them as the writer, which is the service role. */
revoke execute on function eng_crm_normalize_name(text) from public, anon, authenticated;
revoke execute on function eng_crm_normalize_phone(text) from public, anon, authenticated;
grant execute on function eng_crm_normalize_name(text) to service_role;
grant execute on function eng_crm_normalize_phone(text) to service_role;

/* ------------------------------------------------------------------- section 0 */

do $$
declare
  v_dupes integer;
begin
  if to_regclass('public.eng_prospects') is null then
    raise exception 'eng: 0111 extends eng_prospects (0079), which does not exist here.';
  end if;
  select count(*) into v_dupes
    from (
      select public.eng_crm_normalize_name(company), public.eng_crm_normalize_phone(phone)
        from public.eng_prospects
       where public.eng_crm_normalize_phone(phone) is not null
       group by 1, 2
      having count(*) > 1
    ) d;
  if v_dupes > 0 then
    raise exception 'eng: 0111 refuses: % normalized (name, phone) pairs on eng_prospects are held by more than one row. Merge them before the unique key is added.', v_dupes;
  end if;
end;
$$;

/* ------------------------------------------------------ the company, extended */

alter table eng_prospects add column if not exists vertical text not null default 'other';
alter table eng_prospects add column if not exists stage text not null default 'new';
alter table eng_prospects add column if not exists score integer not null default 0;
alter table eng_prospects add column if not exists next_action_at timestamptz;
alter table eng_prospects add column if not exists next_action_kind text;
alter table eng_prospects add column if not exists sequence_step smallint not null default 0;
alter table eng_prospects add column if not exists tags text[] not null default '{}';
alter table eng_prospects add column if not exists website text;
alter table eng_prospects add column if not exists address_line text;
alter table eng_prospects add column if not exists postal_code text;
alter table eng_prospects add column if not exists county text;
alter table eng_prospects add column if not exists permit_count integer not null default 0;
alter table eng_prospects add column if not exists last_permit_on date;
alter table eng_prospects add column if not exists do_not_contact_at timestamptz;
alter table eng_prospects add column if not exists do_not_contact_by uuid references eng_profiles (id) on delete restrict;
alter table eng_prospects add column if not exists name_normalized text
  generated always as (public.eng_crm_normalize_name(company)) stored;
alter table eng_prospects add column if not exists phone_normalized text
  generated always as (public.eng_crm_normalize_phone(phone)) stored;

/* The rows already on the list: their vertical from their kind, their stage from their status. */
update eng_prospects
   set vertical = case prospect_type when 'roofer' then 'roofer' when 'agent' then 'real_estate' else 'other' end
 where vertical = 'other' and prospect_type in ('roofer', 'agent');
update eng_prospects set stage = 'account_opened' where status = 'converted' and stage = 'new';
update eng_prospects set stage = 'dormant' where status = 'not_interested' and stage = 'new';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'eng_prospects_vertical_known') then
    alter table eng_prospects add constraint eng_prospects_vertical_known check (vertical in (
      'roofer', 'solar', 'manufactured_home_dealer', 'foundation_repair',
      'real_estate', 'lender', 'insurance_agent', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eng_prospects_stage_known') then
    alter table eng_prospects add constraint eng_prospects_stage_known check (stage in (
      'new', 'attempted', 'connected', 'interested', 'account_opened',
      'ordering', 'dormant', 'do_not_contact'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eng_prospects_score_range') then
    alter table eng_prospects add constraint eng_prospects_score_range check (score between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eng_prospects_next_action_kind_known') then
    alter table eng_prospects add constraint eng_prospects_next_action_kind_known
      check (next_action_kind is null or next_action_kind in ('call', 'email'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eng_prospects_sequence_step_known') then
    alter table eng_prospects add constraint eng_prospects_sequence_step_known check (sequence_step >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eng_prospects_permit_count_known') then
    alter table eng_prospects add constraint eng_prospects_permit_count_known check (permit_count >= 0);
  end if;
  /* Converted is exactly the two customer stages; nothing else may claim them. */
  if not exists (select 1 from pg_constraint where conname = 'eng_prospects_stage_matches_conversion') then
    alter table eng_prospects add constraint eng_prospects_stage_matches_conversion
      check ((status = 'converted') = (stage in ('account_opened', 'ordering')));
  end if;
  /* A refusal is dormant or do not contact; do not contact is always a refusal. */
  if not exists (select 1 from pg_constraint where conname = 'eng_prospects_refusal_is_closed') then
    alter table eng_prospects add constraint eng_prospects_refusal_is_closed
      check ((status <> 'not_interested' or stage in ('dormant', 'do_not_contact'))
         and (stage <> 'do_not_contact' or status = 'not_interested'));
  end if;
  /* Do not contact names when and by whom, and only do not contact does. */
  if not exists (select 1 from pg_constraint where conname = 'eng_prospects_do_not_contact_is_whole') then
    alter table eng_prospects add constraint eng_prospects_do_not_contact_is_whole
      check ((stage = 'do_not_contact') = (do_not_contact_at is not null and do_not_contact_by is not null));
  end if;
end;
$$;

/* Unique 1: one company per normalized name and telephone, where it has a telephone. */
create unique index if not exists eng_prospects_name_phone_key
  on eng_prospects (name_normalized, phone_normalized) where phone_normalized is not null;
create index if not exists eng_prospects_queue_idx on eng_prospects (owner_id, next_action_at);
create index if not exists eng_prospects_stage_idx on eng_prospects (stage);
create index if not exists eng_prospects_county_idx on eng_prospects (county);
create index if not exists eng_prospects_vertical_idx on eng_prospects (vertical);
create index if not exists eng_prospects_tags_idx on eng_prospects using gin (tags);

/* -------------------------------------------------- several people per company */

create table if not exists eng_prospect_contacts (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  prospect_id       uuid not null references eng_prospects (id) on delete cascade,
  full_name         text,
  role_title        text,
  phone             text,
  phone_normalized  text generated always as (public.eng_crm_normalize_phone(phone)) stored,
  email             text,
  is_primary        boolean not null default false,
  created_by        uuid references eng_profiles (id) on delete restrict,
  constraint eng_prospect_contacts_says_who check (
    length(btrim(coalesce(full_name, ''))) > 0 or phone is not null or email is not null
  )
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'eng_prospect_contacts_touch' and not tgisinternal) then
    create trigger eng_prospect_contacts_touch before update on eng_prospect_contacts
      for each row execute function eng_touch_updated_at();
  end if;
end;
$$;

/* One primary person per company: the one the company row's contact columns copy. */
create unique index if not exists eng_prospect_contacts_one_primary
  on eng_prospect_contacts (prospect_id) where is_primary;
create index if not exists eng_prospect_contacts_prospect_idx on eng_prospect_contacts (prospect_id);
create index if not exists eng_prospect_contacts_phone_idx on eng_prospect_contacts (phone_normalized) where phone_normalized is not null;

alter table eng_prospect_contacts enable row level security;
revoke all on eng_prospect_contacts from public, anon, authenticated;

comment on table eng_prospect_contacts is
  'The people at a company on the sales list, several per company. The primary one is copied onto the eng_prospects row so the existing screens and the reachable check keep reading it. 0111.';

/* The people already on the list: one primary contact per company that names somebody or a way to reach them. */
insert into eng_prospect_contacts (prospect_id, full_name, phone, email, is_primary, created_by)
select p.id, p.contact_name, p.phone, p.email, true, p.created_by
  from eng_prospects p
 where (length(btrim(coalesce(p.contact_name, ''))) > 0 or p.phone is not null or p.email is not null)
   and not exists (select 1 from eng_prospect_contacts c where c.prospect_id = p.id and c.is_primary);

/* ------------------------------------------- several sources per company */

create table if not exists eng_prospect_sources (
  id                uuid primary key default gen_random_uuid(),
  prospect_id       uuid not null references eng_prospects (id) on delete cascade,
  source            text not null
                      constraint eng_prospect_sources_source_known
                      check (source in (
                        'permits_san_antonio', 'permits_corpus_christi', 'permits_houston',
                        'permits_dallas', 'permits_austin', 'permits_fort_worth',
                        'tdlr_electrical', 'tdlr_solar_retailers', 'tdlr_solar_salespeople',
                        'tdhca_mh', 'trec', 'csv', 'manual')),
  source_record_id  text not null check (length(btrim(source_record_id)) > 0),
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  /* The fields this source gave, as read, for whoever has to settle a conflict. */
  raw               jsonb,
  import_run_id     uuid,
  /* Unique 2: one row per record a source holds, wherever it was merged to. */
  constraint eng_prospect_sources_record_key unique (source, source_record_id),
  constraint eng_prospect_sources_seen_in_order check (last_seen_at >= first_seen_at)
);

create index if not exists eng_prospect_sources_prospect_idx on eng_prospect_sources (prospect_id);

alter table eng_prospect_sources enable row level security;
revoke all on eng_prospect_sources from public, anon, authenticated;

comment on table eng_prospect_sources is
  'Every source a company on the sales list came from, one row per source record. A merge moves rows here to the surviving company, so a merge keeps every source. Unique on (source, source_record_id). 0111.';

/* The companies already on the list came from a spreadsheet or were typed in. */
insert into eng_prospect_sources (prospect_id, source, source_record_id, first_seen_at, last_seen_at)
select p.id, case when p.import_batch_id is null then 'manual' else 'csv' end, p.id::text, p.created_at, p.created_at
  from eng_prospects p
 where not exists (select 1 from eng_prospect_sources s where s.prospect_id = p.id);

/* ------------------------------------------- activities, in the existing log */

alter table eng_contact_log add column if not exists activity_kind text;
alter table eng_contact_log add column if not exists crm_outcome text;
alter table eng_contact_log add column if not exists callback_at timestamptz;
alter table eng_contact_log add column if not exists stage_from text;
alter table eng_contact_log add column if not exists stage_to text;
alter table eng_contact_log add column if not exists not_interested_reason text;
alter table eng_contact_log add column if not exists contact_id uuid references eng_prospect_contacts (id) on delete restrict;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'eng_contact_log_activity_kind_known') then
    alter table eng_contact_log add constraint eng_contact_log_activity_kind_known check (
      activity_kind is null or activity_kind in ('call', 'email', 'note', 'stage_change', 'assignment', 'import', 'sequence'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eng_contact_log_crm_outcome_known') then
    alter table eng_contact_log add constraint eng_contact_log_crm_outcome_known check (
      crm_outcome is null or crm_outcome in (
        'no_answer', 'voicemail', 'callback', 'interested', 'not_interested',
        'wrong_number', 'do_not_call', 'connected'));
  end if;
  /* A CRM activity is about a prospect. */
  if not exists (select 1 from pg_constraint where conname = 'eng_contact_log_crm_is_a_prospect') then
    alter table eng_contact_log add constraint eng_contact_log_crm_is_a_prospect check (
      (crm_outcome is null and stage_to is null and contact_id is null and callback_at is null)
      or subject_type = 'prospect');
  end if;
  /*
   * A stage change is a note that names where it went, and only a stage
   * change names stages. "is not distinct from", never "=": a null kind
   * compared with = is null, and a check that evaluates to null passes.
   */
  if not exists (select 1 from pg_constraint where conname = 'eng_contact_log_stage_change_is_whole') then
    alter table eng_contact_log add constraint eng_contact_log_stage_change_is_whole check (
      (activity_kind is not distinct from 'stage_change') = (stage_to is not null)
      and (stage_to is null or channel = 'note')
      and (stage_from is null or stage_to is not null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eng_contact_log_stages_known') then
    alter table eng_contact_log add constraint eng_contact_log_stages_known check (
      (stage_from is null or stage_from in ('new', 'attempted', 'connected', 'interested', 'account_opened', 'ordering', 'dormant', 'do_not_contact'))
      and (stage_to is null or stage_to in ('new', 'attempted', 'connected', 'interested', 'account_opened', 'ordering', 'dormant', 'do_not_contact')));
  end if;
  /* A callback names its time; a refusal names its reason. */
  if not exists (select 1 from pg_constraint where conname = 'eng_contact_log_callback_has_a_time') then
    alter table eng_contact_log add constraint eng_contact_log_callback_has_a_time check (
      (crm_outcome is not distinct from 'callback') = (callback_at is not null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eng_contact_log_refusal_has_a_reason') then
    alter table eng_contact_log add constraint eng_contact_log_refusal_has_a_reason check (
      (crm_outcome is distinct from 'not_interested') or length(btrim(coalesce(not_interested_reason, ''))) > 0);
  end if;
end;
$$;

create index if not exists eng_contact_log_crm_idx on eng_contact_log (prospect_id, activity_kind, created_at desc) where prospect_id is not null;

/* ------------------------------------------------------------------ the grants */

/*
 * Robert's grants: crm.import, crm.assign and crm.reports for admin and
 * ops_manager; crm.use stays with rep, ops_manager and admin (unchanged, 0079).
 * The sales manager is ops_manager and the rep is also the account manager
 * (his answer 2); sales holds no CRM grant.
 */
insert into eng_role_grants (role_key, action) values
  ('admin', 'crm.assign'),
  ('admin', 'crm.import'),
  ('admin', 'crm.reports'),
  ('ops_manager', 'crm.assign'),
  ('ops_manager', 'crm.import'),
  ('ops_manager', 'crm.reports')
on conflict (role_key, action) do nothing;

/* ------------------------------------------------------------- closing assert */

do $$
declare
  v_missing text;
begin
  select string_agg(c, ', ') into v_missing
    from unnest(array[
      'vertical', 'stage', 'score', 'next_action_at', 'next_action_kind', 'sequence_step', 'tags',
      'website', 'address_line', 'postal_code', 'county', 'permit_count', 'last_permit_on',
      'do_not_contact_at', 'do_not_contact_by', 'name_normalized', 'phone_normalized'
    ]) c
   where not exists (
     select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'eng_prospects' and column_name = c);
  if v_missing is not null then
    raise exception 'eng: 0111 expects these eng_prospects columns after it runs: %', v_missing;
  end if;
  if to_regclass('public.eng_prospect_contacts') is null or to_regclass('public.eng_prospect_sources') is null then
    raise exception 'eng: 0111 expects eng_prospect_contacts and eng_prospect_sources after it runs.';
  end if;
  if to_regclass('public.eng_prospects_name_phone_key') is null then
    raise exception 'eng: 0111 expects the unique index eng_prospects_name_phone_key after it runs.';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eng_prospect_sources_record_key') then
    raise exception 'eng: 0111 expects the unique key eng_prospect_sources_record_key after it runs.';
  end if;
  if (select count(*) from eng_role_grants
       where action in ('crm.assign', 'crm.import', 'crm.reports') and role_key in ('admin', 'ops_manager')) <> 6 then
    raise exception 'eng: 0111 expects crm.assign, crm.import and crm.reports held by admin and ops_manager.';
  end if;
  if exists (select 1 from eng_role_grants
              where action in ('crm.assign', 'crm.import', 'crm.reports') and role_key not in ('admin', 'ops_manager')) then
    raise exception 'eng: 0111 found a CRM management grant held by a role other than admin and ops_manager.';
  end if;
  if exists (select 1 from eng_prospects p
              where not exists (select 1 from eng_prospect_sources s where s.prospect_id = p.id)) then
    raise exception 'eng: 0111 expects every prospect to carry at least one source after it runs.';
  end if;
end;
$$;
