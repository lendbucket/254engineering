/*
 * ===========================================================================
 * 0117: A ROOFER OPENS AN ACCOUNT FIRST AND FINISHES THE PROFILE AFTER.
 * Robert's rework of the roofer partner sign up, 2026-11-06: "give them an
 * account at the start", step one asks only company, owner, email, phone and
 * a password, and the work, insurance and references are a "Finish your
 * profile" checklist inside the portal, each section saving on its own.
 * ===========================================================================
 *
 * WHAT 0113 MADE, AND WHAT THIS CHANGES.
 *   - Every field of eng_roofer_applications was required at once. The work,
 *     insurance and reference fields become nullable, and each of the three
 *     sections gains a done time: work_done_at, insurance_done_at,
 *     references_done_at. A check holds a section's fields present whenever
 *     its done time is set, so "done" can never be said of an empty section.
 *   - An approval OPENED the account (door 2), so a check held "approved
 *     exactly when an account is named". Now the account opens at step one
 *     (door 1, 0043), so the check becomes "an approval always names its
 *     account"; an application made before this file has no account until a
 *     person approves it, and keeps working as it did.
 *   - The decide once trigger refused every update but the decision. Now an
 *     application that is still received may have its PROFILE filled in, and
 *     nothing else: who it is (company, owner, email, phone), its prospect
 *     and its account never change. The decision is still made once, and
 *     still changes nothing the roofer wrote.
 *   - eng_take_roofer_application takes the step one fields and the account
 *     the sign up just opened. The prospect and its due now review are made
 *     exactly as 0113 makes them.
 *
 * DESTRUCTIVE IN SHAPE, NOTHING DESTROYED: it drops sixteen NOT NULLs and one
 * check (re-added in a wider form) and replaces a trigger function and a
 * function. No row, column or table is removed. The connector cancels a drop,
 * so this goes by the operator_sql_editor route, development first, with
 * Robert approving the prompt, as 0113 did.
 */

/* ------------------------------------------------------------------- section 0 */

do $$
begin
  if to_regclass('public.eng_roofer_applications') is null then
    raise exception 'eng: 0117 follows 0113, which adds eng_roofer_applications. It does not exist here.';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eng_roofer_applications_approval_names_its_account') then
    raise exception 'eng: 0117 widens eng_roofer_applications_approval_names_its_account (0113), which does not exist here.';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'eng_roofer_applications' and column_name = 'work_done_at') then
    raise exception 'eng: 0117 expects no section done times before it runs.';
  end if;
end;
$$;

/* -------------------------------------------- the profile is filled in later */

alter table eng_roofer_applications
  alter column owner_title drop not null,
  alter column office_city drop not null,
  alter column counties drop not null,
  alter column years_in_business drop not null,
  alter column crew_count drop not null,
  alter column work_mix drop not null,
  alter column roofs_per_year drop not null,
  alter column services drop not null,
  alter column monthly_volume drop not null,
  alter column insurance_carrier drop not null,
  alter column gl_per_occurrence drop not null,
  alter column gl_aggregate drop not null,
  alter column reference1_name drop not null,
  alter column reference1_phone drop not null,
  alter column reference2_name drop not null,
  alter column reference2_phone drop not null;

alter table eng_roofer_applications
  add column work_done_at timestamptz,
  add column insurance_done_at timestamptz,
  add column references_done_at timestamptz;

/* A section is done only when what it asks is there. An application from before 0117 was whole, so each is backfilled done. */
update eng_roofer_applications
   set work_done_at = created_at, insurance_done_at = created_at, references_done_at = created_at
 where work_done_at is null;

alter table eng_roofer_applications
  add constraint eng_roofer_applications_work_is_whole check (
    work_done_at is null or (
      office_city is not null and counties is not null and years_in_business is not null and crew_count is not null
      and work_mix is not null and roofs_per_year is not null and services is not null and monthly_volume is not null)
  ),
  add constraint eng_roofer_applications_insurance_is_whole check (
    insurance_done_at is null or (
      insurance_carrier is not null and gl_per_occurrence is not null and gl_aggregate is not null and certificate_path is not null)
  ),
  add constraint eng_roofer_applications_references_are_whole check (
    references_done_at is null or (
      reference1_name is not null and reference1_phone is not null and reference2_name is not null and reference2_phone is not null)
  );

/* --------------------------------------- an approval names its account, still */

alter table eng_roofer_applications drop constraint eng_roofer_applications_approval_names_its_account;
alter table eng_roofer_applications add constraint eng_roofer_applications_approval_names_its_account
  check (status <> 'approved' or account_id is not null);

comment on column eng_roofer_applications.account_id is
  'The partner account. Since 0117 it opens at step one, through door 1; an application from before 0117 has it from its approval, through door 2.';

/* ---------------------------------- the profile while received, the decision once */

