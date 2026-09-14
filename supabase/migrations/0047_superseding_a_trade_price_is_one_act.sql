-- ============================================================================
-- SUPERSEDING A TRADE PRICE IS ONE ACT, SO IT IS ONE STATEMENT.
-- ============================================================================
--
-- Phase 13 Section 2, and this migration exists because trade-pricing-audit
-- caught the first version failing outright. The sequence is worth keeping,
-- because each attempt was refused by a guarantee 0045 put there on purpose.
--
-- ATTEMPT ONE, IN THE APPLICATION: insert the new row, then supersede the old.
-- The reasoning was that a price should be in force at every instant, and that
-- superseding first would leave a window in which a quote silently used the
-- catalogue price. The reasoning was right and the order was impossible: the
-- partial unique index refuses a second row in force, so supersession never
-- happened at all and the application reported a collision with itself.
--
-- ATTEMPT TWO, IN A FUNCTION, SAME ORDER: identical failure. A unique INDEX is
-- checked per statement, not at transaction end; only a DEFERRABLE unique
-- CONSTRAINT waits, and a partial uniqueness cannot be declared as a
-- constraint, which is why 0045 used an index.
--
-- ATTEMPT THREE: supersede first, then insert. Refused by the OTHER guarantee.
-- superseded_at and superseded_by must be set together, and the successor's id
-- does not exist yet, so the first update cannot satisfy the check.
--
-- WHAT ACTUALLY WORKS, AND IT IS THE SMALLEST CHANGE OF THE THREE
-- ----------------------------------------------------------------
-- Mint the successor's id before either write, and let the SELF REFERENCING
-- FOREIGN KEY be deferred to commit. Then:
--
--   1. update the old row: superseded_at and superseded_by together, pointing
--      at an id that does not exist yet. The check constraint is satisfied
--      because both fields are set. The foreign key would refuse, and is
--      deferred.
--   2. insert the new row with that id. The unique index is satisfied, because
--      the old row is no longer in force.
--   3. at commit, the foreign key is checked and resolves.
--
-- ONLY THE SELF REFERENCE IS DEFERRED. account_id and set_by_profile_id are
-- unchanged and are still checked immediately, because neither participates in
-- this chicken and egg and deferring a key that does not need it is widening a
-- guarantee for no reason.
--
-- NOTHING OUTSIDE THE TRANSACTION SEES ANY OF IT. The window the application
-- feared exists only between two separate requests, which is what this function
-- removes by being one.

alter table eng_account_trade_prices
  drop constraint if exists eng_account_trade_prices_superseded_by_fkey;

alter table eng_account_trade_prices
  add constraint eng_account_trade_prices_superseded_by_fkey
  foreign key (superseded_by) references eng_account_trade_prices (id)
  on delete restrict
  deferrable initially deferred;

create or replace function eng_set_trade_price(
  p_account_id          uuid,
  p_service_slug        text,
  p_tier                text,
  p_price_cents         integer,
  p_floor_cents_at_time integer,
  p_set_by_profile_id   uuid,
  p_set_by_email        text
)
returns table (new_id uuid, superseded_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old uuid;
  v_new uuid := gen_random_uuid();
begin
  /*
   * The row in force, locked, so two operators pricing the same deliverable at
   * the same moment cannot both read "none in force" and both insert.
   */
  select id into v_old
  from eng_account_trade_prices
  where account_id = p_account_id
    and service_slug = p_service_slug
    and tier = p_tier
    and superseded_at is null
  for update;

  if v_old is not null then
    update eng_account_trade_prices
    set superseded_at = now(), superseded_by = v_new
    where id = v_old;
  end if;

  insert into eng_account_trade_prices (
    id, account_id, service_slug, tier, price_cents, floor_cents_at_time,
    set_by_profile_id, set_by_email
  )
  values (
    v_new, p_account_id, p_service_slug, p_tier, p_price_cents, p_floor_cents_at_time,
    p_set_by_profile_id, p_set_by_email
  );

  return query select v_new, v_old;
end;
$$;

comment on function eng_set_trade_price is
  'Insert a trade price and supersede whatever it replaces, atomically. Neither order works from outside a transaction: inserting first collides with the partial unique index, superseding first cannot name a successor that does not exist. Inside one transaction, with the self reference deferred, both are correct. It does not check the floor, which lives in TypeScript and whose refusal names who ruled it and why.';
