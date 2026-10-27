/*
 * ===========================================================================
 * 0091  THE MANUFACTURED HOME, SOLAR AND WPI-8E LETTERS NO LONGER NEED A
 *       SIGNED TEMPLATE. HIS SEAL ON EACH LETTER IS HIS ADOPTION OF IT.
 * ===========================================================================
 *
 * Robert's ruling of 2026-10-25, 23:51 Central, item A: the engineer signs no
 * templates. His seal on each live letter, after reading its full preview, is
 * his adoption of that letter. eng_seal_act_check stops requiring a letter
 * template for 254-MH-001, 254-SL-001 and 254-WS-001, so their letters seal
 * through the seventeen and eighteen argument doors (0089) exactly as roof,
 * foundation and permit letters do.
 *
 * WHAT CHANGES, AND ONLY THIS. One clause of 0088's eng_seal_act_check. It
 * required a live template signature on every letter for the three; it now
 * requires nothing of a letter that names no template. Every other clause is
 * 0088's, word for word.
 *
 * WHAT IS KEPT, AND WHY. Nothing is dropped. The letter_template kind, its
 * columns, its shape check, the one-live-template index, the template
 * signature door and the template overload of eng_record_letter_seal all
 * stay, callable and unused. Two template rules stay in this check, because
 * loosening a requirement is not loosening the integrity of what is named:
 *   - a letter for one of the three that DOES name a template still names a
 *     live template signature for its own protocol;
 *   - any other letter still names no template.
 *
 * Shape unchanged: no column, table, index, trigger or grant is added or
 * removed. One function body is replaced. SECURITY INVOKER and search_path
 * pinned as 0088 had it. RLS unchanged.
 */

create or replace function eng_seal_act_check()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  v_ok boolean;
  v_protocol text;
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

  return new;
end;
$fn$;

revoke execute on function eng_seal_act_check() from public, anon, authenticated;
