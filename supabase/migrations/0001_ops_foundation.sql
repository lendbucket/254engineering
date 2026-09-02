-- =============================================================================
-- THE 254 OPERATIONS PLATFORM: the whole program's schema, in one migration.
-- =============================================================================
--
-- WHY EVERY PHASE'S TABLES ARE CREATED IN PHASE 0
-- -----------------------------------------------
-- The program ships in six phases behind six branches, but the data model is
-- designed once. A foundation laid one phase at a time acquires a shape that
-- makes phase four expensive, and by then the cost is invisible: it looks like
-- "review is just complicated" rather than "the file record has no idea an
-- engineer exists". So the tables below cover dispatch, review, the responsible
-- charge record, messaging, and the ledgers, and the later phases build
-- behaviour on them rather than migrating underneath themselves.
--
-- Empty tables are cheap. Retrofitting a foreign key onto a table with rows in
-- it, across a live portal, is not.
--
-- THE CLOSED DOOR, UNCHANGED
-- --------------------------
-- Every table here has RLS enabled and zero policies, exactly like the eng_
-- tables that came before it. With RLS on and no policy, the anon and
-- authenticated roles can neither read nor write through any route, including
-- with a leaked key. The service role bypasses RLS and is held server side only.
--
-- That is why there is no browser Supabase client in this repo and must never
-- be one. Authorization is enforced in src/lib/ops-authz.ts, in front of every
-- query, and asserted by scripts/roles-audit.mjs. The database is a vault with
-- one door, and the guard on that door is application code that is tested.
--
-- TEXT PLUS CHECK RATHER THAN POSTGRES ENUMS
-- ------------------------------------------
-- Every status column is text with a CHECK constraint. Enums read better and
-- are worse here: ALTER TYPE ... ADD VALUE cannot run inside a transaction in
-- older Postgres, cannot be reordered, and cannot have a value removed at all.
-- This schema will gain statuses. A CHECK constraint is dropped and recreated in
-- one statement.
--
-- MONEY IS INTEGER CENTS
-- ----------------------
-- Never float. Every amount column is *_cents bigint.
--
-- NO SENSITIVE IDENTIFIERS ANYWHERE
-- ---------------------------------
-- There is no social security number column, no date of birth column, and no
-- government ID number column in this schema, and there is not going to be one.
-- Identity documents live in the private bucket as files and are examined by a
-- human; nothing is read out of them into a field. That rule predates this
-- platform and survives it.
-- =============================================================================


-- --- shared helpers ----------------------------------------------------------

create or replace function eng_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

/*
 * The audit trail is append only, and this is what makes that true.
 *
 * RLS cannot enforce it: the service role bypasses RLS, and the service role is
 * what every write in this application uses. A trigger is not bypassed by
 * anyone, so an UPDATE or DELETE against the trail fails for the application,
 * for a future migration written in a hurry, and for a person in the SQL editor
 * at two in the morning.
 *
 * A regulatory memory that can be edited is not a memory. It is a claim.
 */
create or replace function eng_forbid_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'eng: % is append only. % is not permitted on it.', tg_table_name, tg_op;
end;
$$;


-- --- PHASE 0: identity -------------------------------------------------------

/*
 * One row per person who can sign in, keyed to Supabase Auth.
 *
 * WHY ROLE SPECIFIC COLUMNS LIVE HERE RATHER THAN IN TWO SIDE TABLES
 * ------------------------------------------------------------------
 * An engineer has a licence and an appointment; a technician has coverage
 * counties and a certification state. Split into eng_engineers and eng_techs,
 * every query that wants "who is this person" becomes a three way join, and the
 * roster screen that lists everybody becomes a union. The columns are nullable
 * and the CHECK below states which role may carry which, so the constraint that
 * a side table would have bought is kept without the joins.
 */
