import "server-only";
import { chargesBlockedReason } from "./launch";
import { DB_NOW } from "./db-now";
import { readEvery } from "./bounded-read";
import { orderForFile as liveOrderForFile } from "./order-for-file";
import { supabaseAdmin } from "./supabase";
import { business } from "@/config/business";
import { deploymentOrigin } from "./site-url";
import { planReversals, reverseForRefund, type PlannedReversal } from "./ops-partner-comp";
import {
  applyPaymentEvent,
  finishPaymentEvent,
  recordReleaseFailure,
  type PaymentEventSource,
} from "./payment-events";
import { writeAudit } from "./ops-audit";
import { can, type Actor } from "./ops-authz";
import { catalogFor } from "@data/catalog";
import {
  canTransitionOrder,
  FIRM_CANCELLATION_CASE,
  landingStatusFor,
  quoteFor,
  refundFor,
  refundForFirmCancellation,
  type ReviewOutcome,
} from "./ops-orders";
import { event, issueCustomerLink } from "./ops-intake";
import { createCustomerAccount } from "./account-creation";
import { normaliseAddress } from "./email-address";
import { accountWelcome } from "./email-templates";
import { customerStatusUrl, customerView, customerWhen } from "./ops-customer";
import { queueEmail } from "./ops-jobs";
import { orderConfirmed, orderDeclined, orderSealed, refundFailed } from "./email-templates";
import { transitionFile, SYSTEM_AUTHOR } from "./ops-crm";
import { isKnown, money } from "./ops-money";
import { LIVE_KEY_FIX, LIVE_KEY_HEADLINE, liveKeyOffProduction } from "./db-guard";
import { fakeProvider, type PaymentProvider } from "./payments";
import { stripeProvider } from "./payments-stripe";
import { abandonedSoFar } from "./bounded-fetch";

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
  /*
   * THE GATE, ASKED HERE RATHER THAN UPSTREAM. See chargesBlockedReason in
   * launch.ts: every function that reaches the payment provider asks it, and
   * money-audit enumerates them from the source.
   */
  const blocked = chargesBlockedReason();
  if (blocked) {
    console.error(`[payments] startCheckout refused: ${blocked}`);
    return { ok: false, error: blocked };
  }

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  const provider = paymentProvider();
  if (!provider.configured()) {
    /*
     * Named rather than generic, because the two reasons a provider is not
     * configured need different actions: a missing key is a gap, and a live key
     * off production is a mistake that would have moved real money.
     */
    if (liveKeyOffProduction()) {
      console.error(`[payments] ${LIVE_KEY_HEADLINE}. ${LIVE_KEY_FIX}`);
      return { ok: false, error: LIVE_KEY_HEADLINE + ". " + LIVE_KEY_FIX };
    }
    return { ok: false, error: "Payments are not configured on this deployment." };
  }

  const { data: order } = await db
    .from("eng_service_orders")
    .select(
      "id, reference, status, service_slug, tier, customer_email, total_cents, price_cents, coastal_surcharge_cents, currency, twia_county, county, property_address",
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

  const entry = catalogFor(order.service_slug as string, (order.tier as string | null) ?? undefined);
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
    description: `${entry?.name ?? order.service_slug} at ${order.property_address}`,
    lines: chargeable.length ? chargeable : [{ label: "Sealed document", amountCents: Number(order.total_cents) }],
    successUrl: `${deploymentOrigin()}/order/${order.reference}?paid=1`,
    cancelUrl: `${deploymentOrigin()}/order/${order.reference}?cancelled=1`,
  });

  await event(orderId, "checkout.started", false, `Checkout opened for ${money(Number(order.total_cents))}.`, {
    session_ref: session.ref,
    provider: provider.name,
  });

  return { ok: true, url: session.url, sessionRef: session.ref };
}

/**
 * One checkout for a whole batch.
 *
 * The customer pays once. Each property is still its own order, so the session
 * carries the BATCH id in metadata and markBatchPaid fans the result back out.
 *
 * WHY THE LINES ARE PER PROPERTY
 * ------------------------------
 * Stripe shows what it is given. A single line reading "10 properties, 6750.00"
 * is a number somebody has to trust; ten lines each naming an address is a
 * receipt they can check against what they submitted. The coastal surcharge
 * lands inside the property it belongs to, because that is where it was earned.
 */
export async function startBatchCheckout(batchId: string): Promise<CheckoutResult> {
  /*
   * THE GATE, ASKED HERE RATHER THAN UPSTREAM. See chargesBlockedReason in
   * launch.ts: every function that reaches the payment provider asks it, and
   * money-audit enumerates them from the source.
   */
  const blocked = chargesBlockedReason();
  if (blocked) {
    console.error(`[payments] startBatchCheckout refused: ${blocked}`);
    return { ok: false, error: blocked };
  }

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  const provider = paymentProvider();
  if (!provider.configured()) {
    if (liveKeyOffProduction()) {
      console.error(`[payments] ${LIVE_KEY_HEADLINE}. ${LIVE_KEY_FIX}`);
      return { ok: false, error: LIVE_KEY_HEADLINE + ". " + LIVE_KEY_FIX };
    }
    return { ok: false, error: "Payments are not configured on this deployment." };
  }

  const { data: batch } = await db
    .from("eng_order_batches")
    .select("id, reference, status, total_cents, currency, account_id")
    .eq("id", batchId)
    .maybeSingle();

  if (!batch) return { ok: false, error: "That submission does not exist." };
  if (batch.status !== "awaiting_payment") {
    return { ok: false, error: `That submission is ${batch.status} and is not waiting for payment.` };
  }
  if (!isKnown(batch.total_cents === null ? null : Number(batch.total_cents))) {
    return { ok: false, error: "That submission has no total, so it cannot be charged." };
  }

  /*
   * PAGED. These become the LINE ITEMS of a Stripe checkout, so a truncated
   * read charges a customer for the first thousand properties of a larger
   * submission and hands them a session that looks complete.
   *
   * A bulk submission over a thousand properties is not fanciful: it is the
   * shape the account surface was built for.
   */
  const orderRead = await readEvery<{
    id: string; reference: string; property_address: string; batch_share_cents: number | null; customer_email: string;
  }>((from, to) =>
    db
      .from("eng_service_orders")
      .select("id, reference, property_address, batch_share_cents, customer_email")
      .eq("batch_id", batchId)
      .order("created_at", { ascending: true })
      .range(from, to),
  );

  if (!orderRead.ok) {
    return { ok: false, error: "The properties on that submission could not be read in full, so nothing was charged. " + orderRead.error };
  }
  const orders = orderRead.rows;

  if (!orders.length) return { ok: false, error: "That submission has no properties on it." };

  const lines = orders
    .filter((o) => o.batch_share_cents !== null)
    .map((o) => ({
      label: `${o.reference}: ${o.property_address}`,
      amountCents: Number(o.batch_share_cents),
    }));

  /*
   * The lines must add up to what is being charged. If they do not, something
   * upstream disagreed with itself about the total, and taking the money anyway
   * would charge a figure no receipt explains.
   */
  const lineTotal = lines.reduce((n, l) => n + l.amountCents, 0);
  if (lineTotal !== Number(batch.total_cents)) {
    console.error(
      `[payments] ${batch.reference}: line items total ${lineTotal} and the batch total is ${batch.total_cents}. Refusing to charge.`,
    );
    return {
      ok: false,
      error: "The properties on this submission do not add up to its total. Nothing was charged.",
    };
  }

  const session = await provider.createCheckout({
    reference: batch.reference as string,
    orderId: batch.id as string,
    amountCents: Number(batch.total_cents),
    currency: (batch.currency as string) ?? "usd",
    customerEmail: orders[0].customer_email as string,
    description: `${orders.length} properties submitted together as ${batch.reference}`,
    lines,
    successUrl: `${deploymentOrigin()}/account/orders/${batch.reference}?paid=1`,
    cancelUrl: `${deploymentOrigin()}/account/orders/${batch.reference}?cancelled=1`,
    subjectKind: "batch",
  });

  for (const o of orders) {
    await event(o.id as string, "checkout.started", false, `Checkout opened for batch ${batch.reference}.`, {
      session_ref: session.ref,
      provider: provider.name,
      batch_reference: batch.reference,
    });
  }

  return { ok: true, url: session.url, sessionRef: session.ref };
}

/**
 * What a payment event did, for the webhook to answer with.
 *
 * `duplicate` is true when the event was already applied, or its charge was
 * already on file, so this delivery wrote no money. A claimed event resent is
 * also a duplicate, and its release still ran.
 */
export type PaymentApplied =
  | { ok: true; duplicate: boolean; released: number }
  | { ok: false; error: string };

/**
 * The work a committed payment released, run after commit, and the event
 * finished only when every order's release completed (0075).
 *
 * Each order's release is safe to run twice, which is what makes a resend of a
 * claimed event safe to process rather than skip.
 */
async function releaseAndFinish(eventId: string, orderIds: string[]): Promise<PaymentApplied> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  const missing: string[] = [];
  for (const orderId of orderIds) {
    const { data: order, error } = await db
      .from("eng_service_orders")
      .select("id, reference, order_type, file_id")
      .eq("id", orderId)
      .maybeSingle();
    if (error || !order) {
      missing.push(`${orderId}: the order could not be read${error ? `: ${error.message}` : ""}`);
      continue;
    }
    const released = await releaseForFulfilment(orderId, order.order_type as string, order.file_id as string | null);
    if (!released.complete) missing.push(`${order.reference}: ${released.missing.join("; ")}`);
  }

  if (missing.length) {
    const why = `Paid, and the work was not fully released: ${missing.join(" | ")}`;
    await recordReleaseFailure(eventId, why);
    return { ok: false, error: why };
  }

  const finished = await finishPaymentEvent(eventId);
  if (!finished.ok) {
    return { ok: false, error: `The work was released and the event could not be marked done: ${finished.error}` };
  }
  return { ok: true, duplicate: false, released: orderIds.length };
}

