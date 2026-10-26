/**
 * PARTNER BILLING, THE RULES. Pure, so the proof can hand them Stripe's own
 * test-mode shapes and read the answer without a key, a network or a database.
 * The writes are in partner-billing.ts.
 *
 * Operator ruling of 2026-10-11: $800 upfront and $99 a month, paid to 254
 * through 254's one Stripe account. The plan is docs/partner-billing-plan.md.
 *
 * ONE ENDPOINT, TWO LANES THAT CANNOT CROSS. Every partner billing object
 * carries metadata.kind = "partner_billing" and metadata.partner_id. The
 * webhook asks partnerBillingEventOf first; anything it claims never reaches the
 * order path, and anything carrying the partner kind together with an order,
 * batch or statement id is refused, because that mix is the one this design
 * exists to prevent.
 */
import { PARTNER_BILLING, PARTNER_BILLING_KIND } from "@/config/partner-billing";

export type BillingStatus = "active" | "past_due" | "suspended" | "cancelled";

export type PartnerBillingEvent = {
  /** Stripe's event id: the idempotency key, so a redelivery applies nothing twice. */
  eventId: string;
  type:
    | "checkout.completed"
    | "invoice.paid"
    | "invoice.payment_failed"
    | "subscription.updated"
    | "subscription.deleted";
  partnerId: string;
  customerRef: string | null;
  subscriptionRef: string | null;
  /** The end of the paid period, when the event carries one. ISO. */
  periodEnd: string | null;
};

export type PartnerLaneVerdict =
  | { lane: "partner"; event: PartnerBillingEvent }
  | { lane: "refused"; why: string }
  | { lane: "orders" };

/** The Stripe event types the partner lane handles, as Stripe names them. */
export const PARTNER_BILLING_STRIPE_EVENTS = [
  "checkout.session.completed",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
] as const;

type Meta = Record<string, string> | null | undefined;
type Loose = Record<string, unknown>;

const refOf = (v: unknown): string | null =>
  typeof v === "string" ? v : v && typeof v === "object" && typeof (v as Loose).id === "string" ? ((v as Loose).id as string) : null;

const isoOf = (seconds: unknown): string | null =>
  typeof seconds === "number" && Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null;

/**
 * Where the partner metadata sits on each object. A Checkout Session and a
 * Subscription carry it directly. An Invoice carries its subscription's
 * metadata under subscription_details, which newer API versions moved under
 * parent; both places are read, because the account's default version decides
 * the shape and this adapter pins none.
 */
function metadataOf(type: string, object: Loose): Meta {
  if (type.startsWith("invoice.")) {
    const parent = object.parent as Loose | undefined;
    const fromParent = (parent?.subscription_details as Loose | undefined)?.metadata as Meta;
    const fromInvoice = (object.subscription_details as Loose | undefined)?.metadata as Meta;
    return fromParent ?? fromInvoice ?? (object.metadata as Meta);
  }
  return object.metadata as Meta;
}

function subscriptionOf(type: string, object: Loose): string | null {
  if (type.startsWith("customer.subscription.")) return refOf(object.id);
  if (type.startsWith("invoice.")) {
    const parent = object.parent as Loose | undefined;
    return refOf((parent?.subscription_details as Loose | undefined)?.subscription) ?? refOf(object.subscription);
  }
  return refOf(object.subscription);
}

function periodEndOf(type: string, object: Loose): string | null {
  if (type.startsWith("customer.subscription.")) {
    const direct = isoOf(object.current_period_end);
    if (direct) return direct;
    const items = (object.items as Loose | undefined)?.data as Loose[] | undefined;
    return isoOf(items?.[0]?.current_period_end);
  }
  if (type.startsWith("invoice.")) {
    const lines = (object.lines as Loose | undefined)?.data as Loose[] | undefined;
    const ends = (lines ?? []).map((l) => (l.period as Loose | undefined)?.end).filter((e) => typeof e === "number") as number[];
    return ends.length ? isoOf(Math.max(...ends)) : null;
  }
  return null;
}

/**
 * Which lane a verified Stripe event belongs to. Asked FIRST, before the order
 * path reads anything, because a subscription checkout carries no payment
 * intent and the order path would otherwise log it as a charge with nothing to
 * record against.
 */
export function partnerBillingEventOf(event: { id: string; type: string; data: { object: unknown } }): PartnerLaneVerdict {
  const object = (event.data?.object ?? {}) as Loose;
  const meta = metadataOf(event.type, object);
  if (meta?.kind !== PARTNER_BILLING_KIND) return { lane: "orders" };

  if (meta.order_id || meta.batch_id || meta.statement_id) {
    return {
      lane: "refused",
      why: `${event.type} ${event.id} carries the partner billing kind and an order, batch or statement id together, which no object this platform creates ever does.`,
    };
  }
  const partnerId = meta.partner_id;
  if (!partnerId) return { lane: "refused", why: `${event.type} ${event.id} carries the partner billing kind and no partner_id.` };

  const type =
    event.type === "checkout.session.completed"
      ? "checkout.completed"
      : event.type === "invoice.paid"
        ? "invoice.paid"
        : event.type === "invoice.payment_failed"
          ? "invoice.payment_failed"
          : event.type === "customer.subscription.updated"
            ? "subscription.updated"
            : event.type === "customer.subscription.deleted"
              ? "subscription.deleted"
              : null;
  if (!type) {
    return { lane: "refused", why: `${event.type} ${event.id} is a partner billing object of a type this lane does not handle.` };
  }
  return {
    lane: "partner",
    event: {
      eventId: event.id,
      type,
      partnerId,
      customerRef: refOf(object.customer),
      subscriptionRef: subscriptionOf(event.type, object),
      periodEnd: periodEndOf(event.type, object),
    },
  };
}

