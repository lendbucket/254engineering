import "server-only";
import Stripe from "stripe";
import { LIVE_KEY_EXPLANATION, LIVE_KEY_FIX, LIVE_KEY_HEADLINE, liveKeyOffProduction } from "./db-guard";
import type {
  CheckoutRequest,
  CheckoutSession,
  PaymentEvent,
  PaymentProvider,
  RefundRequest,
  RefundResult,
} from "./payments";

/**
 * Stripe, behind the boundary.
 *
 * WHY CHECKOUT SESSIONS AND NOT PAYMENT INTENTS DIRECTLY
 * ------------------------------------------------------
 * A hosted Checkout page means no card number ever reaches this firm's servers,
 * which removes the entire question of PCI scope from a nine person operation.
 * It also gives Apple Pay, address collection and 3D Secure without any of them
 * being this repository's problem.
 *
 * CAPTURE AT SUBMISSION, WHICH IS THE OPERATOR'S RULING
 * -----------------------------------------------------
 * mode "payment" with the default capture behaviour charges the card when the
 * customer completes checkout. Not an authorization held for later.
 *
 * The ruling, 2026-09-02: a card authorization expires in about seven days, and
 * an engineer's review plus a revision cycle may not fit inside that. A deferred
 * capture can therefore fail after the work is already done, which leaves the
 * firm holding completed work it cannot bill. A refund is worse for cash flow
 * and far better for the customer, and it never produces that outcome.
 *
 * THE LINES ARE THE CUSTOMER'S LINES
 * ----------------------------------
 * Each price line becomes its own Stripe line item, so the coastal surcharge is
 * named on the Stripe page and on the receipt Stripe emails, not just on ours.
 * A total that appears on our checkout as two lines and on the receipt as one
 * number invites the question the surcharge ruling exists to prevent.
 */

let client: Stripe | null = null;

function stripe(): Stripe {
  /*
   * The chokepoint, for the same reason refuseIfMispointed sits inside
   * supabaseAdmin: a check in a caller is a convention, and a check in the
   * function that builds the client is the only way there is no path around it.
   */
  if (liveKeyOffProduction()) {
    throw new Error(`${LIVE_KEY_HEADLINE}. ${LIVE_KEY_EXPLANATION} ${LIVE_KEY_FIX}`);
  }
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set.");
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY, {
      /*
       * No apiVersion pinned here on purpose. The account's own default is what
       * the dashboard and the webhooks agree on, and pinning a version in code
       * that the webhook endpoint does not share is how a payload arrives in a
       * shape this adapter does not expect.
       */
      appInfo: { name: "254 Engineering order engine" },
    });
  }
  return client;
}

export function stripeProvider(): PaymentProvider {
  return {
    name: "stripe",

    configured(): boolean {
      /*
       * Not configured, rather than throwing, so startCheckout answers the
       * caller with a sentence instead of a stack trace. The throw in stripe()
       * is what actually protects the money; this is the same fact addressed to
       * whoever is looking at the response.
       */
      if (liveKeyOffProduction()) return false;
      return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
    },

    async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
      const session = await stripe().checkout.sessions.create(
        {
          mode: "payment",
          customer_email: request.customerEmail,
          client_reference_id: request.reference,
          /*
           * The order id travels on the session so the webhook does not have to
           * find it by matching an amount or an email, either of which can be
           * true of two orders at once.
           */
          metadata: { order_id: request.orderId, reference: request.reference },
          payment_intent_data: {
            metadata: { order_id: request.orderId, reference: request.reference },
            description: `${request.reference}: ${request.description}`,
          },
          line_items: request.lines.map((line) => ({
            quantity: 1,
            price_data: {
              currency: request.currency,
              unit_amount: line.amountCents,
              product_data: { name: line.label },
            },
          })),
          success_url: request.successUrl,
          cancel_url: request.cancelUrl,
        },
        /*
         * Idempotent on our order. A retried checkout for the same order gets
         * the same session back rather than a second one, so a customer who
         * double clicks is not looking at two payment pages for one order.
         */
        { idempotencyKey: `checkout:${request.orderId}` },
      );

      if (!session.url) throw new Error("Stripe returned a session with no url.");
      return { ref: session.id, url: session.url };
    },

    async refund(request: RefundRequest): Promise<RefundResult> {
      try {
        const refund = await stripe().refunds.create(
          {
            payment_intent: request.chargeRef,
            amount: request.amountCents,
            reason: "requested_by_customer",
            metadata: { case: request.reason },
          },
          /*
           * Idempotent on the charge and the amount. A webhook retry or a
           * double click on "decline" must not refund twice, and this is the
           * only place that can prevent it before the money moves.
           */
          { idempotencyKey: `refund:${request.chargeRef}:${request.amountCents}` },
        );

        return {
          ref: refund.id,
          amountCents: refund.amount,
          status: refund.status === "succeeded" ? "succeeded" : refund.status === "failed" ? "failed" : "pending",
          failureReason: refund.failure_reason ?? undefined,
        };
      } catch (err) {
        /*
         * Returned rather than thrown, because the caller has to record that a
         * refund was attempted and failed. A thrown error here would leave the
         * decision recorded and the money question unanswered anywhere.
         */
        return {
          ref: `failed:${request.chargeRef}`,
          amountCents: request.amountCents,
          status: "failed",
          failureReason: err instanceof Error ? err.message : "the refund call failed",
        };
      }
    },

    readEvent(rawBody: string, signature: string | null): PaymentEvent | null {
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set.");
      if (!signature) throw new Error("No stripe-signature header.");

      /*
       * constructEvent throws on a bad signature, and that throw is the whole
       * security boundary of this route. An unverified webhook is somebody
       * telling the platform an order was paid.
       */
      const event = stripe().webhooks.constructEvent(rawBody, signature, secret);

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const intent =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
        if (!intent) return null;
        return {
          kind: "checkout.completed",
          sessionRef: session.id,
          chargeRef: intent,
          amountCents: session.amount_total ?? 0,
          orderId: session.metadata?.order_id ?? null,
        };
      }

      if (event.type === "checkout.session.expired") {
        const session = event.data.object as Stripe.Checkout.Session;
        return {
          kind: "checkout.expired",
          sessionRef: session.id,
          orderId: session.metadata?.order_id ?? null,
        };
      }

      if (event.type === "charge.refunded") {
        const charge = event.data.object as Stripe.Charge;
        const intent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        const latest = charge.refunds?.data?.[0];
        if (!intent || !latest) return null;
        return {
          kind: "charge.refunded",
          chargeRef: intent,
          refundRef: latest.id,
          amountCents: latest.amount,
        };
      }

      /*
       * Everything else. Returned as null rather than falling through, so a new
       * Stripe event type cannot take a branch written for a different one.
       */
      return null;
    },
  };
}