/**
 * A batch payment arrived.
 *
 * ONE charge row, on the batch, because one payment happened. Each order is then
 * released through the same path a single paid order uses, and none of them gets
 * a charge row of its own: ten charge rows for one payment would be ten times
 * the money in the ledger.
 *
 * ONE TRANSACTION FOR THE MONEY, then the release (0075). The rules decide
 * which orders a payment releases; eng_apply_batch_paid records the event, the
 * charge, the batch and each released order under the status it was judged at,
 * and refuses if any moved. The release runs after commit and finishes the
 * event.
 */
export async function markBatchPaid(input: {
  eventId: string;
  source?: PaymentEventSource;
  batchId: string;
  chargeRef: string;
  amountCents: number;
  provider: string;
}): Promise<PaymentApplied> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  const { data: batch, error: batchError } = await db
    .from("eng_order_batches")
    .select("id, reference, status")
    .eq("id", input.batchId)
    .maybeSingle();
  if (batchError) return { ok: false, error: `The submission could not be read: ${batchError.message}` };
  if (!batch) return { ok: false, error: "That submission does not exist." };

  /*
   * PAGED, and a failed read refuses. Every row here is RELEASED to fulfilment;
   * an order past the cut, or a read that failed and was taken as none, would
   * be a customer who has been charged and whose work never starts.
   */
  const releaseRead = await readEvery<{ id: string; status: string }>((from, to) =>
    db
      .from("eng_service_orders")
      .select("id, status")
      .eq("batch_id", input.batchId)
      .order("created_at", { ascending: true })
      .range(from, to),
  );
  if (!releaseRead.ok) return { ok: false, error: "The orders in that submission could not be read." };

  const orders = releaseRead.rows.map((o) => ({
    id: o.id,
    expected_status: o.status,
    release: canTransitionOrder(o.status as never, "paid"),
  }));
  const releasing = orders.filter((o) => o.release).length;

  const applied = await applyPaymentEvent("eng_apply_batch_paid", {
    event_id: input.eventId,
    source: input.source ?? "stripe_webhook",
    batch_id: input.batchId,
    charge_ref: input.chargeRef,
    amount_cents: input.amountCents,
    provider: input.provider,
    expected_status: batch.status,
    orders,
    received_summary: `Paid as part of ${batch.reference}. The firm is arranging the work.`,
    audit_summary: `${batch.reference}: ${money(input.amountCents)} received, ${releasing} properties released`,
  });
  if (!applied.ok) return applied;

  const duplicate = applied.outcome !== "applied";
  if (applied.release.length === 0) return { ok: true, duplicate, released: 0 };
  const released = await releaseAndFinish(input.eventId, applied.release);
  return released.ok ? { ...released, duplicate } : released;
}

/**
 * A checkout that will never be paid, closed out: one order, or a batch with
 * every order under it.
 *
 * The batch and every order under it, in one act. Closing the batch and leaving
 * ten orders at awaiting_payment would put ten rows on the stuck order screen
 * for one abandonment, and an operator who sees ten rows for one event stops
 * trusting the screen.
 *
 * ONE TRANSACTION, AND EACH ORDER CANCELLED ONLY UNDER THE STATUS IT WAS JUDGED
 * AT (0075). Stripe does not guarantee that a completion precedes an expiry. A
 * payment that moved an order between this read and the write leaves it no
 * longer at its expected status, so eng_apply_checkout_expired refuses and
 * cancels nothing, and the next delivery judges it again and leaves the paid
 * order alone.
 */
export async function expireCheckout(input: {
  eventId: string;
  orderId: string | null;
  batchId: string | null;
  reason: string;
}): Promise<{ ok: true; duplicate: boolean; closed: number } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  let batchStatus: string | null = null;
  let rows: { id: string; status: string }[] = [];

  if (input.batchId) {
    const { data: batch, error } = await db
      .from("eng_order_batches")
      .select("id, status")
      .eq("id", input.batchId)
      .maybeSingle();
    if (error) return { ok: false, error: `The submission could not be read: ${error.message}` };
    if (!batch) return { ok: false, error: "That submission does not exist." };
    batchStatus = batch.status as string;

    const read = await readEvery<{ id: string; status: string }>((from, to) =>
      db
        .from("eng_service_orders")
        .select("id, status")
        .eq("batch_id", input.batchId as string)
        .order("created_at", { ascending: true })
        .range(from, to),
    );
    if (!read.ok) return { ok: false, error: "The orders in that submission could not be read." };
    rows = read.rows;
  } else if (input.orderId) {
    const { data: order, error } = await db
      .from("eng_service_orders")
      .select("id, status")
      .eq("id", input.orderId)
      .maybeSingle();
    if (error) return { ok: false, error: `The order could not be read: ${error.message}` };
    if (!order) return { ok: false, error: "That order does not exist." };
    rows = [{ id: order.id as string, status: order.status as string }];
  }

  /* A batch that was paid is not abandoned, whatever order the events arrived in. */
  const batchOpen = batchStatus === null || batchStatus === "awaiting_payment" || batchStatus === "draft";

  const applied = await applyPaymentEvent("eng_apply_checkout_expired", {
    event_id: input.eventId,
    source: "stripe_webhook",
    order_id: input.batchId ? null : input.orderId,
    batch_id: input.batchId,
    expected_batch_status: batchStatus,
    cancel_batch: input.batchId !== null && batchOpen,
    orders: rows.map((o) => ({
      id: o.id,
      expected_status: o.status,
      cancel: batchOpen && canTransitionOrder(o.status as never, "cancelled"),
    })),
    reason: input.reason,
  });
  if (!applied.ok) return applied;
  return { ok: true, duplicate: applied.outcome !== "applied", closed: Number(applied.detail.closed ?? 0) };
}

// -------------------------------------------------------------------- paid

/**
 * Record a completed payment and move the work forward.
 *
 * RECORDED ONCE, BECAUSE WEBHOOKS ARE DELIVERED MORE THAN ONCE (0075)
 * --------------------------------------------------------------------
 * The event id is recorded before any effect, in the same transaction as the
 * charge row, the order's move to fulfilment under the status it was judged
 * at, its payment event and the audit row (eng_apply_order_paid). A resent
 * event that is done changes nothing. The unique index on (provider,
 * provider_ref) still holds underneath: a charge already on file under
 * another event finishes this one and writes nothing.
 *
 * The release reaches past the transaction, so it runs after commit with the
 * event claimed, and the event is finished only when it completes. A resend
 * of a claimed event releases again, which is safe twice.
 *
 * `eventId` is the provider's event id from the webhook, or "reconcile:" and
 * the checkout session when the reconciliation pull found the payment.
 */
export async function markPaid(input: {
  eventId: string;
  source?: PaymentEventSource;
  orderId: string;
  chargeRef: string;
  amountCents: number;
  provider: string;
}): Promise<{ ok: true; alreadyRecorded: boolean } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  const { data: order, error: orderError } = await db
    .from("eng_service_orders")
    .select("id, reference, status")
    .eq("id", input.orderId)
    .maybeSingle();
  if (orderError) return { ok: false, error: `The order could not be read: ${orderError.message}` };
  if (!order) return { ok: false, error: "That order does not exist." };

  const releases = canTransitionOrder(order.status as never, "paid");
  const applied = await applyPaymentEvent("eng_apply_order_paid", {
    event_id: input.eventId,
    source: input.source ?? "stripe_webhook",
    order_id: input.orderId,
    charge_ref: input.chargeRef,
    amount_cents: input.amountCents,
    provider: input.provider,
    expected_status: order.status,
    transition: releases ? "release" : "unexpected",
    received_summary: `Payment of ${money(input.amountCents)} received. The firm is arranging the work.`,
    unexpected_summary: `A payment arrived while the order was ${order.status}.`,
    audit_summary: `${order.reference}: ${money(input.amountCents)} received via ${input.provider}`,
  });
  if (!applied.ok) return applied;

  const alreadyRecorded = applied.outcome !== "applied";
  if (applied.release.length === 0) return { ok: true, alreadyRecorded };
  const released = await releaseAndFinish(input.eventId, applied.release);
  return released.ok ? { ok: true, alreadyRecorded } : released;
}

/**
 * Move an order into fulfilment and open the customer's way in.
 *
 * EXTRACTED SO THAT PAID AND INVOICED CANNOT DIVERGE
 * --------------------------------------------------
 * A card order reaches this through markPaid, after a charge row exists. An
 * invoiced order reaches it through acceptOnInvoice, with no charge row at all,
 * because the money arrives at period close.
 *
 * They must do the same thing to the work. Written twice, one of them would
 * eventually stop issuing the customer link, or release a field order into the
 * review queue, and the difference would only show up as a customer who never
 * got a status page.
 *
 * SAFE TO RUN TWICE (0075). A payment's release runs after its money commits,
 * and a resend of an event whose release did not finish runs it again. So each
 * step first asks whether it already happened: the file step by the order's
 * own work.released or work.blocked event, or the file already at its target;
 * the link and confirmation by a confirmation already queued or sent for this
 * order; the account by the order already naming one. A step that already
 * happened is skipped, never repeated.
 *
 * It answers whether the release COMPLETED. A step that failed in a way the
 * next attempt can fix (a read that failed, a link that could not be issued, a
 * confirmation that could not be queued) leaves it incomplete, and the payment
 * event stays claimed. A step that recorded its own outcome for a person (no
 * file, no customer address, a file the rules would not move) is complete:
 * running it again would only say the same thing twice.
 */
export type ReleaseResult = { complete: boolean; missing: string[] };

