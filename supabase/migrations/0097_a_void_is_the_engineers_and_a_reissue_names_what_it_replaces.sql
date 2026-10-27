/*
 * ===========================================================================
 * 0097  A SEAL IS VOIDED ONLY BY A LICENSED ENGINEER, AND A REISSUED LETTER
 *       RECORDS THE SEAL ACT IT REPLACES.
 * ===========================================================================
 *
 * Robert's addendum of 2026-10-25, 22:46 Central, item 2, in his words:
 * "VOID AND REISSUE. Portal action, engineer only, fresh code required, reason
 * required, calling eng_void_seal_act. Migration: the void function refuses
 * anyone but a licensed engineer, and a replacement letter records the seal act
 * it replaces."
 *
 * WHAT THIS DOES
 *   1. eng_seal_acts gains replaces_seal_act_id, a reference to the voided
 *      letter act a new letter replaces. Only a letter carries one, never
 *      itself, and no act is replaced twice (a unique index).
 *   2. eng_seal_act_check (0091's, word for word, plus one block) FILLS IT IN.
 *      A letter sealed for a determination that holds a voided letter act not
 *      yet replaced names that act, the most recently voided. The database
 *      decides, so no door can forget it and no caller can name the wrong one:
 *      a value supplied that is not that act is refused, and so is one supplied
 *      where there is nothing to replace. Every seal door (0089's seventeen and
 *      eighteen) goes through this trigger, so none needs a new argument.
 *   3. eng_seal_act_guard (0089's, word for word, plus one clause) keeps the
 *      new column among what can never change.
 *   4. eng_seal_act_audit (0088's, plus the column) writes the replaced act
 *      into the audit event of the act that replaces it.
 *   5. eng_void_seal_act refuses a voider who is not the licensed role, the
 *      same predicate eng_seal_act_check applies to a sealer
 *      (eng_profiles.role = 'engineer'). Until now it took any profile id.
 *
 * WHAT IT CANNOT UNDO. A voiding stays voided (0062's guard). A replacement
 * stays the replacement of the act it names, for the life of the row.
 *
 * Acts sealed before 0097 carry no replaces_seal_act_id, which is the truth:
 * nothing recorded it. A determination voided before 0097 and sealed after it
 * gets the voided act named, because the trigger reads the record, not the date.
 *
 * Additive: one nullable column, one check every existing row satisfies (the
 * column is null on all of them), one partial unique index, four function
 * bodies replaced. No table or column is removed. SECURITY INVOKER and
 * search_path pinned, as before; EXECUTE revoked from public, anon and
 * authenticated, as 0073 and 0091 left them.
 */

-- 1. The record of what a reissued letter replaces.
alter table eng_seal_acts
  add column if not exists replaces_seal_act_id uuid references eng_seal_acts (id) on delete restrict;

alter table eng_seal_acts
  add constraint eng_seal_acts_replaces_ck check (
    replaces_seal_act_id is null
    or (kind = 'letter' and replaces_seal_act_id <> id)
  );

create unique index if not exists eng_seal_acts_replaced_once
  on eng_seal_acts (replaces_seal_act_id)
  where replaces_seal_act_id is not null;

comment on column eng_seal_acts.replaces_seal_act_id is
  'The voided letter act this letter replaces, set by eng_seal_act_check when the determination holds one not yet replaced (0097). Null on a first letter, on every act sealed before 0097, and on protocol, addendum and template acts.';

-- 2. 0091's check, word for word, with the replacement block at its end.
create or replace function eng_seal_act_check()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  v_ok boolean;
  v_protocol text;
  v_replaces uuid;
