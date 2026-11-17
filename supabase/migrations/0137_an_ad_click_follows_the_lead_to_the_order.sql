/*
 * ===========================================================================
 * 0137. AN AD CLICK FOLLOWS THE LEAD TO THE ORDER.
 * ===========================================================================
 *
 * Robert's add-on of 2026-11-15 for the Google Ads landing page /start
 * (issue #1; answers of 12:29 and 13:11 Central): capture the click IDs and
 * utm values on landing, keep them on every lead and every order, send the
 * paid order to GA4 and Google Ads from the server, upload a phone order
 * that began as an ad lead as an offline conversion, follow an "email me the
 * price" lead with three emails that stop when that person orders, and remind
 * an unpaid order once.
 *
 * WHAT THIS ADDS, ALL OF IT ADDITIVE:
 *
 *   1. The click: gclid, gbraid, wbraid and clicked_at on eng_leads and
 *      eng_service_orders, and the utm values beside them on the two inquiry
 *      tables that never had any (eng_design_inquiries,
 *      eng_windstorm_inquiries). Every new column is nullable, so every row
 *      already written reads "no click recorded", which is the truth.
 *
 *   2. The finder's quote on a lead: the service it priced, the cents and the
 *      coastal answer. That is what the price emails say, read back from the
 *      row rather than from anything the browser sends later.
 *
 *   3. The follow up on a lead: which of the three emails went last, when the
 *      next is due, and when and why the sequence stopped. A lead that orders
 *      is stopped by the order, not by a timer.
 *
 *   4. The callback a lead asked for: when it falls due. A request after 8 PM
 *      Central falls due at 8 AM, and the rep's call list sorts on this.
 *
 *   5. On an order: the lead it came from (so an order taken over the phone
 *      for an ad lead carries that lead's click), and the one reminder an
 *      unpaid order gets, stamped so it can never be sent twice.
 *
 *   6. eng_ad_conversions: one row per conversion the platform owes Google,
 *      per destination, written when the event happens and sent by a job. It
 *      is the outbox for the GA4 Measurement Protocol, for Google Ads
 *      conversions sent from the server, and for the offline upload. A
 *      conversion is owed once, so (destination, kind, subject) is unique, and
 *      the job's answer is recorded on the row: sent, failed, or could_not_tell
 *      while the credentials are not set.
 *
 * PARTNER ATTRIBUTION IS NOT TOUCHED. Nothing here reads, writes or changes a
 * partner column, a partner touch or the attribution window. A click ID is a
 * fact recorded beside the partner fact, never instead of it.
 *
 * NOTHING HERE IS GRANTED TO anon, authenticated OR public. The new table has
 * row level security on and no policy, like every eng_ table the platform
 * reads through the service role.
 */

do $$
begin
  if to_regclass('public.eng_leads') is null or to_regclass('public.eng_service_orders') is null then
    raise exception 'eng: 0137 adds to eng_leads and eng_service_orders. One of them does not exist here.';
  end if;
  if to_regclass('public.eng_design_inquiries') is null or to_regclass('public.eng_windstorm_inquiries') is null then
    raise exception 'eng: 0137 adds to eng_design_inquiries and eng_windstorm_inquiries. One of them does not exist here.';
  end if;
end;
$$;

/* 1. The click, on the lead and the order. */
alter table eng_leads add column if not exists gclid text;
alter table eng_leads add column if not exists gbraid text;
alter table eng_leads add column if not exists wbraid text;
alter table eng_leads add column if not exists clicked_at timestamptz;

alter table eng_service_orders add column if not exists gclid text;
alter table eng_service_orders add column if not exists gbraid text;
alter table eng_service_orders add column if not exists wbraid text;
alter table eng_service_orders add column if not exists clicked_at timestamptz;

/* And on the two inquiry tables, which recorded no attribution of any kind. */
alter table eng_design_inquiries add column if not exists utm_source text;
alter table eng_design_inquiries add column if not exists utm_medium text;
alter table eng_design_inquiries add column if not exists utm_campaign text;
alter table eng_design_inquiries add column if not exists utm_term text;
alter table eng_design_inquiries add column if not exists utm_content text;
alter table eng_design_inquiries add column if not exists gclid text;
alter table eng_design_inquiries add column if not exists gbraid text;
alter table eng_design_inquiries add column if not exists wbraid text;
alter table eng_design_inquiries add column if not exists clicked_at timestamptz;

alter table eng_windstorm_inquiries add column if not exists utm_source text;
alter table eng_windstorm_inquiries add column if not exists utm_medium text;
alter table eng_windstorm_inquiries add column if not exists utm_campaign text;
alter table eng_windstorm_inquiries add column if not exists utm_term text;
alter table eng_windstorm_inquiries add column if not exists utm_content text;
alter table eng_windstorm_inquiries add column if not exists gclid text;
alter table eng_windstorm_inquiries add column if not exists gbraid text;
alter table eng_windstorm_inquiries add column if not exists wbraid text;
alter table eng_windstorm_inquiries add column if not exists clicked_at timestamptz;

