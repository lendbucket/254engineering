/*
 * ===========================================================================
 * 0113: A ROOFER APPLIES TO WORK WITH THE FIRM, AND A PERSON DECIDES.
 * Robert's request and rulings of 2026-11-05 (issue #1, 6665440881; the
 * answers on ops/day the same afternoon). Numbered 0113 on his order of the
 * same day, the roofer application directly after R1 (0112); R2 onward move up
 * one on new stage branches.
 * ===========================================================================
 *
 * Texas roofing companies apply on /roofing-partners/apply. A person at the
 * firm reads every application in the portal and approves or declines it, with
 * a reason. Nothing approves automatically. An approval opens a B2B account
 * through door 2 (ruling 1); a decline sends one plain email.
 *
 * WHAT THIS FILE DOES, IN FOUR PARTS.
 *
 *   1. eng_roofer_applications: every answer the form asks, the certificate's
 *      storage key, and the decision. A decision is made once: received moves
 *      to approved or declined and nothing moves after that (the trigger
 *      below). The row may be deleted, because a test record is removed in the
 *      normal way and a person may ask for their application to be erased.
 *
 *   2. roofers.review, for admin and ops_manager (ruling 6), seeded here and
 *      pinned in roles-audit.
 *
 *   3. THE APPLICATION IS ITS OWN SOURCE ON A ROOFER PROSPECT, WITH A DUE NOW
 *      REVIEW ACTION (ruling 3). 0112's two checks gain one word each:
 *      eng_prospect_sources_source_known gains 'roofer_application', and
 *      eng_prospects_next_action_kind_known gains 'review_application'.
 *
 *   4. A PROSPECT'S AUTHOR IS A PERSON OR AN APPLICATION. eng_prospects
 *      required created_by, a staff profile, since 0079, and a public
 *      application has no staff author. Inventing one would put a person's
 *      name on work they never did. So the NOT NULL becomes a check that says
 *      the true thing: a prospect was entered by a person, or it arrived as a
 *      roofer application, and the column that says which is set.
 *
 * THIS FILE IS NOT ADDITIVE, AND GOES BY THE operator_sql_editor ROUTE. Parts 3
 * and 4 drop and re-add two checks and drop a NOT NULL, which the connector
 * cancels before it runs. docs/production-sitting-destructive.md names it, and
 * Robert approves the prompt at both sittings, development first.
 *
 * ONE FUNCTION WRITES AN APPLICATION, IN ONE TRANSACTION. eng_take_roofer_
 * application inserts the application, finds the roofer prospect with the same
 * normalized name and phone or makes one, records the source row, and sets the
 * due now review action. An application never lands without its prospect, and
 * a roofer already on the sales list is not made twice (0112's unique key on
 * normalized name and phone would refuse that anyway).
 *
 * Development first, on its stage branch; production at the sitting after the
 * roofer application's board.
 */

/* ------------------------------------------------------------------- section 0 */

do $$
begin
  if to_regclass('public.eng_prospects') is null or to_regclass('public.eng_prospect_sources') is null then
    raise exception 'eng: 0113 extends the sales list (0079, 0112), which does not exist here.';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eng_prospect_sources_source_known') then
    raise exception 'eng: 0113 widens eng_prospect_sources_source_known (0112), which does not exist here.';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eng_prospects_next_action_kind_known') then
    raise exception 'eng: 0113 widens eng_prospects_next_action_kind_known (0112), which does not exist here.';
  end if;
  if to_regclass('public.eng_roofer_applications') is not null then
    raise exception 'eng: 0113 expects no eng_roofer_applications before it runs.';
  end if;
end $$;

/* ------------------------------------------------------------ the application */

