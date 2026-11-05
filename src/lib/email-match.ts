/**
 * An email address as an exact, case-insensitive ILIKE pattern.
 *
 * Auth audit L5, 2026-11-02: the customer and partner sign in matched the
 * typed address with `ilike`, where `%` and `_` are wildcards, so a typed `%`
 * matched the oldest account, and `%`, `%a`, `%b` were separate limiter
 * identities against that one account. Comparing with `eq` on a lowered
 * address would miss a row stored in mixed case, because the unique index is
 * on lower(email) and the column keeps the spelling it was given. So the
 * match stays case-insensitive and every wildcard character is escaped:
 * backslash first, then percent and underscore, using Postgres's default
 * LIKE escape character.
 */
export function exactEmailPattern(email: string): string {
  return email.trim().replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
