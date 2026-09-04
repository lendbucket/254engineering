-- ===========================================================================
-- 0012: observability
--
-- Phase 8 Section 3. Three tables, and each exists because of a question this
-- platform could not answer about itself.
--
--   eng_cron_runs      "is the worker still running?" A cron that stopped
--                      firing looks exactly like a cron with nothing to do.
--   eng_error_types    "is this a new fault or the same one again?" and
--   eng_error_events   "how often is it happening?"
--   eng_metrics_daily  "what did last month look like?" asked after the rows
--                      it would have been computed from are gone or too many
--                      to scan.
--
-- WHY THESE ARE NOT APPEND ONLY
-- -----------------------------
-- Every eng_ table carrying a regulatory or financial fact refuses UPDATE and
-- DELETE by trigger: the audit trail, payments, review decisions. None of
-- these three are that. They are telemetry about the machine, they will be
-- pruned on a schedule, and putting the append only trigger on them would make
-- a retention job impossible while protecting nothing anybody would ever be
-- asked to produce.
--
-- The distinction is deliberate and worth stating plainly, because "every
-- table in this schema refuses deletes" would otherwise look like the rule.
-- ===========================================================================

-- ---------------------------------------------------------------- cron runs
--
-- WHY A ROW IS WRITTEN WHEN THE RUN STARTS AND UPDATED WHEN IT FINISHES
-- ---------------------------------------------------------------------
-- A run that started and never reported is a fact worth having. It is what a
-- function killed by a timeout looks like, and if the row were only written on
-- completion that run would leave no trace at all: the table would show the
-- previous successful run and the status page would say everything is fine
-- while the cron has been dying every minute for an hour.
--
-- So finished_at null means "started, never came back", which is a different
-- thing from ok = false, which means "ran and reported a failure".
create table if not exists eng_cron_runs (
  id           bigserial primary key,
  name         text not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  ok           boolean,
  detail       text,
  created_at   timestamptz not null default now()
);

-- The status page's query: the most recent run of one cron, and the most
-- recent SUCCESSFUL one, which are not always the same row.
create index if not exists eng_cron_runs_recent
  on eng_cron_runs (name, started_at desc);
create index if not exists eng_cron_runs_successful
  on eng_cron_runs (name, finished_at desc)
  where ok is true;

alter table eng_cron_runs enable row level security;

comment on table eng_cron_runs is
  'One row per scheduled invocation. finished_at null means the run started and never reported, which is what a timeout looks like and is not the same as ok = false.';

-- ------------------------------------------------------------- error types
--
-- One row per distinct fault, keyed by a fingerprint computed in the
-- application. The counters live here rather than being counted from the
-- events on every read, because "how many times has this happened" is asked
-- on a status page that must stay fast when the answer is large.
create table if not exists eng_error_types (
  fingerprint      text primary key,
  title            text not null,
  culprit          text,
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  occurrences      bigint not null default 0,

  -- WHY TWO ALERT TIMESTAMPS RATHER THAN ONE
  -- ----------------------------------------
  -- A fault that is new and a fault that is suddenly frequent are two
  -- different pieces of news, and the operator needs both. One column would
  -- mean the new-type alert suppresses the rate alert for the same
  -- fingerprint, so the first time something starts happening a hundred times
  -- an hour, nobody is told.
  alerted_new_at   timestamptz,
  alerted_rate_at  timestamptz,

  -- Set by hand when a fault is known, understood and not worth waking up for.
  -- Muting suppresses the email; it does not stop the counting, so the status
  -- page still shows it and a muted fault cannot hide.
  muted            boolean not null default false,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists eng_error_types_recent
  on eng_error_types (last_seen_at desc);

alter table eng_error_types enable row level security;

drop trigger if exists eng_error_types_touch on eng_error_types;
create trigger eng_error_types_touch before update on eng_error_types
  for each row execute function eng_touch_updated_at();

comment on table eng_error_types is
  'One row per distinct fault. Muting stops the email and never stops the counting, so a muted fault still appears on the status page.';

-- ------------------------------------------------------------ error events
--
-- The occurrences. Kept separately from the counter so a rate threshold can
-- ask "how many in the last fifteen minutes", which a running total cannot
-- answer.
create table if not exists eng_error_events (
  id           bigserial primary key,
  fingerprint  text not null references eng_error_types (fingerprint) on delete cascade,
  message      text not null,
  route        text,
  release      text,
  environment  text,
  level        text not null default 'error'
                 check (level in ('fatal', 'error', 'warning')),

  -- Whatever the caller thought was worth keeping, after the scrubber has been
  -- through it. jsonb rather than text because the shape differs per fault and
  -- the alternative is a column per thing anybody ever wanted to attach.
  extra        jsonb,

  occurred_at  timestamptz not null default now()
);

create index if not exists eng_error_events_window
  on eng_error_events (fingerprint, occurred_at desc);
create index if not exists eng_error_events_recent
  on eng_error_events (occurred_at desc);

alter table eng_error_events enable row level security;

comment on table eng_error_events is
  'One row per captured error. Scrubbed before it is written: see src/lib/observability-scrub.ts, which is the same function that scrubs what goes to Sentry.';

-- ----------------------------------------------------------- daily metrics
--
-- Tall rather than wide: one row per day per metric.
--
-- A column per metric would mean a migration every time somebody wants to
-- count something new, and this is exactly the kind of table where that
-- happens monthly. The cost is that a reader has to know the metric names,
-- which is why they are enumerated in one place in src/lib/ops-metrics.ts
-- rather than being spelled out at each call site.
--
-- WHY THE PRIMARY KEY IS (day, metric) AND THE ROLLUP RECOMPUTES
-- --------------------------------------------------------------
-- The same rule the statement total follows: a figure is recomputed from its
-- source rows, never accumulated. A rollup that added to yesterday's number
-- would double it on a retry, and the queue guarantees at-least-once, not
-- exactly-once. Recomputing makes running it five times identical to running
-- it once.
create table if not exists eng_metrics_daily (
  day          date not null,
  metric       text not null,
  value        numeric not null,
  computed_at  timestamptz not null default now(),
  primary key (day, metric)
);

create index if not exists eng_metrics_daily_metric
  on eng_metrics_daily (metric, day desc);

alter table eng_metrics_daily enable row level security;

comment on table eng_metrics_daily is
  'One row per day per metric. The rollup recomputes from source rows rather than accumulating, so running it twice produces the same numbers as running it once.';
