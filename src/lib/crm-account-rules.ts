/**
 * ACCOUNT MANAGEMENT, THE RULES. Robert's sales CRM ruling of 2026-11-02, item
 * R6: "For prospects converted to accounts: last order date, days since,
 * orders this quarter, lifetime revenue, a reorder reminder at the account's
 * own average interval, a check-in task every 90 days, a churn flag at 90 days
 * quiet. Account manager view lists accounts by risk."
 *
 * Pure and client safe, so the screen, the daily job and the proof all ask the
 * same functions. Every date here is a firm calendar day (America/Chicago) as
 * YYYY-MM-DD, and every count of days is calendar days, Robert's numbers.
 *
 * THE RULES PINNED (and proved in
 * scripts/proofs/an-account-says-when-it-last-ordered-and-when-to-call.mjs):
 *
 *   ORDERS THAT COUNT  paid, in_fulfilment, complete and refunded. A draft, an
 *                      unpaid order and a cancelled one were never orders the
 *                      account placed. A refunded order was placed, so it
 *                      counts for "last order" and "this quarter", and its
 *                      money is taken back in lifetime revenue.
 *   ORDER DAY          the firm calendar day of placed_at, else created_at.
 *   LIFETIME REVENUE   the totals of paid, in_fulfilment and complete orders,
 *                      less refunds that succeeded on each; not stated at all
 *                      when any such order carries no total.
 *   AVERAGE INTERVAL   needs two or more distinct order days. It is the mean
 *                      of the gaps between consecutive distinct order days,
 *                      rounded to the nearest whole day, at least 1. One order
 *                      day gives no interval and so no reorder reminder.
 *   REORDER DUE        the last order day plus the average interval.
 *   CHURN              90 or more days since the last order (day 90 is
 *                      churned, day 89 is not). An account that has never
 *                      ordered is churned once 90 days have passed since it
 *                      was opened.
 *   CHECK-IN           every 90 days from the day the account was opened: due
 *                      on opened + 90, + 180, and so on. One task per due
 *                      day, keyed on the account and that day, so a re-run
 *                      never makes a second.
 *   QUARTER            the firm calendar quarter holding today: January,
 *                      April, July or October the 1st, to today.
 *   DUE SOON           a reorder or a check-in due within the next 14 days.
 *   RISK ORDER         churned, then reorder overdue, then due soon, then the
 *                      rest; inside each, the longest quiet first.
 */

export const CHURN_QUIET_DAYS = 90;
export const CHECK_IN_EVERY_DAYS = 90;
export const DUE_SOON_DAYS = 14;

export const COUNTED_ORDER_STATUSES = ["paid", "in_fulfilment", "complete", "refunded"] as const;
/** The statuses whose money stays with the firm; a refunded order's money went back. */
export const REVENUE_ORDER_STATUSES = ["paid", "in_fulfilment", "complete"] as const;

const DAY_MS = 86_400_000;

function dayNumber(day: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const t = Date.parse(`${day}T00:00:00Z`);
  return Number.isNaN(t) ? null : Math.round(t / DAY_MS);
}

