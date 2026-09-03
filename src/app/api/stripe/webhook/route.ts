import { NextResponse, type NextRequest } from "next/server";
import { paymentProvider, markPaid } from "@/lib/ops-payments";
import { event } from "@/lib/ops-intake";

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
  if (!parsed) return NextResponse.json({ ok: true, handled: false });

  if (parsed.kind === "checkout.completed") {
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
    if (parsed.orderId) {
      await event(
        parsed.orderId,
        "checkout.expired",
        false,
        "The customer opened a checkout and did not finish it. Nothing was charged.",
      );
    }
    return NextResponse.json({ ok: true, handled: true });
  }

  if (parsed.kind === "charge.refunded") {
    /*
     * Recorded, not acted on. The platform issues its own refunds through
     * settleDecision and writes the row there; this is the confirmation, and a
     * refund somebody made in the Stripe dashboard instead shows up here as the
     * only trace of it.
     */
    console.log(`[stripe] refund confirmed ${parsed.refundRef} on ${parsed.chargeRef}`);
    return NextResponse.json({ ok: true, handled: true });
  }

  return NextResponse.json({ ok: true, handled: false });
}
