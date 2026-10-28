import { targetDaysFor } from "@/config/turnaround";
import { addBusinessDays, endOfFirmDay, calendarDateLabel, todayInFirmCalendar, FIRM_TIME_ZONE } from "./firm-calendar";

/**
 * WHEN A FILE IS DUE, FROM ITS LINE'S TARGET. Robert's addendum of 2026-10-25,
 * item 6, with his targets of 2026-10-27.
 *
 * Pure, so the rule is proven without a database: the target comes from
 * TURNAROUND_TARGET_DAYS in src/config/turnaround.ts, the count is business
 * days on the firm's calendar, and the file is due through the end of that day
 * in Chicago. A line with no target answers null, and a file on it carries no
 * due date rather than a guessed one.
 */
export type DueAt = { days: number; dueDate: string; dueAt: string };

export function dueFor(serviceSlug: string, tier: string | null | undefined, orderedOn: string): DueAt | null {
  const days = targetDaysFor(serviceSlug, tier);
  if (days === null) return null;
  const dueDate = addBusinessDays(orderedOn, days);
  if (!dueDate) return null;
  const dueAt = endOfFirmDay(dueDate);
  if (!dueAt) return null;
  return { days, dueDate, dueAt };
}

/** The due date for a file opened now, on the firm's calendar. */
export function dueForToday(serviceSlug: string, tier: string | null | undefined): DueAt | null {
  return dueFor(serviceSlug, tier, todayInFirmCalendar());
}

/**
 * The statuses a file can be overdue in: the firm still owes the customer the
 * work. A file waiting on the property owner's repairs is not the firm's delay,
 * and a sealed, delivered, closed, cancelled or declined file owes nothing.
 */
export const OVERDUE_STATUSES = [
  "intake",
  "needs_dispatch",
  "dispatched",
  "evidence_in_progress",
  "evidence_submitted",
  "under_review",
  "revisions_requested",
] as const;

export function isOverdue(file: { status: string; due_at: string | null }, nowMs: number): boolean {
  if (!file.due_at) return false;
  if (!(OVERDUE_STATUSES as readonly string[]).includes(file.status)) return false;
  const due = Date.parse(file.due_at);
  return Number.isFinite(due) && due < nowMs;
}

/**
 * The sentence the customer's status page carries, or null.
 *
 * UNDER THE GATE, EXACTLY AS THE PUBLISHED ROOF FIGURE IS. Robert ruled on
 * 2026-09-19 that a published turnaround "is a promise about fulfilment the
 * firm cannot yet make" and renders when the gate opens; publishedTurnaround()
 * answers null while it is shut. A target date on a status page is the same
 * promise made to one customer, so it is held the same way: `open` is the
 * caller's isOpen(), and while it is false this renders nothing.
 */
export function targetDateLine(dueAt: string | null, open: boolean): string | null {
  if (!open || !dueAt) return null;
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: FIRM_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(dueAt));
  const label = calendarDateLabel(day);
  return label ? `The firm's target date for this order is ${label}.` : null;
}
