-- ===========================================================================
-- 0013: the partner program, accounts and the boundary
--
-- Phase 9 Section 1. Partners are a THIRD principal type: not customers and not
-- staff, on the same structural footing as the customer boundary built in 0009.
--
-- WHAT THIS IS NOT
-- ----------------
-- This is not multi tenancy. There is one firm, one TBPELS registration, one
-- engineer in responsible charge and one Stripe account. A partner brings
-- clients and is paid for it. Every document is still produced by 254
-- Engineering Services and sealed by its engineer, and nothing here creates a
-- second firm.
--
-- The operator's ruling of 2026-09-04, recorded in
-- docs/partner-program-decision.md: referral with constrained co branding. A
-- partner may appear beside the firm and never in place of it. Full white label
-- is rejected permanently and is NOT a configuration flag.
--
-- WHY A PARTNER IS NOT A CUSTOMER WITH A FLAG
-- -------------------------------------------
-- The two want opposite things. A customer sees their own orders and the
-- documents they bought. A partner sees who they referred and what they earned,
-- and must never see a client's evidence, an engineer's findings, a sealed
-- document, the firm's cost or the firm's margin.
--
-- A flag on eng_customer_users would mean every read in the customer surface
-- has to ask which sort of principal this is, and one missing check would leak
-- a client's file to a referrer. A partner therefore has no row in
-- eng_customer_users, no row in eng_profiles and no auth user, so neither the
-- customer nor the staff code can return one by accident.
-- ===========================================================================

-- ---------------------------------------------------------------- partners
--
-- Created by the operator, never by self signup. A partner using the firm's
-- name to win clients is a decision the firm makes, and a signup form is the
-- firm not making it.
create table if not exists eng_partners (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  organisation          text not null,
  contact_name          text not null,
  contact_email         text not null,
  contact_phone         text,

  status                text not null default 'active'
                          check (status in ('active', 'suspended', 'ended')),

  /*
   * The tracking code. Durable, human sayable, and unique.
   *
   * Human sayable matters more than it looks: the brief requires a code that
   * can be entered by hand at checkout, because a real referral often arrives
   * as a spoken recommendation rather than a click. A uuid cannot be read down
   * a phone. Case is normalised in the application so "Bayside" and "BAYSIDE"
   * are the same partner.
   */
  code                  text not null unique,

  -- Payout details. Deliberately free text and deliberately not a bank account:
  -- this platform records that a payout happened and never performs one, so it
  -- has no business holding the credentials to move money to a third party.
  payout_method         text,
  payout_reference      text,

  -- The program agreement, and the version of it they accepted. Both are
  -- needed: an agreement whose text changed after acceptance is an agreement
  -- nobody can prove the terms of.
  agreement_version     text,
  agreement_accepted_at timestamptz,

  notes                 text
);

create index if not exists eng_partners_status_idx on eng_partners (status, organisation);

drop trigger if exists eng_partners_touch on eng_partners;
create trigger eng_partners_touch before update on eng_partners
  for each row execute function eng_touch_updated_at();

alter table eng_partners enable row level security;

comment on table eng_partners is
  'A referral partner. Created by the operator, never by self signup, because a partner using the firm name is a decision the firm makes.';
comment on column eng_partners.code is
  'Durable and human sayable, because a referral often arrives spoken rather than clicked and a uuid cannot be read down a phone.';

-- ----------------------------------------------------------- partner users
--
-- The people who sign in on a partner's behalf. Separate from the partner for
-- the same reason eng_customer_users is separate from eng_customer_accounts: an
-- organisation outlives the individual who holds the login, and revoking one
-- person must not end the relationship.
create table if not exists eng_partner_users (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  partner_id        uuid not null references eng_partners (id) on delete cascade,
  email             text not null unique,
  display_name      text not null,

  -- scrypt with a per user salt, computed in the application, exactly as
  -- eng_customer_users does. There is no Supabase auth user behind a partner.
  --
  -- Both halves are stored. The salt was missing from the first draft of this
  -- migration, which would have made passwordMatches unable to recompute the
  -- hash and every partner sign in fail with correct credentials.
  password_hash     text,
  password_salt     text,

  status            text not null default 'invited'
                      check (status in ('invited', 'active', 'suspended')),

  last_sign_in_at   timestamptz
);

