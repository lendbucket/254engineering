import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import { markInquiryResponded, startQuoteFromBrief } from "@/lib/ops-inquiries";
import { withSaveOutcome } from "@/lib/save-outcome";

/**
 * The design brief queue's one write.
 *
 * Its own route rather than a branch on the field endpoint, because a design
 * brief is not field work and folding it in would put an unrelated act behind
 * the same handler that governs captures and repairs.
 */

export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  const context = await requestContext();

  if (action === "mark_answered") {
    const result = await markInquiryResponded(actor, String(body?.inquiryId ?? ""), context);
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }

  /* Robert's answer 2 of 2026-10-27: a quote request carrying the brief, through requestQuote. */
  if (action === "start_quote") {
    const result = await startQuoteFromBrief(actor, String(body?.inquiryId ?? ""), String(body?.tier ?? ""), context);
    return result.ok
      ? NextResponse.json({ ok: true, reference: result.reference, duplicate: result.duplicate })
      : bad(result.error);
  }

  return bad("Unknown action.");
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
