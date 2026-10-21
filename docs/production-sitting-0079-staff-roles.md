# Sitting: 0079, two staff roles and the work they do

Branch `feat/staff-roles`. Written 2026-10-20. **Applied nowhere yet, including
development.** Robert applies it to development from this document; the branch
is then boarded on development and held for the chat's production sitting.
Production is Section 4 and is not run until that board has matched its
prediction and Robert says so.

## Why

Operator rulings of 2026-10-20: a Customer Service and Sales Rep (level 1) and
an Operations Manager (level 2), as data the way 0018 made roles data, with the
records their work needs. 0079 adds:

- two roles, `rep` and `ops_manager`, neither a system role, both landing on
  `/portal`;
- 63 grant rows: rep 20, ops_manager 26, admin 16 (every new action, plus the
  refund limit setting, which is the operator's alone), sales 1
  (`payments.send_link`, because New job now always ends in a payment link).
  `pricing.override_at_intake` is the administrator's alone: changing a price
  at intake is admin only, by owner ruling 2026-10-20, the same as opening a
  job without payment. Nobody holds Sales on either database;
- five tables, all with row level security on:
  - `eng_prospects` (18 columns), the sales list;
  - `eng_contact_log` (14), every call, email and note, append only;
  - `eng_refund_requests` (6), append only;
  - `eng_refund_decisions` (10), append only, one per request, with a check
    that refuses an approval above the limit it names;
  - `eng_refund_approval_limits` (5), append only; the newest row is the limit
    and no row is $0.

**Additive only.** No drop, no revoke, no change to an existing column, so the
connector is expected to apply it. The Dispatcher is given nothing; technician
pay comes off its dispatch panel in code, by the ruling of 2026-10-20, because
the new `pricing.read_tech_rate` is the administrator's alone.

## Predicted figures

From `scripts/fingerprint-at.mjs`, with 0078 reproducing its recorded pair first:

| | Shape | Columns | Behaviour | Facts |
| --- | --- | --- | --- | --- |
| at 0078 | `4ccff0ee13040992a71d16d2b14163a3` | 1210 | `92e4ca15c2ec0c69e075abf7f80d6fe9` | 1020 |
| at 0079 | `45ce47821d9c5567eb3b4b197549d881` | 1263 | `8f0fe1b5eb8a6b5588e0ae9e3ae5017c` | 1152 |

Re-read 2026-10-20 after Sales' price override row came out of the migration:
the shape did not move, and the behaviour went from
`fc8b9792ddfa6b1a3eebb45854814a2a` across 1153 to the figure above, one grant
fewer.

A live read back is judged on the counts and the shape digest, never on the
behaviour digest (CLAUDE.md section 6b).

## Section 0: read first, on the database about to be changed

```sql
select md5(string_agg(sig, '|' order by sig)), count(*)
from (select table_name||'.'||column_name||':'||data_type||':'||is_nullable as sig
      from information_schema.columns
      where table_schema='public' and table_name like 'eng\_%') t;
-- Expect: 4ccff0ee13040992a71d16d2b14163a3, 1210.

select table_name from information_schema.tables
 where table_schema = 'public'
   and table_name in ('eng_prospects', 'eng_contact_log', 'eng_refund_requests',
                      'eng_refund_decisions', 'eng_refund_approval_limits');
-- Expect: zero rows.

select key from eng_roles where key in ('rep', 'ops_manager');
-- Expect: zero rows.
```

If any of the three answers differs, stop and send it back: the database is not
where this document thinks it is.

## Section 1: development

`apply_migration` against `ythzaiqeoijlrdibnieo` with the file
`supabase/migrations/0079_two_staff_roles_and_the_work_they_do.sql`, name
`0079_two_staff_roles_and_the_work_they_do`.

## Section 2: read back on development, each its own statement

```sql
-- the shape query from section 0. Expect: 45ce47821d9c5567eb3b4b197549d881, 1263.

select c.relname, c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('eng_prospects', 'eng_contact_log', 'eng_refund_requests',
                     'eng_refund_decisions', 'eng_refund_approval_limits')
 order by c.relname;
-- Expect five rows, relrowsecurity true on every one.

select tgname from pg_trigger
 where tgname in ('eng_prospects_touch', 'eng_contact_log_immutable', 'eng_refund_requests_immutable',
                  'eng_refund_decisions_immutable', 'eng_refund_approval_limits_immutable')
 order by tgname;
-- Expect five rows.

select conname from pg_constraint
 where conname in ('eng_refund_decisions_within_limit', 'eng_contact_log_one_subject',
                   'eng_prospects_conversion_is_whole')
 order by conname;
-- Expect three rows.

select key, name, landing_path, is_system from eng_roles
 where key in ('rep', 'ops_manager') order by key;
-- Expect: ops_manager | Operations Manager | /portal | false
--         rep | Customer Service and Sales Rep | /portal | false

select role_key, count(*) from eng_role_grants
 where role_key in ('rep', 'ops_manager') group by role_key order by role_key;
-- Expect: ops_manager 26, rep 20.

select role_key, action from eng_role_grants
 where action in ('payments.send_link', 'pricing.override_at_intake', 'pricing.read_tech_rate', 'settings.refund_limit')
 order by action, role_key;
-- Expect, in this order:
--   admin payments.send_link, ops_manager payments.send_link, rep payments.send_link, sales payments.send_link,
--   admin pricing.override_at_intake,
--   admin pricing.read_tech_rate,
--   admin settings.refund_limit.
-- No dispatcher row anywhere in this answer, and no sales row except payments.send_link.

select count(*) from eng_refund_approval_limits;
-- Expect: 0. The limit is $0 until Robert sets it on /portal/settings.
```

Send the answers back. The session records them in `supabase/applied.mjs`
under `development`, then boards the branch on development, alone, with its
prediction stated first.

## Section 3: after the development board

The branch is held. It merges only inside the chat's production sitting, after
the production apply below is read back, because a migration on main is never
pending.

## Section 4: production, only in that sitting

Section 0 against `fsaryeciduszuahgjbly` first (same expected answers: shape
`4ccff0ee13040992a71d16d2b14163a3` across 1210, no tables, no roles). Then
`apply_migration` against `fsaryeciduszuahgjbly`, the same file and name. Then
every statement in Section 2 against production, with the same expected
answers.

## What it does not do

It touches no sealing, protocol signing or seal upload table or grant. It grants
no `payments.charge`, `payments.refund`, `payments.reconcile`, `pricing.write`,
`pricing.read`, `billing.read`, `ledger.*`, `profiles.create`, `roles.manage`
or `jobs.manage` to anybody new. It writes no price, no fee schedule row and no
refund limit.
