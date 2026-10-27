# Sitting: 0095 and 0096, WPI-8 ongoing opens through a scope addendum

Written 2026-10-26 on `feat/wpi8-ongoing-addendum`, which sits on 0094 and therefore on 0090 to 0093, because the chain is in order (Robert's answer 11 of 08:19 Central). The chat applies both with `apply_migration`, development first, then production, each after 0094. The branch merges only after the production apply is read back, and a migration on main is never pending.

## Why

- **0095**, Robert's ruling of 07:10 Central. WPI-8 ongoing construction (`windstorm-wpi-8/ongoing`) opens through a scope addendum: $175 per job, one flat amount covering every stage review and the issued certificate, signed by the engineer in the portal through 0082's door. 0082's table could only price a design quote, so 0095 lets a row say it is `per_job`.
- **0096**, his answer 12 of 08:19 Central. 254-WP-001 goes in force for the ongoing tier only. 0052's approval retired every published protocol on the same line, which would have retired 254-WS-001 and closed completed construction. 0096 retires by line and tier, and makes 0081's hold on WP-001 conditional on a signed addendum.

Neither migration puts anything in force or opens anything by itself. The line opens only after the office drafts the addendum in the portal, the engineer signs it, his WP-001 v1.2 signature is put in force, and somebody is trained on WP-001.

## Predicted figures

| | Shape | Columns | Behaviour | Facts |
| --- | --- | --- | --- | --- |
| at 0094 | `8daaba436e02fb92c9a6b227fcb98caf` | 1353 | `9996160feeebb47be1426e84e760524e` | 1281 |
| at 0095 | `7cd992a839ac7f3997910a36208f3cd1` | 1354 | `3dcf0b3e3917ef44c1127d399afce71e` | 1285 |
| at 0096 | `6adde27e5bd8a1a52cf5a2d0500af466` | 1355 | `deb92bee42354ce8ef9b74a4955a90c7` | 1286 |

Judge a live read-back on the counts and the rows below, never on the behaviour digest.

## Section 0: read first

```sql
select document_number, version_label, status from eng_protocol_templates
 where service_slug = 'windstorm-wpi-8' order by document_number, version_label;
-- Expect on production: 254-WS-001 v1.1 published; 254-WP-001 v1.2 not published (held), with a live
-- protocol seal act. Write down WS-001's status: it must read published after both migrations.

select count(*) from eng_scope_addenda;
-- Expect: the design addenda already recorded, every one design_share once 0095 adds the column.
```

## Section 1: apply

1. `apply_migration` with `supabase/migrations/0095_a_scope_addendum_can_pay_a_flat_amount_per_job.sql`, name `0095_a_scope_addendum_can_pay_a_flat_amount_per_job`. It carries three `drop not null` statements, on `quote_id`, `fee_cents` and `share_bp`. Each is still required on every design row by the shape check added in the same file.
2. `apply_migration` with `supabase/migrations/0096_a_protocol_is_in_force_for_its_tier.sql`, name `0096_a_protocol_is_in_force_for_its_tier`.

## Section 2: read back

```sql
select basis, count(*) from eng_scope_addenda group by basis;          -- design_share only
select document_number, version_label, service_tier, status from eng_protocol_templates
 where service_tier is not null order by 1, 2;
-- Expect: 254-WP-001 rows ongoing (not published), 254-WS-001 v1.1 completed and STILL published.
select count(*) from eng_line_pay('windstorm-wpi-8/ongoing');           -- 0: nothing signed yet
select role_key from eng_role_grants where action = 'addenda.draft';    -- admin
-- and the shape query: 1355 columns after both.
```

**WS-001 reading anything but published is a stop.** Report it on issue #1 and do nothing further. A difference in any count is a stop. In replay, `scripts/proofs/wpi8-ongoing-opens-only-on-its-own-signed-addendum.mjs` walks the whole sequence, with completed construction orderable at every step.

## After the sitting, not part of it

- The office drafts the addendum in the portal; the engineer signs it from his own session.
- The chat records Robert's training on WP-001 v1.2 through the relayed-approval door, as for the other eight protocols (supervised 2026-10-15, approved by phone 2026-10-23).
