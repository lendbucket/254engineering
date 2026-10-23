# Sitting: 0085, a letter states only facts somebody recorded

Branch `feat/fc-pl-records`, built on `feat/training-record`, so it applies
after 0084. Written 2026-10-23 under Robert's ruling 7. **Applied nowhere yet.**
Development first (the chat), then the board, then production after 0084.

## Why

Operator ruling 7 of 2026-10-23 on the foundation (254-FC-001) and permit
(254-PL-001) letters. Each letter prints facts the platform did not hold; the
ruling says who records each, and that the recorded value is what prints:

| Ruling | Fact | Who records it |
| --- | --- | --- |
| FC-3 | the foundation type | the engineer confirms or corrects the intake answer at review |
| PL-2 | the authority's address and salutation | the office, on the file, before review |
| PL-3 | the element described | the engineer may correct the intake text at review |
| PL-4 | site job or desk job | the engineer, per order, in the portal |
| PL-5 | items added to the capture list | the engineer, in his own words, at triage |

## What changes

| | |
| --- | --- |
| `eng_letter_facts` | one row each time a fact is recorded; newest per file and fact is the value; a check holds who may record which fact, and the foundation type to the three the intake offers |
| `eng_job_triage` | the engineer's site or desk decision; newest is the decision |
| `eng_job_capture_additions` | items he adds to a file's capture list, in his words |

All three are append only (`eng_forbid_mutation_allow_cascade`): never
edited, never deleted except with the file they are about. Who recorded is a
pointer, not a reference, so no person is pinned. RLS on, no policies. No
function, no drop statement.

## Predicted figures

| | Shape | Columns | Behaviour | Facts |
| --- | --- | --- | --- | --- |
| at 0084 | `79a8143e24f29af96b2a26573efd8803` | 1299 | `7eb110b9207115cf1d6bfba690da4dd5` | 1202 |
| at 0085 | `cbf3b1702865427a65466b11c900b4e1` | 1317 | `b7d5fefb4da018255dc691c3da1df896` | 1227 |

File SHA-256: `39aa46c4cd5b885a52bdba063f8d2531bbb83e1b30ecdc52aa3b8ea4f068805a`.

## Section 0: read first, each its own statement

```sql
-- the shape query. Expect: 79a8143e24f29af96b2a26573efd8803, 1299 (0084 applied).

select to_regclass('public.eng_letter_facts') as facts,
       to_regclass('public.eng_job_triage') as triage,
       to_regclass('public.eng_job_capture_additions') as additions;
-- Expect: null, null, null.
```

## Section 1: apply

`apply_migration` with the file
`supabase/migrations/0085_a_letter_states_only_recorded_facts.sql`, name
`0085_a_letter_states_only_recorded_facts`.

## Section 2: read back, each its own statement

```sql
-- the shape query. Expect: cbf3b1702865427a65466b11c900b4e1, 1317.

select relname, relrowsecurity from pg_class
 where relname in ('eng_letter_facts', 'eng_job_triage', 'eng_job_capture_additions') order by relname;
-- Expect three rows, all true.

select tgname from pg_trigger
 where tgname in ('eng_letter_facts_append_only', 'eng_job_triage_append_only', 'eng_job_capture_additions_append_only')
 order by tgname;
-- Expect three rows.

select conname from pg_constraint
 where conrelid = 'public.eng_letter_facts'::regclass and contype = 'c' order by conname;
-- Expect, among the column checks, eng_letter_facts_capacity_ck and eng_letter_facts_foundation_type_ck.
```

## Cutover

The code that reads these tables ships with this branch and merges only after
the production apply is read back, and the code on production before then never
reads them. No cutover gap: the tables exist before anything asks for them.

## What this does not do

It opens nothing: foundation and permit letters are not offered for ordering,
and sealing either letter is the next item, built separately.
