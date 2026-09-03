-- ===========================================================================
-- 0006: the order engine.
--
-- Orders, quote requests, what the customer supplied, what they were shown, the
-- money, and the tokenized customer portal.
--
-- WHY THESE ARE NOT eng_orders
-- ----------------------------
-- eng_orders already exists. It is a legacy intake table, reconstructed in
-- 0000: a form submission with plan_type, file_paths and UTM capture, status
-- defaulting to 'received'. It is not a priced order with a payment, a refund
-- rule and a state machine.
--
-- It holds zero rows in production, nothing in this repository writes it, and
-- no eng_files row references it. Repurposing it would still be wrong for one
-- reason that cannot be checked from here: the eng_ tables are shared across
-- the brand family and it carries a `site` column, so sealedengineering or
-- stampmyplans may post to it. Rewriting a shared table's meaning on the
-- strength of what one of three repositories can see is the kind of assumption
-- this project's rules exist to prevent.
--
-- So the new object is eng_service_orders and the legacy table is left exactly
-- as it is. BACKLOG carries the question of whether the sister sites still use
-- it, which is the operator's to answer.
--
-- MONEY IS NULLABLE EVERYWHERE, AND THAT IS THE POINT
-- ---------------------------------------------------
-- Every money column is a nullable bigint, mirroring the Cents type in
-- src/lib/ops-money.ts. A price nobody has set is null, not zero. A NOT NULL
-- DEFAULT 0 here would defeat the whole of Phase 6 at the storage layer, where
-- no amount of care in the application can recover the distinction.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. The order.
-- ---------------------------------------------------------------------------
--
-- THE PRICE IS SNAPSHOTTED, NOT LOOKED UP
-- ---------------------------------------
-- price_cents, coastal_surcharge_cents, inspection_fee_cents and total_cents
-- are copied onto the row when the order is placed, and catalog_snapshot keeps
-- the whole entry as it read that day.
--
-- The catalog is a file that changes. An order has to remember what the
-- customer agreed to, not what the current file says, and the refund rule makes
-- this load bearing rather than tidy: the amount retained on a decline is the
-- inspection fee THAT WAS DISCLOSED. If the operator raises the fee next month,
-- reading it live would retain more from a customer than they were ever told
-- about, on an order placed before the change.
--
-- refund_disclosure is the text they were actually shown, stored verbatim. It
-- is the consumer protection record: the firm's answer to "what were you told
-- before you paid" should be a row, not a reconstruction from the code as it
-- stands today.
create table if not exists eng_service_orders (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Which brand took the order. The eng_ tables are shared across the family.
  site              text not null,
  -- Human readable, unique, what the customer quotes on the phone.
  reference         text not null unique,

  service_slug      text not null,
  order_type        text not null check (order_type in ('field', 'desk', 'quote')),

  status            text not null default 'draft'
                      check (status in ('draft', 'awaiting_payment', 'paid',
                                        'in_fulfilment', 'complete',
                                        'refunded', 'cancelled')),

  -- The customer. Not a portal account: they never get one.
  customer_name     text not null,
  customer_email    text not null,
  customer_phone    text,
  customer_company  text,

  property_address  text not null,
  city              text,
  county            text not null,
  postal_code       text,
  twia_county       boolean not null default false,

  -- Money as it stood when they agreed to it. Null means not set, never zero.
  price_cents               bigint,
  coastal_surcharge_cents   bigint,
  inspection_fee_cents      bigint,
  total_cents               bigint,
  currency                  text not null default 'usd',

  -- What the catalog said, and what the customer was told, that day.
  catalog_snapshot  jsonb,
  refund_disclosure text,

  -- The work. Set when intake creates the file.
  file_id           uuid references eng_files(id) on delete set null,
  client_id         uuid references eng_clients(id) on delete set null,

  -- Did anybody actually attend? The refund rule turns on this and on nothing
  -- else, so it is a column rather than something inferred from assignments.
  technician_visited boolean not null default false,

  -- Attribution, carried from the site's UTM capture.
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_content       text,
  utm_term          text,
  landing_path      text,
  referrer          text,

  placed_at         timestamptz,
  paid_at           timestamptz,
  completed_at      timestamptz,
  refunded_at       timestamptz,
  cancelled_at      timestamptz,

  -- Idempotency. NOT NULL with a default: see the index below.
  client_request_id text not null default gen_random_uuid()::text,

  notes             text
);

