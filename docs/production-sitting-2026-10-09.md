# Sitting of 2026-10-09: migration 0066, and one read

Written by the session on `fix/certification-unblock` and applied NOWHERE. The
operator's chat counterpart runs every step; the session runs none.

## 1. Apply 0066 to development, then to production

`supabase/migrations/0066_a_credential_names_its_issuing_state.sql`, through
the connector's `apply_migration`, the file as written. It is additive only: one
nullable column, `eng_credentials.issuing_state`, and one check constraint that
holds it to a two letter capital code. It rewrites no row, and applying it twice
changes nothing.

Why: the operator's ruling on `/portal/certification` has a technician submit
each credential with its type, its issuing state and its expiry date.
`eng_credentials` already holds the type, the expiry, the review state, who
verified and when, and a rejection reason; the issuing state is the one fact it
cannot hold.

## 2. Read back, on each database, after applying

**a. The column.**

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'eng_credentials'
  and column_name = 'issuing_state';
```

Prediction: exactly one row, `issuing_state | text | YES`.

**b. The constraint.**

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conname = 'eng_credentials_issuing_state_check';
```

Prediction: exactly one row, a CHECK that `issuing_state` is null or matches
`^[A-Z]{2}$`.

**c. No row was given a value.**

```sql
select count(*) from eng_credentials where issuing_state is not null;
```

Prediction: `0`.

**d. The shape fingerprint** (the query in CLAUDE.md section 6b).

Prediction: `18826fa5b3e7d9c9979ca81b96666bb7` across **1171** columns, on both
databases. Before the apply both read `aff578e18d558ee5af26fb2cb8c9eb88` across
1170 (the ledger's figure at 0065). The behaviour digest is not predicted for a
live project, by the standing rule; the replay's is
`08f6ee02b0fd1c50dfbd61bdaed30520` across 971 facts.

## 3. One read on production, for ruling 4 (no write)

What production's roof certifications were taken against. The register in code
says 254-RC-001 **v1.1** has been in force since 2026-09-20.

```sql
select c.status, c.certified_at, t.document_number, t.version_label, t.status as protocol_status
from eng_certifications c
left join eng_protocol_templates t on t.id = c.template_id
where c.service_slug = 'roof-inspections';
```

Prediction: **no rows.** BACKLOG.md records that production holds no
`eng_certifications` row for the operator's RC-001 v1.1 training, accepted on his
statement on 2026-10-06. Any row returned is the answer to ruling 4 as it
stands: its `version_label` is the version that technician was certified
against.

## After the sitting

The session records both read backs in `supabase/applied.mjs` and builds the
certification screens on the branch. The branch merges only after production
has 0066.
