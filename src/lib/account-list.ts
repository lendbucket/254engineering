import { cleanSearchTerm } from "./search-rules";

/**
 * WHICH ORDERING ACCOUNTS THE LIST SHOWS, AND IN WHAT ORDER. Robert's answer 4
 * of 2026-10-28: a profiling bundle first, then a paged accounts list.
 *
 * Board 40733329479 timed /portal/accounts at 10.3 to 10.5 seconds, nearly all
 * of it in reading every figure for every one of about 3,020 accounts so the
 * browser could show fifty. The list now decides which fifty on the server,
 * over every account, and only those fifty have their orders, seats and open
 * statement read.
 *
 * Pure, so the screen and a proof read one normalised query and one paging
 * rule and cannot disagree about what "the accounts matching this" means.
 */

export const ACCOUNT_PAGE_SIZE = 50;

export type AccountListParams = {
  q?: string;
  status?: string;
  billing?: string;
  attention?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

export type AccountListQuery = {
  /** The organization name searched for, cleaned of PostgREST syntax; "" for none. */
  term: string;
  status: "all" | "active" | "suspended" | "closed";
  billing: "all" | "card" | "invoice";
  /** "cannot_order" keeps only the accounts the warning above the list names. */
  attention: "all" | "cannot_order";
  sort: "added" | "name";
  ascending: boolean;
  page: number;
};

export function accountListQuery(params: AccountListParams): AccountListQuery {
  const status =
    params.status === "active" || params.status === "suspended" || params.status === "closed" ? params.status : "all";
  const billing = params.billing === "card" || params.billing === "invoice" ? params.billing : "all";
  const attention = params.attention === "cannot_order" ? "cannot_order" : "all";
  const sort = params.sort === "name" ? "name" : "added";
  /* Added is oldest first by default, which is the order this screen has always used; name is A to Z. */
  const ascending = params.dir ? params.dir !== "desc" : true;
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  return { term: cleanSearchTerm(params.q ?? ""), status, billing, attention, sort, ascending, page };
}

/** One account as the paging rule needs it: nothing a page has to read separately. */
export type RosterEntry = {
  id: string;
  clientId: string;
  status: string;
  billingMode: string;
  createdAt: string;
  /** Active and refused by the credit rule: the accounts the warning names. */
  cannotOrder: boolean;
};

/**
 * Filter, sort and page the WHOLE roster. The total is the size of the
 * matching set, never the length of the page, because a page's length is its
 * bound (CLAUDE.md, section 6: a sample's length is not a count).
 *
 * `matchingClients` is the set of client ids whose name matches the search,
 * or null for no search. `nameOf` is needed only when sorting by name, and an
 * account whose name it lacks sorts last rather than being dropped.
 */
export function pageOfAccounts(
  roster: readonly RosterEntry[],
  query: AccountListQuery,
  matchingClients: ReadonlySet<string> | null,
  nameOf: ReadonlyMap<string, string> | null,
): { ids: string[]; matchingIds: string[]; total: number; page: number; pages: number } {
  const matching = roster.filter(
    (a) =>
      (query.status === "all" || a.status === query.status) &&
      (query.billing === "all" || a.billingMode === query.billing) &&
      (query.attention === "all" || a.cannotOrder) &&
      (matchingClients === null || matchingClients.has(a.clientId)),
  );
  const sign = query.ascending ? 1 : -1;
  const sorted = [...matching].sort((a, b) => {
    if (query.sort === "name" && nameOf) {
      const an = nameOf.get(a.clientId);
      const bn = nameOf.get(b.clientId);
      if (an === undefined && bn !== undefined) return 1;
      if (bn === undefined && an !== undefined) return -1;
      const byName = (an ?? "").localeCompare(bn ?? "", "en-US", { sensitivity: "base" });
      if (byName !== 0) return sign * byName;
    }
    const byAdded = a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
    if (byAdded !== 0) return sign * byAdded;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const total = sorted.length;
  const pages = Math.max(1, Math.ceil(total / ACCOUNT_PAGE_SIZE));
  const page = Math.min(query.page, pages);
  const from = (page - 1) * ACCOUNT_PAGE_SIZE;
  /*
   * matchingIds is every matching account in the page's order: what the CSV
   * export hands over (Robert, 2026-10-28, 16:11 Central), from this one rule
   * rather than a second filter.
   */
  return { ids: sorted.slice(from, from + ACCOUNT_PAGE_SIZE).map((a) => a.id), matchingIds: sorted.map((a) => a.id), total, page, pages };
}