create table eng_roofer_applications (
  id                    uuid primary key,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  legal_name            text not null check (length(btrim(legal_name)) between 1 and 200),
  dba                   text check (dba is null or length(btrim(dba)) between 1 and 200),
  owner_name            text not null check (length(btrim(owner_name)) between 1 and 120),
  owner_title           text not null check (length(btrim(owner_title)) between 1 and 80),
  email                 text not null check (position('@' in email) > 1 and length(email) <= 200),
  phone                 text not null check (length(btrim(phone)) between 10 and 40),
  office_city           text not null check (length(btrim(office_city)) between 1 and 80),
  counties              text[] not null check (cardinality(counties) between 1 and 254),
  years_in_business     integer not null check (years_in_business between 0 and 150),
  crew_count            integer not null check (crew_count between 1 and 500),
  work_mix              text not null check (work_mix in ('residential', 'commercial', 'both')),
  roofs_per_year        integer not null check (roofs_per_year between 0 and 100000),
  services              text[] not null
                          check (cardinality(services) between 1 and 4
                                 and services <@ array['inspections', 'roof_certifications', 'windstorm', 'repair_specifications']::text[]),
  monthly_volume        text not null check (monthly_volume in ('1_5', '6_15', '16_40', 'over_40')),
  insurance_carrier     text not null check (length(btrim(insurance_carrier)) between 1 and 120),
  gl_per_occurrence     text not null check (length(btrim(gl_per_occurrence)) between 1 and 40),
  gl_aggregate          text not null check (length(btrim(gl_aggregate)) between 1 and 40),
  reference1_name       text not null check (length(btrim(reference1_name)) between 1 and 120),
  reference1_company    text,
  reference1_phone      text not null check (length(btrim(reference1_phone)) between 10 and 40),
  reference2_name       text not null check (length(btrim(reference2_name)) between 1 and 120),
  reference2_company    text,
  reference2_phone      text not null check (length(btrim(reference2_phone)) between 10 and 40),
  /* The storage key of the certificate, checked against this application's own prefix by the route. */
  certificate_path      text,

  landing_path          text,
  referrer              text,
  user_agent            text,

  /*
   * DEFERRED, because the application and a prospect it creates name each
   * other: the application is written first under the prospect's chosen id,
   * and the prospect follows in the same transaction. CASCADE, because a
   * prospect removed (a test record in the normal way) takes the applications
   * it carries with it rather than leaving them pointing at nothing.
   */
  prospect_id           uuid not null references eng_prospects (id) on delete cascade deferrable initially deferred,

  status                text not null default 'received'
                          constraint eng_roofer_applications_status_known
                          check (status in ('received', 'approved', 'declined')),
  decided_at            timestamptz,
  decided_by            uuid references eng_profiles (id) on delete restrict,
  decision_reason       text,
  /* The account an approval opened, through door 2. */
  account_id            uuid references eng_customer_accounts (id) on delete restrict,

  /* A decision is whole: who, when and why, or none of the three. */
  constraint eng_roofer_applications_decision_is_whole check (
    (status = 'received') = (decided_at is null and decided_by is null and decision_reason is null)
  ),
  constraint eng_roofer_applications_reason_is_written check (
    decision_reason is null or length(btrim(decision_reason)) between 3 and 2000
  ),
  /* Only an approval opens an account, and an approval always names it. */
  constraint eng_roofer_applications_approval_names_its_account check (
    (status = 'approved') = (account_id is not null)
  )
);

create trigger eng_roofer_applications_touch before update on eng_roofer_applications
  for each row execute function eng_touch_updated_at();

create index eng_roofer_applications_status_idx on eng_roofer_applications (status, created_at desc);
create index eng_roofer_applications_prospect_idx on eng_roofer_applications (prospect_id);

alter table eng_roofer_applications enable row level security;

/*
 * A DECISION IS MADE ONCE. An update may only move a received application to
 * approved or declined, and may touch nothing the roofer wrote. After that the
 * row does not change: a second look is a new application, not a rewritten
 * decision.
 */
