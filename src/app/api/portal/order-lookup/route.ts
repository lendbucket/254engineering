import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { canLookUpOrders, listOrders, type OrderQuery } from "@/lib/ops-order-lookup";
import { csv, csvHeaders } from "@/lib/csv";
import { money } from "@/lib/ops-money";

export const dynamic = "force-dynamic";

/**
 * Every order matching the filter, as a CSV. orders.read or payments.reconcile,
 * 2026-10-20. The same columns the lookup shows: what the customer was charged,
 * and nothing about what the work cost the firm.
 */
export async function GET(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  if (!canLookUpOrders(actor)) return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });

  const p = request.nextUrl.searchParams;
  const q: OrderQuery = {
    search: p.get("q") ?? undefined,
    status: p.get("status") ?? "all",
    sort: (p.get("sort") as OrderQuery["sort"]) ?? "placed",
    direction: p.get("dir") === "asc" ? "asc" : "desc",
    pageSize: 200,
  };
  const rows = [];
  for (let page = 1; ; page += 1) {
    const read = await listOrders(actor, { ...q, page });
    if (!read.ok) return NextResponse.json({ ok: false, error: read.error }, { status: 500 });
    rows.push(...read.rows);
    if (page * read.pageSize >= read.total) break;
  }
  const body = csv({
    preamble: [
      ["Orders", `${rows.length} matching the filter`],
      ["Exported", new Date().toISOString()],
    ],
    headers: ["Reference", "Status", "Service", "Customer", "Company", "Email", "Phone", "Property", "City", "County", "Total", "Placed", "Paid"],
    rows: rows.map((r) => [
      r.reference,
      r.status.replace(/_/g, " "),
      r.serviceSlug,
      r.customerName,
      r.customerCompany,
      r.customerEmail,
      r.customerPhone,
      r.propertyAddress,
      r.city,
      r.county,
      r.totalCents === null ? "" : money(r.totalCents),
      r.placedAt,
      r.paidAt,
    ]),
  });
  return new NextResponse(body, { headers: csvHeaders("orders.csv") });
}
