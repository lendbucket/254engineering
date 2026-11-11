/*
 * 0129: A FRANCHISEE RECORDS THE DAY IT STARTS OPERATING.
 *
 * Robert's answer 14 of 2026-11-11 on issue #1: the $400 monthly technology
 * fee is due "from the first full calendar month after it starts operating".
 * The record kept no such day, so the statement (platform item X3) could not
 * say when the fee begins. This adds it.
 *
 * ONE COLUMN, eng_franchisees.operating_since, a firm calendar day. The status
 * change writes it the first time a franchisee moves from onboarding to
 * operating (src/lib/franchisees.ts setFranchiseeStatus), and nothing writes it
 * again: a franchisee that is later ended keeps the day it began.
 *
 * NO CHECK TIES IT TO THE STATUS, on purpose. The record lets an operating
 * franchisee go back to onboarding (0126's status change), and the day it
 * first began operating stays true when it does; a check that a franchisee
 * onboarding has no such day would make that change fail.
 *
 * ADDITIVE ONLY: one column. Stacked on X4 (0128) under Robert's
 * answer 1 of 2026-11-11.
 */

/* ------------------------------------------------------------- 0. the ground */
do $$
begin
  if to_regclass('public.eng_franchisee_certificates') is null then
    raise exception 'eng: 0129 follows 0128, which adds eng_franchisee_certificates. It does not exist here.';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'eng_franchisees' and column_name = 'operating_since') then
    raise exception 'eng: 0129 expects no operating_since on eng_franchisees before it runs.';
  end if;
end;
$$;

/* -------------------------------------------------------------- 1. the column */
alter table eng_franchisees add column operating_since date;

comment on column eng_franchisees.operating_since is
  'The firm calendar day the franchisee first moved from onboarding to operating; the technology fee is due from the first full calendar month after it (Robert''s answer 14, 2026-11-11). Written once. 0129.';

/* ------------------------------------------------------- 2. what must be true */
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'eng_franchisees' and column_name = 'operating_since') then
    raise exception 'eng: 0129 expects operating_since on eng_franchisees after it runs.';
  end if;
end;
$$;
