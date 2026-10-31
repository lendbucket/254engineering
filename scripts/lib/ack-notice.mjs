/**
 * Which acknowledgements in compliance-audit are close to their end date, so
 * they can be named before a board fails on them.
 *
 * A WARNING ONLY. Robert, 15:07 Central 2026-10-31: "extend the 45-day warning
 * to every acknowledged date in compliance-audit, a warning only." An
 * acknowledgement is a PASS-shaped verdict until its date and a FAIL from the
 * day after; that is enforced in scripts/compliance-audit.mjs and is not
 * touched here. This function returns names and days left, never a verdict,
 * and nothing it returns is pushed into a check or changes an exit code.
 *
 * Why it exists: the parked production cutover was acknowledged through
 * 2026-12-01, and nothing on any board said that date was coming until a
 * person read the acknowledgement block on 2026-10-31. The job postings had
 * just shown what an unannounced date costs: every board red on one morning.
 */
export const ACK_NOTICE_DAYS = 45;

const DAY_MS = 86_400_000;

/**
 * @param {{ name: string, through: string }[]} acknowledged each live
 *   acknowledgement and the last day it holds
 * @param {string} today an ISO day, in whichever calendar the check that made
 *   the acknowledgement used
 * @param {number} [noticeDays]
 * @returns {{ name: string, through: string, daysLeft: number }[]}
 *   acknowledgements holding today and ending within `noticeDays`, soonest
 *   first. One already past its date is not returned: it is a FAIL in the
 *   audit's own path, and naming it here as well would blur a failure into a
 *   warning.
 */
export function ackNotices(acknowledged, today, noticeDays = ACK_NOTICE_DAYS) {
  const noticeFrom = new Date(Date.parse(today) + noticeDays * DAY_MS).toISOString().slice(0, 10);
  return acknowledged
    .filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a.through ?? ""))
    .filter((a) => a.through >= today && a.through <= noticeFrom)
    .map((a) => ({
      name: a.name,
      through: a.through,
      daysLeft: Math.round((Date.parse(a.through) - Date.parse(today)) / DAY_MS),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
