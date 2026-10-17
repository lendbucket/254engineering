# Sitting: 0078, an intake answer can be a stored file

Branch `migration/intake-photo-0078`. Written 2026-10-16 in an unattended run.
Applied to development 2026-10-16 at 07:06:21 UTC (version 20261016070621) and
to production 2026-10-17 at 02:36:34 UTC (version 20261017023634), both read
back by the operator's chat counterpart. The ledger entry in
`supabase/applied.mjs` carries both read backs.

## Why

The firm could not open a 254-RC-001 job by telephone. The signed protocol
requires "Photo of the front of the property (confirms address/structure)" at
its Required tier, so the field is required at order. The intake screen and
`takeJob` both refuse an order-stage gap, and the screen gave no way to attach
a document. The first real roof job, 2026-10-17, is taken this way.

0078 gives `eng_file_inputs` the four columns `eng_order_inputs` already has
(`bucket`, `storage_key`, `content_type`, `byte_size`), plus one check that a
stored file names its bucket and its key together. Additive only: no drop, so
the connector is expected to apply it.

## Predicted figures

From `scripts/fingerprint-at.mjs`, with 0077 reproducing its recorded pair first:

| | Shape | Columns | Behaviour | Facts |
| --- | --- | --- | --- | --- |
| at 0077 | `318b0fa346fc0f92167df9b9f44ce1cf` | 1206 | `f2380dab0f83023419bc357dfd80f042` | 1019 |
| at 0078 | `4ccff0ee13040992a71d16d2b14163a3` | 1210 | `92e4ca15c2ec0c69e075abf7f80d6fe9` | 1020 |

A live read-back is judged on the counts and the shape digest, never on the
behaviour digest (CLAUDE.md section 6b).

## Section 0: read first, on each database

```sql
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'eng_file_inputs'
   and column_name in ('bucket', 'storage_key', 'content_type', 'byte_size');
-- Expect: zero rows.

select md5(string_agg(sig, '|' order by sig)), count(*)
from (select table_name||'.'||column_name||':'||data_type||':'||is_nullable as sig
      from information_schema.columns
      where table_schema='public' and table_name like 'eng\_%') t;
-- Expect: 318b0fa346fc0f92167df9b9f44ce1cf, 1206.
```

## Section 1: development

`apply_migration` against `ythzaiqeoijlrdibnieo` with the file
`supabase/migrations/0078_an_intake_answer_can_be_a_stored_file.sql`, name
`0078_an_intake_answer_can_be_a_stored_file`.

## Section 2: production, only after development reads back

`apply_migration` against `fsaryeciduszuahgjbly`, the same file and name.

## Section 3: read back, its own statements, on each database

```sql
select column_name, data_type, is_nullable from information_schema.columns
 where table_schema = 'public' and table_name = 'eng_file_inputs'
   and column_name in ('bucket', 'storage_key', 'content_type', 'byte_size')
 order by column_name;
-- Expect four rows: bucket text YES, byte_size bigint YES, content_type text YES, storage_key text YES.

select conname from pg_constraint where conname = 'eng_file_inputs_stored_file_whole_ck';
-- Expect one row.

-- the shape query from section 0. Expect: 4ccff0ee13040992a71d16d2b14163a3, 1210.
```

## After

Record both dates in `supabase/applied.mjs`, then the branch is boarded and
merges. It is based on `feat/no-charge-is-admin-and-mfa`, which merges first.
