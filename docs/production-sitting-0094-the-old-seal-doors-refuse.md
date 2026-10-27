# Sitting: 0094, the old seal doors refuse

Written 2026-10-26 on `migration/0094-retire-the-old-seal-doors`, which sits on 0093 and therefore on 0090 to 0092. **0093 is held** (BACKLOG.md), so this waits with it. The chat applies it with `apply_migration`, development first, then production, each after 0093. The branch merges only after the production apply is read back, and a migration on main is never pending.

## Why

Robert's addendum of 2026-10-25, item 9: retire the old seal doors.
- 0089 added the seventeen- and eighteen-argument `eng_record_letter_seal`, which record the name and licence a letter prints.
- 0089 left 0081's fifteen and 0088's sixteen as they were, so that there was no cutover gap.
- 0089 merged at `3935c91`, and the code on main calls only the seventeen and eighteen.

## What changes

The two old doors keep their signatures. Each body becomes a refusal that names the change: "since 0089 a letter is sealed with the name and licence number it prints; this fifteen-argument door is retired (0094)", and likewise for the sixteen. Nothing is dropped; this is the 0081 pattern. The eighteen-argument door, which names a letter template, stays callable and unused, by item A of the ruling of 23:51 Central.

## Predicted figures

| | Shape | Columns | Behaviour | Facts |
| --- | --- | --- | --- | --- |
| at 0093 | `8daaba436e02fb92c9a6b227fcb98caf` | 1353 | `d76bf14347aef9223a5c933065013bd1` | 1281 |
| at 0094 | `8daaba436e02fb92c9a6b227fcb98caf` | 1353 | `9996160feeebb47be1426e84e760524e` | 1281 |

## Section 0: read first

```sql
select pronargs, position('retired (0094)' in prosrc) > 0 as retired
  from pg_proc where proname = 'eng_record_letter_seal' order by pronargs;
-- Expect five rows, 14 to 18 arguments. 14 retired by 0081's wording (not 0094's), so false;
-- 15, 16, 17 and 18 false.

select count(*) from eng_seal_acts where kind = 'letter' and created_at > now() - interval '1 day' and printed_license is null;
-- Expect: 0. A letter sealed in the last day with no printed licence went through an old door,
-- which means deployed code still calls one. Stop and report it.
```

## Section 1: apply

`apply_migration` with the file `supabase/migrations/0094_the_old_seal_doors_refuse.sql`, name `0094_the_old_seal_doors_refuse`.

## Section 2: read back

```sql
select pronargs, position('retired (0094)' in prosrc) > 0 as retired
  from pg_proc where proname = 'eng_record_letter_seal' order by pronargs;
-- Expect: 15 and 16 true; 14, 17 and 18 false.

-- the shape query. Expect: 8daaba436e02fb92c9a6b227fcb98caf, 1353, unchanged.
```

**A difference is a stop.** In replay, `scripts/proofs/the-old-seal-doors-refuse.mjs` walks every door before and after.
