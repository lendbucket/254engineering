/*
 * ===========================================================================
 * 0075: A PAYMENT EVENT IS APPLIED ONCE. Operator rulings, 2026-10-12.
 * ===========================================================================
 *
 * Stripe resends a webhook until it gets a 2xx, and may send one event more
 * than once even after a 2xx. Before this, each webhook branch was a dozen
 * separate requests: the charge row, an unguarded status update, the order
 * events, the release of the work, the audit row. Only the charge row's
 * unique key stopped a second delivery, a cut off write could leave a paid
 * order half recorded behind a 200, and an expired checkout could cancel an
 * order a payment had just moved.
 *
 * THE RULINGS, AND WHAT EACH BECAME HERE.
 *
 * Every event is recorded once by its id before any effect, in
 * eng_payment_events. A resent id answers 200 and changes nothing. One
 * mechanism for every path that applies money: the webhook's three kinds and
 * the reconciliation pull, which records under "reconcile:" and the checkout
 * session it found.
 *
 * The event id and the money writes commit together. One function per branch,
 * each a single transaction: the ledger row, the payment or refund row, the
 * status guarded by the status the TypeScript rules were judged against, the
 * order events, the audit row, the commission reversals. A status that moved
 * since it was read raises, nothing is written, and the webhook answers non
 * 2xx so the next delivery judges again. That guard is what closes an expired
 * checkout cancelling an order a payment has just released.
 *
 * What cannot share the transaction is the release of the work: the file
 * transition, the customer's link, the confirmation email and the account. So
 * a payment that releases work commits with its event CLAIMED, the release
 * runs after commit, and the event is marked DONE only when it succeeds. A
 * resend of a claimed event is processed, not skipped: the money is already
 * written, so it goes straight to the release, which is safe to run twice.
 * An event claimed for more than fifteen minutes is shown on the admin
 * dashboard as "Paid, work not released" and reported by the health watch.
 *
 * EVERY RULE STAYS IN TYPESCRIPT, as in 0068. canTransitionOrder, the refund
 * delta and reversalFor are pure functions with their own audits; these
 * functions are handed their answers and record them. The one thing each
 * re-checks is what only the database can know: that the row is still in the
 * state those rules were judged against. Each locks the row and refuses if
 * another request moved it first.
 *
 * NO DROP STATEMENT OF ANY KIND, by ruling. The table and every function are
 * new; nothing here replaces or removes anything.
 *
 * A function added after 0073 must revoke EXECUTE from public, anon and
 * authenticated in the same migration; the last block here does, for these
 * functions only, and asserts it.
 */

create table if not exists eng_payment_events (
  event_id          text primary key,
  source            text not null
                      constraint eng_payment_events_source_known
                      check (source in ('stripe_webhook', 'reconcile')),
  event_type        text not null
                      constraint eng_payment_events_type_known
                      check (event_type in ('checkout.completed', 'checkout.expired', 'charge.refunded')),
  order_id          uuid references eng_service_orders (id) on delete restrict,
  batch_id          uuid references eng_order_batches (id) on delete restrict,
  statement_id      uuid references eng_statements (id) on delete restrict,
  charge_ref        text,
  status            text not null
                      constraint eng_payment_events_status_known
                      check (status in ('claimed', 'done')),
  claimed_at        timestamptz not null default now(),
  done_at           timestamptz,
  release_attempts  integer not null default 0,
  last_error        text,
  constraint eng_payment_events_done_has_a_time
    check ((status = 'done') = (done_at is not null))
);

create index if not exists eng_payment_events_claimed_idx
  on eng_payment_events (claimed_at) where status = 'claimed';

alter table eng_payment_events enable row level security;

comment on table eng_payment_events is
  'Every event that applies money, recorded once by its id before any effect: Stripe webhook events by their own id, the reconciliation pull as reconcile:<checkout session>. Claimed while the work it released is still being released, done once it is. 0075, operator rulings 2026-10-12.';

