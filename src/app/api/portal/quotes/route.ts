import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { declineQuote, quoteFileLink, resendQuote, sendQuote } from "@/lib/ops-quotes";
import { withSaveOutcome } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

/**
 * THE QUOTE DESK'S ONE DOOR. Robert's addendum of 2026-10-25, item 3.
 *
 * POST { action: "send", id, price, scope, holdDays, propertyAddress?, county? }
 * prices a request and sends it; POST { action: "resend", id } sends a sent
 * quote's email again; POST { action: "decline", id, reason }
 * declines one. GET ?file=<id> answers with a five minute link to an attached
 * file. Every path needs quotes.manage, the office and the owner, and the
 * library checks it again, because a route that trusts its caller is a door
 * with one lock.
 */
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!can(actor, "quotes.manage")) return bad("Only the office or the owner prices and sends a quote.", 403);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.id !== "string") return bad("Say which quote request.");
  if (body.action === "send") {
    const result = await sendQuote(actor, {
      id: body.id,
      price: String(body.price ?? ""),
      scope: String(body.scope ?? ""),
      holdDays: body.holdDays,
      propertyAddress: typeof body.propertyAddress === "string" ? body.propertyAddress : undefined,
      county: typeof body.county === "string" ? body.county : undefined,
    });
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }
  if (body.action === "resend") {
    const result = await resendQuote(actor, body.id);
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }
  if (body.action === "decline") {
    const result = await declineQuote(actor, body.id, String(body.reason ?? ""));
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }
  return bad("Unknown action.");
}

export async function GET(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!can(actor, "quotes.manage")) return bad("Only the office or the owner opens a quote's files.", 403);
  const id = request.nextUrl.searchParams.get("file");
  if (!id) return bad("Say which file.");
  const link = await quoteFileLink(actor, id);
  return link.ok ? NextResponse.redirect(link.url, 303) : bad(link.error, 404);
}

/* A save abandoned by the 20 second bound says it may not have saved: save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
