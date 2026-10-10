import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import { decideReview, monthlyExport, openReview, recordTime, type DeterminationInput } from "@/lib/ops-engineer";
import { PROTOCOL_ENTRIES, type Determination } from "@/content/protocols";
import { REVIEW_ACTIONS, type ReviewAction } from "@/lib/ops-review";
import { recordPrereview } from "@/lib/dispatch-hold";
import { decideTraining } from "@/lib/certification-record";

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
    /*
     * THE DETERMINATION IS VALIDATED AGAINST THE REGISTRY HERE, not cast and
     * hoped for. Each registered protocol's determinations are the verbatim
     * transcription of its Appendix C, so a body carrying a sixth word is
     * refused by the documents' own lists rather than reaching a check
     * constraint. Until 2026-10-06 this read RC-001's list by name; with one
     * protocol registered the list is the same.
     *
     * Absent is not the same as invalid: a file with no signed protocol needs
     * no determination, and decideReview decides which is which. So a missing
     * determination passes through as null and a malformed one is refused.
     */
    let determination: DeterminationInput | null = null;
    if (body?.determination) {
      const value = String(body.determination);
      if (!PROTOCOL_ENTRIES.some((p) => p.declaration.determinations.some((d) => d.key === value))) {
        return bad("That is not one of the five determinations in Appendix C.");
      }
      determination = {
        determination: value as Determination,
        reliedOnItemKeys: Array.isArray(body?.reliedOnItemKeys) ? body.reliedOnItemKeys.map(String) : [],
        reliedOnEvidenceIds: Array.isArray(body?.reliedOnEvidenceIds)
          ? body.reliedOnEvidenceIds.map(String)
          : [],
        note: body?.determinationNote ? String(body.determinationNote) : null,
        repairRequirements: Array.isArray(body?.repairRequirements)
          ? body.repairRequirements.map(String)
          : [],
      };
    }

    const result = await decideReview(
      actor,
      String(body?.fileId ?? ""),
      decision as ReviewAction,
      body?.reason ? String(body.reason) : null,
      context,
      determination,
    );
    return result.ok
      ? NextResponse.json({
          ok: true,
          action: result.action,
          minutes: result.minutes,
          paidCents: result.paidCents,
          payNote: result.payNote,
        })
      : bad(result.error);
  }

  /*
   * A HELD JOB, DECIDED BY THE ENGINEER BEFORE DISPATCH. Operator ruling 1 of
   * 2026-10-07. recordPrereview checks the licence, that the job is held, and
   * that a decline carries his referral.
   */
  if (action === "prereview") {
    const decision = String(body?.decision ?? "");
    if (decision !== "accept" && decision !== "decline") return bad("Accept or decline.");
    const result = await recordPrereview(actor, String(body?.fileId ?? ""), decision, String(body?.note ?? ""), context);
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
  }

  /*
   * A CERTIFICATION FROM SUPERVISED TRAINING, decided by the engineer of record
   * from his own session. Operator ruling of 2026-10-07. decideTraining checks
   * the licence against the register, and that a refusal carries his reason.
   */
  if (action === "training_decision") {
    const decision = String(body?.decision ?? "");
    if (decision !== "approve" && decision !== "refuse") return bad("Approve or refuse.");
    const result = await decideTraining(actor, Number(body?.recordId ?? 0), decision, String(body?.reason ?? ""), context);
    return result.ok ? NextResponse.json({ ok: true }) : bad(result.error);
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
