/**
 * The one rule a search box needs before it asks the server: how short a term
 * is too short to search. Client safe, so the header's search box and the
 * server's search read the same number (src/lib/ops-search.ts re-exports it).
 */
export const SEARCH_MIN_LENGTH = 3;

/**
 * The term as a pattern can carry it: the characters PostgREST's or() treats
 * as syntax removed. One home, so the record search and every list's search box
 * clean a term the same way (office ready, 2026-10-24).
 */
export function cleanSearchTerm(raw: string): string {
  return raw.replace(/[%,()*\\]/g, " ").replace(/\s+/g, " ").trim();
}
