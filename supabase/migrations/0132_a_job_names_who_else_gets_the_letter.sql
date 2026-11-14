/*
 * 0132: A JOB NAMES WHO ELSE GETS THE LETTER, EACH WITH A ROLE AND AN EMAIL.
 *
 * The Killeen call, item 2 (Robert, 2026-11-14): "who else gets the letter
 * (agent, lender, title, each with a role and an email) ... No more burying
 * these in Notes." Part 1 finding 4 found the one place this lived, the free
 * text answer copy_to, was asked of every customer and read by nothing.
 *
 * One table, eng_file_contacts: a person on a file who is not the client.
 *
 *   role        agent, lender, title or other, as the call names them.
 *   name        optional: a lender is often a department.
 *   email       required: it is where the letter goes (item 7).
 *   pays        at most one per file (a partial unique index): the contact the
 *               payment link goes to when somebody other than the client pays.
 *               None paying means the client pays, as before.
 *   removed_at  a contact taken off is kept and marked, never deleted, because
 *               who was sent a sealed letter is a fact about the past.
 *
 * Row level security on and no policy, as every eng_ table: read and written
 * through the service role in src/lib/file-contacts.ts.
 *
 * Retention: kept pending counsel, with the file it belongs to
 * (src/lib/retention-policy.ts). Additive. No backfill: an existing copy_to
 * answer stays where it is, as text.
 */

/* ------------------------------------------------------------- 0. the ground */
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'eng_files' and column_name = 'intake_request_id'
  ) then
    raise exception 'eng: 0132 follows 0131, which adds eng_files.intake_request_id. It is not here.';
  end if;
end;
$$;

/* ------------------------------------------------------------- 1. the table */
create table if not exists eng_file_contacts (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  file_id     uuid not null references eng_files(id) on delete cascade,
  role        text not null check (role in ('agent', 'lender', 'title', 'other')),
  name        text,
  email       text not null check (email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  pays        boolean not null default false,
  added_by    uuid references eng_profiles(id) on delete set null,
  removed_at  timestamptz
);

comment on table eng_file_contacts is
  'People on a file who are not the client: an agent, lender or title company who gets the letter, and the one who pays when the client does not (0132).';

create index if not exists eng_file_contacts_file_idx on eng_file_contacts (file_id) where removed_at is null;

/* One payer per file, among the contacts still on it. */
create unique index if not exists eng_file_contacts_one_payer
  on eng_file_contacts (file_id)
  where pays and removed_at is null;

alter table eng_file_contacts enable row level security;
