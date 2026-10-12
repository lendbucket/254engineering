/*
 * ===========================================================================
 * 0074: A PARTNER PAYS 254, THROUGH 254'S ONE STRIPE ACCOUNT.
 * Operator ruling, 2026-10-11, on docs/partner-billing-plan.md.
 * ===========================================================================
 *
 * A reseller pays $800 upfront and $99 a month, to 254 Engineering, through
 * the same Stripe account and the same webhook as customer orders. These two
 * tables hold what the partner billing lane of that webhook records. Neither is
 * read by anything on the order path, and nothing on the order path writes
 * either.
 *
 * eng_partner_billing: one row per partner, the partner's billing state now.
 * Updated in place, because "is this partner paid up" has one answer at a
 * time. Four states, and the past due date exists exactly when the state is
 * past_due, so the grace period always has a start.
 *
 * eng_partner_billing_events: append only, one row per Stripe event applied,
 * keyed by Stripe's own event id, so a redelivered event writes nothing the
 * second time. It is the record of every transition and what caused it.
 *
 * BILLING IS OFF. src/config/partner-billing.ts holds enabled = false, so on
 * the day this is applied nothing writes to either table. The webhook's
 * partner lane records an event only for an object carrying
 * metadata.kind = partner_billing, which only a partner checkout creates.
 *
 * No function is created, so no grant needs revoking: 0073's rule holds by
 * construction. Additive only.
 */
create table if not exists eng_partner_billing (
  partner_id               uuid primary key references eng_partners (id) on delete restrict,
  status                   text not null
                             constraint eng_partner_billing_status_known
                             check (status in ('active', 'past_due', 'suspended', 'cancelled')),
  past_due_since           timestamptz,
  current_period_end       timestamptz,
  stripe_customer_ref      text,
  stripe_subscription_ref  text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint eng_partner_billing_past_due_has_a_start
    check ((status = 'past_due') = (past_due_since is not null))
);

drop trigger if exists eng_partner_billing_touch on eng_partner_billing;
create trigger eng_partner_billing_touch before update on eng_partner_billing
  for each row execute function eng_touch_updated_at();

alter table eng_partner_billing enable row level security;

comment on table eng_partner_billing is
  'One row per partner: what the partner owes 254 now. Written only by the partner billing lane of the Stripe webhook. 0074, operator ruling 2026-10-11.';

create table if not exists eng_partner_billing_events (
  stripe_event_id  text primary key,
  partner_id       uuid not null references eng_partners (id) on delete restrict,
  event_type       text not null
                     constraint eng_partner_billing_events_type_known
                     check (event_type in ('checkout.completed', 'invoice.paid', 'invoice.payment_failed',
                                           'subscription.updated', 'subscription.deleted')),
  status_after     text
                     constraint eng_partner_billing_events_status_known
                     check (status_after is null or status_after in ('active', 'past_due', 'suspended', 'cancelled')),
  applied_at       timestamptz not null default now()
);

create index if not exists eng_partner_billing_events_partner_idx
  on eng_partner_billing_events (partner_id, applied_at desc);

drop trigger if exists eng_partner_billing_events_immutable on eng_partner_billing_events;
create trigger eng_partner_billing_events_immutable
  before update or delete on eng_partner_billing_events
  for each row execute function eng_forbid_mutation();

alter table eng_partner_billing_events enable row level security;

comment on table eng_partner_billing_events is
  'Append only. Every Stripe event the partner billing lane applied, keyed by Stripe''s event id so a redelivery writes nothing. status_after is null when the event changed nothing. 0074.';