create or replace function public.eng_roofer_application_decides_once()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if old.status <> 'received' then
    raise exception 'eng: a roofer application is decided once, and this one is %', old.status using errcode = '23514';
  end if;
  if new.status not in ('approved', 'declined') then
    raise exception 'eng: a roofer application moves only to approved or declined' using errcode = '23514';
  end if;
  if (new.id, new.created_at, new.legal_name, new.dba, new.owner_name, new.owner_title, new.email, new.phone,
      new.office_city, new.counties, new.years_in_business, new.crew_count, new.work_mix, new.roofs_per_year,
      new.services, new.monthly_volume, new.insurance_carrier, new.gl_per_occurrence, new.gl_aggregate,
      new.reference1_name, new.reference1_company, new.reference1_phone, new.reference2_name,
      new.reference2_company, new.reference2_phone, new.certificate_path, new.prospect_id)
     is distinct from
     (old.id, old.created_at, old.legal_name, old.dba, old.owner_name, old.owner_title, old.email, old.phone,
      old.office_city, old.counties, old.years_in_business, old.crew_count, old.work_mix, old.roofs_per_year,
      old.services, old.monthly_volume, old.insurance_carrier, old.gl_per_occurrence, old.gl_aggregate,
      old.reference1_name, old.reference1_company, old.reference1_phone, old.reference2_name,
      old.reference2_company, old.reference2_phone, old.certificate_path, old.prospect_id) then
    raise exception 'eng: a decision changes nothing the roofer wrote' using errcode = '23514';
  end if;
  return new;
end;
$fn$;

create trigger eng_roofer_applications_decide_once before update on eng_roofer_applications
  for each row execute function public.eng_roofer_application_decides_once();

revoke execute on function public.eng_roofer_application_decides_once() from public, anon, authenticated;

/* ------------------------------------------------------------------ the grant */

insert into eng_role_grants (role_key, action) values
  ('admin', 'roofers.review'),
  ('ops_manager', 'roofers.review')
on conflict (role_key, action) do nothing;

/* ------------------------------------- the sales list learns the application */

alter table eng_prospect_sources drop constraint eng_prospect_sources_source_known;
alter table eng_prospect_sources add constraint eng_prospect_sources_source_known
  check (source in (
    'permits_san_antonio', 'permits_corpus_christi', 'permits_houston',
    'permits_dallas', 'permits_austin', 'permits_fort_worth',
    'tdlr_electrical', 'tdlr_solar_retailers', 'tdlr_solar_salespeople',
    'tdhca_mh', 'trec', 'csv', 'manual', 'roofer_application'));

alter table eng_prospects drop constraint eng_prospects_next_action_kind_known;
alter table eng_prospects add constraint eng_prospects_next_action_kind_known
  check (next_action_kind is null or next_action_kind in ('call', 'email', 'review_application'));

/* A prospect's author is a person, or the application it arrived as. */
/* No action rather than set null: setting it null would leave a prospect with no author, which the check below refuses. */
alter table eng_prospects add column roofer_application_id uuid
  references eng_roofer_applications (id);
alter table eng_prospects alter column created_by drop not null;
alter table eng_prospects add constraint eng_prospects_has_an_author
  check (created_by is not null or roofer_application_id is not null);

/* ------------------------------------------------- one transaction per application */