create index if not exists eng_service_orders_status_idx
  on eng_service_orders (status, created_at desc);
create index if not exists eng_service_orders_email_idx
  on eng_service_orders (lower(customer_email));
create index if not exists eng_service_orders_file_idx
  on eng_service_orders (file_id) where file_id is not null;

-- A PLAIN UNIQUE INDEX ON A NOT NULL COLUMN, AND BOTH HALVES MATTER.
--
-- Not partial: Phase 2 shipped a partial unique index for the offline capture
-- queue and the idempotency it was built for never worked, because Postgres
-- cannot infer a partial index for ON CONFLICT. Every insert took the
-- do-nothing path and the duplicate protection was decorative. It passed a
-- walkthrough check that happened to be asserting something else.
--
-- Not nullable either: Postgres treats nulls as distinct in a unique index, so
-- a nullable column would let unlimited rows carry no key and quietly opt out
-- of the protection. The default gives an order created by hand in the portal
-- its own value, so only a caller that supplies a key can collide, which is
-- exactly what the intake API wants.
create unique index if not exists eng_service_orders_request_id
  on eng_service_orders (client_request_id);

drop trigger if exists eng_service_orders_touch on eng_service_orders;
create trigger eng_service_orders_touch before update on eng_service_orders
  for each row execute function eng_touch_updated_at();

comment on table eng_service_orders is
  'A placed order from the customer flow. Not eng_orders, which is the legacy intake form; see the header of 0006. Money columns are nullable because an unset price is not a zero.';
comment on column eng_service_orders.inspection_fee_cents is
  'The fee DISCLOSED to this customer at checkout. The refund rule retains this amount and not whatever the catalog says today.';
comment on column eng_service_orders.refund_disclosure is
  'Verbatim text the customer was shown before paying. The record of what they were told, not a reconstruction from current code.';
comment on column eng_service_orders.technician_visited is
  'Whether anybody actually attended. The middle row of the refund rule turns on this alone.';


-- ---------------------------------------------------------------------------
-- 2. What the customer answered and supplied.
-- ---------------------------------------------------------------------------
--
-- One row per qualifier answer and per required input, rather than a jsonb blob
-- on the order.
--
-- The qualifying answers are the firm's evidence that it asked. "Can the roof be
-- reached safely" answered yes, by this person, at this time, is what the firm
-- points at when a technician arrives to find otherwise. A blob is queryable
-- only if somebody remembers its shape; rows survive the shape changing.
create table if not exists eng_order_inputs (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  order_id      uuid not null references eng_service_orders(id) on delete cascade,
  kind          text not null check (kind in ('qualifier', 'input')),
  -- The catalog's id for the question or the input.
  key           text not null,
  -- What was asked, as it read that day. The catalog can change.
  prompt        text,
  -- For a qualifier: the option chosen, and its text.
  option_index  integer,
  value_text    text,
  -- For a file input: where it landed. Private bucket, same as evidence.
  bucket        text,
  storage_key   text,
  content_type  text,
  byte_size     bigint
);

create index if not exists eng_order_inputs_order_idx
  on eng_order_inputs (order_id, kind);

-- One answer per question, and as many files as the customer sends.
--
-- A qualifier or a text input has exactly one value per key, so a second write
-- is a correction and must replace rather than accumulate. A file input is the
-- opposite: "photographs of the damage" is naturally several, so rows with a
-- storage_key are free to repeat.
--
-- Partial, and that is safe here ONLY because nothing uses ON CONFLICT against
-- it. Do not add an upsert on this index without reading the note on
-- eng_service_orders_request_id above first.
create unique index if not exists eng_order_inputs_one_answer
  on eng_order_inputs (order_id, kind, key) where storage_key is null;

comment on table eng_order_inputs is
  'One row per qualifier answer and per supplied input. Rows rather than jsonb because the qualifying answers are the firm evidence that it asked, and they outlive the shape of the catalog.';


