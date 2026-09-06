-- ===========================================================================
-- 0019: partner compensation
--
-- Phase 9 Section 3. 0013 gave a partner terms and a statement to be paid on.
-- Nothing in between existed: no record of what was earned, when it became
-- payable, or what happened to it when the customer got their money back.
--
-- WHAT THIS TABLE IS
-- ------------------
-- A LEDGER, not a list of amounts owed. An accrual is written when the firm
-- delivers, and it is never edited afterwards. A refund does not reduce it: a
-- reversal is written beside it and the two net. A correction does not amend
-- it: an adjustment is written beside it and the three net.
--
-- OPERATOR RULING, 2026-09-04, carried from docs/partner-program-decision.md:
-- accrue on delivery and reverse by counter entry. The reasoning is worth
-- keeping here rather than only in the document, because the alternative looks
-- so much simpler in code.
--
-- Accruing on PAYMENT would have the firm paying commission on money it later
-- returned, and that is not an edge case here. The refund rule makes two of the
-- four decline outcomes a FULL refund, and an engineer declining before a site
-- visit is an ordinary Tuesday.
--
-- Editing an accrual when a refund arrives would be smaller, faster, and would
-- destroy the only thing that makes a partner program survivable: a partner
-- being able to reconcile a statement against what they were told last month.
-- A number that moves after the fact is a number nobody can check, and the
-- first time a partner notices, they assume the worst and they are not wrong to.
--
-- WHY THE ENTRIES ARE THE STATEMENT LINES, WHERE THE CUSTOMER SIDE COPIES THEM
-- ---------------------------------------------------------------------------
-- eng_statement_lines copies the description and amount off the order rather
-- than joining to it, because an order can be re-priced and the statement in
-- the customer's filing cabinet must not silently disagree.
--
-- That reason does not apply here, and following the pattern anyway would be
-- cargo cult. An entry CANNOT change: the trigger below refuses it. So the
-- statement claims entries by id, the same way a customer statement claims
-- orders, and there is no second copy of a figure to drift.
-- ===========================================================================

create table if not exists eng_partner_entries (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  partner_id        uuid not null references eng_partners (id) on delete restrict,

  kind              text not null check (kind in ('accrual', 'reversal', 'adjustment')),

  /*
   * NULL IS A REAL STATE HERE, AND IT IS NOT ZERO.
   *
   * ops-money's whole thesis, in the schema: a commission that is owed and
   * cannot be worked out is not a commission of nothing. It happens for real
   * reasons, a delivered file whose order carries no total among them, and the
   * wrong answer is an entry of 0 that nets to nothing and is never looked at
   * again.
   *
   * So a blocked entry stands in the ledger with no figure, is excluded from
   * every total, and appears on the operator's side as work to do. The check
   * constraint makes the two facts one fact: blocked if and only if there is no
   * amount.
   */
  amount_cents      bigint,
  currency          text not null default 'usd',

  status            text not null default 'accrued'
                      check (status in ('accrued', 'blocked')),

  constraint eng_partner_entries_blocked_iff_absent
    check ((status = 'blocked') = (amount_cents is null)),

  /*
   * Signs, so a reader never has to know which way a kind points. An accrual
   * is money the firm owes and is positive; a reversal takes it back and is
   * negative; an adjustment corrects in either direction and is the only kind
   * that may be either.
   */
  constraint eng_partner_entries_sign
    check (
      amount_cents is null
      or (kind = 'accrual'  and amount_cents >= 0)
      or (kind = 'reversal' and amount_cents <= 0)
      or  kind = 'adjustment'
    ),

  -- --------------------------------------------------------- what it came from
  --
  -- The terms in force when it was computed, snapshotted rather than joined.
  -- Terms are effective dated and a partner's rate changes; an entry has to be
  -- explainable in the terms it was actually computed under, years later, and
  -- the row it points at may by then be one of six.
  terms_id          uuid references eng_partner_terms (id) on delete set null,
  model             text check (model is null or model in (
                      'percent_of_order',
                      'flat_per_order',
                      'flat_per_qualified_lead',
                      'tiered_by_volume')),
  percent_bps       integer,
  flat_cents        bigint,

  -- What the percentage was applied to. The order total, where there is one.
  basis_cents       bigint,

  /*
   * The sentence the rule module produced, stored verbatim, exactly as
   * eng_service_orders.attribution_reason stores the attribution rule's.
   *
   * A partner asking why a line is what it is gets the reason the platform
   * actually used rather than somebody's reconstruction of it from the numbers.
   */
  explanation       text not null,

  -- ----------------------------------------------------------- what it is about
  file_id           uuid references eng_files (id) on delete set null,
  order_id          uuid references eng_service_orders (id) on delete set null,
  lead_id           uuid references eng_leads (id) on delete set null,

  -- The accrual a reversal or adjustment answers.
  reverses_id       uuid references eng_partner_entries (id) on delete restrict,

  -- The refund row that caused a reversal, so one refund reverses once.
  payment_id        uuid references eng_order_payments (id) on delete set null,

  -- ------------------------------------------------------------------- timing
  occurred_at       timestamptz not null default now(),

  /*
   * The holdback, computed from the terms in force and STORED, never derived
   * later. holdback_days can change; when it does, what was already earned
   * keeps the window it was earned under.
   */
  payable_at        timestamptz not null,

  -- Claimed by a statement, which is the only column a close may write.
  statement_id      uuid references eng_partner_statements (id) on delete set null
);

