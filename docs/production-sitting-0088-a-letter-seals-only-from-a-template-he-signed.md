# Sitting: 0088, a letter seals only from a template he signed

Branch `feat/letter-adoption` (0086, 0087 and 0088, on main `1608c8b`).
Written 2026-10-24 under Robert's instruction that day. **Applied nowhere.**
Development first, then the board. **Production needs Robert**, because of
the cutover gap below.

## Why

The engineer signs each letter template in his portal like a protocol, and a
line's letter can seal only from a template he has signed. Nothing seals
without it.

## The cutover gap, stated first

Once 0088 is applied, `eng_record_letter_seal`'s fifteen-argument version
refuses, and the code deployed before 0088 calls exactly that version. **From
the apply until the new code deploys, no letter can be sealed, roof included.**
After the new code deploys, a letter still seals only once the engineer has
signed its template on `/portal/protocols`. So production wants, in this
order and close together: the apply, the merge and deploy, and his signature
on the roof template. Robert decides when.

## What changes

| | |
| --- | --- |
| `eng_seal_acts` | kind `letter_template` (`template_key`, `template_version`); on a letter, `letter_template_act_id`. Shape checks hold each column to its kind; one live signature per template version. |
| `eng_seal_act_check` | 0082's, plus: a letter sealed from 0088 on names a live template signature for the protocol its determination states. The roof letters sealed before 0088 are untouched (the check runs on insert). |
| `eng_seal_act_guard` | 0082's, plus: the template columns never change |
| `eng_seal_act_audit` | 0082's, plus: a template signature is audited as `letter_template.signed` |
| `eng_record_letter_template_signature` | the one door a template signature comes in by |
| `eng_record_letter_seal` | a sixteenth argument, the template signature; 0081's fifteen-argument version refuses |

The templates are in `src/content/letters/templates.ts` (roof, foundation,
permit; manufactured home, solar and WPI-8E have none until he adopts their
wording). He reads and signs each on `/portal/protocols`, under "Letter
templates for your signature", from his own session with a fresh code.

## Predicted figures

From `scripts/fingerprint-at.mjs`, with 0087 reproducing its recorded pair first:

| | Shape | Columns | Behaviour | Facts |
| --- | --- | --- | --- | --- |
| at 0087 | `6a355ef867ca1021391067a84f44f34b` | 1328 | `5741f43639f3d62e58e82f7c3af38675` | 1243 |
| at 0088 | `2fa02bab9a86d346d328a22bbb8ba975` | 1331 | `a5b44f6ec14f145f4ddf9dafa8779c6d` | 1248 |

## Section 0: read first

```sql
-- the shape query. Expect: 6a355ef867ca1021391067a84f44f34b, 1328 (0087 applied).

select pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.eng_seal_acts'::regclass and conname = 'eng_seal_acts_kind_check';
-- Expect: letter, protocol and addendum.

select kind, count(*) from eng_seal_acts group by kind order by kind;
-- Expect a count per kind; every existing row keeps its kind and gains nulls in the three new columns.
```

## Section 1: apply

`apply_migration` with the file
`supabase/migrations/0088_a_letter_seals_only_from_a_template_he_signed.sql`,
name `0088_a_letter_seals_only_from_a_template_he_signed`.

## Section 2: read back, each its own statement

```sql
-- the shape query. Expect: 2fa02bab9a86d346d328a22bbb8ba975, 1331.

select pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.eng_seal_acts'::regclass and conname = 'eng_seal_acts_kind_check';
-- Expect: Section 0's definition with 'letter_template'::text added.

select count(*) from eng_seal_acts where kind = 'letter_template';
-- Expect: 0.

select p.oid::regprocedure from pg_proc p
 where p.proname in ('eng_record_letter_template_signature', 'eng_record_letter_seal') order by 1;
-- Expect three rows: the template door and two eng_record_letter_seal overloads (fifteen and sixteen arguments).
```

## What this does not do

It signs nothing: only the engineer signs a template, from his own session. It
opens no line and sends nothing to anybody.
