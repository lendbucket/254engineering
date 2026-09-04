/**
 * What happens to a job when it fails, and when it may run again.
 *
 * Pure, and separate from the queue for the same reason reconcile-rules is
 * separate from ops-reconcile: this is the part that decides whether work is
 * retried or abandoned, and a decision that needs a database and a provider to
 * exercise is a decision that gets exercised once, by hand.
 *
 * THE RULE THAT GOVERNS THE WHOLE SECTION
 * ---------------------------------------
 * A job that did not run must be visible. Everything below serves that: a
 * failure schedules a retry, an exhausted job becomes dead rather than
 * disappearing, and dead is a state an operator sees rather than a row that is
 * quietly deleted.
 */

export type JobStatus = "pending" | "running" | "done" | "dead";

/** What the worker decided to do with a job after running it. */
export type JobOutcome =
  | { kind: "done" }
  | { kind: "retry"; error: string }
  /** A failure that will never succeed. Straight to dead, no attempts wasted. */
  | { kind: "fatal"; error: string };

export type NextState = {
  status: JobStatus;
  /** When it becomes eligible again. Unchanged when it is not being retried. */
  runAfterMs: number;
  lastError: string | null;
  finished: boolean;
};

/**
 * Exponential backoff with jitter.
 *
 * WHY JITTER, WHICH IS NOT DECORATION
 * -----------------------------------
 * Ten jobs enqueued in one request fail together when a provider is down, and
 * without jitter all ten retry in the same second, and again in the same
 * second, hammering a service that is already struggling. Jitter spreads them.
 *
 * WHY IT IS CAPPED
 * ----------------
 * Doubling without a cap reaches days by the sixth attempt, and a job whose
 * next attempt is on Thursday is a job nobody will see fail. The cap keeps the
 * whole retry sequence inside a working day, so an operator looking at the
 * queue in the afternoon sees what broke that morning.
 */
export const BASE_DELAY_MS = 30_000;
export const MAX_DELAY_MS = 60 * 60 * 1000;

export function backoffMs(attempts: number, random: () => number = Math.random): number {
  const exponent = Math.max(0, attempts - 1);
  const raw = BASE_DELAY_MS * Math.pow(2, exponent);
  const capped = Math.min(raw, MAX_DELAY_MS);
  /*
   * Full jitter across the window rather than a small wobble around it. A small
   * wobble still leaves a thundering herd; picking uniformly from zero to the
   * delay actually spreads a batch out.
   *
   * The floor keeps a first retry from being effectively immediate, which would
   * burn an attempt against a provider that has not had time to recover.
   */
  return Math.max(BASE_DELAY_MS / 2, Math.floor(random() * capped));
}

/**
 * Where a job goes next.
 *
 * `now` and `random` are injected so every case below is exercisable exactly
 * rather than approximately.
 */
export function nextState(
  job: { attempts: number; maxAttempts: number },
  outcome: JobOutcome,
  now: number = Date.now(),
  random: () => number = Math.random,
): NextState {
  if (outcome.kind === "done") {
    return { status: "done", runAfterMs: now, lastError: null, finished: true };
  }

  /*
   * A fatal failure skips the retries entirely. An unknown job kind, or a
   * payload missing the id it needs, will fail the same way five times, and
   * five identical failures spread over an hour is worse than one: it delays
   * the moment the operator sees a queue that needs a person.
   */
  if (outcome.kind === "fatal") {
    return { status: "dead", runAfterMs: now, lastError: outcome.error, finished: true };
  }

  /*
   * attempts has already been incremented by the claim, so this compares what
   * has been used against what is allowed. Exhausted means dead, and dead is a
   * state somebody sees.
   */
  if (job.attempts >= job.maxAttempts) {
    return {
      status: "dead",
      runAfterMs: now,
      lastError: `${outcome.error} (gave up after ${job.attempts} attempts)`,
      finished: true,
    };
  }

  return {
    status: "pending",
    runAfterMs: now + backoffMs(job.attempts, random),
    lastError: outcome.error,
    finished: false,
  };
}

/**
 * Is this row claimable, ignoring what its status claims?
 *
 * The lease is the authority, not the status. A row marked running whose lease
 * expired is claimable, and that single fact is what makes the queue survive a
 * worker being killed mid job without anybody noticing.
 */
export function isClaimable(
  job: { status: JobStatus; runAfterMs: number; leasedUntilMs: number | null },
  now: number = Date.now(),
): boolean {
  if (job.status === "done" || job.status === "dead") return false;
  if (job.runAfterMs > now) return false;
  if (job.status === "pending") return true;
  // running: only once the lease has lapsed.
  return job.leasedUntilMs !== null && job.leasedUntilMs < now;
}

/**
 * How long a worker may hold a job.
 *
 * Longer than the slowest handler and shorter than the function timeout. Too
 * short and a slow but healthy job is claimed twice while still running; too
 * long and a crashed worker's job sits idle for that whole window.
 */
export const LEASE_SECONDS = 120;

/**
 * How many jobs one invocation takes.
 *
 * Bounded so a single run cannot exceed the function timeout, which is the
 * failure that would make the queue stop moving entirely: a worker that always
 * times out never marks anything done, and every job it touched waits for its
 * lease and is picked up by the next worker, which also times out.
 */
export const BATCH_SIZE = 10;
