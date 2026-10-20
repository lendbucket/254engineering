/*
 * ===========================================================================
 * 0079  TWO STAFF ROLES, AND THE RECORDS THEIR WORK NEEDS.
 * ===========================================================================
 *
 * Operator ruling, 2026-10-20: build two staff levels as data, the way 0018
 * made roles data.
 *
 *   rep          Customer Service and Sales Rep (level 1)
 *   ops_manager  Operations Manager (level 2): everything a rep does, plus
 *                refund approval up to a limit the operator sets, technician
 *                onboarding and credential review, and reports.
 *
 * Neither may ever seal, sign or approve a protocol, upload a seal, change a
 * price, open a no-charge job, use the owner override, see or change engineer
 * or technician pay, create staff accounts or change roles, or see Stripe keys
 * or settings. Each of those is refused at the server, and roles-audit proves
 * it by signing in as each role.
 *
 * DRAFTED ON A BRANCH AND APPLIED TO DEVELOPMENT ONLY. Production gets it in
 * the operator's sitting, never from this session. Its ledger entry is pending
 * and this file holds the merge: a migration on main is never pending.
 *
 * WHY NEW, NARROW ACTIONS RATHER THAN THE EXISTING ONES
 * -----------------------------------------------------
 * Four existing actions are wider than their names, and handing them to either
 * role would grant something the ruling forbids:
 *
 *   payments.charge     also runs the proving charge, a real card charge.
 *                       The rep gets payments.send_link instead.
 *   payments.reconcile  is what opens the orders screen and order search.
 *                       Both levels get orders.read, which reads and changes
 *                       nothing about money.
 *   profiles.create     invites a person at ANY role, administrator included.
 *                       The manager gets technicians.onboard, which invites a
 *                       field technician and nothing else.
 *   files.create        lets the holder type a price different from the
 *                       catalog's. That half moves to pricing.override_at_intake,
 *                       which admin and sales keep so neither loses anything.
 *
 * And the dispatch panel shows a technician's flat rate to whoever dispatches.
 * That moves to pricing.read_tech_rate, kept by admin and dispatcher, and held
 * by neither new role, because technician pay is on the forbidden list.
 *
 * THE FOUR TABLES
 * ---------------
 *   eng_prospects               the sales list: a company not yet a customer.
 *                               Mutable, because a follow-up date moves.
 *   eng_contact_log             every call, email and note against a prospect,
 *                               a client, an order or a file. Append only: a
 *                               record of a call that can be edited later is
 *                               not a record of the call.
 *   eng_refund_requests         a rep asking for money to go back. Append only.
 *   eng_refund_decisions        somebody deciding that request. Append only,
 *                               one per request, and it names the limit that
 *                               applied at the moment of deciding.
 *   eng_refund_approval_limits  the operator's limit, as dated rows. The newest
 *                               row is the limit; no row at all means zero.
 *                               Append only, so a changed limit leaves the old
 *                               one and who set it.
 */

-- --------------------------------------------------------------- the roles

insert into eng_roles (key, name, landing_path, is_system) values
  ('rep', 'Customer Service and Sales Rep', '/portal', false),
  ('ops_manager', 'Operations Manager', '/portal', false)
on conflict (key) do nothing;

-- -------------------------------------------------------------- the grants

insert into eng_role_grants (role_key, action) values
  ('rep', 'clients.create'),
  ('rep', 'clients.list'),
  ('rep', 'clients.update'),
  ('rep', 'contact_log.write'),
  ('rep', 'crm.use'),
  ('rep', 'files.create'),
  ('rep', 'files.list'),
  ('rep', 'files.update_details'),
  ('rep', 'inbox.answer'),
  ('rep', 'inbox.read'),
  ('rep', 'messages.use'),
  ('rep', 'offers.dispatch'),
  ('rep', 'orders.read'),
  ('rep', 'orders.resend_link'),
  ('rep', 'payments.send_link'),
  ('rep', 'profiles.read_self'),
  ('rep', 'profiles.update_self'),
  ('rep', 'refunds.request'),
  ('rep', 'tasks.use'),
  ('rep', 'time.log_own'),
  ('ops_manager', 'clients.create'),
  ('ops_manager', 'clients.list'),
  ('ops_manager', 'clients.update'),
  ('ops_manager', 'contact_log.write'),
  ('ops_manager', 'crm.use'),
  ('ops_manager', 'files.create'),
  ('ops_manager', 'files.list'),
  ('ops_manager', 'files.update_details'),
  ('ops_manager', 'inbox.answer'),
  ('ops_manager', 'inbox.read'),
  ('ops_manager', 'messages.use'),
  ('ops_manager', 'offers.dispatch'),
  ('ops_manager', 'orders.read'),
  ('ops_manager', 'orders.resend_link'),
  ('ops_manager', 'payments.send_link'),
  ('ops_manager', 'profiles.read_self'),
  ('ops_manager', 'profiles.update_self'),
  ('ops_manager', 'refunds.approve_within_limit'),
  ('ops_manager', 'refunds.request'),
  ('ops_manager', 'reports.activity'),
  ('ops_manager', 'reports.pipeline'),
  ('ops_manager', 'reports.revenue'),
  ('ops_manager', 'reports.turnaround'),
  ('ops_manager', 'tasks.use'),
  ('ops_manager', 'technicians.onboard'),
  ('ops_manager', 'time.log_own'),
  ('admin', 'contact_log.write'),
  ('admin', 'crm.use'),
  ('admin', 'files.update_details'),
  ('admin', 'inbox.answer'),
  ('admin', 'inbox.read'),
  ('admin', 'orders.read'),
  ('admin', 'orders.resend_link'),
  ('admin', 'payments.send_link'),
  ('admin', 'pricing.override_at_intake'),
  ('admin', 'pricing.read_tech_rate'),
  ('admin', 'refunds.approve_within_limit'),
  ('admin', 'refunds.request'),
  ('admin', 'reports.activity'),
  ('admin', 'reports.turnaround'),
  ('admin', 'settings.refund_limit'),
  ('admin', 'technicians.onboard'),
  ('sales', 'pricing.override_at_intake'),
  ('dispatcher', 'pricing.read_tech_rate')
