import "server-only";
import { DB_NOW } from "./db-now";
import { supabaseAdmin } from "./supabase";
import { readEvery, readEveryIn } from "./bounded-read";

/**
 * The payment event ledger (0075, operator rulings 2026-10-12).
 *
 * Every event that applies money is recorded once by its id before any effect,
 * and the effect commits in the same transaction as the record: one function
 * per webhook branch, in the migration. This module is the TypeScript side of
 * that: calling a branch's function, and finishing an event whose work was
 * released after commit.
 *
 * CLAIMED THEN DONE. A payment that releases work commits with its event
 * claimed, because the release (the file, the customer's link, the
 * confirmation, the account) reaches past the transaction. The event is marked
 * done only once the release succeeds. A resend of a claimed event is
 * processed rather than skipped: the money is already written, so it goes
 * straight to the release, which is safe to run twice.
 */

/* staff_recorded (0138): a payment received outside the platform, recorded on its job by the administrator. */
export type PaymentEventSource = "stripe_webhook" | "reconcile" | "staff_recorded";

/** What a branch function answered. */
export type AppliedOutcome =
  | "applied"
  | "done"
  | "claimed"
  | "charge_already_recorded"
  | "refund_already_recorded"
  | "nothing_to_record"
  /* 0076: a refund update whose refund has no row here, or that moved nothing. */
  | "no_refund_on_file"
  | "unchanged";

export type Applied =
  | { ok: true; outcome: AppliedOutcome; release: string[]; detail: Record<string, unknown> }
  | { ok: false; error: string };

/** Fifteen minutes claimed and not done is "Paid, work not released" (ruling 2026-10-12). */
export const UNRELEASED_AFTER_MINUTES = 15;

export async function applyPaymentEvent(
  fn:
    | "eng_apply_order_paid"
    | "eng_apply_batch_paid"
    | "eng_apply_statement_paid"
    | "eng_apply_checkout_expired"
    | "eng_apply_refund"
    | "eng_apply_refund_update",
  p: Record<string, unknown>,
): Promise<Applied> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  const { data, error } = await db.rpc(fn, { p });
  if (error) return { ok: false, error: error.message };

  const answer = (data ?? {}) as Record<string, unknown>;
  const release = Array.isArray(answer.release) ? (answer.release as unknown[]).map(String) : [];
  return { ok: true, outcome: answer.outcome as AppliedOutcome, release, detail: answer };
}

/** A claimed event whose release finished: done, in its own write. */
export async function finishPaymentEvent(eventId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };
  const { error } = await db
    .from("eng_payment_events")
    .update({ status: "done", done_at: DB_NOW })
    .eq("event_id", eventId)
    .eq("status", "claimed");
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * A release that did not finish. The event stays claimed, so the next delivery
 * releases again, and the attempt and its reason are on the row for whoever
 * opens "Paid, work not released".
 */
export async function recordReleaseFailure(eventId: string, why: string): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;
  const { data } = await db
    .from("eng_payment_events")
    .select("release_attempts")
    .eq("event_id", eventId)
    .maybeSingle();
  const { error } = await db
    .from("eng_payment_events")
    .update({ release_attempts: Number(data?.release_attempts ?? 0) + 1, last_error: why.slice(0, 500) })
    .eq("event_id", eventId)
    .eq("status", "claimed");
  if (error) console.error(`[payments] could not record a failed release for ${eventId}: ${error.message}`);
}

export type UnreleasedPayment = {
  eventId: string;
  reference: string;
  claimedAt: string;
  minutes: number;
  attempts: number;
  lastError: string | null;
};

/**
 * Every payment claimed for more than fifteen minutes and not done: money that
 * is written and work that is not released. Null when it could not be read,
 * which is not the same as none.
 */
export async function unreleasedPayments(now: number = Date.now()): Promise<UnreleasedPayment[] | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  /*
   * EVERY UNRELEASED PAYMENT, AND EVERY REFERENCE, AT ANY COUNT. Master list
   * N15 and the .in() survey (BACKLOG "SCREEN READS THAT STILL HIDE A
   * FAILURE"), 2026-11-22. This read the oldest 200 with nothing saying more
   * existed, so the dashboard's count and the payments alert stopped at 200;
   * and it sent their order ids in one .in(), which the transport refuses past
   * 150, so from 151 unreleased payments the whole read failed and the alert
   * said it could not read at the moment it mattered most. Paged and chunked,
   * as the other money lists of 2026-11-19 are, and still null on any failure.
   */
  const cutoff = new Date(now - UNRELEASED_AFTER_MINUTES * 60_000).toISOString();
  const read = await readEvery<{
    event_id: string;
    order_id: string | null;
    batch_id: string | null;
    claimed_at: string;
    release_attempts: number | null;
    last_error: string | null;
  }>((from, to) =>
    db
      .from("eng_payment_events")
      .select("event_id, order_id, batch_id, claimed_at, release_attempts, last_error")
      .eq("status", "claimed")
      .lt("claimed_at", cutoff)
      .order("claimed_at", { ascending: true })
      .order("event_id", { ascending: true })
      .range(from, to),
  );
  if (!read.ok) {
    console.error(`[payments] the unreleased payments could not be read: ${read.error}`);
    return null;
  }
  const rows = read.rows;
  if (rows.length === 0) return [];

  const orderIds = [...new Set(rows.map((r) => r.order_id).filter(Boolean) as string[])];
  const batchIds = [...new Set(rows.map((r) => r.batch_id).filter(Boolean) as string[])];
  const refs = new Map<string, string>();
  if (orderIds.length) {
    const orders = await readEveryIn<{ id: string; reference: string }>(orderIds, (chunk, from, to) =>
      db.from("eng_service_orders").select("id, reference").in("id", [...chunk]).order("id", { ascending: true }).range(from, to),
    );
    if (!orders.ok) return null;
    for (const o of orders.rows) refs.set(o.id, o.reference);
  }
  if (batchIds.length) {
    const batches = await readEveryIn<{ id: string; reference: string }>(batchIds, (chunk, from, to) =>
      db.from("eng_order_batches").select("id, reference").in("id", [...chunk]).order("id", { ascending: true }).range(from, to),
    );
    if (!batches.ok) return null;
    for (const b of batches.rows) refs.set(b.id, b.reference);
  }

  return rows.map((r) => ({
    eventId: r.event_id as string,
    reference:
      refs.get((r.order_id ?? r.batch_id ?? "") as string) ?? `an event with no order on file (${r.event_id})`,
    claimedAt: r.claimed_at as string,
    minutes: Math.floor((now - Date.parse(r.claimed_at as string)) / 60_000),
    attempts: Number(r.release_attempts ?? 0),
    lastError: (r.last_error as string | null) ?? null,
  }));
}