-- ---------------------------------------------------------------------------
-- 3. The order's own timeline. Append only.
-- ---------------------------------------------------------------------------
--
-- eng_audit_events records who did what across the platform, keyed by actor.
-- Most of an order's history has no actor: a webhook, a scheduler, the customer
-- themselves. This is the order's story in order, and it is what the customer
-- portal renders in plain language.
create table if not exists eng_order_events (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  order_id      uuid not null references eng_service_orders(id) on delete cascade,
  event         text not null,
  -- Shown to the customer when true. Internal notes are not.
  customer_visible boolean not null default false,
  summary       text,
  detail        jsonb,
  -- Null for anything the platform or the customer did.
  actor_id      uuid references eng_profiles(id) on delete set null
);

create index if not exists eng_order_events_order_idx
  on eng_order_events (order_id, created_at);

-- ALLOW_CASCADE, matching eng_file_events, and the difference matters.
--
-- The strict eng_forbid_mutation() refuses a cascade delete too, which would
-- make any order that has ever recorded an event impossible to delete. An
-- append only history should protect the story of an order that exists, not
-- make every order immortal, including a demo one and one somebody opened by
-- mistake.
--
-- eng_file_events reached the same conclusion in 0001 and this follows it. The
-- payments table below is the deliberate exception: money is different, and
-- its own delete trigger plus an ON DELETE RESTRICT mean an order that took a
-- payment cannot be removed at all.
drop trigger if exists eng_order_events_immutable on eng_order_events;
create trigger eng_order_events_immutable before update or delete on eng_order_events
  for each row execute function eng_forbid_mutation_allow_cascade();

comment on table eng_order_events is
  'Append only history of one order. Separate from eng_audit_events because most of it has no actor: a webhook, a scheduler, the customer.';


-- ---------------------------------------------------------------------------
-- 4. The money that actually moved.
-- ---------------------------------------------------------------------------
--
-- A charge and a refund are both rows here. A refund never edits the charge,
-- for the same reason a ledger does not edit history: the firm has to be able
-- to say what was taken and what was given back, separately, years later.
--
-- amount_cents is NOT NULL here and nullable on the order, and that difference
-- is the point. An order can exist before anybody has priced it. A payment that
-- happened has an amount by definition.
create table if not exists eng_order_payments (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  order_id          uuid not null references eng_service_orders(id) on delete restrict,

  kind              text not null check (kind in ('charge', 'refund')),
  amount_cents      bigint not null,
  currency          text not null default 'usd',

  provider          text not null default 'stripe',
  -- The provider's identifier. Unique, so a webhook delivered twice is one row.
  provider_ref      text not null,
  status            text not null default 'pending'
                      check (status in ('pending', 'succeeded', 'failed', 'cancelled')),

  -- Why, for a refund. One of the three cases in the operator ruling.
  refund_case       text,
  failure_reason    text,

  -- The provider's own payload, kept whole. When a dispute happens in a year,
  -- the argument is settled by what the provider said, not by our summary.
  provider_payload  jsonb,

  unique (provider, provider_ref)
);

create index if not exists eng_order_payments_order_idx
  on eng_order_payments (order_id, kind, created_at desc);

drop trigger if exists eng_order_payments_touch on eng_order_payments;
create trigger eng_order_payments_touch before update on eng_order_payments
  for each row execute function eng_touch_updated_at();

-- Deletes are refused. A payment row is a financial record.
create or replace function eng_forbid_payment_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'eng_order_payments rows cannot be deleted. Record a refund instead.';
end;
$$;

drop trigger if exists eng_order_payments_no_delete on eng_order_payments;
create trigger eng_order_payments_no_delete before delete on eng_order_payments
  for each row execute function eng_forbid_payment_delete();

comment on table eng_order_payments is
  'Charges and refunds as separate rows. A refund never edits the charge. amount_cents is NOT NULL here and nullable on the order because a payment that happened has an amount by definition.';