create table if not exists eng_profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  email                 text not null,
  display_name          text not null,
  phone                 text,

  role                  text not null check (role in ('admin', 'engineer', 'field_tech')),
  status                text not null default 'invited'
                          check (status in ('invited', 'active', 'suspended')),

  -- engineer only
  license_number        text,
  license_state         text default 'TX',
  tdi_appointment       text check (tdi_appointment in ('none', 'applied', 'appointed')),

  -- field tech only
  coverage_counties     text[] not null default '{}',
  base_city             text,
  base_county           text,
  certification_status  text check (certification_status in ('none', 'in_progress', 'certified')),

  last_sign_in_at       timestamptz,
  suspended_at          timestamptz,
  notes                 text,

  constraint eng_profiles_role_fields check (
    (role = 'engineer'   or (license_number is null and tdi_appointment is null))
    and
    (role = 'field_tech' or (certification_status is null and coverage_counties = '{}'))
  )
);
create unique index if not exists eng_profiles_email_key on eng_profiles (lower(email));
create index if not exists eng_profiles_role_status_idx on eng_profiles (role, status);
create index if not exists eng_profiles_counties_idx on eng_profiles using gin (coverage_counties);
drop trigger if exists eng_profiles_touch on eng_profiles;
create trigger eng_profiles_touch before update on eng_profiles
  for each row execute function eng_touch_updated_at();

/*
 * One time links: setting a password on a new account, and resetting one.
 *
 * The token is never stored. Only its SHA-256 is, so a database disclosure does
 * not hand over working links, which is the same reasoning already recorded in
 * src/lib/onboarding-tokens.ts.
 *
 * WHY NOT SUPABASE'S OWN INVITE EMAIL
 * -----------------------------------
 * Because the firm sends its own mail, from a named sender, through the layout
 * every other message uses. A Supabase branded email arriving from a project id
 * nobody recognises is the opposite of what a new engineer should receive.
 */
create table if not exists eng_auth_tokens (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  profile_id    uuid not null references eng_profiles(id) on delete cascade,
  purpose       text not null check (purpose in ('set_password', 'reset_password')),
  token_hash    text not null unique,
  expires_at    timestamptz not null,
  used_at       timestamptz,
  created_by    uuid references eng_profiles(id) on delete set null
);
create index if not exists eng_auth_tokens_profile_idx on eng_auth_tokens (profile_id, purpose);

/*
 * The audit trail. Immutable, and see eng_forbid_mutation above.
 *
 * actor_email is denormalised on purpose. A trail that says "profile 7f3a did
 * this" and then loses profile 7f3a to a deletion has recorded an event with no
 * actor, which is worse than useless in a regulatory context. The email is
 * copied in at write time and stays whatever it was on that day.
 */
create table if not exists eng_audit_events (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  /*
   * Pointer only, and deliberately NOT a foreign key.
   *
   * It was one, "on delete set null", and that made deleting a profile ask
   * Postgres to UPDATE this table, which the immutability trigger below
   * correctly refuses. A profile referenced by any trail row could not be
   * deleted at all, and the error named the trigger rather than the constraint.
   *
   * Dropping the reference is also the right model: a regulatory trail whose
   * rows depend on a profile still existing loses its actor the day somebody
   * leaves. That is why actor_email is denormalised beside it.
   */
  actor_id      uuid,
  actor_email   text,
  actor_role    text,
  action        text not null,
  entity_type   text not null,
  entity_id     text,
  summary       text,
  diff          jsonb,
  ip            text,
  user_agent    text
);
create index if not exists eng_audit_entity_idx on eng_audit_events (entity_type, entity_id, created_at desc);
create index if not exists eng_audit_actor_idx on eng_audit_events (actor_id, created_at desc);
drop trigger if exists eng_audit_events_immutable on eng_audit_events;
create trigger eng_audit_events_immutable before update or delete on eng_audit_events
  for each row execute function eng_forbid_mutation();


-- --- PHASE 1: clients and files ---------------------------------------------

