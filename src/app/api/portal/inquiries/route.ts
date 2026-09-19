import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import { markInquiryResponded } from "@/lib/ops-inquiries";

/**
 * The design brief queue's one write.
 *
 * Its own route rather than a branch on the field endpoint, because a design
 * brief is not field work and folding it in would put an unrelated act behind
 * the same handler that governs captures and repairs.
 */

export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  const context = await requestContext();

  if (action === "mark_answered") {
    const result = await markInquiryResponded(actor, String(body?.inquiryId ?? ""), context);
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }

  return bad("Unknown action.");
}
