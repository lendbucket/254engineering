/*
 * ===========================================================================
 * 0103: THE SECOND FACTOR IS REQUIRED FOR THE FIELD TECHNICIAN.
 * Robert's answer 1 of 2026-10-28, 08:18 Central (issue #1 comment
 * 6470044608), on the mobile plan's ruling 13.
 * ===========================================================================
 *
 * Ruling 13 asked that a technician on the installed app sign in with a
 * second factor. The server cannot tell the installed app from a browser tab:
 * anything the app sends, a browser can send too. So the only way the ruling
 * holds is for the field technician role to require the second factor
 * everywhere, which is what he answered. The shape is 0093's.
 *
 * WHAT IT CHANGES FOR A PERSON. A technician who has not enrolled is sent to
 * enrolment at their next sign in, and cannot reach the portal until they
 * have (the session route reads mfa_requirement through mfaRequirementFor).
 * A technician already enrolled notices nothing.
 *
 * One row updated. No schema change. The read-back covers every role: the
 * five that must be required are, and the four that stay optional are, so a
 * role this does not name cannot have moved without the apply refusing.
 */
update eng_roles set mfa_requirement = 'required' where key = 'field_tech';

do $$
declare
  wrong text;
begin
  if (select count(*) from eng_roles where key = 'field_tech') <> 1 then
    raise exception 'eng: 0103 expects the field_tech role to exist (0018).';
  end if;
  select string_agg(key || ' reads ' || mfa_requirement, ', ' order by key) into wrong
    from eng_roles
   where key in ('admin', 'engineer', 'field_tech', 'ops_manager', 'rep') and mfa_requirement is distinct from 'required';
  if wrong is not null then
    raise exception 'eng: after 0103 the administrator, engineer, field technician, operations manager and rep must read required, and %.', wrong;
  end if;
  select string_agg(key || ' reads ' || mfa_requirement, ', ' order by key) into wrong
    from eng_roles
   where key in ('customer_service', 'dispatcher', 'read_only', 'sales') and mfa_requirement is distinct from 'optional';
  if wrong is not null then
    raise exception 'eng: 0103 moves the field technician only, and %.', wrong;
  end if;
end;
$$;
