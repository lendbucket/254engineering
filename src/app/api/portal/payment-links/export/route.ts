import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { listBillableJobs } from "@/lib/ops-bill-list";
import { BILL_INTENT_LABEL, billListRows } from "@/lib/billing-rules";
import { csv, csvHeaders } from "@/lib/csv";
import { moneyCell } from "@/lib/ops-money";
import { formatInFirmZone } from "@/lib/firm-calendar";

export const dynamic = "force-dynamic";

/**
 * THE PAYMENT LINKS LIST AS A CSV. GET ONLY, AND IT MOVES NOTHING.
 *
 * Office ready, 2026-10-20: lists export to CSV. Every job the screen would
 * show for the same filter, search and sort, not one page, because the rows
 * come from billListRows, the function the screen uses. Money from moneyCell:
 * dollars, and blank where no price is set, never 0.
 */
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function GET(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!can(actor, "payments.charge")) return bad("Not permitted.", 403);
  const read = await listBillableJobs(actor);
  if (!read.ok) return bad(read.error, 500);
  const params = request.nextUrl.searchParams;
  const rows = billListRows(read.rows, {
    q: params.get("q") ?? undefined,
    show: params.get("show") ?? undefined,
    sort: params.get("sort") ?? undefined,
    dir: params.get("dir") ?? undefined,
  });
  const body = csv({
    preamble: [["Jobs not yet paid", `${rows.length} matching`]],
    headers: ["File", "Opened", "Client", "Email", "Phone", "Service", "Property", "County", "Status", "Billing", "Price", "Account on invoice terms"],
    rows: rows.map((r) => [
      r.fileNumber,
      formatInFirmZone(r.createdAt) ?? r.createdAt,
      r.clientName,
      r.clientEmail ?? "",
      r.clientPhone ?? "",
      r.deliverable ? `${r.serviceSlug}/${r.deliverable}` : r.serviceSlug,
      r.propertyAddress,
      r.county,
      r.status,
      BILL_INTENT_LABEL[r.paymentIntent],
      moneyCell(r.priceCents),
      r.accountCanInvoice ? "Yes" : "No",
    ]),
  });
  return new NextResponse(body, { headers: csvHeaders("jobs-not-yet-paid.csv") });
}
