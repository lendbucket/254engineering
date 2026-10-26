/*
 * ===========================================================================
 * 0093: THE SECOND FACTOR IS REQUIRED FOR THE ADMINISTRATOR, THE OPERATIONS
 *       MANAGER AND THE REP.
 * Robert's addendum of 2026-10-25, item 5.
 * ===========================================================================
 *
 * 0025 made the second factor optional for the administrator and the engineer,
 * so that one operator could not lock himself out of a platform nobody else
 * could administer. 0070 required it for the engineer and, by the operator's
 * ruling of 2026-10-10, left the administrator optional. The addendum of
 * 2026-10-25 requires it for the administrator, the operations manager and the
 * rep. The lockout 0025 guarded against is answered by the recovery codes 0024
 * issues at enrolment, which the person keeps.
 *
 * WHAT IT CHANGES FOR A PERSON. Anybody in those three roles who has not
 * enrolled is sent to enrolment at their next sign in, and cannot reach the
 * portal until they have (the session route reads mfa_requirement through
 * mfaRequirementFor). Somebody enrolled notices nothing. The sitting document
 * reads who is not enrolled BEFORE this is applied.
 *
 * Three rows updated. No schema change. Every other role keeps what it has:
 * the read-back below refuses unless the four roles that must be required
 * are, and scripts/proofs/the-second-factor-is-required-for-staff.mjs reads
 * every other role before and after.
 */
update eng_roles set mfa_requirement = 'required' where key in ('admin', 'ops_manager', 'rep');

do $$
declare
  wrong text;
begin
  select string_agg(key || ' reads ' || mfa_requirement, ', ' order by key) into wrong
    from eng_roles
   where key in ('admin', 'ops_manager', 'rep', 'engineer') and mfa_requirement is distinct from 'required';
  if wrong is not null then
    raise exception 'eng: after 0093 the administrator, operations manager, rep and engineer roles must read required, and %.', wrong;
  end if;
  if (select count(*) from eng_roles where key in ('admin', 'ops_manager', 'rep')) <> 3 then
    raise exception 'eng: 0093 expects the admin, ops_manager and rep roles to exist (0018, 0079).';
  end if;
end;
$$;
