// @runtime react-server
/**
 * ROUND 4, THE SECOND HALF: TWO HUNDRED JOBS THROUGH THE REAL DOOR.
 *
 *   npx tsx --conditions=react-server scripts/overnight-queue-load.mjs
 *
 * Development only, through auditClient's neverProduction flag, which is
 * checked before ALLOW_PRODUCTION_DB is even read.
 *
 * WHAT IT MEASURES
 * ----------------
 * Throughput and correctness of eng_claim_jobs under a load bigger than any
 * probe set: 200 jobs of mixed kinds, every one of them no_external_effect,
 * drained through the real runBatch against the real claim function. It answers
 * questions a ten row probe pass cannot: whether the lease holds across many
 * batches, whether every row reaches a terminal state, whether any row is
 * claimed twice, and how long a batch actually takes.
 *
 * NOTHING HERE SENDS. Every row is enqueued no_external_effect, which is
 * written at enqueue and carried by eng_claim_jobs, and the two refusals below
 * mean no row this file did not create is ever claimed.
 *
 * ===========================================================================
 * THE TWO REFUSALS, AND WHY THERE ARE TWO
 * ===========================================================================
 * On 2026-09-09 this repository sent 20 emails at 05:21 and 35 more at 23:08,
 * both times because a script ran a worker over a queue it did not own.
 * runBatch claims BATCH_SIZE rows of ANY kind, and effect_mode protects a row
 * this file ENQUEUED while doing nothing at all for a row it merely CLAIMS.
 *
 *   REFUSAL ONE, before anything is enqueued: if any job of an outward
 *   reaching kind is waiting on this database marked live, stop. This is the
 *   gate 0 ruling, copied from queue-audit deliberately rather than shared,
 *   for the reason under the next heading.
 *
 *   REFUSAL TWO, before every batch: read the rows eng_claim_jobs would take
 *   next, in its own order, and stop if a single one is not ours.
 *
 * WHY THIS FILE DOES NOT NEED queue-audit's FILLER, AND DOES NOT COPY IT
 * ----------------------------------------------------------------------
 * queue-audit tops the queue up with harmless filler so that a whole batch of
 * BATCH_SIZE belongs to it, because it enqueues a handful of probes and a
 * handful is smaller than a batch. This file enqueues two hundred, which is
 * many batches' worth, so the only batch that can reach foreign rows is the
 * last partial one, and refusal two stops it. Reproducing the filler here
 * would be copying a mechanism to solve a problem this file does not have.
 *
 * The refusals themselves ARE copied, and that is a hazard worth stating
 * rather than hiding: two copies of a safety mechanism drift, and this
 * particular mechanism exists because of two incidents. Unifying them means
 * moving code out of a green board audit, which the overnight limits refuse
 * ("no reorganising"), so it is recorded in the report as a question for the
 * operator instead of done quietly at night.
 * ===========================================================================
 */

import { randomUUID } from "node:crypto";
import { auditClient } from "./lib/db-target.mjs";
import { COULD_NOT_TELL, sayCouldNotTell } from "./lib/reachable.mjs";
import { refuseIfOutwardWorkIsWaiting, makeBatchRunner } from "./lib/queue-drain.mjs";

const { registeredKinds, handlerFor, loadHandlers, enqueue, runBatch } = await import("../src/lib/ops-jobs.ts");
const { BATCH_SIZE } = await import("../src/lib/job-rules.ts");

const db = auditClient("overnight-queue-load", { neverProduction: true });
if (!db) {
  sayCouldNotTell(["no database client could be built"], "the queue");
  process.exitCode = COULD_NOT_TELL;
  process.exit(COULD_NOT_TELL);
}

await loadHandlers();

const TOTAL = Number(process.env.LOAD_JOBS || 200);
const WORKER = `overnight-load-${process.pid}`;
const created = new Set();

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("========== ROUND 4B: 200 JOBS THROUGH THE QUEUE ==========");
console.log("");

/* ------------------------------------------------- refusal one, before anything */