create table if not exists eng_clients (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  kind            text not null check (kind in ('organization', 'individual')),
  name            text not null,
  client_type     text check (client_type in (
                    'homeowner', 'solar_installer', 'lender', 'realtor', 'title',
                    'general_contractor', 'roofer', 'insurance_carrier',
                    'municipality', 'other')),
  status          text not null default 'active' check (status in ('active', 'inactive')),

  email           text,
  phone           text,
  address         text,
  city            text,
  county          text,
  postal_code     text,

  -- Where this client came from. The three public sites already capture UTM on
  -- every lead; conversion copies it here so attribution survives the lead row.
  source_site     text,
  source_form     text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  landing_path    text,
  referrer        text,

  converted_from_lead_id  uuid references eng_leads(id) on delete set null,
  converted_from_order_id uuid references eng_orders(id) on delete set null,

  notes           text,
  created_by      uuid references eng_profiles(id) on delete set null
);
create index if not exists eng_clients_name_idx on eng_clients (lower(name));
create index if not exists eng_clients_type_idx on eng_clients (client_type, status);
drop trigger if exists eng_clients_touch on eng_clients;
create trigger eng_clients_touch before update on eng_clients
  for each row execute function eng_touch_updated_at();

create table if not exists eng_contacts (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  client_id     uuid not null references eng_clients(id) on delete cascade,
  name          text not null,
  title         text,
  email         text,
  phone         text,
  is_primary    boolean not null default false,
  notes         text
);
create index if not exists eng_contacts_client_idx on eng_contacts (client_id);
drop trigger if exists eng_contacts_touch on eng_contacts;
create trigger eng_contacts_touch before update on eng_contacts
  for each row execute function eng_touch_updated_at();

/*
 * THE FILE. The central object of the firm: one per deliverable request.
 *
 * THE STATUS LIST IS THE STATE MACHINE'S ALPHABET, NOT THE MACHINE
 * ----------------------------------------------------------------
 * The CHECK below says which words are legal. It says nothing about which
 * transitions are legal, because a transition table in SQL is unreadable and
 * untestable. The machine lives in src/lib/ops-files.ts with a test suite, and
 * every transition writes an eng_file_events row. The constraint here is the
 * backstop that keeps a typo out of the column.
 *
 * COUNTY IS STORED, NOT DERIVED AT READ TIME
 * ------------------------------------------
 * Dispatch matches a tech's coverage_counties against this column on every
 * offer, and the TWIA flag decides which protocol applies. Both need an index
 * and neither can afford a geocode. Phase 1 sets it at intake from the address,
 * and twia_county is set from the same fourteen county list the public site
 * already guards in src/content/windstorm.ts.
 */
create table if not exists eng_files (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  file_number         text not null unique,
  client_id           uuid not null references eng_clients(id) on delete restrict,
  contact_id          uuid references eng_contacts(id) on delete set null,

  service_slug        text not null,
  deliverable         text,

  property_address    text not null,
  city                text,
  county              text not null,
  state               text not null default 'TX',
  postal_code         text,
  twia_county         boolean not null default false,
  latitude            numeric(9,6),
  longitude           numeric(9,6),

  urgency             text not null default 'standard'
                        check (urgency in ('standard', 'expedited', 'emergency')),
  status              text not null default 'intake' check (status in (
                        'intake', 'needs_dispatch', 'dispatched', 'evidence_in_progress',
                        'evidence_submitted', 'under_review', 'revisions_requested',
                        'sealed', 'delivered', 'closed', 'cancelled')),

  assigned_tech_id      uuid references eng_profiles(id) on delete set null,
  assigned_engineer_id  uuid references eng_profiles(id) on delete set null,
  protocol_template_id  uuid,

  evidence_due_at     timestamptz,
  due_at              timestamptz,
  dispatched_at       timestamptz,
  evidence_submitted_at timestamptz,
  sealed_at           timestamptz,
  delivered_at        timestamptz,
  closed_at           timestamptz,

  -- Margin is visible from Phase 1 even though invoicing is later.
  client_price_cents      bigint,
  tech_cost_cents         bigint,
  engineer_cost_cents     bigint,

  converted_from_lead_id  uuid references eng_leads(id) on delete set null,
  converted_from_order_id uuid references eng_orders(id) on delete set null,

  notes               text,
  created_by          uuid references eng_profiles(id) on delete set null
);
create index if not exists eng_files_status_idx on eng_files (status, due_at);
create index if not exists eng_files_client_idx on eng_files (client_id);
create index if not exists eng_files_county_idx on eng_files (county);
create index if not exists eng_files_tech_idx on eng_files (assigned_tech_id, status);
create index if not exists eng_files_engineer_idx on eng_files (assigned_engineer_id, status);
drop trigger if exists eng_files_touch on eng_files;
create trigger eng_files_touch before update on eng_files
  for each row execute function eng_touch_updated_at();

