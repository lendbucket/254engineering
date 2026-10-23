/*
 * ===========================================================================
 * 0081  A PROTOCOL SIGNED IN THE PORTAL IS THE PROTOCOL IN FORCE, AND A SEALED
 *       LETTER RECORDS THE MARK AT ITS HEAD.
 * ===========================================================================
 * Operator rulings, 2026-10-22:
 *
 *   "Signing a protocol in the portal also makes it the protocol in force
 *    (approver, licence, digest written to its record, draft to published);
 *    voiding a signature closes the line the same way."
 *
 *   "No scheduled step. Put signatures already on record in force once,
 *    inside migration 0081 itself, so it happens in the production sitting and
 *    the read-back lists exactly which protocols went in force and why. After
 *    that, signing puts a protocol in force within the signing transaction and
 *    voiding closes it the same way; nothing runs on a timer. Keep WP-001
 *    deferred because of the shared windstorm line, and keep 'voided' as a
 *    status."
 *
 *   "The logo must render the same in the sealed PDF every time: embed it in
 *    the letter, never load it from a URL at view time, and include its
 *    checksum in the sealed document's record."
 *
 * WHAT WAS MISSING. A portal signature (0062, eng_record_protocol_signature)
 * wrote one eng_seal_acts row and touched no protocol record. The record stayed
 * `draft`, eng_approve_protocol refuses a draft, and dispatch reads only a
 * `published` record, so a line its engineer had signed still could not be
 * dispatched. CLAUDE.md section 1 already said the signed version "becomes the
 * registered protocol"; nothing made it so.
 *
 * WHAT THIS DOES, IN ORDER
 *
 *   1. eng_protocol_templates.signed_by_seal_act_id: which signature put the
 *      record in force, so a voiding can find the record it closes.
 *   2. The status word `voided`. A record whose signature was voided is not a
 *      draft (he signed it), not retired (nothing replaced it) and not
 *      published (it is not in force). CLAUDE.md section 6: a vocabulary that
 *      lacks the word makes somebody choose the nearest lie. Its items stay
 *      frozen, because they are what he signed.
 *   3. eng_put_signed_protocol_in_force(seal act, licence, items): the one door
 *      from a signature to a protocol in force. Draft to awaiting_engineer with
 *      the signature's own date, then eng_approve_protocol, the existing and
 *      only door into `published`, so approval and the seeding of the items
 *      stay one act (0052).
 *   4. eng_record_protocol_signature is replaced by a version that takes the
 *      licence and the items and puts the protocol in force in the SAME
 *      transaction as the signature. Items null means "record the signature
 *      only", which the application passes for 254-WP-001 alone, deferred.
 *   5. Voiding a protocol signature moves the record it put in force to
 *      `voided`, in the voiding's own transaction.
 *   6. eng_seal_acts.letterhead_sha256, and eng_record_letter_seal replaced by
 *      a version that requires it: every letter sealed from here records the
 *      checksum of the mark printed at its head.
 *   7. ONCE, HERE: every signature already on record whose digest still covers
 *      the transcription in code is put in force, and every one that is not is
 *      named with its reason. GENERATED from the code registry by
 *      scripts/emit-signed-protocols-backfill.mjs, between the markers below.
 *
 * WHAT THE DATABASE CANNOT CHECK, AND WHO DOES. Whether a signature still
 * covers the words in code, whether the signer's licence is current on the
 * register, and whether the register says he seals the discipline the
 * protocol requires are questions about the code. At signing the application
 * asks all three before calling the function (src/lib/protocol-sign.ts). For
 * the signatures already on record, the generator asked the registry for each
 * protocol's digest and items when it wrote section 7, and the comparison of
 * the stored digest with that one is made here, in SQL. After this file, every
 * reader of a protocol put in force this way asks signatureStatus again
 * (dispatch and every money door), so a transcription changed after signing
 * closes the line without a deploy, ruling 11's closing direction.
 *
 * ONE STATEMENT HERE CARRIES `drop`, AND IT IS THE STATUS CONSTRAINT. Adding
 * `voided` replaces a check constraint, which PostgreSQL does only by dropping
 * it. The two functions whose signatures change are NOT dropped: their old
 * versions are replaced by bodies that refuse, beside the new overloads.
 * Operator ruling, 2026-10-22: `voided` stays a status; the drop and the
 * re-add are one statement; the chat applies this file with apply_migration
 * and approves a confirmation on the drop if the connector asks; nobody runs
 * SQL by hand. If the connector refuses outright, the alternatives are
 * discussed then and not before. docs/production-sitting-0081-signed-protocols.md.
 *
 * SECURITY INVOKER, search_path pinned, EXECUTE revoked from PUBLIC, anon and
 * authenticated in this file (0073).
 */

/* 1. Which signature put a record in force. */
alter table eng_protocol_templates
  add column if not exists signed_by_seal_act_id uuid references eng_seal_acts (id);

comment on column eng_protocol_templates.signed_by_seal_act_id is
  'The portal signature (eng_seal_acts, kind protocol) that put this record in force. Null for a record approved any other way, such as 254-RC-001 signed on paper. 0081.';

/*
 * 2. The status word. The drop and the widened re-add are ONE statement, so
 * there is no moment, even inside this transaction, when the column is
 * unchecked (operator ruling, 2026-10-22). The re-add is 0049's list plus
 * `voided`, word for word otherwise.
 */
alter table eng_protocol_templates
  drop constraint if exists eng_protocol_templates_status_check,
  add constraint eng_protocol_templates_status_check
  check (status in ('draft', 'awaiting_engineer', 'published', 'retired', 'voided'));

alter table eng_protocol_templates
  add constraint eng_protocol_templates_voided_names_its_signature_ck
  check (status <> 'voided' or signed_by_seal_act_id is not null);

/* The items of a voided record stay what he signed: 0052's function, one word wider. */
create or replace function eng_freeze_items_of_a_protocol_in_force()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status
    from eng_protocol_templates
   where id = coalesce(old.template_id, new.template_id);

  if v_status is null or v_status not in ('published', 'retired', 'voided') then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  raise exception
    'eng: protocol % is in force, retired or voided, so its items are fixed. Start the next version instead.',
    coalesce(old.template_id, new.template_id);
end;
$$;

/* 3. The one door from a signature to a protocol in force. */
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
   * HELD OUT OF FORCE AT THE DATABASE, NOT ONLY IN CODE. Operator ruling,
   * 2026-10-22: 254-WP-001 shares windstorm-wpi-8 with 254-WS-001, and the
   * approval below retires every other protocol in force on the same line, so
   * putting it in force would silently retire WS-001. It needs a signed scope
   * addendum before any job. The list matches HELD_OUT_OF_FORCE in
   * src/content/protocols/signable.ts, and the signing proof asserts the two agree.
   */
  if v_act.protocol_document in ('254-WP-001') then
    raise exception 'eng: % is held out of force by operator ruling of 2026-10-22, so its signature puts nothing in force.', v_act.protocol_document;
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

