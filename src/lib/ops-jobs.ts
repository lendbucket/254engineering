import "server-only";
import { DB_NOW } from "./db-now";
import { readEvery } from "./bounded-read";
import { supabaseAdmin } from "./supabase";
import { LEASE_SECONDS, BATCH_SIZE, nextState, type JobOutcome } from "./job-rules";
import { business } from "@/config/business";
import type { RenderedEmail } from "./email-templates";
import { effectModeFor, isFixtureIdentity } from "./fixture-identity";

/**
 * The queue: enqueue, claim, run, record.
 *
 * WHY THE REGISTRY MAKES IDEMPOTENCY A TYPE ERROR RATHER THAN A CONVENTION
 * ------------------------------------------------------------------------
 * A lease expires, so a job CAN run twice. That is not a flaw to be fixed; it is
 * the price of surviving a worker that is killed without warning, and the
 * alternative is a job that never runs again, which is worse and silent.
 *
 * So every handler declares how it is made safe to run twice. `idempotency` is
 * a required field on every registration: either a function producing the key
 * that dedupes the enqueue, or the literal string "naturally", with a sentence
 * saying why the effect is already repeatable. jobs-audit asserts every
 * registered kind carries one and that no handler quietly opts out.
 *
 * A registry entry is the only way to get a handler, so a kind that is enqueued
 * and never registered dead letters immediately rather than sitting pending
 * forever. That failure is loud by construction.
 */

export type JobKind =
  | "email.send"
  | "notification.deliver"
  | "evidence.thumbnail"
  | "document.binder"
  | "statement.issue"
  | "orders.reconcile"
  | "metrics.rollup"
  | "errors.alert"
  /*
   * Phase 12 Section 2, the reporting prompt's Section 3. NOT the export itself: the RECORD that one was
   * assembled. docs/platform-state.md states the rule this follows, and
   * document.binder above is the precedent. A queued CSV is a CSV nobody
   * receives, because nothing in this platform delivers a file somebody is not
   * standing in front of.
   */
  | "report.export"
  /*
   * Phase 12 Section 3. Taking the rows a manifest already named.
   *
   * ON THE QUEUE RATHER THAN INLINE, AND IT IS THE ONE KIND HERE WHERE THAT IS
   * NOT ABOUT LATENCY. Everything above left the request because somebody was
   * waiting. This leaves because a deletion that dies halfway through a request
   * is a deletion nobody can finish and nobody can describe: the queue gives it
   * a row that survives the process, a lease, attempts, and a dead letter
   * somebody has to look at. The manifest is written before this is enqueued,
   * so the job carries an id and never a plan.
   */
  | "retention.sweep";

export type JobPayload = Record<string, unknown>;

/**
 * Whether a job was permitted to reach outside this platform.
 *
 * See 0038. `live` is everything the handler does. `no_external_effect` is
 * everything except putting a message in somebody's inbox or money on a card:
 * it still reads, still writes rows, and still returns a real outcome, so the
 * queue is exercised exactly as it runs in anger.
 */
export type EffectMode = "live" | "no_external_effect";

export type JobRecord = {
  id: number;
  kind: string;
  payload: JobPayload;
  attempts: number;
  maxAttempts: number;
  /**
   * Read off the claimed row, never off the environment. A flag set in one
   * terminal cannot protect a worker started in another, which is exactly how
   * a retention dry run on development sent twenty real emails on 2026-09-09.
   */
  effectMode: EffectMode;
};

type Handler = {
  /**
   * How this kind survives running twice.
   *
   * A function returns the key that makes the ENQUEUE unique, so a second
   * enqueue of the same work finds the first rather than adding a row.
   * "naturally" means the effect is already repeatable and says why.
   */
  idempotency: ((payload: JobPayload) => string) | "naturally";
  /** Why, when it is "naturally". Required, so nobody asserts it without cause. */
  why?: string;
  /**
   * DOES RUNNING THIS REACH ANYBODY OUTSIDE THIS PLATFORM?
   *
   * Declared per handler rather than worked out by reading the code, because
   * the question a person asks before running a worker is "what will this send"
   * and the answer must be readable without following six imports.
   *
   * A handler declaring true MUST honour job.effectMode. queue-audit asserts
   * both halves: that every kind declares this, and that every kind declaring
   * true actually behaves differently in the two modes.
   */
  reachesOutside: boolean;
  /**
   * What it reaches, when reachesOutside is true. Required for the same reason
   * `why` is required beside "naturally": an assertion with no cause written
   * beside it is one nobody can check.
   */
  reaches?: string;
  run: (payload: JobPayload, job: JobRecord) => Promise<JobOutcome>;
};

