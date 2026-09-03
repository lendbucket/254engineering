import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { cancelAndRefund } from "@/lib/ops-payments";

export const dynamic = "force-dynamic";

/**
 * The firm cancels a paid order and gives the money back.
 *
 * POST only, and there is no GET at all. Every other reason for a refund runs
 * through the engineer's decision; this is the one path with no engineering
 * judgment behind it, so it is the one that most needs to be hard to reach by
 * accident. A link cannot trigger it.
 *
 * The reason is required by cancelAndRefund rather than here, so a second
 * caller cannot skip it.
 */
export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  if (!can(actor, "payments.refund")) {
    return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  const reason = typeof body?.reason === "string" ? body.reason : "";

  if (!orderId) {
    return NextResponse.json({ ok: false, error: "Which order?" }, { status: 400 });
  }

  const result = await cancelAndRefund({
    orderId,
    reason,
    actor: { id: actor.id, role: actor.role, email: actor.email },
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    refundedCents: result.refundedCents,
    providerRef: result.providerRef,
    alreadyRefunded: result.alreadyRefunded,
  });
}
