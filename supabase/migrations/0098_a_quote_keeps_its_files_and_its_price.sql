/*
 * 0098: A QUOTE KEEPS ITS FILES AND ITS PRICE. Robert's addendum of 2026-10-25,
 * 22:46 Central, item 3: "The office prices a quote request and sends it; the
 * customer accepts by a tokened link and pays; it converts with
 * convertibleToOrder. Quote list screen, quote email, expiry. ... Files attached
 * to a quote request are kept, not dropped."
 *
 * eng_quote_requests has existed since 0006 with the whole pipeline in its
 * columns: quoted_cents, scope, sent_at, expires_at, decided_at and
 * converted_order_id, with one order per quote enforced by a unique index. What
 * it never had was a writer, and three things the office now needs:
 *
 *   1. eng_quote_files. A file attached to a quote request was dropped: the
 *      order flow uploaded it to eng-uploads and requestQuote never
 *      recorded it, so the object sat in the bucket with nothing pointing at
 *      it. One row per file, keyed to the request, and the rows refuse UPDATE
 *      and DELETE, because a file somebody sent the firm is kept.
 *
 *   2. A sent quote states a price and a date it lapses, enforced. A quote in
 *      'sent' or 'accepted' with no price, no sent time, or no expiry after the
 *      sent time is the shape of a customer accepting an amount nobody wrote
 *      down. eng_quote_requests_priced_when_sent says so in the schema.
 *
 *   3. What the customer accepted cannot move. Once a quote is accepted its
 *      price, scope and expiry are fixed, and once it names the order it became,
 *      that order never changes (eng_quote_request_guard). A converted order
 *      must belong to an accepted quote (eng_quote_requests_converted_is_accepted).
 *
 *   4. The grant quotes.manage, for the administrator and the operations
 *      manager: the office prices, sends and declines. Declared in DEFAULT_ROLES,
 *      pinned in roles-audit, seeded here.
 *
 * BEFORE THIS RUNS: no row may sit in 'sent' or 'accepted' without a price, a
 * sent time and a later expiry, and no converted row may be anything but
 * accepted, or the two checks refuse to add. Nothing in the platform has ever
 * written either status, so both counts are expected to be zero; the sitting
 * reads them first.
 *
 * ADDITIVE ONLY. One table, two checks, two functions, two triggers, two grant
 * rows. No drop, no delete. The first version carried four `drop ... if exists`
 * lines ahead of its own checks and triggers; the connector stopped on them for
 * a confirmation prompt at the development sitting of 2026-10-27, and nothing
 * was applied. They did nothing on a first apply, so they are gone, and this
 * file runs once, as every migration here does.
 */

create table if not exists eng_quote_files (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  quote_id      uuid not null references eng_quote_requests(id) on delete restrict,
  input_key     text not null check (btrim(input_key) <> ''),
  bucket        text not null check (bucket = 'eng-uploads'),
  storage_key   text not null check (storage_key ~ '^orders/[A-Za-z0-9][A-Za-z0-9._-]*/[A-Za-z0-9][A-Za-z0-9._-]*/'),
  content_type  text,
  byte_size     bigint check (byte_size is null or byte_size > 0),
  constraint eng_quote_files_once unique (quote_id, storage_key)
);

create index if not exists eng_quote_files_quote_idx on eng_quote_files (quote_id);

alter table eng_quote_files enable row level security;

comment on table eng_quote_files is
  'A file a customer attached to a quote request, in eng-uploads. Kept: the rows refuse change and removal (0098).';

create or replace function eng_quote_file_guard()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  raise exception 'eng_quote_files rows record a file a customer sent the firm. They are never changed or removed (0098).';
end;
$fn$;

create trigger eng_quote_files_guard before update or delete on eng_quote_files
  for each row execute function eng_quote_file_guard();

alter table eng_quote_requests
  add constraint eng_quote_requests_priced_when_sent check (
    status not in ('sent', 'accepted')
    or (quoted_cents is not null and quoted_cents > 0
        and sent_at is not null
        and expires_at is not null and expires_at > sent_at)
  );

alter table eng_quote_requests
  add constraint eng_quote_requests_converted_is_accepted check (
    converted_order_id is null or status = 'accepted'
  );

create or replace function eng_quote_request_guard()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if old.status = 'accepted' and (
       new.status is distinct from old.status
       or new.quoted_cents is distinct from old.quoted_cents
       or new.scope is distinct from old.scope
       or new.expires_at is distinct from old.expires_at
       or new.sent_at is distinct from old.sent_at
     ) then
    raise exception 'An accepted quote is what the customer agreed to. Its price, scope and dates do not change (0098).';
  end if;
  if old.converted_order_id is not null
     and new.converted_order_id is distinct from old.converted_order_id then
    raise exception 'A quote converts to one order, once. The order it names does not change (0098).';
  end if;
  return new;
end;
$fn$;

create trigger eng_quote_requests_guard before update on eng_quote_requests
  for each row execute function eng_quote_request_guard();

revoke all on eng_quote_files from public, anon, authenticated;
revoke execute on function eng_quote_file_guard(), eng_quote_request_guard()
  from public, anon, authenticated;

/* The office prices, sends and declines a quote (declared in DEFAULT_ROLES, pinned in roles-audit). */
insert into eng_role_grants (role_key, action) values
  ('admin', 'quotes.manage'),
  ('ops_manager', 'quotes.manage')
on conflict (role_key, action) do nothing;
