/*
 * ===========================================================================
 * 0067  A TECHNICIAN HAS AT MOST ONE PENDING CREDENTIAL OF EACH KIND.
 * ===========================================================================
 *
 * A defect from the product audit's brute force, 2026-10-09, reproduced twice:
 * the same credential submitted from two tabs at once wrote TWO pending rows.
 * submitCredential (src/lib/ops-credential-submissions.ts) reads for a pending
 * row of that kind and inserts when it finds none, and two requests in flight
 * together both find none. The operator's queue then shows the same submission
 * twice, and verifying one leaves the other waiting for ever.
 *
 * A read before a write cannot close that; only the database can. This adds a
 * unique partial index on (profile_id, kind) where status = 'pending', so the
 * second insert fails with a unique violation, which the code turns into the
 * sentence the first read already gives: one of this kind is already waiting.
 * Verified, rejected and expired rows are untouched by the index, so a
 * technician's history keeps every earlier submission.
 *
 * IT REFUSES RATHER THAN DECIDES. If two pending rows of one kind already exist
 * for anybody, creating the index would fail; this raises first and names how
 * many, and removes nothing. Which of two waiting rows is the real one is a
 * person's decision, not a migration's.
 *
 * ADDITIVE ONLY: one index. No column, no table, no row rewritten, so the shape
 * fingerprint does not move. Applying it twice changes nothing.
 */

do $$
declare
  dupes integer;
begin
  select count(*) into dupes
  from (
    select profile_id, kind
    from eng_credentials
    where status = 'pending'
    group by profile_id, kind
    having count(*) > 1
  ) d;
  if dupes > 0 then
    raise exception
      'eng: % technician and kind pair(s) already hold more than one pending credential. Decide which row stands before applying 0067; nothing was changed.',
      dupes;
  end if;
end;
$$;

create unique index if not exists eng_credentials_one_pending_per_kind
  on eng_credentials (profile_id, kind)
  where status = 'pending';

comment on index eng_credentials_one_pending_per_kind is
  'At most one pending credential per technician and kind (0067, 2026-10-09). Two submissions in flight together both passed the read-then-insert check; the second now fails here.';
