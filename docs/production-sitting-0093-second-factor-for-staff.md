# Sitting: 0093, the second factor is required for the administrator, the office and the rep

Written 2026-10-26 on `migration/0093-second-factor-for-staff`, which sits on 0092 and therefore on 0091 and 0090, because the chain is in order. The chat applies it with `apply_migration`, development first, then production, each after 0092. The branch merges only after the production apply is read back, and a migration on main is never pending.

## Why

Robert's addendum of 2026-10-25, item 5: two-factor for admin, ops_manager and rep.
- 0025 made the second factor optional for the administrator and the engineer.
- 0070 required it for the engineer and, by the ruling of 2026-10-10, left the administrator optional.
- This requires it for the three roles named. Every other role keeps what it has.

## What it does to a person

Anybody active in those three roles who has not enrolled is sent to enrolment at their next sign in, and cannot reach the portal until they have. Somebody already enrolled notices nothing. The lockout that 0025 guarded against is answered by the recovery codes 0024 issues at enrolment. **So the dry run reads who is not enrolled, before anything is applied.**

## Predicted figures

| | Shape | Columns | Behaviour | Facts |
| --- | --- | --- | --- | --- |
| at 0092 | `8daaba436e02fb92c9a6b227fcb98caf` | 1353 | `92e2d140a1aefe8192833d9809b7d428` | 1281 |
| at 0093 | `8daaba436e02fb92c9a6b227fcb98caf` | 1353 | `d76bf14347aef9223a5c933065013bd1` | 1281 |

The behaviour digest moves because it hashes the seeded `eng_roles` rows, as it did for 0070. Judge a live read-back on the rows below, never on the digest.

## Section 0: read first

```sql
select key, mfa_requirement from eng_roles where key in ('admin', 'engineer', 'ops_manager', 'rep') order by key;
-- Expect: admin optional, engineer required, ops_manager optional, rep optional.

select p.role, p.email, p.status,
       exists (select 1 from eng_mfa_enrolments e where e.user_id = p.id and e.verified_at is not null) as enrolled
  from eng_profiles p
 where p.role in ('admin', 'ops_manager', 'rep') and p.status = 'active'
 order by p.role, p.email;
-- Read the enrolled column before applying. Anybody reading false is sent to
-- enrolment at their next sign in. Tell Robert who, and wait for his word if
-- it includes the owner's own account.
```

## Section 1: apply

`apply_migration` with the file `supabase/migrations/0093_the_second_factor_is_required_for_the_administrator_the_office_and_the_rep.sql`, name `0093_the_second_factor_is_required_for_the_administrator_the_office_and_the_rep`. The file refuses itself, raising, unless the four roles read required afterwards and all three named roles exist.

## Section 2: read back

```sql
select key, mfa_requirement from eng_roles order by key;
-- Expect: admin, engineer, ops_manager and rep required; every other role as it read before.

-- the shape query. Expect: 8daaba436e02fb92c9a6b227fcb98caf, 1353, unchanged.
```

**A difference is a stop.** Report it on issue #1 and do nothing further. In replay, `scripts/proofs/the-second-factor-is-required-for-staff.mjs` reads every role before and after the chain's 0093.

## What this does not do

- It enrols nobody and signs nobody out.
- It changes no other role and touches no profile.
