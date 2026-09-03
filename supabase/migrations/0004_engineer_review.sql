-- ===========================================================================
-- 0004: engineer review.
--
-- eng_documents, eng_time_log, eng_production_ledger and
-- eng_responsible_charge_log all shipped in 0001. What follows is the status
-- the state machine gained, the columns the four review actions need, and the
-- one table 0001 could not have anticipated because it belongs to a rule that
-- was decided later.
-- ===========================================================================

-- 1. Refused is a status.
--
-- Cancelled means the work was called off. Revisions requested means the
-- evidence was insufficient and somebody is going back. Refused means a
-- licensed engineer examined the package and would not certify it. Three
-- different facts about a property, and the constraint has to be able to hold
-- all three or the record cannot say which one happened.
alter table eng_files drop constraint if exists eng_files_status_check;
alter table eng_files add constraint eng_files_status_check check (status in (
  'intake', 'needs_dispatch', 'dispatched', 'evidence_in_progress',
  'evidence_submitted', 'under_review', 'revisions_requested',
  'refused', 'sealed', 'delivered', 'closed', 'cancelled'));

alter table eng_files add column if not exists refused_at timestamptz;
alter table eng_files add column if not exists refusal_reason text;
alter table eng_files add column if not exists refused_by uuid
  references eng_profiles(id) on delete set null;

comment on column eng_files.refusal_reason is
  'Why a licensed engineer would not certify this package. Goes to the client, the responsible charge log, and whoever opens the file next. Never a cancellation.';

-- 2. Which review a decision belongs to.
--
-- The responsible charge log states how long the engineer spent on a file, and
-- a number typed at the end of the month is the number somebody wishes were
-- true. A review session opens when the engineer takes the file into review and
-- closes at the decision, and the elapsed time is what the log records.
--
-- It is wall clock and the schema says so. An engineer who opens a file and
-- goes to lunch produces a large number that means nothing, which is why the
-- correction path exists and why a corrected entry is flagged.
create table if not exists eng_review_sessions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  file_id       uuid not null references eng_files(id) on delete cascade,
  engineer_id   uuid not null references eng_profiles(id) on delete cascade,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  decision      text check (decision in ('seal', 'revisions', 'site_visit', 'refuse')),
  minutes       integer
);
create index if not exists eng_review_sessions_file_idx
  on eng_review_sessions (file_id, started_at desc);
create unique index if not exists eng_review_sessions_open
  on eng_review_sessions (file_id, engineer_id) where ended_at is null;

alter table eng_review_sessions enable row level security;

comment on table eng_review_sessions is
  'Wall clock time between taking a file into review and deciding it. Measured, never asked for. The partial unique index means one open session per engineer per file.';

-- 3. The production ledger records WHICH review it paid for.
--
-- Operator ruling, 2026-09-02: production pay attaches to the completed review
-- rather than to the seal, and a declined file writes an entry at the same tier
-- a sealed one would have. Paying only on a seal pays for a conclusion rather
-- than for the work.
--
-- The decision is stored on the row so the ledger can be read back and the
-- rule checked. A ledger of amounts with no outcomes cannot answer "were the
-- declines paid", which is the only question this rule exists to make
-- answerable.
alter table eng_production_ledger add column if not exists decision text
  check (decision in ('seal', 'revisions', 'site_visit', 'refuse'));
alter table eng_production_ledger add column if not exists review_session_id uuid
  references eng_review_sessions(id) on delete set null;

create unique index if not exists eng_production_once_per_review
  on eng_production_ledger (review_session_id) where review_session_id is not null;

comment on column eng_production_ledger.decision is
  'Which review outcome this entry paid for. A declined file is paid at the same tier as a sealed one, per the operator ruling of 2026-09-02.';

-- 4. One responsible charge row per review session.
--
-- The log is append only and cannot be de-duplicated after the fact, so the
-- database refuses the second insert rather than leaving somebody to explain a
-- duplicated record to a board.
alter table eng_responsible_charge_log add column if not exists review_session_id uuid;
create unique index if not exists eng_rcl_once_per_review
  on eng_responsible_charge_log (review_session_id) where review_session_id is not null;

-- 5. A file records how many times it has been sent back.
--
-- The responsible charge log states the revision count, and counting the
-- rounds by reading the timeline every time is both slow and a place for two
-- answers to appear.
alter table eng_files add column if not exists revision_count integer not null default 0;

-- 6. The responsible charge log records WHICH decision was taken.
--
-- It shipped with a `refused` boolean, and everything that was not a refusal was
-- therefore rendered as "Sealed": in the engineer's own log, and in the CSV
-- handed to a regulator. A file sent back for revisions was reported as sealed.
--
-- That is a false statement in the one document this table exists to produce,
-- and it could not be fixed in the view, because the fact was never stored. Four
-- outcomes, one boolean.
--
-- Existing rows keep a null decision rather than being backfilled to a guess.
-- The log is append only precisely so that nobody rewrites history in it, and
-- inferring "sealed" for every old non refusal would be committing the original
-- error a second time and calling it a migration.
alter table eng_responsible_charge_log add column if not exists decision text
  check (decision in ('seal', 'revisions', 'site_visit', 'refuse'));

comment on column eng_responsible_charge_log.decision is
  'Which of the four review outcomes this row records. Null on rows written before 2026-09-02, when only refusals were distinguished; those are shown as an unrecorded outcome rather than guessed.';
