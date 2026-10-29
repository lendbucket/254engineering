import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { csvHeaders } from "@/lib/csv";
import { binderCsv, binderFor, fileMargins, marginCsv, periodCsv } from "@/lib/ops-docs";
import { REPORTS, ROW_CEILING, periodOf } from "@/lib/ops-reports";
import { exportFilename, exportRowCount, reportCsv } from "@/lib/ops-report-export";
import { enqueue } from "@/lib/ops-jobs";
import { writeAudit } from "@/lib/ops-audit";
import { withSaveOutcome } from "@/lib/save-outcome";
import { accountRows } from "@/lib/ops-accounts-admin";
import { accountListQuery } from "@/lib/account-list";
import { accountsCsv, accountsFilename } from "@/lib/account-export";
import type { Action } from "@/lib/ops-authz";
import {
  LIST_EXPORT_GRANT,
  LIST_EXPORT_REPORTS,
  applicationsCsv,
  auditTrailCsv,
  designBriefsCsv,
  listExportFilename,
  partnersCsv,
  peopleCsv,
  suppressionsCsv,
  tasksCsv,
  techniciansCsv,
  windstormBriefsCsv,
  type ListExportReport,
} from "@/lib/list-exports";
import { listEveryApplication } from "@/lib/admin-data";
import { designInquiries } from "@/lib/ops-inquiries";
import { windstormInquiries } from "@/lib/ops-windstorm-inquiries";
import { inquiryListQuery } from "@/lib/inquiry-list";
import { techRoster } from "@/lib/ops-field";
import { techListQuery, techListRows } from "@/lib/tech-list";
import { partnerRoster } from "@/lib/ops-partners-admin";
import { partnerListRows } from "@/lib/partner-list";
import { listEveryTask } from "@/lib/ops-tasks";
import { readPeople } from "@/lib/people-roster";
import { listSuppressions } from "@/lib/marketing-suppression";
import { PEOPLE_LIST, SUPPRESSION_LIST, staffListQuery, staffListRows } from "@/lib/staff-lists";
import { auditTrailEvery, auditTrailQuery } from "@/lib/audit-trail-list";

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

