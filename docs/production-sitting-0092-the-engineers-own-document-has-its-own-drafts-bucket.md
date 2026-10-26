# Sitting: 0092, the engineer's own document has its own drafts bucket

Written 2026-10-26 on `feat/repair-spec-own-document`, which sits on 0091 and therefore on 0090, because the chain is in order. The chat applies it with `apply_migration`, development first, then production, each after 0090 and 0091. The branch merges only after the production apply is read back, and a migration on main is never pending.

## Why

Robert's ruling of 2026-10-25, 23:51 Central, item C. A repair specification is the engineer's own document:
1. he uploads his PDF;
2. he previews it;
3. he seals it from his session with a fresh code;
4. the platform adds the seal block, the firm's name and F-29811, hashes it, records the seal act, and delivers it as it delivers a letter.

The unsealed upload needs a private home, and it is not `eng-documents`, which is the sealed deliverable store (0061). The controls are mapped in `docs/sealing-controls.md`, rows 12 to 17.

## What changes

One row in `storage.buckets`, `eng-engineer-drafts`: private, PDF only, 25 MB. No table, column, function or grant.

## Predicted figures

Both digests are unchanged from 0091, because neither reads `storage.buckets`:

| | Shape | Columns | Behaviour | Facts |
| --- | --- | --- | --- | --- |
| at 0091 | `8daaba436e02fb92c9a6b227fcb98caf` | 1353 | `92e2d140a1aefe8192833d9809b7d428` | 1281 |
| at 0092 | `8daaba436e02fb92c9a6b227fcb98caf` | 1353 | `92e2d140a1aefe8192833d9809b7d428` | 1281 |

Read the bucket back, never a digest.

## Section 0: read first

```sql
-- the shape query. Expect: 8daaba436e02fb92c9a6b227fcb98caf, 1353 (0091 applied).

select id from storage.buckets where id = 'eng-engineer-drafts';
-- Expect: no rows.
```

## Section 1: apply

`apply_migration` with the file `supabase/migrations/0092_the_engineers_own_document_has_its_own_drafts_bucket.sql`, name `0092_the_engineers_own_document_has_its_own_drafts_bucket`.

## Section 2: read back, each its own statement

```sql
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'eng-engineer-drafts';
-- Expect one row: public false, 26214400, {application/pdf}.

-- the shape query. Expect: 8daaba436e02fb92c9a6b227fcb98caf, 1353, unchanged.

select count(*) from storage.objects where bucket_id = 'eng-engineer-drafts';
-- Expect: 0.
```

**A difference in any answer is a stop.** Report it on issue #1 and do nothing further. `scripts/proofs/the-engineers-own-document-is-sealed-as-he-previewed-it.mjs` proves the rest:
- the stamp adds one page and draws nothing on his;
- the preview carries no image;
- sealing compares what he previewed before the code is spent;
- the act names no template;
- nothing but the sealing module names this bucket.

## What this does not do

- It seals nothing and stores nothing.
- It opens no line and touches no row.
- The code that uses it ships on the same branch, which merges only after this apply is read back from production.
