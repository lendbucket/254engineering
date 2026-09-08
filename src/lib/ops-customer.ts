import "server-only";
import { supabaseAdmin } from "./supabase";
import { business } from "@/config/business";
import { catalogFor } from "@data/catalog";
import { orderForCustomerToken } from "./ops-intake";
import { CUSTOMER_STATUS, type OrderStatus } from "./ops-orders";
import { money, type Cents } from "./ops-money";

/**
 * What a customer sees about their own order.
 *
 * WHAT THIS DELIBERATELY DOES NOT RETURN
 * --------------------------------------
 * The file number, the technician's name, the engineer's name, the production
 * pay, the margin, and every internal event. A customer asked "where is my
 * letter", and answering it does not require handing them the firm's operating
 * record.
 *
 * The filter is `customer_visible` on the event, set at the point each event is
 * written rather than decided here. That way a new event added next year is
 * private until somebody deliberately makes it public, which is the right
 * default for a table that will accumulate events nobody reviewed.
 */

export type CustomerView = {
  reference: string;
  status: OrderStatus;
  statusLine: string;
  serviceName: string;
  propertyAddress: string;
  city: string | null;
  county: string;
  placedAt: string | null;
  /** What they were told before paying, verbatim, still available afterwards. */
  refundDisclosure: string | null;
  lines: { label: string; amount: string }[];
  total: string;
  /** Only the events marked for them, oldest first. */
  timeline: { at: string; summary: string }[];
  /** What they receive at the end, from the catalog they bought from. */
  receives: string[];
  /** Set when money has come back, so the page leads with it. */
  refunded: { amount: string; retained: string; because: string } | null;
};

const cents = (v: unknown): Cents => (v === null || v === undefined ? null : Number(v));

/**
 * The customer's way back in, built in one place.
 *
 * Every email that carries this link and the page that answers it agree by
 * construction rather than by two string templates that happen to match today.
 * The reference is in the path because it is what a customer quotes on the
 * phone and what makes the entry recognisable in their history; the token is
 * the query, and the reference alone opens nothing.
 */
export function customerStatusUrl(reference: string, token: string): string {
  return `${business.url}/order/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`;
}

/**
 * A timestamp a customer can read.
 *
 * Templates in this repository take dates already formatted, because a template
 * is a pure function with no locale and no opinion about the reader. The order
 * row carries an ISO string, and putting that in front of a customer
 * ("2026-09-03T11:42:07.318Z") reads as a bug in the email rather than as a
 * time. This is the one place that turns one into the other.
 *
 * Written out in the same shape the alert templates already use, so the two
 * halves of this firm's outbound mail state a time the same way.
 */
export function customerWhen(iso: string | null): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Chicago",
  });
}

/**
 * Resolve a customer's token to their order.
 *
 * A bad token, a revoked one and an expired one all return null, and the page
 * says the same thing for all three. Telling somebody their link has expired
 * rather than that it is wrong would confirm the order exists to anybody
 * guessing.
 */
export async function customerView(token: string): Promise<CustomerView | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const subject = await orderForCustomerToken(token);
  if (!subject?.orderId) return null;

  const { data: order } = await db
    .from("eng_service_orders")
    .select(
      "id, reference, status, service_slug, tier, property_address, city, county, price_cents, coastal_surcharge_cents, total_cents, inspection_fee_cents, twia_county, placed_at, refund_disclosure",
    )
    .eq("id", subject.orderId)
    .maybeSingle();
  if (!order) return null;

  const entry = catalogFor(order.service_slug as string, (order.tier as string | null) ?? undefined);

  const { data: events } = await db
    .from("eng_order_events")
    .select("created_at, summary")
    .eq("order_id", order.id)
    .eq("customer_visible", true)
    .order("created_at", { ascending: true });

  const { data: payments } = await db
    .from("eng_order_payments")
    .select("kind, amount_cents, status, refund_case")
    .eq("order_id", order.id)
    .eq("status", "succeeded");

  const charged = (payments ?? [])
    .filter((p) => p.kind === "charge")
    .reduce((n, p) => n + Number(p.amount_cents), 0);
  const refundedCents = (payments ?? [])
    .filter((p) => p.kind === "refund")
    .reduce((n, p) => n + Number(p.amount_cents), 0);
  const refundCase = (payments ?? []).find((p) => p.kind === "refund")?.refund_case as string | undefined;

  const lines: CustomerView["lines"] = [
    { label: entry?.name ?? (order.service_slug as string), amount: money(cents(order.price_cents)) },
  ];
  if (order.twia_county && order.coastal_surcharge_cents !== null) {
    lines.push({ label: "Coastal county", amount: money(cents(order.coastal_surcharge_cents)) });
  }

  return {
    reference: order.reference as string,
    status: order.status as OrderStatus,
    statusLine: CUSTOMER_STATUS[order.status as OrderStatus],
    serviceName: entry?.name ?? (order.service_slug as string),
    propertyAddress: order.property_address as string,
    city: (order.city as string | null) ?? null,
    county: order.county as string,
    placedAt: (order.placed_at as string | null) ?? null,
    refundDisclosure: (order.refund_disclosure as string | null) ?? null,
    lines,
    total: money(cents(order.total_cents)),
    timeline: (events ?? []).map((e) => ({
      at: e.created_at as string,
      summary: e.summary as string,
    })),
    receives: entry?.receives ?? [],
    refunded:
      refundedCents > 0
        ? {
            amount: money(refundedCents),
            retained: money(charged - refundedCents),
            because: refundCase ?? "The engineer could not seal this.",
          }
        : null,
  };
}
