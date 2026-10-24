/*
 * ===========================================================================
 * 0088  A LETTER SEALS ONLY FROM A TEMPLATE THE ENGINEER HAS SIGNED.
 * ===========================================================================
 *
 * Robert's instruction of 2026-10-24: letter-template adoption. The engineer
 * signs each letter template in his portal like a protocol, and a line's letter
 * can seal only from a template he has signed. Nothing seals without it.
 *
 * WHAT IS SIGNED is the template's fixed text as the platform holds it, every
 * line in his order with its slots, hashed exactly as a protocol transcription
 * is (src/lib/letter-template-sign.ts). A template is keyed by the protocol its
 * letter states (254-RC-001, 254-FC-001, 254-PL-001, ...) and a version.
 *
 * WHAT THIS DOES
 *   1. eng_seal_acts gains the kind 'letter_template' (template_key,
 *      template_version) and, on a letter, letter_template_act_id: the
 *      template signature the letter was sealed from. Shape checks hold each
 *      column to its kind; one live signature per template version.
 *   2. eng_seal_act_check (0082's, one clause wider each way): a template is
 *      signed by an engineer like everything else; a letter sealed from 0088 on
 *      names a live template signature, for the protocol the letter's
 *      determination states. The 254-RC-001 letters sealed before 0088 carry
 *      none and are untouched: the check runs on insert only.
 *   3. eng_seal_act_guard (0082's): the template columns can never change.
 *   4. eng_seal_act_audit (0082's): a template signature is named as one.
 *   5. eng_record_letter_template_signature: the one door a template signature
 *      comes in by.
 *   6. eng_record_letter_seal gains a sixteenth argument, the template
 *      signature; 0081's fifteen-argument version refuses. A CUTOVER GAP: the
 *      code deployed before 0088 seals nothing once it is applied.
 *
 * Whether the hash still matches the template in code is answered where the
 * code is, in the TypeScript, exactly as for a protocol: the database cannot
 * read the code, and a template changed after signing reads as void there.
 *
 * Additive. No drop statement except the kind check, dropped and re-added
 * widened in one statement, the 0082 pattern. RLS unchanged. SECURITY
 * INVOKER, search_path pinned, EXECUTE revoked from PUBLIC, anon and
 * authenticated (0073).
 */

/* 1. The kind, its columns, and their shapes. */
alter table eng_seal_acts
  add column if not exists template_key text,
  add column if not exists template_version text,
  add column if not exists letter_template_act_id uuid references eng_seal_acts (id) on delete restrict;

alter table eng_seal_acts
  drop constraint if exists eng_seal_acts_kind_check,
  add constraint eng_seal_acts_kind_check check (kind in ('letter', 'protocol', 'addendum', 'letter_template'));

alter table eng_seal_acts
  add constraint eng_seal_acts_template_shape_ck check (
    (kind = 'letter_template') = (template_key is not null)
    and (kind = 'letter_template') = (template_version is not null)
    and (kind <> 'letter_template'
         or (document_id is null and determination_id is null and addendum_id is null
             and protocol_document is null and protocol_version is null and letter_template_act_id is null))
    and (letter_template_act_id is null or kind = 'letter')
  );

create unique index if not exists eng_seal_acts_one_live_template
  on eng_seal_acts (template_key, template_version)
  where kind = 'letter_template' and voided_at is null;

comment on column eng_seal_acts.letter_template_act_id is
  'For a letter sealed from 0088 on: the engineer''s live signature on the letter template it was sealed from (kind letter_template). Null on the roof letters sealed before 0088. 0088, Robert''s instruction of 2026-10-24.';

/* 2. 0082's check, with the template clauses. */
create or replace function eng_seal_act_check()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  v_ok boolean;
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

  /* 0088: a letter seals only from a live template signature for its own protocol. */
  if new.kind = 'letter' and not exists (
    select 1
      from public.eng_seal_acts t
      join public.eng_determinations d on d.id = new.determination_id
     where t.id = new.letter_template_act_id
       and t.kind = 'letter_template'
       and t.voided_at is null
       and t.template_key = d.protocol_document
  ) then
    raise exception
      'A letter seals only from a letter template the engineer has signed, for the protocol its determination states (0088).';
  end if;

  if new.kind = 'addendum' and not exists (
    select 1 from public.eng_scope_addenda a
     where a.id = new.addendum_id and a.engineer_id = new.sealed_by and a.content_sha256 = new.content_sha256
  ) then
    raise exception
      'A scope addendum is signed only by the engineer it names, over the hash of its own text (0082).';
  end if;

  return new;
end;
$fn$;