create or replace function public.eng_roofer_application_decides_once()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if old.status <> 'received' then
    raise exception 'eng: a roofer application is decided once, and this one is %', old.status using errcode = '23514';
  end if;
  /* Who it is never changes: the company, the owner, how to reach them, its prospect and its account. */
  if (new.id, new.created_at, new.legal_name, new.owner_name, new.email, new.phone, new.prospect_id)
     is distinct from
     (old.id, old.created_at, old.legal_name, old.owner_name, old.email, old.phone, old.prospect_id)
     or (old.account_id is not null and new.account_id is distinct from old.account_id) then
    raise exception 'eng: an application keeps who it is: company, owner, email, phone, prospect and account' using errcode = '23514';
  end if;
  if new.status = 'received' then
    /* Still under review: the profile may be filled in; the checks hold each section whole. */
    return new;
  end if;
  if new.status not in ('approved', 'declined') then
    raise exception 'eng: a roofer application moves only to approved or declined' using errcode = '23514';
  end if;
  /* The decision changes nothing the roofer wrote. */
  if (new.dba, new.owner_title, new.office_city, new.counties, new.years_in_business, new.crew_count, new.work_mix,
      new.roofs_per_year, new.services, new.monthly_volume, new.insurance_carrier, new.gl_per_occurrence,
      new.gl_aggregate, new.reference1_name, new.reference1_company, new.reference1_phone, new.reference2_name,
      new.reference2_company, new.reference2_phone, new.certificate_path,
      new.work_done_at, new.insurance_done_at, new.references_done_at)
     is distinct from
     (old.dba, old.owner_title, old.office_city, old.counties, old.years_in_business, old.crew_count, old.work_mix,
      old.roofs_per_year, old.services, old.monthly_volume, old.insurance_carrier, old.gl_per_occurrence,
      old.gl_aggregate, old.reference1_name, old.reference1_company, old.reference1_phone, old.reference2_name,
      old.reference2_company, old.reference2_phone, old.certificate_path,
      old.work_done_at, old.insurance_done_at, old.references_done_at) then
    raise exception 'eng: a decision changes nothing the roofer wrote' using errcode = '23514';
  end if;
  return new;
end;
$fn$;

revoke execute on function public.eng_roofer_application_decides_once() from public, anon, authenticated;

/* ------------------------------------------------- step one, in one transaction */

create or replace function public.eng_take_roofer_application(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $fn$
declare
  v_id        uuid := (p->>'id')::uuid;
  v_account   uuid := nullif(p->>'account_id', '')::uuid;
  v_existing  uuid;
  v_prospect  uuid;
  v_today     date := (now() at time zone 'America/Chicago')::date;
begin
  if v_account is null then
    raise exception 'eng: a roofer application since 0117 names the account its sign up opened' using errcode = '23514';
  end if;

  /* A roofer already on the sales list, by the same rule 0112's unique key uses. */
  select id into v_existing
    from public.eng_prospects
   where name_normalized = public.eng_crm_normalize_name(p->>'legal_name')
     and phone_normalized = public.eng_crm_normalize_phone(p->>'phone')
   limit 1;
  v_prospect := coalesce(v_existing, gen_random_uuid());

  /* Step one only: who they are, and the account. The profile is filled in later, section by section. */
  insert into public.eng_roofer_applications (
    id, legal_name, owner_name, email, phone, landing_path, referrer, user_agent, prospect_id, account_id
  ) values (
    v_id, p->>'legal_name', p->>'owner_name', p->>'email', p->>'phone',
    nullif(p->>'landing_path', ''), nullif(p->>'referrer', ''), nullif(p->>'user_agent', ''), v_prospect, v_account
  );

  if v_existing is null then
    /* A new roofer prospect, unowned so the call list shows it, authored by this application. */
    insert into public.eng_prospects (
      id, company, contact_name, phone, email, prospect_type, vertical, follow_up_on,
      next_action_at, next_action_kind, created_by, roofer_application_id
    ) values (
      v_prospect, p->>'legal_name', p->>'owner_name', p->>'phone', p->>'email', 'roofer', 'roofer',
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
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'eng_roofer_applications'
                and column_name in ('counties', 'insurance_carrier', 'reference1_name') and is_nullable = 'NO') then
    raise exception 'eng: 0117 expects the profile fields to be nullable after it runs.';
  end if;
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'eng_roofer_applications'
         and column_name in ('work_done_at', 'insurance_done_at', 'references_done_at')) <> 3 then
    raise exception 'eng: 0117 expects the three section done times after it runs.';
  end if;
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'eng_roofer_applications_approval_names_its_account')) not like '%<>%' then
    raise exception 'eng: 0117 expects the approval check to read "an approval names its account".';
  end if;
  if (select count(*) from pg_constraint
       where conname in ('eng_roofer_applications_work_is_whole', 'eng_roofer_applications_insurance_is_whole',
                         'eng_roofer_applications_references_are_whole')) <> 3 then
    raise exception 'eng: 0117 expects the three section checks after it runs.';
  end if;
  if position('v_account' in pg_get_functiondef('public.eng_take_roofer_application(jsonb)'::regprocedure)) = 0 then
    raise exception 'eng: 0117 expects eng_take_roofer_application to name the account after it runs.';
  end if;
end $$;
