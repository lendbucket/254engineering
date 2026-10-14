import { NextResponse, type NextRequest } from "next/server";
import {
  paymentProvider,
  markPaid,
  markBatchPaid,
  expireCheckout,
  recordExternalRefund,
  recordRefundUpdate,
} from "@/lib/ops-payments";
import { watchWrites, type AbandonedWrite } from "@/lib/bounded-fetch";
import { markStatementPaid } from "@/lib/ops-statements";
import { confirmStripeAccount } from "@/lib/payments-stripe";
import { applyPartnerBillingEvent } from "@/lib/partner-billing";

export const dynamic = "force-dynamic";

/**
 * Where Stripe tells us money moved.
 *
 * THE SIGNATURE IS THE ONLY THING BETWEEN THIS AND A FREE ORDER
 * -------------------------------------------------------------
 * This route is public, because Stripe has to reach it. Everything it does is
 * gated on a signature computed from the raw body and a secret only Stripe and
 * this deployment hold. An unverified body is somebody claiming an order was
 * paid, and readEvent throws rather than returning null on a bad signature
 * precisely so that case can never share a branch with "an event we ignore".
 *
 * THE RAW BODY, NOT THE PARSED ONE
 * --------------------------------
 * The signature covers the exact bytes Stripe sent. request.json() would give
 * an object that re-serializes differently and every signature would fail, so
 * this reads text() and hands the string over untouched.
 *
 * WHY IT ANSWERS 200 TO AN EVENT IT DOES NOT HANDLE
 * -------------------------------------------------
 * Stripe retries a non-2xx for days. An event this firm has no behaviour for is
 * not a failure, and answering 400 to it would build a backlog of retries that
 * hides a real failure among them.
 *
 * A verification failure is the exception and answers 400 without retrying
 * usefully, which is correct: a body we cannot verify will not verify later
 * either.
 *
 * AND 200 ONLY FOR AN EFFECT THAT COMMITTED. Operator rulings, 2026-10-12.
 * --------------------------------------------------------------------
 * Stripe's resends are allowed and relied on. Every handled event is recorded
 * once by its id before any effect, in the same transaction as its money
 * (0075), so a resend of a done event answers 200 and changes nothing, and a
 * resend of one whose work was not fully released releases it.
 *
 * So everything that did not commit answers non 2xx, and Stripe sends it
 * again: a refused write, a status that moved under it, a refund with no
 * charge on file yet, a release that did not finish, and any write the 20
 * second bound abandoned, which may or may not have committed and which the
 * ledger makes safe to send again either way. A 200 means the effect is
 * written or the event was already done.
 */
