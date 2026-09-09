import "server-only";
import { supabaseAdmin } from "./supabase";

/**
 * WHICH ORDER A FILE IS BEING WORKED UNDER, WHEN IT HAS MORE THAN ONE.
 *
 * Phase 12 Section 3, from the maybeSingle survey. `eng_service_orders` has no
 * unique index on `file_id`, and it should not have one: a job quoted,
 * cancelled, and quoted again is ordinary history, and so is a second
 * engagement on the same property months later.
 *
 * Four call sites asked for that with `.maybeSingle()` and discarded the error.
 * PostgREST answers PGRST116 for a multiple match, so the moment a file carried
 * two orders every one of them read "this file has no order":
 *
 *   recordTechnicianVisit returned silently, so a decline afterwards refunded
 *   in full rather than retaining the disclosed inspection fee;
 *   the desk completeness check reported that no order applied;
 *   the review surfaces showed no order at all;
 *   and the partner commission had no order behind it.
 *
 * "LATEST" AND "PAID" ARE DIFFERENT ANSWERS, WHICH IS WHY THIS IS NOT AN ORDER BY
 * ------------------------------------------------------------------------------
 * Operator ruling at gate 3. The obvious repair is `.order("created_at",
 * desc).limit(1)`, and it is wrong in the case that matters: a file whose paid
 * engagement is followed by a later cancelled quote would answer "cancelled",
 * and every one of the four call sites would then behave as though the work
 * nobody is doing is the work in hand.
 *
 * So the choice is made HERE, in code, against a precedence written down:
 *
 *   1. An order that took money and is live or done: paid, in_fulfilment,
 *      complete. This is the engagement the file is being worked under, and it
 *      is what a technician attending, a desk requirement and a commission are
 *      all about.
 *   2. Failing that, one that took money and gave it back: refunded. It is not
 *      live, and it is still the engagement that happened; a screen showing
 *      nothing would be worse than one showing a refund.
 *   3. Failing that, one that has not become an engagement yet: awaiting
 *      payment, then draft.
 *   4. Failing that, cancelled. Never chosen over anything else, because a
 *      cancelled order is the one state that means "this did not happen".
 *
 * Ties inside a band go to the MOST RECENT, because two live orders on one file
 * is a state nobody has ruled on and the newer is the better guess while
 * nothing says otherwise.
 *
 * The read is bounded at ten. A file with more than ten orders is not a case
 * this precedence was designed for, and taking the ten most recent is a stated
 * bound rather than a silent truncation.
 */

/** Highest first. A status absent from this list sorts last and is named below. */
const PRECEDENCE: string[] = [
  "paid",
  "in_fulfilment",
  "complete",
  "refunded",
  "awaiting_payment",
  "draft",
  "cancelled",
];

const rank = (status: string): number => {
  const at = PRECEDENCE.indexOf(status);
  /* An unknown status sorts after every known one rather than before them. A
   * new status added to the check constraint and not to this list is a thing
   * order-audit fails on, so this branch is a floor and not a policy. */
  return at === -1 ? PRECEDENCE.length : at;
};

/** The statuses this module knows about, for the audit to compare with the schema. */
export const ORDER_PRECEDENCE: readonly string[] = PRECEDENCE;

export type OrderRow = Record<string, unknown> & { id: string; status: string };

/**
 * The order a file is being worked under, or null.
 *
 * Reads the error rather than discarding it: a failed read is answered as null
 * by the caller either way, but it is LOGGED, because "this file has no order"
 * and "the orders could not be read" are different facts and only one of them
 * means there is nothing to do.
 */
export async function orderForFile(
  fileId: string,
  columns: string,
): Promise<OrderRow | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const { data, error } = await db
    .from("eng_service_orders")
    .select(`id, status, created_at, ${columns}`)
    .eq("file_id", fileId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error(`[orders] could not read the orders on file ${fileId}: ${error.message}`);
    return null;
  }

  const rows = (data ?? []) as unknown as OrderRow[];
  if (rows.length === 0) return null;

  /* Already newest first from the query, so a stable sort by rank alone gives
   * "best band, most recent within it" without a second comparison. */
  return [...rows].sort((a, b) => rank(a.status) - rank(b.status))[0] ?? null;
}
