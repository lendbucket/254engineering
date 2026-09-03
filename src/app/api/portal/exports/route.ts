import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { csvHeaders } from "@/lib/csv";
import { binderCsv, binderFor, fileMargins, marginCsv, periodCsv } from "@/lib/ops-docs";
import { writeAudit } from "@/lib/ops-audit";

export const dynamic = "force-dynamic";

/**
 * Every CSV the platform hands out, behind one door.
 *
 * WHY ONE ROUTE AND NOT FOUR
 * --------------------------
 * These files leave the building. Each one names a property, a person, or what
 * something cost. Four routes is four places to get the permission check right,
 * and the third one is where somebody forgets it.
 *
 * One route means one authorization switch, one set of headers, and one audit
 * write. What varies is which report is assembled, and that is chosen from a
 * fixed list rather than from anything the caller sends.
 *
 * EVERY EXPORT IS AUDITED
 * -----------------------
 * A person taking the firm's margins or a file's evidence off the platform is an
 * event worth being able to reconstruct later. The audit row is written before
 * the body is returned.
 */

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

const stamp = () => new Date().toISOString().slice(0, 10);

export async function GET(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (actor.status !== "active") return bad("This account is not active.", 403);

  const report = request.nextUrl.searchParams.get("report") ?? "";
  const context = await requestContext();

  if (report === "binder") {
    const fileId = request.nextUrl.searchParams.get("fileId") ?? "";
    if (!fileId) return bad("Which file?");

    /*
     * binderFor runs the same visibility check the job view runs, so a
     * technician can export the binder for a job they hold and nothing else.
     * The check is not repeated here, because a second copy of it is a second
     * thing to keep in step.
     */
    const binder = await binderFor(actor, fileId);
    if (!binder) return bad("That file is not available to you.", 404);

    await writeAudit({
      actor,
      action: "export.binder",
      entityType: "file",
      entityId: fileId,
      summary: `Exported the evidence binder for ${binder.fileNumber}${
        binder.complete ? "" : `, with ${binder.missingCount} required item(s) missing`
      }`,
      ...context,
    });

    return new NextResponse(binderCsv(binder), {
      headers: csvHeaders(`binder-${binder.fileNumber}-${stamp()}.csv`),
    });
  }

  if (report === "margin" || report === "period") {
    if (!can(actor, "billing.read")) return bad("Your role cannot read the firm's billing.", 403);

    const files = await fileMargins(actor);
    const body = report === "margin" ? marginCsv(files) : periodCsv(files);

    await writeAudit({
      actor,
      action: `export.${report}`,
      entityType: "billing",
      summary: `Exported ${report === "margin" ? "margin by file" : "margin by period"} across ${files.length} file(s)`,
      ...context,
    });

    return new NextResponse(body, {
      headers: csvHeaders(`${report === "margin" ? "margin-by-file" : "margin-by-period"}-${stamp()}.csv`),
    });
  }

  return bad("That is not a report this platform produces.");
}