begin
  select count(*) = 2 into v_ok
    from public.eng_seal_images i
   where i.profile_id = new.sealed_by
     and i.superseded_at is null
     and ((i.id = new.seal_image_id and i.kind = 'seal')
       or (i.id = new.signature_image_id and i.kind = 'signature'));
  if not v_ok then
    raise exception
      'A seal act must use the sealer''s own current seal image and signature image.';
  end if;

  if not exists (
    select 1 from public.eng_profiles p
     where p.id = new.sealed_by and p.role = 'engineer'
  ) then
    raise exception 'Only a licensed engineer applies a seal.';
  end if;

  if new.kind = 'letter' and not exists (
    select 1 from public.eng_determinations d
     where d.id = new.determination_id and d.engineer_id = new.sealed_by
  ) then
    raise exception
      'A letter is sealed only by the engineer who recorded its determination.';
  end if;

  if new.kind = 'letter' and (new.letterhead_sha256 is null or new.letterhead_sha256 !~ '^[0-9a-f]{64}$') then
    raise exception
      'A letter is sealed with the SHA-256 of the mark at its head (0081).';
  end if;

  /*
   * 0091: the three lines no longer need a template. One that names a template
   * still names a live one for its own protocol; any other letter names none.
   */
  if new.kind = 'letter' and new.letter_template_act_id is not null then
    select d.protocol_document into v_protocol
      from public.eng_determinations d where d.id = new.determination_id;
    if coalesce(v_protocol = any (array['254-MH-001', '254-SL-001', '254-WS-001']), false) then
      if not exists (
        select 1 from public.eng_seal_acts t
         where t.id = new.letter_template_act_id
           and t.kind = 'letter_template'
           and t.voided_at is null
           and t.template_key = v_protocol
      ) then
        raise exception
          'A manufactured home, solar or WPI-8E letter that names a letter template names a live one for the protocol its determination states (0088, 0091).';
      end if;
    else
      raise exception
        'Only a manufactured home, solar or WPI-8E letter names a letter template; every other letter seals as it did before 0088.';
    end if;
  end if;

  if new.kind = 'addendum' and not exists (
    select 1 from public.eng_scope_addenda a
     where a.id = new.addendum_id and a.engineer_id = new.sealed_by and a.content_sha256 = new.content_sha256
  ) then
    raise exception
      'A scope addendum is signed only by the engineer it names, over the hash of its own text (0082).';
  end if;

  /*
   * 0097: A REISSUED LETTER NAMES THE ACT IT REPLACES, AND THE DATABASE NAMES
   * IT. The act replaced is the determination's most recently voided letter act
   * that no letter replaces yet.
   */
  if new.kind = 'letter' then
    select v.id into v_replaces
      from public.eng_seal_acts v
     where v.kind = 'letter'
       and v.determination_id = new.determination_id
       and v.voided_at is not null
       and not exists (select 1 from public.eng_seal_acts r where r.replaces_seal_act_id = v.id)
     order by v.voided_at desc, v.id
     limit 1;
    if new.replaces_seal_act_id is null then
      new.replaces_seal_act_id := v_replaces;
    elsif v_replaces is null or new.replaces_seal_act_id <> v_replaces then
      raise exception
        'A reissued letter replaces its determination''s voided letter act not yet replaced, and the database names it (0097).';
    end if;
  elsif new.replaces_seal_act_id is not null then
    raise exception 'Only a letter replaces a seal act (0097).';
  end if;

  return new;
end;
$fn$;

-- 3. 0089's guard, with the replaced act among what can never change.
create or replace function eng_seal_act_guard()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception
      'eng_seal_acts rows cannot be deleted. A seal that no longer stands is voided, with a reason, and stays.';
  end if;
  if old.voided_at is not null then
    raise exception 'A voided seal act cannot change again.';
  end if;
  if new.id <> old.id
     or new.created_at <> old.created_at
     or new.kind <> old.kind
     or new.document_id is distinct from old.document_id
     or new.determination_id is distinct from old.determination_id
     or new.protocol_document is distinct from old.protocol_document
     or new.protocol_version is distinct from old.protocol_version
     or new.content_sha256 <> old.content_sha256
     or new.seal_image_id <> old.seal_image_id
     or new.signature_image_id <> old.signature_image_id
     or new.sealed_by <> old.sealed_by
     or new.mfa_verified_at <> old.mfa_verified_at
     or new.letterhead_sha256 is distinct from old.letterhead_sha256
     or new.addendum_id is distinct from old.addendum_id
     or new.template_key is distinct from old.template_key
     or new.template_version is distinct from old.template_version
     or new.letter_template_act_id is distinct from old.letter_template_act_id
     or new.printed_name is distinct from old.printed_name
     or new.printed_license is distinct from old.printed_license
     or new.replaces_seal_act_id is distinct from old.replaces_seal_act_id then
    raise exception
      'A seal act records what was sealed. Only voided_at, voided_by and voided_because may be set, once.';
  end if;
  return new;