/*
 * The file's own timeline, which is a different thing from the audit trail.
 *
 * eng_audit_events is the regulatory record: everything, immutable, for the
 * board and for an investigation. This is the human narrative shown on the file
 * tab: status moved, evidence submitted, revision requested, delivered. Keeping
 * them separate means the timeline can be readable without the audit trail
 * being lossy, and the audit trail can be exhaustive without the timeline being
 * unusable.
 */
create table if not exists eng_file_events (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  file_id       uuid not null references eng_files(id) on delete cascade,
  actor_id      uuid references eng_profiles(id) on delete set null,
  kind          text not null,
  from_status   text,
  to_status     text,
  body          text,
  meta          jsonb
);
create index if not exists eng_file_events_file_idx on eng_file_events (file_id, created_at desc);
drop trigger if exists eng_file_events_immutable on eng_file_events;
create trigger eng_file_events_immutable before update or delete on eng_file_events
  for each row execute function eng_forbid_mutation();


-- --- PHASE 2: protocols, dispatch, evidence ---------------------------------

/*
 * The engineer authors a protocol per service line. This is the contractual
 * protocol authorship made operational: a tech never decides what evidence a
 * file needs, they work a checklist an engineer wrote and versioned.
 */
create table if not exists eng_protocol_templates (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  service_slug  text not null,
  name          text not null,
  version       integer not null default 1,
  status        text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  summary       text,
  authored_by   uuid references eng_profiles(id) on delete set null,
  published_at  timestamptz,
  unique (service_slug, version)
);
drop trigger if exists eng_protocol_templates_touch on eng_protocol_templates;
create trigger eng_protocol_templates_touch before update on eng_protocol_templates
  for each row execute function eng_touch_updated_at();

create table if not exists eng_protocol_items (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  template_id   uuid not null references eng_protocol_templates(id) on delete cascade,
  sort_order    integer not null default 0,
  item_key      text not null,
  kind          text not null check (kind in ('photo', 'measurement', 'reading', 'document', 'note')),
  label         text not null,
  instructions  text,
  required      boolean not null default true,
  unit          text,
  min_value     numeric,
  max_value     numeric,
  min_count     integer,
  unique (template_id, item_key)
);
create index if not exists eng_protocol_items_template_idx on eng_protocol_items (template_id, sort_order);

/*
 * A job offer to a technician. First acceptance wins; the rest are withdrawn.
 *
 * offer_amount_cents is written at offer time rather than read from the fee
 * schedule later, because the tech accepted a number and that number is what
 * they are owed even if the schedule changes next week.
 */
