-- ===========================================================================
-- 0009: the B2B ordering path.
--
-- Accounts for organisations, bulk submissions, saved defaults, keyed API
-- access, and invoiced billing with statements.
--
-- WHY THIS IS NOT A ROLE ON eng_profiles
-- --------------------------------------
-- eng_profiles is the staff table. Its id IS the auth.users id, and can() in
-- ops-authz decides what a row in that table may do. Adding a fourth role to it
-- would mean a customer with a profile row, and from then on every screen,
-- every route handler and every query would be one forgotten check away from
-- showing a solar installer another firm's file.
--
-- So a customer has NO row in eng_profiles and no row in auth.users. They are a
-- different kind of thing with a different credential store, a different cookie
-- signed with a different key, and no representation at all in the type that
-- ops-authz accepts. currentActor() cannot return a customer, so can() cannot
-- grant one anything. That is a structural boundary rather than a policy one,
-- and it is the whole reason for the extra tables.
--
-- WHY ACCOUNTS HANG OFF eng_clients
-- ---------------------------------
-- Because the file history already does. An organisation that has been sending
-- work since before accounts existed has eng_files, eng_documents and an audit
-- trail pointing at its eng_clients row. Converting them to an account holder
-- must not orphan any of it, so the account references the client rather than
-- replacing it, and conversion is an INSERT rather than a migration of history.
--
-- THE site COLUMN, AND WHY IT IS HERE ON DAY ONE
-- ---------------------------------------------
-- An account belongs to one brand. This costs nothing now, when there is one
-- operator and three sites, and it is the difference between the platform being
-- licensable later and needing a rewrite to become so. The program says a choice
-- that makes future tenancy harder should be avoided where a neutral one exists.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. The account, and the people who can sign into it.
-- ---------------------------------------------------------------------------
create table if not exists eng_customer_accounts (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  site              text not null,
  client_id         uuid not null references eng_clients(id) on delete restrict,

  status            text not null default 'active'
                      check (status in ('active', 'suspended', 'closed')),

  -- How they pay. 'card' charges at submission, which is the consumer path.
  -- 'invoice' accepts orders without payment and bills at period close.
  billing_mode      text not null default 'card'
                      check (billing_mode in ('card', 'invoice')),

  -- Credit, in the operator's words: a per organisation setting with a default
  -- of none. Null is not "unlimited", it is "no credit", and account-credit.ts
  -- treats it that way. An unset limit must never be the permissive case.
  credit_limit_cents  bigint,
  net_days            integer not null default 30 check (net_days between 0 and 120),

  -- Saved defaults. One row rather than a side table: they are all single
  -- valued, they are all optional, and a join to read a default turnaround
  -- would be a join on every order this account places.
  billing_email       text,
  billing_contact     text,
  preferred_urgency   text check (preferred_urgency in ('standard', 'expedited', 'emergency')),
  access_instructions text,
  default_counties    text[] not null default '{}',

  notes             text,
  suspended_reason  text,

  -- One account per organisation per brand. A solar installer that orders from
  -- two of the three brands has two accounts, which is correct: they are
  -- different businesses with different prices and different statements.
  unique (site, client_id)
);

create index if not exists eng_customer_accounts_client_idx on eng_customer_accounts (client_id);
create index if not exists eng_customer_accounts_status_idx on eng_customer_accounts (status, billing_mode);

drop trigger if exists eng_customer_accounts_touch on eng_customer_accounts;
create trigger eng_customer_accounts_touch before update on eng_customer_accounts
  for each row execute function eng_touch_updated_at();

comment on table eng_customer_accounts is
  'An ordering account for a client ORGANISATION. Deliberately not a role on eng_profiles: a customer has no profile and no auth.users row, so ops-authz cannot grant them anything.';
comment on column eng_customer_accounts.credit_limit_cents is
  'Null means NO credit, never unlimited. An unset limit must not be the permissive case.';


-- ---------------------------------------------------------------------------
-- 2. The contacts who can sign in.
-- ---------------------------------------------------------------------------
--
-- Passwords are hashed here rather than in auth.users, and that is the point:
-- there is no path by which a customer credential becomes a staff credential.
-- The hash is scrypt with a per user salt, computed in the application.
create table if not exists eng_customer_users (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  account_id        uuid not null references eng_customer_accounts(id) on delete cascade,
  contact_id        uuid references eng_contacts(id) on delete set null,

  email             text not null,
  display_name      text not null,
  phone             text,

  status            text not null default 'invited'
                      check (status in ('invited', 'active', 'suspended')),

  password_hash     text,
  password_salt     text,

  -- Whether this person may act for the whole organisation or only see their
  -- own orders. Deliberately two values: a permission matrix for customers is
  -- a product nobody asked for.
  account_role      text not null default 'member'
                      check (account_role in ('owner', 'member')),

  last_sign_in_at   timestamptz,
  suspended_at      timestamptz
);

create unique index if not exists eng_customer_users_email_key
  on eng_customer_users (lower(email));
