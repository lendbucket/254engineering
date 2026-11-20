import "server-only";
import { supabaseAdmin } from "./supabase";
import { readEvery, readEveryIn } from "./bounded-read";
import { writeAudit } from "./ops-audit";
import { startCheckout } from "./ops-payments";
import { event } from "./ops-intake";
import { queueEmail } from "./ops-jobs";
import { orderTravelPaymentLink } from "./email-templates";
import { money } from "./ops-money";
import { can, type Actor } from "./ops-authz";
import { raiseSystemTask } from "./system-work";
import { travelRefundTerms } from "./ops-orders";
import { catalogFor } from "@data/catalog";
import { countyIsCovered } from "./tech-coverage";

/**
 * ===========================================================================
 * AN ONLINE ORDER OUTSIDE OUR TECHNICIANS' COUNTIES WAITS FOR TRAVEL. Robert's
 * add-on of 2026-11-16 and his answer 12 (6931421644).
 * ===========================================================================
 *
 * The order is placed as every online order is, with every answer, copy and
 * upload in its own evidence, and then held before checkout: no payment is
 * asked for until the office sets travel. The administrator gets one task
 * naming the order and the county. Setting travel adds it to the order as its
 * own line, with its refund terms, opens checkout and sends the customer one
 * payment link for the letter plus travel. Nothing the customer typed is asked
 * again, because the order already holds it, and paying releases the order
 * the way every paid online order is released.
 *
 * HELD AS ORDER EVENTS, read from rows, the way a held file is held as file
 * events (TRAVEL_REQUESTED in ops-job-billing.ts): an order is held while a
 * travel request is newer than any travel set. eng_order_events refuses edits,
 * so when it was held and when travel was set stays. No migration: 0135 gave
 * eng_service_orders its travel_cents column, which checkout already charges
 * as its own line (startCheckout in ops-payments.ts).
 */
export const ORDER_TRAVEL_REQUESTED = "travel.requested";
export const ORDER_TRAVEL_SET = "travel.set";

/** The sentence the customer reads in place of a checkout. Robert's own wording, the county filled in. */
export function travelHeldSays(county: string): string {
  return `Travel to ${county} County is set by the office. You'll get your payment link with travel included, usually within one business hour, 8 AM to 8 PM.`;
}

export type OrderTravelState = { held: false } | { held: true; at: string } | { held: null; error: string };

/** Whether this order is held for travel: a request newer than any travel set. */
export async function orderTravelState(orderId: string): Promise<OrderTravelState> {
  const db = supabaseAdmin();
  if (!db) return { held: null, error: "the database is not configured" };
  const { data, error } = await db
    .from("eng_order_events")
    .select("event, created_at")
    .eq("order_id", orderId)
    .in("event", [ORDER_TRAVEL_REQUESTED, ORDER_TRAVEL_SET])
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return { held: null, error: `the travel hold could not be read: ${error.message}` };
  const last = (data ?? [])[0];
  return last?.event === ORDER_TRAVEL_REQUESTED ? { held: true, at: last.created_at as string } : { held: false };
}

/** The ids of every order held for travel now, for the sweeps that must leave them alone. Null when unreadable. */
export async function ordersHeldForTravel(orderIds: string[]): Promise<Set<string> | null> {
  if (orderIds.length === 0) return new Set();
  const db = supabaseAdmin();
  if (!db) return null;
  /*
   * Chunked and paged, failing whole (the master undone list of 2026-11-19,
   * job two). One .in() over every id was refused past IN_FILTER_CHUNK ids, and
   * past 1,000 event rows PostgREST would have cut the set short with no error,
   * so an order whose latest event fell off the end read as not held.
   */
  const read = await readEveryIn<{ id: number; order_id: string; event: string; created_at: string }>(
    [...new Set(orderIds)],
    (chunk, from, to) =>
      db
        .from("eng_order_events")
        .select("id, order_id, event, created_at")
        .in("order_id", [...chunk])
        .in("event", [ORDER_TRAVEL_REQUESTED, ORDER_TRAVEL_SET])
        .order("id", { ascending: true })
        .range(from, to),
  );
  if (!read.ok) return null;
  /*
   * Newest first across the whole set, by time and then by the event's own
   * serial id, so two events written in the same instant still have an order.
   * A chunked read cannot order the whole set on its own.
   */
  const rows = [...read.rows].sort((a, b) =>
    a.created_at !== b.created_at ? (a.created_at < b.created_at ? 1 : -1) : Number(b.id) - Number(a.id),
  );
  const latest = new Map<string, string>();
  for (const r of rows) if (!latest.has(r.order_id)) latest.set(r.order_id, r.event);
  return new Set([...latest].filter(([, e]) => e === ORDER_TRAVEL_REQUESTED).map(([id]) => id));
}

