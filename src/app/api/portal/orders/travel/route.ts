import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { setOrderTravel } from "@/lib/order-travel";
import { withSaveOutcome } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

/**
 * SET TRAVEL ON AN ONLINE ORDER WAITING FOR IT, AND SEND THE PAYMENT LINK.
 * Robert's add-on of 2026-11-16 and his answer 12 (6931421644). The
 * administrator alone, by the grant that sets travel on a job; the amount is
 * whole cents above zero, and the reason is for staff. Everything else,
 * including the hold and the order's state, is checked in setOrderTravel.
 */
async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  if (actor.status !== "active") return NextResponse.json({ ok: false, error: "This account is not active." }, { status: 403 });
  if (!can(actor, "pricing.override_at_intake")) {
    return NextResponse.json({ ok: false, error: "Only an administrator sets travel on an order." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  const travelCents = typeof body?.travelCents === "number" ? body.travelCents : NaN;
  const reason = typeof body?.reason === "string" ? body.reason : "";
  if (!orderId) return NextResponse.json({ ok: false, error: "Which order?" }, { status: 400 });

  const result = await setOrderTravel(actor, orderId, travelCents, reason);
  return result.ok ? NextResponse.json(result) : NextResponse.json(result, { status: 422 });
}

export const POST = withSaveOutcome(handlePOST);
