/*
 * ===========================================================================
 * 0070: THE SECOND FACTOR IS REQUIRED FOR THE ENGINEER.
 * Operator ruling, 2026-10-10 (gap 3 of the product audit).
 * ===========================================================================
 *
 * 0025 made it optional for the administrator and the engineer, deliberately:
 * one operator must not be able to lock himself out of a platform nobody else
 * can administer. The engineer is the role that seals, and the operator ruled
 * the second factor required for it.
 *
 * THE ADMINISTRATOR STAYS OPTIONAL, BY A LATER RULING THE SAME DAY. This
 * migration was first written to require it for both (gaps 3 and 4). Before it
 * was applied anywhere, the operator ruled the administrator role stays
 * optional, replacing gap 4's ruling, so this migration touches the engineer
 * only. The SOC 2 gap for the administrator stays open with the reason
 * "operator's choice".
 *
 * WHAT IT CHANGES FOR A PERSON. An engineer who has not enrolled is sent to
 * enrolment at their next sign in, and cannot reach the portal until they have
 * (the session route reads mfa_requirement through mfaRequirementFor). An
 * enrolled engineer notices nothing. The sitting document reads who is not
 * enrolled BEFORE this is applied.
 *
 * One row updated. No schema change. Every other role keeps what it has.
 */
update eng_roles set mfa_requirement = 'required' where key = 'engineer';

do $$
declare
  engineer text;
  admin text;
begin
  select mfa_requirement into engineer from eng_roles where key = 'engineer';
  select mfa_requirement into admin from eng_roles where key = 'admin';
  if engineer is distinct from 'required' then
    raise exception 'eng: the engineer role reads % after 0070, and must read required.', engineer;
  end if;
  if admin is distinct from 'optional' then
    raise exception 'eng: the administrator role reads % after 0070, and stays optional by the operator''s ruling.', admin;
  end if;
end;
$$;
