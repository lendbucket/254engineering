/**
 * ===========================================================================
 * THE FIRM'S CALENDAR IS AMERICA/CHICAGO. Operator ruling, 2026-09-22.
 * ===========================================================================
 *
 * WHY THIS EXISTS AT ALL, which is a defect found rather than a preference.
 *
 * On 2026-09-22 at 19:19 Central, `compliance-audit` printed "Today is
 * 2026-09-23." It takes the machine clock, renders it as an ISO instant and
 * keeps the leading ten characters, which is UTC, and UTC had already rolled
 * over. The same command had printed 2026-09-22 earlier the same evening.
 *
 * THAT CALL IS DESCRIBED HERE AND NOT QUOTED, DELIBERATELY. `db-guard-audit`
 * sweeps every file under `src` for that exact expression, because an observed
 * timestamp taken from this process's clock is the defect it exists to catch.
 * Its matcher reads lines, so it cannot tell a call from a comment quoting one,
 * and the first version of this file went red on the board for documenting the
 * very thing it was written to replace. The same precaution is already taken in
 * CLAUDE.md for the long dash rule, whose pattern is named rather than spelled
 * so the sentence does not carry the characters it forbids.
 *
 * WHAT THAT COSTS. An acknowledgement written "ACKNOWLEDGED THROUGH
 * 2026-09-24" becomes a finding from the start of 2026-09-25 UTC, which is
 * 19:00 Central on 2026-09-24. The operator loses the last five hours of the
 * day he was given. It errs SHUT, so nothing unsafe follows from it, and it is
 * still wrong: a date the firm states in its own calendar should be read in
 * that calendar.
 *
 * WHY Intl RATHER THAN AN OFFSET. Central is UTC-6 in winter and UTC-5 in
 * summer. A fixed offset is correct for half the year and silently wrong for
 * the other half, and the half it is wrong in is decided by a date, which is
 * the thing being computed. `Intl.DateTimeFormat` with a named zone carries the
 * rule rather than a guess at it, and `en-CA` yields ISO order directly rather
 * than being reassembled from parts.
 *
 * WHAT THIS DOES NOT DO. It does not change the existing roster acknowledgement
 * in `compliance-audit`, which still computes its own TODAY in UTC. That is
 * recorded in BACKLOG.md as a known difference and was deliberately not fixed
 * in the same pass, on the operator's ruling that it errs shut and is not
 * urgent. This function is where that fix lands when it is taken up, so the
 * repair is one call site rather than a hunt.
 */

/** The IANA zone the firm's dates are stated in. One value, named once. */
export const FIRM_TIME_ZONE = "America/Chicago";

/**
 * Today, as the firm's own calendar reads it, in ISO `YYYY-MM-DD`.
 *
 * Takes an optional instant so a check can ask what the firm's calendar said
 * at a given moment, rather than being forced to move the machine clock. A
 * date rule that can only be tested by waiting is a rule nothing tests.
 */
export function todayInFirmCalendar(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FIRM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/**
 * An INSTANT (a timestamp) as a date in the firm's calendar, "Oct 9, 2026".
 * Operator ruling of 2026-10-09: certified on and verified on are shown in
 * Central time. Null in, null out, so an absent date is never printed as one.
 */
export function firmDateLabel(instant: string | null | undefined): string | null {
  if (!instant) return null;
  const at = new Date(instant);
  if (Number.isNaN(at.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { timeZone: FIRM_TIME_ZONE, month: "short", day: "numeric", year: "numeric" }).format(at);
}

/**
 * ===========================================================================
 * THE ONE FORMATTER FOR AN INSTANT. Operator ruling, 2026-10-09.
 * ===========================================================================
 *
 * The product audit found 39 server rendered date calls naming no time zone.
 * A server renders in ITS zone, and Vercel's is UTC, so anything after about
 * 7 pm Central printed as the next day: on a sealed letter, a statement, a
 * payout, a certification. The ruling: one shared formatter that pins
 * FIRM_TIME_ZONE, every call site moved to it, and a check that fails the board
 * on any date formatting that names no zone. The options are the caller's own,
 * so every screen keeps its wording and only gains the zone, which cannot be
 * overridden here.
 *
 * Null, an empty string or an unparseable value returns null, so an absent
 * date is never printed as one.
 */
export type FirmDateOptions = Omit<Intl.DateTimeFormatOptions, "timeZone">;

export function formatInFirmZone(
  value: string | number | Date | null | undefined,
  options: FirmDateOptions = { month: "short", day: "numeric", year: "numeric" },
): string | null {
  if (value === null || value === undefined || value === "") return null;
  const at = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(at.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: FIRM_TIME_ZONE }).format(at);
}

/**
 * The same for a CALENDAR DATE, "YYYY-MM-DD": an expiry, a due date, an issue
 * date. It belongs to no zone, so it is read at noon UTC and printed in UTC; a
 * conversion would move it a day for somebody. Anything that is not a bare
 * calendar date returns null rather than being guessed at.
 */
export function formatCalendarDate(
  date: string | null | undefined,
  options: FirmDateOptions = { month: "short", day: "numeric", year: "numeric" },
): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

/**
 * A CALENDAR DATE ("YYYY-MM-DD", such as an expiry) in the same words. A
 * calendar date belongs to no time zone, so it is read at noon UTC and printed
 * in UTC: converting it would move an expiry by a day for somebody, and the
 * date on the card is the date on the card.
 */
export function calendarDateLabel(date: string | null | undefined): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const at = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(at);
}
