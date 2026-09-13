-- ===========================================================================
-- 0043: an account says which door it came through, and whether the address
-- has been proven.
--
-- Phase 13 Section 1. Until now a customer existed because an ORDER existed:
-- checkout created the account as a side effect of taking money. Phase 13 opens
-- three doors, and the operator's ruling is that an account is ONE THING
-- however it is created, with the door recorded on it.
--
-- WHY THE ORIGIN IS A COLUMN AND NOT AN INFERENCE
-- ------------------------------------------------
-- It could be derived: an account with no order probably came from the
-- telephone, one with an order probably came from checkout. Probably is the
-- problem. A self service account places an order ten minutes later and becomes
-- indistinguishable from a checkout account, so the inference decays exactly as
-- the platform succeeds, and it decays silently.
--
-- It also answers a question nothing else can. "How did this person become a
-- customer" is asked during a dispute, during an access review, and by anybody
-- trying to work out which funnel is producing accounts. An inference cannot be
-- evidence in the first case.
--
-- WHY IT IS NULLABLE, AND WHY THAT IS NOT LAZINESS
-- -------------------------------------------------
-- Every account that exists today was created before origins were recorded, so
-- null is TRUE of them and a default would invent a fact about how somebody
-- became a customer. That is 0041's reasoning, applied again deliberately: a
-- filed document predating the firm's registration carries null rather than a
-- backfilled number, because a document filed before a registration existed was
-- not filed under it.
--
-- What holds the rule going forward is the creation path, which is one function
-- that every door calls, and accounts-audit, which asserts the three converge.
--
-- EMAIL VERIFICATION IS A TIMESTAMP, NOT A BOOLEAN
-- -------------------------------------------------
-- "Verified" answers whether. A timestamp answers whether AND when, which is
-- what somebody asks during an incident, and it costs nothing. Every other
-- state in this schema that could have been a boolean is a timestamp for the
-- same reason: suspended_at, used_at, sealed_at, verified_at on the MFA
-- enrolment.
--
-- AN UNVERIFIED ACCOUNT IS NOT A HALF ACCOUNT. Operator ruling: it cannot
-- order, cannot see anything, and says why. That is enforced in the
-- application, because the question "may this session do anything" is asked at
-- request time against a session, and a check constraint cannot see a session.
-- What the database holds is the fact; what the platform does with it is
-- customer-auth's job, and accounts-audit asserts the refusal.
-- ===========================================================================

alter table eng_customer_users
  add column if not exists origin text;

alter table eng_customer_users
  drop constraint if exists eng_customer_users_origin_is_a_known_door;
alter table eng_customer_users
  add constraint eng_customer_users_origin_is_a_known_door
  check (origin is null or origin in ('self_service', 'operator_created', 'order_checkout'));

alter table eng_customer_users
  add column if not exists email_verified_at timestamptz;

/*
 * A SELF SERVICE ACCOUNT CANNOT BE ACTIVE WITHOUT A PROVEN ADDRESS.
 *
 * The one rule of the three doors that belongs in the database rather than in a
 * request handler, because it is a statement about the ROW rather than about a
 * session: an account that anybody on the internet created, holding an address
 * nobody has proven, must not be in the state that lets it act.
 *
 * The other two doors are exempt and that is not an inconsistency. An operator
 * created account was opened by somebody who took a telephone call and can say
 * who they spoke to, and a checkout account was created by somebody who
 * successfully paid. Neither is an unproven claim by an anonymous stranger.
 */
alter table eng_customer_users
  drop constraint if exists eng_customer_users_self_service_is_verified;
alter table eng_customer_users
  add constraint eng_customer_users_self_service_is_verified
  check (
    origin is distinct from 'self_service'
    or status <> 'active'
    or email_verified_at is not null
  );

comment on column eng_customer_users.origin is
  'Which of the three doors created this account: self_service, operator_created, or order_checkout. Null means it predates 0043 and is never backfilled, because how somebody became a customer is not something a migration can know. Written by one creation function every door calls, and accounts-audit asserts the three converge. Phase 13 Section 1.';

comment on column eng_customer_users.email_verified_at is
  'When the address was proven, by opening a signed link. A timestamp rather than a boolean because whether AND when is what somebody asks during an incident, and the second costs nothing. A self service account cannot be active without one, which is a check constraint rather than a convention.';

create index if not exists eng_customer_users_origin_idx
  on eng_customer_users (origin, created_at desc);

/*
 * The unverified, which is the set somebody sweeps. Partial, because almost
 * every row will eventually have a verified timestamp and an index over the
 * whole column would be a scan wearing an index's name. Same reasoning as
 * 0038's effect_mode index.
 */
create index if not exists eng_customer_users_unverified_idx
  on eng_customer_users (created_at desc)
  where email_verified_at is null;
