import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import { decideReview, monthlyExport, openReview, recordTime } from "@/lib/ops-engineer";
import { REVIEW_ACTIONS, type ReviewAction } from "@/lib/ops-review";

/**
 * The engineer's decisions, and the export a regulator reads.
 *
 * Separate from the field endpoint because these are a different kind of act: a
 * decision here moves a file, writes a regulatory record, and pays somebody.
 * Keeping them apart means the audit trail reads as two kinds of thing and a
 * future guard can sit on one without sitting on the other.
 */

export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  const context = await requestContext();

  if (action === "open_review") {
    const result = await openReview(actor, String(body?.fileId ?? ""), context);
    return result.ok ? NextResponse.json({ ok: true, sessionId: result.sessionId }) : bad(result.error);
  }

  if (action === "decide") {
    const decision = String(body?.decision ?? "");
    if (!REVIEW_ACTIONS.includes(decision as ReviewAction)) return bad("Unknown review decision.");
    const result = await decideReview(
      actor,
      String(body?.fileId ?? ""),
      decision as ReviewAction,
      body?.reason ? String(body.reason) : null,
      context,
    );
    return result.ok
      ? NextResponse.json({
          ok: true,
          action: result.action,
          minutes: result.minutes,
          paidCents: result.paidCents,
        })
      : bad(result.error);
  }

  if (action === "record_time") {
    const result = await recordTime(
      actor,
      {
        fileId: body?.fileId ? String(body.fileId) : null,
        kind: String(body?.kind ?? "review"),
        minutes: Number(body?.minutes ?? 0),
        note: body?.note ? String(body.note) : null,
        startedAt: body?.startedAt ? String(body.startedAt) : null,
      },
      context,
    );
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }

  return bad("Unknown action.");
}

/**
 * The monthly responsible charge export, as a file.
 *
 * A GET returning a download rather than a POST returning JSON, because the
 * thing an engineer wants is a file on their machine to send to a regulator or
 * keep for their own records, and making them copy JSON out of a browser
 * console is not that.
 */
export async function GET(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);

  const period = request.nextUrl.searchParams.get("period") ?? "";
  const engineerId = request.nextUrl.searchParams.get("engineerId") ?? undefined;

  const result = await monthlyExport(actor, period, engineerId);
  if (!result.ok) return bad(result.error);

  return new NextResponse(result.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      /*
       * A responsible charge log is not something a proxy or a browser should
       * hold on to. It names properties, and it names the reviews an engineer
       * declined.
       */
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