create table if not exists eng_assignments (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  file_id           uuid not null references eng_files(id) on delete cascade,
  tech_id           uuid not null references eng_profiles(id) on delete cascade,
  state             text not null default 'offered'
                      check (state in ('offered', 'accepted', 'declined', 'withdrawn', 'expired')),
  rank              integer,
  distance_miles    numeric(6,1),
  offer_amount_cents bigint,
  offered_at        timestamptz not null default now(),
  responded_at      timestamptz,
  expires_at        timestamptz,
  decline_reason    text,
  offered_by        uuid references eng_profiles(id) on delete set null,
  unique (file_id, tech_id)
);
create index if not exists eng_assignments_tech_idx on eng_assignments (tech_id, state);
create index if not exists eng_assignments_file_idx on eng_assignments (file_id, state);
drop trigger if exists eng_assignments_touch on eng_assignments;
create trigger eng_assignments_touch before update on eng_assignments
  for each row execute function eng_touch_updated_at();

/*
 * One captured item of evidence.
 *
 * client_capture_id exists for the offline queue: a phone in a rural county
 * captures with a locally generated id, retries on reconnect, and the unique
 * index makes the retry idempotent instead of producing the same photo twice.
 *
 * Geotag and timestamp are stored as columns rather than left in EXIF, because
 * EXIF is stripped on upload. Everything else in the exif is removed; these two
 * facts are kept deliberately and with the tech's consent, because an evidence
 * photo whose location and time cannot be established is weak evidence.
 */
create table if not exists eng_evidence_items (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  file_id           uuid not null references eng_files(id) on delete cascade,
  protocol_item_id  uuid references eng_protocol_items(id) on delete set null,
  item_key          text not null,
  kind              text not null check (kind in ('photo', 'measurement', 'reading', 'document', 'note')),

  value_text        text,
  value_number      numeric,
  unit              text,

  storage_key       text,
  thumb_key         text,
  content_type      text,
  byte_size         bigint,

  captured_at       timestamptz,
  captured_lat      numeric(9,6),
  captured_lng      numeric(9,6),
  captured_accuracy numeric(7,1),
  captured_by       uuid references eng_profiles(id) on delete set null,

  status            text not null default 'submitted'
                      check (status in ('submitted', 'accepted', 'revision_requested')),
  revision_note     text,
  reviewed_by       uuid references eng_profiles(id) on delete set null,
  reviewed_at       timestamptz,

  client_capture_id text
);
create index if not exists eng_evidence_file_idx on eng_evidence_items (file_id, item_key);
create unique index if not exists eng_evidence_capture_key
  on eng_evidence_items (file_id, client_capture_id) where client_capture_id is not null;
drop trigger if exists eng_evidence_touch on eng_evidence_items;
create trigger eng_evidence_touch before update on eng_evidence_items
  for each row execute function eng_touch_updated_at();

create table if not exists eng_tech_pay_ledger (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  tech_id       uuid not null references eng_profiles(id) on delete restrict,
  file_id       uuid references eng_files(id) on delete set null,
  amount_cents  bigint not null,
  kind          text not null default 'job' check (kind in ('job', 'adjustment', 'bonus', 'reimbursement')),
  period        text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'void')),
  approved_at   timestamptz,
  paid_at       timestamptz,
  note          text
);
create index if not exists eng_tech_pay_idx on eng_tech_pay_ledger (tech_id, period, status);
drop trigger if exists eng_tech_pay_touch on eng_tech_pay_ledger;
create trigger eng_tech_pay_touch before update on eng_tech_pay_ledger
  for each row execute function eng_touch_updated_at();


-- --- PHASE 3: credentials and certification ---------------------------------

/*
 * Credentials with expiry dates, which is the point of the table. An insurance
 * certificate that lapsed in March is not a document problem, it is a
 * dispatching problem, and expires_at is what the Phase 2 alerts read.
 */
