import "server-only";

/**
 * WHAT A FIGURE IS ALLOWED TO COUNT.
 *
 * Operator ruling, Phase 12 Section 2: a report never counts anything seeded,
 * and the exclusion happens AT THE QUERY rather than at the render. A figure
 * filtered on the way out has already been computed wrong; it just has not been
 * shown yet, and the next caller that forgets to filter shows it.
 *
 * WHY THIS IS ONE HELPER AND NOT FIFTY `.eq("is_demo", false)` CALLS
 * ------------------------------------------------------------------
 * Fifty is fifty places to remember, and forgetting is invisible: the figure
 * comes out slightly too high and looks entirely ordinary. One helper with a
 * name means the exclusion is the default and INCLUDING demonstrations is the
 * thing somebody has to write down.
 *
 * WHAT "SEEDED" MEANS HERE, EXACTLY
 * ----------------------------------
 * `is_demo` is true, and nothing else. Operator ruling, 2026-09-08: these
 * helpers do not know about email patterns, reference shapes or seeded names.
 * The database decides, the migration's two directional check keeps the column
 * honest against the reference, and demo-audit is what notices a probe record
 * that arrived without a DEMO number. Three jobs, three places, none of them
 * guessing.
 */

/**
 * The scope a figure is computed over.
 *
 * Spelled as a word rather than a boolean, because `realOnly(true)` at a call
 * site says nothing about what true means, and the wrong one is a silent
 * arithmetic error rather than a crash.
 */
export type FigureScope = "real" | "including_demonstrations";

/**
 * Narrow a PostgREST query to what a figure may count.
 *
 * The default is "real" and callers say so by not saying anything. The other
 * value exists for exactly two callers: the screens that show a demonstration
 * to somebody being shown around, and demo-audit, which has to be able to see
 * the record it just inserted in order to prove the report did not.
 */
export function scopedTo<Q extends { eq: (column: string, value: unknown) => Q }>(
  query: Q,
  scope: FigureScope = "real",
): Q {
  return scope === "including_demonstrations" ? query : query.eq("is_demo", false);
}

/**
 * The same rule as a predicate, for rows already in memory.
 *
 * Used where a helper has fetched a set for another reason and is deriving a
 * figure from it, rather than issuing a query it could narrow. Same definition,
 * so the two cannot disagree about what counts.
 */
export function isReal(row: { is_demo?: boolean | null }): boolean {
  return row.is_demo !== true;
}

/**
 * Tables carrying the column, so a check can assert the set rather than a memory.
 *
 * Declared here and asserted by demo-audit against information_schema, which is
 * what catches a table gaining a seeded record type without gaining the column.
 * eng_leads is deliberately absent: nothing seeds it, and a column that is
 * always false is a question nobody can answer.
 */
/**
 * THE TABLES THAT DELIBERATELY DO NOT CARRY THE COLUMN, AND WHY.
 *
 * Operator ruling, 2026-09-09: record the reason, because the next person will
 * want to add it. Three different reasons, and only the first is "not yet".
 *
 * `eng_customer_accounts`, `eng_order_payments`, `eng_partner_statements` and
 * `eng_production_ledger` are DEPENDENT records. An account is a demonstration
 * exactly when the organisation it belongs to is; a payment exactly when its
 * order is; a statement exactly when its partner is; a ledger entry exactly
 * when its engineer is. Every one of them is scoped through its parent with an
 * inner join, and adding a column would create a SECOND answer that can
 * disagree with the first. The failure that produces is worse than the one it
 * prevents: two rows that are the same fact, one marked and one not, and no way
 * to tell which is right. If you are here to add `is_demo` to one of these,
 * that is the argument you have to beat.
 *
 * `eng_leads` and `eng_quote_requests` carry no column because NOTHING SEEDS
 * THEM. A column that is always false is a question nobody can answer, and a
 * filter on it is a filter nobody can test. The day something seeds a lead, the
 * column goes on in a migration and the filter goes on in the same commit.
 *
 * `eng_messages` and `eng_threads` carry none because they hold no figure the
 * firm claims anything with. The customer service dashboard counts threads by
 * how long they have been quiet, which is a working queue rather than a
 * statement about the business.
 */
export const DEMO_SCOPED_TABLES = [
  "eng_files",
  "eng_service_orders",
  "eng_profiles",
  "eng_clients",
  "eng_partners",
  "eng_applications",
] as const;