export type BillingRow = {
  status: BillingStatus;
  past_due_since: string | null;
  current_period_end: string | null;
  stripe_customer_ref: string | null;
  stripe_subscription_ref: string | null;
};

/**
 * What a billing row becomes after one event. Null means the event changes
 * nothing, which is a valid answer: a paid invoice on an active row only moves
 * the period.
 *
 * - The checkout completing, or an invoice being paid: active, and a past due
 *   date cleared.
 * - An invoice failing: past due, from the first failure; a later failure does
 *   not move the date, because the grace period counts from the first.
 * - The subscription ending: cancelled, and only a new checkout reopens the row.
 * - A subscription update moves only the paid period.
 *
 * Suspension is not here. It is the platform's own transition when the grace
 * period runs out, and the grace period is not ruled (graceExpired).
 */
export function nextBillingRow(row: BillingRow | null, event: PartnerBillingEvent, nowIso: string): BillingRow | null {
  const base: BillingRow = row ?? {
    status: "active",
    past_due_since: null,
    current_period_end: null,
    stripe_customer_ref: null,
    stripe_subscription_ref: null,
  };
  const refs = {
    stripe_customer_ref: event.customerRef ?? base.stripe_customer_ref,
    stripe_subscription_ref: event.subscriptionRef ?? base.stripe_subscription_ref,
    current_period_end: event.periodEnd ?? base.current_period_end,
  };
  /* A cancelled row reopens only through a new checkout; a late invoice or
   * update for the ended subscription changes nothing. */
  if (base.status === "cancelled" && row && event.type !== "checkout.completed") return null;

  switch (event.type) {
    case "checkout.completed":
    case "invoice.paid":
      return { ...base, ...refs, status: "active", past_due_since: null };
    case "invoice.payment_failed":
      return { ...base, ...refs, status: "past_due", past_due_since: base.past_due_since ?? nowIso };
    case "subscription.deleted":
      return { ...base, ...refs, status: "cancelled", past_due_since: null };
    case "subscription.updated":
      if (!row) return null;
      return refs.current_period_end === base.current_period_end ? null : { ...base, ...refs };
  }
}

/**
 * Whether a past due row has run out of grace. Null while the grace period is
 * unruled: nothing is suspended on a number nobody chose.
 */
export function graceExpired(row: BillingRow, nowIso: string, graceDays: number | null = PARTNER_BILLING.gracePeriodDays): boolean | null {
  if (graceDays === null) return null;
  if (row.status !== "past_due" || !row.past_due_since) return false;
  return Date.parse(nowIso) - Date.parse(row.past_due_since) >= graceDays * 86_400_000;
}

/**
 * Whether billing lets a partner order and keep a live page. While billing is
 * off, it gates nothing: no partner is asked to pay, so none can be behind. A
 * partner with no billing row once billing is on has not paid, and is refused.
 */
export function billingAllowsOrdering(status: BillingStatus | null, enabled: boolean = PARTNER_BILLING.enabled): boolean {
  if (!enabled) return true;
  return status === "active" || status === "past_due";
}

/**
 * The Checkout Session a partner is sent to. Subscription mode, one recurring
 * monthly line and one one-time line, which Stripe bills together on the first
 * invoice. Inline prices, so no Price object has to exist in the dashboard
 * first. The partner kind and id ride on the session AND on subscription_data,
 * so every later invoice and subscription event carries them too.
 */
export function partnerCheckoutParams(input: {
  partnerId: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const metadata = { kind: PARTNER_BILLING_KIND, partner_id: input.partnerId };
  return {
    params: {
      mode: "subscription" as const,
      /* Cards only, as the order checkout (finding F11, Robert's answer of 2026-10-25). */
      payment_method_types: ["card" as const],
      customer_email: input.email,
      client_reference_id: input.partnerId,
      metadata,
      subscription_data: { metadata },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: PARTNER_BILLING.currency,
            unit_amount: PARTNER_BILLING.monthlyCents,
            recurring: { interval: "month" as const },
            product_data: { name: PARTNER_BILLING.monthlyLabel },
          },
        },
        {
          quantity: 1,
          price_data: {
            currency: PARTNER_BILLING.currency,
            unit_amount: PARTNER_BILLING.upfrontCents,
            product_data: { name: PARTNER_BILLING.upfrontLabel },
          },
        },
      ],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    },
    idempotencyKey: `partner-billing:${input.partnerId}`,
  };
}
