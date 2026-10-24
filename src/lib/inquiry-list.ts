import { cleanSearchTerm } from "./search-rules";

/**
 * WHICH DESIGN BRIEFS THE LIST SHOWS, AND IN WHAT ORDER. Office ready, operator
 * ruling of 2026-10-20: "Every list sorts, filters, searches and pages."
 *
 * Pure, so the screen and its counts read one normalised query and a proof can
 * run it without a database. ops-inquiries applies it to the read.
 */
export type InquiryListParams = { q?: string; show?: string; sort?: string; dir?: string; page?: string };

export type InquiryListQuery = {
  term: string;
  show: "open" | "answered" | "all";
  sort: "due" | "received" | "name";
  ascending: boolean;
  page: number;
};

export const INQUIRY_PAGE_SIZE = 50;

export function inquiryListQuery(params: InquiryListParams): InquiryListQuery {
  /* Everything by default, unanswered first, which is what the screen showed before it had controls. */
  const show = params.show === "answered" || params.show === "open" ? params.show : "all";
  const sort = params.sort === "received" || params.sort === "name" ? params.sort : "due";
  /* Due reads the promise that runs out soonest first; received reads newest first; name A to Z. */
  const ascending = params.dir ? params.dir === "asc" : sort !== "received";
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  return { term: cleanSearchTerm(params.q ?? ""), show, sort, ascending, page };
}

/** The or() a term becomes: name, email, the property address, and the phone on its digits. Null for none. */
export function inquirySearchOr(term: string): string | null {
  if (!term) return null;
  const like = `%${term}%`;
  const digits = term.replace(/\D/g, "");
  const phone = digits.length >= 3 ? [`phone.ilike.%${digits.split("").join("%")}%`] : [];
  return [`name.ilike.${like}`, `email.ilike.${like}`, `property_address.ilike.${like}`, ...phone].join(",");
}