export async function releaseForFulfilment(
  orderId: string,
  orderType: string,
  fileId: string | null,
): Promise<ReleaseResult> {
  const db = supabaseAdmin();
  if (!db) return { complete: false, missing: ["the database is not configured"] };
  const missing: string[] = [];
  const abandonedBefore = abandonedSoFar();

  const { data: priorEvents, error: priorError } = await db
    .from("eng_order_events")
    .select("event")
    .eq("order_id", orderId)
    .in("event", ["work.released", "work.blocked", "email.sent"]);
  if (priorError) {
    return { complete: false, missing: [`the order's events could not be read: ${priorError.message}`] };
  }
  const prior = new Set((priorEvents ?? []).map((e) => e.event as string));

  /*
   * Where the work goes. A field order needs a technician before an engineer has
   * anything to look at; a desk order already has everything the customer was
   * asked for, so it goes straight into the review queue and no dispatch it does
   * not need is ever created.
   */
  const target = landingStatusFor(orderType as "field" | "desk" | "quote");
  const fileStepDone = prior.has("work.released") || prior.has("work.blocked");
  const { data: fileNow, error: fileError } =
    !fileStepDone && target && fileId
      ? await db.from("eng_files").select("status").eq("id", fileId).maybeSingle()
      : { data: null, error: null };
  if (fileError) {
    missing.push(`the file could not be read: ${fileError.message}`);
  } else if (fileStepDone) {
    /* Already released, or already recorded as blocked for a person. */
  } else if (target && fileId && fileNow?.status === target) {
    /* An earlier run moved it and stopped before its event. */
    await event(
      orderId,
      "work.released",
      false,
      target === "needs_dispatch" ? "The file is released for dispatch." : "The file is released into the review queue.",
    );
  } else if (target && fileId) {
    /*
     * THROUGH transitionFile, NOT A RAW UPDATE.
     *
     * This line used to be `db.from("eng_files").update({ status: target })`,
     * which moved a file without asking canTransition and without writing the
     * file event every other move writes. It was the only place in src/ that
     * wrote eng_files.status outside ops-crm, and files-audit now asserts that
     * it stays the only shape allowed.
     *
     * The actor is SYSTEM_AUTHOR, the same one that opened the file and placed
     * the order. A payment releasing work is the platform acting on its own,
     * and the trail should say so rather than name whichever person happened to
     * be signed in somewhere else at the time.
     */
    const moved = await transitionFile(
      SYSTEM_AUTHOR,
      fileId,
      target,
      "Payment settled, so the work is released.",
    );

    await event(
      orderId,
      moved.ok ? "work.released" : "work.blocked",
      false,
      moved.ok
        ? target === "needs_dispatch"
          ? "The file is released for dispatch."
          : "The file is released into the review queue."
        : `Paid, and the file could not be released: ${moved.error}`,
    );
  } else if (target && !fileId) {
    await event(
      orderId,
      "work.blocked",
      false,
      "Released, and there is no file to release. Somebody has to open one by hand.",
    );
  }

  /*
   * The customer's way in. Issued when the work is released rather than at
   * placement, so an abandoned checkout never produces a link to an order
   * nobody paid for.
   */
  /*
   * ONCE. The confirmation's own queue key is built from its text, and its text
   * carries a freshly minted link, so a second run would queue a second email.
   * The marker is the confirmation itself: a confirmation job already on the
   * queue for this order, or its acceptance already on the timeline.
   */
  /*
   * THE ACCOUNT IS SETTLED FIRST, THEN THE CONFIRMATION IS SENT. Operator
   * ruling, 2026-10-13. Who the confirmation goes to depends on it: an order
   * matched to its client's existing account, or attached by a person, sends
   * its confirmation (and the status link inside it) to the account's address
   * on file, never to an address that merely paid. So the account is linked,
   * or found to need a person, before anything is sent.
   *
   * Only OPENING a new account waits until after the confirmation, because
   * that sends an invitation, and a receipt followed by an offer is the order
   * that does not get the receipt marked as spam. Linking sends nothing.
   *
   * Already safe twice: an order that names an account does nothing, and an
   * address that holds one is linked rather than duplicated.
   */
  const settled = await openAccountForOrder(orderId, { open: false });
  if (settled === "failed") missing.push("the customer's account could not be opened");
  if (settled === "needs_person") {
    /* No link and no confirmation until a person has chosen the account. */
    missing.push("the customer's account needs a person to attach it");
  } else if (settled !== "failed") {
    const { data: queuedConfirmation, error: queuedError } = prior.has("email.sent")
      ? { data: [{ id: "sent" }], error: null }
      : await db
          .from("eng_jobs")
          .select("id")
          .eq("kind", "email.send")
          .eq("payload->>id", "order.confirmed")
          .eq("payload->>orderId", orderId)
          .limit(1);
    if (queuedError) {
      missing.push(`whether a confirmation was already queued could not be read: ${queuedError.message}`);
    } else if ((queuedConfirmation ?? []).length === 0) {
      const recipient = await confirmationRecipient(orderId);
      if (recipient.kind === "failed") {
        missing.push("who the confirmation goes to could not be read");
      } else if (recipient.kind === "none_on_account") {
        await eventOnce(
          orderId,
          CONFIRMATION_NO_ADDRESS,
          "No confirmation was sent: the account this order belongs to has no active owner and no billing email on file. Add one in account management.",
        );
        missing.push("the account has no address on file to send the confirmation to");
      } else {
        const link = await issueCustomerLink({ orderId });
        if (!link) {
          missing.push("the customer's status link could not be issued");
        } else {
          await event(orderId, "customer_link.issued", false, "A status link was minted. Nothing has been sent yet.");
          const confirmation = await sendOrderConfirmation(
            orderId,
            link.token,
            recipient.kind === "account" ? recipient.email : null,
          );
          if (confirmation === "failed") missing.push("the order confirmation could not be queued");
        }
      }
    }

    if (settled === "open_new") {
      const opened = await openAccountForOrder(orderId, { open: true });
      if (opened === "failed") missing.push("the customer's account could not be opened");
      if (opened === "needs_person") missing.push("the customer's account needs a person to attach it");
    }
  }

  /*
   * AND NOTHING IS COMPLETE IF ANY WRITE IN IT WAS ABANDONED. Every step above
   * that swallows its failure into an event decides for itself whether the
   * failure is final; a write abandoned by the 20 second bound is never final,
   * because it may or may not have committed. Counted against the caller's own
   * watch, so the caller still sees it too.
   */
  const abandonedHere = abandonedSoFar() - abandonedBefore;
  if (abandonedHere > 0) {
    missing.push(`${abandonedHere} write${abandonedHere === 1 ? " was" : "s were"} abandoned by the 20 second bound`);
  }

  return { complete: missing.length === 0, missing };
}

/**
 * THE CHECKOUT DOOR: paying opens the account that owns the order.
 *
 * Phase 13 Section 1, on the operator's ruling of 2026-09-13. The door
 * registry claimed this already worked and it never had: checkout made a
 * CLIENT, an operator later turned the client into an ACCOUNT, and nothing
 * anywhere made a customer USER, so no account holder existed to sign in.
 *
 * WHY IT HANGS OFF releaseForFulfilment RATHER THAN off markPaid.
 *
 * Release is where a card order and an invoiced order converge, and that
 * convergence is the reason that function was extracted in the first place.
 * Hanging this off markPaid would open an account for everybody who paid by
 * card and for nobody who is invoiced, and the difference would show up as a
 * B2B customer who cannot sign in, months later, with nothing to point at.
 *
 * NOTHING HERE MAY FAIL THE PAYMENT.
 *
 * The same rule the confirmation below already follows, and it matters more
 * here because this runs after the money has moved and the work is released.
 * Every failure is swallowed into an order event that somebody can read. An
 * account that did not open is a person who telephones; a payment unwound
 * because an account did not open is a person who has been charged and has
 * nothing.
 *
 * IT IS IDEMPOTENT, WHICH IS NOT OPTIONAL ON A WEBHOOK.
 *
 * Stripe redelivers. markPaid catches the duplicate charge on a unique
 * constraint and returns early, so this is not usually reached twice, but "not
 * usually" is not a guarantee and an invoiced order reaches release by another
 * path entirely. So: an order that already names an account does nothing, and
 * an address that already holds an account is linked rather than duplicated,
 * which also covers the case that actually happens, a repeat customer.
 */
/*
 * "settled" means the order has an account, was linked to one, or carries no
 * address and says so. "failed" is a failure the next attempt can fix, so a
 * payment's release stays claimed and the next delivery opens it (0075; found
 * by the proof, where the account insert was cut off and the event was marked
 * done regardless, so no resend would ever have opened the account).
 *
 * "needs_person" is a payment whose account no rule can safely choose: the
 * release stays claimed, the order says why once, and "Paid, work not
 * released" offers a person the accounts to attach it to (operator ruling,
 * 2026-10-13).
 */
