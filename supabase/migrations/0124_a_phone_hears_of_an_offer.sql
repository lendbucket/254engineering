/*
 * ===========================================================================
 * 0124: A PHONE HEARS OF AN OFFER.
 * Robert's T9, 2026-11-07, and his answers 6 and 7 of the same night
 * (issue #1, 6717223376): "Push: yes, build web push now as T9. Email stays on
 * by default beside it until push is proven on Robert's own phone. Its
 * migration goes through the normal sitting." "What a push says: yes. 'A job
 * is offered to you: county, service', with no address and no price on the
 * lock screen."
 * ===========================================================================
 *
 * ONE TABLE.
 *   eng_push_subscriptions  one row per phone a person has allowed to be told,
 *                           holding the push service's endpoint for it. The
 *                           endpoint is unique: one phone, one row, whoever
 *                           holds it now. A subscription the push service
 *                           says is gone (404 or 410) is stamped revoked_at
 *                           and never sent to again; a person turning alerts
 *                           off stamps it too. Rows are stamped, never
 *                           deleted, except with the person they belong to.
 *
 * WHAT IS SENT, AND WHAT IS NOT KEPT. A web push carries no payload: the
 * phone's service worker asks the server what to show when one arrives, so
 * nothing about a job crosses a browser's push service, and nothing here holds
 * the wording. The p256dh and auth keys a browser returns with a subscription
 * are not stored, because a push with no payload needs neither.
 *
 * THREE CHANNELS, ONE TABLE (Robert's T8 of 2026-11-08: native push "reuses
 * T9's subscription table and push channel"). `channel` says what the endpoint
 * is: `web`, a browser's https push address; `fcm`, an Android phone's Firebase
 * token; `apns`, an iPhone's Apple token. A native push carries its own text
 * through Apple's or Google's service, so for those two the lock screen's words
 * (county and service, never an address or a price) do cross the push service.
 * That is the one difference, stated rather than hidden. Amended before it was
 * applied anywhere: 0124 had reached no database when the native channels were
 * added, so this is the same migration and not a second one.
 *
 * ADDITIVE ONLY: no drop, no change to an existing constraint. Telemetry about
 * a device rather than a regulatory or financial fact, declared in
 * retention-policy.ts. RLS on, no policies, every grant revoked: the service
 * role reads and writes.
 *
 * Development first, then production, each in a sitting, after T9's board.
 */

/* ------------------------------------------------------------------- section 0 */

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'eng_prospects_type_known')
     or pg_get_constraintdef((select oid from pg_constraint where conname = 'eng_prospects_type_known')) not like '%manufactured_home_dealer%' then
    raise exception 'eng: 0124 follows 0123, which widens eng_prospects_type_known to the eight verticals. It is not here.';
  end if;
  if to_regclass('public.eng_push_subscriptions') is not null then
    raise exception 'eng: 0124 expects no eng_push_subscriptions before it runs.';
  end if;
end;
$$;

/* ------------------------------------------------------------------------ table */

create table eng_push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  profile_id       uuid not null references eng_profiles (id) on delete cascade,
  /* Which push service: a browser's (web), Firebase's (fcm, Android) or Apple's (apns, iPhone). */
  channel          text not null default 'web'
                     constraint eng_push_subscriptions_channel_known
                     check (channel in ('web', 'fcm', 'apns')),
  /*
   * Where to reach this phone: for web, the push service's https address; for
   * fcm and apns, the device token the operating system issued.
   */
  endpoint         text not null,
  constraint eng_push_subscriptions_endpoint_fits_channel check (
    (channel = 'web' and endpoint like 'https://%' and length(endpoint) <= 2000)
    or (channel in ('fcm', 'apns') and endpoint !~ '\s' and length(endpoint) between 16 and 4096)
  ),
  /* What the phone said it was when it subscribed, for the person reading the list. */
  user_agent       text,
  last_success_at  timestamptz,
  revoked_at       timestamptz,
  revoked_reason   text,
  constraint eng_push_subscriptions_revocation_says_why
    check ((revoked_at is null) = (revoked_reason is null))
);

create unique index eng_push_subscriptions_endpoint_once on eng_push_subscriptions (endpoint);
create index eng_push_subscriptions_live_idx on eng_push_subscriptions (profile_id) where revoked_at is null;

alter table eng_push_subscriptions enable row level security;
revoke all on eng_push_subscriptions from public, anon, authenticated;

comment on table eng_push_subscriptions is
  'One row per phone allowed to hear of an offer (Robert''s T9 of 2026-11-07 and T8 of 2026-11-08): a browser push address, or a Firebase or Apple device token, by channel. Web pushes carry no payload; native pushes carry county and service only. Revoked rows are stamped, never sent to. 0124.';

/* ------------------------------------------------------------- closing assert */

do $$
begin
  if to_regclass('public.eng_push_subscriptions') is null then
    raise exception 'eng: 0124 expects eng_push_subscriptions after it runs.';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.eng_push_subscriptions'::regclass) then
    raise exception 'eng: 0124 expects row level security on eng_push_subscriptions.';
  end if;
  if to_regclass('public.eng_push_subscriptions_endpoint_once') is null then
    raise exception 'eng: 0124 expects one row per endpoint.';
  end if;
end;
$$;
