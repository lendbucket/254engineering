/*
 * ===========================================================================
 * 0094  THE FIFTEEN- AND SIXTEEN-ARGUMENT SEAL DOORS REFUSE.
 * ===========================================================================
 *
 * Robert's addendum of 2026-10-25, item 9: retire the old seal doors. 0089
 * added the seventeen- and eighteen-argument eng_record_letter_seal, which
 * record the name and licence a letter prints and date the document by the
 * moment its fresh code was spent, and deliberately left 0081's fifteen and
 * 0088's sixteen as they were, so the code deployed before 0089 merged went on
 * sealing between the sitting and the deploy. 0089 merged at 3935c91 and the
 * code on main calls only the seventeen and eighteen.
 *
 * THE 0081 PATTERN: A DOOR THAT REFUSES, NOT ONE THAT IS DROPPED. Each old
 * door keeps its signature and its body becomes a refusal that says which door
 * to use, so nothing that still names it can seal a letter without the printed
 * name and licence, and nothing is dropped (the connector cancels a drop, and
 * a dropped overload changes which one a call resolves to).
 *
 * The eighteen-argument door, the one that names a letter template, stays
 * callable and unused, by item A of Robert's ruling of 2026-10-25, 23:51
 * Central.
 *
 * No table, column or grant changes. Two function bodies are replaced.
 * SECURITY INVOKER and search_path pinned, as before; EXECUTE stays revoked
 * from public, anon and authenticated (0073).
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
  raise exception 'eng: since 0089 a letter is sealed with the name and licence number it prints; this fifteen-argument door is retired (0094).';
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
  raise exception 'eng: since 0089 a letter is sealed with the name and licence number it prints; this sixteen-argument door is retired (0094).';
end;
$fn$;

revoke execute on function eng_record_letter_seal(uuid, uuid, uuid, uuid, text, text, bigint, text, text, uuid, uuid, uuid, uuid, timestamptz, text) from public, anon, authenticated;
revoke execute on function eng_record_letter_seal(uuid, uuid, uuid, uuid, text, text, bigint, text, text, uuid, uuid, uuid, uuid, timestamptz, text, uuid) from public, anon, authenticated;
