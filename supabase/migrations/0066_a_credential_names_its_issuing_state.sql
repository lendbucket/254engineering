/*
 * ===========================================================================
 * 0066  A CREDENTIAL NAMES THE STATE THAT ISSUED IT.
 * ===========================================================================
 *
 * Operator ruling of 2026-10-09, fix/certification-unblock: a technician
 * submits each required credential with its type, its issuing state and its
 * expiry date, and nothing else. No number, no image, no document; the standing
 * rule is that a credential is a record, never a document.
 *
 * eng_credentials has carried the type (kind), the expiry (expires_on), the
 * review state (status pending, verified, rejected, expired), who verified it
 * and when (verified_by, verified_at) and why it was turned away (reject_reason)
 * since 0001. The one fact the ruling asks for that it cannot hold is the
 * issuing state, so this adds that column and nothing else.
 *
 * Nullable, because every credential row written before today has no state
 * recorded and none may be invented for it. A value, when present, is a two
 * letter postal code in capitals; the platform writes it from a fixed list, and
 * the constraint refuses anything else at the database.
 *
 * ADDITIVE ONLY: one column, one check. It removes nothing and rewrites no row.
 * Applying it twice changes nothing.
 */

alter table eng_credentials
  add column if not exists issuing_state text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'eng_credentials_issuing_state_check'
      and conrelid = 'eng_credentials'::regclass
  ) then
    alter table eng_credentials
      add constraint eng_credentials_issuing_state_check
      check (issuing_state is null or issuing_state ~ '^[A-Z]{2}$');
  end if;
end $$;

comment on column eng_credentials.issuing_state is
  'The state that issued the credential, as a two letter postal code. Typed by the technician at submission, confirmed by the operator who verifies it. Null on rows written before 2026-10-09.';
