import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { writeAuditOrRefuse } from "./ops-audit";
import { cancelAndRefund, refundableOn } from "./ops-payments";
import { money } from "./ops-money";
import { readEvery } from "./bounded-read";

/**
 * REFUND REQUESTS, AND WHO MAY DECIDE THEM. Operator ruling, 2026-10-20. 0079.
 *
 * A rep asks; somebody else decides. The operations manager decides up to the
 * limit the operator sets, which starts at $0 until he sets it. An
 * administrator holding payments.refund decides any amount.
 *
 * THE LIMIT IS ENFORCED THREE TIMES, ON PURPOSE, AND EACH CATCHES A DIFFERENT
 * FAILURE:
 *   1. here, before anything moves, against what is owed now;
 *   2. in cancelAndRefund, against the amount it computes immediately before
 *      the provider is asked, so a figure that went stale between the two
 *      still cannot move more than the limit;
 *   3. in the database, eng_refund_decisions_within_limit, so an approval row
 *      above the limit it names cannot exist at all.
 *
 * Every step writes the audit row first through writeAuditOrRefuse: a refund
 * decision nobody can find afterwards is the one record this firm most needs.
 */

export type RefundLimit = { ok: true; cents: number; setAt: string | null; setBy: string | null } | { ok: false; error: string };

/** The newest limit row. No row at all is $0, which is the operator's ruling. */
export async function currentRefundLimit(): Promise<RefundLimit> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured, so the refund limit could not be read." };
  const { data, error } = await db
    .from("eng_refund_approval_limits")
    .select("limit_cents, created_at, set_by")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: `The refund limit could not be read: ${error.message}` };
  if (!data) return { ok: true, cents: 0, setAt: null, setBy: null };
  return { ok: true, cents: Number(data.limit_cents), setAt: data.created_at as string, setBy: data.set_by as string };
}

export async function setRefundLimit(
  actor: Actor | null,
  input: { cents: number; reason: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!actor || !can(actor, "settings.refund_limit")) return { ok: false, error: "Your role cannot set the refund limit." };
  if (!Number.isInteger(input.cents) || input.cents < 0) {
    return { ok: false, error: "The limit is a whole number of cents, zero or more." };
  }
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured, so nothing was changed." };

  const before = await currentRefundLimit();
  const recorded = await writeAuditOrRefuse({
    actor,
    action: "settings.refund_limit_set",
    entityType: "refund_limit",
    summary: `Refund approval limit set to ${money(input.cents)}.`,
    diff: { from_cents: before.ok ? before.cents : null, to_cents: input.cents, reason: input.reason },
  });
  if (!recorded.ok) return recorded;

  const { error } = await db
    .from("eng_refund_approval_limits")
    .insert({ limit_cents: input.cents, set_by: actor.id, reason: input.reason?.trim() || null });
  if (error) return { ok: false, error: `The limit could not be saved: ${error.message}` };
  return { ok: true };
}

export type RefundRequestRow = {
  id: string;
  createdAt: string;
  orderId: string;
  orderReference: string | null;
  requestedBy: string;
  requestedByName: string | null;
  reason: string;
  owedCentsAtRequest: number;
  decision: null | {
    decision: "approved" | "declined";
    decidedAt: string;
    decidedByName: string | null;
    refundedCents: number | null;
    note: string | null;
  };
};

const canSeeRequests = (actor: Actor | null) =>
  can(actor, "refunds.request") || can(actor, "refunds.approve_within_limit") || can(actor, "payments.refund");

