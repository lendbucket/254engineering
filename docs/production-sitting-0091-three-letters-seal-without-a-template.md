# Sitting: 0091, the three letters seal without a template

Written 2026-10-26 on `migration/0091-three-letters-seal-without-a-template`, on top of `feat/insurance-register`, because the chain is in order and 0090 comes first. The chat applies it with `apply_migration`, development first, then production, each after 0090. The branch merges only after the production apply is read back, and a migration on main is never pending.

## Why

Robert's ruling of 2026-10-25, 23:51 Central, item A. The engineer signs no templates. His seal on each live letter, after reading its full preview, is his adoption of that letter. 0088 made a manufactured home (254-MH-001), solar (254-SL-001) or WPI-8E (254-WS-001) letter seal only from a template he had signed, and none exists, so those three lines could seal nothing.

## What changes

One function body, `eng_seal_act_check`, which is 0088's with one clause changed:

| | 0088 | 0091 |
| --- | --- | --- |
| A letter for one of the three that names no template | refused | **seals** |
| A letter for one of the three that names a template | must be a live template signature for its own protocol | unchanged |
| Any other letter that names a template | refused | unchanged |

Every other clause is 0088's word for word:
- the sealer's own current seal and signature images;
- only an engineer seals;
- a letter is sealed only by the engineer who recorded its determination;
- the letterhead hash;
- the scope addendum rule.

Nothing is dropped. The template kind, its columns, its shape check, the one-live-template index, `eng_record_letter_template_signature` and the template overloads of `eng_record_letter_seal` stay, callable and unused. No column, table, index, trigger or grant changes.

## Predicted figures

From `scripts/fingerprint-at.mjs`, with 0090 reproducing its recorded pair first:

| | Shape | Columns | Behaviour | Facts |
| --- | --- | --- | --- | --- |
| at 0090 | `8daaba436e02fb92c9a6b227fcb98caf` | 1353 | `25076aa51d01188e59da94c9f6871ce0` | 1281 |
| at 0091 | `8daaba436e02fb92c9a6b227fcb98caf` | 1353 | `92e2d140a1aefe8192833d9809b7d428` | 1281 |

Tables 101, triggers 101 and functions 67, all unchanged. A live read-back is judged on the shape digest and the counts, never on the behaviour digest (CLAUDE.md section 6b).

## Section 0: read first

```sql
-- the shape query. Expect: 8daaba436e02fb92c9a6b227fcb98caf, 1353 (0090 applied).

select position('seals only from a letter template the engineer has signed' in prosrc) > 0 as requires_template
  from pg_proc where proname = 'eng_seal_act_check';
-- Expect one row: true (0088's clause is in force).

select count(*) from eng_seal_acts where kind = 'letter_template';
-- Expect: 0.
```

## Section 1: apply

`apply_migration` with the file `supabase/migrations/0091_three_letters_seal_without_a_template.sql`, name `0091_three_letters_seal_without_a_template`. SHA-256 of the file: `fcee7662cb37cc616044ff9e855bd4f6d13312b8ed6838710c4f9a19fc37b168`.

## Section 2: read back, each its own statement

```sql
-- the shape query. Expect: 8daaba436e02fb92c9a6b227fcb98caf, 1353, unchanged.

select position('seals only from a letter template the engineer has signed' in prosrc) > 0 as old_clause,
       position('names a live one for the protocol its determination states (0088, 0091)' in prosrc) > 0 as new_clause,
       position('Only a manufactured home, solar or WPI-8E letter names a letter template' in prosrc) > 0 as other_lines
  from pg_proc where proname = 'eng_seal_act_check';
-- Expect one row: false, true, true.

select has_function_privilege('anon', 'public.eng_seal_act_check()', 'EXECUTE') as anon,
       has_function_privilege('authenticated', 'public.eng_seal_act_check()', 'EXECUTE') as authenticated;
-- Expect: false, false.

select count(*) from eng_seal_acts where kind = 'letter_template';
-- Expect: 0, unchanged.
```

**A difference in any count is a stop.** Report it on issue #1 and do nothing further. In replay, `scripts/proofs/the-three-letters-seal-without-a-template.mjs` walks it against the whole chain:
- before 0091 each of the three is refused;
- after it, each seals through the seventeen-argument door with no template;
- roof, foundation and permit seal as before;
- a voided template, or one for another line, is refused, and a live one for its own line seals;
- a roof letter still cannot name a template;
- another engineer's seal image is refused, and so is a letter sealed by someone who did not decide it.

## What this does not do

- It seals nothing and signs nothing.
- It touches no row.
- It opens no line. Each line still sells only through `line-gate.ts`'s live read of a portal-signed protocol and a trained technician.
- A letter for these three is still drafted only from recorded facts and the drafted wording on file, and shown in full before he seals. That is the code, on its own branch.
