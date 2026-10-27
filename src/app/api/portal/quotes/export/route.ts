import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { listQuotes } from "@/lib/ops-quotes";
import { quoteListRows, shownStatus } from "@/lib/quote-rules";
import { QUOTE_STATUS_LABEL } from "@/lib/ops-orders";
import { csv, csvHeaders } from "@/lib/csv";
import { moneyCell } from "@/lib/ops-money";
import { formatInFirmZone } from "@/lib/firm-calendar";

export const dynamic = "force-dynamic";

/**
 * THE QUOTE LIST AS A CSV. GET ONLY, AND IT MOVES NOTHING.
 *
 * Office ready, operator ruling of 2026-10-20: reports export to CSV. Every
 * quote the screen would show for the same status, search and sort, not one
 * page, because the rows come from quoteListRows, the function the screen uses.
 * Money from moneyCell: dollars, and blank where no price is set, never 0.
 */
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function GET(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return bad("Not signed in.", 401);
  if (!can(actor, "quotes.manage")) return bad("Not permitted.", 403);
  const read = await listQuotes(actor);
  if (!read.ok) return bad(read.error, 500);
  const params = request.nextUrl.searchParams;
  const rows = quoteListRows(read.rows, {
    q: params.get("q") ?? undefined,
    status: params.get("status") ?? undefined,
    sort: params.get("sort") ?? undefined,
    dir: params.get("dir") ?? undefined,
  });
  const now = Date.now();
  const body = csv({
    preamble: [["Quote requests", `${rows.length} matching`]],
    headers: ["Reference", "Asked", "Customer", "Email", "Phone", "Company", "Service", "Property", "County", "Status", "Quoted price", "Sent", "Holds until", "Files"],
    rows: rows.map((r) => [
      r.reference,
      formatInFirmZone(r.createdAt) ?? r.createdAt,
      r.customerName,
      r.customerEmail,
      r.customerPhone ?? "",
      r.customerCompany ?? "",
      r.tier ? `${r.serviceSlug}/${r.tier}` : r.serviceSlug,
      r.propertyAddress ?? "",
      r.county ?? "",
      shownStatus(r, now, QUOTE_STATUS_LABEL),
      moneyCell(r.quotedCents),
      r.sentAt ? (formatInFirmZone(r.sentAt) ?? r.sentAt) : "",
      r.expiresAt ? (formatInFirmZone(r.expiresAt) ?? r.expiresAt) : "",
      String(r.fileCount),
    ]),
  });
  return new NextResponse(body, { headers: csvHeaders("quote-requests.csv") });
}
