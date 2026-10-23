# Sitting: 0084, a line opens only when it is signed and trained

Branch `feat/training-record`, built on `merge/pl-determination-on-main-1`, so
it applies after 0083. Written 2026-10-23; **redesigned the same morning under
Robert's ruling 6. Applied nowhere yet.** Development first (the chat), then
the board, then production after 0082 and 0083.

**The first version was withdrawn unapplied** (sha256 `01b0170a...`). The chat
held it at 04:15 because its rows referenced `eng_profiles` with on delete
restrict, so every board that recorded training for a probe technician would
have left an account no sweep could remove.

## Why

Operator ruling of 2026-10-23: a line opens only when its protocol is signed
and somebody is trained on that version, recorded in the portal. Roof stays
exactly as it is.

The signature half has been read at every money door since ruling 11. The
training half was a typed list in `src/config/credentials.ts`, read at build
time and only for registry lines. The portal already records training (since
2026-10-07), but as audit events, and approval upserts the mutable
`eng_certifications`, which cannot say which version somebody was trained on.

## What changes

| | |
| --- | --- |
| `eng_training_records` | one row per supervised training on one exact template; append only, except that it goes with its technician (on delete cascade) |
| `eng_training_decisions` | the engineer's one decision per record, a refusal with his reason; append only, goes with its record (on delete cascade) |
| who recorded, who decided | `recorded_by`, `decided_by`: pointers, not references, as `eng_audit_events.actor_id` is, so no actor is pinned |
| the guard | `eng_forbid_mutation_allow_cascade` (0001): never edited, never deleted directly, deleted only with the person it is about |
| Section 3 backfill | every interim `certification.training_recorded` event whose template and technician exist, and every decision event against one, each row naming its event |
| `eng_profiles_keep_trained` | a BEFORE DELETE trigger on `eng_profiles`: a profile with any training record cannot be deleted unless its address is on `audit-probe.invalid`; fires on a direct delete and on the cascade from `auth.users` (ruling of 2026-10-23 on the redesign) |
| `eng_line_is_trained(slug, template)` | true only for an approved record on that template, for an active `field_tech` |
| `src/lib/line-gate.ts` | a line opened by a portal signature also needs `eng_line_is_trained` on its in-force template; a failed read closes it; roof's path unchanged |
| `src/lib/certification-record.ts` | records and decisions are rows; the events are still written as the trail |

No drop statement. RLS on both tables with no policies. The function's EXECUTE
is revoked from PUBLIC, anon and authenticated. A real technician is suspended,
never deleted, and since the guard that is a refusal rather than a comment: only
a probe's training can cascade away.

## Predicted figures

| | Shape | Columns | Behaviour | Facts |
| --- | --- | --- | --- | --- |
| at 0083 | `a4bbde8cac7f216a582875f8ff8d1e01` | 1280 | `902a66ba81832a2a76d66fb47c713810` | 1181 |
| at 0084 | `79a8143e24f29af96b2a26573efd8803` | 1299 | `7eb110b9207115cf1d6bfba690da4dd5` | 1202 |

File SHA-256: `57f5b8d4fd2af6ee21d1343ecc83e8587faf2bde6df63214e97c3a7b4c86c114`.
Withdrawn unapplied: `01b0170a...` (pinned probes) and `54b438c2...` (no delete guard).

## Section 0: read first, each its own statement

```sql
-- the shape query. Expect: a4bbde8cac7f216a582875f8ff8d1e01, 1280 (0083 applied).

select to_regclass('public.eng_training_records') as records,
       to_regclass('public.eng_training_decisions') as decisions;
-- Expect: null, null.

-- What eng_line_is_trained reads (ruling 6): the status column, and the role
-- check that admits 'field_tech'.
select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'eng_profiles' and column_name in ('status', 'role')
 order by column_name;
-- Expect two rows: role text, status text.

select conname, pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.eng_profiles'::regclass and contype = 'c'
   and pg_get_constraintdef(oid) like '%field_tech%';
-- Expect at least one row whose definition names 'field_tech'.

select e.action, count(*) as events,
       count(*) filter (where t.id is not null and p.id is not null) as carried
  from eng_audit_events e
  left join eng_protocol_templates t on t.id = nullif(e.diff->>'template_id', '')::uuid
  left join eng_profiles p on p.id = e.entity_id::uuid
 where e.entity_type = 'profile'
   and e.action = 'certification.training_recorded'
 group by e.action;
-- Write down events and carried (no row means none). Section 2's record count must equal carried.

select action, count(*) from eng_audit_events
 where entity_type = 'profile'
   and action in ('certification.training_approved', 'certification.training_refused')
 group by action;
-- Write both down.
```

## Section 1: apply

`apply_migration` with the file
`supabase/migrations/0084_a_line_opens_only_when_trained.sql`, name
`0084_a_line_opens_only_when_trained`.

## Section 2: read back, each its own statement

```sql
-- the shape query. Expect: 79a8143e24f29af96b2a26573efd8803, 1299.

select count(*) as records, count(*) filter (where source_event_id is not null) as carried
  from eng_training_records;
-- Expect: records = carried = Section 0's carried figure.

select decision, count(*) from eng_training_decisions group by decision;
-- Expect: no more than Section 0's approved and refused events.

select c.conrelid::regclass as tbl, c.conname, c.confdeltype
  from pg_constraint c
 where c.contype = 'f'
   and c.conrelid in ('public.eng_training_records'::regclass, 'public.eng_training_decisions'::regclass)
 order by 1, 2;
-- Expect three rows: the records' profile_id key with confdeltype 'c' (cascade)
-- and template_id key with 'r' (restrict); the decisions' record_id key with 'c'.
-- No key on recorded_by or decided_by.

select relname, relrowsecurity from pg_class
 where relname in ('eng_training_records', 'eng_training_decisions') order by relname;
-- Expect two rows, both true.

select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'eng_line_is_trained';
-- Expect one row: eng_line_is_trained(text,uuid).

select tgname, tgenabled from pg_trigger
 where tgrelid = 'public.eng_profiles'::regclass and tgname = 'eng_profiles_keep_trained';
-- Expect one row, enabled ('O').
```

## What this does not do

It opens nothing. No line but roof is offered, so no money door asks the new
function until a line is offered in configuration, and roof never asks it.
`eng_certifications` is untouched, so dispatch reads exactly what it read.