on conflict (role_key, action) do nothing;

-- ----------------------------------------------------------- the prospects

create table if not exists eng_prospects (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  company               text not null check (length(btrim(company)) > 0),
  contact_name          text,
  phone                 text,
  email                 text,
  city                  text,
  prospect_type         text not null
                          constraint eng_prospects_type_known
                          check (prospect_type in ('roofer', 'agent', 'title', 'contractor')),

  status                text not null default 'open'
                          constraint eng_prospects_status_known
                          check (status in ('open', 'converted', 'not_interested')),
  follow_up_on          date,

  /* Who is working it. Null is "nobody yet", which the call list shows. */
  owner_id              uuid references eng_profiles (id) on delete restrict,
  created_by            uuid not null references eng_profiles (id) on delete restrict,
  /* The spreadsheet a row arrived in, so one import can be found again. */
  import_batch_id       uuid,

  converted_at          timestamptz,
  converted_by          uuid references eng_profiles (id) on delete restrict,
  converted_client_id   uuid references eng_clients (id) on delete restrict,
  converted_account_id  uuid references eng_customer_accounts (id) on delete restrict,

  /* A conversion is named and points at what it made, or it did not happen. */
  constraint eng_prospects_conversion_is_whole check (
    (status = 'converted') = (
      converted_at is not null and converted_by is not null
      and converted_client_id is not null and converted_account_id is not null
    )
  ),
  constraint eng_prospects_reachable check (phone is not null or email is not null)
);

create trigger eng_prospects_touch before update on eng_prospects
  for each row execute function eng_touch_updated_at();

create index if not exists eng_prospects_follow_up_idx
  on eng_prospects (follow_up_on) where status = 'open';
create index if not exists eng_prospects_company_idx on eng_prospects (lower(company));

alter table eng_prospects enable row level security;

comment on table eng_prospects is
  'The sales list: a company the firm is calling that is not yet a customer. Converting one makes a client and a commercial account with card billing and no credit, and the row keeps pointing at both. 0079.';

-- --------------------------------------------------------- the contact log

create table if not exists eng_contact_log (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  by_id         uuid not null references eng_profiles (id) on delete restrict,

  subject_type  text not null
                  constraint eng_contact_log_subject_known
                  check (subject_type in ('prospect', 'client', 'order', 'file')),
  prospect_id   uuid references eng_prospects (id) on delete restrict,
  client_id     uuid references eng_clients (id) on delete restrict,
  order_id      uuid references eng_service_orders (id) on delete restrict,
  file_id       uuid references eng_files (id) on delete restrict,

  channel       text not null
                  constraint eng_contact_log_channel_known
                  check (channel in ('call', 'email', 'note')),
  direction     text
                  constraint eng_contact_log_direction_known
                  check (direction is null or direction in ('outbound', 'inbound')),
  outcome       text
                  constraint eng_contact_log_outcome_known
                  check (outcome is null or outcome in (
                    'reached', 'voicemail', 'no_answer', 'wrong_number',
                    'sent', 'replied', 'interested', 'not_interested', 'visit_time_set'
                  )),
  body          text,
  /* The visit time agreed on a call, when that is what the call was for. */
  visit_at      timestamptz,
  /* The follow-up date set at the moment of this entry, if one was. */
  follow_up_on  date,

  /* Exactly one subject, and it is the one subject_type names. */
  constraint eng_contact_log_one_subject check (
    (subject_type = 'prospect' and prospect_id is not null and client_id is null and order_id is null and file_id is null)
    or (subject_type = 'client' and client_id is not null and prospect_id is null and order_id is null and file_id is null)
    or (subject_type = 'order' and order_id is not null and prospect_id is null and client_id is null and file_id is null)
    or (subject_type = 'file' and file_id is not null and prospect_id is null and client_id is null and order_id is null)
  ),
  /* A note is not a call; a call has a direction. */
  constraint eng_contact_log_note_has_no_direction check (
    (channel = 'note' and direction is null and outcome is null)
    or (channel <> 'note' and direction is not null)
  ),
  /* A visit time is agreed on a call about a file, and says so. */
  constraint eng_contact_log_visit_time_is_a_call check (
    (visit_at is null and outcome is distinct from 'visit_time_set')
    or (visit_at is not null and outcome = 'visit_time_set' and channel = 'call' and subject_type = 'file')
  ),
  constraint eng_contact_log_says_something check (
    channel <> 'note' or length(btrim(coalesce(body, ''))) > 0
  )
);

