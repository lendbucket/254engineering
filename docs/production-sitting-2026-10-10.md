# Production sitting, 2026-10-10

Staged overnight 2026-10-09 into 2026-10-10. Nothing here has been run. The
counterpart runs each step; the session runs none.

## 0067, one pending credential of each kind

`supabase/migrations/0067_one_pending_credential_of_a_kind.sql`, on
`fix/credential-one-pending`. Additive: one unique partial index on
`eng_credentials (profile_id, kind) where status = 'pending'`. It raises and
changes nothing if duplicates already exist.

### 1. Dry run, read only, before applying

```sql
select profile_id, kind, count(*) as pending_rows
from eng_credentials
where status = 'pending'
group by profile_id, kind
having count(*) > 1;
```

**Predict:** no rows on production (no technician has submitted a credential
there since self-service submission merged on 2026-10-09). On development there
may be rows from the audit's two-tab test probes; those probes were swept, and
their credential rows go with them by cascade, so **predict no rows there
either.** If any row comes back, stop: the migration would refuse anyway, and
which row stands is a decision.

### 2. Apply, development first, then production

`apply_migration` with the file as written. Never `execute_sql`.

### 3. Read back, on each

```sql
select indexname, indexdef
from pg_indexes
where tablename = 'eng_credentials'
  and indexname = 'eng_credentials_one_pending_per_kind';
```

**Predict:** one row, `CREATE UNIQUE INDEX eng_credentials_one_pending_per_kind
ON public.eng_credentials USING btree (profile_id, kind) WHERE (status =
'pending'::text)`.

The shape fingerprint does **not** move (an index is not a column):
`18826fa5b3e7d9c9979ca81b96666bb7` across 1171 columns, before and after.
Behaviour facts go from 971 to 972 on a replay; judge a live read-back on the
count, per CLAUDE.md 6b.

## A read for the rate defect (ruling 2 of 2026-10-09), read only

```sql
select a.state as offer_state, f.status as file_status, count(*) as n
from eng_assignments a
join eng_files f on f.id = a.file_id
where a.offer_amount_cents is null
  and f.is_demo = false
  and (a.state = 'offered' or (a.state = 'accepted' and f.status not in ('delivered', 'closed', 'cancelled')))
group by 1, 2
order by 1, 2;

select count(*) as accepted_with_no_rate_and_no_pay_entry
from eng_assignments a
join eng_files f on f.id = a.file_id
where a.state = 'accepted'
  and a.offer_amount_cents is null
  and f.is_demo = false
  and not exists (
    select 1 from eng_tech_pay_ledger p where p.file_id = a.file_id and p.tech_id = a.tech_id
  );
```

**Predict:** no rows, and 0. Production has dispatched no real field job to a
technician other than through the operator's own testing; if either is not
empty, those are technicians who accepted work with no rate on record.

## The five protocol signatures (item 2 of the protocol prompt), read only

```sql
select protocol_document, protocol_version, content_sha256, created_at, mfa_verified_at, voided_at
from eng_seal_acts
where kind = 'protocol'
order by protocol_document;
```

**Predict:** five live rows, and each `content_sha256` equals the digest the
transcription in code produces today (SHA-256 of the `text` lines joined by a
newline, `transcriptionSha256` in `src/lib/protocol-sign.ts`):

| Document | Expected content_sha256 |
| --- | --- |
| 254-MH-001 v1.1 | `d5fb2893f4d618dbdbf7a9d3d1c0998b1462e2adf72caa8d4ba59fb7b34a55d6` |
| 254-SL-001 v1.1 | `c19522c86abbba90622aa3c1a41f5194a8f6c97134abb8bf8608fc22576c536d` |
| 254-PL-001 v1.1 | `c8814496b1dd0b0f228b92447f547f7be4b8bf1553278bef5891817bdb6fb27e` |
| 254-RS-001 v1.1 | `47e8e9ecb2d5fe07f9b37899cf5ee5494202b6a6f59648bf3ab0d85b9f616508` |
| 254-DS-001 v1.1 | `c47536b8ab31009027e6f443a03bed1b28b6dbf443b85350b7e7bb817756958b` |

A match on all five closes the chain: the act covers the transcription, the
transcription is the v1.1 PDF word for word (protocol-registry-audit section
8), and the PDF is the file whose digest 0065 recorded.
