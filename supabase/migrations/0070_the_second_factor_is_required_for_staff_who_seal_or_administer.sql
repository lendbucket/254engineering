/*
 * ===========================================================================
 * 0070: THE SECOND FACTOR IS REQUIRED FOR THE ADMINISTRATOR AND THE ENGINEER.
 * Operator ruling, 2026-10-10 (gaps 3 and 4 of the product audit).
 * ===========================================================================
 *
 * 0025 made it optional for both, deliberately: one operator must not be able
 * to lock himself out of a platform nobody else can administer. The two roles
 * that can do the most were the two not required to hold a second factor, and
 * the SOC 2 pack has listed that as a gap ever since. The operator ruled it
 * required; the lockout risk is answered by the break-glass path he approved.
 *
 * WHAT IT CHANGES FOR A PERSON. An administrator or engineer who has not
 * enrolled is sent to enrolment at their next sign in, and cannot reach the
 * portal until they have (the session route reads mfa_requirement through
 * mfaRequirementFor). An enrolled account notices nothing. The sitting
 * document reads who is not enrolled BEFORE this is applied.
 *
 * Two rows updated. No schema change. Other roles keep what they have.
 */
update eng_roles set mfa_requirement = 'required' where key in ('admin', 'engineer');

do $$
declare
  n integer;
begin
  select count(*) into n from eng_roles where key in ('admin', 'engineer') and mfa_requirement = 'required';
  if n <> 2 then
    raise exception 'eng: % of the two staff roles read required after 0070, and both must.', n;
  end if;
end;
$$;