export async function POST(request: NextRequest) {
  const abandoned: AbandonedWrite[] = [];
  let res: Response;
  try {
    res = await watchWrites(abandoned, () => handle(request));
  } catch (err) {
    console.error(`[stripe] the webhook failed: ${err instanceof Error ? err.message : String(err)}`);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  if (abandoned.length > 0) {
    const where = abandoned.map((w) => `${w.method} ${w.path}`).join(", ");
    console.error(`[stripe] a write was abandoned (${where}), so this event answers 503 and Stripe sends it again.`);
    return NextResponse.json({ ok: false, outcome: "unknown" }, { status: 503 });
  }
  return res;
}

/* Answered with 400: Stripe always sends an id, so only a malformed body lacks one. */
const NO_EVENT_ID = "An event with no id cannot be recorded once, so it was refused.";

async function handle(request: NextRequest): Promise<Response> {
  const raw = await request.text();
  const signature = request.headers.get("stripe-signature");

  const provider = paymentProvider();

  let parsed;
  try {
    parsed = provider.readEvent(raw, signature);
  } catch (err) {
    console.error(
      `[stripe] refused a webhook: ${err instanceof Error ? err.message : "unverifiable"}`,
    );
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  /*
   * LAYER THREE OF THE ACCOUNT CONSISTENCY CHECK, once per process, on the
   * first webhook this process verifies. Operator ruling, 2026-09-16.
   *
   * Awaited rather than fired and forgotten, because a proven mismatch stops
   * new charges and a verdict that lands after the response is a verdict the
   * next request does not have. It is one call and only on the first webhook
   * per process; every later webhook returns immediately.
   *
   * It never throws into this route: establishAccountVerdict swallows every
   * error into "could not tell" by design, so Stripe being down cannot turn a
   * good webhook into a 500.
   */
  if (parsed) await confirmStripeAccount(parsed);

  /*
   * The adapter has already logged which event this was and why it went
   * unhandled. Answering 200 is deliberate: Stripe retries a non-2xx for days,
   * and an event this firm has no behaviour for is not a failure.
   */
  if (!parsed) {
    /*
     * The adapter logs which event this was and why. That is load bearing: this
     * exact branch swallowed four real refunds on 2026-09-03 because readEvent
     * returned null for a field Stripe does not send, and a 200 with no line
     * anywhere is indistinguishable from a webhook that was never delivered.
     */
    return NextResponse.json({ ok: true, handled: false });
  }

  /*
   * THE PARTNER BILLING LANE (0074), before every order branch. It writes the
   * partner billing tables and nothing else. A refused mix was already logged by
   * the adapter and answers 200, because redelivering it will not make it valid;
   * a failed write answers 500, so Stripe retries and the event id keeps the
   * retry from applying twice.
   */
  if (parsed.kind === "partner_billing.refused") {
    return NextResponse.json({ ok: true, handled: false, refused: true });
  }
  if (parsed.kind === "partner_billing") {
    const result = await applyPartnerBillingEvent(parsed.event);
    if (!result.ok) {
      console.error(`[stripe] partner billing ${parsed.event.eventId}: ${result.error}`);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    console.log(
      `[stripe] partner billing ${parsed.event.type} for partner ${parsed.event.partnerId}: ${
        result.duplicate ? "already applied" : `now ${result.status ?? "unchanged"}`
      }`,
    );
    return NextResponse.json({ ok: true, handled: true, duplicate: result.duplicate });
  }

  if (!parsed.eventId) {
    console.error(`[stripe] ${NO_EVENT_ID}`);
    return NextResponse.json({ ok: false, error: NO_EVENT_ID }, { status: 400 });
  }

  if (parsed.kind === "checkout.completed") {
    /*
     * A batch first, because a batch session carries batch_id and no order_id.
     * Falling through to the order branch would look for an order with a batch's
     * id, find nothing, and answer 500 while the money sat in Stripe.
     */
    if (parsed.batchId) {
      const result = await markBatchPaid({
        eventId: parsed.eventId,
        batchId: parsed.batchId,
        chargeRef: parsed.chargeRef,
        amountCents: parsed.amountCents,
        provider: provider.name,
      });

      if (!result.ok) {
        console.error(`[stripe] could not record batch payment for ${parsed.batchId}: ${result.error}`);
        return NextResponse.json({ ok: false }, { status: 500 });
      }

      console.log(
        `[stripe] batch ${parsed.batchId}: ${
          result.duplicate ? `already recorded, ${result.released} released on this delivery` : `recorded and released ${result.released} properties`
        }`,
      );
      return NextResponse.json({
        ok: true,
        handled: true,
        duplicate: result.duplicate,
        released: result.released,
      });
    }

    /*
     * A statement, for the same reason as a batch: its session carries a
     * statement_id and no order_id, and falling through would look for an order
     * that does not exist.
     */
    if (parsed.statementId) {
      const result = await markStatementPaid({
        eventId: parsed.eventId,
        statementId: parsed.statementId,
        chargeRef: parsed.chargeRef,
        amountCents: parsed.amountCents,
        provider: provider.name,
      });

      if (!result.ok) {
        console.error(
          `[stripe] could not record statement payment for ${parsed.statementId}: ${result.error}`,
        );
        return NextResponse.json({ ok: false }, { status: 500 });
      }

      console.log(
        `[stripe] statement ${parsed.statementId}: ${
          result.alreadyRecorded ? "already recorded" : "recorded"
        }`,
      );
      return NextResponse.json({ ok: true, handled: true, duplicate: result.alreadyRecorded });
    }

    if (!parsed.orderId) {
      console.error(`[stripe] a completed checkout carried no order id: ${parsed.sessionRef}`);
      return NextResponse.json({ ok: true, handled: false });
    }

    const result = await markPaid({
      eventId: parsed.eventId,
      orderId: parsed.orderId,
      chargeRef: parsed.chargeRef,
      amountCents: parsed.amountCents,
      provider: provider.name,
    });

    if (!result.ok) {
      /*
       * A 500 so Stripe retries. This is the one case where a retry is what we
       * want: the money moved and the platform failed to record it, and the
       * customer is owed the work.
       */
      console.error(`[stripe] could not record payment for ${parsed.orderId}: ${result.error}`);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true, handled: true, duplicate: result.alreadyRecorded });
  }

  if (parsed.kind === "checkout.expired") {
    /*
     * A batch, same as above and for the same reason. Without this an expired
     * batch would sit at awaiting_payment forever with its orders beneath it,
     * which is precisely the state the stuck order screen exists to catch, ten
     * rows at a time instead of one.
     */
    /*
     * Closes the order rather than only noting the expiry. Writing an event
     * and leaving the status at awaiting_payment is what made an expired
     * checkout and a paid one whose webhook was lost the same row, which cost
     * this platform three orders on 2026-09-03.
     *
     * A failure answers non 2xx (2026-10-12): the expiry that did not commit is
     * sent again, and an order a payment moved first is judged again and left
     * alone.
     */
    if (parsed.batchId || parsed.orderId) {
      const result = await expireCheckout({
        eventId: parsed.eventId,
        orderId: parsed.orderId,
        batchId: parsed.batchId,
        reason: parsed.batchId
          ? "You opened a checkout for these properties and did not finish it. Nothing was charged."
          : "You opened a checkout and did not finish it, so the order was closed. Nothing was charged.",
      });
      if (!result.ok) {
        console.error(`[stripe] could not record the expiry of ${parsed.sessionRef}: ${result.error}`);
        return NextResponse.json({ ok: false }, { status: 500 });
      }
      return NextResponse.json({ ok: true, handled: true, duplicate: result.duplicate, closed: result.closed });
    }
    return NextResponse.json({ ok: true, handled: false });
  }

  if (parsed.kind === "charge.refunded") {
    /*
     * Written down, which the previous version claimed to do and did not.
     *
     * It logged a line and returned handled, with a comment saying this was the
     * only trace of a refund issued in the Stripe dashboard. A log line is not
     * a trace: the firm's ledger would have shown a charge and no refund,
     * permanently, for money that had gone back to a customer.
     *
     * recordExternalRefund records the event once (0075), and it refuses when
     * the charge is not on file rather than inventing one.
     *
     * THAT REFUSAL USED TO BE A 200, on the reasoning that retrying will not
     * conjure the missing charge. By ruling (2026-10-12) it is non 2xx like
     * every other refusal: a refund that is not written is not a refund that
     * was handled, and the charge it needs can arrive in the meantime, through
     * its own late webhook or the reconciliation sweep, in which case the next
     * delivery records the refund.
     */
    const result = await recordExternalRefund({
      eventId: parsed.eventId,
      chargeRef: parsed.chargeRef,
      refundRef: parsed.refundRef,
      refundedToDateCents: parsed.refundedToDateCents,
      provider: provider.name,
    });

    if (!result.ok) {
      console.error(`[stripe] refund ${parsed.refundRef} could not be recorded: ${result.error}`);
      return NextResponse.json(
        { ok: false, reason: result.noCharge ? "no charge on file" : "not recorded" },
        { status: result.noCharge ? 409 : 500 },
      );
    }

    /*
     * Logged on the way through, including the duplicate case. Four refunds
     * once reached this route, verified, answered 200 and left no trace
     * anywhere, and the only way anybody found out was by looking for a row
     * that was not there. A handled webhook should say so.
     */
    console.log(
      `[stripe] refund ${parsed.refundRef} on ${parsed.chargeRef}: ${
        result.alreadyRecorded ? "already on file, nothing written" : `recorded ${result.recordedCents} cents`
      }`,
    );

    return NextResponse.json({ ok: true, handled: true, duplicate: result.alreadyRecorded });
  }

  if (parsed.kind === "charge.refund.updated") {
    /*
     * What became of one refund (0076, operator rulings 2026-10-13). Recorded
     * once by its event id with the row's new status in one transaction; a
     * refund that moved since it was read answers non 2xx so the next delivery
     * judges it again. An id with no refund on file is recorded and answers
     * 200, because a resend cannot produce the row.
     */
    const result = await recordRefundUpdate({
      eventId: parsed.eventId,
      refundRef: parsed.refundRef,
      chargeRef: parsed.chargeRef,
      providerStatus: parsed.providerStatus,
      amountCents: parsed.amountCents,
      failureReason: parsed.failureReason,
      provider: provider.name,
    });

    if (!result.ok) {
      console.error(`[stripe] refund update ${parsed.refundRef} could not be recorded: ${result.error}`);
      return NextResponse.json({ ok: false, reason: "not recorded" }, { status: 500 });
    }

    console.log(
      `[stripe] refund ${parsed.refundRef} is ${parsed.providerStatus} at Stripe: ${
        result.alreadyRecorded
          ? "already on file, nothing written"
          : result.to
            ? `recorded as ${result.to}`
            : result.staffTask
              ? "not on file here, staff task raised"
              : "nothing changed"
      }`,
    );

    return NextResponse.json({ ok: true, handled: true, duplicate: result.alreadyRecorded });
  }

  return NextResponse.json({ ok: true, handled: false });
}
