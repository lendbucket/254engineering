import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { canLookUpOrders, listOrders, type OrderQuery, type OrderRow } from "@/lib/ops-order-lookup";
import { money } from "@/lib/ops-money";
import { telLink } from "@/lib/phone-link";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { DataTable, type Column } from "@/components/portal/design";
import { EmptyState, ErrorState, PageHead } from "@/components/portal/surfaces";
import { ListControls, Pager, listHref } from "@/components/portal/ListControls";

export const dynamic = "force-dynamic";

/**
 * ORDER LOOKUP. orders.read, 2026-10-20. Find an order by anything a customer
 * on the telephone would say. What the customer was charged is shown; what the
 * work cost the firm is not read, so it cannot be.
 */
export default async function OrderLookupPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  if (!actor || !canLookUpOrders(actor)) notFound();
  const params = await searchParams;
  const q: OrderQuery = {
    search: params.q,
    status: params.status ?? "all",
    sort: (params.sort as OrderQuery["sort"]) ?? "placed",
    direction: params.dir === "asc" ? "asc" : "desc",
    page: Number(params.page) || 1,
    pageSize: 50,
  };
  const list = await listOrders(actor, q);
  const qs = new URLSearchParams(Object.entries(params).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();

  const columns: Column<OrderRow>[] = [
    { key: "ref", header: "Order", cell: (o) => <Link href={`/portal/order-lookup/${o.id}`} className="font-semibold text-[var(--navy)] underline">{o.reference}</Link> },
    { key: "customer", header: "Customer", cell: (o) => `${o.customerName}${o.customerCompany ? `, ${o.customerCompany}` : ""}` },
    {
      key: "phone",
      header: "Phone",
      cell: (o) => {
        const href = telLink(o.customerPhone);
        return href ? <a href={href} className="font-semibold text-[var(--navy)] underline">{o.customerPhone}</a> : o.customerPhone ?? "";
      },
    },
    { key: "property", header: "Property", cell: (o) => `${o.propertyAddress}${o.city ? `, ${o.city}` : ""}`, desktopOnly: true },
    { key: "status", header: "Status", cell: (o) => o.status.replace(/_/g, " ") },
    { key: "total", header: "Charged", numeric: true, cell: (o) => (o.totalCents === null ? "No total" : money(o.totalCents)) },
    { key: "placed", header: "Placed", cell: (o) => formatInFirmZone(o.placedAt) ?? "Not placed", desktopOnly: true },
  ];

  return (
    <>
      <PageHead eyebrow="Customers" title="Order lookup" lede="Search by reference, name, email, phone, address, city or county. Reading an order changes nothing." />
      <ListControls
        action="/portal/order-lookup"
        search={params.q ?? ""}
        searchLabel="Reference, name, email, phone, address or city"
        filters={[
          {
            name: "status",
            label: "Status",
            value: q.status ?? "all",
            options: [{ value: "all", label: "Every status" }, ...(list.ok ? list.statuses : []).map((s) => ({ value: s, label: s.replace(/_/g, " ") }))],
          },
        ]}
        sorts={[{ value: "placed", label: "Date placed" }, { value: "reference", label: "Reference" }, { value: "customer", label: "Customer" }, { value: "status", label: "Status" }, { value: "total", label: "Amount charged" }]}
        sort={q.sort ?? "placed"}
        direction={q.direction ?? "desc"}
        csvHref={`/api/portal/order-lookup${qs ? `?${qs}` : ""}`}
      />
      {!list.ok ? (
        <ErrorState title="Orders could not be read" body={`${list.error} Nothing here means there are no orders.`} />
      ) : (
        <>
          <DataTable
            caption="Orders"
            rows={list.rows}
            total={list.total}
            columns={columns}
            empty={<EmptyState title={params.q ? "No order matches that search" : "No orders yet"} body={params.q ? "Try the reference, or part of the email or phone number." : "Orders appear here as customers place them and as jobs taken on the telephone are paid."} />}
          />
          <Pager page={list.page} pageSize={list.pageSize} total={list.total} hrefFor={(n) => listHref("/portal/order-lookup", params, { page: String(n) })} />
        </>
      )}
    </>
  );
}
