-- ===========================================================================
-- 0037: the partner sign in was case insensitive and the schema was not.
--
-- Phase 12 Section 3, found by the maybeSingle survey the operator ordered at
-- gate 3, and it is a SCHEMA gap rather than a call site.
--
-- WHAT WAS WRONG
-- ---------------
-- `eng_partner_users.email` is `text not null unique`, which in Postgres is
-- CASE SENSITIVE. Every lookup against it is `ilike`, which is not. So
-- `Bob@example.com` and `bob@example.com` are two rows the schema permits and
-- one address as far as every piece of code that reads them is concerned.
--
-- Two things follow, and both were live:
--
--   Signing in became a lookup that matched two rows. PostgREST answers
--   PGRST116 for that, the error was discarded, and the result read as "no such
--   address": the person is refused with the deliberately generic message and
--   has no way to discover why.
--
--   The "one address, one partner" guard in ops-partners-admin is a lookup and
--   a refusal, with nothing underneath it. The same PGRST116 read as "no
--   existing user", so the guard passed and attached the address to a second
--   partner. THE STATE IT EXISTS TO PREVENT WAS THE STATE THAT DEFEATED IT.
--
-- The call sites are fixed in this branch, and they are not the fix. Ordering
-- and limiting picks one of two rows that should never have both existed. This
-- is what makes the second row impossible.
--
-- eng_customer_users has had exactly this since 0009, `unique (lower(email))`.
-- The partner table simply never got it, which is why the survey found the
-- mismatch on one side of the platform and not the other.
--
-- WHY THE PLAIN UNIQUE STAYS
-- ---------------------------
-- Dropping it would be a second change in a migration whose point is one
-- change, and it costs nothing to keep: it is strictly weaker than the index
-- below and can only ever refuse a row this already refuses.
--
-- WHAT HAPPENS IF THIS FAILS TO APPLY
-- ------------------------------------
-- It means two partner users already differ only in case, and that is a state
-- somebody has to LOOK AT rather than one a migration should resolve by
-- picking. There is no backfill here on purpose: merging two sign ins is a
-- decision about who a person is, and a migration is not where that gets made.
--
-- So it refuses BY NAME. A bare index build would fail with a duplicate key
-- error naming an index, and whoever read it would then have to write the query
-- themselves to find out whose account it was about.
--
-- Both databases were read before this was written. Development holds 8 partner
-- users and no such pair; production holds none at all. Checked rather than
-- assumed, because "there cannot be any yet" is exactly the assumption that is
-- wrong once.
-- ===========================================================================

do $$
declare
  clashes text;
begin
  select string_agg(format('%s (%s rows: %s)', lower(email), n, spellings), '; ')
  into clashes
  from (
    select lower(email) as email, count(*) as n, string_agg(email, ', ') as spellings
    from eng_partner_users
    group by lower(email)
    having count(*) > 1
  ) d;

  if clashes is not null then
    raise exception
      'Two partner users differ only in case, so a unique index on lower(email) cannot be built: %. Decide who each account belongs to before applying 0037. This migration will not choose between them: which sign in is the person is not a question a migration may answer.',
      clashes;
  end if;
end;
$$;

create unique index if not exists eng_partner_users_email_lower_key
  on eng_partner_users (lower(email));

comment on index eng_partner_users_email_lower_key is
  'One address, one partner user, whatever the casing. The plain unique on email is case sensitive while every lookup against it is ilike, so two rows differing only in case were permitted by the schema and indistinguishable to the code. Added 0037, matching eng_customer_users since 0009.';
