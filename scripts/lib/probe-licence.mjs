/**
 * A PROBE ENGINEER'S LICENCE IS UNIQUE TO ITS RUN. 2026-11-02, for 0109 (Robert's
 * Q5, audit field F5): one licence number per engineer profile, any status. The
 * order-path and design addendum walks each made a fresh engineer per run with a
 * FIXED licence (900000001, 900000002) and suspended it at the end, so the
 * second run after 0109 would be refused on the insert, and the onboarding walk
 * carried a fixed 9000105 that a crashed run would leave behind. Found by the
 * chat counterpart's 0109 sitting, issue #1 comment 6587890300.
 *
 * Two ranges, because two doors read the number:
 *
 *   walkProbeLicence        nine digits from 900 (900001000 to 900999999): the
 *                           probe range compliance-audit refuses in the shipped
 *                           register, digits only for 0089's seal doors, and
 *                           above the four reserved fixtures 900000001 to 4.
 *   onboardingProbeLicence  seven digits from 91 (9100000 to 9999999): activation
 *                           takes 4 to 7 digits (licenceNumberProblem), and a
 *                           Texas PE number is six, so no person holds one.
 *
 * Each is the run's start time in milliseconds, folded into its range, so two
 * runs started in different milliseconds within the range's span get different
 * numbers. The span is about 16 minutes for the walk range and 15 for the
 * onboarding range; a later collision needs a crashed run's probe still holding
 * the number, and every walk now nulls the licence when it suspends a probe.
 */

/** The permanent fixtures, never handed to a run. */
export const RESERVED_PROBE_LICENCES = ["900000001", "900000002", "900000003", "900000004"];

function startOf(ms) {
  if (!Number.isSafeInteger(ms) || ms < 0) throw new Error(`a probe licence needs the run's start time in milliseconds, not ${ms}`);
  return ms;
}

/** Nine digits in the probe range, for walks that seal: 900001000 to 900999999. */
export function walkProbeLicence(ms) {
  return String(900001000 + (startOf(ms) % 999000));
}

/** Seven digits from 91, for walks that go through activation's 4 to 7 digit rule. */
export function onboardingProbeLicence(ms) {
  return String(9100000 + (startOf(ms) % 900000));
}
