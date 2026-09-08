-- ===========================================================================
-- 0026: who has asked not to receive marketing.
--
-- Phase 12, the email design port. One row per address that has unsubscribed,
-- and the whole table exists to answer one question before a marketing send.
--
-- WHY THIS IS AN ADDRESS AND NOT A PERSON
-- ----------------------------------------
-- There is nobody to key it to. A waitlist signup is an email address and a
-- name, with no account, no profile and no order; the launch announcement is
-- the only send that will ever read this table and it goes to exactly those
-- people. Keying it to a profile would mean the people who can unsubscribe are
-- the people who have portal accounts, which is staff.
--
-- Lowercased on the way in, because Someone@Example.com and
-- someone@example.com are one person and a suppression that misses on casing
-- is a suppression that did not happen.
--
-- WHY IT RECORDS THE SOURCE
-- --------------------------
-- `because` says what produced the row: a click on an unsubscribe link, a
-- complaint forwarded by the provider, or an operator acting on a request made
-- some other way. When somebody says they never asked to be removed, or asks
-- why they stopped hearing from the firm, the answer has to be findable.
--
-- WHY THERE IS NO DELETE AND NO RESUBSCRIBE COLUMN
-- -------------------------------------------------
-- Resubscribing is not the inverse of unsubscribing. Somebody who asks to
-- receive marketing again is giving consent, and consent is a new fact with its
-- own date rather than the absence of an old one. If that is ever built it gets
-- its own table and its own migration, and this one stays as the record of who
-- asked to stop and when.
--
-- WHAT THIS TABLE MUST NEVER GATE
-- --------------------------------
-- Anything transactional. A receipt, a sealed document notice and a refund
-- decision are owed to somebody who paid, whatever their marketing preference
-- says, and email-audit proves that a suppressed address still receives
-- order.confirmed and order.sealed. A customer who unsubscribes from marketing
-- and then does not get their receipt is the defect this comment exists to
-- prevent somebody introducing.
-- ===========================================================================

create table if not exists eng_marketing_suppressions (
  email       text primary key,
  created_at  timestamptz not null default now(),

  /* What produced this row. Not an enum: the list will grow and a check
   * constraint on a reason code is a migration every time somebody finds a new
   * way to be asked. */
  because     text not null,

  /* The token that was presented, when it came from a link. Null for an
   * operator entered suppression, which is the honest difference between "they
   * clicked" and "somebody says they asked". */
  token_hash  text,

  constraint eng_marketing_suppressions_lowercase check (email = lower(email))
);

alter table eng_marketing_suppressions enable row level security;

comment on table eng_marketing_suppressions is
  'One row per address that has asked not to receive marketing. Read by marketing sends only. A transactional email never consults this table, because a receipt is not marketing.';
comment on column eng_marketing_suppressions.because is
  'What produced the row: a click, a provider complaint, or an operator acting on a request made another way.';
