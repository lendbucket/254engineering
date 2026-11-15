/*
 * ===========================================================================
 * 0136. AN INQUIRY HAS A CALL LOG.
 * ===========================================================================
 *
 * Office ready (Robert's ruling of 2026-10-20): a call log entry is one click
 * from any record. The office-ready pass of 2026-11-14 (issue #1, 6870906132
 * and 6871302517) found that an inquiry had none, because eng_contact_log
 * (0079) names exactly four subjects: a prospect, a client, an order and a
 * file. It went to Batch B as a migration.
 *
 * "An inquiry" is three records on this platform, and a caller can ring about
 * any of them, so all three become subjects (autopilot question 21 of
 * 2026-11-14, built on its recommendation while Robert is away):
 *   lead              eng_leads, the inbox's inquiries;
 *   design_inquiry    eng_design_inquiries, /portal/inquiries;
 *   windstorm_inquiry eng_windstorm_inquiries, /portal/windstorm-inquiries.
 *
 * Additive in effect: three nullable columns, three indexes, and the two
 * checks that name the subjects replaced by wider ones that still require
 * exactly one subject, the one subject_type names. Every row already written
 * satisfies the new checks, because each new column is null on it. The table
 * stays append only (eng_contact_log_immutable is untouched).
 */

do $$
begin
  if to_regclass('public.eng_contact_log') is null then
    raise exception 'eng: 0136 widens eng_contact_log (0079). It does not exist here.';
  end if;
  if to_regclass('public.eng_design_inquiries') is null or to_regclass('public.eng_windstorm_inquiries') is null or to_regclass('public.eng_leads') is null then
    raise exception 'eng: 0136 references eng_leads, eng_design_inquiries and eng_windstorm_inquiries. One of them does not exist here.';
  end if;
end;
$$;

alter table eng_contact_log add column if not exists lead_id uuid references eng_leads (id) on delete restrict;
alter table eng_contact_log add column if not exists design_inquiry_id uuid references eng_design_inquiries (id) on delete restrict;
alter table eng_contact_log add column if not exists windstorm_inquiry_id uuid references eng_windstorm_inquiries (id) on delete restrict;

alter table eng_contact_log drop constraint if exists eng_contact_log_subject_known;
alter table eng_contact_log add constraint eng_contact_log_subject_known
  check (subject_type in ('prospect', 'client', 'order', 'file', 'lead', 'design_inquiry', 'windstorm_inquiry'));

/* Exactly one subject, and it is the one subject_type names. Written as a count so a seventh subject is one line. */
alter table eng_contact_log drop constraint if exists eng_contact_log_one_subject;
alter table eng_contact_log add constraint eng_contact_log_one_subject check (
  (
    (prospect_id is not null)::int + (client_id is not null)::int + (order_id is not null)::int + (file_id is not null)::int
    + (lead_id is not null)::int + (design_inquiry_id is not null)::int + (windstorm_inquiry_id is not null)::int
  ) = 1
  and (
    (subject_type = 'prospect' and prospect_id is not null)
    or (subject_type = 'client' and client_id is not null)
    or (subject_type = 'order' and order_id is not null)
    or (subject_type = 'file' and file_id is not null)
    or (subject_type = 'lead' and lead_id is not null)
    or (subject_type = 'design_inquiry' and design_inquiry_id is not null)
    or (subject_type = 'windstorm_inquiry' and windstorm_inquiry_id is not null)
  )
);

create index if not exists eng_contact_log_lead_idx on eng_contact_log (lead_id, created_at desc) where lead_id is not null;
create index if not exists eng_contact_log_design_inquiry_idx on eng_contact_log (design_inquiry_id, created_at desc) where design_inquiry_id is not null;
create index if not exists eng_contact_log_windstorm_inquiry_idx on eng_contact_log (windstorm_inquiry_id, created_at desc) where windstorm_inquiry_id is not null;

comment on table eng_contact_log is
  'Append only. Every call, email and note a member of staff records against a prospect, client, order, file, inbox inquiry, design inquiry or windstorm inquiry. A record of a call that can be edited later is not a record of the call. 0079, widened by 0136.';