create index if not exists eng_customer_users_account_idx
  on eng_customer_users (account_id, status);

drop trigger if exists eng_customer_users_touch on eng_customer_users;
create trigger eng_customer_users_touch before update on eng_customer_users
  for each row execute function eng_touch_updated_at();

comment on table eng_customer_users is
  'A person who can sign into a customer account. No auth.users row and no eng_profiles row, by design. Password hashed with scrypt in the application.';

-- One time links for customers, mirroring eng_auth_tokens and deliberately a
-- separate table: a token that could be spent against either surface would be a
-- way to cross the boundary this migration exists to build.
create table if not exists eng_customer_auth_tokens (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  customer_user_id  uuid not null references eng_customer_users(id) on delete cascade,
  purpose           text not null check (purpose in ('set_password', 'reset_password')),
  token_hash        text not null unique,
  expires_at        timestamptz not null,
  used_at           timestamptz
);

create index if not exists eng_customer_auth_tokens_user_idx
  on eng_customer_auth_tokens (customer_user_id, purpose);


-- ---------------------------------------------------------------------------
-- 3. Properties they order against repeatedly.
-- ---------------------------------------------------------------------------
create table if not exists eng_account_properties (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  account_id        uuid not null references eng_customer_accounts(id) on delete cascade,

  label             text,
  property_address  text not null,
  city              text,
  county            text not null,
  postal_code       text,
  access_notes      text,
  archived_at       timestamptz
);

create index if not exists eng_account_properties_account_idx
  on eng_account_properties (account_id) where archived_at is null;

drop trigger if exists eng_account_properties_touch on eng_account_properties;
create trigger eng_account_properties_touch before update on eng_account_properties
  for each row execute function eng_touch_updated_at();


-- ---------------------------------------------------------------------------
-- 4. Keyed API access, per organisation.
-- ---------------------------------------------------------------------------
--
-- The key is stored hashed, exactly as eng_auth_tokens and eng_customer_access
-- do, so a database disclosure is not a set of working keys.
--
-- A key belongs to ONE account and the account is read from the key rather than
-- from the request, which is the same rule /api/order-flow already follows for
-- the site. A caller cannot create an order for an organisation that is not
-- theirs, because there is no field in which to ask.
create table if not exists eng_account_api_keys (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  account_id        uuid not null references eng_customer_accounts(id) on delete cascade,

  label             text not null,
  -- The first characters, shown in the UI so a key can be identified without
  -- being revealed. Never enough to reconstruct one.
  prefix            text not null,
  key_hash          text not null unique,

  -- Requests per minute. Null takes the platform default rather than meaning
  -- unlimited, for the same reason credit_limit_cents does.
  rate_limit_per_minute integer check (rate_limit_per_minute > 0),

  last_used_at      timestamptz,
  revoked_at        timestamptz,
  revoked_reason    text
);

create index if not exists eng_account_api_keys_account_idx
  on eng_account_api_keys (account_id) where revoked_at is null;

comment on table eng_account_api_keys is
  'Per organisation API keys, stored hashed. The account is read from the key, never from the request body, so a key cannot order for somebody else.';


-- ---------------------------------------------------------------------------
-- 5. Bulk submissions.
-- ---------------------------------------------------------------------------
--
-- One submission, many properties, one payment. Each property still becomes its
-- own eng_service_orders row and its own eng_files row, because everything
-- downstream, dispatch, review, sealing and the responsible charge log, is
-- per property and must stay that way.
--
-- The batch is what the customer paid against and what the operator looks at.
create table if not exists eng_order_batches (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  site              text not null,
  reference         text not null unique,
  account_id        uuid references eng_customer_accounts(id) on delete set null,

  service_slug      text not null,
  tier              text,

  status            text not null default 'draft'
                      check (status in ('draft', 'awaiting_payment', 'accepted',
                                        'complete', 'cancelled')),

  -- What was submitted against what was taken. The difference is the properties
  -- that failed qualification, and it is recorded rather than derived, because
  -- the customer was shown these numbers before they paid.
  submitted_count   integer not null default 0,
  accepted_count    integer not null default 0,
  rejected_count    integer not null default 0,

  total_cents       bigint,
  currency          text not null default 'usd',

  -- Why each rejected property was rejected, in the customer's words, kept as
  -- it was shown to them. Consumer protection record, same reasoning as
  -- eng_service_orders.refund_disclosure.
  rejections        jsonb,

  placed_at         timestamptz,
  paid_at           timestamptz,
  cancelled_at      timestamptz,

  client_request_id text not null default gen_random_uuid()::text,
  notes             text
);

create unique index if not exists eng_order_batches_request_id
  on eng_order_batches (client_request_id);
create index if not exists eng_order_batches_account_idx
  on eng_order_batches (account_id, created_at desc);

drop trigger if exists eng_order_batches_touch on eng_order_batches;
create trigger eng_order_batches_touch before update on eng_order_batches
  for each row execute function eng_touch_updated_at();

