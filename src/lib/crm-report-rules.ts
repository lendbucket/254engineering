/**
 * THE SALES REPORTS' RULES, CLIENT SAFE. Robert's sales CRM ruling R8 of
 * 2026-11-02: "/portal/crm/reports: dials, connects, interested, accounts
 * opened, orders and revenue attributed, per rep per day, week and month;
 * conversion by source and vertical; a leaderboard."
 *
 * Every rule is pinned here so the screen, the CSV and the proof read one
 * account of it:
 *
 *   dial          a call logged against a prospect (the contact log, channel
 *                 call), credited to the person who made it.
 *   connect       a call whose CRM outcome reached somebody: connected,
 *                 callback, interested, not interested or do not call. No
 *                 answer, voicemail and wrong number are dials, not connects.
 *   interested    a call whose CRM outcome is interested.
 *   account       an account_opened attribution (0116), credited to its rep.
 *   order         an order attribution (0116), credited to its rep, counted
 *                 when the order is paid, in fulfilment, complete or refunded
 *                 (R6's counted statuses); drafts, unpaid and cancelled orders
 *                 are not sales.
 *   revenue       the total of attributed orders that are paid, in fulfilment
 *                 or complete, less refunds that succeeded: R6's rule exactly.
 *                 Not set when any such order carries no total, never a zero.
 *
 *   day           the firm calendar day (America/Chicago) the thing happened.
 *   week          the firm calendar week, Monday to Sunday, keyed by its
 *                 Monday. Nothing in the repository set a week rule before;
 *                 Monday is the ISO rule and the office's working week.
 *   month         the firm calendar month, keyed YYYY-MM.
 */

import { COUNTED_ORDER_STATUSES, REVENUE_ORDER_STATUSES } from "./crm-account-rules";

export const CONNECT_OUTCOMES = ["connected", "callback", "interested", "not_interested", "do_not_call"] as const;

export type Period = "day" | "week" | "month";
export const PERIODS: readonly Period[] = ["day", "week", "month"];
export const PERIOD_LABEL: Record<Period, string> = { day: "Day", week: "Week (Monday to Sunday)", month: "Month" };

/** The rep a sale is credited to: the company's owner, or, for one nobody owned, whoever converted it. */
export function creditedRep(p: { owner_id: string | null; converted_by: string | null }): string | null {
  return p.owner_id ?? p.converted_by ?? null;
}

const DAY_MS = 86_400_000;

/** The key of the period holding a firm day (YYYY-MM-DD): the day, its week's Monday, or YYYY-MM. */
export function periodKey(day: string, period: Period): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const t = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  if (period === "day") return day;
  if (period === "month") return day.slice(0, 7);
  /* getUTCDay: Sunday 0 ... Saturday 6. Back to Monday. */
  const back = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - back * DAY_MS).toISOString().slice(0, 10);
}

export type CallFact = { repId: string; day: string; crmOutcome: string | null };
export type OpenedFact = { repId: string | null; day: string };
export type OrderFact = { repId: string | null; day: string; status: string; totalCents: number | null; refundedCents: number };

export type RepPeriodRow = {
  repId: string | null;
  period: string;
  dials: number;
  connects: number;
  interested: number;
  accountsOpened: number;
  orders: number;
  /** Null when an earning order in the cell carries no total. */
  revenueCents: number | null;
};

const counted = new Set<string>(COUNTED_ORDER_STATUSES);
const earning = new Set<string>(REVENUE_ORDER_STATUSES);
const connect = new Set<string>(CONNECT_OUTCOMES);

/** Revenue over a set of orders, by R6's rule: earning orders' totals less succeeded refunds; null if any total is absent. */
export function revenueOf(orders: readonly Pick<OrderFact, "status" | "totalCents" | "refundedCents">[]): number | null {
  let sum = 0;
  for (const o of orders) {
    if (!earning.has(o.status)) continue;
    if (o.totalCents === null) return null;
    sum += o.totalCents - o.refundedCents;
  }
  return sum;
}

