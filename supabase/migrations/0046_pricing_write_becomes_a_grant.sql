-- ============================================================================
-- SETTING A TRADE PRICE IS ITS OWN GRANT.
-- ============================================================================
--
-- Phase 13 Section 2. `pricing.write` decides who may negotiate a price for one
-- account, and it is separate from `pricing.read` for the reason `roles.manage`
-- is separate from `profiles.update`: reading what the firm charges and
-- DECIDING what one account is charged are different acts, and a firm may well
-- want somebody who can see the money without being able to discount it.
--
-- IT DOES NOT DECIDE WHO MAY OVERRULE A FLOOR, because nobody may. A price
-- below its floor is refused at every role, in the application and again by a
-- check constraint on the row. This grant decides who may negotiate within what
-- the operator has already ruled.
--
-- Admin alone, matching DEFAULT_ROLES. roles-audit compares this migration
-- against that declaration and fails when a grant is in one and not the other,
-- which is the check that made 0021 necessary.

insert into eng_role_grants (role_key, action) values
  ('admin', 'pricing.write')
on conflict (role_key, action) do nothing;