create or replace function public.eng_take_roofer_application(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $fn$
declare
  v_id        uuid := (p->>'id')::uuid;
  v_existing  uuid;
  v_prospect  uuid;
  v_today     date := (now() at time zone 'America/Chicago')::date;
begin
  /* A roofer already on the sales list, by the same rule 0112's unique key uses. */
  select id into v_existing
    from public.eng_prospects
   where name_normalized = public.eng_crm_normalize_name(p->>'legal_name')
     and phone_normalized = public.eng_crm_normalize_phone(p->>'phone')
   limit 1;
  v_prospect := coalesce(v_existing, gen_random_uuid());

  /* The application first, under the prospect id; that key is deferred to the end of the transaction. */
  insert into public.eng_roofer_applications (
    id, legal_name, dba, owner_name, owner_title, email, phone, office_city, counties,
    years_in_business, crew_count, work_mix, roofs_per_year, services, monthly_volume,
    insurance_carrier, gl_per_occurrence, gl_aggregate,
    reference1_name, reference1_company, reference1_phone,
    reference2_name, reference2_company, reference2_phone,
    certificate_path, landing_path, referrer, user_agent, prospect_id
  ) values (
    v_id, p->>'legal_name', nullif(p->>'dba', ''), p->>'owner_name', p->>'owner_title', p->>'email', p->>'phone',
    p->>'office_city', array(select jsonb_array_elements_text(p->'counties')),
    (p->>'years_in_business')::int, (p->>'crew_count')::int, p->>'work_mix', (p->>'roofs_per_year')::int,
    array(select jsonb_array_elements_text(p->'services')), p->>'monthly_volume',
    p->>'insurance_carrier', p->>'gl_per_occurrence', p->>'gl_aggregate',
    p->>'reference1_name', nullif(p->>'reference1_company', ''), p->>'reference1_phone',
    p->>'reference2_name', nullif(p->>'reference2_company', ''), p->>'reference2_phone',
    nullif(p->>'certificate_path', ''), nullif(p->>'landing_path', ''), nullif(p->>'referrer', ''),
    nullif(p->>'user_agent', ''), v_prospect
  );

  if v_existing is null then
    /* A new roofer prospect, unowned so the call list shows it, authored by this application. */
    insert into public.eng_prospects (
      id, company, contact_name, phone, email, city, prospect_type, vertical, follow_up_on,
      next_action_at, next_action_kind, created_by, roofer_application_id
    ) values (
      v_prospect, p->>'legal_name', p->>'owner_name', p->>'phone', p->>'email', p->>'office_city', 'roofer', 'roofer',
      v_today, now(), 'review_application', null, v_id
    );
  else
    /* A roofer already on the list: the review becomes its next action, and its owner is kept. */
    update public.eng_prospects
       set next_action_at = now(), next_action_kind = 'review_application',
           follow_up_on = least(coalesce(follow_up_on, v_today), v_today)
     where id = v_prospect and status = 'open';
  end if;

  insert into public.eng_prospect_sources (prospect_id, source, source_record_id, raw)
  values (v_prospect, 'roofer_application', v_id::text, p - 'user_agent');

  return jsonb_build_object('application_id', v_id, 'prospect_id', v_prospect, 'existing_prospect', v_existing is not null);
end;
$fn$;

revoke execute on function public.eng_take_roofer_application(jsonb) from public, anon, authenticated;
grant execute on function public.eng_take_roofer_application(jsonb) to service_role;

/* ------------------------------------------------------------- closing checks */

do $$
begin
  if to_regclass('public.eng_roofer_applications') is null then
    raise exception 'eng: 0113 expects eng_roofer_applications after it runs.';
  end if;
  if to_regprocedure('public.eng_take_roofer_application(jsonb)') is null then
    raise exception 'eng: 0113 expects eng_take_roofer_application after it runs.';
  end if;
  if (select count(*) from public.eng_role_grants where action = 'roofers.review') <> 2
     or exists (select 1 from public.eng_role_grants where action = 'roofers.review' and role_key not in ('admin', 'ops_manager')) then
    raise exception 'eng: 0113 expects roofers.review held by admin and ops_manager and nobody else.';
  end if;
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'eng_prospect_sources_source_known')) not like '%roofer_application%' then
    raise exception 'eng: 0113 expects the source check to name roofer_application.';
  end if;
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'eng_prospects_next_action_kind_known')) not like '%review_application%' then
    raise exception 'eng: 0113 expects the next action check to name review_application.';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eng_prospects_has_an_author') then
    raise exception 'eng: 0113 expects eng_prospects_has_an_author after it runs.';
  end if;
end $$;