/** One row per rep per period, with every count that period holds. */
export function repPeriodRows(
  period: Period,
  facts: { calls: readonly CallFact[]; opened: readonly OpenedFact[]; orders: readonly OrderFact[] },
): RepPeriodRow[] {
  const rows = new Map<string, RepPeriodRow & { _orders: OrderFact[] }>();
  const cell = (repId: string | null, day: string) => {
    const key = periodKey(day, period);
    if (key === null) return null;
    const id = `${repId ?? ""}|${key}`;
    let r = rows.get(id);
    if (!r) {
      r = { repId, period: key, dials: 0, connects: 0, interested: 0, accountsOpened: 0, orders: 0, revenueCents: 0, _orders: [] };
      rows.set(id, r);
    }
    return r;
  };
  for (const c of facts.calls) {
    const r = cell(c.repId, c.day);
    if (!r) continue;
    r.dials += 1;
    if (c.crmOutcome && connect.has(c.crmOutcome)) r.connects += 1;
    if (c.crmOutcome === "interested") r.interested += 1;
  }
  for (const a of facts.opened) {
    const r = cell(a.repId, a.day);
    if (r) r.accountsOpened += 1;
  }
  for (const o of facts.orders) {
    if (!counted.has(o.status)) continue;
    const r = cell(o.repId, o.day);
    if (!r) continue;
    r.orders += 1;
    r._orders.push(o);
  }
  return [...rows.values()]
    .map(({ _orders, ...r }) => ({ ...r, revenueCents: revenueOf(_orders) }))
    .sort((a, b) => (a.period === b.period ? String(a.repId).localeCompare(String(b.repId)) : b.period.localeCompare(a.period)));
}

export type LeaderRow = { repId: string | null; dials: number; connects: number; accountsOpened: number; orders: number; revenueCents: number | null };

/** The leaderboard over a window: accounts opened first, then attributed revenue, then orders, then connects. */
export function leaderboard(rows: readonly RepPeriodRow[]): LeaderRow[] {
  const by = new Map<string, LeaderRow>();
  for (const r of rows) {
    const id = r.repId ?? "";
    const l = by.get(id) ?? { repId: r.repId, dials: 0, connects: 0, accountsOpened: 0, orders: 0, revenueCents: 0 };
    l.dials += r.dials;
    l.connects += r.connects;
    l.accountsOpened += r.accountsOpened;
    l.orders += r.orders;
    l.revenueCents = l.revenueCents === null || r.revenueCents === null ? null : l.revenueCents + r.revenueCents;
    by.set(id, l);
  }
  return [...by.values()].sort(
    (a, b) =>
      b.accountsOpened - a.accountsOpened ||
      (b.revenueCents ?? -1) - (a.revenueCents ?? -1) ||
      b.orders - a.orders ||
      b.connects - a.connects,
  );
}

export type ConversionFact = { prospectId: string; vertical: string | null; sources: readonly string[]; converted: boolean };
export type ConversionRow = { key: string; prospects: number; converted: number; rate: number | null };

/** Conversion by vertical, or by source (a company with two sources counts under each). */
export function conversionBy(by: "vertical" | "source", facts: readonly ConversionFact[]): ConversionRow[] {
  const m = new Map<string, { prospects: number; converted: number }>();
  for (const f of facts) {
    const keys = by === "vertical" ? [f.vertical ?? "not set"] : f.sources.length ? [...new Set(f.sources)] : ["not recorded"];
    for (const k of keys) {
      const c = m.get(k) ?? { prospects: 0, converted: 0 };
      c.prospects += 1;
      if (f.converted) c.converted += 1;
      m.set(k, c);
    }
  }
  return [...m.entries()]
    .map(([key, c]) => ({ key, ...c, rate: c.prospects ? c.converted / c.prospects : null }))
    .sort((a, b) => b.prospects - a.prospects || a.key.localeCompare(b.key));
}