async function openAccountForOrder(
  orderId: string,
  { open }: { open: boolean },
): Promise<"settled" | "failed" | "needs_person" | "open_new"> {
  const db = supabaseAdmin();
  if (!db) return "failed";

  try {
    const { data: order, error: orderError } = await db
      .from("eng_service_orders")
      .select("id, account_id, client_id, customer_email, customer_name, customer_phone, customer_company")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError || !order) return "failed";

    /* Already has one. An invoiced B2B order arrives here that way every time. */
    if (order.account_id) return "settled";

    const email = typeof order.customer_email === "string" ? order.customer_email.trim() : "";

    /*
     * AN EXISTING CLIENT IS MATCHED BY ITS RECORD, NOT BY THE PAYING ADDRESS.
     * Operator ruling, 2026-10-13.
     *
     * A person chose this order's client (staff intake, a payment link), and
     * that client may already have an account while the card was paid from an
     * address nobody has seen. Matching by the address found no one, tried to
     * open a second account for the same client, and was refused by the
     * account's unique (site, client); the payment then sat claimed for ever.
     * So the client record is asked first, and an address is only ever the
     * second question.
     */
    const byRecord = await accountForClientRecord(order.client_id as string | null, email);
    if (byRecord.kind === "failed") return "failed";
    if (byRecord.kind === "match") {
      const { data: linked, error: linkError } = await db
        .from("eng_service_orders")
        .update({ account_id: byRecord.accountId })
        .eq("id", orderId)
        .is("account_id", null)
        .select("id");
      if (linkError) return "failed";
      /* Somebody attached it between the read and this write: theirs stands. */
      if ((linked ?? []).length === 0) return "settled";
      /*
       * THE ORDER, AND NOTHING MORE. Operator ruling, 2026-10-13: the paying
       * address is not added as a sign in, is sent no invitation or link, and
       * the account's own email is not touched. The confirmation goes to the
       * account's address on file (confirmationRecipient reads this event).
       */
      await event(
        orderId,
        ACCOUNT_LINKED_BY_CLIENT,
        false,
        "This order's client already has an account, so the order was attached to it by the client record. No second account was opened and nothing was sent to the paying address.",
      );
      return "settled";
    }
    if (byRecord.kind === "person") {
      /* Said once. Every resend reaches here again and must not repeat it. */
      const said = await eventOnce(
        orderId,
        ACCOUNT_MATCH_NEEDED,
        `No account was opened or attached: ${byRecord.reason}. A person attaches it from Orders needing attention.`,
      );
      return said ? "needs_person" : "failed";
    }

    if (!email) {
      await event(orderId, "account.not_opened", false, "No account was opened: the order carries no customer address.");
      return "settled";
    }

    /*
     * A REPEAT CUSTOMER IS LINKED, NOT DUPLICATED.
     *
     * Their second order must reach the account their first one opened, or they
     * sign in and see one order out of two, which is worse than seeing none
     * because it looks like the platform lost something.
     */
    const { data: existing, error: existingError } = await db
      .from("eng_customer_users")
      .select("id, account_id")
      .eq("email", normaliseAddress(email))
      .maybeSingle();
    if (existingError) return "failed";

    if (existing?.account_id) {
      const { error: linkError } = await db
        .from("eng_service_orders")
        .update({ account_id: existing.account_id })
        .eq("id", orderId);
      if (linkError) return "failed";
      await event(
        orderId,
        "account.linked",
        false,
        "This address already has an account, so the order was attached to it and no second account was opened.",
      );
      return "settled";
    }

    /* Opening sends an invitation, so it waits until the confirmation is queued. */
    if (!open) return "open_new";

    const created = await createCustomerAccount({
      email,
      displayName: (order.customer_name as string) || email,
      organisation: (order.customer_company as string) || null,
      phone: (order.customer_phone as string) || null,
      origin: "order_checkout",
      /*
       * The client the order already made. Opening a second one would put the
       * same person in this firm's records twice with their orders split
       * between them.
       */
      clientId: (order.client_id as string) ?? null,
      /*
       * No actor. A payment settling is the platform acting on its own, the
       * same principal that released the work a few lines above.
       */
      actor: null,
    });

    if (!created.ok) {
      await event(orderId, "account.not_opened", false, `No account was opened: ${created.error}`);
      return "failed";
    }

    const { error: ownError } = await db
      .from("eng_service_orders")
      .update({ account_id: created.accountId })
      .eq("id", orderId);
    if (ownError) return "failed";
    await event(
      orderId,
      "account.opened",
      false,
      "An account was opened for the address on this order, and a link to choose a password was sent.",
    );

    if (created.link) {
      const base = process.env.NEXT_PUBLIC_SITE_URL || business.url;
      await queueEmail(
        accountWelcome({
          customerName: (order.customer_name as string) || email,
          customerEmail: normaliseAddress(email),
          origin: "order_checkout",
          link: `${base.replace(/\/$/, "")}/account/set-password?token=${encodeURIComponent(created.link.token)}`,
          expiresIn: created.link.expiresIn,
        }),
      );
    }
    return "settled";
  } catch (err) {
    /*
     * Swallowed into an event rather than thrown. See the note at the top: the
     * money has moved and the work is released, and an exception escaping here
     * would tell the caller the payment failed when it did not.
     */
    await event(
      orderId,
      "account.not_opened",
      false,
      `No account was opened: ${err instanceof Error ? err.message : "an unexpected failure"}.`,
    );
    return "failed";
  }
}

/** The order event that says a payment's account is waiting for a person. Written once per order. */
export const ACCOUNT_MATCH_NEEDED = "account.match_needed";
/** An order linked to its client's existing account by the client record. */
export const ACCOUNT_LINKED_BY_CLIENT = "account.linked_by_client";
/** An order a person attached to an account from the attach panel. */
export const ACCOUNT_ATTACHED = "account.attached";
/** A confirmation not sent because the order's account has no address on file. Written once per order. */
export const CONFIRMATION_NO_ADDRESS = "email.no_account_address";

/** Writes an order event unless the order already carries one of that name. False when it could not tell or write. */
async function eventOnce(orderId: string, name: string, summary: string): Promise<boolean> {
  const db = supabaseAdmin();
  if (!db) return false;
  const { data, error } = await db
    .from("eng_order_events")
    .select("id")
    .eq("order_id", orderId)
    .eq("event", name)
    .limit(1);
  if (error) return false;
  if ((data ?? []).length === 0) await event(orderId, name, false, summary);
  return true;
}

type Recipient =
  | { kind: "order" }
  | { kind: "account"; email: string }
  | { kind: "none_on_account" }
  | { kind: "failed" };

/*
 * WHO THE CONFIRMATION GOES TO. Operator ruling, 2026-10-13.
 *
 * An order linked to its client's existing account by the client record, or
 * attached to one by a person, confirms to the account's address on file: its
 * active owner, else its billing email, else nobody, and the attach panel says
 * so. Every other order confirms to its own customer address, which is what
 * any payer gets today. The paying address of a matched order is sent nothing
 * by this platform; Stripe's own receipt is Stripe's.
 */
async function confirmationRecipient(orderId: string): Promise<Recipient> {
  const db = supabaseAdmin();
  if (!db) return { kind: "failed" };

  const { data: how, error: howError } = await db
    .from("eng_order_events")
    .select("event")
    .eq("order_id", orderId)
    .in("event", [ACCOUNT_LINKED_BY_CLIENT, ACCOUNT_ATTACHED])
    .limit(1);
  if (howError) return { kind: "failed" };
  if ((how ?? []).length === 0) return { kind: "order" };

  const { data: order, error: orderError } = await db
    .from("eng_service_orders")
    .select("account_id")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError || !order) return { kind: "failed" };
  if (!order.account_id) return { kind: "failed" };

  const { data: owners, error: ownersError } = await db
    .from("eng_customer_users")
    .select("email")
    .eq("account_id", order.account_id as string)
    .eq("account_role", "owner")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1);
  if (ownersError) return { kind: "failed" };
  const owner = owners?.[0]?.email;
  if (typeof owner === "string" && owner.trim()) return { kind: "account", email: owner.trim() };

  const { data: account, error: accountError } = await db
    .from("eng_customer_accounts")
    .select("billing_email")
    .eq("id", order.account_id as string)
    .maybeSingle();
  if (accountError) return { kind: "failed" };
  const billing = account?.billing_email;
  if (typeof billing === "string" && billing.trim()) return { kind: "account", email: billing.trim() };
  return { kind: "none_on_account" };
}

type ClientRecordMatch =
  | { kind: "none" }
  | { kind: "failed" }
  | { kind: "match"; accountId: string }
  | { kind: "person"; reason: string };

/*
 * THE CLIENT RECORD'S ANSWER, AND WHEN IT IS SAFE.
 *
 * Safe is exactly one active account for the order's client, and a paying
 * address that belongs to no other account. Matched across sites, because the
 * checkout door opens accounts on site "254" and staff conversion on the
 * order's own site, so a match on site and client together would miss the
 * account that is plainly there.
 *
 * Everything else is a person's decision, never a rule's guess: a client with
 * no active account but a suspended or closed one, a client with more than one
 * active account, and an address already holding a DIFFERENT account. Attaching
 * an order to an account decides who can sign in and see it, so a wrong guess
 * shows one customer's order to another.
 *
 * A client with no account at all is "none": the address path below runs as it
 * always has, and a new customer's first payment opens their account.
 */
async function accountForClientRecord(clientId: string | null, email: string): Promise<ClientRecordMatch> {
  const db = supabaseAdmin();
  if (!db) return { kind: "failed" };
  if (!clientId) return { kind: "none" };

  const { data: accounts, error } = await db
    .from("eng_customer_accounts")
    .select("id, status")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  if (error) return { kind: "failed" };
  const rows = accounts ?? [];
  if (rows.length === 0) return { kind: "none" };

  const active = rows.filter((a) => a.status === "active");
  if (active.length === 0) {
    const states = [...new Set(rows.map((a) => String(a.status)))].join(" and ");
    return { kind: "person", reason: `the order's client has an account and it is ${states}` };
  }
  if (active.length > 1) {
    return { kind: "person", reason: `the order's client has ${active.length} active accounts` };
  }

  if (email) {
    const { data: holder, error: holderError } = await db
      .from("eng_customer_users")
      .select("account_id")
      .eq("email", normaliseAddress(email))
      .maybeSingle();
    if (holderError) return { kind: "failed" };
    if (holder?.account_id && holder.account_id !== active[0].id) {
      return { kind: "person", reason: "the paying address belongs to a different account from the order's client" };
    }
  }
  return { kind: "match", accountId: active[0].id as string };
}

export type AccountCandidate = {
  accountId: string;
  /** The client the account belongs to, by name. */
  name: string;
  status: string;
  /** Why it is offered: the order's own client, or the address that paid. */
  because: "the order's client" | "the paying address";
};

