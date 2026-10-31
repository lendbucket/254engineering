/**
 * Which job postings are close to seo-audit's failure window, so they can be
 * named before a board fails on them.
 *
 * A WARNING ONLY. Robert, 10:26 Central 2026-10-31: "have the height-style
 * warning cover JobPosting dates too, naming any validThrough within 45 days as
 * a warning, so the 30-day failure never arrives unannounced." The failure
 * window is POSTING_WARNING_DAYS in data/positions.ts and is enforced in
 * scripts/seo-audit.mjs; it is not touched here. This function returns names
 * and days left, never a verdict, and nothing it returns is pushed into a
 * finding or changes an exit code.
 *
 * Why it exists: both postings carried 2026-11-30, and on 2026-10-31 that date
 * crossed into the 30 day window with no earlier line on any board saying it
 * was coming. Every board, main included, went red on the same morning.
 */
export const POSTING_NOTICE_DAYS = 45;

const DAY_MS = 86_400_000;
const isoDay = (date) => date.toISOString().slice(0, 10);

/**
 * @param {{ route: string, validThrough: string }[]} postings as served
 * @param {Date} today
 * @param {number} failDays seo-audit's failure window, read from data/positions.ts
 * @param {number} [noticeDays]
 * @returns {{ route: string, validThrough: string, daysLeft: number }[]}
 *   postings whose date is past the failure window and within `noticeDays`,
 *   soonest first. A posting inside the failure window, already lapsed, or
 *   carrying no real date is not returned: each is a finding in the audit's own
 *   path, and naming it here as well would blur a failure into a warning.
 */
export function postingNotices(postings, today, failDays, noticeDays = POSTING_NOTICE_DAYS) {
  const day = isoDay(today);
  const failFrom = isoDay(new Date(today.getTime() + failDays * DAY_MS));
  const noticeFrom = isoDay(new Date(today.getTime() + noticeDays * DAY_MS));
  return postings
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.validThrough))
    .filter((p) => p.validThrough > failFrom && p.validThrough <= noticeFrom)
    .map((p) => ({
      route: p.route,
      validThrough: p.validThrough,
      daysLeft: Math.round((Date.parse(p.validThrough) - Date.parse(day)) / DAY_MS),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