const registry = new Map<string, Handler>();

export function registerJob(kind: JobKind, handler: Handler): void {
  registry.set(kind, handler);
}

export function registeredKinds(): string[] {
  return [...registry.keys()];
}

export function handlerFor(kind: string): Handler | undefined {
  return registry.get(kind);
}

/**
 * Make sure every handler is registered before the registry is read.
 *
 * WHY THIS IS NOT A SIDE EFFECT IMPORT AT EACH CALL SITE
 * ------------------------------------------------------
 * The first version of this section relied on each caller writing an import
 * of job-handlers purely for its side effect. That is a line with no referenced
 * symbol, which is precisely the line a tidy up or an auto fixer
 * removes, and the failure it produces is the worst shape available: an empty
 * registry, so every enqueue is REFUSED and every claimed job dead letters with
 * "no handler is registered", for code that was correct.
 *
 * A dynamic import here makes registration a property of the queue rather than
 * a thing each caller must remember. It cannot be a static import because
 * job-handlers imports this module; by the time anything calls into the queue,
 * this module is fully evaluated and the cycle does not exist.
 */
let handlersLoading: Promise<void> | null = null;

export async function loadHandlers(): Promise<void> {
  if (!handlersLoading) handlersLoading = import("./job-handlers").then(() => undefined);
  await handlersLoading;
}

// ------------------------------------------------------------------ enqueue

export type EnqueueResult =
  | { ok: true; id: number; duplicate: boolean }
  | { ok: false; error: string };

/**
 * Put work on the queue.
 *
 * NEVER THROWS, AND THAT IS DELIBERATE
 * ------------------------------------
 * The caller is a request that has already done the thing that matters: taken
 * the order, recorded the payment, saved the evidence. A queue that is
 * unreachable must not turn a successful request into a failed one, so this
 * returns a result and the caller logs it.
 *
 * The cost is that a failed enqueue is a job that never existed, which is
 * exactly the silence this section exists to remove. So it is logged loudly
 * here rather than left to each caller to remember.
 */
export async function enqueue(
  kind: JobKind,
  payload: JobPayload,
  options: { runAfter?: Date; maxAttempts?: number; effectMode?: EffectMode } = {},
): Promise<EnqueueResult> {
  await loadHandlers();

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The job system is not configured." };

  const handler = registry.get(kind);
  if (!handler) {
    /*
     * Refused at the enqueue rather than accepted and dead lettered later. A
     * kind with no handler is a programming error, and the sooner it is loud
     * the better.
     */
    console.error(`[jobs] refused to enqueue an unregistered kind: ${kind}`);
    return { ok: false, error: `No handler is registered for ${kind}.` };
  }

  const key = typeof handler.idempotency === "function" ? handler.idempotency(payload) : null;

  /*
   * The live row check, done here rather than with ON CONFLICT.
   *
   * The unique index is PARTIAL, and Postgres cannot infer a partial index for
   * ON CONFLICT, so an upsert against it would silently take the do nothing
   * path on every insert. Phase 2 shipped exactly that defect and the
   * idempotency it was built for never worked. The index still exists as the
   * backstop that makes a race fail loudly rather than duplicate.
   */
  if (key) {
    /*
     * THE GUARD THAT STOPS A DUPLICATE MUST NOT BE DEFEATED BY ONE.
     *
     * This was `.maybeSingle()` with the error discarded. PostgREST answers
     * PGRST116 when MORE THAN ONE row matches as well as when none does, and
     * two live jobs sharing a key is exactly the state this check exists to
     * notice. So the moment a duplicate existed the lookup failed, the failure
     * read as "no live job", and the enqueue added a THIRD. The guard broke in
     * the one circumstance it was written for.
     *
     * Oldest first, because the earliest live job is the one this enqueue is a
     * duplicate OF, and returning its id is what makes the caller's retry
     * idempotent rather than merely quiet.
     */
    const { data: liveRows, error: liveErr } = await db
      .from("eng_jobs")
      .select("id")
      .eq("kind", kind)
      .eq("idempotency_key", key)
      .in("status", ["pending", "running"])
      .order("id", { ascending: true })
      .limit(1);

    /*
     * A failed read is not an absence. Refusing here means the caller logs a
     * failed enqueue, which is loud; carrying on would mean a second side
     * effect nobody asked for.
     */
    if (liveErr) {
      console.error(`[jobs] could not check for a live ${kind}: ${liveErr.message}`);
      return { ok: false, error: `Could not check whether that work is already queued: ${liveErr.message}` };
    }

    const live = (liveRows ?? [])[0];
    if (live) return { ok: true, id: live.id as number, duplicate: true };
  }

  const { data, error } = await db
    .from("eng_jobs")
    .insert({
      kind,
      payload,
      idempotency_key: key,
      /*
       * run_after is only written when a DELAY was asked for. Left out, the
       * column's own default of now() applies, and the row becomes eligible on
       * the database's clock rather than on this machine's.
       *
       * Found during the Section 2 walk. Four jobs enqueued and a batch run
       * milliseconds later claimed none of them: the application wrote a
       * run_after a second or so ahead of the database's now(), so the claim's
       * "run_after <= now()" was false for rows that were meant to be eligible
       * immediately. Harmless in production, where the worker runs every
       * minute, and exactly the sort of thing that makes an operator testing
       * the queue believe it is broken.
       */
      ...(options.runAfter ? { run_after: options.runAfter.toISOString() } : {}),
      ...(options.maxAttempts ? { max_attempts: options.maxAttempts } : {}),
      /*
       * Only written when suppression was ASKED for, so the column default of
       * live applies to everything else. Defaulting the other way would make
       * every job written by every future caller silently do nothing outside,
       * and a customer waiting for a link a green board says was sent is a
       * worse failure than one email too many.
       */
      ...(options.effectMode && options.effectMode !== "live"
        ? { effect_mode: options.effectMode }
        : {}),
    })
    .select("id")
    .single();

  if (error || !data) {
    // 23505 is the partial unique index catching a race: another request
    // enqueued the same key between the check above and this insert. Not an
    // error, and the work is already queued.
    if (error?.code === "23505") return { ok: true, id: -1, duplicate: true };
    console.error(`[jobs] could not enqueue ${kind}: ${error?.message}`);
    return { ok: false, error: error?.message ?? "The job could not be queued." };
  }

  return { ok: true, id: data.id as number, duplicate: false };
}

