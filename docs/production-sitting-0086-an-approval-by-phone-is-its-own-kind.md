# Sitting: 0086, an approval by phone is its own kind

Branch `feat/relayed-approval`, built on main `12abb7e` (0082 to 0085 on
production). Written 2026-10-24 under Robert's ruling of 2026-10-23 21:56 CT.
**Applied nowhere.** Development first, then the board, then production.

## Why

The engineer of record approved Robert Reyna as the field technician on every
service line whose protocol he has signed, by phone, and Robert relayed it. The
ruling: record the training on each signed line's in force template; record the
approval as its own kind, "approved by the engineer of record by phone, relayed
by the owner", with the date, the time and the owner's account as the one
recording it, never as an approval made from the engineer's session and never
through his account; a place for his written confirmation, "written confirmation
pending" until it is attached; and `eng_line_is_trained` counts it as approved.

## What changes

| | |
| --- | --- |
| `eng_training_decisions` | `channel` (`portal` by default, or `phone_relayed`), `approved_by_engineer`, `relayed_by`, `approved_at`. A check holds the two shapes apart: a relayed row has no `decided_by` and no licence, names the engineer, the relayer and the moment, is always an approval, and its relayer is not its engineer. |
| `eng_relayed_decision_check` | the engineer named is an engineer, the relayer an administrator, the moment not in the future |
| `eng_training_confirmations` | new table: his written confirmation (text or email, as received) of one relayed approval, attached by an administrator, at most one, append only |
| `eng_record_relayed_training_approval` | the one door: the training record, the relayed approval, the certification dispatch reads, and the audit event, in one transaction |

`eng_line_is_trained` is unchanged and counts the relayed approval. The portal
technician page shows "Approved by the engineer of record by phone, relayed by
the owner" and "Written confirmation pending", and an administrator attaches the
confirmation there.

## Predicted figures

From `scripts/fingerprint-at.mjs`, with 0085 reproducing its recorded pair first:

| | Shape | Columns | Behaviour | Facts |
| --- | --- | --- | --- | --- |
| at 0085 | `cbf3b1702865427a65466b11c900b4e1` | 1317 | `b7d5fefb4da018255dc691c3da1df896` | 1227 |
| at 0086 | `6a355ef867ca1021391067a84f44f34b` | 1328 | `faa068eaef15179f26a3054685a888ba` | 1242 |

## Section 0: read first

```sql
-- the shape query. Expect: cbf3b1702865427a65466b11c900b4e1, 1317 (0085 applied).

select to_regclass('public.eng_training_confirmations');
-- Expect: null.

select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'eng_training_decisions' and column_name = 'channel';
-- Expect: no row.

select count(*) from eng_training_decisions;
-- Expect a number. Every one becomes a portal row.
```

## Section 1: apply

`apply_migration` with the file
`supabase/migrations/0086_an_approval_by_phone_is_its_own_kind.sql`, name
`0086_an_approval_by_phone_is_its_own_kind`.

## Section 2: read back, each its own statement

```sql
-- the shape query. Expect: 6a355ef867ca1021391067a84f44f34b, 1328.

select channel, count(*) from eng_training_decisions group by channel;
-- Expect: only portal, with Section 0's count (or no rows if it was 0).

select conname from pg_constraint
 where conrelid = 'public.eng_training_decisions'::regclass
   and conname in ('eng_training_decisions_channel_ck', 'eng_training_decisions_channel_shape_ck') order by 1;
-- Expect two rows.

select relrowsecurity from pg_class where oid = 'public.eng_training_confirmations'::regclass;
-- Expect: true.

select p.oid::regprocedure from pg_proc p
 where p.proname in ('eng_relayed_decision_check', 'eng_confirmation_check', 'eng_record_relayed_training_approval') order by 1;
-- Expect three rows.
```

## Section 3: production only, after Section 2: the training the ruling records

Development holds no record of Robert, so this runs on production only. Two
values are Robert's to give and are **placeholders until he does**:
`<SUPERVISED BY, IN ROBERT'S WORDS>` and `<TRAINED ON DATE>`. The approval
moment is his ruling's: 2026-10-23 21:56 Central.

```sql
-- 3a. Read first. Expect: the templates in force, one row per signed line.
select id, service_slug, document_number, version_label from eng_protocol_templates
 where status = 'published' order by service_slug;

-- 3b. The three people. Expect one row each, every one active.
select id, role, status from eng_profiles where id = 'c9d46cd2-9ee3-4479-9768-2b27e13c0044';  -- Robert, field_tech
select id, role, status from eng_profiles where role = 'engineer' and status = 'active';       -- the engineer of record: exactly one row
select id, role, status from eng_profiles where role = 'admin' and id = '<ROBERT ADMIN PROFILE ID>'; -- Robert, admin, who relays

-- 3c. One call per template from 3a, each its own statement.
select eng_record_relayed_training_approval(
  'c9d46cd2-9ee3-4479-9768-2b27e13c0044',
  '<TEMPLATE ID FROM 3a>',
  '<TRAINED ON DATE>',
  '<SUPERVISED BY, IN ROBERT''S WORDS>',
  '<ENGINEER PROFILE ID FROM 3b>',
  '<ROBERT ADMIN PROFILE ID>',
  timestamptz '2026-10-23 21:56:00 America/Chicago'
);
-- Expect a decision id for each.

-- 3d. Read back.
select r.service_slug, d.channel, d.decided_by, d.approved_at, (c.id is null) as confirmation_pending
  from eng_training_records r
  join eng_training_decisions d on d.record_id = r.id
  left join eng_training_confirmations c on c.decision_id = d.id
 where r.profile_id = 'c9d46cd2-9ee3-4479-9768-2b27e13c0044';
-- Expect one row per template from 3a: phone_relayed, decided_by null, approved_at 2026-10-24 02:56 UTC, pending true.

select service_slug, eng_line_is_trained(service_slug, id) from eng_protocol_templates where status = 'published';
-- Expect true for every row.
```

## What this does not do

It opens no line. A line is sold only when it is offered in configuration and
its letter seals, on Robert's go. It sends nothing to anybody, and it never uses
the engineer's account.
