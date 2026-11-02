/**
 * ===========================================================================
 * THE FIRM'S HOLIDAYS. Robert's ruling, 2026-11-01 evening, item P8.
 * ===========================================================================
 *
 * "Declare New Year's Day, Memorial Day, Independence Day, Labor Day,
 * Thanksgiving, the day after Thanksgiving and Christmas in one config file,
 * and have business days skip them."
 *
 * This is that one file. `addBusinessDays` in `src/lib/firm-calendar.ts` reads
 * it, and nothing else types a holiday. Until this ruling the firm had no
 * declared calendar and business days were Monday to Friday with none
 * subtracted, which was stated rather than guessed at (BACKLOG, 0099 item 2).
 *
 * Each holiday is a RULE, not a list of dates, so the file never runs out.
 *
 * WHEN A FIXED DATE FALLS ON A WEEKEND, the weekday beside it is the day off:
 * Saturday moves to the Friday before, Sunday to the Monday after. That is the
 * federal observance rule (5 U.S.C. 6103(b)), and without it a holiday on a
 * weekend would subtract nothing, because the weekend is already skipped. It is
 * the one choice here the ruling did not spell out, and it is recorded in the
 * report so Robert can reverse it. New Year's Day on a Saturday is therefore
 * observed on 31 December of the year before, which is why `isFirmHoliday`
 * looks at the next year's rules as well as its own.
 */

export type FirmHoliday =
  | { name: string; kind: "fixed"; month: number; day: number }
  | { name: string; kind: "nth-weekday"; month: number; weekday: number; nth: number }
  | { name: string; kind: "last-weekday"; month: number; weekday: number }
  | { name: string; kind: "day-after"; of: string };

/** Month is 1 to 12. Weekday is 0 (Sunday) to 6 (Saturday). */
export const FIRM_HOLIDAYS: readonly FirmHoliday[] = [
  { name: "New Year's Day", kind: "fixed", month: 1, day: 1 },
  { name: "Memorial Day", kind: "last-weekday", month: 5, weekday: 1 },
  { name: "Independence Day", kind: "fixed", month: 7, day: 4 },
  { name: "Labor Day", kind: "nth-weekday", month: 9, weekday: 1, nth: 1 },
  { name: "Thanksgiving", kind: "nth-weekday", month: 11, weekday: 4, nth: 4 },
  { name: "Day after Thanksgiving", kind: "day-after", of: "Thanksgiving" },
  { name: "Christmas Day", kind: "fixed", month: 12, day: 25 },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day, 12));

function dateOf(rule: FirmHoliday, year: number, named: Map<string, Date>): Date {
  if (rule.kind === "fixed") {
    const at = utc(year, rule.month, rule.day);
    const weekday = at.getUTCDay();
    if (weekday === 6) at.setUTCDate(at.getUTCDate() - 1);
    if (weekday === 0) at.setUTCDate(at.getUTCDate() + 1);
    return at;
  }
  if (rule.kind === "nth-weekday") {
    const at = utc(year, rule.month, 1);
    at.setUTCDate(1 + ((rule.weekday - at.getUTCDay() + 7) % 7) + 7 * (rule.nth - 1));
    return at;
  }
  if (rule.kind === "last-weekday") {
    const at = utc(year, rule.month + 1, 0);
    at.setUTCDate(at.getUTCDate() - ((at.getUTCDay() - rule.weekday + 7) % 7));
    return at;
  }
  const base = named.get(rule.of);
  if (!base) throw new Error(`firm-holidays: "${rule.name}" follows "${rule.of}", which is declared after it or not at all`);
  const at = new Date(base);
  at.setUTCDate(at.getUTCDate() + 1);
  return at;
}

/** The days off the rules produce for one year's holidays, as ISO dates, in declared order. */
export function firmHolidaysFor(year: number): { name: string; date: string }[] {
  const named = new Map<string, Date>();
  return FIRM_HOLIDAYS.map((rule) => {
    const at = dateOf(rule, year, named);
    named.set(rule.name, at);
    return { name: rule.name, date: iso(at) };
  });
}

/** Is this calendar date ("YYYY-MM-DD") a day the firm is closed for a holiday? */
export function isFirmHoliday(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const year = Number(date.slice(0, 4));
  return [year, year + 1].some((y) => firmHolidaysFor(y).some((h) => h.date === date));
}
