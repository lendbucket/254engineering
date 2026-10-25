/*
 * ===========================================================================
 * 0089  A SEAL ACT RECORDS THE NAME AND LICENCE IT PRINTS, AND A LETTER IS
 *       DATED BY THE ONE MOMENT IT WAS SEALED.
 * ===========================================================================
 *
 * Robert's answers of 2026-10-25 on the letter claims of his audit of
 * 2026-10-24. Aman's wording is untouched; these are records.
 *
 * L2e: "the seal act records the printed name and licence number. Records
 * only, never a public page." A sealed letter prints the engineer's name and
 * Texas licence number from the firm's register in code; the seal act, the row
 * the regulatory record rests on, recorded neither, so what a letter printed
 * could be answered only by opening the PDF.
 *
 * L2j: "the printed date is the sealing moment in America/Chicago." The letter
 * prints the date of the act's own mfa_verified_at, the instant his fresh code
 * was spent, in America/Chicago (letterDate). The document's sealed_at was the
 * database's now() inside the seal door, a few seconds later, so the two could
 * fall either side of midnight in Texas. The door now writes sealed_at as that
 * same instant, so the printed date and the record are one moment.
 *
 * WHAT THIS DOES
 *   1. eng_seal_acts gains printed_name and printed_license, both or neither,
 *      never blank. Acts sealed before 0089 hold neither, which is the truth:
 *      nothing recorded them.
 *   2. eng_seal_act_guard (0088's, word for word) adds the two columns to what
 *      can never change.
 *   3. eng_record_letter_seal gains a SEVENTEEN-argument overload (0081's
 *      fifteen, plus the two) and an EIGHTEEN-argument one (0088's sixteen,
 *      plus the two). Each refuses a blank name or licence and a licence that
 *      is not the sealing engineer's own (eng_profiles.license_number), and
 *      writes the document's sealed_at as p_mfa_verified_at.
 *
 * WHAT THIS DOES NOT DO. The fifteen- and sixteen-argument doors are left
 * exactly as 0081 and 0088 wrote them, so the code deployed before this
 * branch merges goes on sealing between the sitting and the deploy: no cutover
 * gap. Retiring them is a later migration, after the deploy, by the 0081
 * pattern (a door that refuses rather than one that is dropped).
 *
 * No drop statement. Additive: two nullable columns, a check that old rows
 * satisfy, a guard replaced with two more clauses, two new functions.
 */

-- 1. The two records, both or neither, never blank.
alter table eng_seal_acts
  add column if not exists printed_name text,
  add column if not exists printed_license text;

alter table eng_seal_acts
  drop constraint if exists eng_seal_acts_printed_ck;
alter table eng_seal_acts
  add constraint eng_seal_acts_printed_ck check (
    (printed_name is null) = (printed_license is null)
    and (printed_name is null or length(btrim(printed_name)) > 0)
    and (printed_license is null or printed_license ~ '^[0-9]+$')
    and (printed_name is null or kind = 'letter')
  );

comment on column eng_seal_acts.printed_name is
  'The engineer''s name exactly as the sealed letter prints it, from the firm''s register (0089). Null on acts sealed before 0089 and on protocol and template acts.';
comment on column eng_seal_acts.printed_license is
  'The Texas licence number exactly as the sealed letter prints it (0089). Null on acts sealed before 0089 and on protocol and template acts.';

-- 2. 0088's guard, with the two printed columns among what can never change.
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
     or new.printed_license is distinct from old.printed_license then
    raise exception
      'A seal act records what was sealed. Only voided_at, voided_by and voided_because may be set, once.';
  end if;
  return new;
end;
$fn$;

-- 3a. 0081's fifteen-argument door, with the printed name and licence, and one sealing moment.
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
  p_letterhead_sha256   text,
  p_printed_name        text,
  p_printed_license     text
)
returns void
language plpgsql
set search_path = ''
as $fn$
begin
  if p_printed_name is null or length(btrim(p_printed_name)) = 0
     or p_printed_license is null or length(btrim(p_printed_license)) = 0 then
    raise exception 'eng: since 0089 a letter is sealed with the name and licence number it prints.';
  end if;
  if not exists (
    select 1 from public.eng_profiles
     where id = p_sealed_by and license_number = p_printed_license
  ) then
    raise exception 'eng: the licence number a letter prints is the sealing engineer''s own.';
  end if;

  insert into public.eng_documents
    (id, file_id, client_id, kind, title, bucket, storage_key, content_type, byte_size,
     sealed_at, sealed_by, uploaded_by, visibility, firm_registration)
  values
    (p_document_id, p_file_id, p_client_id, 'deliverable', p_title, 'eng-documents', p_storage_key,
     'application/pdf', p_byte_size, p_mfa_verified_at, p_sealed_by, p_sealed_by, 'client', p_firm_registration);

  insert into public.eng_seal_acts
    (id, kind, document_id, determination_id, content_sha256,
     seal_image_id, signature_image_id, sealed_by, mfa_verified_at, letterhead_sha256,
     printed_name, printed_license)
  values
    (p_seal_act_id, 'letter', p_document_id, p_determination_id, p_sha256,
     p_seal_image_id, p_signature_image_id, p_sealed_by, p_mfa_verified_at, p_letterhead_sha256,
     btrim(p_printed_name), btrim(p_printed_license));
end;
$fn$;

-- 3b. 0088's sixteen-argument door (a letter sealed from a signed template), with the same two and one moment.
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
  p_letter_template_act_id  uuid,
  p_printed_name            text,
  p_printed_license         text
)
returns void
language plpgsql
set search_path = ''
as $fn$
begin
  if p_printed_name is null or length(btrim(p_printed_name)) = 0
     or p_printed_license is null or length(btrim(p_printed_license)) = 0 then
    raise exception 'eng: since 0089 a letter is sealed with the name and licence number it prints.';
  end if;
  if not exists (
    select 1 from public.eng_profiles
     where id = p_sealed_by and license_number = p_printed_license
  ) then
    raise exception 'eng: the licence number a letter prints is the sealing engineer''s own.';
  end if;

  insert into public.eng_documents
    (id, file_id, client_id, kind, title, bucket, storage_key, content_type, byte_size,
     sealed_at, sealed_by, uploaded_by, visibility, firm_registration)
  values
    (p_document_id, p_file_id, p_client_id, 'deliverable', p_title, 'eng-documents', p_storage_key,
     'application/pdf', p_byte_size, p_mfa_verified_at, p_sealed_by, p_sealed_by, 'client', p_firm_registration);

  insert into public.eng_seal_acts
    (id, kind, document_id, determination_id, content_sha256,
     seal_image_id, signature_image_id, sealed_by, mfa_verified_at, letterhead_sha256, letter_template_act_id,
     printed_name, printed_license)
  values
    (p_seal_act_id, 'letter', p_document_id, p_determination_id, p_sha256,
     p_seal_image_id, p_signature_image_id, p_sealed_by, p_mfa_verified_at, p_letterhead_sha256, p_letter_template_act_id,
     btrim(p_printed_name), btrim(p_printed_license));
end;
$fn$;

/* 0073's rule for every function added or replaced here (not 0081's or 0088's doors), and asserted for the whole schema. */
do $$
declare
  f record;
  open_fns text;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname = 'eng_seal_act_guard'
           or (p.proname = 'eng_record_letter_seal' and p.pronargs in (17, 18)))
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
    raise exception 'eng: after 0089 these are still executable by anon or authenticated: %', open_fns;
  end if;
end;
$$;
