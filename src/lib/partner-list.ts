import type { PartnerRow } from "./ops-partners-admin";

/**
 * WHICH PARTNERS THE ROSTER SHOWS. Moved out of /portal/partners on
 * 2026-10-28 unchanged, so the screen and its CSV export read one filter
 * (office ready, Robert, 2026-10-28) rather than two copies of it.
 *
 * Pure, so a proof can hand it rows. The state filter keeps ended partners in
 * every view, exactly as the screen always has.
 */
export type PartnerListParams = { q?: string; state?: string };

/** The state the filter reads, which the screen's control shows as selected. */
export function partnerListState(params: PartnerListParams): "all" | "active" | "suspended" {
  return params.state === "active" || params.state === "suspended" ? params.state : "all";
}

export function partnerListRows(rows: readonly PartnerRow[], params: PartnerListParams): PartnerRow[] {
  const needle = (params.q ?? "").trim().toLowerCase();
  const state = partnerListState(params);
  return rows.filter(
    (p) =>
      (state === "all" || p.status === state || p.status === "ended") &&
      (!needle || [p.organisation, p.contactName, p.contactEmail, p.code].some((v) => (v ?? "").toLowerCase().includes(needle))),
  );
}
