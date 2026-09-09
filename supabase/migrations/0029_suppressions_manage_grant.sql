-- ---------------------------------------------------------------------------
-- 0029: taking somebody off the marketing list becomes a grant.
--
-- Phase 12 Section 2. `suppressions.manage` is what the marketing suppression
-- screen asks for, and it goes to the administrator and to customer service.
--
-- WHY IT IS ITS OWN GRANT AND NOT PART OF messages.use
-- ----------------------------------------------------
-- They look adjacent and they are not the same decision. `messages.use` is
-- talking to somebody who is already in a conversation with the firm. This is a
-- decision about what the firm may say to a person at all, taken on that
-- person's behalf, usually from something they said on the telephone. The role
-- that does that is not the role that runs a campaign, and folding the two
-- together would mean anybody who can reply to a message can also stop the firm
-- writing to anybody.
--
-- WHY CUSTOMER SERVICE AND NOT SALES
-- -----------------------------------
-- The operator's ruling of 2026-09-08 on the customer service dashboard: that
-- role is measured on work in progress rather than on the lead inbox, and an
-- unsubscribe arriving by telephone is work in progress. Sales holds nothing
-- here. Somebody who is paid to grow a list should not be the one who can
-- quietly shorten it, and more to the point, the request does not arrive there.
--
-- WHAT THE GRANT DOES NOT BUY
-- ---------------------------
-- Removing a suppression that came from somebody clicking the unsubscribe link
-- in their own email. `removeOperatorEntry` in src/lib/marketing-suppression.ts
-- refuses that against the ROW rather than trusting the screen, whatever
-- permission the caller holds, because that row is the strongest evidence this
-- system has of anything and deleting it would be the platform asserting a
-- consent nobody gave. What the grant buys is recording a request, and undoing
-- a request that was mistyped when it was recorded.
--
-- 0026 says this table has no delete and no resubscribe column, and that stands
-- untouched. Resubscribing is consent, consent is a new fact with its own date,
-- and it gets its own table and its own ruling when somebody asks for it.
-- ---------------------------------------------------------------------------

insert into eng_role_grants (role_key, action) values
  ('admin', 'suppressions.manage'),
  ('customer_service', 'suppressions.manage')
on conflict (role_key, action) do nothing;
