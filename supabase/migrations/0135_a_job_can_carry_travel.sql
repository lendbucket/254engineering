/*
 * ===========================================================================
 * 0135. A JOB CAN CARRY TRAVEL.
 * ===========================================================================
 *
 * Robert's rulings of 2026-11-14 on issue #1: travel is typed per job by the
 * administrator, with a reason, before the payment link is sent (his confirmed
 * yes of 6878996686), and his answers 12 to 15:
 *   12. refunded in full if the job is declined before the visit, kept if the
 *       technician made the trip, stated in that order's refund terms;
 *   13. no partner commission on travel;
 *   14. it goes to the technician who makes the trip, in full, as its own line
 *       on his pay;
 *   15. the customer reads "Travel to Bell County", the county filled in; the
 *       reason is on the file for staff only.
 *
 * Three things:
 *   1. the file carries the amount, the reason, who set it and when, all four
 *      or none, so a travel figure can never exist without its author;
 *   2. the order carries the amount, so its total, its checkout line, its
 *      refund and the partner's basis are all read from the order as charged;
 *   3. the pay ledger gains the kind 'travel', once per job.
 */

do $$
begin
  if to_regclass('public.eng_no_access_visits') is null then
    raise exception 'eng: 0135 follows 0134, which adds eng_no_access_visits. It does not exist here.';
  end if;
end;
$$;

/* ------------------------------------------------------------- 1. the file */

alter table eng_files add column if not exists travel_cents bigint;
alter table eng_files add column if not exists travel_reason text;
alter table eng_files add column if not exists travel_set_by uuid references eng_profiles (id) on delete restrict;
alter table eng_files add column if not exists travel_set_at timestamptz;

alter table eng_files drop constraint if exists eng_files_travel_is_whole;
alter table eng_files add constraint eng_files_travel_is_whole check (
  (travel_cents is null and travel_reason is null and travel_set_by is null and travel_set_at is null)
  or (travel_cents > 0 and length(btrim(travel_reason)) >= 3 and travel_set_by is not null and travel_set_at is not null)
);

comment on column eng_files.travel_cents is
  'Travel typed by the administrator for this job, before the payment link (0135). The reason is for staff only; the customer reads "Travel to <county> County".';

/* ------------------------------------------------------------ 2. the order */

alter table eng_service_orders add column if not exists travel_cents bigint;
alter table eng_service_orders drop constraint if exists eng_service_orders_travel_is_positive;
alter table eng_service_orders add constraint eng_service_orders_travel_is_positive check (travel_cents is null or travel_cents > 0);

comment on column eng_service_orders.travel_cents is
  'The travel inside total_cents (0135). Refunded in full on a decline before the visit, kept once the technician made the trip, never in a partner''s basis.';

/* ------------------------------------------------------ 3. the pay ledger */

alter table eng_tech_pay_ledger drop constraint if exists eng_tech_pay_ledger_kind_check;
alter table eng_tech_pay_ledger add constraint eng_tech_pay_ledger_kind_check
  check (kind in ('job', 'adjustment', 'bonus', 'reimbursement', 'no_access', 'travel'));

/* Once per job: the customer paid the travel once. */
create unique index if not exists eng_tech_pay_ledger_travel_once_per_job
  on eng_tech_pay_ledger (file_id)
  where kind = 'travel' and file_id is not null;
