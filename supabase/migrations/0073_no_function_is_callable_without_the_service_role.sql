/*
 * ===========================================================================
 * 0073: NO eng_ FUNCTION IS CALLABLE WITHOUT THE SERVICE ROLE.
 * Security defect found on production by the operator's chat counterpart,
 * 2026-10-10. Operator ruling of the same day.
 * ===========================================================================
 *
 * WHAT WAS OPEN. eng_set_trade_price is SECURITY DEFINER, and EXECUTE on it
 * was granted to PUBLIC, anon and authenticated: PostgreSQL grants EXECUTE to
 * PUBLIC on every new function, and Supabase's default privileges grant it to
 * anon, authenticated and service_role in the public schema. So anybody holding
 * the project's publishable key could call it through PostgREST rpc and write a
 * trade price, as the function's owner, past every table's row level security.
 * The same grants stood on every other eng_ function: the eng_record_* writers,
 * eng_record_review_decision, eng_take_sign_in_attempt, eng_claim_jobs,
 * eng_approve_protocol and the trigger functions.
 *
 * WHY ONE GRANT IS ENOUGH. Every call this platform makes goes through the
 * service role (src/lib/supabase.ts builds the only client, and there is no
 * anon or publishable key anywhere in the repository; security-audit asserts
 * none reaches the browser). Trigger functions fire whatever their EXECUTE
 * grant says, because the privilege is checked when a trigger is created, not
 * when it fires.
 *
 * WHAT IT DOES. For every function in public whose name starts eng_, as the
 * database holds it at the moment this runs (so a function present on a
 * project and absent from this chain is covered too): revoke EXECUTE from PUBLIC, anon and authenticated, and grant it to
 * service_role. Then it asserts the result and raises if any eng_ function is
 * still executable by anon or authenticated, or not by service_role, so a
 * revoke that silently did nothing (a function owned by another role) fails the
 * migration instead of reading as done.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not alter the default privileges
 * of the public schema. Production's public schema is shared with applications
 * that are not this firm's, and a default changed there changes what their
 * next function can be called by. The guard for the next eng_ function is
 * migration-audit instead: its replay reproduces Supabase's default grant and
 * fails if any function is executable by anon or authenticated after the
 * chain, so a migration that adds a function must revoke in the same file.
 *
 * No table, column or row changes, so neither fingerprint moves: the shape
 * reads information_schema.columns and the behaviour digest hashes function
 * bodies and settings, not their grants.
 */
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'eng\_%'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end;
$$;

do $$
declare
  open_fns text;
  closed_fns text;
  total int;
begin
  select count(*),
         string_agg(p.oid::regprocedure::text, ', ') filter (
           where has_function_privilege('anon', p.oid, 'EXECUTE')
              or has_function_privilege('authenticated', p.oid, 'EXECUTE')),
         string_agg(p.oid::regprocedure::text, ', ') filter (
           where not has_function_privilege('service_role', p.oid, 'EXECUTE'))
    into total, open_fns, closed_fns
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'eng\_%';
  if total = 0 then
    raise exception 'eng: 0073 found no eng_ functions in public, so it changed nothing.';
  end if;
  if open_fns is not null then
    raise exception 'eng: after 0073 these are still executable by anon or authenticated: %', open_fns;
  end if;
  if closed_fns is not null then
    raise exception 'eng: after 0073 the service role cannot execute: %', closed_fns;
  end if;
end;
$$;
