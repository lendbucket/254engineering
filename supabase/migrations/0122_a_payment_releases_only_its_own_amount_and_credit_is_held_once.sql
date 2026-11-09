/*
 * ===========================================================================
 * 0122: A PAYMENT RELEASES WORK ONLY FOR THE AMOUNT THE ORDER IS, AND AN
 * ACCOUNT'S CREDIT IS DECIDED BY ONE SUBMISSION AT A TIME.
 * Money audit F12 and F6 (audit-money.md, 6585008424), Robert's answer of
 * 2026-11-03 to 6594441148: "F12 and F6 yes, one migration branch", through
 * the normal sittings. Numbered 0121 after Q8b by his overnight order of
 * 2026-11-05, and 0122 by his answer 3 of 2026-11-06 (the roofer rework takes
 * 0117).
 * ===========================================================================
 *
 * F12. eng_apply_order_paid and eng_apply_batch_paid wrote the charge and
 * released the work whatever the amount was. The reconcile path refuses a
 * session whose amount_total disagrees with the order, but the webhook path did
 * not compare at all. Nothing can change a session's total today (cards only,
 * no promotion codes, no adjustable quantity), so this is defence in depth: a
 * future promotion code, or a session made in the Stripe dashboard carrying an
 * order's metadata, would otherwise release $709.00 of work against a $1.00
 * charge without a word.
 *
 * Both functions now take expected_amount_cents. When the payload carries it
 * and the charge differs, the charge is still written (the money did move),
 * nothing is released and the order or submission stays where it was, the
 * order's timeline gets an internal payment.unexpected line, the audit trail
 * gets a row saying both amounts, and the answer carries amount_differs so the
 * caller raises a task for a person. When the payload does not carry it, the
 * function behaves exactly as 0075 wrote it, so code deployed before this
 * migration, or after it, is never refused for want of the field.
 *
 * F6. The credit limit was decided in TypeScript against one read of the
 * balance, and the batch's orders only count toward that balance once
 * acceptOnInvoice has run at the end. Two invoice submissions for one account
 * in the same second both read the same balance and both passed. The audit's
 * minimum fix is taken: one hold per account, taken before the balance is read
 * and released after the batch is accepted, so the second submission is refused
 * with a sentence rather than passing the same check. The arithmetic stays in
 * creditDecision, its one home; this file only makes the check happen one
 * submission at a time.
 *
 *   eng_account_credit_holds   one row per account that has ever placed an
 *                              invoice submission: which hold is current and
 *                              until when. A hold left by a request that died
 *                              lapses at held_until, so nothing is stuck.
 *   eng_take_credit_hold       takes the hold if nobody holds it, or the hold
 *                              has lapsed. One statement, so two callers cannot
 *                              both take it.
 *   eng_release_credit_hold    releases it, only for the token that took it.
 *
 * Development first, on stage/0122-money-holds; production at the chat
 * counterpart's sitting after its board. ADDITIVE: one table, two new
 * functions, two function bodies replaced. Nothing is dropped and no row is
 * deleted.
 */

/* ------------------------------------------------------------------- section 0 */

do $$
begin
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and indexname = 'eng_statement_lines_order_once'
  ) then
    raise exception 'eng: 0122 follows 0121, which adds eng_statement_lines_order_once. It is not here.';
  end if;
  if to_regprocedure('public.eng_apply_order_paid(jsonb)') is null
     or to_regprocedure('public.eng_apply_batch_paid(jsonb)') is null then
    raise exception 'eng: 0122 replaces eng_apply_order_paid and eng_apply_batch_paid (0075), and one of them is not here.';
  end if;
  if to_regclass('public.eng_account_credit_holds') is not null then
    raise exception 'eng: 0122 expects no eng_account_credit_holds before it runs.';
  end if;
end;
$$;

/* ---------------------------------------------------------------- the holds */

create table eng_account_credit_holds (
  account_id  uuid primary key references eng_customer_accounts (id),
  /* Which request holds it. Only that request may release it. */
  token       uuid not null,
  held_until  timestamptz not null
);

alter table eng_account_credit_holds enable row level security;
revoke all on eng_account_credit_holds from public, anon, authenticated;

comment on table eng_account_credit_holds is
  'One row per invoice account: the hold that lets one submission at a time read the balance, decide the credit limit and place its orders. Money audit F6. Lapses at held_until. 0122.';

/*
 * Taken if nobody holds it or the hold has lapsed; answers whether this token
 * now holds it. The insert and the conditional update are one statement, so of
 * two callers in the same instant exactly one gets true.
 */
create or replace function eng_take_credit_hold(p_account uuid, p_token uuid, p_seconds integer)
returns boolean
language plpgsql
set search_path = ''
as $fn$
declare
  v_token uuid;
