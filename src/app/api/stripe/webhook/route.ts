import { NextResponse, type NextRequest } from "next/server";
import {
  paymentProvider,
  markPaid,
  markBatchPaid,
  markAbandoned,
  abandonBatch,
  recordExternalRefund,
} from "@/lib/ops-payments";
import { markStatementPaid } from "@/lib/ops-statements";

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
 */
export async function POST(request: NextRequest) {
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

  if (parsed.kind === "checkout.completed") {
    /*
     * A batch first, because a batch session carries batch_id and no order_id.
     * Falling through to the order branch would look for an order with a batch's
     * id, find nothing, and answer 500 while the money sat in Stripe.
     */
    if (parsed.batchId) {
      const result = await markBatchPaid({
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
          result.alreadyRecorded ? "already recorded" : `recorded and released ${result.released} properties`
        }`,
      );
      return NextResponse.json({
        ok: true,
        handled: true,
        duplicate: result.alreadyRecorded,
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
    if (parsed.batchId) {
      await abandonBatch(
        parsed.batchId,
        "You opened a checkout for these properties and did not finish it. Nothing was charged.",
      );
      return NextResponse.json({ ok: true, handled: true });
    }

    if (parsed.orderId) {
      /*
       * Closes the order rather than only noting the expiry. Writing an event
       * and leaving the status at awaiting_payment is what made an expired
       * checkout and a paid one whose webhook was lost the same row, which cost
       * this platform three orders on 2026-09-03.
       */
      await markAbandoned(
        parsed.orderId,
        "You opened a checkout and did not finish it, so the order was closed. Nothing was charged.",
      );
    }
    return NextResponse.json({ ok: true, handled: true });
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
     * recordExternalRefund is idempotent on the refund's own id, so a redelivery
     * is one row, and it refuses when the charge is not on file rather than
     * inventing one. That refusal is a 200 because retrying will not conjure the
     * missing charge; reconciliation is what fixes that case.
     */
    const result = await recordExternalRefund({
      chargeRef: parsed.chargeRef,
      refundRef: parsed.refundRef,
      refundedToDateCents: parsed.refundedToDateCents,
      provider: provider.name,
    });

    if (!result.ok) {
      console.error(`[stripe] refund ${parsed.refundRef} could not be recorded: ${result.error}`);
      return NextResponse.json({ ok: true, handled: false, reason: "no charge on file" });
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

  return NextResponse.json({ ok: true, handled: false });
}
