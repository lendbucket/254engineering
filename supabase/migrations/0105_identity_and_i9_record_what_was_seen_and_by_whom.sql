/*
 * ===========================================================================
 * 0105: IDENTITY AND I-9 VERIFICATION RECORD WHAT WAS SEEN, AND BY WHOM.
 * Robert's ruling P1, 2026-11-01 evening (finish the portal): "Identity and
 * I-9 verification restored as an administrator step on that screen: the
 * admin records 'verified', the document type seen, who and when. No copy of
 * any ID or I-9 is stored; credentials hold facts, never documents."
 * ===========================================================================
 *
 * eng_onboardings has carried identity_verified_at and i9_examined_at since
 * 0003, as timestamps with no file behind them. They answered WHEN and nothing
 * else, and since the /admin screens were deleted on 2026-09-06 nothing has
 * written them at all (BACKLOG, "Technician onboarding cannot finish").
 *
 * WHAT IT ADDS, four columns and four constraints, no table:
 *   identity_document_type  which kind of government photo ID was seen
 *   identity_verified_by    the profile who saw it
 *   i9_document_type        which I-9 list document or documents were examined
 *   i9_examined_by          the profile who examined them
 *
 * NEVER A NUMBER, NEVER A FILE. The type is a word from a fixed list. There is
 * no column for a document number, an expiry, a date of birth or an image, and
 * this migration adds none: the record is that a person was seen, which
 * document kind they showed, who looked and when.
 *
 * THE VOCABULARY IS A CHECK CONSTRAINT, so a type nobody declared cannot be
 * written. The same lists are declared in src/lib/onboarding-verification.ts
 * for the screen's words, and the P1 proof reads this file and that one and
 * fails if they disagree.
 *
 * ALL OR NOTHING, PER CHECK. A timestamp without its type and its actor is the
 * record that cannot answer an I-9 audit's question, so it is refused: either
 * all three are set or none is. Clearing a verification (a correction) clears
 * all three together.
 *
 * WHO IS A FOREIGN KEY TO eng_profiles, ON DELETE RESTRICT. A profile that
 * verified somebody is part of that record, and deleting it would leave a
 * verification nobody made.
 *
 * SECTION 0, THE READ BEFORE. The constraints are validated, so a row already
 * holding a timestamp from before 2026-09-06 would make this migration fail.
 * Run first, on each project:
 *
 *   select count(*) filter (where identity_verified_at is not null) as identity_set,
 *          count(*) filter (where i9_examined_at is not null) as i9_set
 *     from eng_onboardings;
 *
 * Both must be 0. The do block below says so in words rather than letting the
 * constraint name the failure.
 *
 * THE READ AFTER:
 *
 *   select column_name, data_type, is_nullable from information_schema.columns
 *    where table_schema = 'public' and table_name = 'eng_onboardings'
 *      and column_name in ('identity_document_type', 'identity_verified_by', 'i9_document_type', 'i9_examined_by')
 *    order by 1;
 *   select conname from pg_constraint where conrelid = 'public.eng_onboardings'::regclass
 *      and conname in ('eng_onboardings_identity_document_type_known', 'eng_onboardings_identity_verification_whole',
 *                      'eng_onboardings_i9_document_type_known', 'eng_onboardings_i9_examination_whole')
 *    order by 1;
 *
 * Four columns, all nullable; four new constraints plus the two foreign keys.
 */

do $$
begin
  if exists (select 1 from eng_onboardings where identity_verified_at is not null or i9_examined_at is not null) then
    raise exception 'eng: 0105 refuses: an onboarding already carries an identity or I-9 timestamp with no document type or verifier. Read Section 0 at the top of this file before going on.';
  end if;
end;
$$;

alter table eng_onboardings
  add column if not exists identity_document_type text,
  add column if not exists identity_verified_by uuid references eng_profiles (id) on delete restrict,
  add column if not exists i9_document_type text,
  add column if not exists i9_examined_by uuid references eng_profiles (id) on delete restrict;

alter table eng_onboardings
  add constraint eng_onboardings_identity_document_type_known check (
    identity_document_type is null or identity_document_type in (
      'drivers_license', 'state_id', 'us_passport', 'us_passport_card', 'military_id', 'permanent_resident_card', 'other_government_photo_id'
    )
  ),
  add constraint eng_onboardings_identity_verification_whole check (
    (identity_verified_at is null and identity_document_type is null and identity_verified_by is null)
    or (identity_verified_at is not null and identity_document_type is not null and identity_verified_by is not null)
  ),
  add constraint eng_onboardings_i9_document_type_known check (
    i9_document_type is null or i9_document_type in (
      'list_a_us_passport', 'list_a_permanent_resident_card', 'list_a_employment_authorization_document', 'list_a_foreign_passport',
      'lists_b_c_license_and_social_security_card', 'lists_b_c_license_and_birth_certificate', 'lists_b_c_other_combination'
    )
  ),
  add constraint eng_onboardings_i9_examination_whole check (
    (i9_examined_at is null and i9_document_type is null and i9_examined_by is null)
    or (i9_examined_at is not null and i9_document_type is not null and i9_examined_by is not null)
  );

do $$
begin
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'eng_onboardings'
         and column_name in ('identity_document_type', 'identity_verified_by', 'i9_document_type', 'i9_examined_by')) <> 4 then
    raise exception 'eng: after 0105 eng_onboardings must carry the four verification columns.';
  end if;
  if (select count(*) from pg_constraint
       where conrelid = 'public.eng_onboardings'::regclass
         and conname in ('eng_onboardings_identity_document_type_known', 'eng_onboardings_identity_verification_whole',
                         'eng_onboardings_i9_document_type_known', 'eng_onboardings_i9_examination_whole')) <> 4 then
    raise exception 'eng: after 0105 the four verification constraints must exist.';
  end if;
end;
$$;
