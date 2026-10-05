/**
 * WHEN RETENTION CANNOT PROCEED, SOMEBODY IS TOLD.
 *
 * Operator ruling, 2026-10-05: build the alert, not the backfill.
 *
 * ==========================================================================
 * WHY THIS EXISTS, AND IT WAS FOUND BY INVESTIGATING A RED THAT WAS NOT A BUG.
 * ==========================================================================
 *
 * `retention-audit` went red on three boards. Five checks reported FAIL and not
 * one of them had run its assertion: the fixture could not build because the
 * planner REFUSED, correctly, in its own words:
 *
 *     2026-09-04 has 6 row(s) in eng_jobs and no jobs.completed figure in
 *     eng_metrics_daily. The rollup that replaces this day does not exist yet,
 *     so the day is not deleted. Run the metrics rollup for that day first.
 *
 * That gate is right and nothing here loosens it. A source day is never deleted
 * before the rollup that replaces it exists, because deleting it would make the
 * absence permanent and no later audit could tell a deleted row from a row that
 * never existed.
 *
 * THE PRODUCTION FAILURE MODE IS THE REASON FOR AN ALERT. The gate fails
 * CLOSED, which is correct and is also silent. If the daily rollup cron ever
 * misses a day, retention stops planning from that day forward, permanently,
 * and telemetry grows without bound. Nothing in the platform would say so:
 * every run would refuse, correctly, to nobody.
 *
 * It is the same shape as the queue watcher's own reason for existing. A worker
 * that stops is silent in exactly the way an outage is not, because the site
 * answers 200 the whole time and only the work is not happening.
 *
 * ==========================================================================
 * WHAT IT DELIBERATELY DOES NOT DO.
 * ==========================================================================
 *
 * IT DOES NOT CALL `planRetention`. A successful plan writes a manifest row and
 * `eng_retention_runs` refuses DELETE by design, so a watcher on a five minute
 * cron would accumulate undeletable rows for ever. `retention-audit` records
 * development already holding 128 of them from eight plans a board, which is
 * the same defect at a hundredth of the rate.
 *
 * It calls `retentionReadiness`, which is the read-only half of planning and is
 * now ONE HOME with two callers. The planner continues when it is clean; this
 * only reports. Re-asking the question with a second query here would have been
 * one fact with two homes, which is the defect this repository meets most
 * often.
 *
 * IT DOES NOT DELETE, PLAN, OR BACKFILL ANYTHING. The operator chose the alert
 * over the backfill, and the distinction matters: a watcher that fixed the data
 * would be a watcher that makes the gate it is reporting on stop firing, which
 * is indistinguishable from the problem going away.
 */

/**
 * How long the firm goes without being told twice.
 *
 * Sixty minutes, matching the queue watcher rather than being chosen
 * independently, because they are the same kind of fact: a condition that
 * persists until somebody acts, on a cron that runs far more often than
 * anybody can act. A stalled retention is not more urgent minute to minute
 * than a stalled queue.
 *
 * It is NOT a business ruling in the section 6c sense. It changes how often an
 * operator is emailed, and nothing about what may be deleted, so it is not
 * pinned in an audit as a literal. The things that ARE rulings, the thirty day
 * floor and the two deletable tables, are pinned in `retention-audit` already
 * and are untouched by any of this.
 */
export const RETENTION_STALL_COOLDOWN_MINUTES = 60;

/** One table's answer to "could retention proceed". */
export type TableReadiness = { table: string; ok: boolean; because: string | null };

export type RetentionStallDecision =
  | { send: false; because: string }
  | { send: true; headline: string; because: string; stalled: TableReadiness[] };

/**
 * Is this worth telling somebody, and what does the sentence say.
 *
 * PURE, AND THAT IS THE POINT. Every input is handed in, so the rule can be
 * exercised with no database and no clock. CLAUDE.md records the trap in that
 * at length: a rule tested with its input handed to it says nothing about the
 * READ that feeds it in production, and the read here is
 * `retentionReadiness`, which the watcher exercises against a real database and
 * which `retention-audit` covers independently.
 *
 * A TABLE THAT CANNOT BE READ AT ALL IS NOT A STALL, AND THE DISTINCTION IS
 * DELIBERATE. `retentionReadiness` returns `ok: false` both when a rollup is
 * missing and when the candidate read itself failed, and those are different
 * facts: the first is a condition somebody must act on, the second is the
 * platform being unable to look. Folding them together would produce an alert
 * saying retention is stalled when the truth is that nobody knows, which is the
 * status-function defect this repository records at the MFA lockout.
 */
export function decideRetentionStall(
  input: {
    tables: TableReadiness[];
    lastAlertedAtMs: number | null;
  },
  nowMs: number,
): RetentionStallDecision {
  if (input.tables.length === 0) {
    return { send: false, because: "no table is declared deletable, so there is nothing to stall" };
  }

  const stalled = input.tables.filter((t) => !t.ok);

  if (stalled.length === 0) {
    return {
      send: false,
      because: `retention can plan every deletable table (${input.tables.map((t) => t.table).join(", ")})`,
    };
  }

  if (input.lastAlertedAtMs !== null) {
    const sinceMinutes = Math.floor((nowMs - input.lastAlertedAtMs) / 60_000);
    if (sinceMinutes < RETENTION_STALL_COOLDOWN_MINUTES) {
      return {
        send: false,
        because:
          `retention is stalled on ${stalled.length} table(s) and the firm was told ${sinceMinutes} ` +
          `minute(s) ago, inside the ${RETENTION_STALL_COOLDOWN_MINUTES} minute cooldown`,
      };
    }
  }

  const names = stalled.map((t) => t.table).join(", ");
  return {
    send: true,
    headline:
      stalled.length === 1
        ? `Retention cannot plan ${names}`
        : `Retention cannot plan ${stalled.length} tables`,
    because:
      `Retention refused to plan ${names}. It is failing closed, which is correct: a source day is ` +
      "never deleted before the rollup that replaces it exists. Nothing has been lost. What it means " +
      "is that nothing is being pruned either, and it will stay that way until the reason below is " +
      "cleared.",
    stalled,
  };
}
