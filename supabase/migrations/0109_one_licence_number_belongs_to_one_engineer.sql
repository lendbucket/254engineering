/*
 * ===========================================================================
 * 0109: ONE LICENCE NUMBER BELONGS TO ONE ENGINEER. Robert's ruling Q5,
 * 2026-11-02 (audit field F5): "migration on a stage branch: unique partial
 * index on eng_profiles (license_number) where role = engineer; createAccount
 * and eng_seal_act_check refuse a duplicate."
 * ===========================================================================
 *
 * THE HOLE. Every identity check in sealing reduces to "the sealer's profile
 * is in role engineer and its license_number matches the register". The
 * number is typed by an administrator when the account is created, and
 * nothing held it unique, so a second engineer profile carrying the real
 * engineer's licence number could enrol its own factor, upload its own seal
 * image and seal letters printing his name and licence. CLAUDE.md section 1
 * says no administrator path exists to his seal, the operator's included.
 *
 * THREE LAYERS, because each catches what the one before cannot:
 *   1. createAccount refuses the duplicate with a sentence (the code).
 *   2. This index refuses it at the row, whatever writes it.
 *   3. eng_seal_act_check refuses a seal act by a sealer whose number another
 *      engineer profile also holds, so a duplicate that predates the index on
 *      some database still cannot seal.
 *
 * The comparison trims whitespace, because "123 " and "123" are one licence.
 *
 * SECTION 0 refuses to run if two engineer profiles already share a number,
 * naming only the count: a duplicate is a question for a person, and an index
 * that failed half way would say less.
 *
 * Additive: one index and a function replaced with one clause added. Nothing
 * is dropped and no row moves.
 */

/* Section 0. */
do $$
declare
  v_dupes integer;
begin
  select count(*) into v_dupes from (
    select btrim(license_number)
      from public.eng_profiles
     where role = 'engineer' and license_number is not null and btrim(license_number) <> ''
     group by btrim(license_number)
    having count(*) > 1
  ) d;
  if v_dupes > 0 then
    raise exception 'eng: 0109 found % licence number(s) held by more than one engineer profile. Resolve them before this runs.', v_dupes;
  end if;
end;
$$;

create unique index if not exists eng_profiles_engineer_license_key
  on eng_profiles (btrim(license_number))
  where role = 'engineer' and license_number is not null;

/*
 * 0097's eng_seal_act_check, carried exactly, with one clause added after the
 * role check: the sealer's licence number is his alone.
 */
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

  /* 0109: a licence number another engineer profile also holds seals nothing. */
  if exists (
    select 1
      from public.eng_profiles me
      join public.eng_profiles other
        on other.id <> me.id
       and other.role = 'engineer'
       and other.license_number is not null
       and btrim(other.license_number) = btrim(me.license_number)
     where me.id = new.sealed_by
       and me.license_number is not null
  ) then
    raise exception
      'This licence number is held by more than one engineer profile, so it seals nothing until that is resolved (0109).';
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

do $$
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'eng_profiles_engineer_license_key') then
    raise exception 'eng: 0109 expects eng_profiles_engineer_license_key to exist after it runs.';
  end if;
  if position('0109' in (select prosrc from pg_proc where proname = 'eng_seal_act_check')) = 0 then
    raise exception 'eng: 0109 expects eng_seal_act_check to carry its licence clause after it runs.';
  end if;
end;
$$;
