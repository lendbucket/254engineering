import { cleanSearchTerm } from "./search-rules";

/**
 * WHICH ONBOARDINGS THE LIST SHOWS, AND IN WHAT ORDER. Office ready, operator
 * ruling of 2026-10-20 ("Every list sorts, filters, searches and pages"), and
 * Robert's ruling of 10:52 Central 2026-10-29: "Build list controls for
 * onboarding."
 *
 * Pure, in the shape of client-list.ts, so the screen's list and its count read
 * one normalised query and cannot disagree about what "the onboardings matching
 * this" means, and a proof can run it without a database.
 */
export type OnboardingListParams = { q?: string; status?: string; role?: string; sort?: string; dir?: string; page?: string };

export const ONBOARDING_STATUSES = ["invited", "in_progress", "submitted", "verified", "complete"] as const;

export type OnboardingListQuery = {
  /** The search term, cleaned of what PostgREST's or() reads as syntax; "" for none. */
  term: string;
  status: "all" | (typeof ONBOARDING_STATUSES)[number];
  role: "all" | "engineer" | "field_tech";
  sort: "invited" | "name";
  ascending: boolean;
  page: number;
};

export function onboardingListQuery(params: OnboardingListParams): OnboardingListQuery {
  const status = (ONBOARDING_STATUSES as readonly string[]).includes(params.status ?? "")
    ? (params.status as OnboardingListQuery["status"])
    : "all";
  const role = params.role === "engineer" || params.role === "field_tech" ? params.role : "all";
  const sort = params.sort === "name" ? "name" : "invited";
  /* Invited is newest first by default, name is A to Z: each list's natural reading order. */
  const ascending = params.dir ? params.dir === "asc" : sort === "name";
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  return { term: cleanSearchTerm(params.q ?? ""), status, role, sort, ascending, page };
}

/**
 * The or() a search term becomes: the person's name and email, and the phone
 * matched on its digits however it was typed or stored (the rule client-list.ts
 * uses). Null for no term.
 */
export function onboardingSearchOr(term: string): string | null {
  if (!term) return null;
  const like = `%${term}%`;
  const digits = term.replace(/\D/g, "");
  const phone = digits.length >= 3 ? [`phone.ilike.%${digits.split("").join("%")}%`] : [];
  return [`person_name.ilike.${like}`, `email.ilike.${like}`, ...phone].join(",");
}