create table if not exists eng_credentials (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  profile_id    uuid not null references eng_profiles(id) on delete cascade,
  kind          text not null check (kind in (
                  'drivers_license', 'gl_insurance', 'vehicle_insurance', 'drone_license',
                  'w9', 'ic_agreement', 'direct_deposit', 'pe_license', 'tdi_appointment', 'other')),
  label         text,
  storage_key   text,
  issued_on     date,
  expires_on    date,
  status        text not null default 'pending'
                  check (status in ('pending', 'verified', 'rejected', 'expired')),
  verified_at   timestamptz,
  verified_by   uuid references eng_profiles(id) on delete set null,
  reject_reason text
);
create index if not exists eng_credentials_profile_idx on eng_credentials (profile_id, kind);
create index if not exists eng_credentials_expiry_idx on eng_credentials (expires_on) where expires_on is not null;
drop trigger if exists eng_credentials_touch on eng_credentials;
create trigger eng_credentials_touch before update on eng_credentials
  for each row execute function eng_touch_updated_at();

/*
 * A tech is never offered a job in a service line they are not certified for.
 * This table is what dispatch reads to enforce that.
 */
create table if not exists eng_certifications (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  profile_id    uuid not null references eng_profiles(id) on delete cascade,
  service_slug  text not null,
  template_id   uuid references eng_protocol_templates(id) on delete set null,
  status        text not null default 'in_progress'
                  check (status in ('in_progress', 'certified', 'failed', 'revoked')),
  score         integer,
  attempts      integer not null default 0,
  certified_at  timestamptz,
  revoked_at    timestamptz,
  unique (profile_id, service_slug)
);
create index if not exists eng_certifications_profile_idx on eng_certifications (profile_id, status);


-- --- PHASE 4: documents, time, ledgers, responsible charge ------------------

create table if not exists eng_documents (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  file_id       uuid references eng_files(id) on delete cascade,
  client_id     uuid references eng_clients(id) on delete set null,
  kind          text not null check (kind in (
                  'deliverable', 'evidence_binder', 'responsible_charge_export',
                  'firm_document', 'protocol_export', 'other')),
  title         text not null,
  bucket        text not null,
  storage_key   text not null,
  content_type  text,
  byte_size     bigint,
  version       integer not null default 1,
  supersedes_id uuid references eng_documents(id) on delete set null,

  -- Sealing facts. Present only on a sealed deliverable.
  sealed_at     timestamptz,
  sealed_by     uuid references eng_profiles(id) on delete set null,
  seal_tier     text,

  expires_on    date,
  uploaded_by   uuid references eng_profiles(id) on delete set null,
  visibility    text not null default 'internal'
                  check (visibility in ('internal', 'client', 'admin_only'))
);
create index if not exists eng_documents_file_idx on eng_documents (file_id, kind);
create index if not exists eng_documents_expiry_idx on eng_documents (expires_on) where expires_on is not null;
drop trigger if exists eng_documents_touch on eng_documents;
create trigger eng_documents_touch before update on eng_documents
  for each row execute function eng_touch_updated_at();

/*
 * The engineer's time, which is two records at once: the FLSA record for a non
 * exempt employee, and the review time the responsible charge log has to state.
 * Designing it once means the second is never typed by hand.
 */
create table if not exists eng_time_log (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  profile_id    uuid not null references eng_profiles(id) on delete restrict,
  file_id       uuid references eng_files(id) on delete set null,
  kind          text not null default 'review'
                  check (kind in ('review', 'site_visit', 'admin', 'protocol_authoring')),
  started_at    timestamptz,
  ended_at      timestamptz,
  minutes       integer,
  note          text,
  entered_manually boolean not null default false
);
create index if not exists eng_time_log_profile_idx on eng_time_log (profile_id, started_at desc);
create index if not exists eng_time_log_file_idx on eng_time_log (file_id);
drop trigger if exists eng_time_log_touch on eng_time_log;
create trigger eng_time_log_touch before update on eng_time_log
  for each row execute function eng_touch_updated_at();

