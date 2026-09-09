-- ===========================================================================
-- 0036: somebody asked to be forgotten, and this is where that is written down.
--
-- Phase 12 Section 3, the customer side. Operator ruling: A DELETION REQUEST
-- PRODUCES A TASK, NOT A DELETION.
--
-- WHY THERE IS A TABLE AND NOT JUST A TASK
-- -----------------------------------------
-- A task is a thing somebody has to do, and it has two states: open and done.
-- A deletion request is a thing somebody SAID, and what matters about it a year
-- later is what they asked for, when, through which door, who took the call,
-- and what the firm answered. Closing a task records none of that. It records
-- that somebody ticked it.
--
-- So the request is a record and the task is what the record produces. The task
-- can be closed, reassigned, or forgotten about, and the request stays exactly
-- as it was taken.
--
-- WHY THE OUTCOME IS DELIBERATELY NOT AN ENUM
-- --------------------------------------------
-- The obvious design gives this a status: refused, actioned, partly actioned.
-- Every one of those values is a decision about what the firm is allowed to do
-- with an engineering record, and NOBODY HAS MADE THOSE DECISIONS. The
-- repository states no Texas retention period, the privacy policy points at
-- what Texas requires, and 41 tables in retention-policy.ts are waiting on
-- counsel for exactly this reason.
--
-- An enum shipped now would be this platform inventing the answer and then
-- offering it on a screen, which is how a placeholder becomes a policy. So the
-- answer is a SENTENCE somebody wrote, with their name and the date on it, and
-- the taxonomy arrives when the ruling does.
--
-- WHAT THIS TABLE MUST NEVER BECOME
-- ----------------------------------
-- A queue that deletes things. Nothing in this migration, and nothing in
-- ops-retention.ts, connects a row here to a retention run. A person holding
-- retention.execute plans a run against a table the declaration allows, and
-- that is the only path a row is ever removed by. A request is a reason
-- somebody might do that, and it is not a trigger for it.
--
-- IT REFUSES DELETE. Same function as the money and consent records in 0032,
-- and it belongs with them: this is the record of something a person asked
-- about their own data, and a platform that could quietly remove the request
-- is a platform where "we never received that" is unfalsifiable.
-- ===========================================================================

create table if not exists eng_deletion_requests (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  /* Written by the database from the same now(), the same construction the
   * retention manifest uses and for the same reason. */
  created_at_ct     text not null
                    default to_char(now() at time zone 'America/Chicago',
                                    'YYYY-MM-DD HH24:MI:SS "CT"'),

  -- --------------------------------------------------------------- who asked
  subject_email     text not null,
  /* Who they are, in the words of whoever took it. Not a foreign key: the
   * person asking may have no account, no order and no file, and requiring a
   * record to point at would mean the requests this platform can record are
   * the ones from people it already knows. */
  subject_note      text,

  -- ------------------------------------------------------------ through what
  channel           text not null
                    check (channel in ('telephone', 'email', 'letter', 'in_person', 'other')),
  channel_note      text,

  /* Their words, not a summary. A paraphrase of a request is the firm's account
   * of what somebody wanted, and this table exists because that is exactly the
   * thing nobody should have to take on trust later. */
  asked_for         text not null,

  -- ---------------------------------------------------------------- who took
  taken_by          uuid references eng_profiles(id) on delete set null,
  taken_by_email    text,

  -- --------------------------------------------------- what it produced
  /* The task. ON DELETE SET NULL rather than RESTRICT: a task is operational
   * and may be tidied away, and the request outliving its task is correct.
   * The request is the record; the task was only the prompt. */
  task_id           uuid references eng_tasks(id) on delete set null,

  /* Whether the address was added to the do not contact list in the same
   * motion. Somebody asking to be forgotten has unambiguously asked not to be
   * written to, and suppressing is the one part of that the firm can do
   * immediately and without a ruling. */
  suppressed        boolean not null default false,

  -- ------------------------------------------------------------ what was said
  answered_at       timestamptz,
  answered_by       uuid references eng_profiles(id) on delete set null,
  answered_because  text,

  constraint eng_deletion_requests_lowercase
    check (subject_email = lower(subject_email)),

  /* An answer says what was said. A row marked answered with no words is a row
   * that records somebody closing a screen. */
  constraint eng_deletion_requests_answer_says_what
    check (answered_at is null or (answered_because is not null and length(btrim(answered_because)) > 0)),

  /* And "other" names itself, or it is not a channel, it is a shrug. */
  constraint eng_deletion_requests_other_is_named
    check (channel <> 'other' or (channel_note is not null and length(btrim(channel_note)) > 0)),

  constraint eng_deletion_requests_asked_for_said
    check (length(btrim(asked_for)) > 0)
);

alter table eng_deletion_requests enable row level security;

create index if not exists eng_deletion_requests_subject
  on eng_deletion_requests (subject_email, created_at desc);
create index if not exists eng_deletion_requests_open
  on eng_deletion_requests (created_at desc) where answered_at is null;

drop trigger if exists eng_deletion_requests_no_delete on eng_deletion_requests;
create trigger eng_deletion_requests_no_delete before delete on eng_deletion_requests
  for each row execute function eng_forbid_record_delete();

comment on table eng_deletion_requests is
  'One row per person who asked to be forgotten, as it was taken. It produces a task and never a deletion. The outcome is a sentence somebody wrote rather than an enum, because what the firm may do with an engineering record is with counsel and this platform must not invent the answer and then offer it on a screen. Refuses DELETE.';
comment on column eng_deletion_requests.asked_for is
  'Their words. A paraphrase is the firm''s account of what somebody wanted, which is the thing this table exists so nobody has to take on trust.';
comment on column eng_deletion_requests.task_id is
  'The task this produced. SET NULL rather than RESTRICT: the task is operational and may be tidied away; the request outliving it is correct.';
comment on column eng_deletion_requests.answered_because is
  'What the firm said, in the words of whoever said it. There is no status enum, because every value one could carry is a decision nobody has made yet.';
