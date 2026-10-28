/*
 * ===========================================================================
 * 0101: SALES, CUSTOMER SERVICE AND THE DISPATCHER LAND ON THEIR DASHBOARD.
 * Robert's ruling 11 of 2026-10-27, 22:05 Central.
 * ===========================================================================
 *
 * 0018 sent the three older staff roles straight to a list: the dispatcher and
 * customer service to /portal/files, sales to /portal/clients. The home screen
 * per role (CLAUDE.md 2d) is /portal, where the work due now is shown, and the
 * ruling sends each of the three there.
 *
 * WHAT IT CHANGES FOR A PERSON. Somebody in one of those roles lands on the
 * dashboard after signing in instead of on the list. Nothing they can open or
 * do changes: no grant moves, and the lists are one click away in the sidebar.
 *
 * Three rows updated. No schema change. DEFAULT_ROLES in src/lib/ops-authz.ts
 * says the same, and roles-audit applies this statement to the chain it reads,
 * so the declaration and the seed cannot disagree without the board saying so.
 * The read-back below refuses unless all three read /portal and every other
 * role is where it was.
 */
update eng_roles set landing_path = '/portal' where key in ('dispatcher', 'sales', 'customer_service');

do $$
declare
  wrong text;
begin
  if (select count(*) from eng_roles where key in ('dispatcher', 'sales', 'customer_service')) <> 3 then
    raise exception 'eng: 0101 expects the dispatcher, sales and customer_service roles to exist (0018).';
  end if;
  select string_agg(key || ' lands on ' || landing_path, ', ' order by key) into wrong
    from eng_roles
   where key in ('dispatcher', 'sales', 'customer_service') and landing_path <> '/portal';
  if wrong is not null then
    raise exception 'eng: after 0101 the three roles must land on /portal, and %.', wrong;
  end if;
  select string_agg(key || ' lands on ' || landing_path, ', ' order by key) into wrong
    from eng_roles
   where (key = 'engineer' and landing_path <> '/portal/review')
      or (key = 'field_tech' and landing_path <> '/portal/jobs')
      or (key in ('admin', 'ops_manager', 'rep', 'read_only') and landing_path <> '/portal');
  if wrong is not null then
    raise exception 'eng: 0101 moves three roles only, and %.', wrong;
  end if;
end $$;