create index if not exists eng_partner_entries_partner_idx
  on eng_partner_entries (partner_id, occurred_at desc);
create index if not exists eng_partner_entries_statement_idx
  on eng_partner_entries (statement_id) where statement_id is not null;
create index if not exists eng_partner_entries_payable_idx
  on eng_partner_entries (partner_id, payable_at) where statement_id is null;
create index if not exists eng_partner_entries_file_idx
  on eng_partner_entries (file_id) where file_id is not null;

/*
 * IDEMPOTENCE IS A CONSTRAINT, NOT A CONVENTION.
 *
 * Delivery can be attempted twice: a transition retried, a job replayed, an
 * operator pressing a button again because the first press appeared to do
 * nothing. Each of those paths is careful, and "each of those paths is careful"
 * is exactly the guarantee that fails quietly the day a fifth path is added.
 *
 * One accrual per file, one per lead, and one reversal per refund payment.
 */
create unique index if not exists eng_partner_entries_one_accrual_per_file
  on eng_partner_entries (file_id) where kind = 'accrual' and file_id is not null;
create unique index if not exists eng_partner_entries_one_accrual_per_lead
  on eng_partner_entries (lead_id) where kind = 'accrual' and lead_id is not null;
create unique index if not exists eng_partner_entries_one_reversal_per_payment
  on eng_partner_entries (payment_id) where kind = 'reversal' and payment_id is not null;

drop trigger if exists eng_partner_entries_touch on eng_partner_entries;
create trigger eng_partner_entries_touch before update on eng_partner_entries
  for each row execute function eng_touch_updated_at();

alter table eng_partner_entries enable row level security;

-- ============================================================================
-- THE ENTRY IS FROZEN EXCEPT FOR BEING CLAIMED BY A STATEMENT
--
-- Narrow, in the shape 0014 established for attribution: name the columns that
-- must not move rather than forbidding UPDATE outright, because there is
-- exactly one legitimate later change to an entry and it is statement_id.
--
-- eng_forbid_mutation would have been simpler and would have made the close
-- impossible, which is how a table ends up with a "corrections" column that
-- everything reads instead.
-- ============================================================================

create or replace function eng_freeze_partner_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
       new.partner_id   is distinct from old.partner_id
    or new.kind         is distinct from old.kind
    or new.amount_cents is distinct from old.amount_cents
    or new.status       is distinct from old.status
    or new.model        is distinct from old.model
    or new.percent_bps  is distinct from old.percent_bps
    or new.flat_cents   is distinct from old.flat_cents
    or new.basis_cents  is distinct from old.basis_cents
    or new.explanation  is distinct from old.explanation
    or new.file_id      is distinct from old.file_id
    or new.order_id     is distinct from old.order_id
    or new.lead_id      is distinct from old.lead_id
    or new.reverses_id  is distinct from old.reverses_id
    or new.payment_id   is distinct from old.payment_id
    or new.occurred_at  is distinct from old.occurred_at
    or new.payable_at   is distinct from old.payable_at
  ) then
    raise exception
      'A partner entry is a fact about a moment and does not change. Entry %, partner %. Correct it with an adjustment entry beside it, which both parties can still read.',
      old.id, old.partner_id
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

comment on function eng_freeze_partner_entry is
  'Refuses any change to a partner ledger entry except being claimed by a statement. A correction is an adjustment entry beside it, never an edit.';

drop trigger if exists eng_partner_entries_frozen on eng_partner_entries;
create trigger eng_partner_entries_frozen
  before update on eng_partner_entries
  for each row execute function eng_freeze_partner_entry();

/*
 * DELETE is refused outright. There is no legitimate reason to remove an entry
 * and every reason to keep one that turned out to be wrong beside the
 * adjustment that answered it.
 *
 * eng_forbid_mutation refuses UPDATE as well, which is why this is its own
 * function rather than that one: the freeze above has to let a close through.
 */
create or replace function eng_forbid_partner_entry_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception
    'A partner entry is never deleted. Entry % stands, and a mistake is answered with an adjustment beside it.',
    old.id
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists eng_partner_entries_no_delete on eng_partner_entries;
create trigger eng_partner_entries_no_delete
  before delete on eng_partner_entries
  for each row execute function eng_forbid_partner_entry_delete();

comment on table eng_partner_entries is
  'The partner ledger. An accrual on delivery, a reversal beside it when money goes back, an adjustment beside both when something was wrong. Nothing here is ever edited.';

-- --------------------------------------------------------------------------
-- The payout, recorded rather than performed.
--
-- 0013 gave eng_partner_statements paid_at and payout_reference. This adds the
-- one thing it lacked: WHO recorded that the money moved. The platform does not
-- send money to third parties and will not; somebody pays the partner however
-- the firm pays anybody, and writes down what they did.
-- --------------------------------------------------------------------------
alter table eng_partner_statements add column if not exists paid_by uuid
  references eng_profiles (id) on delete set null;
alter table eng_partner_statements add column if not exists paid_note text;

comment on column eng_partner_statements.paid_by is
  'Who recorded the payout. The platform never moves money to a third party; this is the record that a person did.';