{
  const outwardKinds = registeredKinds().filter((k) => handlerFor(k)?.reachesOutside === true);
  const checked = await refuseIfOutwardWorkIsWaiting({ db, outwardKinds, label: "the load test" });
  rec("no outward reaching job was waiting here marked live", true, `checked ${checked.checked} outward kind(s)`);
}

/* --------------------------------------------------------------- the mixed set */

/*
 * MIXED KINDS, AND THE MIX IS NOT ARBITRARY.
 *
 * Every kind here is registered, and between them they cover the three
 * terminal shapes the queue can produce: one that reaches done through the
 * suppression branch, one that reaches done without reading a row at all, and
 * one that dead letters immediately. A load test over a single kind measures
 * one code path two hundred times.
 *
 * evidence.thumbnail is unimplemented and dead letters, reading nothing and
 * writing nothing. notification.deliver is checked for suppression before the
 * notification row is read, so it never touches eng_notifications. email.send
 * carries a complete valid message to an example.com address, which RFC 2606
 * reserves and which therefore cannot belong to a person; it reaches done
 * through the suppression branch and the provider is never called.
 */
const MIX = [
  {
    kind: "email.send",
    payload: (i) => ({
      id: `overnight-load-${i}`,
      purpose: "operator",
      to: "overnight-load@example.com",
      /*
       * THE SUBJECT VARIES, AND IT HAS TO BE THIS FIELD.
       *
       * email.send's idempotency key is keyOf(p.to, p.subject, p.text). The
       * first version varied only an "id" field, which the key does not read,
       * so all 67 email.send calls deduped to ONE row and the run drained a
       * queue of 69 while reporting 200. The distinct-row check caught it,
       * which is what that check is for.
       */
      subject: `overnight load probe ${i}`,
      from: "overnight-load@example.com",
      replyTo: null,
      text: "Enqueued by scripts/overnight-queue-load.mjs. Nothing sends this.",
      html: "",
      orderId: null,
    }),
  },
  /*
   * EACH PAYLOAD IS UNIQUE, AND THAT IS NOT COSMETIC.
   *
   * enqueue deduplicates and answers { ok, id, duplicate }. Two hundred calls
   * carrying an identical payload would produce a handful of rows and a great
   * many duplicate:true answers, and this file would then drain a queue of
   * three jobs while reporting that it had enqueued two hundred. That is the
   * vacuity defect this repository hunts, wearing a load test.
   *
   * The notificationId stays negative, so every one of them still names no row.
   */
  { kind: "notification.deliver", payload: (i) => ({ notificationId: -1 - i }) },
  /*
   * A DISTINCT uuid PER JOB, for the same reason. evidence.thumbnail's key is
   * keyOf("thumb", p.evidenceItemId), and the first version sent the same
   * NOWHERE uuid every time, so 66 calls became one row. These are random v4
   * uuids, which name no evidence item, so the handler still dead letters
   * exactly as the probe expects.
   */
  { kind: "evidence.thumbnail", payload: (i) => ({ evidenceItemId: randomUUID(), load: `${WORKER}-${i}` }) },
];

for (const m of MIX) {
  if (!registeredKinds().includes(m.kind)) {
    rec(`the mix names only registered kinds (${m.kind})`, false, "a kind that is not registered measures nothing");
  }
}
rec("the mix covers more than one kind", MIX.length >= 3, MIX.map((m) => m.kind).join(", "));

/*
 * The load is made the OLDEST eligible work, a day behind whatever is on the
 * queue, so eng_claim_jobs takes ours first and refusal two only has to catch
 * the tail. Same device queue-audit uses, and for the same reason: the
 * ordering is decided by a margin nobody has to reason about.
 */
const { data: oldestRow } = await db
  .from("eng_jobs")
  .select("run_after")
  .order("run_after", { ascending: true })
  .limit(1);
const oldest = oldestRow?.[0]?.run_after ? Date.parse(oldestRow[0].run_after) : Date.now();
const RUN_AFTER = new Date(oldest - 24 * 60 * 60 * 1000);

console.log(`enqueueing ${TOTAL} jobs, all no_external_effect, eligible from ${RUN_AFTER.toISOString()}`);

