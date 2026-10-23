/*
 * ===========================================================================
 * 0084  A LINE OPENS ONLY WHEN IT IS SIGNED AND TRAINED, AND THE TRAINING IS A
 *       RECORD IN THE PORTAL.
 * ===========================================================================
 *
 * Operator ruling of 2026-10-23 (overnight queue, item 4): a line opens only
 * when its protocol is signed AND somebody is trained on that version,
 * recorded in the portal. The signature half is read from the database at
 * every money door since ruling 11. This is the training half.
 *
 * WHAT EXISTED. Since 2026-10-07 (src/lib/certification-record.ts) an
 * administrator records supervised training and the engineer of record
 * approves or refuses it from his own session. The record was kept as
 * append-only events in eng_audit_events, an interim decision taken because a
 * table needed a migration and the overnight run could not apply one; approval
 * also upserts eng_certifications, which dispatch reads. eng_certifications is
 * mutable and keyed on (technician, line), so approving a training on a later
 * version overwrites the earlier one, and it cannot say which version a person
 * was trained on.
 *
 * WHAT THIS DOES
 *   1. eng_training_records: one row per supervised training an administrator
 *      records, on one exact protocol template. Append only.
 *   2. eng_training_decisions: the engineer of record's approval or refusal of
 *      one record, at most one per record, a refusal carrying his reason.
 *      Append only.
 *   3. A one-time backfill of the interim events into both tables, each row
 *      naming the event it came from, so nothing recorded since 2026-10-07 is
 *      lost and nothing is recorded twice.
 *   4. eng_line_is_trained(service_slug, template_id): true only when an
 *      approved record on THAT template exists for an active technician. The
 *      money door asks it for every line opened by a portal signature;
 *      254-RC-001 keeps its own path, unchanged (operator ruling: roof stays
 *      exactly as it is).
 *
 * eng_certifications is untouched: dispatch still reads it.
 *
 * RLS on both tables with no policies, as every eng_ table. SECURITY INVOKER,
 * search_path pinned, EXECUTE revoked from PUBLIC, anon and authenticated in
 * this file (0073). No drop statement.
 */

/* 1. The training, as recorded. */
create table if not exists eng_training_records (
  id                     uuid primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),
  profile_id             uuid not null references eng_profiles (id) on delete restrict,
  service_slug           text not null,
  template_id            uuid not null references eng_protocol_templates (id) on delete restrict,
  protocol_document      text not null,
  protocol_version_label text not null,
  trained_on             date not null,
  supervised_by          text not null check (length(btrim(supervised_by)) >= 3),
  recorded_by            uuid references eng_profiles (id) on delete restrict,
  source_event_id        bigint unique
);
alter table eng_training_records enable row level security;
create index if not exists eng_training_records_line_idx on eng_training_records (service_slug, template_id);

comment on table eng_training_records is
  'Supervised training on one exact protocol template, recorded by an administrator. Counts for nothing until the engineer of record approves it (eng_training_decisions). Append only. 0084, operator ruling of 2026-10-23.';
comment on column eng_training_records.source_event_id is
  'For a record carried over from the interim events (2026-10-07 to 0084), the eng_audit_events id it came from. Null for every record written after 0084.';

create trigger eng_training_records_append_only
  before update or delete on eng_training_records
  for each row execute function eng_forbid_mutation();

/* 2. The engineer's decision on it. */
create table if not exists eng_training_decisions (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  record_id           uuid not null unique references eng_training_records (id) on delete restrict,
  decision            text not null check (decision in ('approved', 'refused')),
  decided_by          uuid references eng_profiles (id) on delete restrict,
  decided_by_license  text,
  reason              text,
  source_event_id     bigint unique,
  constraint eng_training_decisions_reason_ck check (
    (decision = 'refused' and length(btrim(coalesce(reason, ''))) >= 10)
    or (decision = 'approved' and reason is null)
  )
);
alter table eng_training_decisions enable row level security;

comment on table eng_training_decisions is
  'The engineer of record''s approval or refusal of one training record, from his own session; at most one per record, a refusal with his reason. Append only. 0084.';

create trigger eng_training_decisions_append_only
  before update or delete on eng_training_decisions
  for each row execute function eng_forbid_mutation();

/*
 * 3. The interim events, carried over once. A record event names its template
 * in its diff; one whose template no longer exists, or whose technician is
 * gone, has nothing to be a record of and is left in the audit log alone. A
 * decision event names its record by event id.
 */
insert into eng_training_records
  (created_at, profile_id, service_slug, template_id, protocol_document, protocol_version_label,
   trained_on, supervised_by, recorded_by, source_event_id)
select e.created_at, e.entity_id::uuid, e.diff->>'service_slug', (e.diff->>'template_id')::uuid,
       coalesce(e.diff->>'protocol_document', t.document_number, ''),
       coalesce(e.diff->>'protocol_version', t.version_label, ''),
       (e.diff->>'trained_on')::date, e.diff->>'supervised_by', e.actor_id, e.id
  from eng_audit_events e
  join eng_protocol_templates t on t.id = (e.diff->>'template_id')::uuid
  join eng_profiles p on p.id = e.entity_id::uuid
 where e.action = 'certification.training_recorded'
   and e.entity_type = 'profile'
on conflict (source_event_id) do nothing;

insert into eng_training_decisions (created_at, record_id, decision, decided_by, reason, source_event_id)
select distinct on (r.id)
       e.created_at, r.id,
       case when e.action = 'certification.training_approved' then 'approved' else 'refused' end,
       e.actor_id,
       case when e.action = 'certification.training_refused' then e.diff->>'reason' end,
       e.id
  from eng_audit_events e
  join eng_training_records r on r.source_event_id = (e.diff->>'record_id')::bigint
 where e.action in ('certification.training_approved', 'certification.training_refused')
   and e.entity_type = 'profile'
 order by r.id, e.id
on conflict do nothing;

/* 4. Is anybody trained on this line, on this exact template? */
create or replace function eng_line_is_trained(p_service_slug text, p_template_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $fn$
  select exists (
    select 1
      from public.eng_training_records r
      join public.eng_training_decisions d on d.record_id = r.id and d.decision = 'approved'
      join public.eng_profiles p on p.id = r.profile_id
     where r.service_slug = p_service_slug
       and r.template_id = p_template_id
       and p.role = 'field_tech'
       and p.status = 'active'
  );
$fn$;

/* 0073's rule for every function added here, and asserted for the whole schema. */
do $$
declare
  f record;
  open_fns text;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('eng_line_is_trained')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;

  select string_agg(p.oid::regprocedure::text, ', ') into open_fns
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'eng\_%'
    and (has_function_privilege('anon', p.oid, 'EXECUTE')
         or has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  if open_fns is not null then
    raise exception 'eng: after 0084 these are still executable by anon or authenticated: %', open_fns;
  end if;
end;
$$;
