/*
 * ===========================================================================
 * 0099  A PLAN FILE FITS, AND THE OFFICE'S ALERTS GO TO A LIST THE OWNER EDITS.
 * ===========================================================================
 *
 * Robert's addendum of 2026-10-25, items 4 and 8b.
 *
 *   4. "Raise the order upload limit to 40 MB for plan files (PDF only for
 *      now)."
 *   8b. "Alert recipients become a list the owner edits in the portal
 *      (default: Robert's email)."
 *
 * WHAT IT DOES
 *
 *   1. eng-uploads takes a file up to 40 MB (41943040 bytes). The bucket is
 *      the last check, so the application's own limit cannot be raised past
 *      it. The application keeps its narrower rules: a PDF on an order may be
 *      40 MB, a photograph on an order stays at 10 MB, and a career upload
 *      stays at 10 MB (src/lib/order-uploads.ts, src/lib/uploads.ts). The mime
 *      list is not touched.
 *
 *   2. eng_alert_recipients, the addresses the office's alerts go to. A row is
 *      added by the owner and is never deleted: removing an address stamps
 *      removed_at and removed_by on it, once, so who received the firm's alerts
 *      and when stays readable. One live row per address.
 *
 *      AN EMPTY LIST MEANS THE DEFAULT, which is business.notificationEmail in
 *      src/config/business.ts. The address is not seeded here, because a
 *      second home for it in a migration would be a copy that drifts.
 *
 *   3. The grant alerts.manage, for the administrator alone: the owner edits
 *      the list (declared in DEFAULT_ROLES, pinned in roles-audit).
 *
 * WHAT IT REFUSES
 *
 *   Deleting a recipient row. Changing an address, or who added it. Removing a
 *   row twice, or un-removing one. A second live row for the same address.
 *   An address with no "@" or with spaces.
 *
 * WHAT IT CANNOT UNDO
 *
 *   A removed recipient stays removed; adding the address again is a new row.
 *
 * ADDITIVE ONLY. No drop and no delete. One bucket figure updated, one table,
 * one function, one trigger, one grant row.
 */

update storage.buckets
   set file_size_limit = 41943040
 where id = 'eng-uploads';

create table if not exists eng_alert_recipients (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  email       text not null check (email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'),
  added_by    uuid not null references eng_profiles (id) on delete restrict,
  removed_at  timestamptz,
  removed_by  uuid references eng_profiles (id) on delete restrict,
  constraint eng_alert_recipients_removed_whole check ((removed_at is null) = (removed_by is null))
);

create unique index if not exists eng_alert_recipients_live_once
  on eng_alert_recipients (lower(email)) where removed_at is null;

alter table eng_alert_recipients enable row level security;

comment on table eng_alert_recipients is
  'Where the office''s alerts go, edited by the owner. Never deleted; removal is stamped once. An empty list means business.notificationEmail (0099).';

create or replace function eng_alert_recipient_guard()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'An alert recipient is never deleted. Remove it, which records who removed it and when (0099).';
  end if;
  if new.email is distinct from old.email
     or new.added_by is distinct from old.added_by
     or new.created_at is distinct from old.created_at then
    raise exception 'An alert recipient''s address and who added it do not change. Remove it and add the right one (0099).';
  end if;
  if old.removed_at is not null then
    raise exception 'A removed alert recipient stays removed. Add the address again as a new row (0099).';
  end if;
  return new;
end;
$fn$;

create trigger eng_alert_recipients_guard before update or delete on eng_alert_recipients
  for each row execute function eng_alert_recipient_guard();

revoke all on eng_alert_recipients from public, anon, authenticated;
revoke execute on function eng_alert_recipient_guard() from public, anon, authenticated;

/* The owner edits where alerts go (declared in DEFAULT_ROLES, pinned in roles-audit). */
insert into eng_role_grants (role_key, action) values
  ('admin', 'alerts.manage')
on conflict (role_key, action) do nothing;
