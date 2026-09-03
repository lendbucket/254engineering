import "server-only";
import { supabaseAdmin } from "./supabase";
import { business } from "@/config/business";
import { writeAudit } from "./ops-audit";
import { catalogFor } from "@data/catalog";
import { canTransitionOrder, landingStatusFor, quoteFor, refundFor, type ReviewOutcome } from "./ops-orders";
import { event, issueCustomerLink } from "./ops-intake";
import { isKnown, money } from "./ops-money";
import { fakeProvider, type PaymentProvider } from "./payments";
import { stripeProvider } from "./payments-stripe";

/**
 * The platform side of money: starting a checkout, recording a payment, and
 * carrying out the refund rule.
 *
 * NOTHING HERE DECIDES WHAT TO REFUND
 * -----------------------------------
 * refundFor in ops-orders decides, purely, and order-audit checks it across a
 * matrix. This module's job is to ask it, move the money, and write down what
 * happened. Splitting those is what lets the ethics rule be tested without a
 * network and the plumbing be tested without re-deriving the ethics.
 */

let override: PaymentProvider | null = null;

/**
 * Which provider to use.
 *
 * ORDER_PAYMENTS_FAKE exists so the walkthrough and the audit can run the whole
 * path locally. It is compared to the exact string, like every other flag in
 * this repository, and it is refused outright on a Vercel deployment: a fake
 * till on a real deployment would take an order, tell the customer they had
 * paid, and move nothing.
 */
export function paymentProvider(): PaymentProvider {
  if (override) return override;
  if (process.env.ORDER_PAYMENTS_FAKE === "1") {
    if (process.env.VERCEL_DEPLOYMENT_ID) {
      throw new Error(
        "ORDER_PAYMENTS_FAKE is set on a deployment. A fake till would tell a customer they had paid and move nothing.",
      );
    }
    override = fakeProvider();
    return override;
  }
  return stripeProvider();
}

/** For the walkthrough, so it can read what the provider was asked to do. */
export function setPaymentProvider(provider: PaymentProvider | null): void {
  override = provider;
}

// ------------------------------------------------------------------ checkout

export type CheckoutResult =
  | { ok: true; url: string; sessionRef: string }
  | { ok: false; error: string };

/**
 * Start a checkout for an order that is waiting to be paid.
 *
 * The amount is recomputed from the order's own snapshotted figures rather than
 * from the catalog, because the catalog may have changed since the customer
 * agreed. The order is what they agreed to.
 */
export async function startCheckout(orderId: string): Promise<CheckoutResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  const provider = paymentProvider();
  if (!provider.configured()) {
    return { ok: false, error: "Payments are not configured on this deployment." };
  }

  const { data: order } = await db
    .from("eng_service_orders")
    .select(
      "id, reference, status, service_slug, customer_email, total_cents, price_cents, coastal_surcharge_cents, currency, twia_county, county, property_address",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { ok: false, error: "That order does not exist." };
  if (order.status !== "awaiting_payment") {
    return { ok: false, error: `That order is ${order.status} and is not waiting for payment.` };
  }
  if (!isKnown(order.total_cents === null ? null : Number(order.total_cents))) {
    return { ok: false, error: "That order has no total, so it cannot be charged." };
  }

  const entry = catalogFor(order.service_slug as string);
  const lines = entry
    ? quoteFor(
        {
          ...entry,
          priceCents: order.price_cents === null ? null : Number(order.price_cents),
          coastalSurchargeCents:
            order.coastal_surcharge_cents === null ? null : Number(order.coastal_surcharge_cents),
        },
        Boolean(order.twia_county),
        order.county as string,
      ).lines
    : [];

  const chargeable = lines
    .filter((l) => isKnown(l.amountCents) && (l.amountCents as number) > 0)
    .map((l) => ({ label: l.label, amountCents: l.amountCents as number }));

  const session = await provider.createCheckout({
    reference: order.reference as string,
    orderId: order.id as string,
    amountCents: Number(order.total_cents),
    currency: (order.currency as string) ?? "usd",
    customerEmail: order.customer_email as string,
    description: `${entry?.serviceSlug ?? order.service_slug} at ${order.property_address}`,
    lines: chargeable.length ? chargeable : [{ label: "Sealed document", amountCents: Number(order.total_cents) }],
    successUrl: `${business.url}/order/${order.reference}?paid=1`,
    cancelUrl: `${business.url}/order/${order.reference}?cancelled=1`,
  });

  await event(orderId, "checkout.started", false, `Checkout opened for ${money(Number(order.total_cents))}.`, {
    session_ref: session.ref,
    provider: provider.name,
  });

  return { ok: true, url: session.url, sessionRef: session.ref };
}