export type OrderAwaitingAccount = {
  orderId: string;
  reference: string;
  /** "account": no account chosen yet. "address": attached, and its account has no address to confirm to. */
  needs: "account" | "address";
  reason: string;
  candidates: AccountCandidate[];
};

/**
 * Every paid order waiting on a person over its account: the ones whose
 * account no rule could choose and that still name none, and the ones whose
 * account has no address on file and whose confirmation has still not gone
 * (ruling 2026-10-13: "the panel says so for that order"). With the accounts a
 * person may attach the first kind to. Null when it could not be read, which
 * is not none.
 */
export async function ordersAwaitingAccount(): Promise<OrderAwaitingAccount[] | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const { data: said, error } = await db
    .from("eng_order_events")
    .select("order_id, event, summary")
    .in("event", [ACCOUNT_MATCH_NEEDED, CONFIRMATION_NO_ADDRESS])
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) return null;
  const ids = [...new Set((said ?? []).map((e) => e.order_id as string))];
  if (ids.length === 0) return [];

  const { data: orders, error: ordersError } = await db
    .from("eng_service_orders")
    .select("id, reference, account_id")
    .in("id", ids);
  if (ordersError) return null;
  const { data: sent, error: sentError } = await db
    .from("eng_order_events")
    .select("order_id")
    .in("order_id", ids)
    .eq("event", "email.sent");
  if (sentError) return null;
  const confirmed = new Set((sent ?? []).map((e) => e.order_id as string));

  const out: OrderAwaitingAccount[] = [];
  for (const o of orders ?? []) {
    const mine = (said ?? []).filter((e) => e.order_id === o.id);
    const needs: OrderAwaitingAccount["needs"] | null = !o.account_id
      ? mine.some((e) => e.event === ACCOUNT_MATCH_NEEDED)
        ? "account"
        : null
      : mine.some((e) => e.event === CONFIRMATION_NO_ADDRESS) && !confirmed.has(o.id as string)
        ? "address"
        : null;
    if (!needs) continue;
    const candidates = needs === "account" ? await accountCandidatesFor(o.id as string) : [];
    if (candidates === null) return null;
    const detail = mine.find((e) => e.event === (needs === "account" ? ACCOUNT_MATCH_NEEDED : CONFIRMATION_NO_ADDRESS))?.summary;
    out.push({
      orderId: o.id as string,
      reference: o.reference as string,
      needs,
      reason: typeof detail === "string" ? detail : "No account was opened or attached.",
      candidates,
    });
  }
  return out;
}

/**
 * The accounts a person may attach this order to: every account of the
 * order's client, and the account the paying address belongs to. Nothing
 * else, so the action cannot be pointed at a stranger's account.
 */
export async function accountCandidatesFor(orderId: string): Promise<AccountCandidate[] | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const { data: order, error } = await db
    .from("eng_service_orders")
    .select("client_id, customer_email")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !order) return null;

  const found = new Map<string, { status: string; clientId: string; because: AccountCandidate["because"] }>();
  if (order.client_id) {
    const { data: own, error: ownError } = await db
      .from("eng_customer_accounts")
      .select("id, status, client_id")
      .eq("client_id", order.client_id as string)
      .order("created_at", { ascending: true });
    if (ownError) return null;
    for (const a of own ?? []) {
      found.set(a.id as string, { status: String(a.status), clientId: a.client_id as string, because: "the order's client" });
    }
  }
  const email = typeof order.customer_email === "string" ? order.customer_email.trim() : "";
  if (email) {
    const { data: holder, error: holderError } = await db
      .from("eng_customer_users")
      .select("account_id")
      .eq("email", normaliseAddress(email))
      .maybeSingle();
    if (holderError) return null;
    if (holder?.account_id && !found.has(holder.account_id as string)) {
      const { data: theirs, error: theirsError } = await db
        .from("eng_customer_accounts")
        .select("id, status, client_id")
        .eq("id", holder.account_id as string)
        .maybeSingle();
      if (theirsError) return null;
      if (theirs) {
        found.set(theirs.id as string, {
          status: String(theirs.status),
          clientId: theirs.client_id as string,
          because: "the paying address",
        });
      }
    }
  }
  if (found.size === 0) return [];

  const clientIds = [...new Set([...found.values()].map((f) => f.clientId))];
  const { data: clients, error: clientsError } = await db.from("eng_clients").select("id, name").in("id", clientIds);
  if (clientsError) return null;
  const names = new Map((clients ?? []).map((c) => [c.id as string, c.name as string]));

  return [...found.entries()].map(([accountId, f]) => ({
    accountId,
    name: names.get(f.clientId) ?? "a client with no name on file",
    status: f.status,
    because: f.because,
  }));
}

export type AttachResult =
  | { ok: true; released: boolean; note: string }
  | { ok: false; status: number; error: string };

/**
 * A person attaches a paid order to an account, and the payment's release
 * finishes. Operator ruling, 2026-10-13: the one-click staff action for a
 * payment no rule could match safely.
 *
 * Only to an account accountCandidatesFor offers, only while the order names
 * none, under accounts.manage because it decides who can see the order, and
 * audited as that person. The release then runs again for every claimed
 * payment event naming this order or its batch; it is safe to run twice, so a
 * payment whose other steps already finished only finishes its event.
 */
export async function attachOrderToAccount(
  actor: Actor & { email: string },
  orderId: string,
  accountId: string,
): Promise<AttachResult> {
  if (!can(actor, "accounts.manage")) return { ok: false, status: 403, error: "Not permitted." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, status: 503, error: "The order system is not configured." };

  const { data: order, error } = await db
    .from("eng_service_orders")
    .select("id, reference, account_id, batch_id")
    .eq("id", orderId)
    .maybeSingle();
  if (error) return { ok: false, status: 503, error: "The order could not be read. Nothing was changed." };
  if (!order) return { ok: false, status: 404, error: "There is no such order." };
  if (order.account_id) return { ok: false, status: 409, error: "This order already has an account. Nothing was changed." };

  const candidates = await accountCandidatesFor(orderId);
  if (candidates === null) return { ok: false, status: 503, error: "The accounts could not be read. Nothing was changed." };
  const chosen = candidates.find((c) => c.accountId === accountId);
  if (!chosen) {
    return { ok: false, status: 400, error: "That account is not one this order can be attached to. Nothing was changed." };
  }

  const { data: attached, error: attachError } = await db
    .from("eng_service_orders")
    .update({ account_id: accountId })
    .eq("id", orderId)
    .is("account_id", null)
    .select("id");
  if (attachError) return { ok: false, status: 503, error: "The order could not be attached. Nothing was changed." };
  if ((attached ?? []).length === 0) {
    return { ok: false, status: 409, error: "Somebody attached this order a moment ago. Nothing was changed." };
  }

  await event(
    orderId,
    ACCOUNT_ATTACHED,
    false,
    `Attached by ${actor.email} to ${chosen.name}'s account (${chosen.because}).`,
  );
  await writeAudit({
    actor: { id: actor.id, role: actor.role, email: actor.email },
    action: "order.account_attached",
    entityType: "service_order",
    entityId: orderId,
    summary: `Attached ${order.reference} to ${chosen.name}'s account, offered as ${chosen.because}`,
    diff: { account_id: accountId, because: chosen.because, account_status: chosen.status },
  });

  /* The payments waiting on it: this order's own, and its batch's. */
  const filter = order.batch_id ? `order_id.eq.${orderId},batch_id.eq.${order.batch_id}` : `order_id.eq.${orderId}`;
  const { data: waiting, error: waitingError } = await db
    .from("eng_payment_events")
    .select("event_id, order_id, batch_id")
    .eq("status", "claimed")
    .or(filter);
  if (waitingError) {
    return { ok: true, released: false, note: "Attached. The payment waiting on it could not be read, so its release was not run; the next delivery from Stripe runs it." };
  }

  let released = true;
  for (const w of waiting ?? []) {
    let orderIds: string[] = [];
    if (w.order_id) {
      orderIds = [w.order_id as string];
    } else if (w.batch_id) {
      const { data: inBatch, error: batchError } = await db
        .from("eng_service_orders")
        .select("id")
        .eq("batch_id", w.batch_id as string)
        .eq("status", "in_fulfilment");
      if (batchError) {
        released = false;
        continue;
      }
      orderIds = (inBatch ?? []).map((o) => o.id as string);
    }
    const result = await releaseAndFinish(w.event_id as string, orderIds);
    if (!result.ok) released = false;
  }
  return {
    ok: true,
    released,
    note: released
      ? "Attached, and the payment's work is released."
      : "Attached. The rest of the release did not finish and stays on this list with its reason.",
  };
}

/**
 * The confirmation, carrying the link that was just minted.
 *
 * WHY IT IS HERE AND NOT AT PLACEMENT.
 *
 * For the same reason the link is issued here: an abandoned checkout must not
 * produce a receipt for an order nobody paid for. This runs once the work is
 * released, which is the moment the firm has actually taken the job on.
 *
 * WHY A FAILURE HERE DOES NOT FAIL THE PAYMENT.
 *
 * The money has moved and the work is released. An email that cannot be queued
 * is worth an event on the order so somebody can see it and send it by hand; it
 * is not worth unwinding a paid order, and throwing here would leave the caller
 * believing the payment failed when it did not.
 */
/*
 * "queued" and "no_address" are outcomes the release can stand on: one went
 * out, the other is recorded for a person and a second attempt would say the
 * same. "failed" is one the next attempt can fix (0075).
 */
/*
 * `to` is the account's address on file when confirmationRecipient chose it;
 * null sends to the order's own customer address, as every order did before.
 */
