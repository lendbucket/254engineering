/**
 * THE DAY'S JOBS ON THE PHONE, FOR OFFLINE START: WHAT GOES IN, AND WHEN IT
 * COMES OUT. Robert's T2 and his answer 1 of 2026-11-07 (6717223376):
 *
 *   "Keep only that technician's jobs for today and tomorrow, in IndexedDB.
 *    Clear them at sign out, at reassignment or submission, and after 48 hours.
 *    No money, and nothing of another technician's."
 *
 * This file is the rule, pure, so the proof runs it with no database and no
 * browser: scripts/proofs/a-field-day-starts-and-replays-with-no-signal.mjs.
 * The server builds the pack (dayPackFor in ops-field.ts), the phone keeps it
 * (src/lib/field-day-store.ts), and both ask this file.
 */
import type { ChecklistProps } from "./job-checklist-props";

/** A job is in the field, and so on the phone, only in these three states. */
export const DAY_PACK_STATUSES: readonly string[] = ["dispatched", "evidence_in_progress", "revisions_requested"];

/** After this long the phone throws the pack away whether or not it was refreshed. */
export const DAY_PACK_MAX_AGE_MS = 48 * 60 * 60 * 1000;

/** One job as the phone holds it: where it is, what it asks, and nothing about money. */
export type DayPackJob = {
  fileId: string;
  fileNumber: string;
  propertyAddress: string;
  city: string | null;
  county: string;
  postalCode: string | null;
  serviceName: string;
  status: string;
  twiaCounty: boolean;
  /** The agreed visit time, from the call that set it, or null when none is recorded. */
  visitAt: string | null;
  checklist: ChecklistProps | null;
};

export type DayPack = {
  /** Whose jobs these are. A pack for anybody else is never shown. */
  techId: string;
  /** The server's time when it was built, shown on the offline screen as "as of". */
  packedAt: string;
  jobs: DayPackJob[];
};

/**
 * Whether a file belongs in the day pack. Assigned to this technician, in the
 * field, and either visiting today or tomorrow on the firm's calendar, or with
 * no visit time recorded yet: a job nobody has called about is still work he
 * holds, and leaving it off would strand him at a property the office never
 * scheduled by phone.
 */
export function inDayPack(
  file: { assigned_tech_id: string | null; status: string },
  techId: string,
  visitDay: string | null,
  today: string,
  tomorrow: string,
): boolean {
  if (file.assigned_tech_id !== techId) return false;
  if (!DAY_PACK_STATUSES.includes(file.status)) return false;
  return visitDay === null || visitDay === today || visitDay === tomorrow;
}

/** The calendar date after `date` (YYYY-MM-DD), by calendar arithmetic at noon UTC. */
export function nextCalendarDay(date: string): string {
  const at = new Date(`${date}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + 1);
  return at.toISOString().slice(0, 10);
}

/**
 * Whether a pack the phone holds may be shown. Only to the technician it was
 * built for, and only within 48 hours of being stored. The age is the phone's
 * own reckoning of how long it has held the pack, which is a rule about
 * storage, not a time on the firm's record.
 */
export function packUsable(pack: DayPack | null, storedAtMs: number | null, techId: string | null, nowMs: number): boolean {
  if (!pack || storedAtMs === null || !techId) return false;
  if (pack.techId !== techId) return false;
  return nowMs - storedAtMs >= 0 && nowMs - storedAtMs < DAY_PACK_MAX_AGE_MS;
}

/**
 * The words that must never travel in a pack, checked by the proof against a
 * real pack's JSON: anything about what the firm charges or pays.
 */
export const DAY_PACK_FORBIDDEN_KEYS: readonly string[] = [
  "amountCents",
  "amount_cents",
  "offer_amount_cents",
  "priceCents",
  "price_cents",
  "feeCents",
  "fee_cents",
  "offer",
];