// -------------------------------------------------------------------- paid

/**
 * Record a completed payment and move the work forward.
 *
 * IDEMPOTENT, BECAUSE WEBHOOKS ARE DELIVERED MORE THAN ONCE
 * ---------------------------------------------------------
 * The unique index on (provider, provider_ref) is what actually enforces it: a
 * second delivery of the same charge conflicts and this returns the same
 * answer rather than dispatching the job twice.
 */
export async function markPaid(input: {
  orderId: string;
  chargeRef: string;
  amountCents: number;
  provider: string;
}): Promise<{ ok: true; alreadyRecorded: boolean } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  const { data: order } = await db
    .from("eng_service_orders")
    .select("id, reference, status, order_type, file_id, customer_email, total_cents")
    .eq("id", input.orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "That order does not exist." };

  const { error: payError } = await db.from("eng_order_payments").insert({
    order_id: input.orderId,
    kind: "charge",
    amount_cents: input.amountCents,
    provider: input.provider,
    provider_ref: input.chargeRef,
    status: "succeeded",
  });

  if (payError) {
    /*
     * 23505 is the unique violation on (provider, provider_ref), which means
     * this exact charge is already recorded. That is a duplicate delivery, not
     * a failure, and everything below it has already happened.
     */
    if (payError.code === "23505") return { ok: true, alreadyRecorded: true };
    return { ok: false, error: payError.message };
  }

  if (!canTransitionOrder(order.status as never, "paid")) {
    await event(input.orderId, "payment.unexpected", false, `A payment arrived while the order was ${order.status}.`);
    return { ok: true, alreadyRecorded: false };
  }

  const paidAt = new Date().toISOString();
  await db
    .from("eng_service_orders")
    .update({ status: "in_fulfilment", paid_at: paidAt })
    .eq("id", input.orderId);

  await event(
    input.orderId,
    "payment.received",
    true,
    `Payment of ${money(input.amountCents)} received. The firm is arranging the work.`,
  );

  /*
   * Where the work goes. A field order needs a technician before an engineer has
   * anything to look at; a desk order already has everything the customer was
   * asked for, so it goes straight into the review queue and no dispatch it does
   * not need is ever created.
   */
  const target = landingStatusFor(order.order_type as "field" | "desk" | "quote");
  if (target && order.file_id) {
    await db.from("eng_files").update({ status: target }).eq("id", order.file_id);
    await event(
      input.orderId,
      "work.released",
      false,
      target === "needs_dispatch"
        ? "The file is released for dispatch."
        : "The file is released into the review queue.",
    );
  } else if (target && !order.file_id) {
    await event(
      input.orderId,
      "work.blocked",
      false,
      "Paid, and there is no file to release. Somebody has to open one by hand.",
    );
  }

  /*
   * The customer's way in. Issued on payment rather than at placement, so an
   * abandoned checkout never produces a link to an order nobody paid for.
   */
  const link = await issueCustomerLink({ orderId: input.orderId });
  if (link) {
    await event(input.orderId, "customer_link.issued", false, "A status link was issued for the customer.");
  }

  await writeAudit({
    actor: { id: null, role: "admin", email: "order-engine@254engineering.com" },
    action: "order.paid",
    entityType: "service_order",
    entityId: input.orderId,
    summary: `${order.reference}: ${money(input.amountCents)} received via ${input.provider}`,
  });

  return { ok: true, alreadyRecorded: false };
}

// ------------------------------------------------------------------ refunds

export type RefundOutcome =
  | { ok: true; refundedCents: number; retainedCents: number; caseName: string }
  | { ok: false; error: string };

