/**
 * ===========================================================================
 * WHAT A PERSON IS OWED AND HAS BEEN PAID, ONE RULE. Product audit, 2026-10-10.
 * ===========================================================================
 *
 * Both pay ledgers, eng_tech_pay_ledger and eng_production_ledger, carry four
 * statuses: pending, approved, paid and void. The audit found three screens
 * answering "what am I owed" three ways:
 *
 * - the technician's dashboard counted every entry not paid, VOID INCLUDED, so a
 *   canceled entry read as money still owed;
 * - the engineer's dashboard did the same, under a sentence saying "pending or
 *   approved";
 * - the Pay screen summed pending and approved, but over the newest 300 rows
 *   only, with demonstration files counted.
 *
 * So the rule lives here and every one of them reads it. Owed is pending or
 * approved. Paid is paid. Void is neither: it is kept on the ledger, never
 * counted. A row on a demonstration file moves no figure (demo-audit's rule).
 * An amount that is not a number is left out rather than counted as nothing.
 */

export type PayStatus = "pending" | "approved" | "paid" | "void";

/** The statuses that are money still owed. */
export const OWED_STATUSES: readonly PayStatus[] = ["pending", "approved"];

export function isOwed(status: unknown): boolean {
  return (OWED_STATUSES as readonly unknown[]).includes(status);
}

export function isPaid(status: unknown): boolean {
  return status === "paid";
}

type Row = { amount_cents?: unknown; status?: unknown; is_demo?: boolean | null };

/** Owed and paid, in cents, over rows that are real and carry a number. */
export function payFigures(rows: readonly Row[]): { owedCents: number; paidCents: number } {
  let owedCents = 0;
  let paidCents = 0;
  for (const r of rows) {
    if (r.is_demo === true) continue;
    const amount = typeof r.amount_cents === "number" ? r.amount_cents : Number(r.amount_cents);
    if (!Number.isFinite(amount)) continue;
    if (isOwed(r.status)) owedCents += amount;
    else if (isPaid(r.status)) paidCents += amount;
  }
  return { owedCents, paidCents };
}
