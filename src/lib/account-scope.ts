import "server-only";
import { DB_NOW } from "./db-now";
import { supabaseAdmin } from "./supabase";
import { writeAudit } from "./ops-audit";

/**
 * WHICH ACCOUNTS A READ IS ALLOWED TO SEE.
 *
 * Operator ruling, 2026-09-14: an account is superseded, never removed, and
 * every read excludes superseded accounts by default with an explicit opt-in,
 * the `is_demo` shape.
 *
 * WHY THIS IS ONE HELPER AND NOT THIRTY `.is("superseded_at", null)` CALLS
 * ------------------------------------------------------------------------
 * The same reasoning `src/lib/reporting-scope.ts` makes for demonstration
 * records, and it is worth restating because the failure mode is identical:
 * thirty is thirty places to remember, and forgetting is INVISIBLE. A
 * superseded duplicate reappears in a list, in a count, or in a total, and
 * looks entirely ordinary. One helper with a name means the exclusion is the
 * default and INCLUDING superseded accounts is the thing somebody has to write
 * down.
 *
 * SUPERSEDED IS NOT CLOSED, AND NOTHING HERE CONFLATES THEM
 * ----------------------------------------------------------
 * `status = 'closed'` means the relationship ended and everything on the
 * account is a true record of work that happened. `superseded_at` means the
 * ROW was wrong: a duplicate, a typo, an organisation opened twice. A closed
 * account still appears in every list, because it is a real customer who
 * stopped trading. A superseded one does not, because it was never a separate
 * customer at all.
 *
 * WHAT IT DOES NOT DO IS HIDE THE MONEY
 * --------------------------------------
 * The orders, statements and trade prices attached to a superseded account are
 * untouched and still reachable, which is the whole reason the account is
 * superseded rather than deleted. This scopes reads of ACCOUNTS; it says
 * nothing about reads of what an account was charged.
 */

/**
 * The set of accounts a read may see.
 *
 * Spelled as a word rather than a boolean, because `includeSuperseded(true)` at
 * a call site says nothing about what true means, and the wrong one is a silent
 * wrong count rather than a crash. Same reasoning as `FigureScope`.
 */
export type AccountScope = "in_use" | "including_superseded";

/**
 * Narrow a PostgREST query to the accounts a read may see.
 *
 * The default is "in_use" and callers say so by not saying anything. The other
 * value exists for exactly two kinds of caller: a screen that is showing
 * somebody the supersession itself, and an export that has to reconcile against
 * every row that ever existed.
 */
export function withAccountScope<T>(query: T, scope: AccountScope = "in_use"): T {
  if (scope === "including_superseded") return query;
  return (query as { is: (c: string, v: null) => T }).is("superseded_at", null);
}

export type SupersedeResult = { ok: true } | { ok: false; error: string };

/**
 * Mark an account as one that should not have existed separately.
 *
 * THE REASON IS NOT OPTIONAL AND THE MINIMUM IS ENFORCED TWICE.
 *
 * A soft delete with no reason is a row nobody can interpret, and the person
 * asking about it a year later cannot tell a deliberate correction from a
 * mistake somebody made in a hurry. The check constraint in 0048 requires ten
 * characters; this refuses earlier so the operator gets a sentence rather than
 * a constraint violation.
 *
 * WHAT IT DELIBERATELY DOES NOT TOUCH: the orders, the statements, the trade
 * prices. Those are the record of what somebody was charged and they are the
 * reason this is a supersession rather than a delete.
 */
export async function supersedeAccount(input: {
  accountId: string;
  reason: string;
  actor: { id: string | null; email: string; role: string };
}): Promise<SupersedeResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const reason = input.reason.trim();
  if (reason.length < 10) {
    return {
      ok: false,
      error:
        "Say why in a sentence. A superseded account with no reason is a row nobody can interpret, " +
        "and the person asking about it later cannot tell a correction from a mistake.",
    };
  }

  const { data: existing } = await db
    .from("eng_customer_accounts")
    .select("id, superseded_at")
    .eq("id", input.accountId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "That account does not exist." };

  /*
   * ALREADY SUPERSEDED IS A REFUSAL, not a no-op. Writing a second reason over
   * the first would lose the answer to "why was this done", which is the one
   * thing the column is for.
   */
  if (existing.superseded_at) {
    return { ok: false, error: "That account is already superseded. The reason it carries is the one that was given." };
  }

  const { error } = await db
    .from("eng_customer_accounts")
    .update({
      superseded_at: DB_NOW,
      superseded_reason: reason,
      superseded_by_profile_id: input.actor.id,
      superseded_by_email: input.actor.email,
    })
    .eq("id", input.accountId)
    .is("superseded_at", null);

  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actor: input.actor,
    action: "customer_account.superseded",
    entityType: "customer_account",
    entityId: input.accountId,
    summary: `Account marked superseded: ${reason}`,
    diff: { reason },
  });

  return { ok: true };
}
