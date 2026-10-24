import type { RefundRequestRow } from "./ops-refund-requests";

/**
 * WHICH REFUND REQUESTS A LIST SHOWS, AND IN WHAT ORDER: the search and the
 * sort the refunds screen applies, in one place, so the screen and its CSV
 * export (office ready, 2026-10-20: "export to CSV") can never disagree about
 * the rows. Pure: it reads only the rows and the query.
 */
export type RefundListQuery = { q?: string; sort?: string; dir?: string };

export function refundListRows(rows: readonly RefundRequestRow[], query: RefundListQuery): RefundRequestRow[] {
  const needle = (query.q ?? "").trim().toLowerCase();
  const out = rows.filter((r) => !needle || [r.orderReference, r.requestedByName, r.reason].some((v) => (v ?? "").toLowerCase().includes(needle)));
  const dir = query.dir === "desc" ? -1 : 1;
  const sort = query.sort ?? "asked";
  const key = (r: RefundRequestRow) =>
    sort === "amount" ? String(r.owedCentsAtRequest).padStart(12, "0") : sort === "order" ? r.orderReference ?? "" : r.createdAt;
  out.sort((a, b) => (key(a) < key(b) ? -dir : key(a) > key(b) ? dir : 0));
  return out;
}