function dayOf(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

/** Whole calendar days from `from` to `to` (both firm days); null on a bad day. */
export function daysBetween(from: string, to: string): number | null {
  const a = dayNumber(from);
  const b = dayNumber(to);
  return a === null || b === null ? null : b - a;
}

/* A count that is not a finite whole day gives no date, rather than a thrown RangeError from an invalid Date. */
export function addDays(day: string, days: number): string | null {
  const n = dayNumber(day);
  return n === null || !Number.isFinite(days) ? null : dayOf(n + Math.round(days));
}

/** The first day of the firm calendar quarter holding `today`. */
export function quarterStart(today: string): string | null {
  if (dayNumber(today) === null) return null;
  const [y, m] = today.split("-").map(Number);
  const first = Math.floor((m - 1) / 3) * 3 + 1;
  return `${y}-${String(first).padStart(2, "0")}-01`;
}

/** The mean gap between consecutive distinct order days, rounded, at least 1; null below two days. */
export function averageIntervalDays(orderDays: readonly string[]): number | null {
  const nums = [...new Set(orderDays.map(dayNumber).filter((n): n is number => n !== null))].sort((a, b) => a - b);
  if (nums.length < 2) return null;
  const span = nums[nums.length - 1] - nums[0];
  return Math.max(1, Math.round(span / (nums.length - 1)));
}

export type AccountOrder = { day: string; status: string; totalCents: number | null; refundedCents: number };

export type AccountStanding = {
  lastOrderDay: string | null;
  daysSince: number | null;
  ordersThisQuarter: number;
  ordersEver: number;
  /** Null when an earning order carries no total, so the sum would be a guess. */
  lifetimeRevenueCents: number | null;
  averageIntervalDays: number | null;
  reorderDueOn: string | null;
  checkInDueOn: string | null;
  churned: boolean;
  reorderOverdue: boolean;
  dueSoon: boolean;
  risk: 0 | 1 | 2 | 3;
};

export const RISK_LABEL: Record<AccountStanding["risk"], string> = {
  0: "Quiet 90 days or more",
  1: "Reorder overdue",
  2: "Due soon",
  3: "On track",
};

/** The next check-in due on or after `today`: opened + 90, + 180, ... */
export function nextCheckIn(openedOn: string, today: string): string | null {
  const gap = daysBetween(openedOn, today);
  if (gap === null) return null;
  const k = Math.max(1, Math.ceil(gap / CHECK_IN_EVERY_DAYS));
  return addDays(openedOn, k * CHECK_IN_EVERY_DAYS);
}

/** The check-in that has come due by `today` (the latest opened + 90k on or before today), or null before the first. */
export function checkInDueBy(openedOn: string, today: string): string | null {
  const gap = daysBetween(openedOn, today);
  if (gap === null || gap < CHECK_IN_EVERY_DAYS) return null;
  return addDays(openedOn, Math.floor(gap / CHECK_IN_EVERY_DAYS) * CHECK_IN_EVERY_DAYS);
}

export function accountStanding(input: { openedOn: string; today: string; orders: readonly AccountOrder[] }): AccountStanding {
  const counted = input.orders.filter((o) => (COUNTED_ORDER_STATUSES as readonly string[]).includes(o.status) && dayNumber(o.day) !== null);
  const days = counted.map((o) => o.day).sort();
  const lastOrderDay = days.length ? days[days.length - 1] : null;
  const daysSince = lastOrderDay ? daysBetween(lastOrderDay, input.today) : null;
  const qStart = quarterStart(input.today);
  const ordersThisQuarter = qStart ? counted.filter((o) => o.day >= qStart && o.day <= input.today).length : 0;
  /* An order with no total cannot be summed as zero: the lifetime figure is then not stated at all (absent is not zero). */
  const earning = counted.filter((o) => (REVENUE_ORDER_STATUSES as readonly string[]).includes(o.status));
  const lifetimeRevenueCents = earning.some((o) => o.totalCents === null)
    ? null
    : earning.reduce((sum, o) => sum + Math.max(0, (o.totalCents as number) - o.refundedCents), 0);
  const interval = averageIntervalDays(days);
  const reorderDueOn = lastOrderDay && interval !== null ? addDays(lastOrderDay, interval) : null;
  const quietSinceOpened = daysBetween(input.openedOn, input.today);
  const churned = lastOrderDay ? (daysSince ?? 0) >= CHURN_QUIET_DAYS : (quietSinceOpened ?? 0) >= CHURN_QUIET_DAYS;
  const reorderOverdue = reorderDueOn !== null && input.today > reorderDueOn;
  const checkInDueOn = nextCheckIn(input.openedOn, input.today);
  const soonLimit = addDays(input.today, DUE_SOON_DAYS);
  const within = (d: string | null) => d !== null && soonLimit !== null && d >= input.today && d <= soonLimit;
  const dueSoon = within(reorderDueOn) || within(checkInDueOn);
  const risk: AccountStanding["risk"] = churned ? 0 : reorderOverdue ? 1 : dueSoon ? 2 : 3;
  return {
    lastOrderDay,
    daysSince,
    ordersThisQuarter,
    ordersEver: counted.length,
    lifetimeRevenueCents,
    averageIntervalDays: interval,
    reorderDueOn,
    checkInDueOn,
    churned,
    reorderOverdue,
    dueSoon,
    risk,
  };
}

/** Riskiest first: churned, overdue, due soon, the rest; inside each the longest quiet first, then the name. */
export function byRisk<T extends { standing: Pick<AccountStanding, "risk" | "daysSince">; name: string }>(rows: readonly T[]): T[] {
  const quiet = (s: Pick<AccountStanding, "risk" | "daysSince">) => (s.daysSince === null ? Number.MAX_SAFE_INTEGER : s.daysSince);
  return [...rows].sort((a, b) => a.standing.risk - b.standing.risk || quiet(b.standing) - quiet(a.standing) || a.name.localeCompare(b.name));
}

/**
 * The account manager view's search, filter and sort, in the staff list
 * engine's shape (staff-lists.ts). The default sort is the risk order itself:
 * the read arrives sorted by byRisk, and "risk" keys on that place.
 */
export type AccountListRow = { name: string; ownerName: string | null; standing: Pick<AccountStanding, "risk" | "daysSince" | "lastOrderDay" | "ordersThisQuarter"> };

export const RISK_FILTER: { value: string; label: string; risk: AccountStanding["risk"] }[] = [
  { value: "quiet", label: RISK_LABEL[0], risk: 0 },
  { value: "overdue", label: RISK_LABEL[1], risk: 1 },
  { value: "soon", label: RISK_LABEL[2], risk: 2 },
  { value: "on_track", label: RISK_LABEL[3], risk: 3 },
];

export function accountListSpec<T extends AccountListRow>() {
  return {
    text: (r: T) => [r.name, r.ownerName],
    filters: {
      risk: Object.fromEntries(RISK_FILTER.map((f) => [f.value, (r: T) => r.standing.risk === f.risk])),
    },
    sorts: {
      risk: { key: (_r: T, readAt: number) => readAt, ascending: true },
      quiet: { key: (r: T) => r.standing.daysSince, ascending: false },
      last: { key: (r: T) => r.standing.lastOrderDay, ascending: false },
      quarter: { key: (r: T) => r.standing.ordersThisQuarter, ascending: false },
      name: { key: (r: T) => r.name.toLowerCase(), ascending: true },
    },
    defaultSort: "risk",
  };
}

export type WantedAccountTask = { key: string; kind: "reorder" | "check_in"; dueOn: string; title: string; description: string };

/**
 * The tasks an account wants today. A reorder reminder once its due day has
 * come, keyed on the account and that day; a check-in once one has come due,
 * keyed the same way. The key is what makes a re-run add nothing.
 */
export function accountTasksWanted(input: { accountId: string; name: string; openedOn: string; today: string; standing: AccountStanding }): WantedAccountTask[] {
  const out: WantedAccountTask[] = [];
  const { standing } = input;
  if (standing.reorderDueOn && input.today >= standing.reorderDueOn) {
    out.push({
      key: `crm-reorder:${input.accountId}:${standing.reorderDueOn}`,
      kind: "reorder",
      dueOn: standing.reorderDueOn,
      title: `Reorder reminder: ${input.name}`,
      description:
        `${input.name} orders about every ${standing.averageIntervalDays} days, and its last order was ${standing.lastOrderDay}. ` +
        "Call to ask whether another is due.",
    });
  }
  const checkIn = checkInDueBy(input.openedOn, input.today);
  if (checkIn) {
    out.push({
      key: `crm-checkin:${input.accountId}:${checkIn}`,
      kind: "check_in",
      dueOn: checkIn,
      title: `Check in: ${input.name}`,
      description: `The 90 day check-in for ${input.name}, an account since ${input.openedOn}.`,
    });
  }
  return out;
}