begin
  if p_account is null or p_token is null or p_seconds is null or p_seconds < 1 then
    raise exception 'A credit hold needs an account, a token and a length in seconds.';
  end if;
  insert into public.eng_account_credit_holds as h (account_id, token, held_until)
  values (p_account, p_token, now() + make_interval(secs => p_seconds))
  on conflict (account_id) do update
     set token = excluded.token, held_until = excluded.held_until
   /* At or past: a release stamps now(), and a take in the same instant must find it free. */
   where h.held_until <= now()
  returning h.token into v_token;
  return v_token is not distinct from p_token;
end;
$fn$;

/* Released by the token that took it; a lapsed or taken over hold is left alone. */
create or replace function eng_release_credit_hold(p_account uuid, p_token uuid)
returns void
language plpgsql
set search_path = ''
as $fn$
begin
  update public.eng_account_credit_holds
     set held_until = now()
   where account_id = p_account and token = p_token and held_until > now();
end;
$fn$;

comment on function eng_take_credit_hold(uuid, uuid, integer) is
  'Takes the account''s credit hold for p_seconds if nobody holds it or the hold has lapsed; true when this token holds it. Money audit F6. 0122.';
comment on function eng_release_credit_hold(uuid, uuid) is
  'Releases the account''s credit hold, only for the token that took it. Money audit F6. 0122.';

/* ------------------------------------------------- one order paid, F12 */

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

  /*
   * F12. A charge for an amount other than the order's is written down and
   * releases nothing. Only when the caller names the amount it expects.
   */
  if coalesce(p->>'expected_amount_cents', '') <> ''
     and (p->>'expected_amount_cents')::bigint is distinct from (p->>'amount_cents')::bigint then
    insert into public.eng_order_events (order_id, event, customer_visible, summary)
    values (v_order, 'payment.unexpected', false, p->>'amount_differs_summary');
    insert into public.eng_audit_events (actor_id, actor_email, actor_role, action, entity_type, entity_id, summary)
    values (null, 'order-engine@254engineering.com', 'admin', 'order.payment_amount_differs', 'service_order', v_order::text, p->>'amount_differs_summary');
    perform public.eng_finish_payment_event(v_event);
    return jsonb_build_object('outcome', 'applied', 'release', '[]'::jsonb, 'amount_differs', true);
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

/* ---------------------------------------------------- a batch paid, F12 */

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

  /*
   * F12. A charge for an amount other than the submission's is written down,
   * and the submission is neither accepted nor any order in it released.
   */
  if coalesce(p->>'expected_amount_cents', '') <> ''
     and (p->>'expected_amount_cents')::bigint is distinct from (p->>'amount_cents')::bigint then
    insert into public.eng_audit_events (actor_id, actor_email, actor_role, action, entity_type, entity_id, summary)
    values (null, 'order-engine@254engineering.com', 'admin', 'batch.payment_amount_differs', 'order_batch', v_batch::text, p->>'amount_differs_summary');
    perform public.eng_finish_payment_event(v_event);
    return jsonb_build_object('outcome', 'applied', 'release', '[]'::jsonb, 'amount_differs', true);
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

comment on function eng_apply_order_paid(jsonb) is
  'One order paid in one transaction: the event, the charge, the order moved under its expected status, the order event and the audit row. 0075; since 0122 a charge for another amount than expected_amount_cents releases nothing and answers amount_differs (money audit F12).';
comment on function eng_apply_batch_paid(jsonb) is
  'A submission paid in one transaction: the event, one charge on the batch, the batch accepted and each released order moved under its expected status. 0075; since 0122 a charge for another amount than expected_amount_cents accepts and releases nothing and answers amount_differs (money audit F12).';

/* 0073's rule for a function created or replaced after it, for these four only, and asserted. */
do $$
declare
  f record;
  open_fns text;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('eng_take_credit_hold', 'eng_release_credit_hold', 'eng_apply_order_paid', 'eng_apply_batch_paid')
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
    raise exception 'eng: after 0122 these are still executable by anon or authenticated: %', open_fns;
  end if;
end;
$$;

/* ------------------------------------------------------------- closing assert */

do $$
begin
  if to_regclass('public.eng_account_credit_holds') is null then
    raise exception 'eng: 0122 expects eng_account_credit_holds after it runs.';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.eng_account_credit_holds'::regclass) then
    raise exception 'eng: 0122 expects row level security on eng_account_credit_holds.';
  end if;
  if to_regprocedure('public.eng_take_credit_hold(uuid, uuid, integer)') is null
     or to_regprocedure('public.eng_release_credit_hold(uuid, uuid)') is null then
    raise exception 'eng: 0122 expects eng_take_credit_hold and eng_release_credit_hold after it runs.';
  end if;
  if position('expected_amount_cents' in pg_get_functiondef('public.eng_apply_order_paid(jsonb)'::regprocedure)) = 0
     or position('expected_amount_cents' in pg_get_functiondef('public.eng_apply_batch_paid(jsonb)'::regprocedure)) = 0 then
    raise exception 'eng: 0122 expects both paid functions to compare expected_amount_cents after it runs.';
  end if;
end;
$$;
