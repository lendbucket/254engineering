/**
 * ===========================================================================
 * THE FIRM'S CALENDAR IS AMERICA/CHICAGO. Operator ruling, 2026-09-22.
 * ===========================================================================
 *
 * WHY THIS EXISTS AT ALL, which is a defect found rather than a preference.
 *
 * On 2026-09-22 at 19:19 Central, `compliance-audit` printed "Today is
 * 2026-09-23." It computes today with `new Date().toISOString().slice(0, 10)`,
 * which is UTC, and UTC had already rolled over. The same command had printed
 * 2026-09-22 earlier the same evening.
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
