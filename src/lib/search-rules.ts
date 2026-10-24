/**
 * The one rule a search box needs before it asks the server: how short a term
 * is too short to search. Client safe, so the header's search box and the
 * server's search read the same number (src/lib/ops-search.ts re-exports it).
 */
export const SEARCH_MIN_LENGTH = 3;
