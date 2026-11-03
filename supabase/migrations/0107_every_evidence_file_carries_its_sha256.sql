/*
 * ===========================================================================
 * 0107: EVERY EVIDENCE FILE CARRIES ITS SHA-256. Robert's ruling P5,
 * 2026-11-01 evening: "store a SHA-256 of every evidence file at upload
 * (migration, development first) and add the 'no duplicate photos' check to
 * the engineer's queue once every item in a job has a hash. Items captured
 * before the migration show 'not checked', never a pass."
 * ===========================================================================
 *
 * ONE COLUMN, NULLABLE ON PURPOSE. Every row captured before this migration
 * has no hash and never will: the platform does not go back and fingerprint
 * old evidence, because a hash computed today describes the object as it is
 * today, not as it was submitted. Null is therefore a fact, "not checked",
 * and the engineer's screen says so rather than counting it as a pass.
 *
 * WRITTEN BY THE SERVER, FROM THE STORED OBJECT. recordCapture reads the file
 * back out of the private eng-evidence bucket and hashes the bytes there. A
 * hash the phone sent would be the technician's claim about the file, and the
 * check exists to catch the same photograph submitted twice, so it cannot rest
 * on the submitter's word.
 *
 * The check constraint holds the shape to 64 lowercase hex characters, so a
 * hash written in another case, or truncated, is refused rather than compared
 * as a different value. The index serves the per-file duplicate read.
 *
 * No table, no sequence, so no revoke. No row moves. The shape gains one
 * column.
 */
alter table eng_evidence_items
  add column if not exists content_sha256 text;

/* Added only when absent, so a re-run is a no-op and nothing is dropped. */
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'eng_evidence_items_sha256_shape_ck') then
    alter table eng_evidence_items
      add constraint eng_evidence_items_sha256_shape_ck
      check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$');
  end if;
end;
$$;

create index if not exists eng_evidence_file_sha256_idx
  on eng_evidence_items (file_id, content_sha256)
  where content_sha256 is not null;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'eng_evidence_items' and column_name = 'content_sha256'
  ) then
    raise exception 'eng: 0107 expects eng_evidence_items.content_sha256 to exist after it runs.';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eng_evidence_items_sha256_shape_ck') then
    raise exception 'eng: 0107 expects the sha256 shape check to exist after it runs.';
  end if;
end;
$$;
