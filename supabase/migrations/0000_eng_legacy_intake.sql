-- =============================================================================
-- The eng_ tables that predate the operations platform.
-- =============================================================================
--
-- WHY THIS FILE EXISTS, WRITTEN AFTER THE ONES NUMBERED ABOVE IT
-- --------------------------------------------------------------
-- eng_leads, eng_orders, eng_applications, eng_onboardings, and
-- eng_onboarding_items were created directly against the shared project before
-- this repo kept migrations. They had no DDL in version control, which was
-- survivable while there was exactly one database and nobody needed to build a
-- second.
--
-- Standing up a development project made it not survivable: eng_clients and
-- eng_files carry foreign keys into eng_leads and eng_orders, so 0001 cannot
-- apply to an empty database without these. This file is reconstructed from the
-- production catalog, verbatim, so a fresh project reaches the same shape.
--
-- It is numbered 0000 because it runs first, not because it was written first.
--
-- IT IS DELIBERATELY NOT RUN AGAINST PRODUCTION
-- ---------------------------------------------
-- Everything here already exists there. Every statement is idempotent anyway,
-- so applying it would be a no-op, but the reason it is safe is worth stating
-- rather than discovered: `if not exists` throughout, and no ALTER that changes
-- an existing column.
-- =============================================================================

create table if not exists eng_leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  site          text not null,
  form          text not null default 'waitlist',
  name          text,
  email         text,
  phone         text,
  company       text,
  city          text,
  plan_type     text,
  plans_per_month text,
  message       text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  utm_term      text,
  landing_path  text,
  referrer      text,
  user_agent    text,
  status        text not null default 'new',
  service       text,
  timeline      text
);

create table if not exists eng_orders (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  site            text not null,
  reference       text unique,
  contact_name    text,
  email           text,
  phone           text,
  company         text,
  plan_type       text,
  property_address text,
  city            text,
  state           text default 'TX',
  postal_code     text,
  rush            boolean not null default false,
  notes           text,
  file_paths      text[] not null default '{}',
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  landing_path    text,
  referrer        text,
  user_agent      text,
  status          text not null default 'received',
  service         text
);

create table if not exists eng_applications (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  site            text not null,
  role            text not null,
  name            text,
  email           text,
  phone           text,
  city            text,
  message         text,
  license_number  text,
  disciplines     text,
  tdi_appointed   boolean,
  availability    text,
  counties        text,
  experience      text,
  drone_license   boolean,
  reliable_vehicle boolean,
  landing_path    text,
  referrer        text,
  user_agent      text,
  status          text not null default 'new',
  payload         jsonb,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text
);

create table if not exists eng_onboardings (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  site                  text not null,
  person_name           text not null,
  email                 text not null,
  phone                 text,
  role                  text not null check (role in ('engineer', 'field_tech')),
  status                text not null default 'invited'
                          check (status in ('invited', 'in_progress', 'submitted', 'verified', 'complete')),
  invite_token_hash     text not null unique,
  invited_at            timestamptz not null default now(),
  invite_expires_at     timestamptz not null,
  submitted_at          timestamptz,
  verified_at           timestamptz,
  notes                 text,
  identity_verified_at  timestamptz,
  i9_examined_at        timestamptz
);

create table if not exists eng_onboarding_items (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  onboarding_id   uuid not null references eng_onboardings(id) on delete cascade,
  item_key        text not null,
  label           text not null,
  status          text not null default 'pending'
                    check (status in ('pending', 'uploaded', 'accepted', 'rejected')),
  storage_key     text,
  rejected_reason text,
  actor           text not null default 'person' check (actor in ('person', 'admin')),
  sort_order      integer not null default 0,
  updated_at      timestamptz not null default now(),
  unique (onboarding_id, item_key)
);

-- The closed door, same as everything else.
alter table eng_leads             enable row level security;
alter table eng_orders            enable row level security;
alter table eng_applications      enable row level security;
alter table eng_onboardings       enable row level security;
alter table eng_onboarding_items  enable row level security;

comment on table eng_onboardings is 'Invite-only onboarding records. Service role only: RLS on, zero policies. Never stores a social security number.';
comment on table eng_onboarding_items is 'Per-onboarding checklist. Data driven so items can be added per hire. storage_key points into the private eng-onboarding bucket.';
