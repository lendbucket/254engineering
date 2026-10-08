/*
 * ===========================================================================
 * 0062: A SEAL IS APPLIED ONCE, BY ONE PERSON, AND THEN NOTHING CHANGES IT.
 *
 * RENUMBERED FROM 0063 ON 2026-10-07, COMMENTS ONLY. The operator deferred the
 * credentials column drop out of this release, so its number went with it and
 * this file took 0062 to keep the chain contiguous. Development applied it as
 * 0063 that day, with these comment blocks left out because they contain the
 * word drop; every statement is unchanged.
 * ===========================================================================
 *
 * Sealing piece two, on release/2026-10-20. CLAUDE.md section 1, operator
 * ruling of 2026-10-06: the platform drafts the letter, and the engineer seals
 * it in the portal from his own session with a fresh second factor; at sealing
 * the document is rendered, hashed and locked; any change voids the seal; every
 * sealing writes to the immutable audit log. Ruling 2a: a protocol is signed by
 * the same act. The controls are mapped to 22 TAC 137.33 and 137.35 in
 * docs/sealing-controls.md, written before this file.
 *
 * WHAT IT ADDS
 *   eng_seal_acts                one row per act of sealing a letter or signing
 *                                a protocol, carrying the SHA-256 of exactly
 *                                what was sealed and the images that sealed it
 *   eng_seal_act_check()         refuses an act whose images are not the
 *                                sealer's own current ones, or a letter sealed
 *                                by anybody but the engineer who recorded its
 *                                determination
 *   eng_seal_act_guard()         refuses delete, and any update but voiding
 *   eng_seal_act_audit()         writes every act and every voiding to
 *                                eng_audit_events in the same transaction
 *   eng_sealed_document_lock()   refuses any change to a sealed document's
 *                                content, and refuses sealing a document by
 *                                update rather than by the act that creates it
 *   eng_record_letter_seal()     the one door a sealed letter comes in through:
 *                                the document and its act, in one transaction
 *   eng_record_protocol_signature()  the one door a protocol signature comes in
 *   eng_void_seal_act()          the one door a voiding comes in through
 *
 * THERE IS NO drop STATEMENT IN THIS FILE, ON PURPOSE. The Supabase connector
 * refuses any statement containing drop or delete, under any permission
 * setting (operator note of 2026-10-07). Every object here is new, so the
 * if-exists drops the earlier migrations carried before each create trigger
 * would be no-ops, and leaving them out means the file applies as written,
 * with no production step that differs from the file.
 *
 * SECURITY INVOKER THROUGHOUT, like eng_record_seal_image in 0061. Row level
 * security is on and no policy is written, so only the service role can reach
 * any of it, and the service role reaches it only from the routes that verify
 * the engineer's fresh second factor first.
 */

create table if not exists eng_seal_acts (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  kind                text not null check (kind in ('letter', 'protocol')),
  /* A letter: the sealed document and the determination it states. */
  document_id         uuid references eng_documents(id) on delete restrict,
  determination_id    uuid references eng_determinations(id) on delete restrict,
  /* A protocol: the document number and version the signature attaches to. */
  protocol_document   text,
  protocol_version    text,
  /*
   * WHAT WAS SEALED, by its hash. For a letter, the SHA-256 of the exact PDF
   * bytes stored; for a protocol, of the transcription text he read. Any change
   * to either afterwards makes this disagree, which is what voids it.
   */
  content_sha256      text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  seal_image_id       uuid not null references eng_seal_images(id) on delete restrict,
  signature_image_id  uuid not null references eng_seal_images(id) on delete restrict,
  sealed_by           uuid not null references eng_profiles(id) on delete restrict,
  /* When the fresh second factor was verified for THIS act. */
  mfa_verified_at     timestamptz not null,
  voided_at           timestamptz,
  voided_by           uuid references eng_profiles(id) on delete restrict,
  voided_because      text,
  constraint eng_seal_acts_letter_shape_ck check (
    kind <> 'letter'
    or (document_id is not null and determination_id is not null
        and protocol_document is null and protocol_version is null)
  ),
  constraint eng_seal_acts_protocol_shape_ck check (
    kind <> 'protocol'
    or (document_id is null and determination_id is null
        and protocol_document is not null and protocol_version is not null)
  ),
  constraint eng_seal_acts_void_whole_ck check (
    (voided_at is null) = (voided_by is null)
    and (voided_at is null) = (voided_because is null)
  ),
  constraint eng_seal_acts_void_says_why_ck check (
    voided_because is null or length(btrim(voided_because)) > 0
  )
);

/* One live seal per determination, and one live signature per protocol version. */
create unique index if not exists eng_seal_acts_one_live_letter
  on eng_seal_acts (determination_id)
  where kind = 'letter' and voided_at is null;

