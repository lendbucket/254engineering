import "server-only";
import { supabaseAdmin } from "./supabase";
import { LEASE_SECONDS, BATCH_SIZE, nextState, type JobOutcome } from "./job-rules";
import { business } from "@/config/business";
import type { RenderedEmail } from "./email-templates";

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
  | "orders.reconcile";

export type JobPayload = Record<string, unknown>;

export type JobRecord = {
  id: number;
  kind: string;
  payload: JobPayload;
  attempts: number;
  maxAttempts: number;
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
  options: { runAfter?: Date; maxAttempts?: number } = {},
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
    const { data: live } = await db
      .from("eng_jobs")
      .select("id")
      .eq("kind", kind)
      .eq("idempotency_key", key)
      .in("status", ["pending", "running"])
      .maybeSingle();

    if (live) return { ok: true, id: live.id as number, duplicate: true };
  }

  const { data, error } = await db
    .from("eng_jobs")
    .insert({
      kind,
      payload,
      idempotency_key: key,
      run_after: (options.runAfter ?? new Date()).toISOString(),
      ...(options.maxAttempts ? { max_attempts: options.maxAttempts } : {}),
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
        finished_at: next.finished ? new Date().toISOString() : null,
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

  const { data, error } = await db
    .from("eng_jobs")
    .select("kind, status, run_after")
    .in("status", ["pending", "running", "dead"]);

  /*
   * A failed read is null, not an empty queue. A status screen that reports
   * zero because it could not look is the exact shape of defect this section
   * exists to remove.
   */
  if (error) return null;

  const rows = data ?? [];
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
      run_after: new Date().toISOString(),
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
export async function queueEmail(email: RenderedEmail): Promise<EnqueueResult> {
  return enqueue("email.send", {
    id: email.id,
    purpose: email.purpose,
    to: email.to ?? business.notificationEmail,
    subject: email.subject,
    from: email.from,
    replyTo: email.replyTo ?? null,
    text: email.text,
    html: email.html ?? "",
  });
}