export async function requestRefund(
  actor: Actor | null,
  input: { orderId: string; reason: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!actor || !can(actor, "refunds.request")) return { ok: false, error: "Your role cannot ask for a refund." };
  const reason = input.reason.trim();
  if (reason.length < 10) return { ok: false, error: "Say why in at least 10 characters. It is the record of why the money would move." };

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured, so nothing was asked." };

  const { data: order, error: orderError } = await db
    .from("eng_service_orders")
    .select("id, reference")
    .eq("id", input.orderId)
    .maybeSingle();
  if (orderError) return { ok: false, error: `The order could not be read: ${orderError.message}` };
  if (!order) return { ok: false, error: "That order does not exist." };

  const open = await openRequestFor(input.orderId);
  if (!open.ok) return open;
  if (open.id) return { ok: false, error: `Order ${order.reference} already has a refund request waiting for a decision.` };

  const owed = await refundableOn(input.orderId);
  if (!owed.ok) return owed;

  const recorded = await writeAuditOrRefuse({
    actor,
    action: "refund.requested",
    entityType: "service_order",
    entityId: input.orderId,
    summary: `${order.reference}: refund requested, ${money(owed.owedCents)} owed back. ${reason}`,
    diff: { owed_cents: owed.owedCents },
  });
  if (!recorded.ok) return recorded;

  const { data, error } = await db
    .from("eng_refund_requests")
    .insert({ order_id: input.orderId, requested_by: actor.id, reason, owed_cents: owed.owedCents })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: `The request could not be saved: ${error?.message ?? "no row"}` };
  return { ok: true, id: String(data.id) };
}

/** The undecided request on an order, if there is one. A failed read is said, not read as none. */
async function openRequestFor(orderId: string): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const { data, error } = await db
    .from("eng_refund_requests")
    .select("id, eng_refund_decisions(id)")
    .eq("order_id", orderId);
  if (error) return { ok: false, error: `The refund requests on this order could not be read: ${error.message}` };
  const open = (data ?? []).find((r) => {
    const d = (r as { eng_refund_decisions?: unknown }).eng_refund_decisions;
    return !d || (Array.isArray(d) && d.length === 0);
  });
  return { ok: true, id: open ? String(open.id) : null };
}

export async function decideRefund(
  actor: (Actor & { email: string }) | null,
  input: { requestId: string; decision: "approved" | "declined"; note: string | null },
): Promise<{ ok: true; refundedCents: number | null } | { ok: false; error: string }> {
  const unlimited = can(actor, "payments.refund");
  if (!actor || !(unlimited || can(actor, "refunds.approve_within_limit"))) {
    return { ok: false, error: "Your role cannot decide a refund request." };
  }
  if (input.decision !== "approved" && input.decision !== "declined") return { ok: false, error: "Approve or decline." };

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured, so nothing was decided." };

  const { data: request, error: requestError } = await db
    .from("eng_refund_requests")
    .select("id, order_id, requested_by, reason, eng_service_orders(reference), eng_refund_decisions(id)")
    .eq("id", input.requestId)
    .maybeSingle();
  if (requestError) return { ok: false, error: `The request could not be read: ${requestError.message}` };
  if (!request) return { ok: false, error: "That refund request does not exist." };
  const decided = (request as { eng_refund_decisions?: unknown[] }).eng_refund_decisions;
  if (Array.isArray(decided) && decided.length > 0) return { ok: false, error: "That request has already been decided." };

  /* Nobody decides their own request. A limit is a second pair of eyes or it is nothing. */
  if (request.requested_by === actor.id && !unlimited) {
    return { ok: false, error: "A request is decided by somebody other than the person who asked." };
  }

  const reference = ((request as { eng_service_orders?: { reference?: string } }).eng_service_orders?.reference) ?? "this order";
  const owed = await refundableOn(request.order_id as string);
  if (!owed.ok) return owed;

  let limitCents: number | null = null;
  if (!unlimited) {
    const limit = await currentRefundLimit();
    if (!limit.ok) return { ok: false, error: `${limit.error} Nothing was decided.` };
    limitCents = limit.cents;
    if (input.decision === "approved" && owed.owedCents > limitCents) {
      return {
        ok: false,
        error: `${reference} would refund ${money(owed.owedCents)}, over your approval limit of ${money(limitCents)}. An administrator can approve it.`,
      };
    }
  }

  const recorded = await writeAuditOrRefuse({
    actor,
    action: input.decision === "approved" ? "refund.approved" : "refund.declined",
    entityType: "service_order",
    entityId: request.order_id as string,
    summary: `${reference}: refund request ${input.decision}, ${money(owed.owedCents)} owed back.${input.note ? ` ${input.note}` : ""}`,
    diff: { request_id: request.id, owed_cents: owed.owedCents, limit_cents: limitCents },
  });
  if (!recorded.ok) return recorded;

  let refundedCents: number | null = null;
  let providerRef: string | null = null;
  if (input.decision === "approved") {
    const refunded = await cancelAndRefund({
      orderId: request.order_id as string,
      reason: `Refund request approved. ${request.reason as string}`,
      actor: { id: actor.id, role: actor.role, email: actor.email },
      ...(unlimited ? {} : { maxRefundCents: limitCents ?? 0 }),
    });
    if (!refunded.ok) return { ok: false, error: `${refunded.error} The request is still waiting.` };
    refundedCents = refunded.refundedCents;
    providerRef = refunded.providerRef || null;
  }

  const { error } = await db.from("eng_refund_decisions").insert({
    request_id: request.id,
    decided_by: actor.id,
    decision: input.decision,
    owed_cents: owed.owedCents,
    limit_cents: limitCents,
    note: input.note?.trim() || null,
    refunded_cents: refundedCents,
    provider_ref: providerRef,
  });
  if (error) {
    /*
     * The money may already have moved, and the order's own ledger and audit
     * trail say so. What failed is only this request's record of its decision,
     * and that is said plainly rather than reported as success.
     */
    return {
      ok: false,
      error:
        input.decision === "approved"
          ? `The refund went through and its decision could not be recorded on the request: ${error.message}. The order's history shows the refund.`
          : `The decline could not be recorded: ${error.message}`,
    };
  }
  return { ok: true, refundedCents };
}