// ------------------------------------------------------------------- worker

export type WorkerReport = {
  claimed: number;
  done: number;
  retried: number;
  dead: number;
  kinds: Record<string, number>;
};

/**
 * Claim a bounded batch and run it.
 *
 * The claim is one SQL statement, in eng_claim_jobs, because it has to be
 * atomic. Assembling it here as a select then an update would look correct and
 * would let two workers take the same row.
 */
export async function runBatch(workerId: string): Promise<WorkerReport> {
  await loadHandlers();

  const report: WorkerReport = { claimed: 0, done: 0, retried: 0, dead: 0, kinds: {} };

  const db = supabaseAdmin();
  if (!db) return report;

  const { data: claimed, error } = await db.rpc("eng_claim_jobs", {
    worker: workerId,
    batch_size: BATCH_SIZE,
    lease_seconds: LEASE_SECONDS,
  });

  if (error) {
    console.error(`[jobs] could not claim: ${error.message}`);
    return report;
  }

  for (const row of (claimed ?? []) as Record<string, unknown>[]) {
    report.claimed += 1;
    const kind = row.kind as string;
    report.kinds[kind] = (report.kinds[kind] ?? 0) + 1;

    const job: JobRecord = {
      id: row.id as number,
      kind,
      payload: (row.payload ?? {}) as JobPayload,
      attempts: Number(row.attempts),
      maxAttempts: Number(row.max_attempts),
      /*
       * Off the claimed row. eng_claim_jobs is `returns setof eng_jobs`, so
       * the column arrives with no change to the function. An unrecognised
       * value reads as live rather than as suppression, because a typo that
       * silences a send is the failure nobody would notice.
       */
      effectMode: row.effect_mode === "no_external_effect" ? "no_external_effect" : "live",
    };

    const handler = registry.get(kind);

    /*
     * An unregistered kind is fatal rather than retried. It will fail
     * identically five times, and five identical failures spread over an hour
     * only delay the moment an operator sees a queue that needs a person.
     */
    const outcome: JobOutcome = handler
      ? await runOne(handler, job)
      : { kind: "fatal", error: `No handler is registered for ${kind}.` };

    const next = nextState(job, outcome);

    await db
      .from("eng_jobs")
      .update({
        status: next.status,
        run_after: new Date(next.runAfterMs).toISOString(),
        last_error: next.lastError,
        /* DB_NOW. Retention ages jobs by this column against the database's
         * clock, so a value from this machine ages by the wrong amount. */
        finished_at: next.finished ? DB_NOW : null,
        // The lease is released whatever happened. A retry must be claimable at
        // its run_after rather than waiting for a lease nobody holds.
        leased_until: null,
        leased_by: null,
      })
      .eq("id", job.id);

    if (next.status === "done") report.done += 1;
    else if (next.status === "dead") {
      report.dead += 1;
      console.error(`[jobs] DEAD ${kind} #${job.id}: ${next.lastError}`);
    } else {
      report.retried += 1;
    }
  }

  return report;
}

