-- ===========================================================================
-- 0011: the durable job queue.
--
-- Everything on this platform currently happens inside the request that
-- triggered it. An email, a notification, a dispatch offer, a binder, a
-- reconciliation sweep: all of them run while somebody waits, and all of them
-- fail into a log line nobody reads.
--
-- At volume that fails in the worst available way. A slow provider makes a
-- customer wait for a page that has nothing to do with email, and a failed
-- provider means the thing simply never happened, silently, which is the defect
-- class this repository exists to hunt.
--
-- WHY A TABLE AND NOT A BROKER
-- ----------------------------
-- The database is the only durable store this platform has, and adding SQS or
-- Redis for a firm doing tens of jobs a day would be infrastructure theatre:
-- another credential, another outage surface, another thing whose failure mode
-- nobody here has seen. Postgres already gives the two things that matter,
-- which are durability and a way for two workers to not take the same row.
--
-- THE CLAIM IS A LEASE, NOT A FLAG
-- --------------------------------
-- The naive version sets status = 'running' and trusts the worker to set it
-- back. A worker that is killed mid job, and on a serverless platform that
-- happens on a timeout, leaves the row 'running' forever and the job never runs
-- again. Nothing is more silent than that.
--
-- So a claim writes a lease that EXPIRES. A crashed worker's job becomes
-- claimable again when its lease runs out, without anybody noticing the crash.
-- The cost is that a job can run twice, which is exactly why idempotency is
-- mandatory per kind rather than encouraged.
--
-- WHY run_after AND attempts ARE SEPARATE FROM status
-- ---------------------------------------------------
-- A job waiting for its backoff is not a different KIND of thing from a job
-- waiting for its first run; it is the same thing with a later time. Encoding
-- the wait as a status would need a sweeper to move rows back to pending, and a
-- sweeper is another thing that can stop running.
-- ===========================================================================

create table if not exists eng_jobs (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Which handler runs it. Checked against a registry in the application, so an
  -- unknown kind dead letters rather than silently never running.
  kind          text not null,

  -- Everything the handler needs. Deliberately NOT the thing itself: a job
  -- carries an order id, not an order, so a handler always reads current state
  -- rather than acting on a snapshot taken before a retry.
  payload       jsonb not null default '{}'::jsonb,

  status        text not null default 'pending'
                  check (status in ('pending', 'running', 'done', 'dead')),

  -- When it becomes eligible. Set forward by the backoff on every failure.
  run_after     timestamptz not null default now(),

  attempts      integer not null default 0,
  max_attempts  integer not null default 5,

  -- The lease. Both are set on claim and cleared on completion, and a row whose
  -- lease has expired is claimable again whatever its status says.
  leased_until  timestamptz,
  leased_by     text,

  -- The last failure, in the words the provider used. Kept for the dead letter
  -- screen, because "it failed" is not something an operator can act on.
  last_error    text,

  started_at    timestamptz,
  finished_at   timestamptz,

  /*
   * THE IDEMPOTENCY KEY, AND WHY IT IS NOT OPTIONAL IN PRACTICE
   * -----------------------------------------------------------
   * A lease can expire while the work is still running, so a job CAN run twice.
   * The key is what makes that safe: enqueueing the same key twice produces one
   * row, and a handler whose effect is not naturally idempotent uses the key to
   * make it so.
   *
   * Nullable in the column because a genuinely repeatable job, a sweep with no
   * side effect beyond its own writes, does not need one. jobs-audit asserts
   * that every REGISTERED kind declares whether it needs one and supplies it,
   * which is a stronger check than a NOT NULL could be.
   */
  idempotency_key text
);

/*
 * One live job per key. Partial, so the same key can be enqueued again after
 * the first has finished, which is what a monthly statement needs.
 *
 * Nothing uses ON CONFLICT against this index. See the note on
 * eng_service_orders_request_id in 0006: Postgres cannot infer a partial index
 * for ON CONFLICT, and a do-nothing upsert against one is decorative. The
 * application checks for a live row instead.
 */
create unique index if not exists eng_jobs_idempotency
  on eng_jobs (kind, idempotency_key)
  where idempotency_key is not null and status in ('pending', 'running');

/*
 * The claim query's index: eligible work, oldest first.
 *
 * Covers the exact predicate the worker uses, because a queue whose claim is a
 * sequential scan gets slower precisely as it gets busier.
 */
create index if not exists eng_jobs_claimable_idx
  on eng_jobs (run_after, id)
  where status in ('pending', 'running');

create index if not exists eng_jobs_status_idx on eng_jobs (status, created_at desc);
create index if not exists eng_jobs_kind_idx on eng_jobs (kind, status);

drop trigger if exists eng_jobs_touch on eng_jobs;
create trigger eng_jobs_touch before update on eng_jobs
  for each row execute function eng_touch_updated_at();

comment on table eng_jobs is
  'The durable queue. A claim is a LEASE that expires, so a crashed worker returns its job rather than holding it forever. That is why idempotency is mandatory per kind.';
comment on column eng_jobs.leased_until is
  'A row past this is claimable again whatever its status says. A worker killed by a function timeout does not need to be noticed for its job to run.';
comment on column eng_jobs.payload is
  'Ids, never objects. A handler reads current state, so a retry acts on the world as it is rather than as it was when the job was enqueued.';
comment on column eng_jobs.status is
  'dead means the attempts are exhausted. It is a state an operator SEES, not a row that is deleted, because a job that did not run must be visible.';

/*
 * Claiming, in one statement, so two workers cannot take the same row.
 *
 * FOR UPDATE SKIP LOCKED is the whole mechanism: each worker locks the rows it
 * takes and the other skips straight past them rather than blocking. Without
 * SKIP LOCKED two concurrent workers serialise, and with a plain SELECT then
 * UPDATE they both claim the same job.
 *
 * Written as a function rather than assembled in the application because it has
 * to be one statement to be atomic, and a multi statement version in TypeScript
 * would look correct and race.
 */
create or replace function eng_claim_jobs(
  worker text,
  batch_size integer,
  lease_seconds integer
)
returns setof eng_jobs
language sql
set search_path = ''
as $$
  update public.eng_jobs j
  set status = 'running',
      leased_by = worker,
      leased_until = pg_catalog.now() + (lease_seconds || ' seconds')::interval,
      attempts = j.attempts + 1,
      -- COALESCE is SQL grammar rather than a schema resolved function, so it
      -- cannot be qualified and does not need to be: an empty search_path
      -- cannot redirect it.
      started_at = coalesce(j.started_at, pg_catalog.now())
  where j.id in (
    select c.id
    from public.eng_jobs c
    where c.run_after <= pg_catalog.now()
      and (
        c.status = 'pending'
        -- A running job whose lease has expired. This is the crashed worker
        -- case, and it is the reason the queue recovers without supervision.
        or (c.status = 'running' and c.leased_until < pg_catalog.now())
      )
    order by c.run_after, c.id
    for update skip locked
    limit batch_size
  )
  returning j.*;
$$;

comment on function eng_claim_jobs is
  'Claims a bounded batch atomically. FOR UPDATE SKIP LOCKED is what stops two workers taking one row; an expired lease is what returns a crashed worker''s job.';

alter table eng_jobs enable row level security;