export async function listRefundRequests(
  actor: Actor | null,
  filter: { state: "waiting" | "decided" | "all" } = { state: "waiting" },
): Promise<{ ok: true; rows: RefundRequestRow[] } | { ok: false; error: string }> {
  if (!canSeeRequests(actor)) return { ok: false, error: "Your role cannot see refund requests." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured, so no request could be read." };

  const read = await readEvery<Record<string, unknown>>((from, to) =>
    db
      .from("eng_refund_requests")
      .select(
        "id, created_at, order_id, requested_by, reason, owed_cents, eng_service_orders(reference), " +
          "requester:eng_profiles!eng_refund_requests_requested_by_fkey(display_name), " +
          "eng_refund_decisions(decision, created_at, refunded_cents, note, decider:eng_profiles!eng_refund_decisions_decided_by_fkey(display_name))",
      )
      .order("created_at", { ascending: true })
      /* A concatenated select with named joins, which the client cannot type, so the row shape is stated. */
      .range(from, to) as unknown as PromiseLike<{ data: Record<string, unknown>[] | null; count: number | null; error: { message: string } | null }>,
  );
  if (!read.ok) return { ok: false, error: `Refund requests could not be read: ${read.error}` };

  const rows: RefundRequestRow[] = read.rows.map((raw) => {
    const r = raw as unknown as Record<string, unknown>;
    const ds = (r.eng_refund_decisions as Record<string, unknown>[] | null) ?? [];
    const d = ds[0];
    return {
      id: String(r.id),
      createdAt: String(r.created_at),
      orderId: String(r.order_id),
      orderReference: ((r.eng_service_orders as { reference?: string } | null)?.reference) ?? null,
      requestedBy: String(r.requested_by),
      requestedByName: ((r.requester as { display_name?: string } | null)?.display_name) ?? null,
      reason: String(r.reason),
      owedCentsAtRequest: Number(r.owed_cents),
      decision: d
        ? {
            decision: d.decision as "approved" | "declined",
            decidedAt: String(d.created_at),
            decidedByName: ((d.decider as { display_name?: string } | null)?.display_name) ?? null,
            refundedCents: d.refunded_cents === null ? null : Number(d.refunded_cents),
            note: (d.note as string | null) ?? null,
          }
        : null,
    };
  });

  const filtered =
    filter.state === "all" ? rows : rows.filter((r) => (filter.state === "waiting" ? r.decision === null : r.decision !== null));
  return { ok: true, rows: filtered };
}