create unique index if not exists eng_seal_acts_one_live_protocol
  on eng_seal_acts (protocol_document, protocol_version)
  where kind = 'protocol' and voided_at is null;

alter table eng_seal_acts enable row level security;

/*
 * THE IDENTITY CHECKS, AT THE DATABASE. The route checks all of this first and
 * says why in a sentence; this is what stands if a route ever forgets.
 *   - both images belong to the sealer, are of the right kind, and are his
 *     CURRENT ones (a superseded image cannot seal anything);
 *   - the sealer holds the licensed role;
 *   - a letter is sealed only by the engineer who recorded its determination.
 *     No administrator, and no other engineer, can stand in for him.
 */
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

  return new;
end;
$fn$;

create trigger eng_seal_acts_check before insert on eng_seal_acts
  for each row execute function eng_seal_act_check();

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
     or new.mfa_verified_at <> old.mfa_verified_at then
    raise exception
      'A seal act records what was sealed. Only voided_at, voided_by and voided_because may be set, once.';
  end if;
  return new;
end;
$fn$;

create trigger eng_seal_acts_guard before update or delete on eng_seal_acts
  for each row execute function eng_seal_act_guard();

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
      when tg_op = 'INSERT' then 'protocol.signed'
      else 'seal.voided'
    end,
    'seal_act',
    new.id::text,
    case
      when tg_op = 'INSERT' and new.kind = 'letter' then 'Letter sealed, sha256 ' || new.content_sha256
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
      'seal_image_id', new.seal_image_id,
      'signature_image_id', new.signature_image_id,
      'mfa_verified_at', new.mfa_verified_at,
      'voided_because', new.voided_because
    )
  );
  return new;
end;
$fn$;

create trigger eng_seal_acts_audit after insert or update on eng_seal_acts
  for each row execute function eng_seal_act_audit();

/*
 * A SEALED DOCUMENT'S CONTENT CANNOT CHANGE, AND A DOCUMENT IS NOT SEALED BY
 * AN UPDATE. Sealing happens once, in eng_record_letter_seal, which inserts the
 * document already sealed. An update that sets sealed_at on an existing row
 * would be a seal with no seal act behind it, which is the fabricated assurance
 * the old rule of 2026-09-06 was written against.
 */
create or replace function eng_sealed_document_lock()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if old.sealed_at is null and new.sealed_at is not null then
    raise exception
      'A document is sealed by the seal act that creates it, never by an update.';
  end if;
  if old.sealed_at is not null and (
       new.file_id is distinct from old.file_id
    or new.client_id is distinct from old.client_id
    or new.kind <> old.kind
    or new.title <> old.title
    or new.bucket <> old.bucket
    or new.storage_key <> old.storage_key
    or new.content_type is distinct from old.content_type
    or new.byte_size is distinct from old.byte_size
    or new.version <> old.version
    or new.sealed_at is distinct from old.sealed_at
    or new.sealed_by is distinct from old.sealed_by
    or new.seal_tier is distinct from old.seal_tier
    or new.firm_registration is distinct from old.firm_registration
  ) then
    raise exception
      'A sealed document cannot change. A correction is a new document and a new seal; this one is voided and stays.';
  end if;
  return new;
end;
$fn$;

create trigger eng_documents_sealed_lock before update on eng_documents
  for each row execute function eng_sealed_document_lock();

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
  p_mfa_verified_at     timestamptz
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
     seal_image_id, signature_image_id, sealed_by, mfa_verified_at)
  values
    (p_seal_act_id, 'letter', p_document_id, p_determination_id, p_sha256,
     p_seal_image_id, p_signature_image_id, p_sealed_by, p_mfa_verified_at);
end;
$fn$;

create or replace function eng_record_protocol_signature(
  p_seal_act_id         uuid,
  p_protocol_document   text,
  p_protocol_version    text,
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
    (id, kind, protocol_document, protocol_version, content_sha256,
     seal_image_id, signature_image_id, sealed_by, mfa_verified_at)
  values
    (p_seal_act_id, 'protocol', p_protocol_document, p_protocol_version, p_sha256,
     p_seal_image_id, p_signature_image_id, p_sealed_by, p_mfa_verified_at);
end;
$fn$;

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
  update public.eng_seal_acts
     set voided_at = now(), voided_by = p_voided_by, voided_because = p_because
   where id = p_seal_act_id
     and voided_at is null;
  if not found then
    raise exception 'No live seal act % to void.', p_seal_act_id;
  end if;
end;
$fn$;

comment on table eng_seal_acts is
  'One row per act of sealing a letter or signing a protocol: what was sealed, by its SHA-256, which of the sealer''s images sealed it, and when his fresh second factor was verified. Refuses delete and any change but a voiding with a reason. Every act and voiding is written to eng_audit_events by trigger. 0063, sealing piece two.';