async function handleGET(request: NextRequest) {
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

    /*
     * A failed read is not an empty firm, and an export is the worst place to
     * confuse them: a CSV of nothing, headed as a margin report, handed to an
     * accountant, is a statement that the firm delivered no work.
     */
    const files = await fileMargins(actor);
    if (files === null) {
      return bad("The margin figures could not be read. Nothing was exported, because an empty file would say the firm delivered nothing.", 503);
    }
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

  if (report === "accounts") {
    /*
     * EVERY MATCHING ORDERING ACCOUNT. Robert, 2026-10-28, 16:11 Central:
     * owner or admin only, which is accounts.manage, the grant the accounts
     * screen itself asks and that roles-audit pins to the administrator alone.
     * The query is the page's own, parsed by accountListQuery, and the rows are
     * accountRows with scope "every", so the file holds exactly the accounts
     * the screen would page through.
     *
     * A failed read refuses the file. A CSV of some accounts, headed as the
     * firm's ordering accounts, is a statement that the rest do not exist.
     */
    if (!can(actor, "accounts.manage")) return bad("Your role cannot export the ordering accounts.", 403);
    const p = request.nextUrl.searchParams;
    const query = accountListQuery({
      q: p.get("q") ?? undefined,
      status: p.get("status") ?? undefined,
      billing: p.get("billing") ?? undefined,
      attention: p.get("attention") ?? undefined,
      sort: p.get("sort") ?? undefined,
      dir: p.get("dir") ?? undefined,
    });
    const read = await accountRows(query, "every");
    if (!read.ok) {
      return bad(`The ordering accounts could not be read, so nothing was exported: ${read.unavailable.join(" ")}`, 503);
    }

    await writeAudit({
      actor,
      action: "export.accounts",
      entityType: "account",
      summary: `Exported ${read.rows.length} ordering account(s) of ${read.all}`,
      ...context,
    });

    return new NextResponse(accountsCsv(read.rows, query, read.all), { headers: csvHeaders(accountsFilename(stamp())) });
  }

  if ((LIST_EXPORT_REPORTS as readonly string[]).includes(report)) {
    /*
     * THE STAFF LISTS, OWNER OR ADMIN ONLY. Robert, 21:07 Central 2026-10-28:
     * the same as the accounts export. Two grants, both asked before anything
     * is read: LIST_EXPORT_GRANT, the administrator's (list-exports.ts says
     * why it is that one), and the screen's own, so a file never carries more
     * than its screen shows. Each list is read through the screen's own
     * function and filter with every row, and a read that failed or came back
     * partial refuses the file before any audit row: a CSV of some rows,
     * headed as the list, is a statement that the rest do not exist.
     */
    const listReport = report as ListExportReport;
    const screenGrant: Record<ListExportReport, Action> = {
      applications: "applications.read",
      "design-briefs": "files.create",
      "windstorm-briefs": "files.create",
      technicians: "profiles.list",
      partners: "partners.manage",
      tasks: "tasks.use",
      people: "profiles.list",
      suppressions: "suppressions.manage",
      "audit-trail": "audit.read",
    };
    if (!can(actor, LIST_EXPORT_GRANT) || !can(actor, screenGrant[listReport])) {
      return bad("Your role cannot export this list.", 403);
    }
    const p = request.nextUrl.searchParams;
    const param = (k: string) => p.get(k) ?? undefined;
    const describe = (pairs: [string, string | undefined][]) =>
      pairs.filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(", ") || "everything the screen lists by default";
    const refuse = (what: string, why: string) => bad(`The ${what} could not be read, so nothing was exported: ${why}`, 503);

    let body: string;
    let count: number;
    if (listReport === "applications") {
      const read = await listEveryApplication({ q: param("q"), role: param("role") });
      if (!read.ok) return refuse("applications", read.error);
      body = applicationsCsv(read.rows, describe([["search", param("q")], ["position", param("role")]]));
      count = read.rows.length;
    } else if (listReport === "design-briefs" || listReport === "windstorm-briefs") {
      const query = inquiryListQuery({ q: param("q"), show: param("show"), sort: param("sort"), dir: param("dir") });
      const filter = describe([["search", param("q")], ["show", param("show")], ["sort", param("sort")], ["direction", param("dir")]]);
      if (listReport === "design-briefs") {
        const read = await designInquiries(actor, query, "every");
        if (!read.ok) return refuse("design briefs", read.error);
        body = designBriefsCsv(read.rows, filter);
        count = read.rows.length;
      } else {
        const read = await windstormInquiries(actor, query, "every");
        if (!read.ok) return refuse("windstorm briefs", read.error);
        body = windstormBriefsCsv(read.rows, filter);
        count = read.rows.length;
      }
    } else if (listReport === "technicians") {
      const read = await techRoster(actor);
      if (!read.ok) return refuse("technicians", read.error);
      if (read.failed.length) return refuse("technicians", read.failed.join(" "));
      const rows = techListRows(read.rows, techListQuery({ q: param("q"), status: param("status"), sort: param("sort"), dir: param("dir") }));
      body = techniciansCsv(rows, describe([["search", param("q")], ["status", param("status")], ["sort", param("sort")], ["direction", param("dir")]]));
      count = rows.length;
    } else if (listReport === "partners") {
      const read = await partnerRoster(actor);
      if (!read.ok) return refuse("partners", read.error);
      if (read.failed.length) return refuse("partners", read.failed.join(" "));
      const rows = partnerListRows(read.rows, { q: param("q"), state: param("state") });
      body = partnersCsv(rows, describe([["search", param("q")], ["state", param("state")]]));
      count = rows.length;
    } else if (listReport === "people") {
      const read = await readPeople();
      if (!read.ok) return refuse("people", read.error);
      const rows = staffListRows(read.rows, staffListQuery({ q: param("q"), status: param("status"), sort: param("sort"), dir: param("dir") }, PEOPLE_LIST), PEOPLE_LIST);
      body = peopleCsv(rows, describe([["search", param("q")], ["status", param("status")], ["sort", param("sort")], ["direction", param("dir")]]));
      count = rows.length;
    } else if (listReport === "suppressions") {
      const all = await listSuppressions();
      if (all === null) return refuse("do not contact list", "the read failed.");
      const rows = staffListRows(all, staffListQuery({ q: param("q"), source: param("source"), state: param("state"), sort: param("sort"), dir: param("dir") }, SUPPRESSION_LIST), SUPPRESSION_LIST);
      body = suppressionsCsv(rows, describe([["search", param("q")], ["source", param("source")], ["standing", param("state")], ["sort", param("sort")], ["direction", param("dir")]]));
      count = rows.length;
    } else if (listReport === "audit-trail") {
      const read = await auditTrailEvery(auditTrailQuery({ q: param("q"), who: param("who"), dir: param("dir") }));
      if (!read.ok) return refuse("audit trail", read.error);
      body = auditTrailCsv(read.rows, describe([["search", param("q")], ["who", param("who")], ["direction", param("dir")]]));
      count = read.rows.length;
    } else {
      const rows = await listEveryTask(actor, { status: param("status"), q: param("q") });
      if (rows === null) return refuse("tasks", "the read failed.");
      body = tasksCsv(rows, describe([["search", param("q")], ["status", param("status")]]));
      count = rows.length;
    }

    await writeAudit({
      actor,
      action: `export.${listReport}`,
      entityType: "export",
      summary: `Exported ${count} row(s) of ${listReport}`,
      ...context,
    });

    return new NextResponse(body, { headers: csvHeaders(listExportFilename(listReport, stamp())) });
  }

  /*
   * THE FOUR OWNER REPORTS, AS FILES.
   *
   * Phase 12 Section 2, the reporting prompt's Section 3. The report is chosen from the REGISTRY rather than from
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

    /* The actor, for the reason the screen passes it: the grant decides which
     * report, and the builder decides whose rows are in it. */
    const built = await entry.build(period, "real", actor);

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

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const GET = withSaveOutcome(handleGET);
