# Sitting: 0084, a line opens only when it is signed and trained

Branch `feat/training-record`, built on `merge/pl-determination-on-main-1`, so
it applies after 0083. Written 2026-10-23. **Applied nowhere yet.**
Development first (the chat, in the overnight queue), then the board, then
production in the morning sitting after 0082 and 0083.

## Why

Operator ruling of 2026-10-23: a line opens only when its protocol is signed
and somebody is trained on that version, recorded in the portal. Roof stays
exactly as it is.

The signature half has been read at every money door since ruling 11. The
training half was a typed list in `src/config/credentials.ts`, read at build
time and only for registry lines. The portal already records training (since
2026-10-07): an administrator records it and the engineer approves or refuses
it from his own session. But the record was kept as audit events, and approval
upserts the mutable `eng_certifications`, which cannot say which version
somebody was trained on.

## What changes

| | |
| --- | --- |
| `eng_training_records` | one row per supervised training on one exact template; append only |
| `eng_training_decisions` | the engineer's one decision per record, a refusal with his reason; append only |
| Section 3 backfill | every interim `certification.training_recorded` event whose template and technician exist, and every decision event against one, each row naming its event |
| `eng_line_is_trained(slug, template)` | true only for an approved record on that template, for an active technician |
| `src/lib/line-gate.ts` | a line opened by a portal signature also needs `eng_line_is_trained` on its in-force template; a failed read closes it; roof's path unchanged |
| `src/lib/certification-record.ts` | records and decisions are rows; the events are still written as the trail |

No drop statement. RLS on both tables with no policies. The function's EXECUTE
is revoked from PUBLIC, anon and authenticated.

## Predicted figures

| | Shape | Columns | Behaviour | Facts |
| --- | --- | --- | --- | --- |
| at 0083 | `a4bbde8cac7f216a582875f8ff8d1e01` | 1280 | `902a66ba81832a2a76d66fb47c713810` | 1181 |
| at 0084 | `79a8143e24f29af96b2a26573efd8803` | 1299 | `ea4f0f6cb0386571102f24271e45efa6` | 1202 |

File SHA-256: `01b0170a3d26497f750b478de3c529b0e280bfb2d12fedca3e5e27b3f5013934`.

## Section 0: read first, each its own statement

```sql
-- the shape query. Expect: a4bbde8cac7f216a582875f8ff8d1e01, 1280 (0083 applied).

select to_regclass('public.eng_training_records') as records,
       to_regclass('public.eng_training_decisions') as decisions;
-- Expect: null, null.

select e.action, count(*) as events,
       count(*) filter (where t.id is not null and p.id is not null) as carried
  from eng_audit_events e
  left join eng_protocol_templates t on t.id = nullif(e.diff->>'template_id', '')::uuid
  left join eng_profiles p on p.id = e.entity_id::uuid
 where e.entity_type = 'profile'
   and e.action = 'certification.training_recorded'
 group by e.action;
-- Write down events and carried. Section 2's record count must equal carried.

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
-- Expect: no more than Section 0's approved and refused events (a decision on a
-- record that was not carried is not carried either).

select relname, relrowsecurity from pg_class
 where relname in ('eng_training_records', 'eng_training_decisions') order by relname;
-- Expect two rows, both true.

select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'eng_line_is_trained';
-- Expect one row: eng_line_is_trained(text,uuid).
```

## What this does not do

It opens nothing. No line but roof is offered, so no money door asks the new
function until a line is offered in configuration, and roof never asks it.
`eng_certifications` is untouched, so dispatch reads exactly what it read.