async function sendOrderConfirmation(
  orderId: string,
  token: string,
  to: string | null,
): Promise<"queued" | "no_address" | "failed"> {
  const db = supabaseAdmin();
  if (!db) return "failed";

  const view = await customerView(token);
  if (!view) {
    await event(orderId, "email.not_sent", false, "The confirmation could not be built: the status link did not resolve.");
    return "failed";
  }

  const { data: order, error: orderError } = await db
    .from("eng_service_orders")
    .select("customer_name, customer_email")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) return "failed";

  const address = to ?? (order?.customer_email as string | null | undefined) ?? null;
  if (!address) {
    await event(orderId, "email.not_sent", false, "The confirmation could not be sent: no customer email on the order.");
    return "no_address";
  }

  const queued = await queueEmail(
    orderConfirmed({
      customerName: order?.customer_name as string,
      customerEmail: address,
      reference: view.reference,
      serviceName: view.serviceName,
      propertyAddress: view.propertyAddress,
      placedAt: customerWhen(view.placedAt) ?? "not recorded",
      lines: view.lines,
      total: view.total,
      refundDisclosure: view.refundDisclosure,
      receives: view.receives,
      notes: view.notes,
      statusUrl: customerStatusUrl(view.reference, token),
    }),
    { orderId },
  );

  await event(
    orderId,
    queued.ok ? "email.sent" : "email.not_sent",
    /*
     * The success is customer visible and the failure is not. They should see
     * that a confirmation went to their address, so they know where to look and
     * can say if it is the wrong one. They should not see the queue's reasons
     * for not sending it; that is the firm's problem to fix, and it appears on
     * the order for whoever is looking at it internally.
     */
    queued.ok,
    queued.ok
      ? `The order confirmation was sent to ${address}.`
      : `The order confirmation could not be queued: ${queued.error}. It has to go out by hand.`,
  );
  return queued.ok ? "queued" : "failed";
}

/**
 * An order on an invoiced account, accepted without payment.
 *
 * The credit decision has already been made by the caller. This does not repeat
 * it, and it does not create a charge row: nothing has been paid, and a zero
 * amount payment row would be a lie in the ledger. The order is billed at period
 * close by the statement, and until then it counts against the account's
 * outstanding balance because it is unbilled work.
 */
export async function acceptOnInvoice(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  const { data: order } = await db
    .from("eng_service_orders")
    .select("id, reference, status, order_type, file_id, total_cents")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "That order does not exist." };

  if (!canTransitionOrder(order.status as never, "paid")) {
    return { ok: false, error: `That order is ${order.status} and cannot be accepted.` };
  }

  await db
    .from("eng_service_orders")
    .update({ status: "in_fulfilment", paid_at: DB_NOW })
    .eq("id", orderId);

  await event(
    orderId,
    "order.accepted_on_account",
    true,
    `Accepted on your account. ${money(
      order.total_cents === null ? null : Number(order.total_cents),
    )} will appear on your next statement rather than being charged now.`,
  );

  await releaseForFulfilment(orderId, order.order_type as string, order.file_id as string | null);

  await writeAudit({
    actor: { id: null, role: "admin", email: "order-engine@254engineering.com" },
    action: "order.accepted_on_invoice",
    entityType: "service_order",
    entityId: orderId,
    summary: `${order.reference}: accepted on account, to be billed at period close`,
  });

  return { ok: true };
}

/**
 * A checkout that will never be paid, closed out.
 *
 * WHY THIS EXISTS RATHER THAN AN EVENT ON ITS OWN
 * -----------------------------------------------
 * The webhook used to write a `checkout.expired` event and leave the order at
 * awaiting_payment. That reads as harmless and is the exact ambiguity that cost
 * this platform three orders: an expired session and a paid session whose
 * confirmation was lost are then the same row, and nothing counts either.
 *
 * An expired session cannot be paid. Saying so in the status is what makes the
 * remaining awaiting_payment rows mean something.
 */
export async function markAbandoned(
  orderId: string,
  reason: string,
): Promise<{ ok: true; changed: boolean } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  const { data: order } = await db
    .from("eng_service_orders")
    .select("id, reference, status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "That order does not exist." };

  /*
   * A paid order whose session later expired is not abandoned. Stripe can send
   * both, and the order of arrival is not guaranteed, so this refuses on the
   * state machine rather than assuming the expiry came last.
   */
  if (!canTransitionOrder(order.status as never, "cancelled")) {
    return { ok: true, changed: false };
  }

  /*
   * GUARDED BY THE STATUS IT WAS JUDGED AT (0075). A payment that moved the
   * order between the read above and this write leaves no row matching, so a
   * paid order is never cancelled by an expiry that read it a moment earlier.
   * The event follows the write, so it is only written when the order closed.
   */
  const { data: closed, error: closeError } = await db
    .from("eng_service_orders")
    .update({ status: "cancelled", cancelled_at: DB_NOW })
    .eq("id", orderId)
    .eq("status", order.status)
    .select("id");
  if (closeError) return { ok: false, error: closeError.message };
  if (!closed || closed.length === 0) return { ok: true, changed: false };

  await event(orderId, "checkout.expired", true, reason);
  return { ok: true, changed: true };
}

/**
 * A refund the platform did not issue.
 *
 * Somebody refunded in the Stripe dashboard. Before this existed the webhook
 * logged a line and returned, and the comment above it said the event was
 * "recorded" when nothing was written anywhere. The firm's ledger would have
 * shown a charge and no refund, permanently, for money that had gone back.
 *
 * It is deliberately not settleDecision. That function carries the operator's
 * three case rule and decides an AMOUNT; this one is told the amount by the
 * provider and only writes down what already happened.
 *
 * ONE TRANSACTION (0075). The delta and the commission reversals are computed
 * here, and eng_apply_refund records the event, the refund row, the reversals,
 * the order's event and status and the audit row together, after re-reading
 * the refunds on file under a lock on the charge and refusing if they moved.
 *
 * TWO DEFECTS THIS CLOSES, both verified against the code before the fix.
 *
 * A pending platform refund was recorded twice. settleDecision and
 * cancelAndRefund write their refund row with Stripe's status, which can be
 * pending. The delta here counted succeeded refunds only, and the webhook's
 * refund ref is the event id whenever the payload carries no refund list, so
 * the same money was written a second time and its commission reversed twice.
 * Pending refunds now count.
 *
 * A batch or statement refund was refused. Their charge rows carry no order,
 * so the refund row was inserted with no subject at all, failed the
 * has_subject check, and the webhook answered 200 "no charge on file". The
 * refund row now carries the charge's own subject, and the delta reads
 * refunds on that same subject.
 */
export async function recordExternalRefund(input: {
  eventId: string;
  chargeRef: string;
  /** Idempotency key only. Never an amount. */
  refundRef: string;
  /** CUMULATIVE refunds on the charge, from which the delta is derived. */
  refundedToDateCents: number;
  provider: string;
}): Promise<
  | { ok: true; alreadyRecorded: boolean; recordedCents?: number }
  | { ok: false; error: string; noCharge?: true }
> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  /*
   * THE CHARGE A REFUND ATTACHES TO, AND WHY A SECOND ONE CANNOT READ AS NONE.
   *
   * eng_order_payments has no unique constraint on (provider, provider_ref,
   * kind): a provider event delivered twice, or a reconciliation sweep that
   * recorded the same charge again, produces two rows. This was
   * `.maybeSingle()` with the error discarded, so that state answered PGRST116,
   * read as "no charge on file", and the refund was REFUSED against a charge
   * the platform had recorded twice over.
   *
   * Oldest first. Both rows describe the same money, and the first one recorded
   * is the one the order's timeline already refers to.
   */
  const { data: chargeRows, error: chargeErr } = await db
    .from("eng_order_payments")
    .select("id, order_id, batch_id, statement_id, amount_cents")
    .eq("provider", input.provider)
    .eq("provider_ref", input.chargeRef)
    .eq("kind", "charge")
    .order("created_at", { ascending: true })
    .limit(1);

  if (chargeErr) {
    console.error(`[payments] could not read the charge for refund ${input.refundRef}: ${chargeErr.message}`);
    return { ok: false, error: "Could not read the charge that refund is against." };
  }

  const charge = (chargeRows ?? [])[0] ?? null;

  /*
   * A refund against a charge this platform never recorded. Loud, and not an
   * error the caller should retry: the charge is missing, and retrying the
   * refund notice will not produce it. Reconciliation is what fixes this.
   */
  if (!charge) {
    console.error(
      `[payments] refund ${input.refundRef} is against charge ${input.chargeRef}, which this platform has no record of. Reconcile the order before this will attach.`,
    );
    return { ok: false, error: "No charge on file for that refund.", noCharge: true };
  }

  /*
   * The delta, not the figure the provider sent.
   *
   * amount_refunded is cumulative, so writing it whole would double the ledger
   * the second time a charge is partly refunded. Taking the difference against
   * what is already on file makes the total converge on the provider's even if
   * an earlier event was never delivered, which is the failure this whole path
   * exists because of.
   *
   * On the charge's own subject, and pending refunds count: see above.
   * eng_apply_refund re-reads this same total under a lock and refuses if it
   * moved, so the figure the delta was computed from is the figure it lands on.
   */
  const subject = (column: "order_id" | "batch_id" | "statement_id") =>
    (charge[column] as string | null) ?? null;
  let priorQuery = db
    .from("eng_order_payments")
    .select("amount_cents")
    .eq("kind", "refund")
    .in("status", ["pending", "succeeded"]);
  for (const column of ["order_id", "batch_id", "statement_id"] as const) {
    const value = subject(column);
    priorQuery = value === null ? priorQuery.is(column, null) : priorQuery.eq(column, value);
  }
  const { data: priorRefunds, error: priorError } = await priorQuery;
  if (priorError) return { ok: false, error: `The refunds already on file could not be read: ${priorError.message}` };

  const alreadyRefunded = (priorRefunds ?? []).reduce((n, r) => n + Number(r.amount_cents), 0);
  const delta = input.refundedToDateCents - alreadyRefunded;
  const orderId = subject("order_id");

  /*
   * A PARTNER'S COMMISSION FOLLOWS THE MONEY, EVEN WHEN THE MONEY MOVED
   * SOMEWHERE ELSE.
   *
   * This path exists because somebody can refund in the Stripe dashboard, and a
   * commission that only reversed on the platform's own refunds would quietly
   * pay out on returned money exactly in the case nobody was watching.
   *
   * Computed here and written in the same transaction as the refund. A batch
   * or statement refund names no order, so there is no accrual it can be
   * proportioned against: the audit row says so, for a person to settle.
   */
  let reversals: PlannedReversal[] = [];
  if (orderId && delta > 0) {
    const plan = await planReversals({ orderId, refundedCents: delta });
    if (!plan.ok) return plan;
    reversals = plan.reversals;
  }

  /*
   * Only a full refund changes the order's status. A partial one is the shape
   * of the operator's second case, where the inspection fee is retained, and
   * that order is still owed the engineer's finding.
   */
  let markRefunded = false;
  let expectedOrderStatus: string | null = null;
  if (orderId && delta > 0 && input.refundedToDateCents >= Number(charge.amount_cents)) {
    const { data: order, error: orderError } = await db
      .from("eng_service_orders")
      .select("status")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) return { ok: false, error: `The order could not be read: ${orderError.message}` };
    expectedOrderStatus = (order?.status as string | undefined) ?? null;
    markRefunded = Boolean(order && canTransitionOrder(order.status as never, "refunded"));
  }

  const subjectNote = orderId
    ? ""
    : ` against ${subject("batch_id") ? "a submission" : "a statement"}, which names no single order, so no commission was reversed and no order status changed. Settle those by hand if any apply.`;

  const applied = await applyPaymentEvent("eng_apply_refund", {
    event_id: input.eventId,
    source: "stripe_webhook",
    order_id: orderId,
    batch_id: subject("batch_id"),
    statement_id: subject("statement_id"),
    charge_ref: input.chargeRef,
    charge_id: charge.id,
    expected_prior_cents: alreadyRefunded,
    delta_cents: delta,
    provider: input.provider,
    refund_ref: input.refundRef,
    reversals: reversals.map((r) => ({
      partner_id: r.partnerId,
      amount_cents: r.amountCents,
      explanation: r.explanation,
      model: r.model,
      basis_cents: r.basisCents,
      file_id: r.fileId,
      reverses_id: r.reversesId,
      audit_summary: `${money(r.amountCents)}: ${r.explanation}`,
    })),
    refund_summary: `${money(delta)} was refunded to your card.`,
    mark_refunded: markRefunded,
    expected_order_status: expectedOrderStatus,
    audit_summary: `${money(Math.max(delta, 0))} refunded outside the platform, recorded from ${input.refundRef}${subjectNote}`,
  });
  if (!applied.ok) return applied;

  if (applied.outcome !== "applied") return { ok: true, alreadyRecorded: true };
  return { ok: true, alreadyRecorded: false, recordedCents: Number(applied.detail.recorded_cents ?? delta) };
}

/**
 * The firm cancels a paid order and gives everything back.
 *
 * THE FOURTH CASE, AND WHY IT IS NOT settleDecision
 * -------------------------------------------------
 * settleDecision carries the operator's three case rule, which is about an
 * ENGINEER'S judgment. Before this existed the only route to a refund was
 * through that function, so unwinding an order placed by mistake meant routing
 * the file to review and recording a refusal to seal. That writes a false
 * professional judgment into eng_audit_events, which refuses deletes, and it
 * would have been permanent.
 *
 * So this is a separate act with a separate name, recorded against the operator
 * who authorised it rather than against an engineer who never saw the file.
 *
 * IT ALWAYS REFUNDS EVERYTHING
 * ----------------------------
 * Including when a technician has already attended. See
 * refundForFirmCancellation for the reasoning; the short version is that the
 * customer receives nothing they asked for, so charging them for the firm's own
 * change of mind is not a refund policy. The consequence is that cancelling is
 * always the most expensive option for the firm, which is what stops it being
 * the cheap way out of an awkward engineering decision.
 *
 * A REASON IS REQUIRED
 * --------------------
 * Not for tidiness. This is the one refund path with no engineering decision
 * behind it, so the only record of why the money moved is the sentence the
 * person types. An empty reason is refused.
 */
export async function cancelAndRefund(input: {
  orderId: string;
  reason: string;
  actor: { id: string | null; role: string; email: string };
}): Promise<
  | { ok: true; refundedCents: number; providerRef: string; alreadyRefunded: boolean }
  | { ok: false; error: string }
> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The order system is not configured." };

  const reason = input.reason.trim();
  if (reason.length < 10) {
    return {
      ok: false,
      error: "Say why this is being canceled. It is the only record of why the money moved.",
    };
  }

  const { data: order } = await db
    .from("eng_service_orders")
    .select("id, reference, status, currency")
    .eq("id", input.orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "That order does not exist." };

  if (!canTransitionOrder(order.status as never, "refunded")) {
    return {
      ok: false,
      error: `That order is ${order.status}, which cannot be refunded. Only a paid order can be.`,
    };
  }

  const { data: charges } = await db
    .from("eng_order_payments")
    .select("provider, provider_ref, amount_cents")
    .eq("order_id", input.orderId)
    .eq("kind", "charge")
    .eq("status", "succeeded");

  const paidCents = (charges ?? []).reduce((n, c) => n + Number(c.amount_cents), 0);
  const charge = (charges ?? [])[0];

  if (!charge || paidCents <= 0) {
    /*
     * Nothing was ever taken. Cancel it rather than pretending to refund, and
     * say which of the two happened, because "cancelled" and "refunded" are
     * different answers to a customer asking about their card.
     */
    const closed = await markAbandoned(input.orderId, `The firm canceled this order. ${reason}`);
    if (!closed.ok) return { ok: false, error: closed.error };
    await writeAudit({
      actor: input.actor as never,
      action: "order.cancelled_by_firm",
      entityType: "service_order",
      entityId: input.orderId,
      summary: `${order.reference}: canceled with nothing charged. ${reason}`,
    });
    return { ok: true, refundedCents: 0, providerRef: "", alreadyRefunded: false };
  }

  const { data: priorRefunds } = await db
    .from("eng_order_payments")
    .select("amount_cents")
    .eq("order_id", input.orderId)
    .eq("kind", "refund")
    .eq("status", "succeeded");

  const alreadyRefunded = (priorRefunds ?? []).reduce((n, r) => n + Number(r.amount_cents), 0);
  const owed = paidCents - alreadyRefunded;

  if (owed <= 0) {
    return { ok: true, refundedCents: 0, providerRef: "", alreadyRefunded: true };
  }

  const decision = refundForFirmCancellation({ paidCents: owed });
  if (!isKnown(decision.refundCents)) {
    return { ok: false, error: "The amount to refund could not be worked out. Nothing was done." };
  }

  const provider = paymentProvider();
  const result = await provider.refund({
    chargeRef: charge.provider_ref as string,
    amountCents: decision.refundCents,
    reason: FIRM_CANCELLATION_CASE,
  });

  /*
   * The row goes in before the status changes, and a failure to record it is
   * reported as a failure even though the money may already have moved. That
   * ordering is the lesson from settleDecision, which used to tell a customer
   * they had been refunded whether or not the ledger agreed.
   */
  const { data: cancelRefundRow, error: payError } = await db
    .from("eng_order_payments")
    .insert({
      order_id: input.orderId,
      kind: "refund",
      amount_cents: result.amountCents,
      currency: (order.currency as string) ?? "usd",
      provider: provider.name,
      provider_ref: result.ref,
      status: result.status,
      refund_case: FIRM_CANCELLATION_CASE,
      failure_reason: result.failureReason ?? null,
    })
    .select("id")
    .maybeSingle();

  if (result.status === "failed") {
    await event(input.orderId, "refund.failed", false, `The refund did not go through: ${result.failureReason}`);
    return { ok: false, error: result.failureReason ?? "The refund failed at the provider." };
  }

  if (payError) {
    console.error(
      `[payments] ${order.reference}: a firm cancellation refund of ${result.amountCents} went out under ${result.ref} and did not record: ${payError.message}`,
    );
    await event(
      input.orderId,
      "refund.unrecorded",
      false,
      `A refund of ${money(result.amountCents)} was issued under ${result.ref} and could not be written to the ledger. Reconcile this by hand.`,
    );
    return { ok: false, error: "The refund was issued and could not be recorded. It needs a person." };
  }

  await db
    .from("eng_service_orders")
    .update({ status: "refunded", refunded_at: DB_NOW })
    .eq("id", input.orderId);

  await reverseForRefund({
    orderId: input.orderId,
    paymentId: (cancelRefundRow?.id as string | undefined) ?? null,
    refundedCents: result.amountCents,
  });

  await event(input.orderId, "order.cancelled_by_firm", true, decision.explanation, {
    reason,
    refunded_cents: result.amountCents,
    provider_ref: result.ref,
  });

  await writeAudit({
    actor: input.actor as never,
    action: "order.cancelled_by_firm",
    entityType: "service_order",
    entityId: input.orderId,
    summary: `${order.reference}: canceled by the firm and refunded ${money(result.amountCents)}. ${reason}`,
  });

  return {
    ok: true,
    refundedCents: result.amountCents,
    providerRef: result.ref,
    alreadyRefunded: false,
  };
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

    /*
     * THE SEAL IS TOLD TO THE CUSTOMER HERE, AND ONLY FOR A SEAL.
     *
     * This branch is reached by two different decisions: a seal, where there was
     * never anything to refund, and a decline after a visit where the disclosed
     * fee happened to equal what was paid. They are the same arithmetic and
     * opposite news, so the outcome is checked rather than the figure.
     *
     * It lives inside settleDecision for the reason that function exists: one
     * place knows what a decision does to a customer, and a caller that had to
     * remember to send this is a caller that will one day forget.
     */
    if (input.outcome === "seal") await sendOrderSealed(input.orderId);

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

  const { data: decisionRefundRow, error: rowError } = await db
    .from("eng_order_payments")
    .insert({
      order_id: input.orderId,
      kind: "refund",
      amount_cents: result.amountCents,
      provider: provider.name,
      provider_ref: result.ref,
      status: result.status,
      refund_case: decision.caseName,
      failure_reason: result.failureReason ?? null,
    })
    .select("id")
    .maybeSingle();

  if (result.status === "failed") {
    await event(
      input.orderId,
      "refund.failed",
      false,
      `The refund of ${money(decision.refundCents)} failed: ${result.failureReason ?? "no reason given"}. It has to be done by hand.`,
    );

    /*
     * The firm is told, and only the firm. The event above is already marked
     * not customer visible for the reason argued below at refund.unrecorded,
     * and this email carries the same restraint: it takes no customer address
     * and links to the ops screen rather than to a status page.
     */
    await alertRefundFailed(input.orderId, {
      refundCase: decision.caseName,
      amountCents: decision.refundCents,
      because: result.failureReason ?? "no reason given",
      provider: provider.name,
    });

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
      .update({ status: "refunded", refunded_at: DB_NOW })
      .eq("id", input.orderId);
  }

  /*
   * THE COMMISSION FOLLOWS THE REFUND, AND THIS IS THE PATH THAT MATTERS MOST.
   *
   * Two of the four decline outcomes are a FULL refund, so this is the ordinary
   * consequence of an engineer declining rather than a rare correction. The
   * accrual is not edited: a counter entry is written beside it and the two net
   * on the partner's statement.
   *
   * It runs after the refund is recorded, because a reversal of a refund that
   * did not record would be the ledger disagreeing with the money in the other
   * direction.
   */
  await reverseForRefund({
    orderId: input.orderId,
    paymentId: (decisionRefundRow?.id as string | undefined) ?? null,
    refundedCents: decision.refundCents,
  });

  await event(input.orderId, "refund.issued", true, decision.explanation, {
    refunded_cents: decision.refundCents,
    retained_cents: decision.retainedCents,
    case: decision.caseName,
  });

  await sendOrderDeclined(input.orderId, decision);

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

