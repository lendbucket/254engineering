# Production sitting: feat/wp-001-v1-2-and-fc-001 (0069)

Staged 2026-10-10 in the weekend run. Nothing here has been run. The
counterpart runs each step; the session runs none. **0069 follows 0068**
(`docs/production-sitting-fix-review-and-credit-one-write.md`): apply 0068
first, on both databases, then this.

`supabase/migrations/0069_wp001_v1_2_and_fc001_enter_as_drafts.sql`. Additive:
two rows in `eng_protocol_templates`, each a **draft** (unsigned, no approver,
no publication date), each carrying its Word file's SHA-256 as the document
digest. The .docx is the source of record (operator ruling, 2026-10-10).

| Document | Version | Line | Issue date | sha256 of the .docx |
| --- | --- | --- | --- | --- |
| 254-WP-001 | 1.2 | windstorm-wpi-8 (ongoing) | 2026-10-09 | `635168e3fb2aad1c5d44db72671606eabba92b8e00667968502fa987846257c4` |
| 254-FC-001 | 1.0 | foundation-inspections | 2026-09-29 | `264d3b5d7b6c8210ba6802d9769b36e40f867067870b90459747a96e4fefbf8d` |

Both hashes were confirmed on disk on 2026-10-10 against the copies the
counterpart took from the engineer's email.

## 1. Dry run, read only, on each project

```sql
select document_number, version_label, version, status, document_sha256
from eng_protocol_templates
where document_number in ('254-WP-001', '254-FC-001')
order by document_number, version;

select service_slug, max(version) as highest
from eng_protocol_templates
where service_slug in ('windstorm-wpi-8', 'foundation-inspections')
group by service_slug;
```

**Predict, production:** 254-WP-001 v1.1 only, draft, digest
`e7515b42…3040` (from 0065); no 254-FC-001 row. `windstorm-wpi-8` highest
version 2 (WP-001 v1.1 is 1, WS-001 v1.1 is 2, per the 0065 read-back);
`foundation-inspections` has whatever it holds today, which the read says. If
any row already records WP-001 v1.2 or FC-001 v1.0, **stop**: the migration
refuses a different digest, and a same-digest row means it was applied already.

## 2. Apply, development first, then production

`apply_migration` with the file as written. Never `execute_sql`.

## 3. Read back, on each

```sql
select document_number, version_label, version, status, document_sha256,
       firm_name_on_document, approved_by, published_at, document_signed_at
from eng_protocol_templates
where (document_number = '254-WP-001' and version_label = '1.2')
   or (document_number = '254-FC-001' and version_label = '1.0');
```

**Predict:** two rows. Both `draft`, `firm_name_on_document` 254 Engineering
Services, `approved_by`, `published_at` and `document_signed_at` all null, and
each digest as tabled above. WP-001 v1.2's `version` is one above windstorm's
highest before the apply (3 on production if that read said 2); FC-001's is one
above foundation's highest (1 if the line held none).

The shape fingerprint does **not** move, and neither does the behaviour
count: two rows are neither columns nor schema facts.
`18826fa5b3e7d9c9979ca81b96666bb7` across 1171 columns, before and after.

## 4. After the apply

The session records the apply in `supabase/applied.mjs` when the counterpart
reports it. This branch sits on `fix/review-and-credit-one-write` and merges
after it.
