/*
 * ===========================================================================
 * 0086  AN APPROVAL GIVEN BY TELEPHONE IS ITS OWN KIND OF RECORD, AND CAN
 *       NEVER BE MISTAKEN FOR ONE GIVEN IN THE PORTAL.
 * ===========================================================================
 *
 * Operator ruling, 2026-10-23 21:56 CT: the engineer of record approved the
 * owner as the field technician on every service line whose protocol he has
 * signed, by telephone, and the owner relayed it. Recorded truthfully:
 *   - the owner's training on each signed line's in force template;
 *   - the approval as its own kind, "approved by the engineer of record by
 *     phone, relayed by the owner", with the date and time and the owner's
 *     account as the one recording it; never as an approval made from the
 *     engineer's session, and never through his account;
 *   - a place for the engineer's written confirmation (a text or an email the
 *     owner attaches), and "written confirmation pending" until it is;
 *   - eng_line_is_trained counts it as approved.
 *
 * WHAT THIS DOES
 *   1. eng_training_decisions.channel: 'portal' (every row so far, and every
 *      row decideTraining writes from his own session) or 'phone_relayed'. A
 *      relayed row carries NO decided_by and NO licence, which is what a portal
 *      approval is identified by; it names the engineer who approved
 *      (approved_by_engineer), the person who relayed it (relayed_by), and when
 *      he approved (approved_at). A check holds the two shapes apart, so no
 *      row can be both, and a relayed row is always an approval.
 *   2. A trigger refuses a relayed row whose engineer is not an engineer, whose
 *      relayer is not an administrator, or whose stated moment is in the future.
 *   3. eng_training_confirmations: the engineer's written confirmation of one
 *      relayed approval, attached by an administrator, at most one, append only.
 *      Only a relayed approval can take one. No row is "pending".
 *   4. eng_record_relayed_training_approval(...): the one door. It writes the
 *      training record, the relayed approval, the certification dispatch reads
 *      (as decideTraining does on a portal approval), and the audit event, in
 *      one transaction.
 *
 * eng_line_is_trained is unchanged: it counts a decision whose decision is
 * 'approved', whichever channel carried it. The proof asserts that, and that
 * no relayed row can carry what a portal row carries.
 *
 * RLS on the new table with no policies, as every eng_ table. SECURITY INVOKER,
 * search_path pinned, EXECUTE revoked from PUBLIC, anon and authenticated in
 * this file (0073). No drop statement. Additive: the column defaults to
 * 'portal', so every existing row and every row the deployed code writes is a
 * portal row with nulls in the three new columns, which the check allows.
 */

/* 1. The channel, and the two shapes held apart. */
alter table eng_training_decisions
  add column if not exists channel text not null default 'portal',
  add column if not exists approved_by_engineer uuid,
  add column if not exists relayed_by uuid,
  add column if not exists approved_at timestamptz;

alter table eng_training_decisions
  add constraint eng_training_decisions_channel_ck check (channel in ('portal', 'phone_relayed'));

alter table eng_training_decisions
  add constraint eng_training_decisions_channel_shape_ck check (
    (channel = 'portal'
      and approved_by_engineer is null and relayed_by is null and approved_at is null)
    or (channel = 'phone_relayed'
      and decision = 'approved'
      and decided_by is null and decided_by_license is null
      and approved_by_engineer is not null and relayed_by is not null and approved_at is not null
      and relayed_by <> approved_by_engineer)
  );

comment on column eng_training_decisions.channel is
  'How the decision reached the record. portal: made by the engineer of record from his own session (decided_by, decided_by_license). phone_relayed: approved by the engineer of record by phone, relayed by the owner, who recorded it (relayed_by); it carries no decided_by. 0086, operator ruling of 2026-10-23.';
comment on column eng_training_decisions.approved_at is
  'For a relayed approval, when the engineer gave it by phone, as the person relaying it stated. created_at is when it was recorded. 0086.';

/* 2. Who may stand in each place on a relayed row. */
create or replace function eng_relayed_decision_check()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if new.channel = 'phone_relayed' then
    if not exists (select 1 from public.eng_profiles p where p.id = new.approved_by_engineer and p.role = 'engineer') then
      raise exception 'eng: a relayed approval names the engineer of record who gave it (0086).';
    end if;
    if not exists (select 1 from public.eng_profiles p where p.id = new.relayed_by and p.role = 'admin') then
      raise exception 'eng: a relayed approval is recorded by the administrator who relayed it (0086).';
    end if;
    if new.approved_at > now() then
      raise exception 'eng: a relayed approval cannot be stated as given in the future (0086).';
    end if;
  end if;
  return new;
end;
$fn$;

create trigger eng_training_decisions_relayed_check
  before insert on eng_training_decisions
  for each row execute function eng_relayed_decision_check();

/* 3. His written confirmation, attached later, once. */
create table if not exists eng_training_confirmations (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  decision_id  uuid not null unique references eng_training_decisions (id) on delete cascade,
  kind         text not null check (kind in ('text', 'email')),
  received_at  timestamptz not null,
  body         text not null check (length(btrim(body)) >= 10),
  attached_by  uuid not null
);
alter table eng_training_confirmations enable row level security;

