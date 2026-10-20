import Link from "next/link";

/**
 * OFFICE READY LISTS: SORT, FILTER, SEARCH AND PAGES, ON THE SERVER.
 * Operator ruling, 2026-10-20: every staff list sorts, filters, searches and
 * pages, usable at 1440px and wider.
 *
 * A plain GET form, so the state lives in the address: a filtered list can be
 * bookmarked, sent to a colleague, and reloaded, and it works with no client
 * code at all. The list functions behind it read the whole set and count it,
 * so the pager's total is the size of the set rather than of a page.
 */

export type FilterOption = { value: string; label: string };
export type Filter = { name: string; label: string; value: string; options: FilterOption[] };
export type SortOption = { value: string; label: string };

const control =
  "min-h-[44px] rounded-[2px] border border-[var(--border)] bg-white px-3 text-[15px] text-[var(--ink)] focus:border-[var(--navy)] focus:outline-none";

export function ListControls({
  action,
  search,
  searchLabel,
  filters,
  sorts,
  sort,
  direction,
  csvHref,
}: {
  action: string;
  search: string;
  searchLabel: string;
  filters: Filter[];
  sorts: SortOption[];
  sort: string;
  direction: "asc" | "desc";
  /** A CSV of everything matching the current filter, not only this page. */
  csvHref?: string;
}) {
  return (
    <form method="get" action={action} className="mb-4 flex flex-wrap items-end gap-3 print:hidden" role="search">
      <div className="min-w-[240px] flex-[2]">
        <label htmlFor="list-q" className="block text-[13px] font-semibold text-[var(--ink)]">
          {searchLabel}
        </label>
        <input id="list-q" name="q" defaultValue={search} className={`${control} mt-1 w-full`} />
      </div>
      {filters.map((f) => (
        <div key={f.name} className="min-w-[150px] flex-1">
          <label htmlFor={`list-${f.name}`} className="block text-[13px] font-semibold text-[var(--ink)]">
            {f.label}
          </label>
          <select id={`list-${f.name}`} name={f.name} defaultValue={f.value} className={`${control} mt-1 w-full`}>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      <div className="min-w-[170px] flex-1">
        <label htmlFor="list-sort" className="block text-[13px] font-semibold text-[var(--ink)]">
          Sort by
        </label>
        <select id="list-sort" name="sort" defaultValue={sort} className={`${control} mt-1 w-full`}>
          {sorts.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[130px]">
        <label htmlFor="list-dir" className="block text-[13px] font-semibold text-[var(--ink)]">
          Order
        </label>
        <select id="list-dir" name="dir" defaultValue={direction} className={`${control} mt-1 w-full`}>
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </div>
      <button
        type="submit"
        className="inline-flex min-h-[44px] items-center rounded-[2px] bg-[var(--navy)] px-4 text-[14px] font-bold text-white hover:bg-[var(--navy-hover)]"
      >
        Show
      </button>
      <Link href={action} className="inline-flex min-h-[44px] items-center px-2 text-[14px] font-semibold text-[var(--navy)] underline">
        Clear
      </Link>
      {csvHref ? (
        <a href={csvHref} className="inline-flex min-h-[44px] items-center px-2 text-[14px] font-semibold text-[var(--navy)] underline">
          Export CSV
        </a>
      ) : null}
    </form>
  );
}

/** "Showing 51 to 100 of 312", and the links either side. */
export function Pager({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Pages" className="mt-3 flex flex-wrap items-center gap-3 text-[14px] text-[var(--secondary)] print:hidden">
      <span>
        Showing {from} to {to} of {total}
      </span>
      {page > 1 ? (
        <Link className="inline-flex min-h-[44px] items-center font-semibold text-[var(--navy)] underline" href={hrefFor(page - 1)}>
          Previous page
        </Link>
      ) : null}
      {page < pages ? (
        <Link className="inline-flex min-h-[44px] items-center font-semibold text-[var(--navy)] underline" href={hrefFor(page + 1)}>
          Next page
        </Link>
      ) : null}
    </nav>
  );
}

/** Build a list URL from the current params with some replaced. */
export function listHref(path: string, params: Record<string, string | undefined>, change: Record<string, string>): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...change })) if (v) next.set(k, v);
  const qs = next.toString();
  return qs ? `${path}?${qs}` : path;
}
