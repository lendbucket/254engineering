/*
 * 0130: CUSTOMER SERVICE TAKES THE CALL.
 *
 * Robert's answer 2 of 2026-11-14, to question 2 of the Part 1 report: "Customer
 * Service gets files.create, inbox and send-link." The report found the role
 * named "Customer Service" could not take a job at all: no New job, no inbox,
 * no payment link, so the front desk had to hand every caller to somebody else.
 *
 * No table and no column. Four grant rows on an existing role:
 *
 *   files.create        opens New job, and a new caller's client through it,
 *                       exactly as the rep's and Sales' grant does.
 *   inbox.read          the one inbox (0079).
 *   inbox.answer        "inbox" read as the rep holds it, both halves: a desk
 *                       that can read an enquiry and not mark it answered is
 *                       the dead end the report was about.
 *   payments.send_link  how every role but the administrator ends New job
 *                       (owner ruling 2026-10-20).
 *
 * WHAT IT STILL DOES NOT HOLD, each the absence of a row: no payments.charge or
 * pricing.override_at_intake, so New job ends in a link at the catalog price;
 * no refund, price or card grant (ruling 2026-10-03, asserted in roles-audit);
 * no offers.dispatch.
 *
 * DEFAULT_ROLES (src/lib/ops-authz.ts) and roles-audit's typed table carry the
 * same four, so changing it again costs all three edits.
 */

/* ------------------------------------------------------------- 0. the ground */
do $$
begin
  if not exists (select 1 from public.eng_roles where key = 'customer_service') then
    raise exception 'eng: 0130 grants to customer_service, which does not exist here.';
  end if;
  if to_regclass('public.eng_franchisee_members') is null then
    raise exception 'eng: 0130 follows 0129. 0126''s eng_franchisee_members does not exist here.';
  end if;
end;
$$;

/* ------------------------------------------------------------- 1. the grants */
insert into eng_role_grants (role_key, action) values
  ('customer_service', 'files.create'),
  ('customer_service', 'inbox.read'),
  ('customer_service', 'inbox.answer'),
  ('customer_service', 'payments.send_link')
on conflict (role_key, action) do nothing;