comment on table eng_training_confirmations is
  'The engineer of record''s written confirmation (a text or an email, as received) of one approval he gave by phone, attached by an administrator. At most one per decision; only a phone_relayed decision takes one. No row means written confirmation pending. Append only. 0086.';

create or replace function eng_confirmation_check()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if not exists (
    select 1 from public.eng_training_decisions d where d.id = new.decision_id and d.channel = 'phone_relayed'
  ) then
    raise exception 'eng: a written confirmation attaches only to an approval relayed by phone (0086).';
  end if;
  if not exists (select 1 from public.eng_profiles p where p.id = new.attached_by and p.role = 'admin') then
    raise exception 'eng: a written confirmation is attached by an administrator (0086).';
  end if;
  return new;
end;
$fn$;

create trigger eng_training_confirmations_check
  before insert on eng_training_confirmations
  for each row execute function eng_confirmation_check();

create trigger eng_training_confirmations_append_only
  before update or delete on eng_training_confirmations
  for each row execute function eng_forbid_mutation_allow_cascade();

/*
 * 4. THE ONE DOOR. The training on one in force template, the relayed
 * approval of it, the certification dispatch reads, and the audit event, in
 * one transaction. The template must be published (in force); the technician
 * an active field technician. Returns the decision's id.
 */
create or replace function eng_record_relayed_training_approval(
  p_profile_id      uuid,
  p_template_id     uuid,
  p_trained_on      date,
  p_supervised_by   text,
  p_engineer_id     uuid,
  p_relayed_by      uuid,
  p_approved_at     timestamptz
)
returns uuid
language plpgsql
set search_path = ''
as $fn$
declare
  v_template record;
  v_record_id uuid;
  v_decision_id uuid;
  v_relayer_email text;
begin
  select t.id, t.service_slug, t.document_number, t.version_label
    into v_template
    from public.eng_protocol_templates t
   where t.id = p_template_id and t.status = 'published';
  if v_template.id is null then
    raise exception 'eng: that template is not in force, so nothing is recorded on it (0086).';
  end if;
  if not exists (
    select 1 from public.eng_profiles p where p.id = p_profile_id and p.role = 'field_tech' and p.status = 'active'
  ) then
    raise exception 'eng: training is recorded for an active field technician (0086).';
  end if;
  select email into v_relayer_email from public.eng_profiles where id = p_relayed_by;

  insert into public.eng_training_records
    (profile_id, service_slug, template_id, protocol_document, protocol_version_label, trained_on, supervised_by, recorded_by)
  values
    (p_profile_id, v_template.service_slug, v_template.id, coalesce(v_template.document_number, ''),
     coalesce(v_template.version_label, ''), p_trained_on, p_supervised_by, p_relayed_by)
  returning id into v_record_id;

  insert into public.eng_training_decisions
    (record_id, decision, channel, approved_by_engineer, relayed_by, approved_at)
  values
    (v_record_id, 'approved', 'phone_relayed', p_engineer_id, p_relayed_by, p_approved_at)
  returning id into v_decision_id;

  /*
   * A certification already in force keeps its own date: the owner's roof
   * certification of 2026-09-23 is a real record and this must not re-date it.
   */
  insert into public.eng_certifications (profile_id, service_slug, template_id, status, certified_at, revoked_at)
  values (p_profile_id, v_template.service_slug, v_template.id, 'certified', now(), null)
  on conflict (profile_id, service_slug)
  do update set template_id = excluded.template_id,
                status = 'certified',
                certified_at = case when public.eng_certifications.status = 'certified'
                                    then public.eng_certifications.certified_at else now() end,
                revoked_at = null;

  update public.eng_profiles set certification_status = 'certified' where id = p_profile_id and role = 'field_tech';

  insert into public.eng_audit_events (actor_id, actor_email, actor_role, action, entity_type, entity_id, summary, diff)
  values (
    p_relayed_by, v_relayer_email, 'admin', 'certification.training_approved_by_phone', 'profile', p_profile_id::text,
    format('Approved by the engineer of record by phone, relayed by the owner: training on %s v%s, approved %s. Written confirmation pending.',
           coalesce(v_template.document_number, ''), coalesce(v_template.version_label, ''), p_approved_at),
    jsonb_build_object(
      'record_id', v_record_id, 'decision_id', v_decision_id, 'service_slug', v_template.service_slug,
      'template_id', v_template.id, 'channel', 'phone_relayed', 'approved_by_engineer', p_engineer_id,
      'approved_at', p_approved_at, 'status', jsonb_build_object('from', null, 'to', 'approved')
    )
  );

  return v_decision_id;
end;
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
    where n.nspname = 'public'
      and p.proname in ('eng_relayed_decision_check', 'eng_confirmation_check', 'eng_record_relayed_training_approval')
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
    raise exception 'eng: after 0086 these are still executable by anon or authenticated: %', open_fns;
  end if;
end;
$$;
