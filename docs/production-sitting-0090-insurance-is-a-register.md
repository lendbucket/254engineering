# Sitting: 0090, insurance is a register

Written 2026-10-25 on `feat/insurance-register`. The chat applies it with `apply_migration`, development first, then production. The branch merges only after the production apply is read back, and a migration on main is never pending.

## Why

Robert's addendum of 2026-10-25, item 1, from the readiness audit. The firm's professional liability cover was a list typed into `src/config/credentials.ts` (`verifiedInsurance`), empty, with the owner's override expiring on 2026-10-28. Robert is binding the policy and will supply the certificate. By his ruling of 23:49 Central the same night, the override is extended to 2026-12-31 on its own branch, and its expiry is the only hard close.

## What changes

1. **`eng_insurance_policies`**: one row per policy as its certificate states it. That is the kind (professional or general liability), carrier, policy number, per claim and aggregate limits in cents, named insureds, effective and expiry dates, and the certificate's storage key, SHA-256 and size.
   - Check constraints: the aggregate is at least the per claim limit, the expiry is after the effective date, and a withdrawal is whole (when, who and a reason, or none of them).
   - `eng_insurance_policy_guard` refuses DELETE and every change except a single withdrawal.
   - `eng_insurance_policy_audit` writes every recording and withdrawal to `eng_audit_events`, in the same transaction.
2. **`eng_insurance_alerts`**: one row per policy and threshold (45, 14 or 1 days), keyed on both, so a warning is sent once. `eng_insurance_alert_guard` refuses any change or removal.
3. **The private `eng-insurance` bucket**: PDF only, 10 MB.
4. **`insurance.manage`**, granted to `admin` and `ops_manager`, the owner and the office.

RLS is on for both tables, with no policies. EXECUTE on the three trigger functions is revoked from public, anon and authenticated.

**It does not change the launch gate.** Robert ruled that the gate counts a register policy and the register never closes it while the override stands. How the gate counts it is put back to him (`BACKLOG.md`), because the one database read the gate may make is a signed protocol's. Until he answers, the gate reads the code list exactly as before.

No drop statement.

## Predicted figures

From `scripts/fingerprint-at.mjs`, with 0089 reproducing its recorded pair first:

| | Shape | Columns | Behaviour | Facts |
| --- | --- | --- | --- | --- |
| at 0089 | `05bb694a74ad7aeb15a3c37c8474d2da` | 1333 | `83c9992d0ebc4ef3a1ee2f82a262af28` | 1251 |
| at 0090 | `8daaba436e02fb92c9a6b227fcb98caf` | 1353 | `25076aa51d01188e59da94c9f6871ce0` | 1281 |

Tables 99 to 101, triggers 98 to 101, functions 64 to 67. A live read-back is judged on the shape digest and the counts, never on the behaviour digest (CLAUDE.md section 6b).

## Section 0: read first

```sql
-- the shape query. Expect: 05bb694a74ad7aeb15a3c37c8474d2da, 1333 (0089 applied).

select table_name from information_schema.tables
 where table_schema = 'public' and table_name in ('eng_insurance_policies', 'eng_insurance_alerts');
-- Expect: no rows.

select id from storage.buckets where id = 'eng-insurance';
-- Expect: no rows.

select role_key, action from eng_role_grants where action = 'insurance.manage';
-- Expect: no rows.
```

## Section 1: apply

`apply_migration` with the file `supabase/migrations/0090_insurance_is_a_register.sql`, name `0090_insurance_is_a_register`.

## Section 2: read back, each its own statement

```sql
-- the shape query. Expect: 8daaba436e02fb92c9a6b227fcb98caf, 1353.

select relname, relrowsecurity from pg_class
 where relname in ('eng_insurance_policies', 'eng_insurance_alerts') order by 1;
-- Expect two rows, both true.

select count(*) from eng_insurance_policies;
-- Expect: 0.

select tgname from pg_trigger
 where tgrelid in ('public.eng_insurance_policies'::regclass, 'public.eng_insurance_alerts'::regclass)
   and not tgisinternal order by 1;
-- Expect three: eng_insurance_alerts_guard, eng_insurance_policies_audit, eng_insurance_policies_guard.

select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'eng-insurance';
-- Expect one row: public false, 10485760, {application/pdf}.

select role_key from eng_role_grants where action = 'insurance.manage' order by 1;
-- Expect two rows: admin, ops_manager.

select has_table_privilege('anon', 'public.eng_insurance_policies', 'SELECT') as anon,
       has_table_privilege('authenticated', 'public.eng_insurance_policies', 'SELECT') as authenticated;
-- Expect: false, false.
```

**A difference in any count is a stop.** Report it on issue #1 and do nothing further. In replay, the proof `scripts/proofs/insurance-is-a-register-that-warns-before-it-lapses.mjs` fires every guard:
- delete and edit are refused;
- a withdrawal without a reason is refused, and a second withdrawal is refused;
- both acts are audited by the database;
- a second warning for one threshold is refused;
- only 45, 14 and 1 are thresholds;
- the grant is the two roles' alone.

## What this does not do

- It records no policy and sends no warning.
- It does not change whether the firm may take orders.
- It touches no existing row.

Recording the first policy is the office's or the owner's act in the portal, from the certificate Robert supplies.
