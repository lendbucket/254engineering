/*
 * ===========================================================================
 * 0063: A SUSPENSION SPENDS EVERY LIVE LINK, AT THE DATABASE.
 *
 * RENUMBERED FROM 0064 ON 2026-10-07, COMMENTS ONLY, for the same reason as
 * 0062. Development applied it as 0064 that day; every statement is unchanged.
 * Closing an account was added by the operator's ruling the same day, in 0064,
 * rather than by editing this file after development had run it.
 * ===========================================================================
 *
 * Operator ruling, 2026-09-29: "A password reset changes the password only,
 * never the account status. A suspended account stays suspended until I lift
 * it. Suspending an account also invalidates every outstanding reset and set
 * password token for its users. Only an operator action reactivates." Trigger
 * as the guarantee, application row as the record with the actor.
 *
 * The application half shipped on 2026-09-29: setCustomerPassword refuses a
 * suspended holder before the token is spent. What it cannot cover is a route
 * written later that spends a token some other way. This file is the half
 * that cannot be walked around. BACKLOG.md, "THE TRIGGER THAT INVALIDATES
 * TOKENS AT SUSPENSION".
 *
 * MARKS SPENT, NEVER DELETES, on the operator's ruling: a deleted token leaves
 * no evidence it existed, and the question afterwards is "was there a live link
 * when we suspended them", which only a spent row can answer. A spent row
 * alone cannot say WHY it was spent (used, or spent by a suspension), so every
 * suspension that spends anything writes one audit event naming the token ids
 * it spent, in the same transaction. The event carries no actor, because a
 * trigger cannot know who; the application's own audit row beside it does.
 *
 * TWO DOORS, ONE FUNCTION. A person can be suspended (eng_customer_users) or
 * their whole organisation can (eng_customer_accounts), and the ruling covers
 * both: "every outstanding reset and set password token for its users".
 * Closing an account is not suspending it and is not covered; that is recorded
 * as a question in BACKLOG.md rather than decided here.
 *
 * THERE IS NO drop STATEMENT IN THIS FILE, ON PURPOSE. The Supabase connector
 * refuses any statement containing drop or delete (operator note, 2026-10-07).
 * The triggers are new names, so `create trigger` applies as written, and the
 * production step is this file unchanged.
 *
 * SECURITY INVOKER, search_path pinned, like every function since 0008.
 */

create or replace function public.eng_spend_links_on_suspension()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  v_spent uuid[];
  v_entity text;
begin
  if new.status is distinct from 'suspended' or old.status is not distinct from 'suspended' then
    return new;
  end if;

  if tg_table_name = 'eng_customer_users' then
    v_entity := 'customer_user';
    with spent as (
      update public.eng_customer_auth_tokens t
         set used_at = now()
       where t.customer_user_id = new.id
         and t.used_at is null
      returning t.id
    )
    select coalesce(array_agg(id order by id), '{}') into v_spent from spent;
  else
    v_entity := 'customer_account';
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
      'customer_links.spent_at_suspension',
      v_entity,
      new.id::text,
      cardinality(v_spent) || ' outstanding link(s) spent because the ' ||
        case when v_entity = 'customer_user' then 'person' else 'account' end || ' was suspended',
      jsonb_build_object('token_ids', to_jsonb(v_spent))
    );
  end if;

  return new;
end;
$fn$;

create trigger eng_customer_users_suspension_spends_links
  after update of status on eng_customer_users
  for each row execute function public.eng_spend_links_on_suspension();

create trigger eng_customer_accounts_suspension_spends_links
  after update of status on eng_customer_accounts
  for each row execute function public.eng_spend_links_on_suspension();
