-- ===========================================================================
-- 0007: a service line can sell more than one deliverable.
--
-- Operator ruling, 2026-09-03. Residential and light commercial design sells
-- beam and header sizing at a fixed price, a carport and patio cover plan set
-- at a fixed price, and custom foundation and framing packages by quote. One
-- service page, three deliverables, two priced and one not.
--
-- WHY THE COLUMN IS CALLED tier
-- -----------------------------
-- Because eng_fee_schedule already is. That table keys on (kind, service_slug,
-- tier, county_band, urgency) and has since 0001, for the client price, the
-- technician's pay and the engineer's production alike.
--
-- Using the same word means one tier has one client price and one engineer
-- production figure, and the two cannot drift into describing different units.
-- Inventing a second name for the thing the fee schedule already prices at
-- would guarantee that drift.
--
-- WHY IT IS NULLABLE AND WHY THAT IS NOT A HOLE
-- ---------------------------------------------
-- Nullable so the rows written before this migration keep their meaning. Every
-- one of them belongs to a service line that has exactly one deliverable, so
-- the tier is unambiguous and recoverable; making it NOT NULL with a default of
-- 'standard' would write an assertion into history rather than leave it plain
-- that those rows predate the column.
--
-- The intake sets it on every new order. order-audit asserts the catalog is
-- unique on (serviceSlug, tier), which is what makes a stored pair resolvable.
-- ===========================================================================

alter table eng_service_orders add column if not exists tier text;
alter table eng_quote_requests add column if not exists tier text;

comment on column eng_service_orders.tier is
  'The deliverable within the service line, matching eng_fee_schedule.tier. Null on rows written before 2026-09-03, all of which belong to single deliverable service lines.';
comment on column eng_quote_requests.tier is
  'The deliverable within the service line, matching eng_fee_schedule.tier. A quoted deliverable on a line that also sells fixed price work.';

-- Looking an order up by what it actually is, which the billing screen and the
-- fee schedule both want.
create index if not exists eng_service_orders_deliverable_idx
  on eng_service_orders (service_slug, tier);
create index if not exists eng_quote_requests_deliverable_idx
  on eng_quote_requests (service_slug, tier);
