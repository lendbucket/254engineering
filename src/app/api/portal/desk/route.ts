import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { inboxCountsSince, markLeadContacted } from "@/lib/ops-inbox";
import { resendStatusLink } from "@/lib/ops-payments";
import { releaseAssignment } from "@/lib/ops-field";
import { updateFileDetails } from "@/lib/ops-file-details";
import { supabaseAdmin } from "@/lib/supabase";
import { withSaveOutcome } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

/**
 * THE DESK'S SMALL ACTIONS, AND THE LIVE COUNTS. 2026-10-20.
 *
 * GET answers the counts the portal shows without a refresh (office ready):
 * inquiries waiting, and the inquiries and orders that arrived after the
 * asking screen was rendered. A count that could not be read is null, never
 * zero, so the tab title says nothing rather than "0".
 *
 * POST carries one action per grant, each checked here and again in the
 * library, which writes the audit row first.
 */
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function GET(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);

  /*
   * `since` is when the screen asking was rendered, in milliseconds, so the
   * answer says what has arrived that the screen cannot be showing. Anything
   * unreadable or more than a day back is a day back.
   */
  const asked = Number(request.nextUrl.searchParams.get("since"));
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const sinceMs = Number.isFinite(asked) && asked > dayAgo ? asked : dayAgo;

  const counts = can(actor, "inbox.read") ? await inboxCountsSince(actor, sinceMs) : null;

  let orders: number | null = null;
  if (can(actor, "orders.read") || can(actor, "payments.reconcile")) {
    const db = supabaseAdmin();
    const counted = db
      ? await db
          .from("eng_service_orders")
          .select("id", { count: "exact", head: true })
          .eq("is_demo", false)
          .gte("placed_at", new Date(sinceMs).toISOString())
      : null;
    orders = counted && !counted.error ? (counted.count ?? 0) : null;
  }

  return NextResponse.json(
    { ok: true, inquiries: counts?.waiting ?? null, inquiriesSince: counts?.since ?? null, ordersSince: orders },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");

  if (action === "lead_contacted") {
    if (!can(actor, "inbox.answer")) return bad("Not permitted.", 403);
    const result = await markLeadContacted(actor, String(body?.leadId ?? ""));
    return result.ok ? NextResponse.json(result) : bad(result.error);
  }

  if (action === "resend_status_link") {
    if (!can(actor, "orders.resend_link")) return bad("Not permitted.", 403);
    const result = await resendStatusLink(actor, String(body?.orderId ?? ""));
    return result.ok ? NextResponse.json(result) : bad(result.error);
  }

  if (action === "release_technician") {
    if (!can(actor, "offers.dispatch")) return bad("Not permitted.", 403);
    const result = await releaseAssignment(actor, String(body?.fileId ?? ""), String(body?.reason ?? ""));
    return result.ok ? NextResponse.json(result) : bad(result.error);
  }

  if (action === "update_file_details") {
    if (!can(actor, "files.update_details")) return bad("Not permitted.", 403);
    const values = body?.values && typeof body.values === "object" ? (body.values as Record<string, unknown>) : {};
    const result = await updateFileDetails(actor, {
      fileId: String(body?.fileId ?? ""),
      values: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v ?? "")])),
    });
    return result.ok ? NextResponse.json(result) : bad(result.error);
  }

  return bad("Unknown action.");
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
