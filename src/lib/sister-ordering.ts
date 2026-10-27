import { sisterOrdering, type SisterOrdering } from "@/config/sister-ordering";

/**
 * WHETHER A CALLER THE KEY HAS IDENTIFIED MAY PLACE AN ORDER, AS A SENTENCE OR NULL.
 *
 * Robert's addendum of 2026-10-25, item 10, and src/config/sister-ordering.ts.
 * The firm's own site is never refused here. Any other site is refused unless
 * the switch names it open, so a site the switch does not name at all is closed,
 * not open: a key added to ORDER_INTAKE_KEYS for a brand nobody declared opens
 * nothing.
 *
 * Pure, with the table a parameter, so the open direction can be proved without
 * opening anything (scripts/proofs/a-sister-order-is-a-normal-order-behind-its-switch.mjs).
 */
export function sisterOrderingRefusal(
  site: string,
  ownSite: string,
  table: Readonly<Record<string, SisterOrdering>> = sisterOrdering,
): string | null {
  if (site === ownSite) return null;
  const entry = Object.prototype.hasOwnProperty.call(table, site) ? table[site] : undefined;
  if (entry?.open === true) return null;
  return "Orders from this site are not open yet. Nothing was placed and nothing was charged.";
}
