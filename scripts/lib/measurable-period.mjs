/**
 * THE PERIOD AN AUDIT CAN ACTUALLY MEASURE, DERIVED FROM THE DATA.
 *
 * Operator ruling, 2026-10-01: "A window with no rows while the table has rows
 * is COULD NOT TELL, not FAIL, and the audit measures a subject that cannot
 * expire on a date."
 *
 * WHAT THIS EXISTS BECAUSE OF. `reporting-audit` and `demo-audit` both scoped
 * their subjects to `periodOf()`, the current calendar month. Every
 * demonstration row on development is dated early September, so at midnight on
 * 1 October both windows emptied and the same tree that passed the night before
 * returned two reds, with nothing committed between them that either audit
 * reads.
 *
 * Both checks were RIGHT to refuse a green: a parse over no money cells and a
 * comparison over no payments each pass forever. What they got wrong is which
 * answer. They could not tell "there is no demonstration data", which is a real
 * gap, from "there is none in this month", which is the first of the month.
 *
 * IT LIVES IN ONE FILE BECAUSE IT IS ONE RULE. Two audits deriving the same
 * window separately is the same fact with two homes, and the one that drifts is
 * whichever nobody looks at. This repository has recorded that six times.
 *
 * WHY THE NEWEST PAYMENT AND NOT, SAY, THE NEWEST ORDER. Both checks are about
 * MONEY: one parses money cells out of an export, the other proves demonstration
 * revenue never reaches a real figure. A window chosen from orders could hold
 * orders and no payments, which is exactly the empty subject this is written to
 * avoid. The window is chosen from the thing being measured.
 */

import { periodOf } from "../../src/lib/ops-reports.ts";

/**
 * @returns {Promise<{period: string, derived: boolean, rows: number, why: string}>}
 *   `derived` is false when the current month was used as a fallback, which a
 *   caller should report rather than present as a measurement.
 */
export async function measurablePeriod(db) {
  const now = periodOf();

  if (!db) {
    return { period: now, derived: false, rows: 0, why: "no database client, so the current month was assumed" };
  }

  const { count, error: countError } = await db
    .from("eng_order_payments")
    .select("id", { count: "exact", head: true });

  if (countError) {
    return {
      period: now,
      derived: false,
      rows: 0,
      why: `eng_order_payments could not be counted (${countError.message}), so the current month was assumed`,
    };
  }

  if ((count ?? 0) === 0) {
    /*
     * A GENUINELY EMPTY TABLE IS NOT A WINDOW PROBLEM AND MUST NOT BE SOFTENED
     * INTO ONE. There is nothing anywhere to prove revenue against, and seeding
     * one is impossible: eng_order_payments refuses deletes, so a per-run
     * fixture would stand for ever. The caller should FAIL on this, which is
     * why it is reported as not derived with the count attached.
     */
    return { period: now, derived: false, rows: 0, why: "eng_order_payments holds no rows at all" };
  }

  const { data: newest, error } = await db
    .from("eng_order_payments")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !newest?.created_at) {
    return {
      period: now,
      derived: false,
      rows: count ?? 0,
      why: `the newest payment's date could not be read${error ? ` (${error.message})` : ""}, so the current month was assumed`,
    };
  }

  const period = periodOf(new Date(newest.created_at));
  return {
    period,
    derived: true,
    rows: count ?? 0,
    why: `the period of the newest of ${count} payment(s), so it cannot empty on a calendar boundary`,
  };
}
