/*
 * 0111: A ROLE'S GRANT SET IS REPLACED IN ONE ACT.
 *
 * Robert's Q12 of 2026-11-02 (office audit F8): "setGrants becomes one SQL
 * function (stage branch)." Numbered 0111 by his ruling (a) of 2026-11-04; the
 * staged CRM and follow-up migrations moved up one to 0112 to 0119.
 *
 * Development first, on stage/0111-role-grants-one-act; production at the chat
 * counterpart's sitting after the board passes.
 *
 * WHAT IT CLOSES. setGrants in src/lib/ops-roles.ts deleted every grant for
 * the role and then inserted the new set, as two PostgREST calls outside any
 * transaction. If the insert failed after the delete succeeded, the role was
 * left with NO grants. For the admin role that locks every administrator out
 * of everything, the roles screen included, and the strand rule that ran a
 * moment earlier cannot help, because it judged the state before the delete.
 * No audit row was written for the partial change.
 *
 * WHAT IT DOES. One function replaces one role's grant set inside the
 * transaction of the statement that calls it: the delete and the insert both
 * happen or neither does. The rules stay in code, ahead of the call, exactly
 * as before: the ALL_ACTIONS filter and canSetGrants' strand rule (no change
 * may leave no active holder of roles.manage). The function adds two refusals
 * that cost nothing: a role that does not exist, and an action named twice.
 *
 * THE DELETE IN THE BODY RUNS ONLY WHEN THE FUNCTION IS CALLED. Applying this
 * migration creates the function and changes no row: no statement in this
 * file outside the function body reads or writes a grant.
 *
 * WHY NOT SECURITY DEFINER. The caller is the service role (supabaseAdmin),
 * which already bypasses row level security on eng_role_grants; 0071's
 * eng_take_sign_in_attempt is the same shape. Execute is revoked from public,
 * anon and authenticated, so nothing but the service role can call it.
 *
 * Additive: one function, no table change, no drop.
 */

do $$
begin
  if to_regclass('public.eng_role_grants') is null or to_regclass('public.eng_roles') is null then
    raise exception 'eng: 0111 replaces grants on eng_role_grants (0018), and it or eng_roles does not exist here.';
  end if;
  if to_regprocedure('public.eng_set_role_grants(text, text[])') is not null then
    raise exception 'eng: 0111 expects no eng_set_role_grants before it runs.';
  end if;
end $$;

create or replace function public.eng_set_role_grants(p_role_key text, p_actions text[])
returns jsonb
language plpgsql
set search_path = ''
as $fn$
declare
  v_before text[];
  v_after  text[];
begin
  if not exists (select 1 from public.eng_roles where key = p_role_key) then
    raise exception 'eng_set_role_grants: no role %', p_role_key using errcode = '22023';
  end if;
  if p_actions is null then
    raise exception 'eng_set_role_grants: the action list is null' using errcode = '22023';
  end if;
  if (select count(*) from unnest(p_actions)) <> (select count(distinct a) from unnest(p_actions) a) then
    raise exception 'eng_set_role_grants: an action is named twice' using errcode = '22023';
  end if;

  select coalesce(array_agg(action order by action), '{}') into v_before
    from public.eng_role_grants where role_key = p_role_key;

  delete from public.eng_role_grants where role_key = p_role_key;
  insert into public.eng_role_grants (role_key, action)
    select p_role_key, a from unnest(p_actions) a;

  select coalesce(array_agg(action order by action), '{}') into v_after
    from public.eng_role_grants where role_key = p_role_key;

  return jsonb_build_object('before', to_jsonb(v_before), 'after', to_jsonb(v_after));
end;
$fn$;

comment on function public.eng_set_role_grants(text, text[]) is
  'Replaces one role''s grant set in one transaction, so a failed insert never leaves the role with fewer grants than before. Rules (ALL_ACTIONS, the roles.manage strand rule) stay in src/lib/ops-roles.ts ahead of the call. Robert''s Q12, office audit F8, 2026-11-02. 0111.';

revoke all on function public.eng_set_role_grants(text, text[]) from public;
revoke all on function public.eng_set_role_grants(text, text[]) from anon, authenticated;

do $$
begin
  if to_regprocedure('public.eng_set_role_grants(text, text[])') is null then
    raise exception 'eng: 0111 expects eng_set_role_grants after it runs.';
  end if;
  if has_function_privilege('anon', 'public.eng_set_role_grants(text, text[])', 'execute')
     or has_function_privilege('authenticated', 'public.eng_set_role_grants(text, text[])', 'execute') then
    raise exception 'eng: 0111 expects eng_set_role_grants not executable by anon or authenticated.';
  end if;
end $$;