/**
 * WHETHER A JUST-PLACED ORDER WAITS FOR TRAVEL, decided from the order's own
 * row: the county placeOrder recorded, never one the request sent, and only a
 * field order, because a desk letter sends nobody. An uncovered county holds
 * it; so does a coverage read that failed, so a far-away order never reaches
 * a checkout with no travel on it. A field order whose county is unknown is
 * held too, for the same reason.
 */
export async function orderNeedsTravel(orderId: string): Promise<boolean> {
  const db = supabaseAdmin();
  if (!db) return true;
  const { data: order } = await db.from("eng_service_orders").select("order_type, county, travel_cents").eq("id", orderId).maybeSingle();
  if (!order) return true;
  if (order.order_type !== "field") return false;
  if (order.travel_cents) return false;
  const covered = await countyIsCovered((order.county as string | null) ?? null);
  return covered !== true;
}

export type OrderWaitingForTravel = {
  id: string;
  reference: string;
  county: string;
  propertyAddress: string;
  deliverable: string;
  customerName: string;
  letterCents: number;
  heldAt: string;
};

/**
 * Every unpaid order waiting for travel, oldest first, for the Orders screen.
 * Null when it could not be read, so the screen says so rather than showing
 * nobody waiting.
 */
export async function ordersWaitingForTravel(): Promise<OrderWaitingForTravel[] | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  /*
   * EVERY travel request, paged. This read was `.limit(500)` with no order, so
   * once the firm had asked travel on more than 500 orders, which orders this
   * screen saw was whichever 500 rows came back, and a customer's order held
   * for travel could drop off the one panel that sends its payment link, with
   * nothing saying the list was short (the master undone list of 2026-11-19,
   * job two).
   */
  const askedRead = await readEvery<{ id: number; order_id: string }>((from, to) =>
    db
      .from("eng_order_events")
      .select("id, order_id")
      .eq("event", ORDER_TRAVEL_REQUESTED)
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (!askedRead.ok) return null;
  const ids = [...new Set(askedRead.rows.map((r) => r.order_id))];
  const held = await ordersHeldForTravel(ids);
  if (held === null) return null;
  if (held.size === 0) return [];
  const ordersRead = await readEveryIn<{
    id: string;
    reference: string;
    county: string | null;
    property_address: string;
    service_slug: string;
    tier: string;
    customer_name: string | null;
    total_cents: number;
    status: string;
    created_at: string;
  }>([...held], (chunk, from, to) =>
    db
      .from("eng_service_orders")
      .select("id, reference, county, property_address, service_slug, tier, customer_name, total_cents, status, created_at")
      .in("id", [...chunk])
      .eq("status", "awaiting_payment")
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (!ordersRead.ok) return null;
  /* Oldest first across the whole set, which a chunked read cannot order on its own. */
  const orders = [...ordersRead.rows].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  return orders.map((o) => ({
    id: o.id as string,
    reference: o.reference as string,
    county: String(o.county ?? "").replace(/\s+county$/i, "").trim(),
    propertyAddress: o.property_address as string,
    deliverable: catalogFor(o.service_slug as string, o.tier as string)?.name ?? (o.service_slug as string),
    customerName: (o.customer_name as string) ?? "",
    letterCents: Number(o.total_cents),
    heldAt: o.created_at as string,
  }));
}

/** The longest-standing active administrator, who gets the task, as for a held file. */
async function administratorId(): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db.from("eng_profiles").select("id").eq("role", "admin").eq("status", "active").order("created_at", { ascending: true }).limit(1);
  return ((data ?? [])[0]?.id as string | undefined) ?? null;
}

/**
 * HOLD A JUST-PLACED ONLINE ORDER FOR TRAVEL. Called by the order flow in place
 * of startCheckout. Records the hold on the order's timeline (customer visible,
 * so the status page says what is happening), raises the administrator's task
 * once per order, and audits it. A failed task is reported, never swallowed:
 * the hold stands and the order screen still shows it.
 */
