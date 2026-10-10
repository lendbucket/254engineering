# Production sitting: fix/second-factor-required (0070)

Staged 2026-10-10 in the weekend run. Nothing here has been run. The
counterpart runs each step; the session runs none. **0070 follows 0069 and
0068**: apply those first.

`supabase/migrations/0070_the_second_factor_is_required_for_staff_who_seal_or_administer.sql`.
Two rows: `eng_roles.mfa_requirement` goes from `optional` to `required` for
`admin` and `engineer` (operator ruling, 2026-10-10, gaps 3 and 4). No schema
change. Every other role keeps what it has.

**What it does to a person.** An administrator or engineer who has not enrolled
a second factor is sent to enrolment at their next sign in and cannot reach the
portal until they have. Somebody enrolled notices nothing. So step 1 reads who
that is before anything is applied.

## 1. Dry run, read only, before applying

```sql
select key, mfa_requirement from eng_roles where key in ('admin', 'engineer') order by key;
```

**Predict:** both `optional` (0025).

```sql
select p.role, p.email, p.status,
       exists (select 1 from eng_mfa_enrolments e where e.user_id = p.id and e.verified_at is not null) as enrolled
from eng_profiles p
where p.role in ('admin', 'engineer') and p.status = 'active'
order by p.role, p.email;
```

**Predict, production:** the operator's administrator account and the engineer
of record's account, and nobody else active in either role. **Read the
`enrolled` column before applying.** Anyone reading `false` will be sent to
enrolment at their next sign in; if that is the engineer, he needs his
authenticator app to hand the next time he signs in to seal. If either account
cannot enrol (no phone to hand), **do not apply yet**; say so, and the run
report carries it.

## 2. Apply, development first, then production

`apply_migration` with the file as written. Never `execute_sql`. The file reads
itself back and raises unless both roles read `required`.

## 3. Read back, on each

```sql
select key, mfa_requirement from eng_roles order by key;
```

**Predict:** `admin` and `engineer` read `required`; every other role reads
exactly what it read before the apply.

The shape fingerprint does **not** move (`18826fa5b3e7d9c9979ca81b96666bb7`
across 1171 columns); the fact count stays 973; the behaviour digest moves,
because `eng_roles` is a seeded table it hashes.

## 4. After the apply

The SOC 2 gap "MFA is optional by default for the administrator and engineer
roles" closes; its entry in `scripts/lib/soc2-controls.mjs` already records the
ruling and keeps the residual risk (one administrator able to lock himself out)
named, with the break-glass path as its answer.
