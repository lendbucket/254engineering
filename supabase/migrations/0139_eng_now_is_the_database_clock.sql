/*
 * 0139: eng_now() IS THE DATABASE'S CLOCK, FOR A RECORD THAT SAYS WHEN IT WAS MADE.
 *
 * Robert's answer 12 of 2026-11-21 (issue #1, 7072967992): build it and stage
 * it for his next sitting, do not merge. From docs/overnight-2026-09-24.md,
 * question R7.5 and section 3.4.
 *
 * scripts/soc2-evidence.mjs has called rpc("eng_now") since it was written, to
 * stamp the SOC 2 pack with a time the database agrees with rather than this
 * machine's clock (db-now.ts's rule: the machine clock was 85 seconds out on
 * 2026-09-11). No migration ever created the function, so the call always
 * returned nothing and the pack fell back to the created_at of the newest job,
 * which on a quiet system is hours or days old. Since 2026-09-24 the pack says
 * that honestly ("the most recent database stamped row, which may be older than
 * this run"); with this function it can say "generated on" and be right.
 *
 * WHAT IT IS. A stable SQL function returning now(), the transaction's start
 * time on the database server. It reads nothing and writes nothing.
 *
 * Its search_path is pinned, as every function's since 0008, and EXECUTE is
 * revoked from PUBLIC, anon and authenticated in this same file, as 0073
 * requires of any migration that adds a function, so only the service role can
 * call it. Additive: no table, column or row changes.
 */

create or replace function public.eng_now()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now()
$$;

comment on function public.eng_now() is
  'The database clock, for a record that states when it was made (0139). Reads nothing, writes nothing.';

revoke execute on function public.eng_now() from public, anon, authenticated;
grant execute on function public.eng_now() to service_role;