/**
 * A fresh status link for an order, as a URL.
 *
 * WHY EVERY EMAIL MINTS ITS OWN RATHER THAN REUSING THE FIRST.
 *
 * eng_customer_access stores the SHA-256 of the token and nothing else, which is
 * correct: a table of live access tokens in the clear is a table of passwords.
 * The consequence is that a token cannot be read back, only issued, so an email
 * sent later cannot carry the link the confirmation carried.
 *
 * Issuing a second is the right answer rather than a workaround. Each row is an
 * independent grant with its own expiry, revoking one does not strand the
 * others, and the alternative, storing the token so it can be re-sent, would
 * trade a real security property for a tidier table.
 */
async function statusUrlFor(orderId: string, reference: string): Promise<string | null> {
  const link = await issueCustomerLink({ orderId });
  return link ? customerStatusUrl(reference, link.token) : null;
}

/**
 * Tell the firm a refund did not go through.
 *
 * Its own function because both failure sites need it and because the one thing
 * that must never happen here is a customer address finding its way in. There
 * is nowhere to put one: refundFailed takes none, and the message falls to the
 * firm's notification address like every other operator alert.
 *
 * A send failure is swallowed to a console line. The refund has already failed
 * and the event is already on the order; making the alert fatal would turn one
 * problem into two and lose the return value the caller needs.
 */
async function alertRefundFailed(
  orderId: string,
  detail: { refundCase: string; amountCents: number; because: string; provider: string },
): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;

  const { data: order } = await db
    .from("eng_service_orders")
    .select("reference, property_address")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;

  const queued = await queueEmail(
    refundFailed({
      reference: order.reference as string,
      propertyAddress: order.property_address as string,
      refundCase: detail.refundCase,
      amount: money(detail.amountCents),
      because: detail.because,
      provider: detail.provider,
      opsUrl: `${business.url}/portal/orders?id=${orderId}`,
    }),
    { orderId },
  );

  if (!queued.ok) {
    console.error(`[payments] the refund failure alert could not be queued: ${queued.error}`);
  }
}

/**
 * The document is sealed, and the firm emails it by hand.
 *
 * The one piece of good news this firm sends. It used to carry a button reading
 * "Download the document", and the sentence that stood here used to explain it
 * by saying the order status page "is where the uploaded artefact hangs".
 *
 * IT IS NOT, AND IT NEVER WAS. Corrected 2026-10-03. The header on orderSealed
 * in email-templates.ts carries the full account and the sentence it replaced,
 * because the mistake is worth more than the fix: two comments in two files
 * asserted a property of a screen neither session had read, and a paying
 * customer would have been told to download something that does not exist.
 *
 * There is no letter route and there will not be, because a sealed document is
 * uploaded rather than generated. What is MISSING is the upload and the
 * customer's read of it, which is its own piece of work. Until that lands, this
 * notice states the seal and says the document goes to the address on the
 * order, with no link and no timeframe.
 *
 * AND IT NO LONGER NEEDS A STATUS LINK, WHICH REMOVED A BAIL-OUT WORTH NAMING.
 * This function used to mint a status URL for the button and return early when
 * it could not, writing email.not_sent. So a token failure suppressed the one
 * message telling a customer their work was finished, for the sake of a link
 * this email no longer carries. A dependency kept past the feature that needed
 * it is a failure mode with nothing left to protect.
 */
async function sendOrderSealed(orderId: string): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;

  const { data: order } = await db
    .from("eng_service_orders")
    .select("reference, customer_name, customer_email, property_address")
    .eq("id", orderId)
    .maybeSingle();

  if (!order?.customer_email) {
    await event(orderId, "email.not_sent", false, "The seal notice could not be sent: no customer email on the order.");
    return;
  }

  const statusUrl = await statusUrlFor(orderId, order.reference as string);
  if (!statusUrl) {
    await event(orderId, "email.not_sent", false, "The seal notice could not be sent: a status link could not be issued.");
    return;
  }

  const queued = await queueEmail(
    orderSealed({
      customerName: order.customer_name as string,
      customerEmail: order.customer_email as string,
      reference: order.reference as string,
      propertyAddress: order.property_address as string,
      sealedAt: customerWhen(new Date().toISOString()) ?? "just now",
      statusUrl,
    }),
    { orderId },
  );

  await event(
    orderId,
    queued.ok ? "email.sent" : "email.not_sent",
    queued.ok,
    queued.ok
      ? `The sealed document notice was sent to ${order.customer_email}.`
      : `The sealed document notice could not be queued: ${queued.error}. It has to go out by hand.`,
  );
}

/**
 * The engineer could not seal it, and what happened to the money.
 *
 * Every figure is refundFor's, including the sentence: this module carries the
 * decision out and writes it down, it does not restate it. A refund that could
 * not be computed arrives here with nulls, and the template drops the money
 * table rather than printing two "not recorded" rows, which would read as a firm
 * that has lost track of the payment.
 */
async function sendOrderDeclined(
  orderId: string,
  decision: { explanation: string; refundCents: number | null; retainedCents: number | null },
): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;

  const { data: order } = await db
    .from("eng_service_orders")
    .select("reference, customer_name, customer_email, property_address")
    .eq("id", orderId)
    .maybeSingle();

  if (!order?.customer_email) {
    await event(orderId, "email.not_sent", false, "The decline notice could not be sent: no customer email on the order.");
    return;
  }

  const statusUrl = await statusUrlFor(orderId, order.reference as string);
  if (!statusUrl) {
    await event(orderId, "email.not_sent", false, "The decline notice could not be sent: a status link could not be issued.");
    return;
  }

  const queued = await queueEmail(
    orderDeclined({
      customerName: order.customer_name as string,
      customerEmail: order.customer_email as string,
      reference: order.reference as string,
      propertyAddress: order.property_address as string,
      explanation: decision.explanation,
      refunded: isKnown(decision.refundCents) ? money(decision.refundCents) : null,
      retained: isKnown(decision.retainedCents) ? money(decision.retainedCents) : null,
      statusUrl,
    }),
    { orderId },
  );

  await event(
    orderId,
    queued.ok ? "email.sent" : "email.not_sent",
    queued.ok,
    queued.ok
      ? `The decision was sent to ${order.customer_email}.`
      : `The decision could not be queued: ${queued.error}. It has to go out by hand.`,
  );
}

/** Mark that somebody actually attended. The refund rule turns on this alone. */
export async function recordTechnicianVisit(fileId: string): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;

  /*
   * The LIVE order, not the latest one. A technician attending changes what a
   * later decline refunds, so it has to be the engagement being worked rather
   * than whichever quote was written most recently.
   */
  const order = await liveOrderForFile(fileId, "technician_visited");
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

  /* The live order. What a desk job still needs is a question about the
   * engagement in hand, and a cancelled quote alongside it answers nothing. */
  const order = await liveOrderForFile(fileId, "order_type, service_slug, tier");

  if (!order || order.order_type !== "desk") return { applies: false, complete: false, blockers: [] };

  const entry = catalogFor(order.service_slug as string, (order.tier as string | null) ?? undefined);
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
  /* The live order, by the precedence in order-for-file.ts. The review
   * surfaces are asking what this file is being worked under. */
  return await liveOrderForFile(
    fileId,
    "reference, total_cents, inspection_fee_cents, technician_visited, refund_disclosure",
  );
}
