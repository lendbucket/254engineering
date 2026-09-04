-- ===========================================================================
-- 0015: operator job intake, the telephone call path
--
-- Phase 10 Section 1. The gate 0 walk, recorded in docs/phase-10-gate-0.md,
-- found that an administrator cannot take a job from a telephone call through
-- to a priced, paid, dispatched technician. They can open an UNPRICED file and
-- nothing more.
--
-- This migration adds the columns that path needs. Deliberately small: most of
-- what was missing was a screen rather than a column, and the temptation with a
-- gap this visible is to add tables nobody asked for.
-- ===========================================================================

-- --------------------------------------------------------------- deliverable
--
-- eng_files.deliverable ALREADY EXISTS and nothing has ever written it. Not the
-- operator path, and not the customer path either: ops-intake resolves a tier
-- to price the order and then discards it, so a file has never been able to say
-- which of its service line's deliverables it is for.
--
-- No column is added here. It is named because a future reader finding a
-- populated `deliverable` column and no migration that introduced it will go
-- looking for one, and because the fact that it sat unwritten from Phase 6 to
-- Phase 10 is the kind of thing this schema records rather than tidies away.
--
-- The value is the catalog's `tier`, which is the same word eng_fee_schedule
-- already keys on, so one tier has one client price and one engineer production
-- figure and the two cannot drift into describing different things.

comment on column eng_files.deliverable is
  'The catalog tier this file is for. Existed unwritten from Phase 6 until Phase 10 Section 1; before that a file could not say which deliverable it was.';

-- ------------------------------------------------------------ how it arrived
--
-- The firm's primary intake is a telephone call, not the website. A file that
-- cannot say how it arrived cannot tell the operator which channel is worth
-- paying for, and cannot distinguish a job somebody typed in from a job a
-- customer placed themselves, which is a different commercial relationship with
-- a different payment story.
--
-- 'web' is the default because every file that existed before this migration
-- came from the order flow or from a lead the order flow captured, so
-- backfilling them as 'web' is true rather than convenient.
alter table eng_files add column if not exists intake_channel text not null default 'web'
  check (intake_channel in ('web', 'phone', 'email', 'walk_in', 'partner', 'other'));

comment on column eng_files.intake_channel is
  'How the job arrived. Defaults to web because every file predating Phase 10 came through the order flow, which makes the backfill true rather than merely convenient.';

-- --------------------------------------------------------------- the price
--
-- WHY TWO PRICE COLUMNS AND NOT ONE WITH AN EDIT
-- ----------------------------------------------
-- Operator ruling, Phase 10 Section 1 item 3: if the operator overrides the
-- catalog price, the override is recorded with a reason and the ORIGINAL
-- REMAINS VISIBLE. A price that changed with no record of who changed it or why
-- is a dispute the firm loses.
--
-- So client_price_cents stays what it has always been, the price that applies.
-- catalog_price_cents records what the catalog said at the moment of intake,
-- which is the number the customer would have been quoted on the website.
--
-- They are equal on an ordinary job. When they differ, somebody decided that,
-- and the three columns below say who, why, and when.
--
-- The catalog price is captured AT INTAKE rather than looked up later on
-- purpose. data/catalog.ts changes; a file quoted at last March's price must
-- keep saying so, exactly as eng_partner_terms is effective dated rather than
-- edited in place.
alter table eng_files add column if not exists catalog_price_cents bigint;
alter table eng_files add column if not exists price_override_reason text;
alter table eng_files add column if not exists price_overridden_by uuid references eng_profiles (id) on delete set null;
alter table eng_files add column if not exists price_overridden_at timestamptz;

comment on column eng_files.catalog_price_cents is
  'What the catalog said at the moment of intake, captured rather than looked up later, because data/catalog.ts changes and a file quoted at last March price must keep saying so.';
comment on column eng_files.price_override_reason is
  'Why the price differs from the catalog. A price that changed with no record of who changed it or why is a dispute the firm loses.';

-- The coastal surcharge, kept as its own figure for the same reason quoteFor
-- renders it as its own line: a customer comparing a Nueces property against a
-- published inland price will notice the difference, and finding out afterwards
-- is how a fixed price stops feeling fixed. Folding it into client_price_cents
-- would make the file unable to explain its own total.
alter table eng_files add column if not exists coastal_surcharge_cents bigint;

-- --------------------------------------------------- who took the call, and when
--
-- created_by already records which profile opened the file, and for a telephone
-- job that IS who took the call. What it cannot say is that a call happened at
-- all, or when, which for a job taken at 7pm and opened at 9am the next morning
-- are two different facts.
alter table eng_files add column if not exists intake_taken_at timestamptz;

comment on column eng_files.intake_taken_at is
  'When the call happened, which is not when the file was opened. A job taken at 7pm and entered the next morning is two facts, and created_at can only hold one of them.';

-- ------------------------------------------------------------------ payment
--
-- WHY A FILE CARRIES A PAYMENT STATE AT ALL WHEN ORDERS EXIST
-- -----------------------------------------------------------
-- Money is settled on eng_service_orders and this does not change that. There
-- is no amount here, no provider reference, and nothing reconciles against it.
--
-- What this records is a DECISION: the firm released work before it was paid
-- for. Section 1 item 4 requires that a job may be opened unpaid and that the
-- state says so plainly, "because work released before payment is a commercial
-- decision the firm should make deliberately rather than discover".
--
-- Deriving it from the absence of an order would make "nobody has paid" and
-- "nobody has decided how this gets paid" the same state, and they are not.
-- The first is a fact about the world; the second is the firm not having made
-- up its mind, which is the one worth surfacing on a screen.
alter table eng_files add column if not exists payment_intent text not null default 'unset'
  check (payment_intent in ('unset', 'link_sent', 'invoiced', 'released_unpaid', 'paid'));
alter table eng_files add column if not exists payment_note text;

comment on column eng_files.payment_intent is
  'The firm decision about how this job gets paid, not the money itself, which lives on eng_service_orders. released_unpaid is a deliberate commercial decision and is why this is not derived from the absence of an order.';

create index if not exists eng_files_intake_channel_idx
  on eng_files (intake_channel, created_at desc) where intake_channel <> 'web';