create index if not exists eng_partner_users_partner_idx
  on eng_partner_users (partner_id, status);

drop trigger if exists eng_partner_users_touch on eng_partner_users;
create trigger eng_partner_users_touch before update on eng_partner_users
  for each row execute function eng_touch_updated_at();

alter table eng_partner_users enable row level security;

comment on table eng_partner_users is
  'Who signs in for a partner. No auth user and no eng_profiles row, so neither the customer nor the staff code can return a partner by accident.';

-- ------------------------------------------------------- set password tokens
--
-- The same shape as eng_auth_tokens and eng_customer_access: stored hashed, so
-- a leaked row is not a leaked link.
create table if not exists eng_partner_tokens (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  user_id       uuid not null references eng_partner_users (id) on delete cascade,
  token_hash    text not null unique,
  purpose       text not null default 'set_password'
                  check (purpose in ('set_password', 'reset_password')),
  expires_at    timestamptz not null,
  used_at       timestamptz,
  issued_by     uuid references eng_profiles (id) on delete set null
);

create index if not exists eng_partner_tokens_user_idx
  on eng_partner_tokens (user_id, expires_at desc);

alter table eng_partner_tokens enable row level security;

-- --------------------------------------------------- compensation terms
--
-- WHY THE MODEL IS A ROW AND NOT A CODE PATH
-- ------------------------------------------
-- Whether a percentage of an engineering fee may be paid to an unlicensed
-- referrer is a question for TBPELS or a licensing attorney, and the operator
-- is getting the answer before any partner is paid. It was not going to be
-- answered before this was built.
--
-- So all four shapes are configuration. If the answer is "flat fees only", the
-- percentage model is removed by deleting one check constraint value and one
-- audit assertion, and no schema and no screen moves. If the answer is
-- "percentage is fine", nothing moves at all.
--
-- Terms are effective dated rather than edited in place, for the same reason the
-- fee schedule is: a partner's earnings were computed under the terms in force
-- at the time, and changing the row would change history.
create table if not exists eng_partner_terms (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  partner_id        uuid not null references eng_partners (id) on delete cascade,

  model             text not null
                      check (model in (
                        'percent_of_order',
                        'flat_per_order',
                        'flat_per_qualified_lead',
                        'tiered_by_volume')),

  -- Basis points, so a percentage is an integer and never a float. 250 is 2.5%.
  percent_bps       integer check (percent_bps is null or percent_bps between 0 and 10000),
  flat_cents        bigint check (flat_cents is null or flat_cents >= 0),

  -- For tiered_by_volume: [{ "min": 0, "bps": 250 }, { "min": 10, "bps": 300 }]
  tiers             jsonb,

  /*
   * The holdback window, in days, before an accrual becomes payable.
   *
   * It exists for the same reason accrual happens on delivery rather than on
   * payment: a refund after the fact must not leave the firm having paid
   * commission on money it returned.
   */
  holdback_days     integer not null default 30 check (holdback_days >= 0),

  effective_from    date not null,
  effective_to      date,

  set_by            uuid references eng_profiles (id) on delete set null,
  note              text
);

create index if not exists eng_partner_terms_partner_idx
  on eng_partner_terms (partner_id, effective_from desc);

alter table eng_partner_terms enable row level security;

comment on table eng_partner_terms is
  'Compensation terms, effective dated. All four models are configuration so the fee splitting answer changes a row rather than a code path.';

