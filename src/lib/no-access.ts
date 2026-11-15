import "server-only";
import { supabaseAdmin } from "./supabase";
import { money } from "./ops-money";
import { TRIP_FEE_CENTS } from "@/config/prices";

/**
 * ===========================================================================
 * A VISIT THAT COULD NOT GET IN, AND WHETHER ITS TRIP FEE IS PAID. 0134.
 * ===========================================================================
 *
 * Robert's answers 7 to 10 of 2026-11-14 (E5): when the technician cannot get
 * in at the agreed time, a $125 trip fee is charged on its own before the
 * visit is booked again.
 *
 * Read from rows, the way the engineer's pre-review hold is (dispatch-hold.ts),
 * so there is no status word for it: the file is at needs dispatch, and
 * sendOffers refuses while the LATEST no-access visit has no paid trip fee. A
 * failed read refuses too, because an offer sent past an unpaid fee is a visit
 * nobody has paid for.
 *
 * A REFUNDED TRIP FEE COUNTS AS UNPAID. The fee is not refunded when a job is
 * declined (answer 10), so a refund here is somebody correcting a charge by
 * hand, and once the money is back the visit is not paid for.
 */

const PAID = ["paid", "in_fulfilment", "complete"];

export type TripOrder = { id: string; reference: string; status: string };

export type NoAccessState =
  | { kind: "none" }
  | { kind: "unpaid"; visitId: string; at: string; techId: string; note: string; tripOrder: TripOrder | null }
  | { kind: "paid"; visitId: string; at: string; techId: string; note: string; tripOrder: TripOrder }
  | { kind: "unknown"; error: string };

/** The file's latest no-access visit and its trip fee. */
export async function noAccessState(fileId: string): Promise<NoAccessState> {
  const db = supabaseAdmin();
  if (!db) return { kind: "unknown", error: "the database is not configured" };

  const { data: visits, error: visitError } = await db
    .from("eng_no_access_visits")
    .select("id, created_at, tech_id, note")
    .eq("file_id", fileId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (visitError) return { kind: "unknown", error: `the visits could not be read: ${visitError.message}` };
  const visit = (visits ?? [])[0];
  if (!visit) return { kind: "none" };

  const { data: orders, error: orderError } = await db
    .from("eng_service_orders")
    .select("id, reference, status, created_at")
    .eq("trip_for_visit", visit.id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(5);
  if (orderError) return { kind: "unknown", error: `the trip fee could not be read: ${orderError.message}` };

  const base = { visitId: visit.id as string, at: visit.created_at as string, techId: visit.tech_id as string, note: visit.note as string };
  const rows = (orders ?? []).map((o) => ({ id: o.id as string, reference: o.reference as string, status: o.status as string }));
  const paid = rows.find((o) => PAID.includes(o.status));
  if (paid) return { kind: "paid", ...base, tripOrder: paid };
  return { kind: "unpaid", ...base, tripOrder: rows.find((o) => o.status === "awaiting_payment") ?? null };
}

/** The sentence sendOffers refuses with, or null when nothing holds the job. */
export function noAccessRefusal(state: NoAccessState): string | null {
  if (state.kind === "unknown") return `This job could not be checked for an unpaid trip fee, so it is not dispatched: ${state.error}.`;
  if (state.kind !== "unpaid") return null;
  return `The technician could not get in at the last visit. The ${money(TRIP_FEE_CENTS)} trip fee is not paid yet, so the visit is not booked again until it is.`;
}
