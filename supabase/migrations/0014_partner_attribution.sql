-- ===========================================================================
-- 0014: attribution
--
-- Phase 9 Section 2. If attribution is wrong, partners stop trusting the
-- program and the program dies, so this is built to be ARGUABLE rather than
-- merely present: the rule lives in one pure module, src/lib/attribution-rules.ts,
-- and what is stored is the answer it gave plus enough to re-derive it.
-- ===========================================================================

-- ------------------------------------------------------------------ touches
--
-- Every partner touch: a click on a tracked link, or a code typed at checkout.
--
-- WHY THE TOUCH LOG IS SEPARATE FROM THE ATTRIBUTION
-- --------------------------------------------------
-- A touch is evidence. An attribution is a decision made from the evidence. A
-- dispute is somebody disagreeing with the decision, and it cannot be settled
-- if the evidence was overwritten by the decision.
--
-- So the touches are kept, all of them, including the ones that lost. The
-- partner who did not get credit can be shown the touch that beat theirs and
-- when it happened, which is the difference between a program somebody trusts
-- and one they suspect.
create table if not exists eng_partner_touches (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),

  partner_id    uuid not null references eng_partners (id) on delete restrict,
  code          text not null,

  kind          text not null check (kind in ('link', 'code')),

  /*
   * Who this touch belongs to, before there is a customer to attach it to.
   *
   * A first party cookie value, opaque and random, set when a partner link is
   * first followed. It is not an identifier of a person and carries nothing
   * about them; it exists to join a click on Tuesday to an order on Friday.
   */
  visitor_key   text not null,

  landing_path  text,
  referrer      text,
  occurred_at   timestamptz not null default now()
);

create index if not exists eng_partner_touches_visitor_idx
  on eng_partner_touches (visitor_key, occurred_at desc);
create index if not exists eng_partner_touches_partner_idx
  on eng_partner_touches (partner_id, occurred_at desc);

alter table eng_partner_touches enable row level security;

/*
 * A touch is a fact about a moment and refuses UPDATE and DELETE.
 *
 * This is the evidence a dispute is settled from. Evidence that can be edited
 * after the decision is not evidence.
 */
drop trigger if exists eng_partner_touches_immutable on eng_partner_touches;
create trigger eng_partner_touches_immutable
  before update or delete on eng_partner_touches
  for each row execute function eng_forbid_mutation();

comment on table eng_partner_touches is
  'Every partner touch, including the ones that lost. A dispute is settled by showing the partner the touch that beat theirs, which is impossible if only the winner is kept.';

-- ------------------------------------------------- attribution on the records
--
-- The partner rides the SAME path the UTM parameters already take, rather than
-- a second one. eng_leads and eng_service_orders both already carry
-- utm_source, landing_path and referrer; this is one more column beside them.

alter table eng_leads add column if not exists partner_id uuid references eng_partners (id) on delete set null;
alter table eng_leads add column if not exists partner_code text;

alter table eng_service_orders add column if not exists partner_id uuid references eng_partners (id) on delete set null;
alter table eng_service_orders add column if not exists partner_code text;
alter table eng_service_orders add column if not exists attributed_at timestamptz;
-- The sentence the rule module produced, stored verbatim. A partner asking why
-- they did not get an order gets the reason the platform actually used rather
-- than somebody's reconstruction of it.
alter table eng_service_orders add column if not exists attribution_reason text;

alter table eng_files add column if not exists partner_id uuid references eng_partners (id) on delete set null;

create index if not exists eng_service_orders_partner_idx
  on eng_service_orders (partner_id, placed_at desc) where partner_id is not null;
create index if not exists eng_leads_partner_idx
  on eng_leads (partner_id, created_at desc) where partner_id is not null;

-- ================================================================ IMMUTABILITY
--
-- ATTRIBUTION IS FROZEN ONCE AN ORDER IS PAID.
--
-- A partner's earnings cannot change retroactively. That is not a nicety: a
-- program where yesterday's earnings can move is a program whose statements
-- nobody can reconcile, and the first time it happens the partner assumes the
-- worst.
--
-- A dispute is resolved by the operator recording a decision, which writes an
-- audit row and a compensating entry. It is never resolved by editing this.
--
-- The trigger is deliberately narrow: it guards the three attribution columns
-- and nothing else, because a paid order legitimately changes in other ways.
-- Its own search_path is pinned, exactly as 0008 pinned the others.
-- ============================================================================

create or replace function eng_freeze_attribution()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.paid_at is not null and (
       new.partner_id is distinct from old.partner_id
    or new.partner_code is distinct from old.partner_code
    or new.attributed_at is distinct from old.attributed_at
  ) then
    raise exception
      'Attribution is frozen once an order is paid. Order %, partner %. Resolve a dispute with a recorded decision and a compensating entry, never by editing history.',
      old.reference, old.partner_id
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

comment on function eng_freeze_attribution is
  'Refuses a change to the attribution columns on a PAID order. Guards those three columns only, because a paid order legitimately changes in other ways.';

drop trigger if exists eng_service_orders_freeze_attribution on eng_service_orders;
create trigger eng_service_orders_freeze_attribution
  before update on eng_service_orders
  for each row execute function eng_freeze_attribution();