comment on function eng_put_signed_protocol_in_force(uuid, text, jsonb) is
  'The one door from a portal signature to a protocol in force: draft to awaiting_engineer with the signature''s date, then eng_approve_protocol. Answers already for a record in force under the same signature. The caller has checked the signature covers the transcription in code, and the licence and discipline against the register. 0081.';

/*
 * 4. Signing puts the protocol in force in the signature's own transaction.
 *
 * 0062's eight-argument version is not dropped (the connector cancels a drop);
 * it is replaced by a body that refuses, so a signature can no longer arrive
 * through the door that put nothing in force. The new version sits beside it
 * as an overload and is the one the application calls.
 */
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
  raise exception 'eng: since 0081 a protocol signature is recorded with the licence and the items, so it puts the protocol in force in the same act.';
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
  p_mfa_verified_at     timestamptz,
  p_license             text,
  p_items               jsonb
)
returns text
language plpgsql
set search_path = public
as $$
begin
  insert into eng_seal_acts
    (id, kind, protocol_document, protocol_version, content_sha256,
     seal_image_id, signature_image_id, sealed_by, mfa_verified_at)
  values
    (p_seal_act_id, 'protocol', p_protocol_document, p_protocol_version, p_sha256,
     p_seal_image_id, p_signature_image_id, p_sealed_by, p_mfa_verified_at);

  /*
   * Null items records the signature and puts nothing in force, and only the
   * protocols held out of force may ask for it (operator review, 2026-10-22).
   * For any other protocol a signature without its items is refused, which
   * takes the insert above with it: one transaction.
   */
  if p_items is null then
    if p_protocol_document in ('254-WP-001') then
      return 'signed';
    end if;
    raise exception 'eng: % is signed with its items, so the signature puts it in force in the same act.', p_protocol_document;
  end if;
  return eng_put_signed_protocol_in_force(p_seal_act_id, p_license, p_items);
end;
$$;

/* 5. Voiding a protocol signature closes the record it put in force, in the same transaction. */
create or replace function eng_void_closes_its_protocol()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kind = 'protocol' and old.voided_at is null and new.voided_at is not null then
    update eng_protocol_templates
       set status = 'voided'
     where signed_by_seal_act_id = new.id
       and status = 'published';
  end if;
  return new;
end;
$$;

create trigger eng_seal_acts_void_closes_its_protocol
  after update of voided_at on eng_seal_acts
  for each row execute function eng_void_closes_its_protocol();

/* 6. The mark at the head of a sealed letter, by its checksum. */
alter table eng_seal_acts
  add column if not exists letterhead_sha256 text;

comment on column eng_seal_acts.letterhead_sha256 is
  'SHA-256 of the mark embedded at the head of a sealed letter (src/content/letters/letterhead-mark.ts). Required on every letter sealed from 0081; null on a protocol signature and on any letter sealed before it. 0081.';

/*
 * REQUIRED ON EVERY LETTER SEALED FROM HERE, AT INSERT. Operator review of
 * 2026-10-22: a NOT VALID check passes a null, because false OR null is null,
 * so the requirement lives in 0062's BEFORE INSERT check instead. A letter
 * sealed before this file is never inserted again, so its voiding, the one
 * change a seal act allows, is untouched.
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

  if new.kind = 'letter' and (new.letterhead_sha256 is null or new.letterhead_sha256 !~ '^[0-9a-f]{64}$') then
    raise exception
      'A letter is sealed with the SHA-256 of the mark at its head (0081).';
  end if;

  return new;
end;
$fn$;

/* The guard of 0062, with the new column among what a seal act may never change. */
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
     or new.letterhead_sha256 is distinct from old.letterhead_sha256 then
    raise exception
      'A seal act records what was sealed. Only voided_at, voided_by and voided_because may be set, once.';
  end if;
  return new;
end;
$fn$;

/* 0062's fourteen-argument version refuses rather than being dropped, as in section 4. */
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
  raise exception 'eng: since 0081 a letter is sealed with the checksum of the mark at its head.';
end;
$fn$;

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
  insert into public.eng_documents
    (id, file_id, client_id, kind, title, bucket, storage_key, content_type, byte_size,
     sealed_at, sealed_by, uploaded_by, visibility, firm_registration)
  values
    (p_document_id, p_file_id, p_client_id, 'deliverable', p_title, 'eng-documents', p_storage_key,
     'application/pdf', p_byte_size, now(), p_sealed_by, p_sealed_by, 'client', p_firm_registration);

  insert into public.eng_seal_acts
    (id, kind, document_id, determination_id, content_sha256,
     seal_image_id, signature_image_id, sealed_by, mfa_verified_at, letterhead_sha256)
  values
    (p_seal_act_id, 'letter', p_document_id, p_determination_id, p_sha256,
     p_seal_image_id, p_signature_image_id, p_sealed_by, p_mfa_verified_at, p_letterhead_sha256);
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
      and p.proname in (
        'eng_put_signed_protocol_in_force', 'eng_record_protocol_signature', 'eng_void_closes_its_protocol',
        'eng_freeze_items_of_a_protocol_in_force', 'eng_seal_act_guard', 'eng_record_letter_seal',
        'eng_seal_act_check'
      )
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
    raise exception 'eng: after 0081 these are still executable by anon or authenticated: %', open_fns;
  end if;
end;
$$;

/* 7. ONCE: the signatures already on record. */
-- BEGIN GENERATED BY scripts/emit-signed-protocols-backfill.mjs. DO NOT EDIT BY HAND.
/*
 * For each protocol: the live signature on record, if any, is put in force when
 * its digest is the transcription's and its signer may seal the discipline;
 * otherwise it stays as it is. Either way one audit event names the outcome and
 * the reason, action protocol.in_force_at_0081, and that is the read-back.
 * Deferred and not covered: 254-WP-001, Deferred by operator ruling of 2026-10-22: it shares the windstorm line with 254-WS-001 and needs a signed scope addendum before any job..
 */
create temporary table eng_0081_signers (licence_sha256 text, discipline text) on commit drop;
insert into eng_0081_signers values ('afde1f7e59be3fe2efbcf559fcee846163e49545a7ed240b2ff41fb9ce94b60e', 'structural');

-- 254-WS-001 v1.1: 35 items, transcription sha256 441cf92273bc4ca7c54aea8e858a5a2e44b18515b3c40812af39dd255e6a0537
do $backfill$
declare
  v_act      record;
  v_template record;
  v_licence  text;
  v_outcome  text;
  v_why      text;