/**
 * Run one handler, turning a throw into a retry rather than losing the batch.
 *
 * A handler that throws must not take the other nine jobs with it. Without this
 * the whole invocation dies, every claimed job keeps its lease, and the batch
 * repeats when the leases expire, which looks exactly like a queue that is
 * moving while nothing completes.
 */
async function runOne(handler: Handler, job: JobRecord): Promise<JobOutcome> {
  try {
    return await handler.run(job.payload, job);
  } catch (err) {
    return { kind: "retry", error: err instanceof Error ? err.message : "the handler threw" };
  }
}

// -------------------------------------------------------------- the picture

export type QueueHealth = {
  pending: number;
  running: number;
  dead: number;
  /** Eligible now and not yet claimed. This is the number that means "behind". */
  overdue: number;
  /** Age in seconds of the oldest eligible job. Null when nothing is waiting. */
  oldestWaitingSeconds: number | null;
  byKind: { kind: string; pending: number; dead: number }[];
};

export async function queueHealth(): Promise<QueueHealth | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  /*
   * PAGED, AND THIS ONE TRUNCATES EXACTLY WHEN IT MATTERS.
   *
   * The comment below already says a failed read is not an empty queue. A
   * TRUNCATED read is not a small queue either, and the difference is worse:
   * this reads only pending, running and dead, so the set is empty on a healthy
   * queue and only grows when the queue is BACKED UP. The one moment the depth
   * figure is worth reading is the one moment it would have been capped at a
   * thousand and reported calm.
   *
   * On production today the set is zero: 1,290 jobs, all done. That is why this
   * is a deadline rather than a live defect, and why it is fixed before the
   * deadline arrives.
   */
  const read = await readEvery<{ kind: string; status: string; run_after: string | null }>((from, to) =>
    db
      .from("eng_jobs")
      .select("kind, status, run_after")
      .in("status", ["pending", "running", "dead"])
      .order("created_at", { ascending: true })
      .range(from, to),
  );

  /*
   * A failed read is null, not an empty queue. A status screen that reports
   * zero because it could not look is the exact shape of defect this section
   * exists to remove.
   */
  if (!read.ok) return null;

  const rows = read.rows;
  const now = Date.now();
  const eligible = rows.filter(
    (r) => r.status === "pending" && Date.parse(r.run_after as string) <= now,
  );

  const oldest = eligible.reduce<number | null>((acc, r) => {
    const age = Math.floor((now - Date.parse(r.run_after as string)) / 1000);
    return acc === null || age > acc ? age : acc;
  }, null);

  const kinds = new Map<string, { pending: number; dead: number }>();
  for (const r of rows) {
    const k = r.kind as string;
    const entry = kinds.get(k) ?? { pending: 0, dead: 0 };
    if (r.status === "pending") entry.pending += 1;
    if (r.status === "dead") entry.dead += 1;
    kinds.set(k, entry);
  }

  return {
    pending: rows.filter((r) => r.status === "pending").length,
    running: rows.filter((r) => r.status === "running").length,
    dead: rows.filter((r) => r.status === "dead").length,
    overdue: eligible.length,
    oldestWaitingSeconds: oldest,
    byKind: [...kinds.entries()]
      .map(([kind, v]) => ({ kind, ...v }))
      .sort((a, b) => b.dead - a.dead || b.pending - a.pending),
  };
}

