-- ===========================================================================
-- 0021: the referral programme becomes a permission
--
-- Phase 9 Section 6. One row.
--
-- WHY A MIGRATION AND NOT A LINE IN 0018
-- --------------------------------------
-- 0018 turned roles and grants into data, seeded from DEFAULT_ROLES. Adding a
-- capability to that declaration therefore has to reach the database somehow,
-- and editing 0018 is not the way: it has been applied to production, and a
-- migration that changes after it runs is a migration nobody can reason about.
--
-- So the declaration grows in ops-authz.ts and the row arrives here. roles-audit
-- compares DEFAULT_ROLES against every migration in the chain rather than
-- against 0018 alone, which is the generalization this migration forced and
-- which was the right shape all along: what matters is that the declaration is
-- seeded somewhere, not that it is seeded in the first file that did it.
--
-- ADMIN ONLY, AND THAT IS THE WHOLE DECISION
-- ------------------------------------------
-- Behind this permission: who may use the firm's name to win work, what the
-- firm owes somebody outside it, and the record that money left. None of those
-- is a job somebody does on the firm's behalf without being the firm.
--
-- An owner can still grant it to a role they create, on the roles screen, and
-- that is the point of 0018. What this seed decides is where it starts.
-- ===========================================================================

insert into eng_role_grants (role_key, action) values
  ('admin', 'partners.manage')
on conflict (role_key, action) do nothing;
