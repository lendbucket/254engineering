-- ===========================================================================
-- 0042: an incident is a record, and the table is empty.
--
-- Phase 12 Section 6. Operator instruction: an incident record table, empty,
-- with the shape an incident takes. Empty and honest beats absent.
--
-- WHY THIS IS NOT eng_error_events
-- ---------------------------------
-- That table holds FAULTS: a stack trace, a route, a fingerprint, written by
-- the platform about itself, pruned on a retention schedule. It answers "what
-- broke".
--
-- An INCIDENT is something that affected a person and required a decision. A
-- customer's data reached the wrong account. A payment was taken twice. The
-- database was unreachable for an hour during business. Those may produce no
-- fault row at all, and the thing an auditor asks for is not the stack trace: it
-- is who decided what, when, and what changed afterwards.
--
-- Recording an incident inside the fault table would also put it inside the
-- retention sweep, which deletes faults older than the floor. An incident record
-- that expires is not a record.
--
-- WHY IT IS EMPTY AND WHY THAT IS THE POINT
-- ------------------------------------------
-- No incident has occurred, because the firm has not traded. Seeding an example
-- would put a fabricated event into the firm's own incident history, which is
-- the exact defect class this repository hunts. The table ships empty and the
-- readiness report says the count is zero and that zero means "none has
-- happened" rather than "none was recorded".
--
-- DELETES ARE REFUSED, UPDATES ARE NOT
-- -------------------------------------
-- An incident is written while it is still happening and the most valuable
-- column, what was learned, is filled in days later. So UPDATE has to work.
-- DELETE does not: eng_forbid_record_delete is attached, which is the same
-- guard eng_deletion_requests and eng_production_ledger carry.
--
-- That asymmetry is deliberate and is the same reasoning 0019 used for partner
-- entries: forbidding UPDATE wholesale would make the workflow impossible,
-- which is how a table ends up with a "corrections" column that everything
-- reads instead.
-- ===========================================================================

create table if not exists eng_incidents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- WHEN IT WAS DETECTED, which is not when it started. The gap between the two
  -- is the single most useful number in an incident review and it cannot be
  -- computed unless both are recorded.
  detected_at timestamptz not null,
  began_at timestamptz,

  -- HOW it came to somebody's attention. An incident found by a customer
  -- telephoning is a different control story from one an alert caught.
  detected_by text not null,

  summary text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),

  -- WHO was affected, in words. Deliberately not a foreign key: the answer is
  -- often "we do not yet know" or "every customer in one county", and a column
  -- that can only hold one account id would force a false precision.
  affected text,

  -- WHAT WAS DONE, and WHAT WAS LEARNED. The second is the one an auditor reads
  -- and the one that gets skipped, so it is its own column rather than a
  -- paragraph somebody may or may not append to the first.
  actions text,
  learned text,

  resolved_at timestamptz,

  -- Who is answerable for it. Nullable because an incident is often recorded
  -- before anybody has been assigned.
  owner_id uuid references eng_profiles(id) on delete restrict,

  -- A resolved incident has to say what was done. An unresolved one need not.
  constraint eng_incidents_resolved_says_what
    check (resolved_at is null or (actions is not null and length(trim(actions)) > 0))
);

comment on table eng_incidents is
  'Something that affected a person and required a decision, which is a different thing from a fault in eng_error_events. Empty as of 0042 because none has occurred; the firm has not traded. Deletes are refused, updates are not, because what was learned is filled in days after the row is written. Phase 12 Section 6.';

comment on column eng_incidents.began_at is
  'When it started, as opposed to when it was noticed. The gap between began_at and detected_at is how long nobody knew, which is the number an incident review is actually about.';

comment on column eng_incidents.learned is
  'What changed because of this. The column an auditor reads and the one that gets skipped, which is why it is its own column rather than a paragraph appended to actions.';

create index if not exists eng_incidents_detected_idx on eng_incidents (detected_at desc);
create index if not exists eng_incidents_unresolved_idx on eng_incidents (detected_at desc) where resolved_at is null;

alter table eng_incidents enable row level security;

drop trigger if exists eng_incidents_touch on eng_incidents;
create trigger eng_incidents_touch
  before update on eng_incidents
  for each row execute function eng_touch_updated_at();

drop trigger if exists eng_incidents_no_delete on eng_incidents;
create trigger eng_incidents_no_delete
  before delete on eng_incidents
  for each row execute function eng_forbid_record_delete();