create index if not exists eng_contact_log_prospect_idx on eng_contact_log (prospect_id, created_at desc) where prospect_id is not null;
create index if not exists eng_contact_log_client_idx on eng_contact_log (client_id, created_at desc) where client_id is not null;
create index if not exists eng_contact_log_order_idx on eng_contact_log (order_id, created_at desc) where order_id is not null;
create index if not exists eng_contact_log_file_idx on eng_contact_log (file_id, created_at desc) where file_id is not null;
create index if not exists eng_contact_log_by_idx on eng_contact_log (by_id, created_at desc);

create trigger eng_contact_log_immutable
  before update or delete on eng_contact_log
  for each row execute function eng_forbid_mutation();

alter table eng_contact_log enable row level security;

comment on table eng_contact_log is
  'Append only. Every call, email and note a member of staff records against a prospect, client, order or file. A record of a call that can be edited later is not a record of the call. 0079.';

-- ------------------------------------------------------------ the refunds

create table if not exists eng_refund_requests (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  order_id        uuid not null references eng_service_orders (id) on delete restrict,
  requested_by    uuid not null references eng_profiles (id) on delete restrict,
  reason          text not null check (length(btrim(reason)) >= 10),
  /* What was owed back when the request was made. The decision recomputes it. */
  owed_cents      bigint not null check (owed_cents >= 0)
);

create index if not exists eng_refund_requests_order_idx on eng_refund_requests (order_id, created_at desc);

create trigger eng_refund_requests_immutable
  before update or delete on eng_refund_requests
  for each row execute function eng_forbid_mutation();

alter table eng_refund_requests enable row level security;

create table if not exists eng_refund_decisions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  request_id      uuid not null unique references eng_refund_requests (id) on delete restrict,
  decided_by      uuid not null references eng_profiles (id) on delete restrict,
  decision        text not null
                    constraint eng_refund_decisions_known
                    check (decision in ('approved', 'declined')),
  /* What was owed at the moment of deciding, and the limit that applied. */
  owed_cents      bigint not null check (owed_cents >= 0),
  /* Null when the decider held payments.refund, which has no limit. */
  limit_cents     bigint check (limit_cents is null or limit_cents >= 0),
  note            text,
  refunded_cents  bigint check (refunded_cents is null or refunded_cents >= 0),
  provider_ref    text,
  /* A limit is never exceeded by an approval made under one. */
  constraint eng_refund_decisions_within_limit check (
    decision <> 'approved' or limit_cents is null or owed_cents <= limit_cents
  ),
  constraint eng_refund_decisions_decline_moves_nothing check (
    decision <> 'declined' or (refunded_cents is null and provider_ref is null)
  )
);

create trigger eng_refund_decisions_immutable
  before update or delete on eng_refund_decisions
  for each row execute function eng_forbid_mutation();

alter table eng_refund_decisions enable row level security;

comment on table eng_refund_requests is
  'Append only. A member of staff asking for an order''s money to go back. Deciding it is a row in eng_refund_decisions, never an edit here. 0079.';
comment on table eng_refund_decisions is
  'Append only, one per request. Names who decided, what was owed then, and the approval limit that applied, and the database refuses an approval above that limit. 0079.';

create table if not exists eng_refund_approval_limits (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  limit_cents bigint not null check (limit_cents >= 0),
  set_by      uuid not null references eng_profiles (id) on delete restrict,
  reason      text
);

create index if not exists eng_refund_approval_limits_newest_idx
  on eng_refund_approval_limits (created_at desc);

create trigger eng_refund_approval_limits_immutable
  before update or delete on eng_refund_approval_limits
  for each row execute function eng_forbid_mutation();

alter table eng_refund_approval_limits enable row level security;

comment on table eng_refund_approval_limits is
  'Append only. The operator''s refund approval limit for anybody approving without payments.refund. The newest row is the limit and no row is zero, so the limit starts at $0 until the operator sets it. 0079.';
