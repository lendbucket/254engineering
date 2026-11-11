/*
 * 0128: A FRANCHISEE IS ONBOARDED BEFORE IT OPERATES.
 *
 * Robert's overnight orders of 2026-11-10 into 2026-11-11, item 3, platform
 * item X4 of the franchise standing list: "Franchisee onboarding: agreement
 * signed, insurance certificates on file (Item 7 coverages), owner through the
 * academy, technicians certified by the engineer before dispatch. Reuses P1
 * and P3." Stacked on X2 (0127) under his answer 1 of 2026-11-11.
 *
 * STAFF AND ADMIN ONLY. Nothing here is public and nothing offers a franchise
 * (FR13). An administrator records each fact; the platform decides from them
 * whether a franchisee may move from onboarding to operating.
 *
 * Of the four steps, two are RECORDED here and two are READ from what the
 * platform already keeps:
 *
 *   the agreement      three columns on eng_franchisees: the day it was signed,
 *                      who recorded it and when. Whole or not at all.
 *   its certificates   eng_franchisee_certificates, one row per certificate of
 *                      insurance, its PDF in the private eng-franchisee-
 *                      certificates bucket with the SHA-256 beside it. The
 *                      shape of 0090's register, kept APART from it on purpose:
 *                      0090 records the FIRM's cover, and a franchisee's policy
 *                      read as the firm's would be a false statement about the
 *                      firm's own insurance.
 *   the owner          the academy (0106, P3), read for each owner.
 *   its technicians    certification (eng_certifications, the engineer's sign
 *                      off), read for each technician. Dispatch already refuses
 *                      an uncertified technician for a line; this step shows it.
 *
 * Which coverages a franchisee must have on file is FR6 and is not ruled. The
 * kinds below are the standing list's (general liability, auto, workers
 * compensation or a non-subscriber filing); which of them the gate REQUIRES
 * lives in code, src/lib/franchisee-onboarding-rules.ts, asked of Robert as
 * question 12 on issue #1.
 *
 * A CERTIFICATE ROW RECORDS WHAT THE CERTIFICATE SAYS, AND ONLY ITS WITHDRAWAL
 * MAY BE WRITTEN, the rule 0090 set: a certificate recorded in error or
 * replaced is withdrawn with a reason, never edited or deleted, and every
 * recording and withdrawal is written to the audit log in the same transaction.
 *
 * ADDITIVE ONLY: three columns, one table, one bucket, two functions.
 */

/* ------------------------------------------------------------- 0. the ground */
do $$
begin
  if not exists (select 1 from public.eng_roles where key = 'franchisee_owner') then
    raise exception 'eng: 0128 follows 0127, which adds the franchisee_owner role. It does not exist here.';
  end if;
  if to_regclass('public.eng_franchisee_certificates') is not null then
    raise exception 'eng: 0128 expects no eng_franchisee_certificates before it runs.';
  end if;
end;
$$;

/* ----------------------------------------------------------- 1. the agreement */
alter table eng_franchisees add column agreement_signed_on date;
alter table eng_franchisees add column agreement_recorded_by uuid references eng_profiles (id) on delete restrict;
alter table eng_franchisees add column agreement_recorded_at timestamptz;
alter table eng_franchisees add constraint eng_franchisees_agreement_whole check (
  (agreement_signed_on is null and agreement_recorded_by is null and agreement_recorded_at is null)
  or (agreement_signed_on is not null and agreement_recorded_by is not null and agreement_recorded_at is not null)
);

/* ------------------------------------------------------- 2. its certificates */
create table eng_franchisee_certificates (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  franchisee_id       uuid not null references eng_franchisees (id) on delete restrict,
  kind                text not null
                        constraint eng_franchisee_certificates_kind_known
                        check (kind in ('general_liability', 'auto', 'workers_compensation', 'non_subscriber_filing')),
  carrier             text not null constraint eng_franchisee_certificates_carrier_named check (btrim(carrier) <> ''),
  policy_number       text not null constraint eng_franchisee_certificates_policy_named check (btrim(policy_number) <> ''),
  effective_on        date not null,
  expires_on          date not null,
  certificate_key     text not null unique,
  certificate_sha256  text not null constraint eng_franchisee_certificates_sha256_shape check (certificate_sha256 ~ '^[0-9a-f]{64}$'),
  certificate_bytes   integer not null constraint eng_franchisee_certificates_bytes_positive check (certificate_bytes > 0),
  recorded_by         uuid not null references eng_profiles (id) on delete restrict,
  withdrawn_at        timestamptz,
  withdrawn_by        uuid references eng_profiles (id) on delete restrict,
  withdrawn_reason    text,
  constraint eng_franchisee_certificates_dates check (expires_on > effective_on),
  constraint eng_franchisee_certificates_withdrawn_whole check (
    (withdrawn_at is null and withdrawn_by is null and withdrawn_reason is null)
    or (withdrawn_at is not null and withdrawn_by is not null and btrim(coalesce(withdrawn_reason, '')) <> '')
  )
);

