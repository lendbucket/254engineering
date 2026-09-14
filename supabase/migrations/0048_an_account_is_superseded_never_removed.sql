-- ============================================================================
-- AN ACCOUNT IS SUPERSEDED, NEVER REMOVED, AND NO CASCADE WINS OVER A MONEY
-- RECORD.
-- ============================================================================
--
-- Operator ruling, 2026-09-14, answering a question Phase 13 Section 2 raised
-- and could not decide:
--
--   "Soft delete on accounts. A duplicate or mistaken account gets marked
--    superseded with a reason and an actor, never removed, and the money record
--    stays intact. Every read excludes superseded accounts by default with an
--    explicit opt-in, the is_demo shape. No cascade ever wins over a money
--    record."
--
-- HOW THE QUESTION AROSE
-- ----------------------
-- 0045 made eng_account_trade_prices refuse DELETE, because a record of what
-- somebody was charged that vanishes when their account is tidied away is not a
-- record. The account cascades to it, so the cascade raised and the whole
-- delete failed. trade-pricing-audit's teardown found it by trying.
--
-- That left a real gap rather than a clean guarantee: an account that genuinely
-- should be removed, a duplicate or a mistake, could not be, and the failure
-- arrived as an exception about trade prices to somebody who had asked to
-- delete an account.
--
-- SUPERSEDED IS NOT CLOSED, AND THE DISTINCTION IS THE POINT
-- ----------------------------------------------------------
-- `status = 'closed'` already exists and means the relationship ended: the
-- customer stopped trading with the firm, and everything on the account is a
-- true record of work that happened.
--
-- `superseded_at` means the RECORD was wrong: a duplicate, a typo, an account
-- opened twice for one organisation. The work and the money attached to it are
-- still true and still have to be reachable; what is false is that this row is
-- a separate customer.
--
-- Collapsing the two would lose the ability to answer "did this customer leave
-- or did we open them twice", which is exactly the question somebody asks when
-- two accounts have the same name.
--
-- THE REASON AND THE ACTOR ARE NOT NULLABLE WHEN IT IS SET
-- --------------------------------------------------------
-- A soft delete with no reason is a row nobody can interpret, and the person
-- asking about it a year later cannot tell a deliberate correction from a
-- mistake somebody made in a hurry. The check makes the three move together.
--
-- WHY DELETE IS REFUSED OUTRIGHT RATHER THAN LEFT TO THE CASCADE
-- ---------------------------------------------------------------
-- Relying on the child's refusal means an account with no trade price CAN be
-- deleted, so the guarantee holds only for accounts that happen to have been
-- priced. That is a guarantee nobody can state. The trigger refuses every
-- account, and the message names supersession so the person reading it knows
-- what to do instead.
--
-- AND THE TRADE PRICE KEY BECOMES RESTRICT
-- -----------------------------------------
-- It was `on delete cascade`, which is now unreachable because the parent
-- refuses deletion. Changed anyway, to `restrict`, because the operator's
-- sentence is "no cascade ever wins over a money record" and a cascade that is
-- merely unreachable is one edit away from winning.

alter table eng_customer_accounts
  add column if not exists superseded_at timestamptz;

alter table eng_customer_accounts
  add column if not exists superseded_reason text;

alter table eng_customer_accounts
  add column if not exists superseded_by_profile_id uuid references eng_profiles (id) on delete set null;

/*
 * Denormalised beside the profile reference, for the reason 0045 records: the
 * question asked years later is WHO decided this, and a removed profile answers
 * it with a uuid resolving to nobody.
 */
alter table eng_customer_accounts
  add column if not exists superseded_by_email text;

alter table eng_customer_accounts
  drop constraint if exists eng_customer_accounts_superseded_is_explained;
alter table eng_customer_accounts
  add constraint eng_customer_accounts_superseded_is_explained
  check (
    superseded_at is null
    or (
      superseded_reason is not null
      and length(btrim(superseded_reason)) >= 10
      and superseded_by_email is not null
    )
  );

create index if not exists eng_customer_accounts_in_use_idx
  on eng_customer_accounts (site, status)
  where superseded_at is null;

comment on column eng_customer_accounts.superseded_at is
  'When this account record was marked as one that should not have existed separately: a duplicate, a typo, an organisation opened twice. NOT the same as status closed, which means the relationship ended and everything on the account is true. Every read excludes these by default.';
comment on column eng_customer_accounts.superseded_reason is
  'Why, in a sentence. A soft delete with no reason is a row nobody can interpret, and a year later nobody can tell a deliberate correction from a mistake made in a hurry.';

-- ------------------------------------------------------------- no deletion

create or replace function eng_forbid_account_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'An account is superseded, never deleted. Set superseded_at with a reason and an actor. The orders, statements and trade prices attached to it are the record of what somebody was charged.';
end;
$$;

drop trigger if exists eng_customer_accounts_no_delete on eng_customer_accounts;
create trigger eng_customer_accounts_no_delete before delete on eng_customer_accounts
  for each row execute function eng_forbid_account_delete();

-- ------------------------------- no cascade wins over a money record

alter table eng_account_trade_prices
  drop constraint if exists eng_account_trade_prices_account_id_fkey;

alter table eng_account_trade_prices
  add constraint eng_account_trade_prices_account_id_fkey
  foreign key (account_id) references eng_customer_accounts (id)
  on delete restrict;
