import type { RosterRow } from "./ops-field";

/**
 * WHICH TECHNICIANS THE ROSTER SHOWS, AND IN WHAT ORDER. Office ready, operator
 * ruling of 2026-10-20: "Every list sorts, filters, searches and pages."
 *
 * The roster is every field technician, read whole (a bench, not a ledger), so
 * the filter, search and sort run here on the rows it returned. Pure, and it
 * never reorders the rows it was given. A figure that could not be read sorts
 * last whichever way the list is sorted, so a missing number never heads a list
 * as if it were the smallest.
 */
export type TechListParams = { q?: string; status?: string; sort?: string; dir?: string };
export type TechListQuery = { needle: string; status: "all" | "active" | "inactive"; sort: "name" | "open" | "owed"; ascending: boolean };

export function techListQuery(params: TechListParams): TechListQuery {
  const status = params.status === "active" || params.status === "inactive" ? params.status : "all";
  const sort = params.sort === "open" || params.sort === "owed" ? params.sort : "name";
  /* Name reads A to Z; open jobs and owed read the largest first. */
  const ascending = params.dir ? params.dir === "asc" : sort === "name";
  return { needle: (params.q ?? "").trim().toLowerCase(), status, sort, ascending };
}

export function techListRows(rows: readonly RosterRow[], query: TechListQuery): RosterRow[] {
  const out = rows.filter(
    (t) =>
      (query.status === "all" || (query.status === "active" ? t.status === "active" : t.status !== "active")) &&
      (!query.needle ||
        [t.display_name, t.email, t.phone, t.base_city, t.base_county, ...t.coverage_counties].some((v) => (v ?? "").toLowerCase().includes(query.needle))),
  );
  const dir = query.ascending ? 1 : -1;
  const figure = (t: RosterRow) => (query.sort === "open" ? t.openJobs : t.pendingCents);
  if (query.sort === "name") out.sort((a, b) => a.display_name.localeCompare(b.display_name) * dir);
  else
    out.sort((a, b) => {
      const x = figure(a);
      const y = figure(b);
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
      return (x - y) * dir;
    });
  return out;
}
