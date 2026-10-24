# Sitting: 0088, a manufactured home, solar or WPI-8E letter seals only from a template he signed

Branch `feat/letter-adoption` (0086, 0087 and 0088, on main `1608c8b`).
Written 2026-10-24 under Robert's instruction that day, and **narrowed by his
ruling 3 of 2026-10-24** ("1-5 yes", 11:24 Central) to the three drafted
lines. **Applied nowhere.** The chat sits it on development, then on
production.

## Why

The engineer signs a letter template in his portal like a protocol, and a
manufactured home (254-MH-001), solar (254-SL-001) or WPI-8E (254-WS-001,
completed) letter seals only from a template he has signed.

**Roof, foundation, permit and every other line in force are untouched.**
Their letters seal exactly as before, through 0081's fifteen-argument
`eng_record_letter_seal`, which 0088 does not replace, and they can name no
template. **There is no cutover gap:** the code deployed before 0088 goes on
sealing them the moment 0088 is applied.

**The three lines stay closed** until the engineer adopts the drafted wording,
a template is added from his adopted words, and he signs it. That is expected,
not a miss.

## What changes

| | |
| --- | --- |
| `eng_seal_acts` | kind `letter_template` (`template_key`, `template_version`); on a letter, `letter_template_act_id`. Shape checks hold each column to its kind and a template key to the three protocols; one live signature per template version. |
| `eng_seal_act_check` | 0082's, plus: a letter whose determination states 254-MH-001, 254-SL-001 or 254-WS-001 names a live template signature for that protocol; any other letter names none. Every other clause is 0082's. |
| `eng_seal_act_guard` | 0082's, plus: the template columns never change |
| `eng_seal_act_audit` | 0082's, plus: a template signature is audited as `letter_template.signed` |
| `eng_record_letter_template_signature` | the one door a template signature comes in by |
| `eng_record_letter_seal` | a new sixteen-argument overload for a three-lines letter; **0081's fifteen-argument version is not replaced** |

The templates are in `src/content/letters/templates.ts`, which holds none
today: manufactured home, solar and WPI-8E get one each from his adopted
wording. He reads and signs each on `/portal/protocols`, under "Letter
templates for your signature", from his own session with a fresh code.

## Predicted figures

From `scripts/fingerprint-at.mjs`, with 0087 reproducing its recorded pair first:

| | Shape | Columns | Behaviour | Facts |
| --- | --- | --- | --- | --- |
| at 0087 | `6a355ef867ca1021391067a84f44f34b` | 1328 | `5741f43639f3d62e58e82f7c3af38675` | 1243 |
| at 0088 | `2fa02bab9a86d346d328a22bbb8ba975` | 1331 | `7836ca5442b675f9fcc5eee731de7f21` | 1248 |

## Section 0: read first, and record the three marked results

```sql
-- the shape query. Expect: 6a355ef867ca1021391067a84f44f34b, 1328 (0087 applied).

select pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.eng_seal_acts'::regclass and conname = 'eng_seal_acts_kind_check';
-- Expect: letter, protocol and addendum.

select kind, count(*) from eng_seal_acts group by kind order by kind;
-- Expect a count per kind; every existing row keeps its kind and gains nulls in the three new columns.

-- RECORD A: every line open before 0088, and whether somebody is trained on it.
select t.service_slug, t.document_number, t.version_label,
       eng_line_is_trained(p_service_slug => t.service_slug, p_template_id => t.id) as trained
  from eng_protocol_templates t
 where t.status = 'published'
 order by 1, 2, 3;

-- RECORD B: the live protocol signatures.
select protocol_document, protocol_version, count(*) from eng_seal_acts
 where kind = 'protocol' and voided_at is null
 group by 1, 2 order by 1, 2;

-- RECORD C: 0081's fifteen-argument seal door, the one every roof, foundation and permit letter goes through.
select md5(prosrc) from pg_proc where proname = 'eng_record_letter_seal' and pronargs = 15;
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

select pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.eng_seal_acts'::regclass and conname = 'eng_seal_acts_template_shape_ck';
-- Expect: the template key held to '254-MH-001', '254-SL-001' and '254-WS-001'.

select count(*) from eng_seal_acts where kind = 'letter_template';
-- Expect: 0.

select p.oid::regprocedure from pg_proc p
 where p.proname in ('eng_record_letter_template_signature', 'eng_record_letter_seal') order by 1;
-- Expect three rows: the template door and two eng_record_letter_seal overloads (fifteen and sixteen arguments).
```

**THE ASSERTION: EVERY LINE OPEN BEFORE 0088 IS STILL OPEN AFTER IT.** Run
Section 0's three recorded statements again, unchanged. **Each must return
exactly what it returned in Section 0**, row for row:

```sql
-- A again: the same lines, versions and trained answers.
select t.service_slug, t.document_number, t.version_label,
       eng_line_is_trained(p_service_slug => t.service_slug, p_template_id => t.id) as trained
  from eng_protocol_templates t
 where t.status = 'published'
 order by 1, 2, 3;

-- B again: the same live protocol signatures.
select protocol_document, protocol_version, count(*) from eng_seal_acts
 where kind = 'protocol' and voided_at is null
 group by 1, 2 order by 1, 2;

-- C again: the same md5. The door every roof, foundation and permit letter is sealed through is the door it was.
select md5(prosrc) from pg_proc where proname = 'eng_record_letter_seal' and pronargs = 15;
```

Any difference in A, B or C is a stop: report it on issue #1 and do nothing
further. In replay, `scripts/proofs/a-letter-seals-only-from-a-template-he-signed.mjs`
seals roof, foundation and permit letters through that door after 0088 and
proves a three-lines letter refused without its template (32 PASS).

## What this does not do

It signs nothing: only the engineer signs a template, from his own session. It
opens no line, closes no line that was open, and sends nothing to anybody.