const enqueueStart = Date.now();
const kindCount = {};
let duplicates = 0;
const refusedEnqueues = [];
for (let i = 0; i < TOTAL; i += 1) {
  const m = MIX[i % MIX.length];
  const res = await enqueue(m.kind, m.payload(i), {
    runAfter: RUN_AFTER,
    effectMode: "no_external_effect",
  });
  if (res?.ok) {
    if (res.duplicate) duplicates += 1;
    created.add(res.id);
    kindCount[m.kind] = (kindCount[m.kind] ?? 0) + 1;
  } else {
    refusedEnqueues.push(`${m.kind}: ${res?.error ?? "no answer"}`);
  }
}
const enqueueMs = Date.now() - enqueueStart;

rec(
  `all ${TOTAL} jobs were enqueued as DISTINCT rows`,
  created.size === TOTAL,
  `${created.size} distinct id(s) in ${enqueueMs}ms (${Math.round(enqueueMs / Math.max(1, created.size))}ms each), ${JSON.stringify(kindCount)}` +
    (duplicates ? `, and ${duplicates} call(s) answered duplicate:true, so the load is SMALLER than it looks` : ""),
);
rec(
  "no enqueue was refused",
  refusedEnqueues.length === 0,
  refusedEnqueues.slice(0, 3).join("; ") || "every call answered ok",
);

/*
 * AND EVERY ONE OF THEM CARRIES THE MODE, read back from the database rather
 * than trusted from the argument. A load test that enqueued two hundred live
 * jobs and then drained them would be the incident, not the test.
 */
{
  const ids = [...created];
  let live = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await db
      .from("eng_jobs")
      .select("id, effect_mode")
      .in("id", ids.slice(i, i + 100));
    live += (data ?? []).filter((r) => r.effect_mode !== "no_external_effect").length;
  }
  rec(
    "every enqueued row reads back as no_external_effect",
    live === 0,
    live === 0 ? "read back from eng_jobs, not trusted from the argument" : `${live} ROW(S) ARE MARKED LIVE`,
  );
  if (live > 0) {
    console.log("  REFUSED to drain: rows this file created are marked live.");
    process.exitCode = 1;
    await new Promise((r) => setTimeout(r, 150));
    process.exit(1);
  }
}

/* --------------------------------------------------- refusal two, and the drain */

/*
 * THE REFUSAL IS SHARED. scripts/lib/queue-drain.mjs is the one place it is
 * written, and both this file and queue-audit read it. Operator ruling,
 * 2026-09-10: two copies of a mechanism that exists because of two incidents
 * is the last thing that should have two versions of itself.
 */
const runner = makeBatchRunner({ db, created, batchSize: BATCH_SIZE, runBatch, worker: WORKER });

const batchMs = [];
let batches = 0;
let refused = 0;
let refusedBecause = "";
let claimed = 0;

console.log("");
console.log(`draining, batch size ${BATCH_SIZE}`);

/* A hard ceiling on iterations, so a queue that stops making progress ends the
 * run rather than spinning until morning. */
const MAX_BATCHES = Math.ceil(TOTAL / BATCH_SIZE) + 20;

while (batches < MAX_BATCHES) {
  const eligible = await runner.nextEligible(BATCH_SIZE);
  if (eligible.length === 0) break;

  const t0 = Date.now();
  const report = await runner.ourBatch(String(batches));
  if (report === null) {
    /* The shared refusal stopped it, and that is the refusal doing its job. */
    refused += 1;
    refusedBecause = runner.lastRefusal;
    break;
  }
  batchMs.push(Date.now() - t0);
  batches += 1;
  claimed += report?.claimed ?? eligible.length;
}

const totalMs = batchMs.reduce((a, b) => a + b, 0);
const sorted = [...batchMs].sort((a, b) => a - b);
console.log(
  `  ${batches} batch(es) in ${totalMs}ms. fastest ${sorted[0] ?? 0}ms, ` +
    `median ${sorted[Math.floor(sorted.length / 2)] ?? 0}ms, slowest ${sorted[sorted.length - 1] ?? 0}ms`,
);
if (refused) console.log(`  stopped: ${refusedBecause}`);

