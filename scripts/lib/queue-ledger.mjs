/**
 * =============================================================================
 * AN AUDIT RUN LEAVES THE QUEUE AS IT FOUND IT. Operator ruling, 2026-09-24.
 * =============================================================================
 *
 * WHAT THIS EXISTS BECAUSE OF. Development's job queue reached 1,017 pending
 * and 577 dead rows and nobody had noticed, because nothing looked. It was
 * found sideways: `queue-audit` went red saying the eligible queue was past
 * PostgREST's thousand row ceiling, so the check could no longer read its own
 * probes. The queue had quietly grown until it broke a check about the queue.
 *
 * Measured at the time: 21 rows in an hour, 79 in a day, 771 in a week, and the
 * rate tracked how many audits had been run rather than any background process.
 * The newest rows were `report.export` and `email.send` stamped at the minute
 * `reporting-audit` and `doors-audit` had been running.
 *
 * 324 of the pending rows were `email.send` addressed to the OPERATOR'S OWN
 * address. If a worker had ever run on development he would have received a
 * thousand emails about fixtures.
 *
 * THE SWEEP THAT CLEARED IT IS RECORDED IN BACKLOG.md with its counts and the
 * ruling that authorised it. This file is the half that stops it recurring.
 *
 * =============================================================================
 * WHY THIS IS IN THE RUNNER AND NOT IN EACH AUDIT
 * =============================================================================
 *
 * The obvious shape is teardown inside every audit that enqueues. It does not
 * work, and finding out why is the useful part: the audits do not enqueue. They
 * drive the PRODUCT, and the product enqueues. `reporting-audit` and
 * `jobs-audit` mention `enqueue` only as a STRING in a source scan; the rows
 * appear because an export route or an email path was exercised.
 *
 * So an audit cannot clean up "the jobs it enqueued": it does not know it made
 * any. What it CAN be held to is a property, and the property is the one the
 * operator named: the queue afterwards is the queue before. That is observable
 * from outside the audit, per audit, in one place, which is the runner.
 *
 * AND IT ATTRIBUTES. A board-level check would say the queue grew by 40 and
 * leave somebody reading 59 audits to find out which. Snapshotting around each
 * audit names the one that did it, at the cost of two counts per audit.
 *
 * NOTHING IS DELETED UNTIL THE SUITE ENDS, deliberately. A later audit may
 * legitimately assert on a row an earlier one caused, and a teardown that runs
 * between them would be this file breaking the board it is protecting.
 *
 * ONLY pending AND dead ARE REMOVED. `done` is inside the retention floor and
 * the retention policy governs it; `running` may hold a live lease. The policy's
 * own `neverDelete` forbids a TIMER from aging out pending and dead rows,
 * because "a pending job older than the floor is a defect somebody has to see".
 * This is not a timer: it removes rows THIS RUN caused, which is the one
 * permission CLAUDE.md grants a run over a table it did not own.
 */

/** Every job id now, as a Set. Null when the queue cannot be read. */
export async function queueSnapshot(db) {
  if (!db) return null;
  const ids = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("eng_jobs")
      .select("id")
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) return null;
    const got = data ?? [];
    for (const r of got) ids.add(r.id);
    if (got.length < 1000) break;
  }
  return ids;
}

/**
 * Which ids exist now that were not in `before`, split by whether they are
 * terminal. Null when either read failed, which is reported rather than
 * treated as "nothing grew".
 */
export async function queueGrowth(db, before) {
  if (!db || !before) return null;
  const { data, error } = await db.from("eng_jobs").select("id, kind, status").limit(5000);
  if (error) return null;

  const added = (data ?? []).filter((r) => !before.has(r.id));
  return {
    added,
    removable: added.filter((r) => r.status === "pending" || r.status === "dead"),
  };
}

/** Delete the rows this run caused that nothing will ever drain. */
export async function queueTeardown(db, ids) {
  if (!db || ids.length === 0) return 0;
  let removed = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const { error } = await db.from("eng_jobs").delete().in("id", chunk);
    if (error) break;
    removed += chunk.length;
  }
  return removed;
}
