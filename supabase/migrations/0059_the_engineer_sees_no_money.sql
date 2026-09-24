/*
 * ===========================================================================
 * 0059  THE ENGINEER SHOULD NOT SEE WHAT THE FIRM MAKES.
 * ===========================================================================
 *
 * Operator ruling, 2026-09-24, in his words. The engineer sees no money in the
 * portal except his own pay: no order totals, no price charged, no costs, no
 * margin, no partner commission, no technician pay, no payouts, in any screen,
 * API response, export or email.
 *
 * DRAFTED 2026-09-24 AND NOT APPLIED. The overnight run it was written in has
 * no production access of any kind. Its ledger entry is pending and this file
 * holds a merge, which is the rule: a migration on main is never pending.
 *
 * WHAT IT DOES, AND IT IS TWO ACTS RATHER THAN ONE.
 *
 *   1. GRANTS the engineer `pricing.read_own_pay`, a new action that returns
 *      exactly one field, `engineer_cost_cents`, and only on a file whose
 *      `assigned_engineer_id` is that engineer. Another engineer's pay is as
 *      much "what the firm makes" as a margin is.
 *
 *   2. REVOKES `pricing.read` from the engineer. That is the grant that let
 *      redactFile return every money column on a file.
 *
 * WHY THE REVOKE IS A DELETE AND NOT A FLAG. `eng_role_grants` is a row per
 * (role, action) and `can()` asks whether the row exists. There is no "denied"
 * state to set, and inventing one would give this schema two ways to say no.
 *
 * AND IT IS THE FIRST MIGRATION IN THIS CHAIN TO REMOVE A GRANT. Every grant
 * migration before it has been additive, which is why this comment exists: the
 * delete is narrow, names both columns, and touches exactly one row. It is not
 * a cleanup and must not grow into one.
 *
 * IDEMPOTENT IN BOTH DIRECTIONS. The insert is `on conflict do nothing`, as
 * 0018 and 0021 are, and the delete names the pair so a second run removes
 * nothing that is already gone.
 *
 * WHAT IT DOES NOT DO. It does not touch `read_only`, which still holds
 * `pricing.read` because somebody evaluating the business has to see the money,
 * and it does not touch `admin`. `field_tech` never had it.
 *
 * THE CODE SIDE IS ALREADY IN THIS BRANCH. `DEFAULT_ROLES` in
 * `src/lib/ops-authz.ts` declares the same pair, and `roles-audit` compares the
 * declaration against this chain in both directions: a grant declared and not
 * seeded fails, and a grant seeded and not declared fails. Until this file is
 * applied, production's rows and this repository's declaration disagree, and
 * that disagreement is what the ledger entry records.
 */

-- ------------------------------------------------- one: he sees his own pay

insert into eng_role_grants (role_key, action) values
  ('engineer', 'pricing.read_own_pay')
on conflict (role_key, action) do nothing;

-- ------------------------------------- two: and nothing else about the money

delete from eng_role_grants
 where role_key = 'engineer'
   and action = 'pricing.read';
