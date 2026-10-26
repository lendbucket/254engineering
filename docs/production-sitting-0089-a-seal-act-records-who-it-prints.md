# Sitting: 0089, a seal act records the name and licence it prints, and a letter is dated by one moment

Written 2026-10-25 on `migration/0089-a-seal-act-records-who-it-prints`. The chat applies it with `apply_migration`, development first, then production; the branch merges only after the production apply is read back. A migration on main is never pending.

## Why

Robert's answers of 2026-10-25 on two letter claims from his audit of 2026-10-24.

- **L2e:** "the seal act records the printed name and licence number. Records only, never a public page." A sealed letter prints the engineer's name and Texas licence number from the firm's register in code. The seal act, the row the regulatory record rests on, recorded neither.
- **L2j:** "the printed date is the sealing moment in America/Chicago." The letter prints the date of the act's own `mfa_verified_at` (the instant his fresh code was spent) in America/Chicago. The document's `sealed_at` was the database's `now()` inside the door, a few seconds later, so the two could fall either side of midnight in Texas.

## What changes

1. `eng_seal_acts` gains `printed_name` and `printed_license`, both or neither, never blank, only on a letter (`eng_seal_acts_printed_ck`). Acts sealed before 0089 hold neither: nothing recorded them.
2. `eng_seal_act_guard` is 0088's, word for word, with the two columns added to what can never change.
3. `eng_record_letter_seal` gains a **seventeen-argument** overload (0081's fifteen plus the two) and an **eighteen-argument** one (0088's sixteen plus the two). Each refuses a blank name or licence and a licence that is not the sealing engineer's own (`eng_profiles.license_number`), and writes the document's `sealed_at` as `p_mfa_verified_at`.

**0081's fifteen- and 0088's sixteen-argument doors are not replaced.** The code deployed before this branch merges keeps sealing through them between the sitting and the deploy: no cutover gap. Retiring them is a later migration, after the deploy.

No drop statement.

## Predicted figures

From `scripts/fingerprint-at.mjs`, with 0088 reproducing its recorded pair first:

| | Shape | Columns | Behaviour | Facts |
| --- | --- | --- | --- | --- |
| at 0088 | `2fa02bab9a86d346d328a22bbb8ba975` | 1331 | `7836ca5442b675f9fcc5eee731de7f21` | 1248 |
| at 0089 | `05bb694a74ad7aeb15a3c37c8474d2da` | 1333 | `83c9992d0ebc4ef3a1ee2f82a262af28` | 1251 |

A live read-back is judged on the shape digest and the counts, never on the behaviour digest (CLAUDE.md section 6b).

## Section 0: read first, and record the two marked results

```sql
-- the shape query. Expect: 2fa02bab9a86d346d328a22bbb8ba975, 1331 (0088 applied).

select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'eng_seal_acts' and column_name in ('printed_name', 'printed_license');
-- Expect: no rows.

select kind, count(*) from eng_seal_acts group by kind order by kind;
-- Expect a count per kind. Every existing row keeps it and gains two nulls.

-- RECORD A: the two doors the deployed code seals through, which 0089 must not touch.
select pronargs, md5(prosrc) from pg_proc where proname = 'eng_record_letter_seal' and pronargs in (15, 16) order by 1;

-- RECORD B: the licence number on every engineer profile that has sealed a letter, so the new doors' check has what it reads.
select p.id, p.license_number is not null as has_licence
  from eng_profiles p
 where p.id in (select sealed_by from eng_seal_acts where kind = 'letter')
 order by 1;
```

## Section 1: apply

`apply_migration` with the file
`supabase/migrations/0089_a_seal_act_records_who_it_prints.sql`,
name `0089_a_seal_act_records_who_it_prints`.

## Section 2: read back, each its own statement

```sql
-- the shape query. Expect: 05bb694a74ad7aeb15a3c37c8474d2da, 1333.

select pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.eng_seal_acts'::regclass and conname = 'eng_seal_acts_printed_ck';
-- Expect: both or neither, never blank, digits only for the licence, only on a letter.

select count(*) from eng_seal_acts where printed_name is not null or printed_license is not null;
-- Expect: 0. Nothing is backfilled; acts before 0089 recorded neither.

select p.oid::regprocedure from pg_proc p where p.proname = 'eng_record_letter_seal' order by 1;
-- Expect five rows: 0062's fourteen (refusing, since 0081), 0081's fifteen, 0088's sixteen, and 0089's seventeen and eighteen.

select p.oid::regprocedure,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated
  from pg_proc p where p.proname = 'eng_record_letter_seal' and p.pronargs in (17, 18) order by 1;
-- Expect two rows, false and false.
```

**THE ASSERTION: THE DOORS THE DEPLOYED CODE SEALS THROUGH ARE THE DOORS THEY WERE.** Run Section 0's RECORD A again, unchanged. It must return exactly what it returned in Section 0:

```sql
select pronargs, md5(prosrc) from pg_proc where proname = 'eng_record_letter_seal' and pronargs in (15, 16) order by 1;
```

Any difference is a stop: report it on issue #1 and do nothing further. In replay, `scripts/migration-audit.mjs` (150 checks) proves the new doors refuse a blank name and another engineer's licence, record both, date the document by the act's own moment, and refuse a rewrite.

**RECORD B is a stop too** if any profile that has sealed a letter has no licence number: the new doors would refuse that engineer. Report it before the code merges.

## What this does not do

It seals nothing, voids nothing and backfills nothing. It changes no letter's wording, opens or closes no line, and sends nothing to anybody. The printed name and licence are records on the act, never on a public page.