-- ---------------------------------------------------------------------------
-- 5. Quote requests.
-- ---------------------------------------------------------------------------
--
-- A quote request is not an order and must never be stored as one with a null
-- price. It has its own pipeline, its own terminal states, and it becomes an
-- order only when the customer accepts, which is a row in eng_service_orders
-- pointing back here.
create table if not exists eng_quote_requests (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  site              text not null,
  reference         text not null unique,
  service_slug      text not null,

  status            text not null default 'new'
                      check (status in ('new', 'scoping', 'sent', 'accepted',
                                        'declined', 'expired')),

  customer_name     text not null,
  customer_email    text not null,
  customer_phone    text,
  customer_company  text,

  property_address  text,
  city              text,
  county            text,
  twia_county       boolean not null default false,

  -- What they told us about the project.
  brief             text,
  needed_by         date,

  -- What the firm came back with. Null until somebody scopes it.
  quoted_cents      bigint,
  scope             text,
  sent_at           timestamptz,
  expires_at        timestamptz,
  decided_at        timestamptz,
  decline_reason    text,

  -- Set when an accepted quote is converted. One order per quote.
  converted_order_id uuid references eng_service_orders(id) on delete set null,

  scoped_by         uuid references eng_profiles(id) on delete set null,

  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_content       text,
  utm_term          text,
  landing_path      text,
  referrer          text,

  client_request_id text not null default gen_random_uuid()::text,
  notes             text
);

create index if not exists eng_quote_requests_status_idx
  on eng_quote_requests (status, created_at desc);
-- Same shape and same reasoning as eng_service_orders_request_id above.
create unique index if not exists eng_quote_requests_request_id
  on eng_quote_requests (client_request_id);
-- One order per accepted quote, enforced rather than trusted.
create unique index if not exists eng_quote_requests_converted
  on eng_quote_requests (converted_order_id) where converted_order_id is not null;

drop trigger if exists eng_quote_requests_touch on eng_quote_requests;
create trigger eng_quote_requests_touch before update on eng_quote_requests
  for each row execute function eng_touch_updated_at();

comment on table eng_quote_requests is
  'A request for a quote, with its own pipeline. Never stored as an order with a null price: nothing is owed until the customer accepts.';
comment on column eng_quote_requests.quoted_cents is
  'Null until somebody scopes it. An unquoted request is not a free one.';


-- ---------------------------------------------------------------------------
-- 6. The customer's way in, without an account.
-- ---------------------------------------------------------------------------
--
-- WHY NO ACCOUNT
-- --------------
-- A customer orders one document, once. An account is a password they will
-- forget, a reset flow, a support burden, and one more credential this firm is
-- responsible for keeping. The order status page is a signed URL emailed to
-- them, and that is the whole authentication story.
--
-- The token is stored as a hash, exactly as eng_auth_tokens does, so a leaked
-- database row is not a leaked link.
create table if not exists eng_customer_access (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  order_id      uuid references eng_service_orders(id) on delete cascade,
  quote_id      uuid references eng_quote_requests(id) on delete cascade,
  token_hash    text not null unique,
  -- Long lived on purpose: an order takes weeks and the customer will come back
  -- to it. Revocation is the control, not a short expiry that mails them again.
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  last_seen_at  timestamptz,
  -- One of the two has to be set, and never both.
  constraint eng_customer_access_one_subject
    check ((order_id is null) <> (quote_id is null))
);

create index if not exists eng_customer_access_order_idx
  on eng_customer_access (order_id) where order_id is not null;
create index if not exists eng_customer_access_quote_idx
  on eng_customer_access (quote_id) where quote_id is not null;

comment on table eng_customer_access is
  'Signed URL access for a customer with no account. Token stored hashed, as eng_auth_tokens does, so a leaked row is not a leaked link.';


-- ---------------------------------------------------------------------------
-- 7. Closed door, same as everything else.
-- ---------------------------------------------------------------------------
--
-- RLS on, zero policies. Nothing reaches these tables except the service role,
-- which only the server holds. There is no browser Supabase client on any of
-- the three sites and no anon key in any bundle, so a policy would be a second
-- access path to reason about for no benefit.
alter table eng_service_orders   enable row level security;
alter table eng_order_inputs     enable row level security;
alter table eng_order_events     enable row level security;
alter table eng_order_payments   enable row level security;
alter table eng_quote_requests   enable row level security;
alter table eng_customer_access  enable row level security;
