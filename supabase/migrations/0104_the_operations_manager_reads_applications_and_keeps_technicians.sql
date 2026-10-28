/*
 * ===========================================================================
 * 0104: THE OPERATIONS MANAGER READS APPLICATIONS AND KEEPS TECHNICIANS.
 * Robert's answer 3 of 2026-10-28, 08:18 Central (issue #1 comment
 * 6470044608).
 * ===========================================================================
 *
 * The W2 walk found the operations manager named on the technician screens by
 * the workflow map and refused by the code: he holds technicians.onboard
 * (0079), so he can invite a technician, and he held neither the grant that
 * reads the application nor the ones that list technicians and verify their
 * credentials. Robert's answer is to grant them.
 *
 * WHAT IT ADDS.
 *   applications.read  a new action, split out of profiles.create, which gated
 *                      /portal/applications until now. The administrator keeps
 *                      the screen through it, and the operations manager gains
 *                      it. The page and its nav item ask for it.
 *   profiles.list      /portal/techs and the staff list, for the operations
 *                      manager.
 *   profiles.update    verifying and recording a technician's credentials,
 *                      training and coverage, for the operations manager.
 *
 * It narrows the ruling of 2026-10-20, which kept both profile grants from the
 * two staff levels, for the operations manager only. The rep keeps neither, and
 * roles-audit still says so. Nothing here changes a role: that is roles.manage,
 * the administrator's alone.
 *
 * Four rows. No schema change. Declared in DEFAULT_ROLES, pinned in
 * roles-audit. The read-back refuses unless exactly these holders exist.
 */
insert into eng_role_grants (role_key, action) values
  ('admin', 'applications.read'),
  ('ops_manager', 'applications.read'),
  ('ops_manager', 'profiles.list'),
  ('ops_manager', 'profiles.update')
on conflict (role_key, action) do nothing;

do $$
declare
  wrong text;
begin
  if (select count(*) from eng_roles where key in ('admin', 'ops_manager')) <> 2 then
    raise exception 'eng: 0104 expects the admin and ops_manager roles to exist (0018, 0079).';
  end if;
  select string_agg(role_key, ', ' order by role_key) into wrong
    from eng_role_grants where action = 'applications.read' and role_key not in ('admin', 'ops_manager');
  if wrong is not null then
    raise exception 'eng: after 0104 only the administrator and the operations manager may read applications, and % also do.', wrong;
  end if;
  if (select count(*) from eng_role_grants
       where (role_key, action) in (('admin', 'applications.read'), ('ops_manager', 'applications.read'),
                                    ('ops_manager', 'profiles.list'), ('ops_manager', 'profiles.update'))) <> 4 then
    raise exception 'eng: after 0104 the four grants must all be present.';
  end if;
  if exists (select 1 from eng_role_grants where role_key = 'rep' and action in ('profiles.list', 'profiles.update', 'applications.read')) then
    raise exception 'eng: 0104 grants the operations manager only, and the rep holds one of the three.';
  end if;
end;
$$;