comment on table eng_order_batches is
  'One bulk submission. Each property still becomes its own order and its own file, because dispatch, review and responsible charge are all per property.';


-- ---------------------------------------------------------------------------
-- 6. Statements, for accounts billed by invoice.
-- ---------------------------------------------------------------------------
create table if not exists eng_statements (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  account_id        uuid not null references eng_customer_accounts(id) on delete restrict,
  reference         text not null unique,
  period            text not null,

  status            text not null default 'open'
                      check (status in ('open', 'issued', 'paid', 'void')),

  total_cents       bigint,
  currency          text not null default 'usd',

  issued_at         timestamptz,
  due_at            timestamptz,
  paid_at           timestamptz,
  voided_at         timestamptz,
  void_reason       text,

  unique (account_id, period)
);

create index if not exists eng_statements_account_idx
  on eng_statements (account_id, status, due_at);

drop trigger if exists eng_statements_touch on eng_statements;
create trigger eng_statements_touch before update on eng_statements
  for each row execute function eng_touch_updated_at();

-- A line per order. amount_cents is copied rather than read through the order,
-- for the same reason the order copies the catalog: a statement is what the
-- customer was billed, not what the price is today.
create table if not exists eng_statement_lines (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  statement_id      uuid not null references eng_statements(id) on delete cascade,
  order_id          uuid not null references eng_service_orders(id) on delete restrict,
  description       text not null,
  amount_cents      bigint not null,
  unique (statement_id, order_id)
);

create index if not exists eng_statement_lines_statement_idx
  on eng_statement_lines (statement_id);

comment on table eng_statements is
  'A period statement for an invoiced account. Dunning and collections are deliberately absent: the state is made visible to the operator and stops there.';


-- ---------------------------------------------------------------------------
-- 7. Wiring the new objects into the existing ones.
-- ---------------------------------------------------------------------------

alter table eng_service_orders add column if not exists account_id uuid
  references eng_customer_accounts(id) on delete set null;
alter table eng_service_orders add column if not exists batch_id uuid
  references eng_order_batches(id) on delete set null;

-- What this order contributed to the batch total. Without it, refunding one
-- property out of a ten property batch would have no amount to work from,
-- because the charge row belongs to the batch.
alter table eng_service_orders add column if not exists batch_share_cents bigint;

-- How this order is being paid for, copied from the account at placement rather
-- than read live, so changing an account to invoice next month does not
-- retrospectively change how last month's order was taken.
alter table eng_service_orders add column if not exists billing_mode text
  check (billing_mode in ('card', 'invoice'));

alter table eng_service_orders add column if not exists statement_id uuid
  references eng_statements(id) on delete set null;

create index if not exists eng_service_orders_account_idx
  on eng_service_orders (account_id, created_at desc) where account_id is not null;
create index if not exists eng_service_orders_batch_idx
  on eng_service_orders (batch_id) where batch_id is not null;
create index if not exists eng_service_orders_unbilled_idx
  on eng_service_orders (account_id, billing_mode) where statement_id is null;

comment on column eng_service_orders.batch_share_cents is
  'This order share of a batch payment. The charge row belongs to the batch, so without this a single property could not be refunded out of one.';
comment on column eng_service_orders.billing_mode is
  'Copied from the account at placement, never read live. Changing an account to invoice must not change how an order already taken was paid for.';

-- Money can now attach to an order, a batch, or a statement.
--
-- order_id becomes nullable and a CHECK requires at least one subject. Not
-- exactly one: a refund of a single property out of a batch legitimately names
-- both, and that is the row that says which property the money went back for.
alter table eng_order_payments alter column order_id drop not null;
alter table eng_order_payments add column if not exists batch_id uuid
  references eng_order_batches(id) on delete restrict;
alter table eng_order_payments add column if not exists statement_id uuid
  references eng_statements(id) on delete restrict;

alter table eng_order_payments drop constraint if exists eng_order_payments_has_subject;
alter table eng_order_payments add constraint eng_order_payments_has_subject
  check (order_id is not null or batch_id is not null or statement_id is not null);

create index if not exists eng_order_payments_batch_idx
  on eng_order_payments (batch_id) where batch_id is not null;
create index if not exists eng_order_payments_statement_idx
  on eng_order_payments (statement_id) where statement_id is not null;

comment on constraint eng_order_payments_has_subject on eng_order_payments is
  'At least one subject, not exactly one. A refund of one property out of a batch names both the order and the batch, and that row is what says which property the money went back for.';


-- ---------------------------------------------------------------------------
-- 8. Closed door, same as everything else.
-- ---------------------------------------------------------------------------
alter table eng_customer_accounts     enable row level security;
alter table eng_customer_users        enable row level security;
alter table eng_customer_auth_tokens  enable row level security;
alter table eng_account_properties    enable row level security;
alter table eng_account_api_keys      enable row level security;
alter table eng_order_batches         enable row level security;
alter table eng_statements            enable row level security;
alter table eng_statement_lines       enable row level security;
