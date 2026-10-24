import { cleanSearchTerm } from "./search-rules";

/**
 * WHICH CLIENTS THE LIST SHOWS, AND IN WHAT ORDER. Office ready, operator ruling
 * of 2026-10-20: "Every list sorts, filters, searches and pages."
 *
 * Pure, so the screen, its count and its CSV export read one normalised query
 * and cannot disagree about what "the clients matching this" means, and a
 * proof can run it without a database. ops-crm applies it to the read and the
 * count alike.
 */
export type ClientListParams = { q?: string; kind?: string; sort?: string; dir?: string; page?: string };

export type ClientListQuery = {
  /** The search term, cleaned of what PostgREST's or() reads as syntax; "" for none. */
  term: string;
  kind: "all" | "organization" | "individual";
  sort: "added" | "name";
  ascending: boolean;
  page: number;
};

export function clientListQuery(params: ClientListParams): ClientListQuery {
  const kind = params.kind === "organization" || params.kind === "individual" ? params.kind : "all";
  const sort = params.sort === "name" ? "name" : "added";
  /* Added is newest first by default, name is A to Z: each list's natural reading order. */
  const ascending = params.dir ? params.dir === "asc" : sort === "name";
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  return { term: cleanSearchTerm(params.q ?? ""), kind, sort, ascending, page };
}

/**
 * The or() a search term becomes: name, email, city, and the phone matched on
 * its digits however it was typed or stored (the rule ops-search.ts proved).
 * Null for no term.
 */
export function clientSearchOr(term: string): string | null {
  if (!term) return null;
  const like = `%${term}%`;
  const digits = term.replace(/\D/g, "");
  const phone = digits.length >= 3 ? [`phone.ilike.%${digits.split("").join("%")}%`] : [];
  return [`name.ilike.${like}`, `email.ilike.${like}`, `city.ilike.${like}`, ...phone].join(",");
}
