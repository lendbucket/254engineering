/*
 * ===========================================================================
 * 0064: CLOSING AN ACCOUNT SPENDS ITS USERS' LINKS TOO.
 * ===========================================================================
 *
 * Operator ruling, 2026-10-07, answering the question 0063 left open: "Closing
 * an account spends its users' links too: yes." A closed account's users kept
 * any live set password or reset link, because the trigger fired on suspension
 * only.
 *
 * It replaces the one function 0063 created rather than editing 0063, because
 * development had already run 0063 when the ruling arrived, and a migration
 * that changes after it has run is one nobody can reason about. The triggers
 * 0063 attached fire on any update of status, so they need no change: only the
 * function's test of which status counts moves.
 *
 * What fires, now:
 *   a person   into `suspended`              (unchanged; a person has no closed)
 *   an account into `suspended` or `closed`  (closed is new)
 * and only on a CHANGE of status, so a suspended account later closed spends
 * nothing twice: its links were spent at suspension and `used_at is null`
 * finds none.
 *
 * The audit event says which, `customer_links.spent_at_suspension` or
 * `customer_links.spent_at_closing`, because the two are different acts an
 * operator may be asked about separately.
 *
 * No drop and no delete statement. SECURITY INVOKER, search_path pinned.
 */

create or replace function public.eng_spend_links_on_suspension()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  v_spent uuid[];
  v_entity text;
  v_act text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if tg_table_name = 'eng_customer_users' then
    if new.status is distinct from 'suspended' then
      return new;
    end if;
    v_entity := 'customer_user';
    v_act := 'suspension';
    with spent as (
      update public.eng_customer_auth_tokens t
         set used_at = now()
       where t.customer_user_id = new.id
         and t.used_at is null
      returning t.id
    )
    select coalesce(array_agg(id order by id), '{}') into v_spent from spent;
  else
    if new.status not in ('suspended', 'closed') then
      return new;
    end if;
    v_entity := 'customer_account';
    v_act := case when new.status = 'closed' then 'closing' else 'suspension' end;
    with spent as (
      update public.eng_customer_auth_tokens t
         set used_at = now()
       where t.used_at is null
         and t.customer_user_id in (
           select u.id from public.eng_customer_users u where u.account_id = new.id
         )
      returning t.id
    )
    select coalesce(array_agg(id order by id), '{}') into v_spent from spent;
  end if;

  if cardinality(v_spent) > 0 then
    insert into public.eng_audit_events (action, entity_type, entity_id, summary, diff)
    values (
      'customer_links.spent_at_' || v_act,
      v_entity,
      new.id::text,
      cardinality(v_spent) || ' outstanding link(s) spent because the ' ||
        case when v_entity = 'customer_user' then 'person was suspended'
             when v_act = 'closing' then 'account was closed'
             else 'account was suspended' end,
      jsonb_build_object('token_ids', to_jsonb(v_spent))
    );
  end if;

  return new;
end;
$fn$;
