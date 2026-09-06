-- ===========================================================================
-- 0022: the order remembers which visitor it was
--
-- Phase 9 Section 6, and it is a repair.
--
-- WHAT WAS MISSING
-- ----------------
-- 0014 keeps every partner touch, including the ones that lost, and says why in
-- its own comment: "a dispute is settled by showing the partner the touch that
-- beat theirs, which is impossible if only the winner is kept."
--
-- Section 6 built that screen and found the join was not there. A touch is
-- keyed by `visitor_key`, the opaque first party cookie value, and the ORDER
-- never stored the key it was attributed under. attributeOrder read the key
-- from the request, decided, wrote the answer, and let the key go.
--
-- So the touch log was complete and unreachable. From an order you could see
-- WHICH partner won and the sentence explaining why, and you could not see the
-- touches, which is the half a partner disputes.
--
-- The typed codes were the exception, because those touches are written under
-- the synthetic key `order:<id>` and could always be found. That is what made
-- this invisible: the dispute case that gets tested by hand is somebody typing
-- a code, and that one worked.
--
-- WHAT THIS DOES NOT FIX
-- ----------------------
-- Orders placed before it. Their key was never written down and cannot be
-- recovered, so the dispute screen shows what it can and says plainly that the
-- link touches for that order cannot be reconstructed. A screen that showed an
-- empty list would be saying there were no touches, which is a different claim
-- and not one this platform can make.
--
-- On production this costs nothing: no partner exists there, so no order has
-- ever been attributed.
-- ===========================================================================

alter table eng_service_orders add column if not exists visitor_key text;

comment on column eng_service_orders.visitor_key is
  'The first party cookie value the attribution was decided from, kept so the touch log can be joined back to the order. Not an identifier of a person: it is random, opaque, and carries nothing about them.';

/*
 * Partial, because the overwhelming majority of orders have no partner touch
 * behind them and never will. The index exists to answer one question on one
 * screen: show me the touches for this order.
 */
create index if not exists eng_service_orders_visitor_idx
  on eng_service_orders (visitor_key) where visitor_key is not null;
