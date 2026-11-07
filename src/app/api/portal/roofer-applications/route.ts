import { NextResponse, type NextRequest } from "next/server";
import { business } from "@/config/business";
import { VERIFICATION_TTL_WORDS } from "@/lib/account-doors";
import { csv, csvHeaders } from "@/lib/csv";
import { rooferApplicationApproved, rooferApplicationDeclined } from "@/lib/email-templates";
import { auditExportOrRefuse } from "@/lib/export-audit";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { mayExport } from "@/lib/list-exports";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { queueEmail } from "@/lib/ops-jobs";
import { decideRooferApplication, listRooferApplications, type RooferListQuery } from "@/lib/ops-roofer-applications";
import {
  ROOFER_MONTHLY_VOLUME_LABEL,
  ROOFER_SERVICE_LABEL,
  ROOFER_WORK_MIX_LABEL,
  profileCompleteness,
} from "@/lib/roofer-application";
import { withSaveOutcome } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

function queryFrom(params: URLSearchParams): RooferListQuery {
  const status = params.get("status");
  const sort = params.get("sort");
  return {
    status: status === "received" || status === "approved" || status === "declined" ? status : "all",
    q: params.get("q") ?? undefined,
    sort: sort === "oldest" || sort === "company" ? sort : "newest",
  };
}

/**
 * GET: the applications as CSV, or as JSON with `?count=waiting` for the tab
 * title's count. The CSV writes its audit row before the file is made, or makes
 * no file (office audit F14 and F20).
 */
export async function GET(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!can(actor, "roofers.review")) return bad("Your role cannot read roofer applications.", 403);

  const params = request.nextUrl.searchParams;
  if (params.get("count") === "waiting") {
    const list = await listRooferApplications(actor, { status: "received" });
    if (!list.ok) return bad(list.error, 500);
    return NextResponse.json({ ok: true, waiting: list.rows.length }, { headers: { "Cache-Control": "no-store" } });
  }

  if (params.get("format") !== "csv") return bad("Ask for format=csv or count=waiting.");
  if (!mayExport(actor, "roofers.review")) return bad("Your role cannot export the roofer applications.", 403);
  const list = await listRooferApplications(actor, queryFrom(params));
  if (!list.ok) return bad(`${list.error} No file was made.`, 500);

  const refused = await auditExportOrRefuse(actor, "export.roofer_applications", `Exported ${list.rows.length} roofer applications as CSV`);
  if (refused) return bad(refused, 503);
  const body = csv({
    preamble: [["Roofer partner applications", `${list.rows.length} matching`]],
    headers: [
      "Received", "Status", "Profile", "Company", "DBA", "Owner", "Title", "Email", "Phone", "Office", "Counties",
      "Years", "Crews", "Work", "Roofs a year", "Expects to order", "Roughly", "Carrier",
      "GL per occurrence", "GL aggregate", "Certificate", "Reference 1", "Reference 1 phone",
      "Reference 2", "Reference 2 phone", "Decided", "Decided by", "Reason",
    ],
    /* A profile answer not given yet is an empty cell; the Profile column says how complete it is (0117). */
    rows: list.rows.map((r) => [
      formatInFirmZone(r.createdAt) ?? r.createdAt,
      r.status,
      profileCompleteness({ work: r.workDoneAt, insurance: r.insuranceDoneAt, references: r.referencesDoneAt }).sentence,
      r.legalName,
      r.dba ?? "",
      r.ownerName,
      r.ownerTitle ?? "",
      r.email,
      r.phone,
      r.officeCity ?? "",
      r.counties.join("; "),
      r.yearsInBusiness ?? "",
      r.crewCount ?? "",
      r.workMix ? ROOFER_WORK_MIX_LABEL[r.workMix] : "",
      r.roofsPerYear ?? "",
      r.services.map((s) => ROOFER_SERVICE_LABEL[s]).join("; "),
      r.monthlyVolume ? ROOFER_MONTHLY_VOLUME_LABEL[r.monthlyVolume] : "",
      r.insuranceCarrier ?? "",
      r.glPerOccurrence ?? "",
      r.glAggregate ?? "",
      r.certificatePath ? "attached" : "none",
      [r.reference1Name, r.reference1Company].filter(Boolean).join(", "),
      r.reference1Phone ?? "",
      [r.reference2Name, r.reference2Company].filter(Boolean).join(", "),
      r.reference2Phone ?? "",
      r.decidedAt ? (formatInFirmZone(r.decidedAt) ?? r.decidedAt) : "",
      r.decidedByName ?? "",
      r.decisionReason ?? "",
    ]),
  });
  return new NextResponse(body, { headers: csvHeaders("roofer-applications.csv") });
}

/**
 * POST { action: "approve" | "decline", id, reason }: one decision, by the
 * person signed in, with a reason. Approval opens the account through door 2
 * and emails the set password link; decline emails one plain note.
 */
async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!can(actor, "roofers.review")) return bad("Your role cannot decide roofer applications.", 403);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "";
  const id = typeof body?.id === "string" ? body.id : "";
  const reason = typeof body?.reason === "string" ? body.reason : "";
  if (action !== "approve" && action !== "decline") return bad("Unknown action.");

  const decided = await decideRooferApplication(actor, {
    id,
    decision: action === "approve" ? "approved" : "declined",
    reason,
  });
  if (!decided.ok) return bad(decided.error);

  if (decided.decision === "approved") {
    /*
     * Since 0117 the account opened at sign up, so the approval email carries no
     * password link; an application from before 0117 still gets one with the
     * account its approval opened.
     */
    const base = (process.env.NEXT_PUBLIC_SITE_URL || business.url).replace(/\/$/, "");
    const queued = await queueEmail(
      rooferApplicationApproved({
        ownerName: decided.ownerName,
        email: decided.email,
        ...(decided.link
          ? {
              link: `${base}/account/set-password?token=${encodeURIComponent(decided.link.token)}`,
              expiresIn: decided.link.expiresIn ?? VERIFICATION_TTL_WORDS,
            }
          : {}),
      }),
    );
    const emailed = queued.ok;
    if (!queued.ok) console.error(`[roofer-applications] approval email not queued: ${queued.error}`);
    return NextResponse.json({ ok: true, decision: "approved", accountId: decided.accountId, emailed });
  }

  const queued = await queueEmail(
    rooferApplicationDeclined({ ownerName: decided.ownerName, legalName: decided.legalName, email: decided.email }),
  );
  if (!queued.ok) console.error(`[roofer-applications] decline email not queued: ${queued.error}`);
  return NextResponse.json({ ok: true, decision: "declined", emailed: queued.ok });
}

export const POST = withSaveOutcome(handlePOST);
