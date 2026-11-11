/*
 * 0127: A FRANCHISEE OWNER READS THEIR OWN FRANCHISE.
 *
 * Robert's overnight orders of 2026-11-10 into 2026-11-11, item 3, platform
 * item X2 of the franchise standing list: the franchisee owner role. Cut from
 * X1 under his answer 1 of 2026-11-11, and numbered after X1's 0126 under his
 * answer 2 (the keystore's 0125 sits first).
 *
 * STAFF AND ADMIN ONLY IN THE SENSE THAT MATTERS: nothing here is public,
 * nothing offers a franchise, and FR13 stands. An owner's account is made by an
 * administrator and joined to its franchise on the franchisee record (0126).
 *
 * No table and no column. One role row and four grant rows:
 *
 *   franchisee_owner     lands on /portal/franchise, its second factor
 *                        required, not a system role.
 *   franchise.read_own   franchisee_owner and admin. The scope is the
 *                        reader's own live membership in
 *                        eng_franchisee_members, applied in the application
 *                        (src/lib/own-franchise.ts), the same way every other
 *                        eng_ table is read: through the service role, with
 *                        row level security on and no policy.
 *   profiles.read_self,  the owner's own profile, as every role holds.
 *   profiles.update_self
 *
 * WHAT THE OWNER DOES NOT HOLD IS THE POINT OF THE ROLE, and each is the
 * absence of a row here: no files.list or orders.read, so no work and no
 * money; no pricing, billing or ledger grant; no crm grant and no
 * profiles.list, so no other territory and nobody outside their franchise; no
 * franchise.manage, so they change nothing on the record. No grant can carry a
 * licensed act, so sealing is out of reach by construction.
 */

/* ------------------------------------------------------------- 0. the ground */
do $$
begin
  if to_regclass('public.eng_franchisee_members') is null then
    raise exception 'eng: 0127 follows 0126, which adds eng_franchisee_members. It does not exist here.';
  end if;
  if to_regclass('public.eng_device_sessions') is null then
    raise exception 'eng: 0127 follows 0125, which adds eng_device_sessions. It does not exist here.';
  end if;
  if exists (select 1 from public.eng_roles where key = 'franchisee_owner') then
    raise exception 'eng: 0127 expects no franchisee_owner role before it runs.';
  end if;
end;
$$;

/* --------------------------------------------------------------- 1. the role */
/* The four column shape every role seed in this chain uses, which roles-audit reads; the second factor follows as its own statement. */
insert into eng_roles (key, name, landing_path, is_system) values
  ('franchisee_owner', 'Franchisee Owner', '/portal/franchise', false)
on conflict (key) do nothing;

update eng_roles set mfa_requirement = 'required' where key = 'franchisee_owner';

/* ------------------------------------------------------------- 2. the grants */
insert into eng_role_grants (role_key, action) values
  ('franchisee_owner', 'profiles.read_self'),
  ('franchisee_owner', 'profiles.update_self'),
  ('franchisee_owner', 'franchise.read_own'),
  ('admin', 'franchise.read_own')
on conflict (role_key, action) do nothing;

/* ------------------------------------------------------- 3. what must be true */
do $$
begin
  if not exists (
    select 1 from public.eng_roles
    where key = 'franchisee_owner' and landing_path = '/portal/franchise' and not is_system and mfa_requirement = 'required'
  ) then
    raise exception 'eng: 0127 expects franchisee_owner landing on /portal/franchise, not a system role, its second factor required.';
  end if;
  if (select count(*) from public.eng_role_grants where role_key = 'franchisee_owner') <> 3 then
    raise exception 'eng: 0127 expects franchisee_owner to hold exactly three grants.';
  end if;
  if (select count(*) from public.eng_role_grants where action = 'franchise.read_own') <> 2
     or not exists (select 1 from public.eng_role_grants where action = 'franchise.read_own' and role_key = 'admin')
     or not exists (select 1 from public.eng_role_grants where action = 'franchise.read_own' and role_key = 'franchisee_owner') then
    raise exception 'eng: 0127 expects franchise.read_own held by franchisee_owner and admin and nobody else.';
  end if;
end;
$$;
