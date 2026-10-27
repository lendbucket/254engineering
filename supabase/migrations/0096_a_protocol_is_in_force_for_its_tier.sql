/*
 * ===========================================================================
 * 0096  A PROTOCOL IS IN FORCE FOR ITS TIER, AND 254-WP-001 GOES IN FORCE FOR
 *       WPI-8 ONGOING CONSTRUCTION ONCE THE ENGINEER'S ADDENDUM IS SIGNED.
 * ===========================================================================
 * Robert's ruling of 2026-10-26, 08:19 Central, question 12: put 254-WP-001 in
 * force for the ongoing tier only, leaving 254-WS-001 and completed
 * construction exactly as they are.
 *
 * WHY 0095 ALONE COULD NOT DO IT. Two things stood in the way, both read from
 * the chain rather than assumed:
 *
 *   - eng_approve_protocol (0052), the one door into published, retires every
 *     other published protocol on the same service_slug. windstorm-wpi-8 sells
 *     two deliverables under two protocols (WS-001 completed, WP-001 ongoing),
 *     so putting WP-001 in force would have retired WS-001 and closed
 *     completed construction, which is on sale.
 *   - eng_put_signed_protocol_in_force (0081) refuses 254-WP-001 outright, by
 *     the operator's ruling of 2026-10-22, until a scope addendum covers it.
 *
 * WHAT THIS DOES
 *
 *   1. eng_protocol_templates.service_tier, null for a line with one protocol,
 *      and set for the two windstorm records: WS-001 completed, WP-001 ongoing.
 *      Every other record keeps null, so nothing else changes meaning.
 *   2. eng_approve_protocol retires only the published protocol on the same
 *      line AND the same tier (null matching null), so every single-protocol
 *      line retires exactly as before, and WP-001 going in force leaves WS-001
 *      published.
 *   3. eng_put_signed_protocol_in_force's hold on 254-WP-001 becomes
 *      conditional: it may go in force only while eng_line_pay (0095) returns a
 *      live signed per_job addendum for windstorm-wpi-8/ongoing. Without one it
 *      refuses exactly as before.
 *
 * WHAT IT DOES NOT DO. It puts nothing in force by itself. WP-001 v1.2's
 * signature, already live on production, is put in force by the application
 * through eng_put_signed_protocol_in_force once the addendum is signed, with
 * the items from the transcription in code, as every signature since 0081.
 * It changes no published record's status. Training on WP-001 is recorded at
 * the sitting through the relayed-approval door.
 *
 * Both functions are replaced whole. Their bodies are 0052's and 0081's,
 * changed only where marked 0096.
 */

/* 1. The tier a protocol covers, when its line sells more than one. */
alter table eng_protocol_templates
  add column if not exists service_tier text;

alter table eng_protocol_templates
  add constraint eng_protocol_templates_service_tier_ck
  check (service_tier is null or service_tier ~ '^[a-z0-9-]+$');

comment on column eng_protocol_templates.service_tier is
  'The tier this protocol covers when its line sells more than one deliverable under more than one protocol (windstorm-wpi-8: 254-WS-001 completed, 254-WP-001 ongoing). Null for a line with one protocol. Retirement on approval is by line and tier. 0096.';

update eng_protocol_templates set service_tier = 'completed'
 where service_slug = 'windstorm-wpi-8' and document_number = '254-WS-001' and service_tier is null;
update eng_protocol_templates set service_tier = 'ongoing'
 where service_slug = 'windstorm-wpi-8' and document_number = '254-WP-001' and service_tier is null;