/* 3. 0082's guard, with the template columns among what can never change. */
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
     or new.letter_template_act_id is distinct from old.letter_template_act_id then
    raise exception
      'A seal act records what was sealed. Only voided_at, voided_by and voided_because may be set, once.';
  end if;
  return new;
end;
$fn$;

/* 4. 0082's audit, naming a template signature as what it is. */
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
      'seal_image_id', new.seal_image_id,
      'signature_image_id', new.signature_image_id,
      'mfa_verified_at', new.mfa_verified_at,
      'voided_because', new.voided_because
    )
  );
  return new;
end;
$fn$;

/* 5. The one door a template signature comes in by. */
create or replace function eng_record_letter_template_signature(
  p_seal_act_id         uuid,
  p_template_key        text,
  p_template_version    text,
  p_sha256              text,
  p_sealed_by           uuid,
  p_seal_image_id       uuid,
  p_signature_image_id  uuid,
  p_mfa_verified_at     timestamptz
)
returns void
language plpgsql
set search_path = ''
as $fn$
begin
  insert into public.eng_seal_acts
    (id, kind, template_key, template_version, content_sha256,
     seal_image_id, signature_image_id, sealed_by, mfa_verified_at)
  values
    (p_seal_act_id, 'letter_template', p_template_key, p_template_version, p_sha256,
     p_seal_image_id, p_signature_image_id, p_sealed_by, p_mfa_verified_at);
end;
$fn$;

/*
 * 6. A LETTER IS SEALED NAMING THE TEMPLATE SIGNATURE IT WAS SEALED FROM.
 * 0081's fifteen-argument version refuses rather than being dropped, as 0081
 * did to 0062's; the sixteenth argument is the template signature. THIS IS A
 * CUTOVER GAP, stated where it is made: from the moment 0088 is applied, the
 * code deployed before it calls the fifteen-argument version and every letter
 * seal is refused until the new code deploys and the engineer has signed the
 * template for that letter.
 */
create or replace function eng_record_letter_seal(
  p_seal_act_id         uuid,
  p_document_id         uuid,
  p_file_id             uuid,
  p_client_id           uuid,
  p_title               text,
  p_storage_key         text,
  p_byte_size           bigint,
  p_sha256              text,
  p_firm_registration   text,
  p_determination_id    uuid,
  p_sealed_by           uuid,
  p_seal_image_id       uuid,
  p_signature_image_id  uuid,
  p_mfa_verified_at     timestamptz,
  p_letterhead_sha256   text
)
returns void
language plpgsql
set search_path = ''
as $fn$
begin
  raise exception 'eng: since 0088 a letter is sealed naming the letter template signature it was sealed from.';
end;
$fn$;

create or replace function eng_record_letter_seal(
  p_seal_act_id             uuid,
  p_document_id             uuid,
  p_file_id                 uuid,
  p_client_id               uuid,
  p_title                   text,
  p_storage_key             text,
  p_byte_size               bigint,
  p_sha256                  text,
  p_firm_registration       text,
  p_determination_id        uuid,
  p_sealed_by               uuid,
  p_seal_image_id           uuid,
  p_signature_image_id      uuid,
  p_mfa_verified_at         timestamptz,
  p_letterhead_sha256       text,
  p_letter_template_act_id  uuid
)
returns void
language plpgsql
set search_path = ''
as $fn$
begin
  insert into public.eng_documents
    (id, file_id, client_id, kind, title, bucket, storage_key, content_type, byte_size,
     sealed_at, sealed_by, uploaded_by, visibility, firm_registration)
  values
    (p_document_id, p_file_id, p_client_id, 'deliverable', p_title, 'eng-documents', p_storage_key,
     'application/pdf', p_byte_size, now(), p_sealed_by, p_sealed_by, 'client', p_firm_registration);

  insert into public.eng_seal_acts
    (id, kind, document_id, determination_id, content_sha256,
     seal_image_id, signature_image_id, sealed_by, mfa_verified_at, letterhead_sha256, letter_template_act_id)
  values
    (p_seal_act_id, 'letter', p_document_id, p_determination_id, p_sha256,
     p_seal_image_id, p_signature_image_id, p_sealed_by, p_mfa_verified_at, p_letterhead_sha256, p_letter_template_act_id);
end;
$fn$;

/* 0073's rule for every function added or replaced here, and asserted for the whole schema. */
do $$
declare
  f record;
  open_fns text;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('eng_seal_act_check', 'eng_seal_act_guard', 'eng_seal_act_audit', 'eng_record_letter_template_signature',
                        'eng_record_letter_seal')
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
    raise exception 'eng: after 0088 these are still executable by anon or authenticated: %', open_fns;
  end if;
end;
$$;