-- ------------------------------------------------- the program agreement
--
-- Versioned, and every acceptance records which version. An agreement whose
-- text changed after acceptance is an agreement nobody can prove the terms of.
create table if not exists eng_partner_agreements (
  version       text primary key,
  created_at    timestamptz not null default now(),
  published_at  timestamptz,
  body          text not null,
  summary       text
);

alter table eng_partner_agreements enable row level security;

create table if not exists eng_partner_acceptances (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  partner_id        uuid not null references eng_partners (id) on delete cascade,
  user_id           uuid references eng_partner_users (id) on delete set null,
  agreement_version text not null references eng_partner_agreements (version) on delete restrict,
  accepted_at       timestamptz not null default now(),
  ip                text,
  user_agent        text
);

create index if not exists eng_partner_acceptances_partner_idx
  on eng_partner_acceptances (partner_id, accepted_at desc);

alter table eng_partner_acceptances enable row level security;

/*
 * An acceptance is a fact about a moment. It refuses UPDATE and DELETE for the
 * same reason the responsible charge log does: it is the record that a partner
 * agreed not to present itself as an engineering firm, and it is the record the
 * firm would produce if a partner ever did.
 */
drop trigger if exists eng_partner_acceptances_immutable on eng_partner_acceptances;
create trigger eng_partner_acceptances_immutable
  before update or delete on eng_partner_acceptances
  for each row execute function eng_forbid_mutation();

comment on table eng_partner_acceptances is
  'Append only. The record that a partner agreed not to present as an engineering firm, which is the record the firm would produce if one ever did.';

-- ============================================================================
-- PARTNER STATEMENTS, AND WHY THEY ARE NOT eng_statements
--
-- OPERATOR RULING, 2026-09-04: record this here, because a later session will
-- read two statement tables as duplication and try to merge them.
--
-- THEY POINT IN OPPOSITE DIRECTIONS.
--
-- eng_statements is money coming IN. Its subject is
-- `account_id uuid not null references eng_customer_accounts`, it is issued to
-- a customer who then owes the firm, and eng_order_payments records settlement
-- against it with `kind in ('charge', 'refund')`.
--
-- A partner statement is money going OUT to a third party. Its subject is a
-- partner, nobody owes the firm anything as a result of it, and it is settled
-- by the operator recording that a payout happened outside this platform.
--
-- Merging them would mean one of two things, and both are worse than a second
-- table:
--
--   A nullable subject on a table whose entire point is naming one, so every
--   read asks "which sort of statement is this" and a missing branch bills a
--   customer for a partner's commission.
--
--   Or a statement whose SIGN depends on which foreign key is populated, in the
--   part of this platform that is most careful about a figure meaning exactly
--   one thing.
--
-- What IS reused is the SHAPE, deliberately and in full: the same status
-- machine, the same close and issue split, the same rule that an issued
-- statement is never reopened. Those are right here for the same reasons they
-- are right there. The row is separate; the thinking is not.
-- ============================================================================

create table if not exists eng_partner_statements (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  partner_id        uuid not null references eng_partners (id) on delete restrict,
  reference         text not null unique,
  period            text not null,

  status            text not null default 'open'
                      check (status in ('open', 'issued', 'paid', 'void')),

  total_cents       bigint,
  currency          text not null default 'usd',

  issued_at         timestamptz,

  -- Recorded, never automated. This platform does not move money to third
  -- parties, and the operator enters the reference from wherever they did.
  paid_at           timestamptz,
  payout_reference  text,

  unique (partner_id, period)
);

create index if not exists eng_partner_statements_partner_idx
  on eng_partner_statements (partner_id, period desc);

drop trigger if exists eng_partner_statements_touch on eng_partner_statements;
create trigger eng_partner_statements_touch before update on eng_partner_statements
  for each row execute function eng_touch_updated_at();

alter table eng_partner_statements enable row level security;

comment on table eng_partner_statements is
  'Money going OUT to a partner. Separate from eng_statements, which is money coming IN from a customer: see the block comment in 0013 for why merging them would be worse than duplicating the shape.';

alter table eng_partners enable row level security;