/* 2. The one door into published, retiring by line and tier. */
create or replace function eng_approve_protocol(
  p_template_id  uuid,
  p_approved_by  uuid,
  p_license      text,
  p_items        jsonb
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_status  text;
  v_slug    text;
  v_tier    text;
  v_count   integer;
begin
  select status, service_slug, service_tier into v_status, v_slug, v_tier
  from eng_protocol_templates
  where id = p_template_id
  for update;

  if not found then
    raise exception 'eng: no protocol template %', p_template_id;
  end if;

  /*
   * 0049's vocabulary decides this, not a convenience. draft means the engineer
   * has not signed the document, and approving an unsigned document in the
   * platform would be the platform claiming something the paper does not.
   */
  if v_status <> 'awaiting_engineer' then
    raise exception
      'eng: a protocol is approved from awaiting_engineer, and % is %. Draft means the engineer has not signed it.',
      p_template_id, v_status;
  end if;

  if p_approved_by is null or p_license is null or btrim(p_license) = '' then
    raise exception 'eng: an approval names the engineer and his licence.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'eng: an approval seeds the protocol items, and none were supplied.';
  end if;

  /*
   * The items are replaced rather than added to. An approval is the moment the
   * signed document's checklist comes into being, so whatever was sitting there
   * from authoring is not what the engineer signed. The template is still
   * awaiting_engineer at this point, so the freeze below does not apply yet.
   */
  delete from eng_protocol_items where template_id = p_template_id;

  insert into eng_protocol_items (
    template_id, sort_order, item_key, kind, label, instructions,
    required, unit, min_value, max_value, min_count
  )
  select
    p_template_id,
    (r->>'sort_order')::integer,
    r->>'item_key',
    r->>'kind',
    r->>'label',
    r->>'instructions',
    coalesce((r->>'required')::boolean, true),
    r->>'unit',
    (r->>'min_value')::numeric,
    (r->>'max_value')::numeric,
    (r->>'min_count')::integer
  from jsonb_array_elements(p_items) as r;

  get diagnostics v_count = row_count;
  if v_count <> jsonb_array_length(p_items) then
    raise exception 'eng: % item(s) supplied and % written.', jsonb_array_length(p_items), v_count;
  end if;

  /*
   * Two protocols in force for one service line is an ambiguity dispatch would
   * have to guess its way out of, so the previous one retires in the same
   * transaction. Its items stay, because files worked under it point at them.
   * 0096: by line AND tier, so a line selling two deliverables under two
   * protocols keeps both; a line with one protocol (tier null) retires as before.
   */
  update eng_protocol_templates
     set status = 'retired'
   where service_slug = v_slug
     and service_tier is not distinct from v_tier
     and status = 'published'
     and id <> p_template_id;

  /*
   * The transaction local setting the trigger looks for. `true` is the is_local
   * argument: it dies with this transaction, so it cannot leak into the next
   * statement on a pooled connection.
   */
  perform set_config('eng.approving', p_template_id::text, true);

  update eng_protocol_templates
     set status              = 'published',
         published_at        = now(),
         approved_by         = p_approved_by,
         approved_at         = now(),
         approved_by_license = p_license
   where id = p_template_id;
end;
$$;

/* 3. A signature into force, with 254-WP-001 held only until his addendum covers it. */
create or replace function eng_put_signed_protocol_in_force(
  p_seal_act_id  uuid,
  p_license      text,
  p_items        jsonb
)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_act       record;
  v_template  record;
  v_rows      integer;
begin
  select id, kind, protocol_document, protocol_version, sealed_by, created_at, voided_at
    into v_act
    from eng_seal_acts
   where id = p_seal_act_id;

  if not found or v_act.kind <> 'protocol' then
    raise exception 'eng: % is not a protocol signature.', p_seal_act_id;
  end if;
  if v_act.voided_at is not null then
    raise exception 'eng: the signature % was voided, so it puts nothing in force.', p_seal_act_id;
  end if;

  /*
   * HELD OUT OF FORCE AT THE DATABASE UNTIL HIS ADDENDUM COVERS IT. Operator
   * ruling of 2026-10-22, made conditional by Robert's ruling of 2026-10-26
   * (0096): 254-WP-001 goes in force only while a live signed per_job scope
   * addendum covers windstorm-wpi-8/ongoing (eng_line_pay, 0095). Its record
   * carries the tier ongoing, so approving it retires nothing on completed.
   */
  if v_act.protocol_document in ('254-WP-001')
     and not exists (select 1 from eng_line_pay('windstorm-wpi-8/ongoing')) then
    raise exception 'eng: % is held out of force until a signed scope addendum covers windstorm-wpi-8/ongoing, so its signature puts nothing in force.', v_act.protocol_document;
  end if;

  select count(*) into v_rows
    from eng_protocol_templates
   where document_number = v_act.protocol_document
     and version_label   = v_act.protocol_version;
  if v_rows <> 1 then
    raise exception 'eng: % record(s) name % v%, and a signature puts exactly one in force.',
      v_rows, v_act.protocol_document, v_act.protocol_version;
  end if;

  select id, status, signed_by_seal_act_id
    into v_template
    from eng_protocol_templates
   where document_number = v_act.protocol_document
     and version_label   = v_act.protocol_version
   for update;

  if v_template.status = 'published' and v_template.signed_by_seal_act_id = p_seal_act_id then
    return 'already';
  end if;

  if v_template.status not in ('draft', 'awaiting_engineer') then
    raise exception
      'eng: % v% is %, and a signature puts in force only a draft or a record awaiting its engineer. A voided or retired protocol is signed again as its next version.',
      v_act.protocol_document, v_act.protocol_version, v_template.status;
  end if;

  /* Signed means not a draft (0049): the signature's own date, in the firm's calendar. */
  update eng_protocol_templates
     set status                = 'awaiting_engineer',
         document_signed_at    = coalesce(document_signed_at, (v_act.created_at at time zone 'America/Chicago')::date),
         signed_by_seal_act_id = p_seal_act_id
   where id = v_template.id;

  /* The existing and only door into published: approval and seeding are one act (0052). */
  perform eng_approve_protocol(v_template.id, v_act.sealed_by, p_license, p_items);

  return 'in_force';
end;
$$;

/* 0073's rule for every function replaced here, and asserted for the whole schema. */
do $$
declare
  f record;
  open_fns text;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('eng_approve_protocol', 'eng_put_signed_protocol_in_force')
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
    raise exception 'eng: after 0096 these are still executable by anon or authenticated: %', open_fns;
  end if;

  /* Only the two windstorm records carry a tier, and a published WS-001 is still published. */
  if exists (
    select 1 from eng_protocol_templates
     where service_tier is not null
       and not (service_slug = 'windstorm-wpi-8' and document_number in ('254-WS-001', '254-WP-001'))
  ) then
    raise exception 'eng: 0096 set a tier on a record other than the two windstorm protocols.';
  end if;
end;
$$;
