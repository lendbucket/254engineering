# Running a destructive migration, in a sitting

**Operator ruling, 2026-10-03.** A destructive statement cannot reach production
through this repository's tooling. The Supabase MCP cancels `DROP` and `DELETE`
before execution, with `{"status":"cancelled"}` and no error body, while additive
writes go through. Established from 45 MCP calls in one session; the full
evidence is in `CLAUDE.md` section 6b and in `BACKLOG.md`.

So the operator runs it, in the Supabase SQL editor, from a script a session
prepares and does not run.

---

## The shape of every one of these

**Three blocks, in this order, and the session writes all three.**

1. **The dry run.** A READ that answers "what is true before", in the same terms
   the verification will use. It changes nothing and it is run first so the
   operator can see the world the statement is about to act on.
2. **The statement.** The destructive SQL itself, exactly as it appears in the
   migration file, with nothing added.
3. **The verification.** A READ that answers "what is true now". It is a
   SEPARATE statement, never a data-modifying CTE reading its own effect: a
   delete wrapped in a CTE with the read-back in the same statement returns the
   PRE-delete snapshot, which reads exactly like a delete that silently failed.
   That is recorded in `CLAUDE.md` as a tooling rule and it is the reason this
   is three blocks rather than one.

**What the session does afterwards.** Nothing, until the operator pastes back
what the verification printed. Then the ledger entry in `supabase/applied.mjs` is
written from HIS output, not from an assumption that the statement ran.

**Why the dry run matters more here than usual.** The operator is running this by
hand, in a console, against production. The dry run is what lets him stop before
the second block if the world is not the one the script was written against.

---

## 0062, prepared and not run

**DEFERRED OUT OF `release/2026-10-20`, operator ruling of 2026-10-07.** The
connector refuses the drop, the column is empty on both databases, and no code
writes it. The file is on `migration/credentials-0062` only; on the release
branch, 0062 is now the seal act. When this goes ahead it takes the next free
number at that time, and this section is renamed with it. The procedure below
is unchanged.

**RENUMBERED FROM 0061 ON 2026-10-07.** The sealed deliverable migration took
0061 in the chain, so this file is now
`supabase/migrations/0062_credentials_hold_no_documents.sql`, on
`release/2026-10-20` (renumbered on `migration/credentials-0062` and merged
there). The original branch `migration/credentials-hold-no-documents` still
carries the old name and is not what the sitting applies.

`supabase/migrations/0062_credentials_hold_no_documents.sql`. It drops
`eng_credentials.storage_key`, which is the column the onboarding hotfix of
2026-10-02 stopped writing. It is held off `main` deliberately, because
standing law says a migration reachable from `main` is never pending.

**THE CONNECTOR CANNOT RUN STEP 2, AND THERE IS NO EQUIVALENT WITHOUT IT.**
Operator note of 2026-10-07: the Supabase connector refuses any statement
containing drop or delete. Every other migration on the release branch was
written to reach its end state without one. This one cannot be: its whole
purpose is removing a column, and leaving the column in place is not the same
end state. Step 2 is run by Robert's counterpart in the SQL editor, or by
whatever path he rules, and the dry run and verification below are unchanged.

### 1. Dry run, read only

```sql
select
  'column exists'                         as question,
  count(*)::text                          as answer
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'eng_credentials'
  and column_name  = 'storage_key'
union all
select
  'credential rows',
  count(*)::text
from eng_credentials
union all
select
  'rows where storage_key is not null',
  count(*)::text
from eng_credentials
where storage_key is not null;
```

**Expected before:** column exists `1`, and **rows where storage_key is not null
must be `0`.** Development held 17 credential rows and 0 documents when this was
written, and production held 0 rows at all.

**If that third number is not 0, STOP.** The column holds something, dropping it
destroys it, and what it holds has to be understood before anything else
happens. The whole reason this migration is safe is that nothing ever wrote the
column.

### 2. The statement

```sql
alter table eng_credentials drop column if exists storage_key;
```

### 3. Verification, read only, as its own statement

```sql
select
  'column still exists'  as question,
  count(*)::text         as answer
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'eng_credentials'
  and column_name  = 'storage_key'
union all
select
  'credential rows',
  count(*)::text
from eng_credentials;
```

**Expected after:** column still exists `0`, and the credential row count
**unchanged** from the dry run. A dropped column must not change how many rows
there are, and checking that is how a `drop column` that took more than its
column with it would show.

### What is still owed after he runs it

- The ledger entry in `supabase/applied.mjs`, written from his pasted output.
- `release/2026-10-20`, which carries it, merges only once the entry says
  production has it. A migration on `main` is never pending.
- The shape fingerprint is re-derived with `scripts/fingerprint-at.mjs`; a
  dropped column changes the column count, so the figure moves and the ledger
  records the new one.
