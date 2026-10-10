# Production sitting: fix/second-factor-required (0070)

Staged 2026-10-10 in the weekend run, **amended the same day before any apply**.
Nothing here has been run. The counterpart runs each step; the session runs
none. **0070 follows 0069 and 0068**: apply those first.

`supabase/migrations/0070_the_second_factor_is_required_for_the_engineer.sql`.
One row: `eng_roles.mfa_requirement` goes from `optional` to `required` for
`engineer` (operator ruling, 2026-10-10, gap 3). **The `admin` role stays
`optional`**, by the operator's later ruling of 2026-10-10, which replaced gap
4's; the file asserts it. No schema change. Every other role keeps what it has.

**If you have the earlier version of this document,** it named a file ending
`_for_staff_who_seal_or_administer.sql` and required both roles. That file no
longer exists and must not be applied.

**What it does to a person.** An engineer who has not enrolled a second factor
is sent to enrolment at their next sign in and cannot reach the portal until
they have. An enrolled engineer notices nothing. So step 1 reads who that is
before anything is applied.

## 1. Dry run, read only, before applying

```sql
select key, mfa_requirement from eng_roles where key in ('admin', 'engineer') order by key;
```

**Predict:** both `optional` (0025).

```sql
select p.role, p.email, p.status,
       exists (select 1 from eng_mfa_enrolments e where e.user_id = p.id and e.verified_at is not null) as enrolled
from eng_profiles p
where p.role = 'engineer' and p.status = 'active'
order by p.email;
```

**Predict, production:** the engineer of record's account, and nobody else
active in the role. **Read the `enrolled` column before applying.** If it reads
`false`, he is sent to enrolment at his next sign in and needs his
authenticator app to hand the next time he signs in to seal. If he cannot enrol
(no phone to hand), **do not apply yet**; say so, and the run report carries it.

## 2. Apply, development first, then production

`apply_migration` with the file as written. Never `execute_sql`. The file reads
itself back and raises unless `engineer` reads `required` and `admin` still
reads `optional`.

## 3. Read back, on each

```sql
select key, mfa_requirement from eng_roles order by key;
```

**Predict:** `engineer` reads `required`; `admin` reads `optional`; every other
role reads exactly what it read before the apply.

The shape fingerprint does **not** move (`18826fa5b3e7d9c9979ca81b96666bb7`
across 1171 columns); the fact count stays 973; the behaviour digest moves
(to `d7713204a6a44db437588585af0d0f8a` on a replay), because `eng_roles` is a
seeded table it hashes.

## 4. After the apply

In `scripts/lib/soc2-controls.mjs`, the gap "MFA is optional by default for the
administrator and engineer roles" closes its engineer half. **The administrator
half stays open, reason: operator's choice.**
