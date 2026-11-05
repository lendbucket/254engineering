/*
 * ===========================================================================
 * 0110: A SEALED FILE HAS A LIVE SEAL ACT. Robert's ruling Q6, 2026-11-02
 * (audit field F10): "a trigger refuses sealed or delivered on eng_files
 * without a live seal act (stage branch)."
 * ===========================================================================
 *
 * THE HOLE. canTransition asks documents.seal for under_review to sealed and
 * documents.deliver for sealed to delivered, and the engineer holds both. The
 * generic transition on the Files screen could therefore walk a file to
 * sealed and then delivered with no document behind it: the customer's page
 * said delivered with nothing to download, and the order was never settled.
 * Nothing in the database tied eng_files.status = 'sealed' to a seal act (0053
 * checks only open repair items). Q4 widened the same door from refused, for
 * the foundation decline letter.
 *
 * THE RULE. A file may be MOVED to sealed or delivered, or have sealed_at SET,
 * only while a letter seal act that is not voided exists for a determination
 * on that file. The one path that does this in the product,
 * deliverSealedFile in src/lib/letter-seal.ts, runs after
 * eng_record_letter_seal has recorded the act in its own transaction, so the
 * act is there first; that includes the foundation decline letter (refused to
 * sealed) and a document the engineer sealed himself (sealOwnDocument records
 * a letter act for the determination too).
 *
 * WHAT IT DOES NOT DO. A file already sealed or delivered is not touched when
 * some other column changes, and a letter voided after delivery does not
 * reopen a delivered file: the trigger asks only at the moment of the move,
 * which is the moment the claim is made. A move to delivered after a void,
 * with no replacement sealed, is refused, because there is then nothing live
 * to deliver.
 *
 * Additive: one function and one trigger. Nothing is dropped and no row moves.
 */
create or replace function eng_file_sealed_needs_a_seal_act()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  v_moving boolean;
begin
  if tg_op = 'INSERT' then
    v_moving := new.status in ('sealed', 'delivered') or new.sealed_at is not null;
  else
    v_moving := (new.status in ('sealed', 'delivered') and new.status is distinct from old.status)
             or (new.sealed_at is not null and old.sealed_at is null);
  end if;
  if not v_moving then
    return new;
  end if;

  if not exists (
    select 1
      from public.eng_seal_acts a
      join public.eng_determinations d on d.id = a.determination_id
     where d.file_id = new.id
       and a.kind = 'letter'
       and a.voided_at is null
  ) then
    raise exception
      'eng: file % cannot be marked % without a live sealed letter for it. A file is sealed by sealing its letter, never by moving its status (0110).',
      new.id, case when new.status in ('sealed', 'delivered') then new.status else 'sealed' end;
  end if;
  return new;
end;
$fn$;

/* A trigger function nobody calls directly: EXECUTE revoked, as 0097 does for the seal act's. */
revoke execute on function eng_file_sealed_needs_a_seal_act() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'eng_files_sealed_needs_a_seal_act' and not tgisinternal) then
    create trigger eng_files_sealed_needs_a_seal_act
      before insert or update of status, sealed_at on eng_files
      for each row execute function eng_file_sealed_needs_a_seal_act();
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'eng_files_sealed_needs_a_seal_act' and not tgisinternal) then
    raise exception 'eng: 0110 expects the trigger eng_files_sealed_needs_a_seal_act to exist after it runs.';
  end if;
  if not exists (select 1 from pg_proc where proname = 'eng_file_sealed_needs_a_seal_act') then
    raise exception 'eng: 0110 expects the function eng_file_sealed_needs_a_seal_act to exist after it runs.';
  end if;
end;
$$;
