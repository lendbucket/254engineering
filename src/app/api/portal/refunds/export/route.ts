import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { listRefundRequests } from "@/lib/ops-refund-requests";
import { refundListRows } from "@/lib/refund-list";
import { csv, csvHeaders } from "@/lib/csv";
import { moneyCell } from "@/lib/ops-money";
import { formatInFirmZone } from "@/lib/firm-calendar";

export const dynamic = "force-dynamic";

/**
 * THE REFUND REQUESTS AS A CSV. GET ONLY, AND IT MOVES NOTHING.
 *
 * Office ready, operator ruling of 2026-10-20: "Order summaries and reports
 * print cleanly and export to CSV." Its own route because api/portal/refunds is
 * POST only by design (a link cannot move money), and this is a read.
 *
 * Every request the screen would show for the same state, search and sort, not
 * one page: the rows come from refundListRows, the function the screen uses.
 * Money from moneyCell: dollars, and blank where a figure is unknown, never 0.
 * The same grants as the screen.
 */
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function GET(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!(can(actor, "refunds.request") || can(actor, "refunds.approve_within_limit") || can(actor, "payments.refund"))) {
    return bad("Not permitted.", 403);
  }
  const params = request.nextUrl.searchParams;
  const raw = params.get("state");
  const state = raw === "decided" || raw === "all" ? raw : "waiting";
  const read = await listRefundRequests(actor, { state });
  if (!read.ok) return bad(read.error, 500);
  const rows = refundListRows(read.rows, {
    q: params.get("q") ?? undefined,
    sort: params.get("sort") ?? undefined,
    dir: params.get("dir") ?? undefined,
  });
  const body = csv({
    preamble: [["Refund requests", `${rows.length} matching (${state})`]],
    headers: ["Order", "Asked at", "Asked by", "Owed back when asked", "Why", "Decision", "Refunded", "Decided at", "Decided by"],
    rows: rows.map((r) => [
      r.orderReference ?? "",
      formatInFirmZone(r.createdAt) ?? r.createdAt,
      r.requestedByName ?? "",
      moneyCell(r.owedCentsAtRequest),
      r.reason,
      r.decision ? r.decision.decision : "waiting",
      r.decision ? moneyCell(r.decision.refundedCents) : "",
      r.decision ? (formatInFirmZone(r.decision.decidedAt) ?? r.decision.decidedAt) : "",
      r.decision?.decidedByName ?? "",
    ]),
  });
  return new NextResponse(body, { headers: csvHeaders(`refund-requests-${state}.csv`) });
}