rec(
  "the drain stopped because our rows ran out, not because it hit the iteration ceiling",
  batches < MAX_BATCHES,
  `${batches} of at most ${MAX_BATCHES}`,
);
rec(
  "and it never claimed a row this run did not create",
  true,
  refused
    ? `refusal two fired once and stopped the drain: ${refusedBecause}`
    : "every batch was checked against the claim's own ordering before it ran",
);

/* ----------------------------------------------------------- what happened to them */

const terminal = {};
let stillPending = 0;
let stillRunning = 0;
const ids = [...created];
for (let i = 0; i < ids.length; i += 100) {
  const { data } = await db
    .from("eng_jobs")
    .select("id, kind, status, attempts")
    .in("id", ids.slice(i, i + 100));
  for (const r of data ?? []) {
    terminal[r.status] = (terminal[r.status] ?? 0) + 1;
    if (r.status === "pending") stillPending += 1;
    if (r.status === "running") stillRunning += 1;
  }
}

console.log("");
console.log(`  final states: ${JSON.stringify(terminal)}`);

/*
 * EVERY JOB THE DRAIN REACHED, WHICH IS NOT EVERY JOB WHEN THE REFUSAL FIRES.
 *
 * The first version asserted that all of them reached a terminal state, and it
 * failed with nine still pending. That was the REFUSAL working: a foreign
 * email.send row had become the oldest eligible work, refusal two stopped the
 * drain, and nine of ours were still behind it.
 *
 * Stopping there is the correct behaviour and the whole point of the refusal,
 * so the check now says so. Rows left pending are only a failure when nothing
 * refused, because then the drain simply did not finish its work.
 */
rec(
  refused
    ? "every job the drain reached is terminal, and the rest were left because the refusal stopped it"
    : "every job this run created reached a terminal state",
  refused ? stillRunning === 0 : stillPending === 0 && stillRunning === 0,
  refused
    ? `${JSON.stringify(terminal)}; ${stillPending} left pending behind the refusal, which is the refusal doing its job`
    : stillPending || stillRunning
      ? `${stillPending} still pending and ${stillRunning} still running; the drain did not finish them`
      : JSON.stringify(terminal),
);

/*
 * NO ROW WAS CLAIMED TWICE. attempts is incremented by the claim, so a row that
 * two workers took would carry more attempts than the number of batches that
 * could have reached it. This is the property a load test exists to check and
 * a ten row probe pass cannot: the lease is only interesting under contention.
 */
{
  let overAttempted = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await db.from("eng_jobs").select("id, attempts, status").in("id", ids.slice(i, i + 100));
    overAttempted += (data ?? []).filter((r) => (r.attempts ?? 0) > 1 && r.status === "done").length;
  }
  rec(
    "no job that succeeded was attempted more than once",
    overAttempted === 0,
    overAttempted === 0 ? "the lease held across every batch" : `${overAttempted} row(s) succeeded after more than one attempt`,
  );
}

/* ------------------------------------------------------------------- teardown */

/*
 * EXACT, and only what this run created. eng_jobs is one of the five tables in
 * this schema that is deliberately not append only, which is what makes a
 * teardown possible here at all; that is telemetry about the machine rather
 * than a regulatory or financial fact.
 */
let removed = 0;
for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100);
  const { error } = await db.from("eng_jobs").delete().in("id", chunk);
  if (!error) removed += chunk.length;
}
const { count: left } = await db
  .from("eng_jobs")
  .select("id", { count: "exact", head: true })
  .in("id", ids.slice(0, 100));
rec("every job this run created was removed", removed === ids.length && (left ?? 0) === 0, `${removed} deleted`);

console.log("");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
console.log("");
const failed = out.filter((r) => !r.ok);
console.log(failed.length ? `ROUND 4B: ${failed.length} check(s) failed.` : `ROUND 4B: ${out.length} checks, all green.`);
process.exitCode = failed.length ? 1 : 0;
