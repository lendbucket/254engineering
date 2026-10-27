/*
 * 0090: INSURANCE IS A REGISTER. Robert's addendum of 2026-10-25, item 1, from
 * the readiness audit.
 *
 * The firm's professional liability cover was a list typed into
 * src/config/credentials.ts (verifiedInsurance), empty, with an owner's
 * override that expires on 2026-10-28. This is where a policy is recorded
 * instead: carrier, policy number, kind, the per claim and aggregate limits,
 * the named insureds, the effective and expiry dates, and the certificate PDF
 * in a private bucket, with the SHA-256 of the file recorded beside it.
 *
 * WHAT IT DOES NOT DO. It does not decide whether the firm may take money.
 * Whether the launch gate reads this register, and in which direction, is a
 * ruling asked of Robert on 2026-10-25; until he gives it, the gate reads the
 * code list exactly as before, and nothing in this migration changes that.
 *
 * THE ROW RECORDS WHAT THE CERTIFICATE SAYS, AND ONLY ITS WITHDRAWAL MAY BE
 * WRITTEN. A policy recorded in error, or replaced, is withdrawn with a reason,
 * never edited or deleted, the pattern 0061 set for seal images: the record a
 * reader relied on can always be found as it was.
 *
 * ADDITIVE ONLY. Two tables, one bucket, one function pair, one grant per
 * role. No drop.
 */

create table if not exists eng_insurance_policies (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  kind                  text not null check (kind in ('professional_liability', 'general_liability')),
  carrier               text not null check (btrim(carrier) <> ''),
  policy_number         text not null check (btrim(policy_number) <> ''),
  limit_per_claim_cents bigint not null check (limit_per_claim_cents > 0),
  limit_aggregate_cents bigint not null,
  named_insureds        text[] not null check (cardinality(named_insureds) >= 1),
  effective_on          date not null,
  expires_on            date not null,
  certificate_key       text not null unique,
  certificate_sha256    text not null check (certificate_sha256 ~ '^[0-9a-f]{64}$'),
  certificate_bytes     integer not null check (certificate_bytes > 0),
  recorded_by           uuid not null references eng_profiles(id) on delete restrict,
  withdrawn_at          timestamptz,
  withdrawn_by          uuid references eng_profiles(id) on delete restrict,
  withdrawn_reason      text,
  constraint eng_insurance_policies_limits_ck check (limit_aggregate_cents >= limit_per_claim_cents),
  constraint eng_insurance_policies_dates_ck check (expires_on > effective_on),
  constraint eng_insurance_policies_withdrawn_whole_ck check (
    (withdrawn_at is null and withdrawn_by is null and withdrawn_reason is null)
    or (withdrawn_at is not null and withdrawn_by is not null and btrim(coalesce(withdrawn_reason, '')) <> '')
  )
);

create index if not exists eng_insurance_policies_in_force
  on eng_insurance_policies (kind, expires_on)
  where withdrawn_at is null;

alter table eng_insurance_policies enable row level security;

create or replace function eng_insurance_policy_guard()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'eng_insurance_policies rows cannot be deleted. A policy recorded in error or replaced is withdrawn with a reason.';
  end if;
  if old.withdrawn_at is not null then
    raise exception 'A withdrawn insurance policy cannot change again.';
  end if;
  if new.id <> old.id
     or new.created_at <> old.created_at
     or new.kind <> old.kind
     or new.carrier <> old.carrier
     or new.policy_number <> old.policy_number
     or new.limit_per_claim_cents <> old.limit_per_claim_cents
     or new.limit_aggregate_cents <> old.limit_aggregate_cents
     or new.named_insureds <> old.named_insureds
     or new.effective_on <> old.effective_on
     or new.expires_on <> old.expires_on
     or new.certificate_key <> old.certificate_key
     or new.certificate_sha256 <> old.certificate_sha256
     or new.certificate_bytes <> old.certificate_bytes
     or new.recorded_by <> old.recorded_by then
    raise exception 'An insurance policy row records what the certificate says. Only its withdrawal may be written, once.';
  end if;
  return new;
end;
$fn$;

drop trigger if exists eng_insurance_policies_guard on eng_insurance_policies;
create trigger eng_insurance_policies_guard before update or delete on eng_insurance_policies
  for each row execute function eng_insurance_policy_guard();

/* Every recording and every withdrawal in the audit log, in the same transaction, as 0061 does for seal images. */
create or replace function eng_insurance_policy_audit()
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
    case when tg_op = 'INSERT' then 'insurance.recorded' else 'insurance.withdrawn' end,
    'insurance_policy',
    new.id::text,
    case
      when tg_op = 'INSERT' then new.kind || ' policy ' || new.policy_number || ' with ' || new.carrier ||
        ', ' || new.effective_on::text || ' to ' || new.expires_on::text
      else new.kind || ' policy ' || new.policy_number || ' withdrawn: ' || new.withdrawn_reason
    end,
    jsonb_build_object(
      'kind', new.kind,
      'policy_number', new.policy_number,
      'expires_on', new.expires_on,
      'certificate_sha256', new.certificate_sha256
    )
  );
  return new;
end;
$fn$;

drop trigger if exists eng_insurance_policies_audit on eng_insurance_policies;
create trigger eng_insurance_policies_audit after insert or update on eng_insurance_policies
  for each row execute function eng_insurance_policy_audit();

/*
 * ONE ROW PER POLICY AND THRESHOLD, SO AN ALERT IS SENT ONCE. The office and
 * the owner are told at 45, 14 and 1 days before expiry; the daily sweep
 * inserts here before it raises, and the primary key refuses a second send of
 * the same threshold for the same policy. A machine record, like 0023's alert
 * state, and kept: whether the firm was warned is worth being able to show.
 */
create table if not exists eng_insurance_alerts (
  policy_id      uuid not null references eng_insurance_policies(id) on delete restrict,
  days_before    integer not null check (days_before in (45, 14, 1)),
  sent_at        timestamptz not null default now(),
  primary key (policy_id, days_before)
);

alter table eng_insurance_alerts enable row level security;

create or replace function eng_insurance_alert_guard()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  raise exception 'eng_insurance_alerts rows record that a warning was sent. They are never changed or removed.';
end;
$fn$;

drop trigger if exists eng_insurance_alerts_guard on eng_insurance_alerts;
create trigger eng_insurance_alerts_guard before update or delete on eng_insurance_alerts
  for each row execute function eng_insurance_alert_guard();

revoke all on eng_insurance_policies, eng_insurance_alerts from public, anon, authenticated;
revoke execute on function eng_insurance_policy_guard(), eng_insurance_policy_audit(), eng_insurance_alert_guard()
  from public, anon, authenticated;

/* The certificates, private, PDF only, 10 MB. */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('eng-insurance', 'eng-insurance', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

/* The office and the owner record and withdraw cover (declared in DEFAULT_ROLES, pinned in roles-audit). */
insert into eng_role_grants (role_key, action) values
  ('admin', 'insurance.manage'),
  ('ops_manager', 'insurance.manage')
on conflict (role_key, action) do nothing;