/**
 * Carry out the refund rule after an engineer's decision.
 *
 * Operator ruling, 2026-09-02, three cases:
 *
 *   declined before any visit or review   full refund
 *   declined after a technician visited   refund less the disclosed fee
 *   declined after desk review, no visit  full refund
 *
 * THE FEE COMES FROM THE ORDER, NOT THE CATALOG
 * ---------------------------------------------
 * inspection_fee_cents on the order is the fee that was DISCLOSED to this
 * customer at checkout. Reading the catalog instead would let a fee raised last
 * month retain more from somebody who was told a smaller number, which is the
 * reason the figure is snapshotted onto the order at all.
 *
 * A SEAL REFUNDS NOTHING AND STILL RETURNS OK
 * -------------------------------------------
 * Called for every decision, not only refusals, so there is exactly one place
 * that knows what a decision does to the money. A caller that had to remember
 * to skip it on a seal is a caller that will one day forget on a refusal.
 */
export async function settleDecision(input: {
  orderId: string;
  outcome: ReviewOutcome;
  actorId?: string | null;
}): Promise<RefundOutcome> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  const { data: order } = await db
    .from("eng_service_orders")
    .select("id, reference, status, inspection_fee_cents, technician_visited, currency")
    .eq("id", input.orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "That order does not exist." };

  const { data: charges } = await db
    .from("eng_order_payments")
    .select("provider, provider_ref, amount_cents")
    .eq("order_id", input.orderId)
    .eq("kind", "charge")
    .eq("status", "succeeded");

  const paidCents = (charges ?? []).reduce((n, c) => n + Number(c.amount_cents), 0);
  const charge = (charges ?? [])[0];

  const decision = refundFor({
    paidCents: charges && charges.length ? paidCents : null,
    inspectionFeeCents:
      order.inspection_fee_cents === null ? null : Number(order.inspection_fee_cents),
    outcome: input.outcome,
    technicianVisited: Boolean(order.technician_visited),
  });

  if (!isKnown(decision.refundCents) || !isKnown(decision.retainedCents)) {
    await event(
      input.orderId,
      "refund.blocked",
      false,
      `The refund could not be worked out: ${decision.explanation}`,
    );
    return { ok: false, error: decision.explanation };
  }

  if (decision.refundCents === 0) {
    await event(input.orderId, "refund.none", true, decision.explanation);
    return {
      ok: true,
      refundedCents: 0,
      retainedCents: decision.retainedCents,
      caseName: decision.caseName,
    };
  }

  if (!charge) {
    /*
     * Nothing was ever charged, so there is nothing to give back. Recorded as
     * an event rather than an error: a file declined before payment is a normal
     * thing and the customer owes nothing either way.
     */
    await event(input.orderId, "refund.not_needed", true, "Nothing had been charged, so nothing is refunded.");
    return { ok: true, refundedCents: 0, retainedCents: 0, caseName: decision.caseName };
  }

  const provider = paymentProvider();
  const result = await provider.refund({
    chargeRef: charge.provider_ref as string,
    amountCents: decision.refundCents,
    reason: decision.caseName,
  });

  const { error: rowError } = await db.from("eng_order_payments").insert({
    order_id: input.orderId,
    kind: "refund",
    amount_cents: result.amountCents,
    provider: provider.name,
    provider_ref: result.ref,
    status: result.status,
    refund_case: decision.caseName,
    failure_reason: result.failureReason ?? null,
  });

  if (result.status === "failed") {
    await event(
      input.orderId,
      "refund.failed",
      false,
      `The refund of ${money(decision.refundCents)} failed: ${result.failureReason ?? "no reason given"}. It has to be done by hand.`,
    );
    return { ok: false, error: result.failureReason ?? "The refund failed." };
  }

  /*
   * A REFUND THIS PLATFORM COULD NOT RECORD IS NOT A COMPLETED REFUND.
   *
   * The first version wrote the customer facing "you have been refunded" event
   * whether or not the payment row landed, and only skipped the status change.
   * A walkthrough hit it through a colliding provider ref and the result was
   * the worst possible shape: the customer told they were refunded, the order
   * still reading in fulfilment, and no payment row anywhere to reconcile.
   *
   * The money may well have moved at the provider by this point, so the event
   * says exactly that rather than pretending either way, and it is internal.
   * Telling a customer a refund failed when the provider has already sent it
   * would be its own wrong answer.
   */
  if (rowError) {
    await event(
      input.orderId,
      "refund.unrecorded",
      false,
      `A refund of ${money(decision.refundCents)} was accepted by ${provider.name} as ${result.ref} and could not be written down here: ${rowError.message}. Reconcile against the provider before doing anything else.`,
    );
    return {
      ok: false,
      error: "The refund went through and could not be recorded. It needs reconciling by hand.",
    };
  }

  if (canTransitionOrder(order.status as never, "refunded")) {
    await db
      .from("eng_service_orders")
      .update({ status: "refunded", refunded_at: new Date().toISOString() })
      .eq("id", input.orderId);
  }

  await event(input.orderId, "refund.issued", true, decision.explanation, {
    refunded_cents: decision.refundCents,
    retained_cents: decision.retainedCents,
    case: decision.caseName,
  });

  await writeAudit({
    actor: input.actorId
      ? { id: input.actorId, role: "engineer" }
      : { id: null, role: "admin", email: "order-engine@254engineering.com" },
    action: "order.refunded",
    entityType: "service_order",
    entityId: input.orderId,
    summary: `${order.reference}: ${decision.caseName}, ${money(decision.refundCents)} refunded, ${money(decision.retainedCents)} retained`,
  });

  return {
    ok: true,
    refundedCents: decision.refundCents,
    retainedCents: decision.retainedCents,
    caseName: decision.caseName,
  };
}

