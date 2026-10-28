/*
 * ===========================================================================
 * 0100  A SITE CALLING /api/orders IS HELD TO TWENTY REQUESTS A MINUTE.
 * ===========================================================================
 *
 * Robert's ruling 6 of 2026-10-27, 22:05 Central, on the end-of-day status
 * (issue #1 comment 6458195521): "a 20 a minute per-site limit on
 * /api/orders", before Sealed's ordering opens.
 *
 * WHAT IT DOES
 *
 *   eng_site_order_requests, one row per request a site's key has made to
 *   /api/orders once that site's ordering is open and the gate is open. The
 *   limiter counts a site's rows in the last minute (src/lib/sister-order-door.ts).
 *
 *   COUNTED FROM ROWS, NOT FROM MEMORY, for the reason 0010 records for the
 *   account API: a limit kept per function instance is the limit times however
 *   many instances are warm, which is not a limit.
 *
 *   A REQUEST, NOT AN ORDER. A request refused for a bad body still counts, or
 *   a caller could hammer the door with bad bodies for free (0010, the same
 *   sentence). So the row is written before the body is acted on, and it
 *   carries no body: the order tables already hold that correctly.
 *
 * WHAT IT REFUSES
 *
 *   An intent other than order, quote, upload or unreadable (a body that was
 *   not JSON, which still counts). An empty site.
 *
 * ADDITIVE ONLY. No drop and no delete. One table, one index.
 */

create table if not exists eng_site_order_requests (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  site        text not null check (length(site) > 0),
  intent      text not null check (intent in ('order', 'quote', 'upload', 'unreadable'))
);

create index if not exists eng_site_order_requests_window_idx
  on eng_site_order_requests (site, created_at desc);

alter table eng_site_order_requests enable row level security;

comment on table eng_site_order_requests is
  'One row per /api/orders request from a site whose ordering is open. The per-site limit of 20 a minute counts these (0100). Stores no request body.';
