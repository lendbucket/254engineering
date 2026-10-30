import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { withSaveOutcome } from "@/lib/save-outcome";
import {
  PROVING_AMOUNT_CENTS,
  PROVING_REFERENCE,
  provingChargeBlockers,
  runProvingCharge,
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

async function handleGET() {
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

async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);

  /*
   * The body is read and ignored except for the confirmation and the person's
   * own password, which is the point: no amount, no reference and no customer
   * comes from the request. The order of the refusals, and the record written
   * before the checkout, are runProvingCharge's (254-WF-024 step 3, the button
   * on /portal/launch since 2026-10-30).
   */
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const result = await runProvingCharge(actor, {
    confirm: String(body?.confirm ?? ""),
    password: String(body?.password ?? ""),
  });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, ...(result.blockers ? { blockers: result.blockers } : {}) },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    url: result.url,
    sessionRef: result.sessionRef,
    amountCents: PROVING_AMOUNT_CENTS,
    reference: PROVING_REFERENCE,
  });
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const GET = withSaveOutcome(handleGET);
export const POST = withSaveOutcome(handlePOST);