/*
 * The row says what happened to an event and nothing else may change it: it
 * is never deleted, its identity never changes, and done never goes back to
 * claimed. A release attempt may count itself and say why it failed.
 */
create or replace function eng_guard_payment_event()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'eng_payment_events rows cannot be deleted. They are the record of which payment events were applied.';
  end if;
  if new.event_id is distinct from old.event_id
     or new.source is distinct from old.source
     or new.event_type is distinct from old.event_type
     or new.order_id is distinct from old.order_id
     or new.batch_id is distinct from old.batch_id
     or new.statement_id is distinct from old.statement_id
     or new.charge_ref is distinct from old.charge_ref
     or new.claimed_at is distinct from old.claimed_at then
    raise exception 'A payment event''s identity cannot change. Only its status, release attempts and last error can.';
  end if;
  if old.status = 'done' and new.status <> 'done' then
    raise exception 'A payment event that is done cannot be claimed again.';
  end if;
  return new;
end;
$fn$;

create trigger eng_payment_events_guarded
  before update or delete on eng_payment_events
  for each row execute function eng_guard_payment_event();

/*
 * The claim, shared by every branch. Inserts the event as claimed and answers
 * 'new', or answers the status it already has, holding a lock on it either way
 * for the rest of the transaction, so two deliveries of one event cannot both
 * read 'new'.
 */
create or replace function eng_claim_payment_event(p jsonb)
returns text
language plpgsql
set search_path = ''
as $fn$
declare
  v_status text;
begin
  if coalesce(p->>'event_id', '') = '' then
    raise exception 'A payment event needs its id. Nothing was written.';
  end if;

  insert into public.eng_payment_events
    (event_id, source, event_type, order_id, batch_id, statement_id, charge_ref, status)
  values
    (p->>'event_id', p->>'source', p->>'event_type',
     nullif(p->>'order_id', '')::uuid, nullif(p->>'batch_id', '')::uuid,
     nullif(p->>'statement_id', '')::uuid, nullif(p->>'charge_ref', ''), 'claimed')
  on conflict (event_id) do nothing;

  if found then
    return 'new';
  end if;

  select status into v_status from public.eng_payment_events where event_id = p->>'event_id' for update;
  return v_status;
end;
$fn$;

/* Marks a claimed event done, in the same transaction as the effect that finished it. */
create or replace function eng_finish_payment_event(p_event_id text)
returns void
language plpgsql
set search_path = ''
as $fn$
begin
  update public.eng_payment_events
     set status = 'done', done_at = now()
   where event_id = p_event_id and status = 'claimed';
end;
$fn$;

/*
 * ONE ORDER PAID. The charge row, the order moved to in_fulfilment under its
 * expected status, the payment event on the order, and the audit row. The
 * event stays claimed: the work is released after commit.
 *
 * A charge already on file under this ref, recorded before this ledger or by
 * another event, finishes the event and writes nothing else, which is what a
 * duplicate delivery did before this migration.
 */
