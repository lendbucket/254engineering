import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { decideRefund, requestRefund, setRefundLimit } from "@/lib/ops-refund-requests";
import { withSaveOutcome } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

/**
 * REFUND REQUESTS, THEIR DECISIONS, AND THE OPERATOR'S LIMIT. 2026-10-20.
 *
 * POST only and no GET, for the reason api/portal/orders/refund gives: a link
 * cannot move money. Each branch checks its own grant here and again in the
 * library, which also enforces the limit before the decision, immediately
 * before the provider is asked, and at the database.
 */
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");

  if (action === "request") {
    if (!can(actor, "refunds.request")) return bad("Not permitted.", 403);
    const result = await requestRefund(actor, { orderId: String(body?.orderId ?? ""), reason: String(body?.reason ?? "") });
    return result.ok ? NextResponse.json(result) : bad(result.error);
  }

  if (action === "decide") {
    if (!can(actor, "refunds.approve_within_limit") && !can(actor, "payments.refund")) return bad("Not permitted.", 403);
    const decision = body?.decision === "approved" ? "approved" : body?.decision === "declined" ? "declined" : null;
    if (!decision) return bad("Approve or decline.");
    const result = await decideRefund(actor, {
      requestId: String(body?.requestId ?? ""),
      decision,
      note: typeof body?.note === "string" ? body.note : null,
    });
    return result.ok ? NextResponse.json(result) : bad(result.error);
  }

  if (action === "set_limit") {
    if (!can(actor, "settings.refund_limit")) return bad("Not permitted.", 403);
    const dollars = Number(body?.dollars);
    if (!Number.isFinite(dollars) || dollars < 0) return bad("The limit is an amount in dollars, zero or more.");
    const result = await setRefundLimit(actor, {
      cents: Math.round(dollars * 100),
      reason: typeof body?.reason === "string" ? body.reason : null,
    });
    return result.ok ? NextResponse.json(result) : bad(result.error);
  }

  return bad("Unknown action.");
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
