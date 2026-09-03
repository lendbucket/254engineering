import "server-only";
import { supabaseAdmin } from "./supabase";
import { markAbandoned, markPaid, paymentProvider } from "./ops-payments";
import { event } from "./ops-intake";
import { judge, type ProviderAnswer, type ReconcileVerdict } from "./reconcile-rules";

/**
 * Asking the payment provider what really happened.
 *
 * WHY A PLATFORM THAT RECEIVES WEBHOOKS STILL HAS TO ASK
 * ------------------------------------------------------
 * A webhook is a message and messages are lost. When one is, the order stays at
 * awaiting_payment, and from inside the platform that looks exactly like a
 * customer who opened a checkout and wandered off. One of those people has been
 * charged and has no order, and would find out by telephoning.
 *
 * That happened here on 2026-09-03. Three orders reached Stripe during the
 * payment leg while the endpoint was not yet subscribed to
 * checkout.session.completed. There is no event to redeliver, because the event
 * was never sent to anybody. The only remaining authority on whether that money
 * moved is Stripe, and the only way to consult it is to ask.
 *
 * WHAT THIS FILE IS AND IS NOT
 * ----------------------------
 * The decisions live in reconcile-rules, which has no database and no network
 * and is walked case by case by order-audit. This file gathers the provider's
 * answer, carries out the decision, and writes down what it did.
 *
 * It never invents money. A payment is recorded through markPaid, the same
 * function the webhook calls, so the dispatch, the customer link and the audit
 * row cannot diverge between the two paths. There is no second way for an order
 * to become paid.
 *
 * It reads by default. Writing takes an explicit apply.
 */

export type ReconcileAction =
  | "none"
  | "recorded_payment"
  | "would_record_payment"
  | "cancelled"
  | "would_cancel";

export type ReconcileFinding = {
  orderId: string;
  reference: string;
  orderStatus: string;
  sessionRef: string | null;
  verdict: ReconcileVerdict;
  action: ReconcileAction;
  orderTotalCents: number | null;
  providerAmountCents: number | null;
  detail: string;
};

export type ReconcileReport = {
  provider: string;
  configured: boolean;
  applied: boolean;
  examined: number;
  findings: ReconcileFinding[];
};

/**
 * The session ref lives in the checkout.started event rather than a column.
 *
 * That is where startCheckout already writes it, and the event trail is append
 * only, so it cannot be edited after the fact. Reading it from there needs no
 * migration and creates no second source of truth to keep in step.
 */
async function sessionRefFor(orderId: string): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("eng_order_events")
    .select("detail, created_at")
    .eq("order_id", orderId)
    .eq("event", "checkout.started")
    .order("created_at", { ascending: false })
    .limit(1);

  const detail = data?.[0]?.detail as { session_ref?: unknown } | null | undefined;
  const ref = detail?.session_ref;
  return typeof ref === "string" && ref.length > 0 ? ref : null;
}

/** Orders the platform is still waiting on. The only ones worth asking about. */
export async function unreconciledOrders(): Promise<
  { id: string; reference: string; status: string; totalCents: number | null; createdAt: string }[]
> {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from("eng_service_orders")
    .select("id, reference, status, total_cents, created_at")
    .eq("status", "awaiting_payment")
    .order("created_at", { ascending: true });

  return (data ?? []).map((o) => ({
    id: o.id as string,
    reference: o.reference as string,
    status: o.status as string,
    totalCents: o.total_cents === null ? null : Number(o.total_cents),
    createdAt: o.created_at as string,
  }));
}

/** Ask the provider, turning every failure into an answer rather than a throw. */
async function askProvider(sessionRef: string | null): Promise<ProviderAnswer> {
  if (!sessionRef) return { known: false, reason: "no_session" };

  const provider = paymentProvider();
  if (!provider.configured()) {
    return { known: false, reason: "unreachable", message: "payments are not configured on this deployment" };
  }

  try {
    const status = await provider.retrieveCheckout(sessionRef);
    if (!status) return { known: false, reason: "unknown_to_provider" };
    return { known: true, status };
  } catch (err) {
    return {
      known: false,
      reason: "unreachable",
      message: err instanceof Error ? err.message : "the call failed",
    };
  }
}

/**
 * Reconcile one order.
 *
 * Exported on its own because settling a single named reference is what an
 * operator does when a customer is on the telephone saying they were charged,
 * and that should not require running a sweep over everything.
 */
