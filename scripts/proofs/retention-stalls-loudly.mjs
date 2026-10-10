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

/* ============================================================================
 * AND INSIDE THE COOLDOWN, NOTHING ELSE IS READ AT ALL.
 * ============================================================================
 *
 * This is the half the pure function cannot prove, so it is proved as
 * BEHAVIOUR with a fake client that records every table it is asked for.
 *
 * WHY IT IS WORTH A FIXTURE RATHER THAN A SOURCE-TEXT CHECK. The property is an
 * ORDER of two awaits. A check that asserted the alert-state read appears
 * before the readiness call in the file would be satisfied by text that no
 * longer matches what runs, and moving one await past another is precisely the
 * edit that keeps the text plausible. So the fake watches what actually
 * happens.
 *
 * WHAT IT IS FOR. The first version of the watcher read every candidate row in
 * both tables BEFORE checking the cooldown: about 1,846 rows on production,
 * every five minutes, roughly 531,000 row reads a day, then discarded the
 * answer 287 times out of 288. Nothing about the result was wrong, which is
 * what made it invisible.
 */
{
  const { watchRetention } = await import("../../src/lib/retention-watch.ts");

  /** Records every table asked for, and answers only the one it should need. */
  const makeFake = (lastAlertedAt) => {
    const touched = [];
    const fake = {
      from(table) {
        touched.push(table);
        const chain = {
          select: () => chain,
          eq: () => chain,
          in: () => chain,
          lt: () => chain,
          not: () => chain,
          order: () => chain,
          range: () => chain,
          maybeSingle: async () => ({ data: { last_alerted_at: lastAlertedAt }, error: null }),
          then: (resolve) => resolve({ data: [], error: null, count: 0 }),
        };
        return chain;
      },
    };
    return { fake, touched };
  };

  /* Told one minute ago, so deep inside a one day cooldown. */
  const recent = new Date(NOW - 60_000).toISOString();
  const { fake, touched } = makeFake(recent);
  const result = await watchRetention(NOW, fake);

  rec(
    "inside the cooldown the alert state is read",
    touched.includes("eng_alert_state"),
    `tables touched: ${touched.join(", ") || "none"}`,
  );

  /*
   * THE ASSERTION THAT MATTERS. Derived from the declaration rather than
   * naming the two tables, so a third deletable table is covered the day it is
   * declared rather than the day somebody remembers to add it here.
   */
  const { sweepable } = await import("../../src/lib/ops-retention.ts");
  const sourceTables = sweepable();
  const readAnyway = sourceTables.filter((t) => touched.includes(t));

  rec(
    `and no source table is read at all (${sourceTables.length} declared deletable)`,
    readAnyway.length === 0,
    readAnyway.length
      ? `IT PAGED ${readAnyway.join(", ")} AND THEN THREW THE ANSWER AWAY`
      : `touched only ${[...new Set(touched)].join(", ")}`,
  );

  rec(
    "and a suppressed run does not claim to have looked",
    result.looked === false && /cooldown/.test(result.note) && result.sent === false,
    `looked=${result.looked} sent=${result.sent} note=${result.note}`,
  );

  /*
   * AND IT IS LOGGED AT INFO, WHILE A WATCH THAT COULD NOT SEE STAYS AT ERROR.
   * Operator ruling, 2026-10-09: production logged this routine skip at error
   * every five minutes for three days. Asked through reportRetentionWatch, the
   * function the cron calls, with a log that records its levels.
   */
  const { reportRetentionWatch } = await import("../../src/lib/retention-watch.ts");
  const levels = () => {
    const lines = [];
    const log = {
      info: (m) => lines.push(["info", m]),
      warn: (m) => lines.push(["warn", m]),
      error: (m) => lines.push(["error", m]),
    };
    return { lines, log };
  };
  const skip = levels();
  reportRetentionWatch(result, skip.log);
  rec(
    "a cooldown skip is marked suppressed and logged at info, never at error",
    result.suppressed === true && skip.lines.length === 1 && skip.lines[0][0] === "info",
    skip.lines.map(([l, m]) => `${l}: ${m}`).join(" | ") || "nothing logged",
  );

  const broken = {
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: null, error: { message: "relation eng_alert_state does not exist" } }),
      };
      return chain;
    },
  };
  const failed = await watchRetention(NOW, broken);
  const fault = levels();
  reportRetentionWatch(failed, fault.log);
  rec(
    "and a cooldown that could not be read is not suppressed, and is logged at error as DID NOT LOOK",
    failed.looked === false &&
      failed.suppressed === false &&
      fault.lines.length === 1 &&
      fault.lines[0][0] === "error" &&
      /DID NOT LOOK/.test(fault.lines[0][1]),
    fault.lines.map(([l, m]) => `${l}: ${m}`).join(" | ") || "nothing logged",
  );

  /*
   * THE OTHER DIRECTION, so this is not a check that passes by the watcher
   * never reading anything. With no previous alert the cooldown cannot
   * suppress, and the source tables MUST be read.
   */
  const { fake: fresh, touched: touchedFresh } = makeFake(null);
  await watchRetention(NOW, fresh);
  const readWhenAllowed = sourceTables.filter((t) => touchedFresh.includes(t));
  rec(
    "and with no cooldown it does read every declared table",
    readWhenAllowed.length === sourceTables.length,
    `read ${readWhenAllowed.join(", ") || "nothing"} of ${sourceTables.join(", ")}`,
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