/** Mark that somebody actually attended. The refund rule turns on this alone. */
export async function recordTechnicianVisit(fileId: string): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;

  const { data: order } = await db
    .from("eng_service_orders")
    .select("id, technician_visited")
    .eq("file_id", fileId)
    .maybeSingle();
  if (!order || order.technician_visited) return;

  await db.from("eng_service_orders").update({ technician_visited: true }).eq("id", order.id);
  await event(
    order.id as string,
    "visit.recorded",
    false,
    "A technician attended. From here a decline retains the disclosed inspection fee.",
  );
}

/**
 * Is a desk order's package complete?
 *
 * WHY THIS EXISTS, AND THE BLOCKER IT FIXES
 * -----------------------------------------
 * checklistState says a package can be submitted when every required protocol
 * item is satisfied AND there is at least one required item. That second
 * condition is deliberate and it was right for every file that existed before
 * Phase 7: a technician must not be able to submit a field job with no protocol
 * attached, because that is gathering nothing and calling it done.
 *
 * Phase 7 introduced a file that legitimately has no evidence protocol. A desk
 * order has no site visit; its evidence is the documents the customer supplied
 * through the order flow, which live in eng_order_inputs and not in the
 * evidence checklist. Under the old rule every desk order was permanently
 * unsealable, which was found by trying to seal one.
 *
 * So completeness for a desk order asks the question that actually applies to
 * it: did the customer provide what the catalog required?
 *
 * THE ORIGINAL PROTECTION IS UNTOUCHED
 * ------------------------------------
 * A file with no order behind it returns false, so a staff opened file with no
 * protocol is still incomplete exactly as before. A FIELD order returns false
 * too, because a field job with no protocol is the case the old rule was
 * guarding and nothing about Phase 7 makes it acceptable.
 */
export async function deskPackageComplete(
  fileId: string,
): Promise<{ applies: boolean; complete: boolean; blockers: string[] }> {
  const db = supabaseAdmin();
  if (!db) return { applies: false, complete: false, blockers: [] };

  const { data: order } = await db
    .from("eng_service_orders")
    .select("id, order_type, service_slug")
    .eq("file_id", fileId)
    .maybeSingle();

  if (!order || order.order_type !== "desk") return { applies: false, complete: false, blockers: [] };

  const entry = catalogFor(order.service_slug as string);
  const required = (entry?.requiredInputs ?? []).filter((i) => i.required);

  const { data: supplied } = await db
    .from("eng_order_inputs")
    .select("key")
    .eq("order_id", order.id)
    .eq("kind", "input");

  const have = new Set((supplied ?? []).map((r) => r.key as string));
  const missing = required.filter((i) => !have.has(i.id));

  return {
    applies: true,
    complete: missing.length === 0,
    blockers: missing.map((i) => `${i.label}: the customer did not supply this.`),
  };
}

/** The order behind a file, for the review surfaces. */
export async function orderForFile(fileId: string) {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("eng_service_orders")
    .select("id, reference, status, total_cents, inspection_fee_cents, technician_visited, refund_disclosure")
    .eq("file_id", fileId)
    .maybeSingle();
  return data ?? null;
}