/* 2. The finder's quote. */
alter table eng_leads add column if not exists quoted_service text;
alter table eng_leads add column if not exists quoted_cents integer;
alter table eng_leads add column if not exists quoted_coastal text;
alter table eng_leads drop constraint if exists eng_leads_quoted_cents_positive;
alter table eng_leads add constraint eng_leads_quoted_cents_positive check (quoted_cents is null or quoted_cents > 0);
alter table eng_leads drop constraint if exists eng_leads_quoted_coastal_known;
alter table eng_leads add constraint eng_leads_quoted_coastal_known check (quoted_coastal is null or quoted_coastal in ('yes', 'no', 'unsure'));

/* 3. The follow up: 0 means no email of the sequence has gone, 3 means the last has. */
alter table eng_leads add column if not exists follow_up_step smallint not null default 0;
alter table eng_leads add column if not exists follow_up_next_at timestamptz;
alter table eng_leads add column if not exists follow_up_stopped_at timestamptz;
alter table eng_leads add column if not exists follow_up_stopped_why text;
alter table eng_leads drop constraint if exists eng_leads_follow_up_step_range;
alter table eng_leads add constraint eng_leads_follow_up_step_range check (follow_up_step between 0 and 3);
create index if not exists eng_leads_follow_up_due_idx on eng_leads (follow_up_next_at)
  where follow_up_next_at is not null and follow_up_stopped_at is null;

/* 4. The callback. */
alter table eng_leads add column if not exists callback_due_at timestamptz;

/*
 * 4a. A photo or PDF the "something else, or not sure" form carries (item 5):
 * the private storage key under eng-uploads, leads/<draft>/report/<uuid>.<ext>,
 * written by the server from the key it signed. The office opens it through a
 * signed download, like every other customer document.
 */
alter table eng_leads add column if not exists attachment_key text;
create index if not exists eng_leads_callback_due_idx on eng_leads (callback_due_at) where callback_due_at is not null;

/* 5. The order's lead, and its one reminder. */
alter table eng_service_orders add column if not exists lead_id uuid references eng_leads (id) on delete restrict;
alter table eng_service_orders add column if not exists unpaid_reminder_sent_at timestamptz;
create index if not exists eng_service_orders_lead_idx on eng_service_orders (lead_id) where lead_id is not null;

/* 6. The conversions owed to Google. */
create table if not exists eng_ad_conversions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  destination   text not null,
  kind          text not null,
  order_id      uuid references eng_service_orders (id) on delete restrict,
  lead_id       uuid references eng_leads (id) on delete restrict,
  value_cents   integer,
  gclid         text,
  gbraid        text,
  wbraid        text,
  status        text not null default 'pending',
  attempts      integer not null default 0,
  last_error    text,
  sent_at       timestamptz,
  constraint eng_ad_conversions_destination_known check (destination in ('ga4', 'google_ads')),
  constraint eng_ad_conversions_kind_known check (kind in ('order_paid', 'callback', 'email_price', 'inquiry', 'offline_order')),
  constraint eng_ad_conversions_status_known check (status in ('pending', 'sent', 'failed', 'could_not_tell')),
  constraint eng_ad_conversions_value_not_negative check (value_cents is null or value_cents >= 0),
  constraint eng_ad_conversions_has_subject check (order_id is not null or lead_id is not null),
  constraint eng_ad_conversions_sent_has_time check ((status = 'sent') = (sent_at is not null))
);
create unique index if not exists eng_ad_conversions_once
  on eng_ad_conversions (destination, kind, coalesce(order_id, lead_id));
create index if not exists eng_ad_conversions_owed_idx on eng_ad_conversions (created_at)
  where status in ('pending', 'failed', 'could_not_tell');

alter table eng_ad_conversions enable row level security;
revoke all on eng_ad_conversions from public, anon, authenticated;

comment on table eng_ad_conversions is
  'One row per conversion the platform owes GA4 or Google Ads, sent by a job from the server: a paid order with its value, a callback request, an email-me-the-price request, an inquiry, and a paid order that began as an ad lead (the offline upload). Unique per destination, kind and subject, so a conversion is never sent twice. 0137.';

/* The closing block: each effect is asserted, so a partial apply cannot pass as a whole one. */
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'eng_leads' and column_name = 'gclid') then
    raise exception 'eng: 0137 did not add eng_leads.gclid';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'eng_service_orders' and column_name = 'lead_id') then
    raise exception 'eng: 0137 did not add eng_service_orders.lead_id';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'eng_windstorm_inquiries' and column_name = 'wbraid') then
    raise exception 'eng: 0137 did not add eng_windstorm_inquiries.wbraid';
  end if;
  if to_regclass('public.eng_ad_conversions') is null then
    raise exception 'eng: 0137 did not create eng_ad_conversions';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.eng_ad_conversions'::regclass) then
    raise exception 'eng: 0137 left row level security off on eng_ad_conversions';
  end if;
end;
$$;