create index eng_franchisee_certificates_live
  on eng_franchisee_certificates (franchisee_id, kind, expires_on)
  where withdrawn_at is null;

alter table eng_franchisee_certificates enable row level security;
revoke all on eng_franchisee_certificates from public, anon, authenticated;

create or replace function eng_franchisee_certificate_guard()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'eng_franchisee_certificates rows cannot be deleted. A certificate recorded in error or replaced is withdrawn with a reason.';
  end if;
  if old.withdrawn_at is not null then
    raise exception 'A withdrawn franchisee certificate cannot change again.';
  end if;
  if new.id <> old.id
     or new.created_at <> old.created_at
     or new.franchisee_id <> old.franchisee_id
     or new.kind <> old.kind
     or new.carrier <> old.carrier
     or new.policy_number <> old.policy_number
     or new.effective_on <> old.effective_on
     or new.expires_on <> old.expires_on
     or new.certificate_key <> old.certificate_key
     or new.certificate_sha256 <> old.certificate_sha256
     or new.certificate_bytes <> old.certificate_bytes
     or new.recorded_by <> old.recorded_by then
    raise exception 'A franchisee certificate row records what the certificate says. Only its withdrawal may be written, once.';
  end if;
  return new;
end;
$fn$;

create trigger eng_franchisee_certificates_guard before update or delete on eng_franchisee_certificates
  for each row execute function eng_franchisee_certificate_guard();

/* Every recording and every withdrawal in the audit log, in the same transaction, as 0090 does for the firm's policies. */
create or replace function eng_franchisee_certificate_audit()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  insert into public.eng_audit_events (actor_id, actor_role, action, entity_type, entity_id, summary, diff)
  values (
    case when tg_op = 'INSERT' then new.recorded_by else new.withdrawn_by end,
    (select p.role from public.eng_profiles p
      where p.id = case when tg_op = 'INSERT' then new.recorded_by else new.withdrawn_by end),
    case when tg_op = 'INSERT' then 'franchisee_certificate.recorded' else 'franchisee_certificate.withdrawn' end,
    'franchisee_certificate',
    new.id::text,
    case
      when tg_op = 'INSERT' then new.kind || ' certificate ' || new.policy_number || ' with ' || new.carrier ||
        ', ' || new.effective_on::text || ' to ' || new.expires_on::text
      else new.kind || ' certificate ' || new.policy_number || ' withdrawn: ' || new.withdrawn_reason
    end,
    jsonb_build_object(
      'franchisee_id', new.franchisee_id,
      'kind', new.kind,
      'policy_number', new.policy_number,
      'expires_on', new.expires_on,
      'certificate_sha256', new.certificate_sha256
    )
  );
  return new;
end;
$fn$;

create trigger eng_franchisee_certificates_audit after insert or update on eng_franchisee_certificates
  for each row execute function eng_franchisee_certificate_audit();

/* Trigger functions only: nothing outside the database calls either, so neither is executable by the API roles (0102). */
revoke execute on function public.eng_franchisee_certificate_guard(), public.eng_franchisee_certificate_audit()
  from public, anon, authenticated;

comment on table eng_franchisee_certificates is
  'A franchisee''s certificates of insurance, one row per certificate, its PDF in eng-franchisee-certificates; withdrawn with a reason, never edited or deleted (Robert''s X4, 2026-11-10). Kept apart from the firm''s own policies (0090). 0128.';

/* ---------------------------------------------------------------- 3. the bucket */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('eng-franchisee-certificates', 'eng-franchisee-certificates', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

/* ------------------------------------------------------- 4. what must be true */
do $$
begin
  if to_regclass('public.eng_franchisee_certificates') is null then
    raise exception 'eng: 0128 expects eng_franchisee_certificates after it runs.';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.eng_franchisee_certificates'::regclass) then
    raise exception 'eng: 0128 expects row level security on eng_franchisee_certificates.';
  end if;
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'eng_franchisees'
        and column_name in ('agreement_signed_on', 'agreement_recorded_by', 'agreement_recorded_at')) <> 3 then
    raise exception 'eng: 0128 expects the three agreement columns on eng_franchisees.';
  end if;
  if not exists (select 1 from storage.buckets where id = 'eng-franchisee-certificates' and not public) then
    raise exception 'eng: 0128 expects the private eng-franchisee-certificates bucket.';
  end if;
end;
$$;
