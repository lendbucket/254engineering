-- ============================================================================
-- A TRADE PRICE IS SUPERSEDED, NEVER EDITED, SO THE PRICE AN ORDER WAS QUOTED
-- UNDER IS ALWAYS RECOVERABLE.
-- ============================================================================
--
-- Phase 13 Section 2. An account can be given a price per deliverable that
-- differs from the published one, and the operator's rule is what this table is
-- shaped by:
--
--   "Append-only: never edited in place, only superseded, so the price an order
--    was quoted under is always recoverable."
--
-- WHY EDITING IN PLACE IS THE THING FORBIDDEN, AND NOT MERELY DISCOURAGED
-- -----------------------------------------------------------------------
-- A trade price is what a customer was charged. An UPDATE that moves it moves
-- the answer to "what did we agree" for every order already placed under it,
-- and there is no later audit that can tell a corrected price from a price that
-- was always that. eng_partner_ledger_entries has the same guarantee for the
-- same reason and 0019 argues it at length: a figure that can move after the
-- fact is a figure nobody can reconcile.
--
-- THE ONE COLUMN AN UPDATE MAY TOUCH, AND WHY THE SHAPE IS NARROW
-- ---------------------------------------------------------------
-- Superseding is itself an update: the old row learns when it stopped applying
-- and which row replaced it. Forbidding UPDATE wholesale would make supersession
-- impossible, which is how a table ends up with a "corrections" column that
-- everything reads instead. So the trigger guards every column EXCEPT
-- superseded_at and superseded_by, exactly as eng_freeze_partner_entry guards
-- everything except statement_id.
--
-- A row may only be superseded ONCE. Re-superseding an already superseded row
-- would rewrite which price replaced it, which is the same erasure the freeze
-- exists to prevent, so the trigger refuses it.
--
-- WHY THE FLOOR IS COPIED ONTO THE ROW
-- ------------------------------------
-- floor_cents_at_time records the floor this price was checked against when it
-- was set. The floors live in src/config/trade-floors.ts, which is a FILE, and
-- a file changes. Without this column, a floor lowered next year makes every
-- historical price look as though it had been checked against the new one, and
-- a price set at the old floor becomes indistinguishable from a price set below
-- a floor nobody was enforcing.
--
-- It is a copy of a fact that lives elsewhere, which is normally the defect.
-- Here the two answer different questions: the file says what the floor IS and
-- the row says what it WAS, and no amount of reading the file recovers the
-- second.
--
-- WHY set_by_email IS DENORMALISED BESIDE set_by_profile_id
-- ---------------------------------------------------------
-- The foreign key answers "which account did this" while that account exists.
-- The question asked years later is "who set this price", and a profile that
-- has been removed answers it with a uuid resolving to nobody. The same
-- reasoning 0039 records for eng_responsible_charge_log, applied before it
-- costs anything rather than after.
--
-- NO OVERRIDE COLUMN. There is deliberately nothing here recording that a price
-- was set below its floor with permission, because no such path exists at any
-- role. A column for it would be the first half of building one.

create table if not exists eng_account_trade_prices (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),

  account_id          uuid not null references eng_customer_accounts (id) on delete cascade,

  /* The deliverable, keyed exactly as data/catalog.ts keys it. */
  service_slug        text not null,
  tier                text not null,

  price_cents         integer not null,

  /* What the floor was when this was set. See the header. */
  floor_cents_at_time integer not null,

  set_by_profile_id   uuid references eng_profiles (id) on delete set null,
  set_by_email        text not null,

  /* Null while this is the price in force. */
  superseded_at       timestamptz,
  superseded_by       uuid references eng_account_trade_prices (id) on delete restrict,

  constraint eng_account_trade_prices_price_is_positive
    check (price_cents > 0),

  /*
   * AT OR ABOVE THE FLOOR, IN THE DATABASE AND NOT ONLY IN THE APPLICATION.
   *
   * The application refuses a price below the floor and says which floor and
   * why, which is the sentence a person needs. This is the statement about the
   * ROW, and it holds for anything written outside the application: a hand
   * typed insert, a future route, a script somebody writes in a hurry.
   *
   * It compares against the floor CARRIED ON THE ROW rather than against the
   * file, because a check constraint cannot read a TypeScript module. That is
   * the honest limit: this cannot tell whether floor_cents_at_time was the real
   * floor. What it can do is make "priced below the floor it was checked
   * against" unrepresentable, which is the half a database can hold.
   */
  constraint eng_account_trade_prices_at_or_above_floor
    check (price_cents >= floor_cents_at_time),

  /*
   * SUPERSEDED IS BOTH FIELDS OR NEITHER. A row carrying a time and no
   * successor is a price that stopped applying with nothing taking over, which
   * no code path can produce and no reader could interpret.
   */
  constraint eng_account_trade_prices_superseded_is_complete
    check ((superseded_at is null) = (superseded_by is null))
);

/* The price in force for an account and deliverable: at most one. */
create unique index if not exists eng_account_trade_prices_one_in_force
  on eng_account_trade_prices (account_id, service_slug, tier)
  where superseded_at is null;

create index if not exists eng_account_trade_prices_account_idx
  on eng_account_trade_prices (account_id, created_at desc);

alter table eng_account_trade_prices enable row level security;

-- ---------------------------------------------------------------- the freeze

create or replace function eng_freeze_trade_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.account_id is distinct from old.account_id
     or new.service_slug is distinct from old.service_slug
     or new.tier is distinct from old.tier
     or new.price_cents is distinct from old.price_cents
     or new.floor_cents_at_time is distinct from old.floor_cents_at_time
     or new.set_by_profile_id is distinct from old.set_by_profile_id
     or new.set_by_email is distinct from old.set_by_email
     or new.created_at is distinct from old.created_at
  then
    raise exception 'A trade price is superseded, never edited. Insert a new row and supersede this one.';
  end if;

  if old.superseded_at is not null
     and (new.superseded_at is distinct from old.superseded_at
          or new.superseded_by is distinct from old.superseded_by)
  then
    raise exception 'This trade price is already superseded. Re-superseding it would rewrite which price replaced it.';
  end if;

  return new;
end;
$$;

drop trigger if exists eng_account_trade_prices_freeze on eng_account_trade_prices;
create trigger eng_account_trade_prices_freeze before update on eng_account_trade_prices
  for each row execute function eng_freeze_trade_price();

create or replace function eng_forbid_trade_price_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'A trade price is never deleted. It is the price an order was quoted under.';
end;
$$;

drop trigger if exists eng_account_trade_prices_no_delete on eng_account_trade_prices;
create trigger eng_account_trade_prices_no_delete before delete on eng_account_trade_prices
  for each row execute function eng_forbid_trade_price_delete();

comment on table eng_account_trade_prices is
  'One row per trade price ever set for an account and deliverable. Append only: superseded, never edited, so the price an order was quoted under is always recoverable. Phase 13 Section 2.';
comment on column eng_account_trade_prices.floor_cents_at_time is
  'The floor this price was checked against when it was set. The floors live in a file and a file changes; without this, a floor lowered later makes every historical price look as though it had been checked against the new one.';
comment on column eng_account_trade_prices.set_by_email is
  'Denormalised beside set_by_profile_id because the question asked years later is who set this price, and a removed profile answers it with a uuid resolving to nobody.';
