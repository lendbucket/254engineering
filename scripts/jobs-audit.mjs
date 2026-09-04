/**
 * The job queue, and the one rule that governs it.
 *
 *   npx tsx --conditions=react-server scripts/jobs-audit.mjs
 *
 * A JOB THAT DID NOT RUN MUST BE VISIBLE
 * --------------------------------------
 * Every check below traces back to that. A queue is the easiest place in a
 * platform to build a silent failure, because the whole point of it is that
 * nobody is watching when the work happens. The three ways it goes quiet are:
 *
 *   1. The work is never enqueued, and the request that should have queued it
 *      returns 200 anyway.
 *   2. The work is claimed and lost, because a worker died holding it and the
 *      row still says running.
 *   3. The work fails forever, retrying on a schedule nobody reads, or it is
 *      deleted on failure so there is nothing left to find.
 *
 * MANDATORY IDEMPOTENCY IS THE HEADLINE CHECK
 * -------------------------------------------
 * A lease expires, so a job CAN run twice. Every registered kind therefore has
 * to say how it survives that: a key that dedupes the enqueue, or the literal
 * "naturally" with a sentence giving the reason. This audit fails the build on
 * a kind that carries neither, and on a "naturally" with no reason, because an
 * assertion nobody had to justify is an assertion nobody checked.
 *
 * It is pure. No server, no database, no network, so it runs in phase zero. It
 * needs --conditions=react-server because it imports the queue itself, which is
 * marked server-only.
 */

import { readFileSync, existsSync } from "node:fs";
import { registeredKinds, handlerFor, loadHandlers } from "../src/lib/ops-jobs.ts";
import {
  backoffMs,
  nextState,
  isClaimable,
  BASE_DELAY_MS,
  MAX_DELAY_MS,
  LEASE_SECONDS,
  BATCH_SIZE,
} from "../src/lib/job-rules.ts";

/**
 * Source with comments removed.
 *
 * Carried over from accounts-audit, where three checks passed against the very
 * comments explaining why the code does NOT do the thing being checked for. A
 * check that reads prose is a check looking at the wrong thing, and this file
 * is thick with prose.
 */
