# Production sitting: feat/partner-branding-upload (0072)

Staged 2026-10-10 in the weekend run. Nothing here has been run. The
counterpart runs each step; the session runs none. **0072 follows 0071**: apply
0068, 0069, 0070 and 0071 first.

`supabase/migrations/0072_a_partner_logo_is_approved_before_it_shows.sql`.
Additive: five columns on `eng_partners` (`brand_logo_key`,
`brand_logo_status` default `none`, `brand_logo_uploaded_at`,
`brand_logo_decided_by`, `brand_logo_decided_at`), three check constraints, and
the private bucket `eng-partner-branding` (1 MB, PNG, JPEG and WebP). Every
existing partner reads `none`. Run item 19: a partner uploads a logo, the
operator approves it, and only an approved logo is served.

## 1. Dry run, read only

```sql
select count(*) filter (where column_name like 'brand_logo_%') as logo_columns
from information_schema.columns
where table_schema = 'public' and table_name = 'eng_partners';

select id from storage.buckets where id = 'eng-partner-branding';

select count(*) as partners from eng_partners;
```

**Predict:** `logo_columns` 0; no bucket row; `partners` whatever production
holds (the default fills every one with `none`).

## 2. Apply, development first, then production

`apply_migration` with the file as written. Never `execute_sql`. It adds
columns and a bucket and drops nothing, so the MCP should not cancel it; if it
does, stop and report rather than retrying.

## 3. Read back, on each

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'eng_partners' and column_name like 'brand_logo_%'
order by column_name;

select conname from pg_constraint where conname like 'eng_partners_brand_logo_%' order by conname;

select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'eng-partner-branding';

select brand_logo_status, count(*) from eng_partners group by 1;
```

**Predict:** five columns, `brand_logo_status` not null with default `'none'`;
three constraints (`_decision_agrees`, `_file_agrees`, `_status_known`); the
bucket `public` false, `file_size_limit` 1048576, types png, jpeg, webp; every
partner `none`.

The shape fingerprint moves from `bc55a14f40a4c7a78cc061fd262e785b` across 1176
columns to **`3cffb39b56eda13ab54bbe8823b4c26d` across 1181**, 84 tables.
Behaviour facts go from 979 to 983 on a replay; judge a live read-back on the
counts, per CLAUDE.md 6b.