export async function reconcileOrder(
  order: { id: string; reference: string; status: string; totalCents: number | null },
  options: { apply: boolean },
): Promise<ReconcileFinding> {
  const sessionRef = await sessionRefFor(order.id);
  const answer = await askProvider(sessionRef);
  const ruling = judge({ totalCents: order.totalCents }, answer);

  const providerAmountCents = answer.known ? answer.status.amountCents : null;
  const base = {
    orderId: order.id,
    reference: order.reference,
    orderStatus: order.status,
    sessionRef,
    verdict: ruling.verdict,
    orderTotalCents: order.totalCents,
    providerAmountCents,
  };

  if (ruling.intent === "none") {
    /*
     * A disagreement about the amount is written into the order's own history
     * when applying, so the next person to open it finds the discrepancy
     * waiting rather than having to run the sweep again to learn it exists.
     */
    if (options.apply && ruling.verdict === "amount_disagrees") {
      await event(order.id, "reconcile.amount_disagrees", false, ruling.detail, {
        session_ref: sessionRef,
        provider_amount_cents: providerAmountCents,
        order_total_cents: order.totalCents,
      });
    }
    return { ...base, action: "none", detail: ruling.detail };
  }

  if (ruling.intent === "cancel") {
    if (!options.apply) {
      return { ...base, action: "would_cancel", detail: `${ruling.detail} Applying would cancel it.` };
    }
    const closed = await markAbandoned(
      order.id,
      "You opened a checkout and did not finish it, so the order was closed. Nothing was charged.",
    );
    return {
      ...base,
      action: closed.ok && closed.changed ? "cancelled" : "none",
      detail:
        closed.ok && closed.changed
          ? "The checkout closed unpaid, so the order is cancelled. Nothing was charged."
          : "The checkout closed unpaid, and the order had already moved on.",
    };
  }

  // record_payment. judge() has already established there is a charge ref and
  // that the amount matches the order, so these assertions cannot fail.
  const status = answer.known ? answer.status : null;
  if (!status || status.chargeRef === null || status.amountCents === null) {
    return { ...base, action: "none", detail: ruling.detail };
  }

  if (!options.apply) {
    return {
      ...base,
      action: "would_record_payment",
      detail: `${ruling.detail} Applying would record the charge and release the work.`,
    };
  }

  const recorded = await markPaid({
    orderId: order.id,
    chargeRef: status.chargeRef,
    amountCents: status.amountCents,
    provider: paymentProvider().name,
  });

  if (!recorded.ok) {
    return { ...base, action: "none", detail: `${ruling.detail} Recording it failed: ${recorded.error}` };
  }

  if (recorded.alreadyRecorded) {
    return {
      ...base,
      verdict: "agrees",
      action: "none",
      detail: "The provider took this payment and it was already recorded. Nothing changed.",
    };
  }

  /*
   * Marked as reconciled rather than left looking like a normal payment. An
   * order whose money arrived through a sweep instead of a webhook is worth
   * being able to find later, when somebody asks why the webhook was silent.
   */
  await event(
    order.id,
    "reconcile.recorded_payment",
    false,
    `Recorded from the provider rather than from a webhook. Session ${sessionRef}.`,
    { session_ref: sessionRef, charge_ref: status.chargeRef },
  );

  return {
    ...base,
    action: "recorded_payment",
    detail: `Recorded ${status.amountCents} cents against ${status.chargeRef} and released the work.`,
  };
}

/** The sweep. Every order the platform is still waiting on, asked about in turn. */
export async function reconcileAll(options: {
  apply: boolean;
  references?: string[];
}): Promise<ReconcileReport> {
  const provider = paymentProvider();
  const all = await unreconciledOrders();

  /*
   * Narrowing by reference is how the first real run of this was done: three
   * known orders, named, rather than a sweep over everything at once. A tool
   * whose first exercise is unbounded is a tool nobody can check the output of.
   */
  const targets = options.references?.length
    ? all.filter((o) => options.references!.includes(o.reference))
    : all;

  const findings: ReconcileFinding[] = [];
  for (const order of targets) {
    findings.push(await reconcileOrder(order, options));
  }

  return {
    provider: provider.name,
    configured: provider.configured(),
    applied: options.apply,
    examined: targets.length,
    findings,
  };
}
