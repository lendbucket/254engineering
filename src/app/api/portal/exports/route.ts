import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { csvHeaders } from "@/lib/csv";
import { binderCsv, binderFor, fileMargins, marginCsv, periodCsv } from "@/lib/ops-docs";
import { REPORTS, ROW_CEILING, periodOf } from "@/lib/ops-reports";
import { exportFilename, exportRowCount, reportCsv } from "@/lib/ops-report-export";
import { enqueue } from "@/lib/ops-jobs";
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

    /*
     * THE DOWNLOAD IS NOT QUEUED. THE RECORD OF IT IS.
     *
     * The test the whole section is built on is whether the person in front of
     * the request needs this to have happened before the response. For a file
     * somebody just clicked to download, the answer is obviously yes, and a
     * queued CSV is a CSV nobody receives. So the binder is assembled here.
     *
     * What leaves is the entry on the file's own timeline, which is how anybody
     * later reading the file learns a binder was assembled from it and when.
     * That is nobody's blocking concern, and putting it on the queue keeps a
     * slow or unavailable write from failing a download that had already
     * succeeded.
     */
    const recorded = await enqueue("document.binder", {
      fileId,
      requestedFor: stamp(),
    });
    if (!recorded.ok) console.error(`[exports] binder event not queued: ${recorded.error}`);

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

  /*
   * THE FOUR OWNER REPORTS, AS FILES.
   *
   * Phase 12 Section 3. The report is chosen from the REGISTRY rather than from
   * a list here, which is the same reason reporting-audit derives from it: a
   * fifth report added to ops-reports.ts is exportable the day it exists, and
   * cannot ship with an export nobody wrote a permission check for, because the
   * check reads the action off the registry entry.
   *
   * The grant asked for is the report's OWN action, so somebody granted the
   * pipeline can export the pipeline and gets a 403 on revenue. The screen
   * makes the same test against the same field, so a button that appears is a
   * button that works.
   */
  const entry = REPORTS.find((r) => r.key === report);
  if (entry) {
    if (!can(actor, entry.action)) return bad(`Your role cannot read the ${entry.title.toLowerCase()} report.`, 403);

    const asked = request.nextUrl.searchParams.get("period") ?? "";
    const period = /^\d{4}-\d{2}$/.test(asked) ? asked : periodOf();

    const built = await entry.build(period);

    /*
     * THE CEILING, AND A SENTENCE RATHER THAN A TIMEOUT.
     *
     * Operator ruling, 2026-09-09: inline assembly is accepted at today's
     * volume with a stated ceiling, and above it the route refuses with a
     * sentence saying the export is too large and the queued export is not yet
     * built.
     *
     * The report has already said so by the time this runs: a builder whose
     * read was truncated returns no sections and puts the reason in
     * `unavailable`, because a figure computed from part of a set is a
     * plausible number rather than a small one. So the refusal reads the
     * report's own answer rather than counting a second time and possibly
     * disagreeing with it.
     *
     * 413 rather than 500. Nothing failed: the request is too large for the way
     * this is built, which is a different thing and is the thing the response
     * should say.
     */
    const tooLargeToAssemble = built.sections.length === 0 && built.unavailable.some((u) => u.includes(String(ROW_CEILING.toLocaleString("en-US"))));
    if (tooLargeToAssemble) {
      return NextResponse.json({ ok: false, error: built.unavailable.join(" ") }, { status: 413 });
    }

    const body = reportCsv(built, { email: actor.email, role: actor.role });

    await writeAudit({
      actor,
      action: `export.report.${entry.key}`,
      entityType: "report",
      entityId: `${entry.key}:${period}`,
      summary: `Exported the ${entry.title.toLowerCase()} report for ${period}, ${exportRowCount(built)} row(s)${
        built.unavailable.length ? `, with ${built.unavailable.length} figure(s) the report could not compute` : ""
      }`,
      ...context,
    });

    /*
     * The record goes on the queue, the file does not. Same decision as the
     * binder above and for the same reason: the person who clicked Export is
     * standing in front of the response, and a queued CSV is a CSV nobody
     * receives. What the job writes is what the FILE said, taken from the
     * manifest, so a later reader can tell what was handed over rather than
     * what the screen shows today.
     */
    const recorded = await enqueue("report.export", {
      report: entry.key,
      period,
      scope: "real",
      at: stamp(),
      figures: built.sections.reduce((n, s) => n + s.figures.length, 0),
      rows: exportRowCount(built),
      notComputed: built.unavailable.length,
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
    });
    if (!recorded.ok) console.error(`[exports] report export not queued: ${recorded.error}`);

    return new NextResponse(body, { headers: csvHeaders(exportFilename(built)) });
  }

  return bad("That is not a report this platform produces.");
}