begin
  select id, content_sha256, sealed_by into v_act from eng_seal_acts
   where kind = 'protocol' and protocol_document = '254-WS-001' and protocol_version = '1.1' and voided_at is null;
  select id, status, requires_discipline into v_template from eng_protocol_templates where document_number = '254-WS-001' and version_label = '1.1';
  if v_act.id is null then
    v_outcome := 'not in force'; v_why := 'no live signature on record';
  elsif v_act.content_sha256 is distinct from '441cf92273bc4ca7c54aea8e858a5a2e44b18515b3c40812af39dd255e6a0537' then
    v_outcome := 'not in force'; v_why := 'the signature does not cover the transcription in code; it reads as void';
  else
    select license_number into v_licence from eng_profiles where id = v_act.sealed_by;
    if not exists (select 1 from eng_0081_signers s where s.licence_sha256 = encode(sha256(convert_to(coalesce(btrim(v_licence), ''), 'UTF8')), 'hex') and s.discipline = v_template.requires_discipline) then
      v_outcome := 'not in force'; v_why := 'the signer is not an engineer on the register with a current licence who seals ' || coalesce(v_template.requires_discipline, 'an undeclared discipline');
    else
      v_outcome := eng_put_signed_protocol_in_force(v_act.id, btrim(v_licence), $items$[{"sort_order":0,"item_key":"photo-of-address-marker-house-number","kind":"photo","label":"Photo of address marker (house number, street sign, or mailbox)","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":1,"item_key":"all-four-elevations-of-the-structure","kind":"photo","label":"All four elevations of the structure","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":2,"item_key":"view-away-from-the-building-on","kind":"photo","label":"View away from the building on each of the four sides, showing what surrounds it","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":3,"item_key":"each-roof-plane-overall","kind":"photo","label":"Each roof plane, overall","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":4,"item_key":"covering-type-and-product-name-from","kind":"photo","label":"Covering type and product name, from wrapper, marking, or leftover bundle","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":5,"item_key":"shingles-tab-lifted-at-four-locations","kind":"photo","label":"Shingles: tab lifted at four locations, one on each side of the building, ruler in frame, showing fastener count and placement","instructions":"Ruler in frame.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":6,"item_key":"metal-panels-profile-fastener-type-and","kind":"photo","label":"Metal panels: profile, fastener type, and fastener spacing measured at eave, field, and ridge","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":7,"item_key":"tile-or-other-covering-fastening-at","kind":"photo","label":"Tile or other covering: fastening at eave, field, and ridge where visible","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":8,"item_key":"eave-and-rake-edge-drip-edge","kind":"photo","label":"Eave and rake edge: drip edge, starter, and underlayment where visible","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":9,"item_key":"hip-and-ridge","kind":"photo","label":"Hip and ridge","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":10,"item_key":"every-roof-vent-type-label-if","kind":"photo","label":"Every roof vent: type, label if any, and fastening","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":11,"item_key":"every-skylight-label-and-curb","kind":"photo","label":"Every skylight: label and curb","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":12,"item_key":"roof-deck-from-the-attic-panel","kind":"photo","label":"Roof deck from the attic: panel stamp showing type and thickness","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":13,"item_key":"deck-fastening-from-the-attic-nails","kind":"photo","label":"Deck fastening from the attic: nails visible along a rafter or truss, tape in frame","instructions":"Ruler in frame.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":14,"item_key":"each-area-opened-by-the-owner","kind":"photo","label":"Each area opened by the owner's contractor: underlayment, deck, and deck fastening exposed, tape in frame","instructions":"Ruler in frame. One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":15,"item_key":"every-window-wide-then-label-then","kind":"photo","label":"Every window: wide, then label, then tape across width and height","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":16,"item_key":"every-exterior-door-wide-then-label","kind":"photo","label":"Every exterior door: wide, then label on the hinge edge or frame, then tape across width and height","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":17,"item_key":"every-sliding-door-wide-label-and","kind":"photo","label":"Every sliding door: wide, label, and size","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":18,"item_key":"every-garage-door-wide-from-inside","kind":"photo","label":"Every garage door: wide from inside, label on the door section, size, and track fastening","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":19,"item_key":"impact-marking-on-the-glass-or","kind":"photo","label":"Impact marking on the glass, or the shutter and its installed hardware, for every glazed opening","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":20,"item_key":"fastening-of-each-window-and-door","kind":"photo","label":"Fastening of each window and door to the wall where visible, tape in frame","instructions":"Ruler in frame.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":21,"item_key":"exterior-wall-covering-type-product-marking","kind":"photo","label":"Exterior wall covering: type, product marking, and fastening where visible, each elevation","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":22,"item_key":"foundation-type-and-anchorage-where-visible","kind":"photo","label":"Foundation type and anchorage where visible: anchor bolts or straps at the sill plate, spacing measured","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":23,"item_key":"hold-downs-and-straps-at-wall","kind":"photo","label":"Hold-downs and straps at wall ends and corners where visible","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":24,"item_key":"wall-sheathing-type-and-nailing-where","kind":"photo","label":"Wall sheathing type and nailing where visible","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":25,"item_key":"stud-to-plate-connections-where-visible","kind":"photo","label":"Stud to plate connections where visible","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":26,"item_key":"roof-to-wall-connectors-in-the","kind":"photo","label":"Roof to wall connectors in the attic: connector marking, nails in each, and count over a 10 ft length of wall, each side","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":27,"item_key":"rafter-or-truss-size-and-spacing","kind":"photo","label":"Rafter or truss size and spacing, tape in frame","instructions":"Ruler in frame.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":28,"item_key":"gable-end-bracing","kind":"photo","label":"Gable end bracing","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":29,"item_key":"floor-to-floor-straps-where-visible","kind":"photo","label":"Floor to floor straps where visible (two stories)","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":30,"item_key":"porch-carport-and-patio-cover-posts","kind":"photo","label":"Porch, carport, and patio cover posts: connection at top and at bottom, every post","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":31,"item_key":"outdoor-mechanical-equipment-anchorage-of-each","kind":"photo","label":"Outdoor mechanical equipment: anchorage of each unit","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":32,"item_key":"addition-where-and-how-it-joins","kind":"photo","label":"Addition: where and how it joins the main structure","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":33,"item_key":"full-perimeter-walk-anything-unusual","kind":"photo","label":"Full perimeter walk: anything unusual","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":34,"item_key":"exception-menu-cleared-for-every-non","kind":"note","label":"Exception menu cleared for every non-applicable item","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null}]$items$::jsonb);
      v_why := 'a live signature whose digest is the transcription in code, by an engineer on the register';
    end if;
  end if;
  insert into eng_audit_events (action, entity_type, entity_id, summary, diff)
  values ('protocol.in_force_at_0081', 'protocol', coalesce(v_template.id::text, '254-WS-001'),
    '254-WS-001 v1.1: ' || v_outcome || ', ' || v_why,
    jsonb_build_object('document', '254-WS-001', 'version', '1.1', 'outcome', v_outcome, 'why', v_why, 'seal_act_id', v_act.id));
end;
$backfill$;

-- 254-MH-001 v1.1: 35 items, transcription sha256 d5fb2893f4d618dbdbf7a9d3d1c0998b1462e2adf72caa8d4ba59fb7b34a55d6
do $backfill$
declare
  v_act      record;
  v_template record;
  v_licence  text;
  v_outcome  text;
  v_why      text;
begin
  select id, content_sha256, sealed_by into v_act from eng_seal_acts
   where kind = 'protocol' and protocol_document = '254-MH-001' and protocol_version = '1.1' and voided_at is null;
  select id, status, requires_discipline into v_template from eng_protocol_templates where document_number = '254-MH-001' and version_label = '1.1';
  if v_act.id is null then
    v_outcome := 'not in force'; v_why := 'no live signature on record';
  elsif v_act.content_sha256 is distinct from 'd5fb2893f4d618dbdbf7a9d3d1c0998b1462e2adf72caa8d4ba59fb7b34a55d6' then
    v_outcome := 'not in force'; v_why := 'the signature does not cover the transcription in code; it reads as void';
  else
    select license_number into v_licence from eng_profiles where id = v_act.sealed_by;
    if not exists (select 1 from eng_0081_signers s where s.licence_sha256 = encode(sha256(convert_to(coalesce(btrim(v_licence), ''), 'UTF8')), 'hex') and s.discipline = v_template.requires_discipline) then
      v_outcome := 'not in force'; v_why := 'the signer is not an engineer on the register with a current licence who seals ' || coalesce(v_template.requires_discipline, 'an undeclared discipline');
    else
      v_outcome := eng_put_signed_protocol_in_force(v_act.id, btrim(v_licence), $items$[{"sort_order":0,"item_key":"photo-of-address-marker-house-number","kind":"photo","label":"Photo of address marker (house number, street sign, or mailbox)","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":1,"item_key":"all-four-elevations-of-the-home","kind":"photo","label":"All four elevations of the home","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":2,"item_key":"hud-label-on-each-section-every","kind":"photo","label":"HUD label on each section, every digit readable","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":3,"item_key":"data-plate-inside-the-home-kitchen","kind":"photo","label":"Data plate inside the home (kitchen cabinet, bedroom closet, or electrical panel)","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":4,"item_key":"serial-number-stamped-on-the-front","kind":"photo","label":"Serial number stamped on the front cross member of the frame","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":5,"item_key":"ground-slope-and-drainage-on-each","kind":"photo","label":"Ground slope and drainage on each side of the home","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":6,"item_key":"standing-water-ponding-or-erosion-at","kind":"photo","label":"Standing water, ponding, or erosion at or under the home","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":7,"item_key":"downspout-and-drain-discharge-points","kind":"photo","label":"Downspout and drain discharge points","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":8,"item_key":"towing-hitch-removed-or-still-attached","kind":"photo","label":"Towing hitch: removed or still attached","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":9,"item_key":"axles-and-wheels-removed-or-still","kind":"photo","label":"Axles and wheels: removed or still attached","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":10,"item_key":"enclosure-on-each-side-material-and","kind":"photo","label":"Enclosure on each side: material and whether it is continuous","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":11,"item_key":"how-the-enclosure-is-fastened-at","kind":"photo","label":"How the enclosure is fastened at the top and what it sits on at the bottom","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":12,"item_key":"access-opening-tape-across-width-and","kind":"photo","label":"Access opening, tape across width and height","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":13,"item_key":"every-vent","kind":"photo","label":"Every vent","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":14,"item_key":"overview-from-the-access-opening-and","kind":"photo","label":"Overview from the access opening, and looking down the length of each chassis beam","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":15,"item_key":"clearance-from-ground-to-the-bottom","kind":"photo","label":"Clearance from ground to the bottom of the chassis beam at the lowest point, tape in frame","instructions":"Ruler in frame.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":16,"item_key":"ground-cover-or-vapor-barrier-and","kind":"photo","label":"Ground cover or vapor barrier, and any wet soil","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":17,"item_key":"footings-typical-and-worst-tape-across","kind":"photo","label":"Footings: typical and worst, tape across length and width, thickness where visible","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":18,"item_key":"piers-typical-and-worst-on-each","kind":"photo","label":"Piers: typical and worst on each chassis beam: material, how stacked, cap, and shims","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":19,"item_key":"tallest-pier-tape-in-frame","kind":"photo","label":"Tallest pier, tape in frame","instructions":"Ruler in frame.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":20,"item_key":"pier-spacing-along-each-chassis-beam","kind":"photo","label":"Pier spacing along each chassis beam, tape in frame","instructions":"Ruler in frame.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":21,"item_key":"piers-at-the-marriage-line-and","kind":"photo","label":"Piers at the marriage line and under exterior door and large window openings (multi-section)","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":22,"item_key":"any-pier-that-is-leaning-cracked","kind":"photo","label":"Any pier that is leaning, cracked, loose, or not in contact with the beam","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":23,"item_key":"how-the-chassis-beam-is-connected","kind":"photo","label":"How the chassis beam is connected to the pier or foundation (bolted / welded / clamped / resting only)","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":24,"item_key":"every-strap-or-tie-on-each","kind":"photo","label":"Every strap or tie on each long side: where it attaches to the home and where it attaches to the ground or foundation","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":25,"item_key":"what-each-strap-is-anchored-to","kind":"photo","label":"What each strap is anchored to (screw-in ground anchor / concrete footing or slab / concrete deadman / other)","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":26,"item_key":"anchorage-at-each-end-of-the","kind":"photo","label":"Anchorage at each end of the home, running lengthwise","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":27,"item_key":"any-strap-that-is-loose-rusted","kind":"photo","label":"Any strap that is loose, rusted, cut, or missing","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":28,"item_key":"any-engineered-bracing-system-with-its","kind":"photo","label":"Any engineered bracing system, with its label or tag","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":29,"item_key":"every-addition-room-porch-deck-carport","kind":"photo","label":"Every addition: room, porch, deck, carport, awning, roof-over","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":30,"item_key":"whether-each-addition-stands-on-its","kind":"photo","label":"Whether each addition stands on its own supports or hangs on the home","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":31,"item_key":"footing-and-post-under-each-addition","kind":"photo","label":"Footing and post under each addition","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":32,"item_key":"water-sewer-electric-and-gas-connections","kind":"photo","label":"Water, sewer, electric, and gas connections under and at the home","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":33,"item_key":"full-perimeter-walk-anything-unusual","kind":"photo","label":"Full perimeter walk: anything unusual","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":34,"item_key":"exception-menu-cleared-for-every-non","kind":"note","label":"Exception menu cleared for every non-applicable item","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null}]$items$::jsonb);
      v_why := 'a live signature whose digest is the transcription in code, by an engineer on the register';
    end if;
  end if;
  insert into eng_audit_events (action, entity_type, entity_id, summary, diff)
  values ('protocol.in_force_at_0081', 'protocol', coalesce(v_template.id::text, '254-MH-001'),
    '254-MH-001 v1.1: ' || v_outcome || ', ' || v_why,
    jsonb_build_object('document', '254-MH-001', 'version', '1.1', 'outcome', v_outcome, 'why', v_why, 'seal_act_id', v_act.id));
end;
$backfill$;

-- 254-SL-001 v1.1: 22 items, transcription sha256 c19522c86abbba90622aa3c1a41f5194a8f6c97134abb8bf8608fc22576c536d
do $backfill$
declare
  v_act      record;
  v_template record;
  v_licence  text;
  v_outcome  text;
  v_why      text;
begin
  select id, content_sha256, sealed_by into v_act from eng_seal_acts
   where kind = 'protocol' and protocol_document = '254-SL-001' and protocol_version = '1.1' and voided_at is null;
  select id, status, requires_discipline into v_template from eng_protocol_templates where document_number = '254-SL-001' and version_label = '1.1';
  if v_act.id is null then
    v_outcome := 'not in force'; v_why := 'no live signature on record';
  elsif v_act.content_sha256 is distinct from 'c19522c86abbba90622aa3c1a41f5194a8f6c97134abb8bf8608fc22576c536d' then
    v_outcome := 'not in force'; v_why := 'the signature does not cover the transcription in code; it reads as void';
  else
    select license_number into v_licence from eng_profiles where id = v_act.sealed_by;
    if not exists (select 1 from eng_0081_signers s where s.licence_sha256 = encode(sha256(convert_to(coalesce(btrim(v_licence), ''), 'UTF8')), 'hex') and s.discipline = v_template.requires_discipline) then
      v_outcome := 'not in force'; v_why := 'the signer is not an engineer on the register with a current licence who seals ' || coalesce(v_template.requires_discipline, 'an undeclared discipline');
    else
      v_outcome := eng_put_signed_protocol_in_force(v_act.id, btrim(v_licence), $items$[{"sort_order":0,"item_key":"photo-of-address-marker-house-number","kind":"photo","label":"Photo of address marker (house number, street sign, or mailbox)","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":1,"item_key":"all-four-elevations-of-the-structure","kind":"photo","label":"All four elevations of the structure","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":2,"item_key":"each-roof-plane-the-array-will","kind":"photo","label":"Each roof plane the array will occupy, from the ground or the roof","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":3,"item_key":"roof-covering-at-an-edge-showing","kind":"photo","label":"Roof covering at an edge, showing type and number of layers","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":4,"item_key":"everything-already-on-those-planes-vents","kind":"photo","label":"Everything already on those planes: vents, equipment, existing solar","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":5,"item_key":"framing-overall-from-the-attic-access","kind":"photo","label":"Framing overall from the attic access","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":6,"item_key":"framing-type-rafter-truss-other","kind":"photo","label":"Framing type (rafter / truss / other)","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":7,"item_key":"member-depth-and-width-tape-in","kind":"photo","label":"Member depth and width, tape in frame","instructions":"Ruler in frame.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":8,"item_key":"spacing-center-to-center-measured-at","kind":"photo","label":"Spacing center to center, measured at three places, tape in frame","instructions":"Ruler in frame.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":9,"item_key":"span-tape-from-one-support-to","kind":"photo","label":"Span: tape from one support to the next, both ends in the photos","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":10,"item_key":"what-supports-the-member-at-each","kind":"photo","label":"What supports the member at each end and in between (wall, ridge, purlin, brace, knee wall)","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":11,"item_key":"lumber-grade-stamp-if-one-can","kind":"photo","label":"Lumber grade stamp, if one can be found","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":12,"item_key":"trusses-tag-or-stamp-web-pattern","kind":"photo","label":"Trusses: tag or stamp, web pattern from the side, and one metal plate close up","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":13,"item_key":"ridge-board-or-beam-collar-ties","kind":"photo","label":"Ridge board or beam, collar ties, and ceiling joists: size and spacing","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":14,"item_key":"roof-sheathing-type-and-thickness-from","kind":"photo","label":"Roof sheathing type and thickness, from a stamp or an exposed edge","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":15,"item_key":"sight-line-along-the-ridge-and","kind":"photo","label":"Sight line along the ridge and down the plane, showing any sag","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":16,"item_key":"every-split-crack-notch-or-cut","kind":"photo","label":"Every split, crack, notch, or cut member","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":17,"item_key":"every-truss-member-that-has-been","kind":"photo","label":"Every truss member that has been cut, removed, or altered","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":18,"item_key":"every-earlier-repair-or-added-member","kind":"photo","label":"Every earlier repair or added member","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":19,"item_key":"every-water-stain-rot-or-insect","kind":"photo","label":"Every water stain, rot, or insect damage on the framing or sheathing","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":20,"item_key":"full-perimeter-walk-anything-unusual","kind":"photo","label":"Full perimeter walk: anything unusual","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":21,"item_key":"exception-menu-cleared-for-every-non","kind":"note","label":"Exception menu cleared for every non-applicable item","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null}]$items$::jsonb);
      v_why := 'a live signature whose digest is the transcription in code, by an engineer on the register';
    end if;
  end if;
  insert into eng_audit_events (action, entity_type, entity_id, summary, diff)
  values ('protocol.in_force_at_0081', 'protocol', coalesce(v_template.id::text, '254-SL-001'),
    '254-SL-001 v1.1: ' || v_outcome || ', ' || v_why,
    jsonb_build_object('document', '254-SL-001', 'version', '1.1', 'outcome', v_outcome, 'why', v_why, 'seal_act_id', v_act.id));
end;
$backfill$;

-- 254-PL-001 v1.1: 15 items, transcription sha256 c8814496b1dd0b0f228b92447f547f7be4b8bf1553278bef5891817bdb6fb27e
do $backfill$
declare
  v_act      record;
  v_template record;
  v_licence  text;
  v_outcome  text;
  v_why      text;
begin
  select id, content_sha256, sealed_by into v_act from eng_seal_acts
   where kind = 'protocol' and protocol_document = '254-PL-001' and protocol_version = '1.1' and voided_at is null;
  select id, status, requires_discipline into v_template from eng_protocol_templates where document_number = '254-PL-001' and version_label = '1.1';
  if v_act.id is null then
    v_outcome := 'not in force'; v_why := 'no live signature on record';
  elsif v_act.content_sha256 is distinct from 'c8814496b1dd0b0f228b92447f547f7be4b8bf1553278bef5891817bdb6fb27e' then
    v_outcome := 'not in force'; v_why := 'the signature does not cover the transcription in code; it reads as void';
  else
    select license_number into v_licence from eng_profiles where id = v_act.sealed_by;
    if not exists (select 1 from eng_0081_signers s where s.licence_sha256 = encode(sha256(convert_to(coalesce(btrim(v_licence), ''), 'UTF8')), 'hex') and s.discipline = v_template.requires_discipline) then
      v_outcome := 'not in force'; v_why := 'the signer is not an engineer on the register with a current licence who seals ' || coalesce(v_template.requires_discipline, 'an undeclared discipline');
    else
      v_outcome := eng_put_signed_protocol_in_force(v_act.id, btrim(v_licence), $items$[{"sort_order":0,"item_key":"photo-of-address-marker-house-number","kind":"photo","label":"Photo of address marker (house number, street sign, or mailbox)","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":1,"item_key":"all-four-elevations-of-the-structure","kind":"photo","label":"All four elevations of the structure","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":2,"item_key":"the-room-or-area-the-element","kind":"photo","label":"The room or area the element is in, from two directions","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":3,"item_key":"the-element-overall-showing-both-ends","kind":"photo","label":"The element overall, showing both ends","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":4,"item_key":"material-and-any-stamp-label-or","kind":"photo","label":"Material and any stamp, label, or marking on it","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":5,"item_key":"depth-and-width-tape-in-frame","kind":"photo","label":"Depth and width, tape in frame","instructions":"Ruler in frame.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":6,"item_key":"length-or-span-between-supports-tape","kind":"photo","label":"Length or span between supports, tape in frame","instructions":"Ruler in frame.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":7,"item_key":"spacing-where-there-is-more-than","kind":"photo","label":"Spacing, where there is more than one member, tape in frame","instructions":"Ruler in frame.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":8,"item_key":"each-support-what-the-element-sits","kind":"photo","label":"Each support: what the element sits on at each end and in between","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":9,"item_key":"each-connection-hanger-connector-bolts-nails","kind":"photo","label":"Each connection: hanger, connector, bolts, nails, or screws, with any marking","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":10,"item_key":"what-the-element-carries-what-sits","kind":"photo","label":"What the element carries: what sits on it or frames into it","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":11,"item_key":"what-is-below-each-support-down","kind":"photo","label":"What is below each support, down to the foundation where it can be seen","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":12,"item_key":"any-split-crack-sag-notch-hole","kind":"photo","label":"Any split, crack, sag, notch, hole, rot, rust, or earlier repair","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":13,"item_key":"full-perimeter-walk-anything-unusual","kind":"photo","label":"Full perimeter walk: anything unusual","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":14,"item_key":"exception-menu-cleared-for-every-non","kind":"note","label":"Exception menu cleared for every non-applicable item","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null}]$items$::jsonb);
      v_why := 'a live signature whose digest is the transcription in code, by an engineer on the register';
    end if;
  end if;
  insert into eng_audit_events (action, entity_type, entity_id, summary, diff)
  values ('protocol.in_force_at_0081', 'protocol', coalesce(v_template.id::text, '254-PL-001'),
    '254-PL-001 v1.1: ' || v_outcome || ', ' || v_why,
    jsonb_build_object('document', '254-PL-001', 'version', '1.1', 'outcome', v_outcome, 'why', v_why, 'seal_act_id', v_act.id));
end;
$backfill$;

-- 254-RS-001 v1.1: 24 items, transcription sha256 47e8e9ecb2d5fe07f9b37899cf5ee5494202b6a6f59648bf3ab0d85b9f616508
do $backfill$
declare
  v_act      record;
  v_template record;
  v_licence  text;
  v_outcome  text;
  v_why      text;
begin
  select id, content_sha256, sealed_by into v_act from eng_seal_acts
   where kind = 'protocol' and protocol_document = '254-RS-001' and protocol_version = '1.1' and voided_at is null;
  select id, status, requires_discipline into v_template from eng_protocol_templates where document_number = '254-RS-001' and version_label = '1.1';
  if v_act.id is null then
    v_outcome := 'not in force'; v_why := 'no live signature on record';
  elsif v_act.content_sha256 is distinct from '47e8e9ecb2d5fe07f9b37899cf5ee5494202b6a6f59648bf3ab0d85b9f616508' then
    v_outcome := 'not in force'; v_why := 'the signature does not cover the transcription in code; it reads as void';
  else
    select license_number into v_licence from eng_profiles where id = v_act.sealed_by;
    if not exists (select 1 from eng_0081_signers s where s.licence_sha256 = encode(sha256(convert_to(coalesce(btrim(v_licence), ''), 'UTF8')), 'hex') and s.discipline = v_template.requires_discipline) then
      v_outcome := 'not in force'; v_why := 'the signer is not an engineer on the register with a current licence who seals ' || coalesce(v_template.requires_discipline, 'an undeclared discipline');
    else
      v_outcome := eng_put_signed_protocol_in_force(v_act.id, btrim(v_licence), $items$[{"sort_order":0,"item_key":"photo-of-address-marker-house-number","kind":"photo","label":"Photo of address marker (house number, street sign, or mailbox)","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":1,"item_key":"all-four-elevations-of-the-structure","kind":"photo","label":"All four elevations of the structure","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":2,"item_key":"the-room-or-area-each-damaged","kind":"photo","label":"The room or area each damaged location is in, from two directions","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":3,"item_key":"any-shoring-bracing-or-temporary-support","kind":"photo","label":"Any shoring, bracing, or temporary support in place","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":4,"item_key":"the-damaged-member-or-area-overall","kind":"photo","label":"The damaged member or area overall","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":5,"item_key":"the-damage-close-up-ruler-in","kind":"photo","label":"The damage close up, ruler in frame","instructions":"Ruler in frame.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":6,"item_key":"where-the-damage-starts-and-where","kind":"photo","label":"Where the damage starts and where it ends, tape in frame","instructions":"Ruler in frame.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":7,"item_key":"any-sag-lean-or-movement-with","kind":"photo","label":"Any sag, lean, or movement, with a level or string line in frame","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":8,"item_key":"any-water-stain-rot-rust-or","kind":"photo","label":"Any water, stain, rot, rust, or insect evidence at or near the damage","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":9,"item_key":"any-earlier-repair-at-or-near","kind":"photo","label":"Any earlier repair at or near the damage","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":10,"item_key":"the-same-member-beyond-the-damage","kind":"photo","label":"The same member beyond the damage, to its supports at each end","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":11,"item_key":"span-between-supports-and-spacing-to","kind":"photo","label":"Span between supports and spacing to the next members, tape in frame","instructions":"Ruler in frame.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":12,"item_key":"each-support-and-connection-of-the","kind":"photo","label":"Each support and connection of the damaged member","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":13,"item_key":"what-the-damaged-member-carries-what","kind":"photo","label":"What the damaged member carries: what sits on it or frames into it","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":14,"item_key":"what-is-below-each-support-down","kind":"photo","label":"What is below each support, down to the foundation where it can be seen","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":15,"item_key":"working-room-around-the-damage-pipes","kind":"photo","label":"Working room around the damage: pipes, wires, ducts, and finishes in the way","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":16,"item_key":"every-crack-in-the-foundation-wide","kind":"photo","label":"Every crack in the foundation, wide and close, with a ruler or crack comparator card in frame","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":17,"item_key":"relative-elevation-survey-equipment-and-benchmark","kind":"photo","label":"Relative elevation survey: equipment and benchmark photographed in place, reading points marked on the sketch no more than 20 ft apart","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":18,"item_key":"the-reading-at-each-point-or","kind":"photo","label":"The reading at each point, or the summary printout","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":19,"item_key":"every-pier-beam-and-girder-at","kind":"photo","label":"Every pier, beam, and girder at the damage, from the crawlspace (pier-and-beam only)","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":20,"item_key":"standing-water-wet-soil-and-drainage","kind":"photo","label":"Standing water, wet soil, and drainage at the damaged side","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":21,"item_key":"any-earlier-foundation-repair-tags-plates","kind":"photo","label":"Any earlier foundation repair: tags, plates, or patches","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":22,"item_key":"full-perimeter-walk-anything-unusual","kind":"photo","label":"Full perimeter walk: anything unusual","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":23,"item_key":"exception-menu-cleared-for-every-non","kind":"note","label":"Exception menu cleared for every non-applicable item","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null}]$items$::jsonb);
      v_why := 'a live signature whose digest is the transcription in code, by an engineer on the register';
    end if;
  end if;
  insert into eng_audit_events (action, entity_type, entity_id, summary, diff)
  values ('protocol.in_force_at_0081', 'protocol', coalesce(v_template.id::text, '254-RS-001'),
    '254-RS-001 v1.1: ' || v_outcome || ', ' || v_why,
    jsonb_build_object('document', '254-RS-001', 'version', '1.1', 'outcome', v_outcome, 'why', v_why, 'seal_act_id', v_act.id));
end;
$backfill$;

-- 254-DS-001 v1.1: 13 items, transcription sha256 c47536b8ab31009027e6f443a03bed1b28b6dbf443b85350b7e7bb817756958b
do $backfill$
declare
  v_act      record;
  v_template record;
  v_licence  text;
  v_outcome  text;
  v_why      text;
begin
  select id, content_sha256, sealed_by into v_act from eng_seal_acts
   where kind = 'protocol' and protocol_document = '254-DS-001' and protocol_version = '1.1' and voided_at is null;
  select id, status, requires_discipline into v_template from eng_protocol_templates where document_number = '254-DS-001' and version_label = '1.1';
  if v_act.id is null then
    v_outcome := 'not in force'; v_why := 'no live signature on record';
  elsif v_act.content_sha256 is distinct from 'c47536b8ab31009027e6f443a03bed1b28b6dbf443b85350b7e7bb817756958b' then
    v_outcome := 'not in force'; v_why := 'the signature does not cover the transcription in code; it reads as void';
  else
    select license_number into v_licence from eng_profiles where id = v_act.sealed_by;
    if not exists (select 1 from eng_0081_signers s where s.licence_sha256 = encode(sha256(convert_to(coalesce(btrim(v_licence), ''), 'UTF8')), 'hex') and s.discipline = v_template.requires_discipline) then
      v_outcome := 'not in force'; v_why := 'the signer is not an engineer on the register with a current licence who seals ' || coalesce(v_template.requires_discipline, 'an undeclared discipline');
    else
      v_outcome := eng_put_signed_protocol_in_force(v_act.id, btrim(v_licence), $items$[{"sort_order":0,"item_key":"photo-of-address-marker-house-number","kind":"photo","label":"Photo of address marker (house number, street sign, or mailbox)","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":1,"item_key":"all-four-elevations-of-the-structure","kind":"photo","label":"All four elevations of the structure, or the site from each side","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":2,"item_key":"the-area-where-the-new-work","kind":"photo","label":"The area where the new work goes, from two directions","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":3,"item_key":"ground-slope-and-drainage-where-the","kind":"photo","label":"Ground slope and drainage where the new work goes","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":4,"item_key":"trees-utilities-and-neighboring-structures-within","kind":"photo","label":"Trees, utilities, and neighboring structures within 20 feet of the new work","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":5,"item_key":"foundation-type-and-its-edge-where","kind":"photo","label":"Foundation type and its edge where the new work meets it, tape in frame","instructions":"Ruler in frame.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":6,"item_key":"wall-construction-where-the-new-work","kind":"photo","label":"Wall construction where the new work meets it: material, stud size and spacing where visible","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":7,"item_key":"floor-framing-member-size-spacing-span","kind":"photo","label":"Floor framing: member size, spacing, span, and direction, tape in frame","instructions":"Ruler in frame.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":8,"item_key":"roof-framing-rafter-or-truss-member","kind":"photo","label":"Roof framing: rafter or truss, member size, spacing, span, and pitch, tape in frame","instructions":"Ruler in frame.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":9,"item_key":"each-beam-post-or-bearing-wall","kind":"photo","label":"Each beam, post, or bearing wall near the new work, and what it sits on","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":10,"item_key":"any-damage-sag-or-earlier-alteration","kind":"photo","label":"Any damage, sag, or earlier alteration near the new work","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":11,"item_key":"full-perimeter-walk-anything-unusual","kind":"photo","label":"Full perimeter walk: anything unusual","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":12,"item_key":"exception-menu-cleared-for-every-non","kind":"note","label":"Exception menu cleared for every non-applicable item","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null}]$items$::jsonb);
      v_why := 'a live signature whose digest is the transcription in code, by an engineer on the register';
    end if;
  end if;
  insert into eng_audit_events (action, entity_type, entity_id, summary, diff)
  values ('protocol.in_force_at_0081', 'protocol', coalesce(v_template.id::text, '254-DS-001'),
    '254-DS-001 v1.1: ' || v_outcome || ', ' || v_why,
    jsonb_build_object('document', '254-DS-001', 'version', '1.1', 'outcome', v_outcome, 'why', v_why, 'seal_act_id', v_act.id));
end;
$backfill$;

-- 254-FC-001 v1.0: 37 items, transcription sha256 dece1a13c320d6fa4bb27ed10f00d8d06d2c176c9ac934d712dbea344010e1e8
do $backfill$
declare
  v_act      record;
  v_template record;
  v_licence  text;
  v_outcome  text;
  v_why      text;
begin
  select id, content_sha256, sealed_by into v_act from eng_seal_acts
   where kind = 'protocol' and protocol_document = '254-FC-001' and protocol_version = '1.0' and voided_at is null;
  select id, status, requires_discipline into v_template from eng_protocol_templates where document_number = '254-FC-001' and version_label = '1.0';
  if v_act.id is null then
    v_outcome := 'not in force'; v_why := 'no live signature on record';
  elsif v_act.content_sha256 is distinct from 'dece1a13c320d6fa4bb27ed10f00d8d06d2c176c9ac934d712dbea344010e1e8' then
    v_outcome := 'not in force'; v_why := 'the signature does not cover the transcription in code; it reads as void';
  else
    select license_number into v_licence from eng_profiles where id = v_act.sealed_by;
    if not exists (select 1 from eng_0081_signers s where s.licence_sha256 = encode(sha256(convert_to(coalesce(btrim(v_licence), ''), 'UTF8')), 'hex') and s.discipline = v_template.requires_discipline) then
      v_outcome := 'not in force'; v_why := 'the signer is not an engineer on the register with a current licence who seals ' || coalesce(v_template.requires_discipline, 'an undeclared discipline');
    else
      v_outcome := eng_put_signed_protocol_in_force(v_act.id, btrim(v_licence), $items$[{"sort_order":0,"item_key":"photo-of-address-marker-house-number","kind":"photo","label":"Photo of address marker (house number, street sign, or mailbox)","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":1,"item_key":"all-four-elevations-of-the-structure","kind":"photo","label":"All four elevations of the structure","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":2,"item_key":"full-perimeter-foundation-walk-continuous-coverage","kind":"photo","label":"Full perimeter foundation walk, continuous coverage","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":3,"item_key":"site-grading-overview-general-lot-slope","kind":"photo","label":"Site grading overview — general lot slope relative to the structure","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":4,"item_key":"each-tree-within-20-feet-of","kind":"photo","label":"Each tree within 20 feet of the foundation — species and trunk diameter if known","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":5,"item_key":"every-visible-crack-wide-close-with","kind":"photo","label":"Every visible crack: wide + close with ruler or crack comparator card in frame; note orientation (vertical/horizontal/diagonal/stair-step), width, length, and location","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":6,"item_key":"stair-step-cracking-in-brick-veneer","kind":"photo","label":"Stair-step cracking in brick veneer or mortar joints — count per elevation, worst close-ups","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":7,"item_key":"separation-at-expansion-joints-control-joints","kind":"photo","label":"Separation at expansion joints, control joints, or where foundation meets siding/veneer","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":8,"item_key":"spalling-exposed-rebar-or-exposed-post","kind":"photo","label":"Spalling, exposed rebar, or exposed post-tension cable/anchor","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":9,"item_key":"efflorescence-or-moisture-staining-on-the","kind":"photo","label":"Efflorescence or moisture staining on the foundation face","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":10,"item_key":"foundation-vent-condition-and-screening-pier","kind":"photo","label":"Foundation vent condition and screening (pier-and-beam / crawlspace)","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":11,"item_key":"downspout-discharge-points-and-distance-from","kind":"photo","label":"Downspout discharge points and distance from foundation","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":12,"item_key":"standing-water-or-ponding-evidence-adjacent","kind":"photo","label":"Standing water or ponding evidence adjacent to the foundation","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":13,"item_key":"irrigation-heads-or-hose-bibs-discharging","kind":"photo","label":"Irrigation heads or hose bibs discharging directly at the foundation","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":14,"item_key":"drainage-system-if-present-french-drain","kind":"photo","label":"Drainage system if present — French drain, area drain, or swale, and its discharge point","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":15,"item_key":"survey-equipment-and-benchmark-location-photographed","kind":"photo","label":"Survey equipment and benchmark location, photographed in place","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":16,"item_key":"grid-reading-points-across-each-room","kind":"photo","label":"Grid reading points across each room and along the perimeter, marked on the sketch, spaced no more than 20 ft apart","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":17,"item_key":"photo-of-the-reading-or-device","kind":"photo","label":"Photo of the reading or device display at each grid point, or the summary printout","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":18,"item_key":"interior-wall-and-ceiling-cracks-especially","kind":"photo","label":"Interior wall and ceiling cracks, especially at corners and above door/window headers — wide + close with ruler","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":19,"item_key":"floor-slope-or-tilt-level-or","kind":"photo","label":"Floor slope or tilt — level or ball-roll test at each room tested, wide shot of test","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":20,"item_key":"every-interior-door-tested-for-function","kind":"photo","label":"Every interior door tested for function — binding, gaps, fails to latch — photo of each affected door and frame","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":21,"item_key":"every-window-tested-for-function-binding","kind":"photo","label":"Every window tested for function — binding or fails to latch — photo of each affected window","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":22,"item_key":"flooring-separation-or-tile-cracking-especially","kind":"photo","label":"Flooring separation or tile cracking, especially near walls — wide + close","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":23,"item_key":"baseboard-or-trim-gaps-at-floor","kind":"photo","label":"Baseboard or trim gaps at floor or wall junctions","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":24,"item_key":"overview-of-the-crawlspace-from-the","kind":"photo","label":"Overview of the crawlspace from the access point","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":25,"item_key":"every-pier-tilting-settlement-cracking-or","kind":"photo","label":"Every pier — tilting, settlement, cracking, or loss of contact with the beam — wide + close of any affected pier","instructions":"One capture per occurrence.","required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":26,"item_key":"beam-and-girder-condition-rot-sagging","kind":"photo","label":"Beam and girder condition — rot, sagging, cracking — worst examples with ruler","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":27,"item_key":"joist-condition-and-spacing-deterioration-or","kind":"photo","label":"Joist condition and spacing — deterioration or damage","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":28,"item_key":"standing-water-active-moisture-or-saturated","kind":"photo","label":"Standing water, active moisture, or saturated soil in the crawlspace","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":29,"item_key":"vapor-barrier-presence-and-condition-if","kind":"photo","label":"Vapor barrier presence and condition, if installed","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":30,"item_key":"ventilation-vent-count-and-any-blocked","kind":"photo","label":"Ventilation — vent count and any blocked vents","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":31,"item_key":"wood-destroying-insect-evidence-mud-tubes","kind":"photo","label":"Wood-destroying insect evidence — mud tubes, frass, damaged wood","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":32,"item_key":"evidence-of-prior-pier-replacement-shimming","kind":"photo","label":"Evidence of prior pier replacement, shimming, or repair — tags, plates, or contractor markings","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":33,"item_key":"any-foundation-repair-company-signage-tags","kind":"photo","label":"Any foundation repair company signage, tags, or plates found on site","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":34,"item_key":"any-visible-new-cracking-or-movement","kind":"photo","label":"Any visible new cracking or movement near a previously repaired zone","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":35,"item_key":"full-perimeter-walk-anything-unusual","kind":"photo","label":"Full perimeter walk — anything unusual","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null},{"sort_order":36,"item_key":"exception-menu-cleared-for-every-non","kind":"note","label":"Exception menu cleared for every non-applicable item","instructions":null,"required":true,"unit":null,"min_value":null,"max_value":null,"min_count":null}]$items$::jsonb);
      v_why := 'a live signature whose digest is the transcription in code, by an engineer on the register';
    end if;
  end if;
  insert into eng_audit_events (action, entity_type, entity_id, summary, diff)
  values ('protocol.in_force_at_0081', 'protocol', coalesce(v_template.id::text, '254-FC-001'),
    '254-FC-001 v1.0: ' || v_outcome || ', ' || v_why,
    jsonb_build_object('document', '254-FC-001', 'version', '1.0', 'outcome', v_outcome, 'why', v_why, 'seal_act_id', v_act.id));
end;
$backfill$;
-- END GENERATED