/** The dead letter contents, for the screen that makes a failure visible. */
export async function deadLetters(limit = 50) {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from("eng_jobs")
    .select("id, kind, payload, attempts, max_attempts, last_error, created_at, finished_at")
    .eq("status", "dead")
    .order("finished_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/**
 * Put a dead job back, by hand.
 *
 * Attempts are reset, because an operator retrying a job has usually fixed
 * whatever killed it and does not want it dying again on the next failure. The
 * error is kept rather than cleared: the history of why it died is worth more
 * than a tidy row.
 */
export async function retryDeadJob(
  id: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The job system is not configured." };

  const { data } = await db
    .from("eng_jobs")
    .update({
      status: "pending",
      attempts: 0,
      /*
       * DB_NOW, AND HERE THE PROCESS CLOCK HAD A SYMPTOM RATHER THAN A RISK.
       *
       * eng_claim_jobs compares run_after against the DATABASE's clock. This
       * machine is 85 seconds ahead of it, so a job retried "now" was written
       * with a run_after 85 seconds in the database's future and sat
       * unclaimable for that long. The column does not end in _at, which is the
       * other reason the src sweep never saw it.
       */
      run_after: DB_NOW,
      finished_at: null,
      leased_until: null,
      leased_by: null,
    })
    .eq("id", id)
    .eq("status", "dead")
    .select("id");

  if (!data || data.length === 0) {
    return { ok: false, error: "That job is not in the dead letter queue." };
  }
  return { ok: true };
}

// -------------------------------------------------------------- outbound mail

/**
 * Put an already rendered email on the queue.
 *
 * WHY THE RENDERED MESSAGE TRAVELS, NOT A TEMPLATE NAME AND ARGUMENTS
 * -------------------------------------------------------------------
 * The copy a person was sent has to be the copy that was composed at the time.
 * Re-rendering at send time would email today's template for something decided
 * last week, and this firm already keeps what was actually shown to a customer
 * at checkout for the same reason.
 *
 * WHY THE RECIPIENT IS RESOLVED HERE
 * ----------------------------------
 * notify() falls back to the operator's address when a template carries no `to`,
 * and most operator notifications carry none. Enqueuing that undefined would
 * dead letter every one of them on "an email job needs a recipient", which is a
 * queue full of mail that was correct. The default is applied at the point the
 * job is written, so the payload always names the actual recipient and the
 * idempotency key is computed over it.
 */
export async function queueEmail(
  email: RenderedEmail,
  /**
   * The order this message is about, when it is about one.
   *
   * Carried so the handler can write the ACCEPTANCE back to that order's
   * timeline, with the provider's message id, at the only moment anybody knows
   * it left. Enqueuing is not sending: a queued email may sit, retry, or dead
   * letter, and a timeline that recorded contact at enqueue time would be
   * claiming something that had not happened yet.
   *
   * Absent for every operator alert, which is about the machine and has no
   * order to write to.
   */
  about?: { orderId: string },
  /**
   * THE MODE THE JOB THAT ASKED FOR THIS WAS RUNNING IN.
   *
   * A handler running under no_external_effect that enqueues an email without
   * saying so has spawned a live send from a suppressed job, and the
   * suppression has leaked in the one direction that matters. errors.alert is
   * the handler this exists for: it sends nothing itself and queues an
   * email.send, so `reachesOutside: false` is true of it and would have been
   * exactly the wrong thing to rely on.
   *
   * queue-audit asserts every handler that enqueues passes its own job's mode
   * through, because this is an argument somebody can forget to write.
   */
  effectMode?: EffectMode,
): Promise<EnqueueResult> {
  /*
   * THE ACTOR DECIDES, AND NOBODY HAS TO REMEMBER TO SAY SO.
   *
   * Operator ruling: work enqueued by a board fixture or a demo actor is
   * suppressed at creation, because the actor is not real.
   *
   * Read off the message's own ADDRESS fields rather than passed in by each
   * caller, because a rule each caller has to remember is a rule that has
   * now been forgotten twice, at a cost of 55 emails in one day. `to` is who
   * receives it and `replyTo` is who an operator template is ABOUT: every
   * operator notification composes with the enquirer's address there, which
   * is what makes the eighteen that reached a real inbox about a person who
   * does not exist catchable at all.
   *
   * An explicit mode from the caller still wins. queue-audit passes
   * no_external_effect for its probes and must keep getting it.
   */
  const derived = effectMode ?? effectModeFor(email.to ?? null, email.replyTo ?? null);

  return enqueue(
    "email.send",
    {
      id: email.id,
      purpose: email.purpose,
      to: email.to ?? business.notificationEmail,
      subject: email.subject,
      from: email.from,
      replyTo: email.replyTo ?? null,
      text: email.text,
      html: email.html ?? "",
      orderId: about?.orderId ?? null,
    },
    derived !== "live" ? { effectMode: derived } : {},
  );
}
