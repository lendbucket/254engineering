import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import {
  PROVING_AMOUNT_CENTS,
  PROVING_REFERENCE,
  provingChargeBlockers,
  startProvingCheckout,
} from "@/lib/ops-proving-charge";

/**
 * THE ONE ROUTE THAT TAKES A CHARGE WITHOUT THE LAUNCH GATE, ONCE, EVER.
 *
 * The reasoning, the fork the operator ruled on, and the four conditions are in
 * src/lib/ops-proving-charge.ts and are not repeated here, because a decision
 * with two accounts is two accounts that will disagree.
 *
 * GET answers what the conditions currently say without doing anything, so the
 * operator can find out whether this will work before it moves money. POST is
 * the act. A GET that charged would be a GET that a browser preload could fire.
 */

export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function GET() {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);

  const blockers = provingChargeBlockers(actor);
  return NextResponse.json({
    ok: true,
    reference: PROVING_REFERENCE,
    amountCents: PROVING_AMOUNT_CENTS,
    ready: blockers.length === 0,
    blockers,
    /*
     * Said on the route that would do it, rather than only in a file somebody
     * has to find: this path never writes stripeAccount.proof.
     */
    afterwards:
      "Refund it in Stripe, then paste the charge id, the refund id, the date and the amount into stripeAccount.proof in src/config/launch-readiness.ts. Nothing here writes that record, because a platform that can set its own gate condition is a gate with one home.",
  });
}

export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);

  /*
   * The body is read and ignored except for the confirmation, which is the
   * point: no amount, no reference and no customer comes from the request. The
   * only thing a caller may supply is the word that says they meant it.
   */
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (String(body?.confirm ?? "") !== PROVING_REFERENCE) {
    return bad(`To take the proving charge, post {"confirm":"${PROVING_REFERENCE}"}.`);
  }

  const blockers = provingChargeBlockers(actor);
  if (blockers.length > 0) return NextResponse.json({ ok: false, blockers }, { status: 409 });

  const result = await startProvingCheckout(actor);
  if (!result.ok) return bad(result.error, 502);

  return NextResponse.json({
    ok: true,
    url: result.url,
    sessionRef: result.sessionRef,
    amountCents: PROVING_AMOUNT_CENTS,
    reference: PROVING_REFERENCE,
  });
}