export async function holdOrderForTravel(orderId: string): Promise<{ ok: true; county: string; taskWarning?: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const { data: order, error } = await db
    .from("eng_service_orders")
    .select("id, reference, county, property_address, status, paid_at")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !order) return { ok: false, error: `The order could not be read: ${error?.message ?? "not found"}` };
  if (order.status !== "awaiting_payment" || order.paid_at) return { ok: false, error: "Only an unpaid order can wait for travel." };
  const county = String(order.county ?? "").replace(/\s+county$/i, "").trim() || "this county";

  const state = await orderTravelState(orderId);
  if (state.held === null) return { ok: false, error: `The order could not be held: ${state.error}.` };
  if (!state.held) {
    await event(orderId, ORDER_TRAVEL_REQUESTED, true, `Waiting for the office to set travel to ${county} County before the payment link goes.`, { county });
  }
  const task = await raiseSystemTask({
    key: `order-travel:${orderId}`,
    title: `Set travel for order ${order.reference as string}, ${county} County`,
    description: `An online order for ${order.property_address as string}, ${county} County, is outside the counties our technicians cover. It waits before checkout. Set travel on the Orders screen and the customer's payment link, letter plus travel, goes by itself.`,
    assigneeId: await administratorId(),
  });
  await writeAudit({
    actor: { id: null, role: "customer" },
    action: "order.travel_requested",
    entityType: "order",
    entityId: orderId,
    summary: `${order.reference as string}: held before checkout for travel to ${county} County, outside our technicians' coverage.`,
  });
  return task.ok ? { ok: true, county } : { ok: true, county, taskWarning: `The administrator's task could not be raised: ${task.error}` };
}

/**
 * SET TRAVEL ON A HELD ORDER, AND SEND THE ONE PAYMENT LINK. The administrator
 * alone, by the same grant that sets travel on a job (setTravel in
 * ops-job-billing.ts). Travel becomes the order's own line inside the total,
 * its refund terms are appended to the order's terms in Robert's approved
 * sentence, checkout opens, and the customer is emailed the link. Only an
 * unpaid order held for travel, once.
 */
export async function setOrderTravel(
  actor: Actor | null,
  orderId: string,
  travelCents: number,
  reason: string,
): Promise<{ ok: true; reference: string; emailed: boolean } | { ok: false; error: string }> {
  if (!actor || !can(actor, "pricing.override_at_intake")) return { ok: false, error: "Only an administrator sets travel on an order." };
  if (!Number.isInteger(travelCents) || travelCents <= 0) return { ok: false, error: "Travel is a whole amount above zero." };
  const why = reason.trim();
  if (why.length < 3) return { ok: false, error: "Say why, so the next person reading the order knows. The customer does not see it." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const state = await orderTravelState(orderId);
  if (state.held === null) return { ok: false, error: `Nothing was set: ${state.error}.` };
  if (!state.held) return { ok: false, error: "This order is not waiting for travel." };

  const { data: order, error } = await db
    .from("eng_service_orders")
    .select("id, reference, status, paid_at, county, property_address, service_slug, tier, customer_name, customer_email, total_cents, travel_cents, refund_disclosure")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !order) return { ok: false, error: `The order could not be read: ${error?.message ?? "not found"}` };
  if (order.status !== "awaiting_payment" || order.paid_at) return { ok: false, error: "Travel is set only on an unpaid order." };
  if (order.travel_cents) return { ok: false, error: "Travel is already set on this order." };
  const county = String(order.county ?? "").replace(/\s+county$/i, "").trim();

  const terms = travelRefundTerms(travelCents, county);
  const { data: updated, error: updateError } = await db
    .from("eng_service_orders")
    .update({
      travel_cents: travelCents,
      total_cents: Number(order.total_cents) + travelCents,
      refund_disclosure: order.refund_disclosure ? `${order.refund_disclosure as string} ${terms}` : terms,
    })
    .eq("id", orderId)
    .is("travel_cents", null)
    .eq("status", "awaiting_payment")
    .select("id");
  if (updateError) return { ok: false, error: `Travel could not be saved: ${updateError.message}` };
  if (!updated?.length) return { ok: false, error: "Travel was set by somebody else a moment ago. Reload the screen." };

  await event(orderId, ORDER_TRAVEL_SET, true, `Travel to ${county} County set at ${money(travelCents)}. The payment link has been sent.`, { travel_cents: travelCents });
  await writeAudit({
    actor,
    action: "order.travel_set",
    entityType: "order",
    entityId: orderId,
    summary: `${order.reference as string}: travel to ${county} County set at ${money(travelCents)}. ${why}`,
    diff: { travel_cents: travelCents, total_cents: Number(order.total_cents) + travelCents },
  });

  const checkout = await startCheckout(orderId);
  if (!checkout.ok) return { ok: false, error: `Travel is set on ${order.reference as string}, and the payment link could not be made: ${checkout.error}. Try again from the Orders screen.` };
  const entry = catalogFor(order.service_slug as string, order.tier as string);
  const queued = await queueEmail(
    orderTravelPaymentLink({
      customerName: (order.customer_name as string) || "Hello",
      customerEmail: order.customer_email as string,
      reference: order.reference as string,
      propertyAddress: order.property_address as string,
      deliverableName: entry?.name ?? "letter",
      county,
      letterAmount: money(Number(order.total_cents)),
      travelAmount: money(travelCents),
      totalAmount: money(Number(order.total_cents) + travelCents),
      payUrl: checkout.url,
    }),
  );
  return { ok: true, reference: order.reference as string, emailed: queued.ok };
}
