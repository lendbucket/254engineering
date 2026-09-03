-- ===========================================================================
-- 0005: tasks, threads, notifications.
--
-- eng_tasks, eng_threads, eng_thread_participants, eng_messages,
-- eng_notifications and eng_notification_prefs all shipped in 0001, including
-- eng_notifications.smsed_at and eng_notification_prefs.sms. What follows is
-- what turned out to be missing once the surfaces were built against them.
-- ===========================================================================

-- 1. A stable key, so a task can be created twice and exist once.
--
-- Two things create tasks without a human pressing anything: the compliance
-- seeds, which run once per firm, and the credential sweep, which runs monthly
-- and must update the task for a credential rather than adding a second one.
--
-- A duplicated compliance task is worse than a missing one. Somebody closes the
-- copy in front of them, the other copy makes the work look handled, and the
-- filing is late anyway.
alter table eng_tasks add column if not exists source_key text;
create unique index if not exists eng_tasks_source_key
  on eng_tasks (source_key) where source_key is not null;

comment on column eng_tasks.source_key is
  'Stable identity for a task the platform creates rather than a person: compliance seeds and derived credential tasks. Null for anything somebody typed.';

-- 2. Channels, so a channel thread knows which roles may read it.
--
-- ops-comms decides visibility from this list. Without it a channel is either
-- everybody or its explicit participants, and "the technicians channel" is
-- neither.
alter table eng_threads add column if not exists channel_roles text[] not null default '{}';

comment on column eng_threads.channel_roles is
  'Roles that may read a channel thread without being named participants. Empty on file and direct threads, which are scoped by the file and by participation.';

-- 3. Notifications record what was actually attempted, per channel.
--
-- eng_notifications carries emailed_at and smsed_at, which say when a channel
-- succeeded and nothing about a channel that failed. An email that bounced and
-- an email never attempted are the same null, and they are very different
-- facts when somebody says they were not told.
alter table eng_notifications add column if not exists email_error text;
alter table eng_notifications add column if not exists channels text[] not null default '{}';

comment on column eng_notifications.channels is
  'Which channels this notification was meant to go out on, decided by ops-comms at creation. emailed_at says one succeeded; email_error says one was tried and failed.';

-- 4. A thread carries its last message time, so a list can be ordered.
--
-- Ordering threads by their newest message means a join and an aggregate on
-- every render of the messages screen. This is denormalised on purpose and set
-- by the write path, which is the one place a message is ever created.
alter table eng_threads add column if not exists last_message_at timestamptz;
create index if not exists eng_threads_recent_idx on eng_threads (last_message_at desc nulls last);

-- 5. A direct thread between the same two people is one thread.
--
-- Without this a second "message this person" click makes a second thread and
-- the conversation splits in half, with each side reading a different one.
-- The key is the participant ids sorted and joined, computed by the write path.
alter table eng_threads add column if not exists direct_key text;
create unique index if not exists eng_threads_direct_key
  on eng_threads (direct_key) where direct_key is not null;

comment on column eng_threads.direct_key is
  'Participant ids, sorted and joined, for a direct thread. Makes a second attempt to start the same conversation find the existing one.';
