/*
 * ===========================================================================
 * 0118: AN ORDER IS ON ONE STATEMENT, AND A LOST DISPUTE IS A REFUND.
 * Robert's ruling Q8 of 2026-11-02, money audit F8 and F10.
 * ===========================================================================
 *
 * F8. eng_statement_lines was unique on (statement_id, order_id) only, so one
 * order could be a line on two statements and be billed twice. It is now
 * unique on order_id. Nothing in this platform voids a statement, so an order
 * never needs a second line. The other half of F8, unique (account_id,
 * period) on eng_statements, needs nothing: it has existed since 0009
 * (eng_statements_account_id_period_key), and section 0 asserts it rather
 * than adding a second copy.
 *
 * A unique index fails on rows that already break it, so section 0 refuses,
 * naming the count, when any order is already on two statement lines. The
 * counterpart's read before the sitting counts the same thing.
 *
 * F10. A lost dispute returns the money with no charge.refunded event, so the
 * ledger kept a charge with nothing against it. The webhook now records it
 * through eng_apply_refund, which until now wrote every row as
 * 'issued_outside_the_platform' under the event type 'charge.refunded'. It
 * takes both from the payload, defaulting to those two values, so every
 * existing caller is unchanged and a lost dispute is written as what it is:
 * refund_case 'dispute_lost', event type 'charge.dispute.closed'. The
 * customer-visible order event carries the summary the caller passes, as it
 * always has.
 *
 * Development first, on stage/0118-money-constraints; production at the chat
 * counterpart's sitting after Q8b's board. Additive: one index, one widened
 * check, one function body.
 *
 * A function created or replaced after 0073 has EXECUTE revoked from public,
 * anon and authenticated in the same migration; the last block does, and
 * asserts it.
 */

/* ------------------------------------------------------------------- section 0 */

do $$
declare
  v_dupes bigint;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'eng_profiles' and column_name = 'session_epoch'
  ) then
    raise exception 'eng: 0118 follows 0117, which adds eng_profiles.session_epoch. It is not here.';
  end if;

  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and tablename = 'eng_statements'
       and indexname = 'eng_statements_account_id_period_key'
  ) then
    raise exception 'eng: 0118 expects eng_statements_account_id_period_key (0009). It is not here, so one account can hold two statements for a period.';
  end if;

  select count(*) into v_dupes
    from (select order_id from public.eng_statement_lines group by order_id having count(*) > 1) d;
  if v_dupes > 0 then
    raise exception 'eng: 0118 cannot make statement lines unique on order_id: % order(s) are already on more than one line. Settle those first.', v_dupes;
  end if;
end;
$$;

/* ------------------------------------------------------------ F8: the index */

create unique index if not exists eng_statement_lines_order_once
  on eng_statement_lines (order_id);

comment on index eng_statement_lines_order_once is
  'Money audit F8 (0118): an order is a line on one statement only, so two concurrent period closes cannot bill it twice.';

/* ------------------------------------------------- F10: the event type */

alter table eng_payment_events drop constraint eng_payment_events_type_known;
alter table eng_payment_events add constraint eng_payment_events_type_known
  check (event_type in ('checkout.completed', 'checkout.expired', 'charge.refunded', 'charge.refund.updated', 'charge.dispute.closed'));

/* ------------------------------------- F10: a refund that names its own case */

/*
 * The body of 0075 with two values read from the payload: the event type the
 * claim is recorded under, and the refund_case the row is written with. Each
 * defaults to what 0075 hardcoded, so a caller that sends neither is recorded
 * exactly as before.
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
  v_case       text := coalesce(nullif(p->>'refund_case', ''), 'issued_outside_the_platform');
  v_type       text := coalesce(nullif(p->>'event_type', ''), 'charge.refunded');
begin
  v_claim := public.eng_claim_payment_event(p || jsonb_build_object('event_type', v_type));
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
       p->>'provider', p->>'refund_ref', 'succeeded', v_case)
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
            jsonb_build_object('provider_ref', p->>'refund_ref', 'issued_outside_the_platform', true, 'refund_case', v_case));

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

comment on function eng_apply_refund(jsonb) is
  'One provider refund in one transaction: the event, the refund row on the charge''s own subject, the commission reversals, the order event and status, the audit row. Refuses if the refunds on file moved since the delta was computed. 0075; since 0118 the refund_case and event type come from the payload, defaulting to issued_outside_the_platform and charge.refunded.';

/* 0073's rule for a function replaced after it, for this function only, and asserted. */
do $$
declare
  f record;
  open_fns text;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'eng_apply_refund'
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
    raise exception 'eng: after 0118 these are still executable by anon or authenticated: %', open_fns;
  end if;
end;
$$;

/* ------------------------------------------------------------- closing assert */

do $$
begin
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and tablename = 'eng_statement_lines'
       and indexname = 'eng_statement_lines_order_once' and indexdef like 'CREATE UNIQUE INDEX%'
  ) then
    raise exception 'eng: 0118 expects the unique index eng_statement_lines_order_once after it runs.';
  end if;
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'eng_payment_events_type_known')) not like '%charge.dispute.closed%' then
    raise exception 'eng: 0118 expects eng_payment_events_type_known to admit charge.dispute.closed after it runs.';
  end if;
  if position('v_case' in pg_get_functiondef('public.eng_apply_refund(jsonb)'::regprocedure)) = 0 then
    raise exception 'eng: 0118 expects eng_apply_refund to read its refund_case from the payload after it runs.';
  end if;
end;
$$;