create table if not exists eng_production_ledger (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  engineer_id   uuid not null references eng_profiles(id) on delete restrict,
  file_id       uuid references eng_files(id) on delete set null,
  document_id   uuid references eng_documents(id) on delete set null,
  tier          text,
  amount_cents  bigint not null,
  period        text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'void')),
  approved_at   timestamptz,
  paid_at       timestamptz,
  note          text
);
create index if not exists eng_production_idx on eng_production_ledger (engineer_id, period, status);
drop trigger if exists eng_production_touch on eng_production_ledger;
create trigger eng_production_touch before update on eng_production_ledger
  for each row execute function eng_touch_updated_at();

/*
 * The responsible charge log: the artifact that proves to the board that a
 * licensed engineer was actually in responsible charge of the work sealed under
 * their name.
 *
 * Every column is written by the system from real events. Nothing here is typed
 * by a person, and that is the whole value of it: a log somebody fills in at the
 * end of the month is a recollection, and a recollection is what an enforcement
 * action takes apart.
 *
 * Append only for the same reason the audit trail is.
 */
create table if not exists eng_responsible_charge_log (
  id                bigserial primary key,
  created_at        timestamptz not null default now(),
  engineer_id       uuid not null references eng_profiles(id) on delete restrict,
  file_id           uuid references eng_files(id) on delete set null,
  document_id       uuid references eng_documents(id) on delete set null,
  document_type     text,
  property_address  text,
  county            text,
  reviewed_at       timestamptz not null,
  review_minutes    integer,
  revision_count    integer not null default 0,
  site_visit        boolean not null default false,
  refused           boolean not null default false,
  refusal_reason    text,
  period            text
);
create index if not exists eng_rcl_engineer_idx on eng_responsible_charge_log (engineer_id, reviewed_at desc);
drop trigger if exists eng_rcl_immutable on eng_responsible_charge_log;
create trigger eng_rcl_immutable before update or delete on eng_responsible_charge_log
  for each row execute function eng_forbid_mutation();


-- --- PHASE 5: tasks, threads, messages, notifications -----------------------

create table if not exists eng_tasks (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  title           text not null,
  description     text,
  assignee_id     uuid references eng_profiles(id) on delete set null,
  created_by      uuid references eng_profiles(id) on delete set null,
  due_at          timestamptz,
  priority        text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status          text not null default 'open' check (status in ('open', 'in_progress', 'blocked', 'done', 'cancelled')),
  file_id         uuid references eng_files(id) on delete cascade,
  client_id       uuid references eng_clients(id) on delete cascade,
  -- Compliance recurrence: licence renewal, insurance expiry, DWC filing.
  recurrence      text,
  recurs_from_id  uuid references eng_tasks(id) on delete set null,
  completed_at    timestamptz
);
create index if not exists eng_tasks_assignee_idx on eng_tasks (assignee_id, status, due_at);
create index if not exists eng_tasks_file_idx on eng_tasks (file_id);
drop trigger if exists eng_tasks_touch on eng_tasks;
create trigger eng_tasks_touch before update on eng_tasks
  for each row execute function eng_touch_updated_at();

create table if not exists eng_threads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  kind          text not null check (kind in ('file', 'direct', 'channel')),
  file_id       uuid references eng_files(id) on delete cascade,
  name          text,
  created_by    uuid references eng_profiles(id) on delete set null,
  -- Exactly one thread per file, enforced below rather than by convention.
  constraint eng_threads_file_kind check ((kind = 'file') = (file_id is not null))
);
create unique index if not exists eng_threads_file_key on eng_threads (file_id) where file_id is not null;
drop trigger if exists eng_threads_touch on eng_threads;
create trigger eng_threads_touch before update on eng_threads
  for each row execute function eng_touch_updated_at();

create table if not exists eng_thread_participants (
  thread_id     uuid not null references eng_threads(id) on delete cascade,
  profile_id    uuid not null references eng_profiles(id) on delete cascade,
  added_at      timestamptz not null default now(),
  last_read_at  timestamptz,
  primary key (thread_id, profile_id)
);
create index if not exists eng_thread_participants_profile_idx on eng_thread_participants (profile_id);

