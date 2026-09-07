-- ===========================================================================
-- 0023: what an alert remembers
--
-- The closeout, queue depth alerting. One table, one row per thing that can
-- alert, holding the last time it did.
--
-- WHY A TABLE RATHER THAN A CLEVER REUSE
-- --------------------------------------
-- Fault alerting already remembers, on eng_error_types: a fingerprint carries
-- alerted_new_at and alerted_rate_at, and the cooldown is read off the row the
-- alert is about. Queue depth has no such row. The queue is a state rather than
-- an event, and "the queue is behind" is not a fingerprint.
--
-- Three reuses were considered and each was worse than a table:
--
--   RECORD IT AS A FAULT and let the existing sweep alert on it. The sweep is
--   ENQUEUED as a job. A queue that is not draining is exactly the condition in
--   which that job never runs, so the alert about the stuck queue would be
--   waiting in the stuck queue. That is not a smaller version of the feature,
--   it is the feature failing in the only case it exists for.
--
--   PUT THE MARKER IN eng_cron_runs, whose rows are runs of scheduled jobs.
--   "The run that sent an alert" is a fact about a run, but the row would have
--   to carry a name that is not a cron, and cronStates reads that table by name
--   to say whether each watched job is alive. A row that is not a run, in the
--   table that answers "is the worker running", is a lie in the one place this
--   platform put there to stop lying to itself.
--
--   KEEP NOTHING, the way the outage watcher keeps nothing. That watcher has a
--   reason: the only place it could keep state is the database it is reporting
--   on, so it repeats every five minutes and says so in the email. The queue
--   being behind does not mean the database is unreachable, so the reason does
--   not carry across, and an alert repeating every five minutes for a backlog
--   that legitimately takes an hour to clear is precisely the crying wolf that
--   src/lib/alert-rules.ts is written against.
--
-- WHY IT IS NOT APPEND ONLY
-- -------------------------
-- Same reasoning as 0011 and 0012, and it is the rule for this class rather
-- than an exception: this is telemetry about the machine. A cooldown that could
-- only be appended to would need every read to find the newest of many rows for
-- one key, and the table would grow forever to hold one timestamp. Nothing
-- here is a regulatory or financial fact, and nobody will ever be asked to
-- produce it.
-- ===========================================================================

create table if not exists eng_alert_state (
  /*
   * The thing that alerts, not the alert. "queue.depth" is one row forever,
   * updated in place, so a cooldown is a read of one row by primary key.
   */
  key             text primary key,
  last_alerted_at timestamptz not null,
  /*
   * What it said, in one line. Not the email and not a log: it is here so
   * somebody reading the row can tell "we alerted an hour ago" from "we
   * alerted an hour ago about something else entirely".
   */
  detail          text,
  updated_at      timestamptz not null default now()
);

alter table eng_alert_state enable row level security;

comment on table eng_alert_state is
  'One row per thing that can raise an alert, holding when it last did. Read to apply a cooldown, written when an alert is sent. Not append only: it is a cooldown rather than a record, and the reasoning is at the top of this migration.';
