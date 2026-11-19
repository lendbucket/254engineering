/*
 * 0138: A PAYMENT RECEIVED OUTSIDE THE PLATFORM IS RECORDED ON ITS JOB.
 *
 * Robert's answers 2, 3 and 5 of the night of 2026-11-18 (issue #1, on the
 * evening report 6992466384 and the plan 6992348494). Peter Bulatao was billed
 * by a Stripe dashboard invoice, which no checkout session names, so the
 * payment could not reach his job: no revenue, no refund terms on record, no
 * letter tied to a paid order.
 *
 * The payment is applied through the one path every payment takes (markPaid,
 * eng_apply_order_paid), so revenue, the release and every report read it as
 * they read a card payment. Two things in the database stop that today, and
 * this migration changes exactly those two:
 *
 *   1. eng_payment_events.source admits 'stripe_webhook' and 'reconcile' only
 *      (0075). It gains 'staff_recorded', so the event row says a person
 *      recorded it rather than claiming Stripe or the sweep did.
 *   2. The grant payments.record_outside, to the administrator alone (answer 2:
 *      it moves money on the record with no card behind it). Declared in
 *      DEFAULT_ROLES and pinned in roles-audit, as every grant since 0018.
 *
 * Additive in effect: the check constraint is dropped and re-added WIDER, as
 * 0121 did for event_type, so every row that satisfied it still does. No
 * column, no table, no data moved.
 */

alter table eng_payment_events drop constraint eng_payment_events_source_known;
alter table eng_payment_events add constraint eng_payment_events_source_known
  check (source in ('stripe_webhook', 'reconcile', 'staff_recorded'));

/* The administrator alone records a payment made outside the platform (declared in DEFAULT_ROLES, pinned in roles-audit). */
insert into eng_role_grants (role_key, action) values
  ('admin', 'payments.record_outside')
on conflict (role_key, action) do nothing;

/* Read back in the same migration, as 0121 does: a constraint that did not widen, or a grant that did not land, stops here. */
do $$
begin
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'eng_payment_events_source_known')) not like '%staff_recorded%' then
    raise exception 'eng: 0138 expects eng_payment_events_source_known to admit staff_recorded after it runs.';
  end if;
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'eng_payment_events_source_known')) not like '%stripe_webhook%' then
    raise exception 'eng: 0138 expects eng_payment_events_source_known to still admit stripe_webhook after it runs.';
  end if;
  if not exists (select 1 from eng_role_grants where role_key = 'admin' and action = 'payments.record_outside') then
    raise exception 'eng: 0138 expects the administrator to hold payments.record_outside after it runs.';
  end if;
  if exists (select 1 from eng_role_grants where action = 'payments.record_outside' and role_key <> 'admin') then
    raise exception 'eng: 0138 expects payments.record_outside to be held by the administrator alone.';
  end if;
end;
$$;