create or replace function eng_apply_order_paid(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $fn$
declare
  v_event   text := p->>'event_id';
  v_order   uuid := (p->>'order_id')::uuid;
  v_claim   text;
  v_status  text;
begin
  v_claim := public.eng_claim_payment_event(p || jsonb_build_object('event_type', 'checkout.completed'));
  if v_claim = 'done' then
    return jsonb_build_object('outcome', 'done');
  end if;
  if v_claim = 'claimed' then
    return jsonb_build_object('outcome', 'claimed', 'release', jsonb_build_array(v_order));
  end if;

  begin
    insert into public.eng_order_payments (order_id, kind, amount_cents, provider, provider_ref, status)
    values (v_order, 'charge', (p->>'amount_cents')::bigint, p->>'provider', p->>'charge_ref', 'succeeded');
  exception when unique_violation then
    perform public.eng_finish_payment_event(v_event);
    return jsonb_build_object('outcome', 'charge_already_recorded');
  end;

  select status into v_status from public.eng_service_orders where id = v_order for update;
  if v_status is null then
    raise exception 'That order does not exist.';
  end if;
  if v_status is distinct from p->>'expected_status' then
    raise exception 'The order moved while this payment was being recorded (it is now %). Nothing was written; the next delivery records it.', v_status;
  end if;

  if p->>'transition' = 'release' then
    update public.eng_service_orders set status = 'in_fulfilment', paid_at = now() where id = v_order;
    insert into public.eng_order_events (order_id, event, customer_visible, summary)
    values (v_order, 'payment.received', true, p->>'received_summary');
    insert into public.eng_audit_events (actor_id, actor_email, actor_role, action, entity_type, entity_id, summary)
    values (null, 'order-engine@254engineering.com', 'admin', 'order.paid', 'service_order', v_order::text, p->>'audit_summary');
    return jsonb_build_object('outcome', 'applied', 'release', jsonb_build_array(v_order));
  end if;

  -- A payment the order's state cannot take: written down, and nothing released.
  insert into public.eng_order_events (order_id, event, customer_visible, summary)
  values (v_order, 'payment.unexpected', false, p->>'unexpected_summary');
  perform public.eng_finish_payment_event(v_event);
  return jsonb_build_object('outcome', 'applied', 'release', '[]'::jsonb);
end;
$fn$;

/*
 * A BATCH PAID. One charge row on the batch, the batch accepted under its
 * expected status, and each order the rules release moved under its own
 * expected status with its payment event. Claimed if anything is released.
 */
create or replace function eng_apply_batch_paid(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $fn$
declare
  v_event     text := p->>'event_id';
  v_batch     uuid := (p->>'batch_id')::uuid;
  v_claim     text;
  v_status    text;
  v_o         jsonb;
  v_o_id      uuid;
  v_released  jsonb := '[]'::jsonb;
begin
  v_claim := public.eng_claim_payment_event(p || jsonb_build_object('event_type', 'checkout.completed'));
  if v_claim = 'done' then
    return jsonb_build_object('outcome', 'done');
  end if;
  if v_claim = 'claimed' then
    return jsonb_build_object('outcome', 'claimed', 'release', coalesce(
      (select jsonb_agg(id) from public.eng_service_orders where batch_id = v_batch and status = 'in_fulfilment'),
      '[]'::jsonb));
  end if;

  begin
    insert into public.eng_order_payments (batch_id, kind, amount_cents, provider, provider_ref, status)
    values (v_batch, 'charge', (p->>'amount_cents')::bigint, p->>'provider', p->>'charge_ref', 'succeeded');
  exception when unique_violation then
    perform public.eng_finish_payment_event(v_event);
    return jsonb_build_object('outcome', 'charge_already_recorded');
  end;

  select status into v_status from public.eng_order_batches where id = v_batch for update;
  if v_status is null then
    raise exception 'That submission does not exist.';
  end if;
  if v_status is distinct from p->>'expected_status' then
    raise exception 'The submission moved while this payment was being recorded (it is now %). Nothing was written; the next delivery records it.', v_status;
  end if;
  update public.eng_order_batches set status = 'accepted', paid_at = now() where id = v_batch;

  for v_o in select jsonb_array_elements(coalesce(p->'orders', '[]'::jsonb)) loop
    v_o_id := (v_o->>'id')::uuid;
    select status into v_status from public.eng_service_orders where id = v_o_id and batch_id = v_batch for update;
    if v_status is null then
      raise exception 'An order in that submission does not exist.';
    end if;
    if v_status is distinct from v_o->>'expected_status' then
      raise exception 'An order in the submission moved while this payment was being recorded (it is now %). Nothing was written; the next delivery records it.', v_status;
    end if;
    if (v_o->>'release')::boolean then
      update public.eng_service_orders set status = 'in_fulfilment', paid_at = now() where id = v_o_id;
      insert into public.eng_order_events (order_id, event, customer_visible, summary)
      values (v_o_id, 'payment.received', true, p->>'received_summary');
      v_released := v_released || to_jsonb(v_o_id);
    end if;
  end loop;

  insert into public.eng_audit_events (actor_id, actor_email, actor_role, action, entity_type, entity_id, summary)
  values (null, 'order-engine@254engineering.com', 'admin', 'batch.paid', 'order_batch', v_batch::text, p->>'audit_summary');

  if jsonb_array_length(v_released) = 0 then
    perform public.eng_finish_payment_event(v_event);
  end if;
  return jsonb_build_object('outcome', 'applied', 'release', v_released);
end;
$fn$;

/*
 * A STATEMENT PAID. One charge row on the statement and the statement marked
 * paid under its expected status. Nothing is released, so it finishes here.
 */
create or replace function eng_apply_statement_paid(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $fn$
declare
  v_event      text := p->>'event_id';
  v_statement  uuid := (p->>'statement_id')::uuid;
  v_claim      text;
  v_status     text;
begin
  v_claim := public.eng_claim_payment_event(p || jsonb_build_object('event_type', 'checkout.completed'));
  if v_claim <> 'new' then
    -- Nothing is ever released for a statement, so a claimed one is finished.
    perform public.eng_finish_payment_event(v_event);
    return jsonb_build_object('outcome', 'done');
  end if;

  begin
    insert into public.eng_order_payments (statement_id, kind, amount_cents, provider, provider_ref, status)
    values (v_statement, 'charge', (p->>'amount_cents')::bigint, p->>'provider', p->>'charge_ref', 'succeeded');
  exception when unique_violation then
    perform public.eng_finish_payment_event(v_event);
    return jsonb_build_object('outcome', 'charge_already_recorded');
  end;

  select status into v_status from public.eng_statements where id = v_statement for update;
  if v_status is null then
    raise exception 'That statement does not exist.';
  end if;
  if v_status is distinct from p->>'expected_status' then
    raise exception 'The statement moved while this payment was being recorded (it is now %). Nothing was written; the next delivery records it.', v_status;
  end if;
  update public.eng_statements set status = 'paid', paid_at = now() where id = v_statement;

  insert into public.eng_audit_events (actor_id, actor_email, actor_role, action, entity_type, entity_id, summary)
  values (null, 'order-engine@254engineering.com', 'admin', 'statement.paid', 'customer_account', p->>'account_id', p->>'audit_summary');

  perform public.eng_finish_payment_event(v_event);
  return jsonb_build_object('outcome', 'applied');
end;
$fn$;

/*
 * A CHECKOUT EXPIRED. Each order the rules allow to close is cancelled under
 * its expected status, with its event; a batch is cancelled under its own.
 * An order a payment moved first is no longer at its expected status, so this
 * raises and cancels nothing. Nothing reaches outside, so it finishes here.
 */
create or replace function eng_apply_checkout_expired(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $fn$
declare
  v_event    text := p->>'event_id';
  v_batch    uuid := nullif(p->>'batch_id', '')::uuid;
  v_claim    text;
  v_status   text;
  v_o        jsonb;
  v_o_id     uuid;
  v_closed   integer := 0;
begin
  v_claim := public.eng_claim_payment_event(p || jsonb_build_object('event_type', 'checkout.expired'));
  if v_claim <> 'new' then
    perform public.eng_finish_payment_event(v_event);
    return jsonb_build_object('outcome', 'done');
  end if;

  if v_batch is not null then
    select status into v_status from public.eng_order_batches where id = v_batch for update;
    if v_status is null then
      raise exception 'That submission does not exist.';
    end if;
    if v_status is distinct from p->>'expected_batch_status' then
      raise exception 'The submission moved while its expiry was being recorded (it is now %). Nothing was written; the next delivery records it.', v_status;
    end if;
  end if;

  for v_o in select jsonb_array_elements(coalesce(p->'orders', '[]'::jsonb)) loop
    v_o_id := (v_o->>'id')::uuid;
    select status into v_status from public.eng_service_orders where id = v_o_id for update;
    if v_status is null then
      raise exception 'That order does not exist.';
    end if;
    if v_status is distinct from v_o->>'expected_status' then
      raise exception 'The order moved while its expiry was being recorded (it is now %). Nothing was cancelled; the next delivery judges it again.', v_status;
    end if;
    if (v_o->>'cancel')::boolean then
      insert into public.eng_order_events (order_id, event, customer_visible, summary)
      values (v_o_id, 'checkout.expired', true, p->>'reason');
      update public.eng_service_orders set status = 'cancelled', cancelled_at = now() where id = v_o_id;
      v_closed := v_closed + 1;
    end if;
  end loop;

  if v_batch is not null and (p->>'cancel_batch')::boolean then
    update public.eng_order_batches set status = 'cancelled', cancelled_at = now() where id = v_batch;
  end if;

  perform public.eng_finish_payment_event(v_event);
  return jsonb_build_object('outcome', 'applied', 'closed', v_closed);
end;
$fn$;

/*
 * A REFUND RECORDED FROM THE PROVIDER. The refund row on the charge's own
 * subject, so a batch or statement refund is recorded rather than refused;
 * the commission reversals TypeScript computed, each pointing at that row;
 * the order's event and status when the subject is an order; the audit row.
 *
 * The delta was computed from the refunds already on file, pending ones
 * included, so a platform refund still pending is not recorded a second time.
 * The charge row is locked and the total re-read, and a total that moved
 * since raises, so two refund events cannot both write against one figure.
 */
create or replace function eng_apply_refund(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $fn$
declare
  v_event      text := p->>'event_id';
  v_charge     record;
  v_claim      text;
  v_prior      bigint;
  v_delta      bigint := (p->>'delta_cents')::bigint;
  v_refund_id  uuid;
  v_r          jsonb;
  v_entry_id   uuid;
  v_status     text;
begin
  v_claim := public.eng_claim_payment_event(p || jsonb_build_object('event_type', 'charge.refunded'));
  if v_claim <> 'new' then
    perform public.eng_finish_payment_event(v_event);
    return jsonb_build_object('outcome', 'done');
  end if;

  select id, order_id, batch_id, statement_id into v_charge
    from public.eng_order_payments where id = (p->>'charge_id')::uuid and kind = 'charge' for update;
  if v_charge.id is null then
    raise exception 'The charge that refund is against does not exist.';
  end if;

  select coalesce(sum(amount_cents), 0) into v_prior
    from public.eng_order_payments
   where kind = 'refund' and status in ('pending', 'succeeded')
     and order_id is not distinct from v_charge.order_id
     and batch_id is not distinct from v_charge.batch_id
     and statement_id is not distinct from v_charge.statement_id;
  if v_prior <> (p->>'expected_prior_cents')::bigint then
    raise exception 'The refunds on that charge changed while this one was being recorded (now % cents). Nothing was written; the next delivery records it.', v_prior;
  end if;

  if v_delta <= 0 then
    perform public.eng_finish_payment_event(v_event);
    return jsonb_build_object('outcome', 'nothing_to_record');
  end if;

  begin
    insert into public.eng_order_payments
      (order_id, batch_id, statement_id, kind, amount_cents, provider, provider_ref, status, refund_case)
    values
      (v_charge.order_id, v_charge.batch_id, v_charge.statement_id, 'refund', v_delta,
       p->>'provider', p->>'refund_ref', 'succeeded', 'issued_outside_the_platform')
    returning id into v_refund_id;
  exception when unique_violation then
    perform public.eng_finish_payment_event(v_event);
    return jsonb_build_object('outcome', 'refund_already_recorded');
  end;

  for v_r in select jsonb_array_elements(coalesce(p->'reversals', '[]'::jsonb)) loop
    v_entry_id := null;
    insert into public.eng_partner_entries
      (partner_id, kind, amount_cents, status, explanation, model, basis_cents, file_id, order_id,
       reverses_id, payment_id, occurred_at, payable_at)
    values
      ((v_r->>'partner_id')::uuid, 'reversal', (v_r->>'amount_cents')::bigint, 'accrued', v_r->>'explanation',
       nullif(v_r->>'model', ''), nullif(v_r->>'basis_cents', '')::bigint, nullif(v_r->>'file_id', '')::uuid,
       v_charge.order_id, (v_r->>'reverses_id')::uuid, v_refund_id, now(), now())
    on conflict do nothing
    returning id into v_entry_id;
    if v_entry_id is not null then
      insert into public.eng_audit_events (actor_id, actor_email, actor_role, action, entity_type, entity_id, summary)
      values (null, 'partner-engine@254engineering.com', 'admin', 'partner.reversal', 'partner',
              v_r->>'partner_id', v_r->>'audit_summary');
    end if;
  end loop;

  if v_charge.order_id is not null then
    insert into public.eng_order_events (order_id, event, customer_visible, summary, detail)
    values (v_charge.order_id, 'refund.recorded', true, p->>'refund_summary',
            jsonb_build_object('provider_ref', p->>'refund_ref', 'issued_outside_the_platform', true));

    if (p->>'mark_refunded')::boolean then
      select status into v_status from public.eng_service_orders where id = v_charge.order_id for update;
      if v_status is distinct from p->>'expected_order_status' then
        raise exception 'The order moved while this refund was being recorded (it is now %). Nothing was written; the next delivery records it.', v_status;
      end if;
      update public.eng_service_orders set status = 'refunded', refunded_at = now() where id = v_charge.order_id;
    end if;
  end if;

  insert into public.eng_audit_events (actor_id, actor_email, actor_role, action, entity_type, entity_id, summary)
  values (null, 'order-engine@254engineering.com', 'admin', 'order.refund_recorded',
          case when v_charge.order_id is not null then 'service_order'
               when v_charge.batch_id is not null then 'order_batch'
               else 'statement' end,
          coalesce(v_charge.order_id, v_charge.batch_id, v_charge.statement_id)::text,
          p->>'audit_summary');

  perform public.eng_finish_payment_event(v_event);
  return jsonb_build_object('outcome', 'applied', 'refund_id', v_refund_id, 'recorded_cents', v_delta);
end;
$fn$;

comment on function eng_apply_order_paid(jsonb) is
  'One order paid in one transaction: the event claimed, the charge row, the order moved under its expected status, its payment event and audit row. The release runs after commit and finishes the event. 0075.';
comment on function eng_apply_batch_paid(jsonb) is
  'One batch paid in one transaction: the event claimed, one charge row, the batch accepted and each released order moved under its expected status, the audit row. 0075.';
comment on function eng_apply_statement_paid(jsonb) is
  'One statement paid in one transaction: the event, the charge row, the statement marked paid under its expected status, the audit row. 0075.';
comment on function eng_apply_checkout_expired(jsonb) is
  'One expired checkout in one transaction: the event, and each order or batch cancelled only under the status it was judged at. 0075.';
comment on function eng_apply_refund(jsonb) is
  'One provider refund in one transaction: the event, the refund row on the charge''s own subject, the commission reversals, the order event and status, the audit row. Refuses if the refunds on file moved since the delta was computed. 0075.';

/* 0073's rule for a function added after it, for these functions only, and asserted. */
do $$
declare
  f record;
  open_fns text;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('eng_guard_payment_event', 'eng_claim_payment_event', 'eng_finish_payment_event',
                        'eng_apply_order_paid', 'eng_apply_batch_paid', 'eng_apply_statement_paid',
                        'eng_apply_checkout_expired', 'eng_apply_refund')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;

  select string_agg(p.oid::regprocedure::text, ', ') into open_fns
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'eng\_%'
    and (has_function_privilege('anon', p.oid, 'EXECUTE')
         or has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  if open_fns is not null then
    raise exception 'eng: after 0075 these are still executable by anon or authenticated: %', open_fns;
  end if;
end;
$$;
