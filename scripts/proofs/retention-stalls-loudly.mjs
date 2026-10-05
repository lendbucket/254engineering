// @runtime react-server
//
/**
 * A STALLED RETENTION IS REPORTED, AND A HEALTHY ONE IS NOT.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server \
 *     scripts/proofs/retention-stalls-loudly.mjs
 *
 * Operator ruling, 2026-10-05: build the alert, not the backfill.
 *
 * WHY THE DECISION IS PROVED HERE AND THE READ IS PROVED ELSEWHERE. This
 * exercises `decideRetentionStall`, which is pure, so every input is handed to
 * it and no database or clock is involved. CLAUDE.md is explicit that this is
 * only half a proof: "a rule tested with its input handed to it says nothing
 * about the READ that feeds it in production". The read is
 * `retentionReadiness`, which is the extracted read-only half of the planner,
 * covered independently by `retention-audit` on every board, and the two audits
 * that cover retention stayed green across the extraction.
 *
 * THE CASE THAT MATTERS MOST IS THE ONE THAT MUST NOT ALERT. A watcher that
 * emails on success trains the operator to ignore its emails, and the one that
 * matters then looks like the rest. So the healthy case is asserted as hard as
 * the stalled one.
 */

const { decideRetentionStall, RETENTION_STALL_COOLDOWN_MINUTES } = await import(
  "../../src/lib/retention-stall.ts"
);

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

const NOW = Date.parse("2026-10-05T12:00:00Z");
const ok = (table) => ({ table, ok: true, because: null });
const stalled = (table, because) => ({ table, ok: false, because });

const REAL_REFUSAL =
  "2026-09-04 has 6 row(s) in eng_jobs and no jobs.completed figure in eng_metrics_daily. " +
  "The rollup that replaces this day does not exist yet, so the day is not deleted. " +
  "Run the metrics rollup for that day first.";

/* ---------------------------------------------- the healthy case is silent */

{
  const d = decideRetentionStall(
    { tables: [ok("eng_cron_runs"), ok("eng_jobs")], lastAlertedAtMs: null },
    NOW,
  );
  rec(
    "retention that can plan every table sends nothing",
    d.send === false,
    d.send ? "IT ALERTED ON A HEALTHY RETENTION" : d.because,
  );
  rec(
    "and it says which tables it looked at, so the silence is accountable",
    d.send === false && d.because.includes("eng_cron_runs") && d.because.includes("eng_jobs"),
    d.send ? "" : d.because,
  );
}

/* ------------------------------------------------- one stalled table alerts */

{
  const d = decideRetentionStall(
    { tables: [ok("eng_cron_runs"), stalled("eng_jobs", REAL_REFUSAL)], lastAlertedAtMs: null },
    NOW,
  );
  rec("one stalled table alerts", d.send === true, d.send ? d.headline : d.because);
  rec(
    "and the headline names the table rather than counting",
    d.send === true && d.headline.includes("eng_jobs"),
    d.send ? d.headline : "",
  );
  rec(
    "and the planner's own sentence survives into the decision",
    d.send === true && d.stalled[0].because === REAL_REFUSAL,
    "the refusal names the DAY and the figures, which is why it was written that way",
  );
  rec(
    "and it says nothing has been lost, because nothing has",
    d.send === true && /Nothing has been lost/.test(d.because),
    "a gate failing closed is not a data loss, and an alert that reads like one costs trust",
  );
}

/* ------------------------------------------------------------ the cooldown */

{
  const justTold = NOW - 5 * 60_000;
  const d = decideRetentionStall(
    { tables: [stalled("eng_jobs", REAL_REFUSAL)], lastAlertedAtMs: justTold },
    NOW,
  );
  rec(
    "a stall already reported five minutes ago is not reported again",
    d.send === false && /cooldown/.test(d.because),
    d.send ? "IT WOULD EMAIL EVERY FIVE MINUTES" : d.because,
  );

  const longAgo = NOW - (RETENTION_STALL_COOLDOWN_MINUTES + 1) * 60_000;
  const after = decideRetentionStall(
    { tables: [stalled("eng_jobs", REAL_REFUSAL)], lastAlertedAtMs: longAgo },
    NOW,
  );
  rec(
    "and once the cooldown has passed it is reported again",
    after.send === true,
    after.send ? after.headline : `IT WENT SILENT ON A PERSISTING STALL: ${after.because}`,
  );
}

/* ------------------------------------------------ the empty subject guard */

{
  /*
   * A CHECK OVER AN EMPTY SET MUST NOT READ AS HEALTH. If the declaration ever
   * named no deletable table, every table would be "not stalled" and this would
   * report that retention is fine. It says what it actually saw instead.
   */
  const d = decideRetentionStall({ tables: [], lastAlertedAtMs: null }, NOW);
  rec(
    "no deletable tables reports nothing to stall rather than everything fine",
    d.send === false && /nothing to stall/.test(d.because),
    d.send ? "" : d.because,
  );
}

/* --------------------------------------------------------------- the verdict */

for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exit(1);
}
console.log(`PASS: ${out.length} checks. A stalled retention is reported and a healthy one is not.`);
