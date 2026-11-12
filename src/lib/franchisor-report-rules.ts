/**
 * FRANCHISOR REPORTING, THE PURE HALF (platform item X6). Robert's standing
 * list: "system wide revenue by territory, franchisee health, royalty
 * collection, Item 19 data set."
 *
 * What each part is here, and what it is not:
 *   revenue        each franchisee's territory revenue this month and last
 *                  (territory-revenue.ts), and the system total of each.
 *   due            what the statement (X3) says each owes this month.
 *   health         its onboarding steps met (X4), and certificates of
 *                  insurance that expire within 45 days, the warning the
 *                  firm's own register already uses first (0090).
 *   collection     NOT COMPUTED. Nothing records a payment from a franchisee,
 *                  so the report says so rather than showing what is due as
 *                  if it were collected.
 *   Item 19        SILENT IN YEAR ONE, Robert's ruling of 2026-11-10 (FR4):
 *                  no performance figure is assembled for it.
 */

export const CERTIFICATE_WARNING_DAYS = 45;

export const COLLECTION_LINE =
  "Not recorded: no payment from a franchisee is recorded on the platform yet, so what is due is not shown as collected.";
export const ITEM_19_LINE = "Silent in year one (Robert's ruling of 2026-11-10, FR4): no performance figure is assembled.";

const DAY_MS = 86_400_000;
const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / DAY_MS;

/** This month and the one before it, YYYY-MM, from a firm day YYYY-MM-DD. */
export function thisAndLastMonth(today: string): { thisMonth: string; lastMonth: string } {
  const [y, m] = today.split("-").map(Number);
  const lastMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  return { thisMonth: today.slice(0, 7), lastMonth };
}

/** A sum that is unknown if any part is: an unknown month is never counted as zero. */
export function sumKnown(values: readonly (number | null)[]): number | null {
  let total = 0;
  for (const v of values) {
    if (v === null) return null;
    total += v;
  }
  return total;
}

/** Live certificates whose expiry falls within the warning window from today, inclusive. */
export function expiringSoon(
  certificates: readonly { expiresOn: string; withdrawn: boolean }[],
  today: string,
  days: number = CERTIFICATE_WARNING_DAYS,
): number {
  const t = dayNumber(today);
  return certificates.filter((c) => !c.withdrawn && dayNumber(c.expiresOn) >= t && dayNumber(c.expiresOn) - t <= days).length;
}
