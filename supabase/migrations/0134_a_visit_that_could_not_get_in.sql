/*
 * ===========================================================================
 * 0134. A VISIT THAT COULD NOT GET IN, AND ITS TRIP FEE.
 * ===========================================================================
 *
 * Robert's answer 7 of 2026-11-14 (E5, option (a)): "a no-access trip fee of
 * $125, disclosed before payment", charged on its own before the visit is
 * booked again; and his answers 8 to 10 the same afternoon: the technician is
 * paid half his normal rate for that job, no partner commission is earned on a
 * trip fee, and the fee is not refunded if the job is later declined.
 *
 * Three things, and nothing else:
 *
 *   1. eng_no_access_visits: one row each time the assigned technician records
 *      that he could not get in. Append only, like every record of something
 *      that happened at a property. The note is his words.
 *
 *   2. eng_service_orders.kind: 'job', which every order so far is, or
 *      'trip_fee', which names the visit it is for. A trip fee is a second,
 *      separate order on the same file, through the same payment link and
 *      checkout as any job. The code that picks "the order a file is worked
 *      under" (order-for-file.ts) reads job orders only, which is what keeps a
 *      trip fee out of a partner's commission, the job's refund and the
 *      technician's job pay. One live trip fee per visit.
 *
 *   3. eng_tech_pay_ledger gains the kind 'no_access' and the visit it pays,
 *      once per visit.
 *
 * NO NEW FILE STATUS. A no-access visit moves the file back to needs_dispatch,
 * through transitionFile, and dispatch refuses an offer while the latest such
 * visit has no paid trip fee: the same shape as the engineer's pre-review hold
 * (dispatch-hold.ts), read from rows rather than from a status word.
 */

do $$
begin
  if to_regclass('public.eng_letter_links') is null then
    raise exception 'eng: 0134 follows 0133, which adds eng_letter_links. It does not exist here.';
  end if;
end;
$$;

/* ------------------------------------------------- 1. the visit, as a row */

create table if not exists eng_no_access_visits (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  file_id     uuid not null references eng_files (id) on delete restrict,
  tech_id     uuid not null references eng_profiles (id) on delete restrict,
  note        text not null check (length(btrim(note)) >= 3)
);

comment on table eng_no_access_visits is
  'Each time the assigned technician recorded that he could not get in at the agreed time (0134, Robert''s answers 7 to 10 of 2026-11-14). Append only. The file goes back to needs dispatch and is not offered again until the trip fee for its latest visit is paid.';

create index if not exists eng_no_access_visits_file_idx on eng_no_access_visits (file_id, created_at desc);

create trigger eng_no_access_visits_immutable
  before update or delete on eng_no_access_visits
  for each row execute function eng_forbid_mutation();

alter table eng_no_access_visits enable row level security;

revoke all on eng_no_access_visits from public, anon, authenticated;

/* --------------------------------------------- 2. what an order is for */

alter table eng_service_orders add column if not exists kind text not null default 'job';
alter table eng_service_orders add column if not exists trip_for_visit uuid references eng_no_access_visits (id) on delete restrict;

alter table eng_service_orders drop constraint if exists eng_service_orders_kind_check;
alter table eng_service_orders add constraint eng_service_orders_kind_check check (kind in ('job', 'trip_fee'));

/* A trip fee names its visit, and only a trip fee does. */
alter table eng_service_orders drop constraint if exists eng_service_orders_trip_names_its_visit;
alter table eng_service_orders add constraint eng_service_orders_trip_names_its_visit
  check ((kind = 'trip_fee') = (trip_for_visit is not null));

comment on column eng_service_orders.kind is
  'job, or trip_fee: a second, separate order for a visit that could not get in (0134). The order a file is worked under is always a job order.';

/* One trip fee per visit, unless an earlier one was cancelled. */
create unique index if not exists eng_service_orders_one_trip_fee_per_visit
  on eng_service_orders (trip_for_visit)
  where trip_for_visit is not null and status <> 'cancelled';

/* ------------------------------------------------ 3. what he is paid for it */

alter table eng_tech_pay_ledger drop constraint if exists eng_tech_pay_ledger_kind_check;
alter table eng_tech_pay_ledger add constraint eng_tech_pay_ledger_kind_check
  check (kind in ('job', 'adjustment', 'bonus', 'reimbursement', 'no_access'));

alter table eng_tech_pay_ledger add column if not exists no_access_visit_id uuid references eng_no_access_visits (id) on delete restrict;

alter table eng_tech_pay_ledger drop constraint if exists eng_tech_pay_ledger_no_access_names_its_visit;
alter table eng_tech_pay_ledger add constraint eng_tech_pay_ledger_no_access_names_its_visit
  check ((kind = 'no_access') = (no_access_visit_id is not null));

/* Once per visit, so a second press is a no-op rather than a second payment. */
create unique index if not exists eng_tech_pay_ledger_once_per_no_access_visit
  on eng_tech_pay_ledger (no_access_visit_id)
  where no_access_visit_id is not null;
