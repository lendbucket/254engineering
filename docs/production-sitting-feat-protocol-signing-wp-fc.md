# Production sitting: feat/protocol-signing-wp-fc (0077)

**DEVELOPMENT APPLIED 2026-10-14** by the counterpart through the connector,
in one try with no cancel, from 951d368, and read back exactly as section 3
predicts. Production is not applied; it waits for an exact board and Robert's
word. The record is in `supabase/applied.mjs`.

Staged 2026-10-14. The counterpart runs each read and the apply; the session
runs none. **0077 follows 0076**, which both
databases have (applied 2026-10-13).

`supabase/migrations/0077_every_protocol_requires_structural.sql`. It sets
`requires_discipline = 'structural'` on eight existing rows of
`eng_protocol_templates`, each found by its document's SHA-256. No DDL, no
drop statement, no insert, and no status, approver or date moves.

The value is the engineer's written answer of 2026-10-14, recorded in
`src/config/engineer-directions.ts` as `every-service-is-structural`. The
evidence is the operator's attestation of his words,
`docs/compliance/2026-10-14-operator-attestation-aman-required-discipline.txt`
(SHA-256 `0df5d9af…d08f`). His words:

> Everything we do will be under structural as we will be doing structural
> observations and structural calculations if required. We won’t be covering
> any architectural or MEP aspects in any of the services.

**WP-001 v1.1 gets no discipline**, by the operator's ruling of 2026-10-14:
v1.2 supersedes it and it will never be signed or approved. **RC-001 is not
touched**: 0056 set its discipline on 2026-09-22.

## 0. Before anything: the rows this writes, on development and on production

Read only, on each, and send back every row.

```sql
select document_number, version_label, status, requires_discipline, document_sha256,
       approved_by, published_at, updated_at
from eng_protocol_templates
where document_number in ('254-MH-001','254-SL-001','254-PL-001','254-RS-001',
                          '254-DS-001','254-WS-001','254-WP-001','254-FC-001')
order by document_number, version_label;
```

**Predict, on each:** nine rows. MH, SL, PL, RS, DS and WS at 1.1, WP-001 at
1.1 and 1.2, FC-001 at 1.0. Every `requires_discipline` null; every
`approved_by` and `published_at` null. The digests:

| Row | document_sha256 |
| --- | --- |
| 254-DS-001 1.1 | `37dd6b2e44155108df1daa681277332ddb64450a0f58813979e538da469ee22b` |
| 254-FC-001 1.0 | `264d3b5d7b6c8210ba6802d9769b36e40f867067870b90459747a96e4fefbf8d` |
| 254-MH-001 1.1 | `5c88c73d9815cfae6825ef82d4368dd66a98dce746deed91b3c351cf2df09d4a` |
| 254-PL-001 1.1 | `f1ff2e5883aac06ac1b468a74ea09535c074a468a31de4c04297bf4c74b11387` |
| 254-RS-001 1.1 | `c7913d6637f2a08b1cd09a49c1767c682895db864143005a07bba99def8c2dd2` |
| 254-SL-001 1.1 | `7bac29a7021086a7a40906021de5be9c2c2efaba747db33877410dd7b5c4e8f3` |
| 254-WP-001 1.1 | `e7515b42a3d319483c40dc2ded4d07527f8ada932410d64ad69ec9c45ccb3040` (not written) |
| 254-WP-001 1.2 | `635168e3fb2aad1c5d44db72671606eabba92b8e00667968502fa987846257c4` |
| 254-WS-001 1.1 | `f4cbe248957298bbae6d968350d3732ef3197b46684959c6ec083f494f3ed6b5` |

Status is read, not predicted: whatever each row holds, 0077 does not change
it. **Any discipline already set, any digest that differs, or a missing row is
a stop**, sent to Robert before anything else. The migration's own guard would
refuse it anyway, but the read says which row first.

## 1. Dry run, read only, on each

```sql
select md5(string_agg(sig, '|' order by sig)) as shape, count(*) as columns
from (select table_name||'.'||column_name||':'||data_type||':'||is_nullable as sig
      from information_schema.columns
      where table_schema='public' and table_name like 'eng\_%') t;
```

**Predict, on each:** `318b0fa346fc0f92167df9b9f44ce1cf` across **1206**.

## 2. Apply, development first, then production

`apply_migration` with the file as written, never `execute_sql`. It carries
no drop statement, so the connector is expected to apply it. If it answers
cancelled, it is not retried, and Robert decides.

## 3. Read back, on each

Run section 0's query again.

**Predict:** the same nine rows. The eight in the table above other than
WP-001 1.1 read `requires_discipline = structural`. **WP-001 1.1 reads null.**
Every status, digest, `approved_by` and `published_at` is exactly as section 0
read it; only `updated_at` moves on the eight, by the touch trigger. Shape
unchanged at `318b0fa346fc0f92167df9b9f44ce1cf` across 1206.

And RC-001 untouched:

```sql
select document_number, version_label, requires_discipline
from eng_protocol_templates where document_number = '254-RC-001';
```

**Predict:** unchanged from before the sitting; its v1.1 row reads structural,
from 0056.

## What this does not do

It approves nothing and signs nothing. The engineer still signs each protocol
in the portal from his own session, and approves it through
`eng_approve_protocol`, which checks his declared competence against this
value. It renders nothing: his scope statement (no architectural or MEP work
in any service) is recorded in the direction and waits on the operator's
ruling of the wording before it appears to a customer.