function codeOnly(path) {
  const withoutBlocks = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlocks
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

/**
 * SQL with its comments and its COMMENT ON prose removed.
 *
 * Written after an injection got past this audit. Deleting SKIP LOCKED from the
 * claim left the audit green, because the migration explains FOR UPDATE SKIP
 * LOCKED in a block comment and again in a COMMENT ON string, and the check was
 * reading those. Three sentences describing a mechanism satisfied a check meant
 * to prove the mechanism was present.
 */
function sqlCode(path) {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n")
    .replace(/comment on [\s\S]*?';/gi, "")
    .toLowerCase();
}

/**
 * One statement, so a check cannot be satisfied by a different statement.
 *
 * A dollar quoted function body runs past several semicolons, so it ends at
 * $; instead. Deciding which by looking for " as $" ahead of the first
 * semicolon, because the version that always preferred $; swallowed everything
 * between an index and the function below it, and an injection that broke the
 * index was answered by a matching line inside that function.
 */
function sqlStatement(sql, startsWith) {
  const start = sql.indexOf(startsWith);
  if (start === -1) return "";
  const rest = sql.slice(start);
  const semi = rest.indexOf(";");
  const dollarQuoted = semi !== -1 && / as \$/.test(rest.slice(0, semi));
  if (!dollarQuoted) return semi === -1 ? rest : rest.slice(0, semi + 1);
  const end = rest.indexOf("$;");
  return end === -1 ? rest : rest.slice(0, end + 2);
}

/** One function's body, so a check cannot be satisfied by a different function. */
function functionBody(source, declaration) {
  const start = source.indexOf(declaration);
  if (start === -1) return "";
  const rest = source.slice(start + declaration.length);
  const nextTop = rest.search(/\n(export (async )?function|export const|function |registerJob\()/);
  return nextTop === -1 ? rest : rest.slice(0, nextTop);
}

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

await loadHandlers();

// =========================================================================
// 1. EVERY REGISTERED KIND DECLARES HOW IT SURVIVES RUNNING TWICE
// =========================================================================

const kinds = registeredKinds();
rec("there are registered job kinds", kinds.length > 0, `${kinds.length}`);

/**
 * Two payloads that differ in every field any handler keys on.
 *
 * Kept as one object rather than per kind so that adding a job kind whose key
 * reads a NEW field fails this audit loudly: the two probes would produce the
 * same string and the "keys different work differently" check goes red, which
 * is the correct outcome for a key nobody has thought about.
 */
const PROBE_A = {
  id: "a",
  to: "a@example.com",
  subject: "Subject A",
  text: "body one",
  notificationId: 1,
  evidenceItemId: "evidence-a",
  fileId: "file-a",
  requestedFor: "2026-09-04",
  statementId: "statement-a",
};
const PROBE_B = {
  id: "b",
  to: "b@example.com",
  subject: "Subject B",
  text: "body two",
  notificationId: 2,
  evidenceItemId: "evidence-b",
  fileId: "file-b",
  requestedFor: "2026-09-05",
  statementId: "statement-b",
};

/*
 * The registry has to be populated without anybody importing job-handlers for
 * its side effect. loadHandlers above is the only thing this file did, so a
 * non empty registry here IS the proof that the mechanism works.
 */
rec(
  "loadHandlers populates the registry on its own",
  kinds.length >= 6,
  "no side effect import was written by this audit",
);

for (const kind of kinds) {
  const handler = handlerFor(kind);
  const declared =
    typeof handler?.idempotency === "function" || handler?.idempotency === "naturally";
  rec(`${kind} declares its idempotency`, declared);

  if (handler?.idempotency === "naturally") {
    const why = typeof handler.why === "string" ? handler.why.trim() : "";
    rec(
      `${kind} says WHY it is naturally idempotent`,
      why.length > 40,
      why ? `${why.length} characters` : "no reason given",
    );
  }

  if (typeof handler?.idempotency === "function") {
    /*
     * A key function that returns the same string for different work would
     * dedupe unrelated jobs into one, which is worse than no key at all: the
     * second piece of work is silently discarded and nobody is told.
     *
     * The two probes below differ in EVERY field any handler reads. The first
     * version of this check varied four fields and passed only for email.send,
     * failing the other four kinds for a reason that was entirely the check's:
     * it fed them a payload identical in every value they key on. That is the
     * defect class this repository hunts, appearing in the audit written to
     * hunt it, so the probe is now built from the union of the fields rather
     * than from whichever ones came to mind.
     */
    const a = handler.idempotency(PROBE_A);
    const b = handler.idempotency(PROBE_B);
    rec(`${kind} keys different work differently`, a !== b, `${a} vs ${b}`);
    rec(`${kind} keys the same work identically`, a === handler.idempotency({ ...PROBE_A }));
    rec(
      `${kind} produces a bounded key`,
      typeof a === "string" && a.length > 0 && a.length <= 64,
      `${a.length} characters`,
    );
  }
}

/*
 * The registry and the type union must not drift. A kind in the union with no
 * registration is a kind whose enqueue is refused at runtime while the code
 * that calls it compiles, which is the exact shape of a silent failure.
 */
const jobsSource = codeOnly("src/lib/ops-jobs.ts");
const unionBlock = jobsSource.slice(
  jobsSource.indexOf("export type JobKind"),
  jobsSource.indexOf(";", jobsSource.indexOf("export type JobKind")),
);
const declaredKinds = [...unionBlock.matchAll(/"([a-z.]+)"/g)].map((m) => m[1]);
rec(
  "every kind in the JobKind union is registered",
  declaredKinds.every((k) => kinds.includes(k)),
  declaredKinds.filter((k) => !kinds.includes(k)).join(", ") || "all registered",
);
rec(
  "and every registered kind is in the union",
  kinds.every((k) => declaredKinds.includes(k)),
  kinds.filter((k) => !declaredKinds.includes(k)).join(", ") || "no strays",
);

// =========================================================================
// 2. RETRIES GROW, ARE CAPPED, AND END SOMEWHERE VISIBLE
// =========================================================================

{
  // Jitter is full range, so the ceiling is what grows, not every sample.
  const ceiling = (attempts) => backoffMs(attempts, () => 0.999999);
  const growing = [1, 2, 3, 4].every((n) => ceiling(n + 1) > ceiling(n));
  rec("the backoff ceiling grows with each attempt", growing, `${ceiling(1)}ms then ${ceiling(5)}ms`);

  /*
   * Compared against a literal hour, not against MAX_DELAY_MS.
   *
   * The first version of this check read `ceiling(50) <= MAX_DELAY_MS`, which
   * is the constant checking itself: raising the cap to two days raised the
   * bound with it and the check stayed green. An injection setting the cap to
   * 48 hours walked straight past it. A budget has to be a figure somebody
   * wrote down, or it is not a budget.
   */
  const ONE_HOUR_MS = 60 * 60 * 1000;
  rec(
    "and is capped at an hour",
    ceiling(50) <= ONE_HOUR_MS && MAX_DELAY_MS <= ONE_HOUR_MS,
    `${ceiling(50)}ms, cap ${MAX_DELAY_MS}ms`,
  );

  /*
   * The floor. Without it, a random() near zero makes the first retry
   * effectively immediate and burns an attempt against a provider that has had
   * no time to recover.
   */
  rec(
    "and never retries immediately, however the jitter falls",
    [1, 2, 3, 4, 5].every((n) => backoffMs(n, () => 0) >= BASE_DELAY_MS / 2),
    `floor is ${BASE_DELAY_MS / 2}ms`,
  );

  /*
   * Jitter is not decoration. Ten jobs failing together must not retry in the
   * same second. Sampled with a real random source; identical values across
   * twenty draws would mean the jitter is not wired.
   */
  const draws = new Set(Array.from({ length: 20 }, () => backoffMs(3)));
  rec("and is jittered rather than fixed", draws.size > 1, `${draws.size} distinct values in 20`);

  /*
   * Five attempts at the capped delay must still land inside an afternoon. This
   * is the check that would notice a cap raised alongside a max_attempts raise,
   * where each figure looks defensible and the pair does not.
   */
  rec(
    "and five capped attempts still fit inside a working day",
    5 * MAX_DELAY_MS <= 8 * ONE_HOUR_MS,
    `${(5 * MAX_DELAY_MS) / ONE_HOUR_MS} hours worst case`,
  );
}

// =========================================================================
// 3. A FAILED JOB ENDS AS A ROW SOMEBODY CAN SEE
// =========================================================================

{
  const job = { attempts: 1, maxAttempts: 5 };

  rec("a success is done", nextState(job, { kind: "done" }, 0).status === "done");

  const retried = nextState(job, { kind: "retry", error: "provider timeout" }, 0);
  rec("a failure with attempts left is pending", retried.status === "pending");
  rec("and is scheduled into the future", retried.runAfterMs > 0, `${retried.runAfterMs}ms`);
  rec("and keeps the error", retried.lastError === "provider timeout");
  rec("and is not marked finished", retried.finished === false);

  const exhausted = nextState({ attempts: 5, maxAttempts: 5 }, { kind: "retry", error: "still down" }, 0);
  rec("an exhausted job is dead, not deleted", exhausted.status === "dead");
  rec("and says what it died of", /still down/.test(exhausted.lastError ?? ""));
  rec("and says it gave up", /gave up after 5 attempts/.test(exhausted.lastError ?? ""));

  /*
   * Fatal skips the retries. Five identical failures spread over an hour only
   * delay the moment an operator sees a queue that needs a person.
   */
  const fatal = nextState({ attempts: 1, maxAttempts: 5 }, { kind: "fatal", error: "no such file" }, 0);
  rec("a fatal failure goes straight to dead", fatal.status === "dead");
  rec("and does not wait out four more attempts", fatal.finished === true);

  /*
   * The state machine must have no path that ends in a row nobody sees. There
   * are exactly four statuses and every outcome lands on one of them.
   */
  const reachable = new Set([
    nextState(job, { kind: "done" }, 0).status,
    nextState(job, { kind: "retry", error: "x" }, 0).status,
    nextState(job, { kind: "fatal", error: "x" }, 0).status,
    nextState({ attempts: 9, maxAttempts: 9 }, { kind: "retry", error: "x" }, 0).status,
  ]);
  rec(
    "no outcome removes the row",
    [...reachable].every((s) => ["pending", "done", "dead"].includes(s)),
    [...reachable].join(", "),
  );
}

// =========================================================================
// 4. THE LEASE IS THE AUTHORITY, NOT THE STATUS
// =========================================================================

{
  const NOW = 1_000_000;

  rec(
    "a pending job whose time has come is claimable",
    isClaimable({ status: "pending", runAfterMs: NOW - 1, leasedUntilMs: null }, NOW),
  );
  rec(
    "a pending job scheduled for later is not",
    !isClaimable({ status: "pending", runAfterMs: NOW + 60_000, leasedUntilMs: null }, NOW),
  );
  rec(
    "a running job with a live lease is not",
    !isClaimable({ status: "running", runAfterMs: NOW - 1, leasedUntilMs: NOW + 30_000 }, NOW),
  );

  /*
   * THE CHECK THIS WHOLE SECTION TURNS ON.
   *
   * A worker killed mid job leaves a row saying running forever. If the status
   * were the authority that job is lost in silence, which is failure mode two
   * in the header. The lease lapsing is what brings it back.
   */
  rec(
    "a running job whose lease lapsed IS claimable again",
    isClaimable({ status: "running", runAfterMs: NOW - 1, leasedUntilMs: NOW - 1 }, NOW),
    "this is what makes a killed worker recoverable",
  );

  rec(
    "a done job is never claimable",
    !isClaimable({ status: "done", runAfterMs: 0, leasedUntilMs: null }, NOW),
  );
  rec(
    "and a dead job is never reclaimed automatically",
    !isClaimable({ status: "dead", runAfterMs: 0, leasedUntilMs: null }, NOW),
    "only a person puts a dead job back",
  );
}

// =========================================================================
// 5. THE CLAIM IS ATOMIC, IN SQL, AND CANNOT BE ASSEMBLED IN JAVASCRIPT
// =========================================================================

{
  const migration = "supabase/migrations/0011_job_queue.sql";
  rec("the queue migration exists", existsSync(migration));

  /*
   * Comments stripped, and every check below scoped to ONE statement. Both are
   * the result of an injection getting through: the migration explains its own
   * mechanisms in prose, and the phrase "status in ('pending', 'running')"
   * appears in three unrelated statements, so an unscoped check proved nothing
   * about the one it named.
   */
  const sql = sqlCode(migration);
  const claim = sqlStatement(sql, "create or replace function eng_claim_jobs");
  const index = sqlStatement(sql, "create unique index");

  rec("the claim is one SQL function", claim.length > 0);
  rec(
    "claiming uses FOR UPDATE SKIP LOCKED",
    /for update skip locked/.test(claim),
    "two workers take different rows rather than the same row",
  );
  rec("and the claim function pins its search_path", /set search_path = ''/.test(claim));
  rec("and it takes a bounded batch", /limit batch_size/.test(claim));
  rec(
    "and it reclaims rows whose lease lapsed",
    /status = 'running' and c\.leased_until < /.test(claim),
  );
  rec("and it counts the attempt as it claims", /attempts = j\.attempts \+ 1/.test(claim));

  /*
   * The partial unique index is the backstop under the enqueue check. Without
   * it, two requests racing between the check and the insert both write a row
   * and the work happens twice.
   */
  rec("the idempotency index exists and is unique", /eng_jobs_idempotency/.test(index));
  rec("and it is partial on the key", /where idempotency_key is not null/.test(index));
  rec(
    "and it only covers live jobs",
    /status in \('pending', ?'running'\)/.test(index),
    "a finished job must not block the same work being queued again later",
  );

  rec(
    "row level security is on for eng_jobs",
    /alter table (public\.)?eng_jobs enable row level security/.test(sql),
  );

  // The claim cannot be reassembled in the client, where it would not be atomic.
  const jobsCode = codeOnly("src/lib/ops-jobs.ts");
  rec(
    "the worker claims through the function rather than a select then update",
    /rpc\("eng_claim_jobs"/.test(jobsCode),
  );
  rec(
    "and does not select then update in JavaScript",
    !/from\("eng_jobs"\)[\s\S]{0,200}\.eq\("status", "pending"\)[\s\S]{0,200}update/.test(jobsCode),
  );
}

// =========================================================================
// 6. THE WORKER CANNOT LOSE A BATCH, AND SAYS WHAT IT DID
// =========================================================================

{
  const jobsCode = codeOnly("src/lib/ops-jobs.ts");

  const runOne = functionBody(jobsCode, "async function runOne(");
  rec(
    "a handler that throws becomes a retry rather than killing the batch",
    /try {/.test(runOne) && /catch/.test(runOne) && /kind: "retry"/.test(runOne),
    "without this, one bad handler leaves nine other jobs leased and unfinished",
  );

  const runBatch = functionBody(jobsCode, "export async function runBatch(");
  rec(
    "the lease is released on every path",
    /leased_until: null/.test(runBatch) && /leased_by: null/.test(runBatch),
    "a retry must be claimable at its run_after, not when a lease nobody holds expires",
  );
  rec(
    "an unregistered kind is fatal rather than retried five times",
    /No handler is registered/.test(runBatch),
  );
  rec("a dead job is logged as an error", /console\.error\([\s\S]{0,40}DEAD/.test(runBatch));

  rec(
    "the batch is bounded",
    /batch_size: BATCH_SIZE/.test(runBatch),
    `${BATCH_SIZE} per invocation`,
  );
  rec(
    "and the lease is shorter than a Vercel function timeout",
    LEASE_SECONDS < 300,
    `${LEASE_SECONDS}s`,
  );
  rec(
    "and long enough that a slow healthy job is not claimed twice",
    LEASE_SECONDS >= 60,
    `${LEASE_SECONDS}s`,
  );

  const enqueue = functionBody(jobsCode, "export async function enqueue(");
  rec(
    "enqueue refuses a kind with no handler",
    /No handler is registered/.test(enqueue),
    "refused at the enqueue rather than dead lettered later",
  );
  rec(
    "enqueue loads the registry itself",
    /await loadHandlers\(\)/.test(enqueue),
    "so no caller has to remember a side effect import",
  );
  rec("runBatch loads the registry itself", /await loadHandlers\(\)/.test(runBatch));
  rec(
    "enqueue does not upsert against the partial index",
    !/onConflict/.test(enqueue),
    "Postgres cannot infer a partial index for ON CONFLICT, so an upsert would silently do nothing",
  );
  rec(
    "and a lost race is treated as already queued rather than an error",
    /23505/.test(enqueue),
  );
  rec(
    "enqueue never throws",
    !/throw /.test(enqueue),
    "a queue that is unreachable must not turn a successful request into a failed one",
  );

  /*
   * The most important line in the file for this rule. A failed read is null,
   * not zero. A status screen reporting an empty queue because it could not
   * look is exactly failure mode three.
   */
  const health = functionBody(jobsCode, "export async function queueHealth(");
  rec(
    "queueHealth returns null on a failed read rather than zeros",
    /if \(error\) return null;/.test(health),
    "an unreadable queue is not a quiet one",
  );

  const retry = functionBody(jobsCode, "export async function retryDeadJob(");
  rec("a hand retry only touches dead jobs", /\.eq\("status", "dead"\)/.test(retry));
  rec("and resets the attempts", /attempts: 0/.test(retry));
  rec(
    "and refuses rather than silently doing nothing",
    /not in the dead letter queue/.test(retry),
  );
  rec(
    "and does not clear the error it died of",
    !/last_error: null/.test(retry),
    "why it died is worth more than a tidy row",
  );
}

// =========================================================================
// 7. NOTHING DEPENDS ON A BARE SIDE EFFECT IMPORT
// =========================================================================

{
  /*
   * An import with no referenced symbol is the line a tidy up deletes, and the
   * failure it produces here is total: an empty registry refuses every enqueue
   * and dead letters every claimed job. loadHandlers removed the need for it,
   * so the pattern is banned outright rather than tolerated and asserted.
   */
  const callers = [
    "src/app/api/cron/jobs/route.ts",
    "src/app/portal/(app)/queue/page.tsx",
    "src/app/api/portal/queue/route.ts",
  ];
  for (const path of callers) {
    rec(
      `${path.split("/").slice(-2).join("/")} does not rely on a bare handlers import`,
      !/^import "@\/lib\/job-handlers";$/m.test(codeOnly(path)),
    );
  }
}

// =========================================================================
// 8. WHAT WAS SUPPOSED TO MOVE ONTO THE QUEUE ACTUALLY DID
// =========================================================================

{
  /*
   * The section is only worth anything if the slow work actually left the
   * request. Each of these is a named surface from the ruling, checked at the
   * call site rather than by trusting that a handler exists for it.
   */
  const moved = [
    ["src/lib/ops-notify.ts", /enqueue\("notification\.deliver"/, "the notification email"],
    ["src/app/api/lead/route.ts", /queueEmail\(/, "the lead notification"],
    ["src/app/api/apply/route.ts", /queueEmail\(/, "the application emails"],
    ["src/app/api/onboarding/route.ts", /queueEmail\(/, "the onboarding submission email"],
    ["src/app/api/admin/onboarding/route.ts", /queueEmail\(/, "the onboarding invite"],
    ["src/app/api/portal/people/route.ts", /queueEmail\(/, "the portal invite and reset links"],
    ["src/app/api/portal/accounts/route.ts", /enqueue\("statement\.issue"/, "statement issuance"],
    ["src/app/api/portal/orders/reconcile/route.ts", /enqueue\("orders\.reconcile"/, "the applying sweep"],
    ["src/app/api/portal/exports/route.ts", /enqueue\("document\.binder"/, "the binder record"],
  ];

  for (const [path, pattern, what] of moved) {
    rec(`${what} is queued`, pattern.test(codeOnly(path)), path);
  }

  /*
   * And the mail those routes no longer send directly. A route that queues an
   * email AND still calls notify is a route sending it twice.
   */
  for (const [path, , what] of moved.filter(([, p]) => String(p).includes("queueEmail"))) {
    rec(
      `${what}: nothing sends directly as well`,
      !/await notify\(/.test(codeOnly(path)),
      path,
    );
  }

  /*
   * THE ONE EXCEPTION, AND IT IS LOAD BEARING.
   *
   * The outage alert does not go on the queue, because the queue lives in the
   * database being watched. Routed through it, the alert could not leave during
   * precisely the outage it exists to report, and the symptom would be silence.
   * Asserted so a later pass tidying "the last unqueued send" cannot remove it.
   */
  const watcher = codeOnly("src/app/api/cron/health-watch/route.ts");
  rec(
    "the outage alert still sends directly, not through the queue",
    /await notify\(/.test(watcher) && !/queueEmail\(|enqueue\(/.test(watcher),
    "an alert that needs the database to report the database being down is no alert",
  );
  /*
   * Whitespace collapsed before matching, because the sentence is wrapped
   * across two comment lines and a check that only matches the unwrapped form
   * would fail on a reflow rather than on the reason going missing.
   */
  rec(
    "and the reason is written down beside it",
    /queue lives in the database being watched/.test(
      readFileSync("src/app/api/cron/health-watch/route.ts", "utf8").replace(/\s*\n\s*\*\s*/g, " "),
    ),
  );

  /*
   * The binder DOWNLOAD must not be queued. A queued CSV is a CSV nobody
   * receives, and the person clicking it is the definition of somebody waiting.
   */
  const exports = codeOnly("src/app/api/portal/exports/route.ts");
  rec(
    "the binder download itself is still assembled in the request",
    /binderCsv\(binder\)/.test(exports) && /await binderFor\(/.test(exports),
    "the person clicked a download; queueing it would send them nothing",
  );

  /*
   * Closing a period stays synchronous. The line count and the total are the
   * whole reason close and issue are two actions, and an operator who cannot
   * read the close cannot decide whether to issue.
   */
  const accounts = codeOnly("src/app/api/portal/accounts/route.ts");
  rec(
    "closing a period is still synchronous",
    /await closePeriod\(/.test(accounts),
    "the operator reads the result before deciding to issue",
  );
  rec(
    "issuing checks eligibility before it queues",
    /await issuableStatement\(/.test(accounts),
    "so an already issued statement is refused at the button, not in a dead letter",
  );
  rec(
    "and the check is the same one the job runs",
    /issuableStatement\(/.test(codeOnly("src/lib/ops-statements.ts")),
    "two copies of it would drift",
  );

  /*
   * The read only reconciliation sweep IS the report the operator asked for.
   * Queueing it would be queueing the answer to the question.
   */
  const reconcile = codeOnly("src/app/api/portal/orders/reconcile/route.ts");
  rec(
    "the read only sweep still answers in the request",
    /await reconcileAll\(\{ apply: false/.test(reconcile),
  );
  rec(
    "and the applying sweep is audited when it is asked for",
    /orders\.reconcile_applied/.test(reconcile) && /writeAudit\(/.test(reconcile),
    "the job has no actor, so the person who asked is recorded at the ask",
  );

  /*
   * A queued email must carry a recipient. notify() defaults an absent `to` to
   * the operator, and enqueuing that undefined would dead letter every operator
   * notification on "an email job needs a recipient", for mail that was correct.
   */
  const queueEmail = functionBody(codeOnly("src/lib/ops-jobs.ts"), "export async function queueEmail(");
  rec(
    "queueEmail resolves the recipient before the job is written",
    /business\.notificationEmail/.test(queueEmail),
    "an absent recipient would otherwise dead letter every operator notification",
  );
  rec(
    "and carries the rendered copy rather than a template name",
    /text: email\.text/.test(queueEmail) && /html: email\.html/.test(queueEmail),
    "what a person was sent must be what was composed at the time",
  );

  /*
   * ops-notify writes the ROW synchronously. The bell has to be right the
   * moment the request returns; only the email leaves.
   */
  const notifySource = codeOnly("src/lib/ops-notify.ts");
  rec(
    "a notification row is still written in the request",
    /\.from\("eng_notifications"\)[\s\S]{0,120}\.insert\(/.test(notifySource),
    "the bell must be correct before the page renders",
  );
  rec(
    "and a failed enqueue is recorded on the row rather than lost",
    /email_error: `The email could not be queued/.test(notifySource),
  );
}

// =========================================================================
// 9. THE OPERATOR CAN SEE IT, AND ONLY THE OPERATOR
// =========================================================================

{
  const page = codeOnly("src/app/portal/(app)/queue/page.tsx");
  rec("there is a queue screen", existsSync("src/app/portal/(app)/queue/page.tsx"));
  rec("it is behind jobs.manage", /can\(actor, "jobs\.manage"\)/.test(page));
  rec("and 404s rather than explaining itself", /notFound\(\)/.test(page));

  rec("it shows the depth", /health\.pending/.test(page));
  rec("and how long the oldest job has waited", /oldestWaitingSeconds/.test(page));
  rec("and the dead letter count", /health\.dead/.test(page));
  rec("and the dead letter contents", /deadLetters\(\)/.test(page));

  /*
   * The check this screen exists for. An unreadable queue renders as a failure,
   * not as zeros.
   */
  rec(
    "an unreadable queue renders as a failure rather than an empty one",
    /health === null \?/.test(page) && /ErrorState/.test(page),
    "0 waiting because it could not look is the defect this section removes",
  );

  const client = codeOnly("src/app/portal/(app)/queue/QueueClient.tsx");
  rec("a dead job can be retried by hand", /action: "retry"/.test(client));
  rec("and the error is shown in full", /j\.lastError/.test(client) && !/slice\(0, ?\d+\)/.test(client));

  const api = codeOnly("src/app/api/portal/queue/route.ts");
  rec("the retry endpoint checks the permission", /can\(actor, "jobs\.manage"\)/.test(api));
  rec("and is audited", /writeAudit\(/.test(api) && /jobs\.retried/.test(api));
  rec("and has no GET", !/export async function GET/.test(api));

  const authz = readFileSync("src/lib/ops-authz.ts", "utf8");
  rec("jobs.manage is a real permission", /"jobs\.manage"/.test(authz));

  /*
   * The worker route. It sends nothing and claims nothing without the secret,
   * and it logs the depth beside the batch so an empty run and a broken worker
   * do not look alike.
   */
  const cron = codeOnly("src/app/api/cron/jobs/route.ts");
  rec("the worker needs CRON_SECRET", /process\.env\.CRON_SECRET/.test(cron));
  rec("and answers 404 without it", /status: 404/.test(cron));
  rec("and compares it in constant time", /timingSafeEqual/.test(cron));
  rec(
    "and logs the queue depth beside what it claimed",
    /claimed \$\{report\.claimed\}/.test(cron) && /health\.pending/.test(cron),
    "0 claimed with 0 pending is a quiet queue; 0 claimed with 40 pending is a broken worker",
  );

  const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
  const cronEntry = (vercel.crons ?? []).find((c) => c.path === "/api/cron/jobs");
  rec("the worker is scheduled", Boolean(cronEntry), cronEntry?.schedule ?? "not in vercel.json");
  rec(
    "and often enough that the lease is not the bottleneck",
    cronEntry?.schedule === "* * * * *",
    cronEntry?.schedule ?? "",
  );
}

// =========================================================================

const failed = out.filter((o) => !o.ok);
for (const o of out) console.log(`  ${o.ok ? "PASS" : "FAIL"}: ${o.name}${o.note ? ` (${o.note})` : ""}`);
console.log("");

if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("A job that did not run must be visible. Every red line above is a way for");
  console.log("work to disappear without anybody being told.");
  process.exit(1);
}

console.log(`PASS: ${out.length} checks. Nothing on the queue can fail quietly.`);