create table if not exists eng_messages (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  thread_id     uuid not null references eng_threads(id) on delete cascade,
  author_id     uuid references eng_profiles(id) on delete set null,
  body          text not null,
  attachments   jsonb not null default '[]'::jsonb,
  mentions      uuid[] not null default '{}',
  edited_at     timestamptz
);
create index if not exists eng_messages_thread_idx on eng_messages (thread_id, created_at desc);

create table if not exists eng_notifications (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  profile_id    uuid not null references eng_profiles(id) on delete cascade,
  kind          text not null,
  title         text not null,
  body          text,
  entity_type   text,
  entity_id     text,
  href          text,
  read_at       timestamptz,
  emailed_at    timestamptz,
  -- Present so SMS can be turned on later without a migration.
  smsed_at      timestamptz
);
create index if not exists eng_notifications_profile_idx on eng_notifications (profile_id, read_at, created_at desc);

create table if not exists eng_notification_prefs (
  profile_id    uuid not null references eng_profiles(id) on delete cascade,
  kind          text not null,
  in_app        boolean not null default true,
  email         boolean not null default true,
  sms           boolean not null default false,
  primary key (profile_id, kind)
);


-- --- PHASE 6: fee schedule --------------------------------------------------

/*
 * One table for three price lists, separated by `kind`: what a client pays,
 * what a tech is paid, and what an engineer earns in production. They share
 * every other column, they are all effective dated, and margin per file is the
 * difference between rows in the same table.
 */
create table if not exists eng_fee_schedule (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  kind            text not null check (kind in ('client_price', 'tech_pay', 'engineer_production')),
  service_slug    text,
  tier            text,
  county_band     text,
  urgency         text,
  amount_cents    bigint not null,
  effective_from  date not null default current_date,
  effective_to    date,
  note            text
);
create index if not exists eng_fee_lookup_idx on eng_fee_schedule (kind, service_slug, effective_from desc);
drop trigger if exists eng_fee_touch on eng_fee_schedule;
create trigger eng_fee_touch before update on eng_fee_schedule
  for each row execute function eng_touch_updated_at();


-- --- the closed door, applied to every table above --------------------------
--
-- RLS on, zero policies. Nothing reaches these tables except the service role,
-- held server side, behind the authorization layer.

alter table eng_profiles                enable row level security;
alter table eng_auth_tokens             enable row level security;
alter table eng_audit_events            enable row level security;
alter table eng_clients                 enable row level security;
alter table eng_contacts                enable row level security;
alter table eng_files                   enable row level security;
alter table eng_file_events             enable row level security;
alter table eng_protocol_templates      enable row level security;
alter table eng_protocol_items          enable row level security;
alter table eng_assignments             enable row level security;
alter table eng_evidence_items          enable row level security;
alter table eng_tech_pay_ledger         enable row level security;
alter table eng_credentials             enable row level security;
alter table eng_certifications          enable row level security;
alter table eng_documents               enable row level security;
alter table eng_time_log                enable row level security;
alter table eng_production_ledger       enable row level security;
alter table eng_responsible_charge_log  enable row level security;
alter table eng_tasks                   enable row level security;
alter table eng_threads                 enable row level security;
alter table eng_thread_participants     enable row level security;
alter table eng_messages                enable row level security;
alter table eng_notifications           enable row level security;
alter table eng_notification_prefs      enable row level security;
alter table eng_fee_schedule            enable row level security;

comment on table eng_profiles is 'One row per person who can sign into the ops platform, keyed to auth.users. Service role only: RLS on, zero policies.';
comment on table eng_audit_events is 'Immutable regulatory memory. Append only, enforced by trigger rather than by RLS, because the service role bypasses RLS.';
comment on table eng_files is 'The central object of the firm: one per deliverable request. Status transitions are enforced in application code and every transition writes eng_file_events.';
comment on table eng_responsible_charge_log is 'Generated from real events, never typed. The artifact that proves responsible charge to the board.';
