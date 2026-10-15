/*
 * ===========================================================================
 * 0076: A REFUND UPDATE IS APPLIED ONCE. Operator rulings, 2026-10-13.
 * ===========================================================================
 *
 * A refund this platform issues can come back from Stripe as pending. Before
 * this, nothing ever moved it: a pending refund that later failed stayed
 * counted as given back, its commission stayed reversed, and the order stayed
 * refunded, with nobody told. Stripe says what became of a refund in
 * charge.refund.updated, and this is the ledger side of reading it.
 *
 * THE RULINGS, AND WHAT EACH BECAME HERE.
 *
 * Through the same ledger as every other payment event (0075): the event is
 * recorded once by its id before any effect, in the same transaction as the
 * effect. A resent id answers 200 and changes nothing.
 *
 * Pending to succeeded: the refund row is marked succeeded, with an internal
 * order event and an audit row. Nothing goes to the customer, who was already
 * told when the refund was issued.
 *
 * Pending to failed or canceled: the row is marked failed or cancelled with
 * Stripe's reason, so it stops counting toward what was given back, with an
 * internal refund.failed order event and an audit row. The firm-only alert is
 * sent after commit. Nothing reinstates the reversed commission, changes the
 * order's status or writes to the customer: those wait for a person, and the
 * orders screen names the state.
 *
 * Still pending, or requires_action: the event is recorded and nothing else
 * changes.
 *
 * A refund id with no row on file is recorded as done and changes nothing. A
 * failed or canceled one raises a staff task, which the TypeScript side does
 * after commit because a task is not a money write.
 *
 * EVERY RULE STAYS IN TYPESCRIPT, as in 0068 and 0075. Which transitions
 * apply is decided there and handed in; the one thing this re-checks is what
 * only the database can know, that the row is still at the status the rule
 * was judged against. It locks the row and refuses if another request moved
 * it first, and the webhook answers non 2xx so the next delivery judges again.
 *
 * ONE DROP STATEMENT, BY RULING. The event type constraint lists the three
 * kinds 0075 knew, and a check constraint cannot be widened in place, so it is
 * dropped and added again with the fourth kind in the same transaction. No
 * row on file can break the wider list, and section 0 of the sitting reads
 * that before anything runs.
 *
 * The status value keeps the schema's spelling, 'cancelled' (0006). Anything
 * rendered says "Canceled".
 *
 * A function added after 0073 must revoke EXECUTE from public, anon and
 * authenticated in the same migration; the last block here does, and asserts it.
 */

alter table eng_payment_events drop constraint eng_payment_events_type_known;
alter table eng_payment_events add constraint eng_payment_events_type_known
  check (event_type in ('checkout.completed', 'checkout.expired', 'charge.refunded', 'charge.refund.updated'));

/*
 * ONE REFUND UPDATE. The event claimed; the refund row locked and checked
 * against the status the rule was judged at; the row moved to the status the
 * rule decided, with the order event and the audit row. A row already at that
 * status, or an update that decides nothing, finishes the event and writes
 * nothing else.
 */
create or replace function eng_apply_refund_update(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $fn$
declare
  v_event     text := p->>'event_id';
  v_claim     text;
  v_row       record;
  v_to        text := p->>'new_status';
begin
  v_claim := public.eng_claim_payment_event(p || jsonb_build_object('event_type', 'charge.refund.updated'));
  if v_claim <> 'new' then
    perform public.eng_finish_payment_event(v_event);
    return jsonb_build_object('outcome', 'done');
  end if;

  select id, status, order_id, batch_id, statement_id into v_row
    from public.eng_order_payments
   where kind = 'refund' and provider = p->>'provider' and provider_ref = p->>'refund_ref'
   for update;

  if v_row.id is null then
    if p->>'expected_status' is not null then
      raise exception 'The refund that update is about is no longer on file. Nothing was written; the next delivery judges it again.';
    end if;
    perform public.eng_finish_payment_event(v_event);
    return jsonb_build_object('outcome', 'no_refund_on_file');
  end if;

  if v_row.status is distinct from p->>'expected_status' then
    raise exception 'The refund moved while its update was being recorded (it is now %). Nothing was written; the next delivery records it.', v_row.status;
  end if;

  if v_to is null or v_to = v_row.status then
    perform public.eng_finish_payment_event(v_event);
    return jsonb_build_object('outcome', 'unchanged', 'refund_id', v_row.id, 'status', v_row.status);
  end if;

  if v_to not in ('succeeded', 'failed', 'cancelled') then
    raise exception 'A refund cannot be moved to %. Nothing was written.', v_to;
  end if;

  update public.eng_order_payments
     set status = v_to,
         failure_reason = case when v_to in ('failed', 'cancelled') then nullif(p->>'failure_reason', '') else failure_reason end
   where id = v_row.id;

  if v_row.order_id is not null then
    insert into public.eng_order_events (order_id, event, customer_visible, summary, detail)
    values (v_row.order_id, case when v_to = 'succeeded' then 'refund.settled' else 'refund.failed' end, false,
            p->>'order_event_summary',
            jsonb_build_object('provider_ref', p->>'refund_ref', 'from', v_row.status, 'to', v_to));
  end if;

  insert into public.eng_audit_events (actor_id, actor_email, actor_role, action, entity_type, entity_id, summary)
  values (null, 'order-engine@254engineering.com', 'admin',
          case when v_to = 'succeeded' then 'order.refund_settled' else 'order.refund_failed' end,
          case when v_row.order_id is not null then 'service_order'
               when v_row.batch_id is not null then 'order_batch'
               else 'statement' end,
          coalesce(v_row.order_id, v_row.batch_id, v_row.statement_id)::text,
          p->>'audit_summary');

  perform public.eng_finish_payment_event(v_event);
  return jsonb_build_object('outcome', 'applied', 'refund_id', v_row.id, 'order_id', v_row.order_id,
                            'from', v_row.status, 'to', v_to);
end;
$fn$;

comment on function eng_apply_refund_update(jsonb) is
  'One Stripe refund update in one transaction: the event claimed, the refund row moved under the status it was judged at to the status the rule decided, the internal order event and the audit row. 0076.';

/* 0073's rule for a function added after it, for this function only, and asserted. */
do $$
declare
  f record;
  open_fns text;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'eng_apply_refund_update'
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
    raise exception 'eng: after 0076 these are still executable by anon or authenticated: %', open_fns;
  end if;
end;
$$;