end;
$fn$;

-- 4. 0088's audit, with the act a reissued letter replaces.
create or replace function eng_seal_act_audit()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  v_actor uuid := case when tg_op = 'INSERT' then new.sealed_by else new.voided_by end;
begin
  insert into public.eng_audit_events (actor_id, actor_role, action, entity_type, entity_id, summary, diff)
  values (
    v_actor,
    (select p.role from public.eng_profiles p where p.id = v_actor),
    case
      when tg_op = 'INSERT' and new.kind = 'letter' then 'seal.applied'
      when tg_op = 'INSERT' and new.kind = 'addendum' then 'addendum.signed'
      when tg_op = 'INSERT' and new.kind = 'letter_template' then 'letter_template.signed'
      when tg_op = 'INSERT' then 'protocol.signed'
      else 'seal.voided'
    end,
    'seal_act',
    new.id::text,
    case
      when tg_op = 'INSERT' and new.kind = 'letter' and new.replaces_seal_act_id is not null
        then 'Letter sealed, sha256 ' || new.content_sha256 || ', replacing seal act ' || new.replaces_seal_act_id
      when tg_op = 'INSERT' and new.kind = 'letter' then 'Letter sealed, sha256 ' || new.content_sha256
      when tg_op = 'INSERT' and new.kind = 'addendum' then 'Scope addendum ' || new.addendum_id || ' signed, sha256 ' || new.content_sha256
      when tg_op = 'INSERT' and new.kind = 'letter_template' then 'Letter template ' || new.template_key || ' v' || new.template_version || ' signed, sha256 ' || new.content_sha256
      when tg_op = 'INSERT' then 'Protocol ' || new.protocol_document || ' v' || new.protocol_version || ' signed, sha256 ' || new.content_sha256
      else 'Seal act voided: ' || new.voided_because
    end,
    jsonb_build_object(
      'kind', new.kind,
      'content_sha256', new.content_sha256,
      'document_id', new.document_id,
      'determination_id', new.determination_id,
      'protocol_document', new.protocol_document,
      'protocol_version', new.protocol_version,
      'addendum_id', new.addendum_id,
      'template_key', new.template_key,
      'template_version', new.template_version,
      'letter_template_act_id', new.letter_template_act_id,
      'replaces_seal_act_id', new.replaces_seal_act_id,
      'seal_image_id', new.seal_image_id,
      'signature_image_id', new.signature_image_id,
      'mfa_verified_at', new.mfa_verified_at,
      'voided_because', new.voided_because
    )
  );
  return new;
end;
$fn$;

-- 5. 0062's void door, refusing a voider who is not the licensed role.
create or replace function eng_void_seal_act(
  p_seal_act_id  uuid,
  p_voided_by    uuid,
  p_because      text
)
returns void
language plpgsql
set search_path = ''
as $fn$
begin
  if not exists (
    select 1 from public.eng_profiles p
     where p.id = p_voided_by and p.role = 'engineer'
  ) then
    raise exception 'Only a licensed engineer voids a seal (0097).';
  end if;
  update public.eng_seal_acts
     set voided_at = now(), voided_by = p_voided_by, voided_because = p_because
   where id = p_seal_act_id
     and voided_at is null;
  if not found then
    raise exception 'No live seal act % to void.', p_seal_act_id;
  end if;
end;
$fn$;

revoke execute on function eng_seal_act_check() from public, anon, authenticated;
revoke execute on function eng_seal_act_guard() from public, anon, authenticated;
revoke execute on function eng_seal_act_audit() from public, anon, authenticated;
revoke execute on function eng_void_seal_act(uuid, uuid, text) from public, anon, authenticated;
