import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import { markWindstormInquiryResponded } from "@/lib/ops-windstorm-inquiries";

/**
 * The windstorm brief queue's one write.
 *
 * Its own route rather than a branch on the design brief endpoint, for the same
 * reason 0054 is its own table: the two are different records, and one handler
 * governing both would be one place where the wrong table gets updated because
 * an id looked like an id.
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
    const result = await markWindstormInquiryResponded(actor, String(body?.inquiryId ?? ""), context);
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }

  return bad("Unknown action.");
}
