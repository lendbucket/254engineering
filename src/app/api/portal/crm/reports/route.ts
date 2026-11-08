import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { mayExport } from "@/lib/list-exports";
import { writeAuditOrRefuse } from "@/lib/ops-audit";
import { csv, csvHeaders } from "@/lib/csv";
import { moneyCell } from "@/lib/ops-money";
import { salesReport } from "@/lib/crm-reports";
import { PERIODS, type Period } from "@/lib/crm-report-rules";

export const dynamic = "force-dynamic";

/**
 * THE SALES REPORTS AS A CSV. GET ONLY, AND IT CHANGES NOTHING BUT THE AUDIT
 * TRAIL. Robert's sales CRM ruling R8 of 2026-11-02: "CSV export on the admin
 * export gate." The gate is mayExport: the administrator's export grant AND
 * the reports' own crm.reports (his P2 approval, option a: every CSV export is
 * owner or admin only).
 *
 * AUDITED BEFORE THE FILE. The export is recorded with writeAuditOrRefuse
 * before the response is built, so a file is never handed over without its
 * row: if the row cannot be written, no file.
 *
 * Money through moneyCell (dollars, blank for not set, never 0), every cell
 * through csv() (the formula guard).
 */
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function GET(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!mayExport(actor, "crm.reports")) return bad("Your role cannot export the sales reports.", 403);
  const asked = request.nextUrl.searchParams.get("period") ?? "month";
  if (!(PERIODS as readonly string[]).includes(asked)) return bad("Ask for day, week or month.");
  const period = asked as Period;

  const read = await salesReport(actor, period);
  if (!read.ok) return bad(`${read.error} No file was made.`, 500);
  const r = read.report;

  const recorded = await writeAuditOrRefuse({
    actor,
    action: "export.crm_reports",
    entityType: "report",
    entityId: `crm-reports-${period}`,
    summary: `Sales reports exported by ${period}: ${r.rows.length} rep and period rows.`,
  });
  if (!recorded.ok) return bad(recorded.error, 500);

  const body = csv({
    preamble: [
      ["Sales reports", `by ${period}, as of ${r.today}`],
      ["Orders on converted accounts with no attribution", String(r.unattributedOrders)],
    ],
    headers: ["Period", "Rep", "Dials", "Connects", "Interested", "Accounts opened", "Orders attributed", "Revenue attributed"],
    rows: r.rows.map((row) => [
      row.period,
      row.repName,
      row.dials,
      row.connects,
      row.interested,
      row.accountsOpened,
      row.orders,
      moneyCell(row.revenueCents),
    ]),
  });
  return new NextResponse(body, { headers: csvHeaders(`sales-reports-${period}.csv`) });
}
