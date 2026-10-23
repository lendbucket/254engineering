# Sitting: 0080, the engineer's signed source documents go private

Branch `fix/protocol-sources`. Written 2026-10-22. **Applied nowhere yet,
including development.** Robert's chat counterpart applies it to development
from this document; the session then uploads the three originals there, removes
them from the tree, and boards the branch on development, held for the
production sitting. Production is Section 5 and is not run until that board has
matched its prediction and Robert says so.

## Why

Operator rulings of 2026-10-22. The repository is public, and three tracked
files carry what the TBPELS register does not publish:

- `docs/254-RC-001-roof-certification-protocol-v1.0.pdf` and `-v1.1.pdf`: Aman
  Dhakal's handwritten signature, an embedded image on page 11;
- `docs/protocols/incoming/v1.1/254_Letter_Templates.docx`: "Texas P.E. No.
  143295" beside his name, six times.

0080 adds one private storage bucket, `eng-protocol-sources`, PDF and Word,
25 MB. The originals go into it on **development only**. The repository keeps
each one's path, storage key, SHA-256 and size
(`src/content/protocols/private-sources.ts`), and protocol-registry-audit and
the roof letter proof fetch each into place and refuse unless both figures
match. On production the bucket is created and **stays empty**: the chain must
describe every bucket the code names (0060).

**Additive only.** One row in `storage.buckets`. No table, column or grant.

## Predicted figures

From `scripts/fingerprint-at.mjs`, with 0079 reproducing its recorded pair first:

| | Shape | Columns | Behaviour | Facts |
| --- | --- | --- | --- | --- |
| at 0079 | `45ce47821d9c5567eb3b4b197549d881` | 1263 | `8f0fe1b5eb8a6b5588e0ae9e3ae5017c` | 1152 |
| at 0080 | `45ce47821d9c5567eb3b4b197549d881` | 1263 | `8f0fe1b5eb8a6b5588e0ae9e3ae5017c` | 1152 |

Neither moves: a bucket is a row in `storage.buckets`, which neither fingerprint
reads. A live read back is judged on the counts and the shape digest, never on
the behaviour digest (CLAUDE.md section 6b).

## Section 0: read first, on the database about to be changed

```sql
select md5(string_agg(sig, '|' order by sig)), count(*)
from (select table_name||'.'||column_name||':'||data_type||':'||is_nullable as sig
      from information_schema.columns
      where table_schema='public' and table_name like 'eng\_%') t;
-- Expect: 45ce47821d9c5567eb3b4b197549d881, 1263.

select id from storage.buckets where id = 'eng-protocol-sources';
-- Expect: zero rows.

select count(*) from storage.buckets where public;
-- Expect: write down the number; Section 2 expects the same number.
```

If any answer differs, stop and send it back: the database is not where this
document thinks it is.

## Section 1: development

`apply_migration` against `ythzaiqeoijlrdibnieo` with the file
`supabase/migrations/0080_protocol_sources_are_private.sql`, name
`0080_protocol_sources_are_private`.

## Section 2: read back on development, each its own statement

```sql
-- the shape query from section 0. Expect: 45ce47821d9c5567eb3b4b197549d881, 1263.

select id, name, public, file_size_limit, allowed_mime_types
  from storage.buckets where id = 'eng-protocol-sources';
-- Expect one row:
--   eng-protocol-sources | eng-protocol-sources | false | 26214400 |
--   {application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document}

select count(*) from storage.buckets where public;
-- Expect: the same number as section 0. Nothing became public.

select count(*) from storage.objects where bucket_id = 'eng-protocol-sources';
-- Expect: 0.
```

Send the answers back. The session records them in `supabase/applied.mjs`
under `development`.

## Section 3: the session, on development, after Section 2 is read back

1. `npx tsx scripts/protocol-sources-upload.mjs`: each of the three files is
   checked against its declared SHA-256 and size, uploaded with overwrite off,
   downloaded again and checked again. Expect three PASS lines.
2. The three files are removed from the tree (they are already gitignored, so a
   fetched copy can never come back by accident), and protocol-registry-audit
   and the roof letter proof are run standalone from a checkout without them,
   proving the fetch.
3. The reference text files for the protocol PDFs are committed (ruling 4).
4. The branch is boarded on development, alone, with its prediction stated
   first.

Read back for the counterpart afterwards, if wanted:

```sql
select name, metadata->>'size' as bytes
  from storage.objects where bucket_id = 'eng-protocol-sources' order by name;
-- Expect three rows:
--   254-RC-001/v1.0/254-RC-001-roof-certification-protocol-v1.0.pdf | 129862
--   254-RC-001/v1.1/254-RC-001-roof-certification-protocol-v1.1.pdf | 130239
--   letter-templates/v1.1/254_Letter_Templates.docx                 | 49147
```

## Section 4: after the development board

The branch is held. It merges only inside the chat's production sitting, after
the production apply below is read back, because a migration on main is never
pending.

## Section 5: production, only in that sitting

Section 0's three queries against `fsaryeciduszuahgjbly`, with the same
expectations. Then `apply_migration` against `fsaryeciduszuahgjbly` with the
same file and name, then Section 2's four statements against production, with
the same expectations: the bucket exists, private, and holds **zero** objects.
Nothing is uploaded to production.

The session then records `production` in `supabase/applied.mjs` with the date
and the provider version, and merges the branch with the exact main command.

## What this does not do

It does not rewrite history. The files remain in earlier commits on the remote;
`docs/history-rewrite-proposal-2026-10-22.md` is what that would take, held for
Robert's decision.
