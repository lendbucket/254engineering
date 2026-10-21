import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { listProspects, type ProspectQuery, type ProspectRow } from "@/lib/ops-prospects";
import { PROSPECT_TYPES, PROSPECT_TYPE_LABEL } from "@/lib/prospect-import";
import { telLink } from "@/lib/phone-link";
import { formatInFirmZone, todayInFirmCalendar } from "@/lib/firm-calendar";
import { DataTable, type Column } from "@/components/portal/design";
import { EmptyState, ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { ListControls, Pager, listHref } from "@/components/portal/ListControls";
import { AddProspect, ImportProspects } from "./ProspectsClient";

export const dynamic = "force-dynamic";

/**
 * THE SALES LIST. crm.use, 2026-10-20: roofers, real estate agents, title
 * companies and contractors the firm is calling. Sorted, filtered, searched and
 * paged on the server; the CSV is everything matching the filter.
 */
export default async function ProspectsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  if (!actor || !can(actor, "crm.use")) notFound();
  const params = await searchParams;

  const q: ProspectQuery = {
    search: params.q,
    status: (params.status as ProspectQuery["status"]) ?? "open",
    type: (params.type as ProspectQuery["type"]) ?? "all",
    owner: params.owner ?? "all",
    sort: (params.sort as ProspectQuery["sort"]) ?? "follow_up",
    direction: params.dir === "desc" ? "desc" : "asc",
    page: Number(params.page) || 1,
    pageSize: 50,
  };
  const list = await listProspects(actor, q);
  const today = todayInFirmCalendar();
  const qs = new URLSearchParams(Object.entries(params).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();

  const columns: Column<ProspectRow>[] = [
    { key: "company", header: "Company", cell: (r) => <Link href={`/portal/prospects/${r.id}`} className="font-semibold text-[var(--navy)] underline">{r.company}</Link> },
    { key: "contact", header: "Contact", cell: (r) => r.contactName ?? "" },
    {
      key: "phone",
      header: "Phone",
      cell: (r) => {
        const href = telLink(r.phone);
        return href ? <a href={href} className="font-semibold text-[var(--navy)] underline">{r.phone}</a> : r.phone ?? "";
      },
    },
    { key: "email", header: "Email", cell: (r) => (r.email ? <a href={`mailto:${r.email}`} className="text-[var(--navy)] underline">{r.email}</a> : ""), desktopOnly: true },
    { key: "city", header: "City", cell: (r) => r.city ?? "" },
    { key: "type", header: "Type", cell: (r) => PROSPECT_TYPE_LABEL[r.prospectType] },
    { key: "status", header: "Status", cell: (r) => r.status.replace(/_/g, " ") },
    { key: "follow", header: "Follow up", cell: (r) => (r.followUpOn ? (r.followUpOn < today && r.status === "open" ? `${r.followUpOn}, overdue` : r.followUpOn) : "Not set") },
    { key: "last", header: "Last contact", cell: (r) => (r.lastContactAt ? formatInFirmZone(r.lastContactAt) : "Never"), desktopOnly: true },
    { key: "owner", header: "Owner", cell: (r) => r.ownerName ?? "Nobody yet", desktopOnly: true },
  ];

  return (
    <>
      <PageHead
        eyebrow="Sales"
        title="Sales list"
        lede="Companies the firm is calling that are not customers yet. Calls and email only: nothing here texts anybody, because no opt-in is recorded."
      />

      <ListControls
        action="/portal/prospects"
        search={params.q ?? ""}
        searchLabel="Search company, contact, phone, email or city"
        filters={[
          { name: "status", label: "Status", value: q.status ?? "open", options: [{ value: "open", label: "Open" }, { value: "converted", label: "Customers now" }, { value: "not_interested", label: "Not interested" }, { value: "all", label: "Everything" }] },
          { name: "type", label: "Type", value: q.type ?? "all", options: [{ value: "all", label: "Every type" }, ...PROSPECT_TYPES.map((t) => ({ value: t, label: PROSPECT_TYPE_LABEL[t] }))] },
          { name: "owner", label: "Owner", value: q.owner ?? "all", options: [{ value: "all", label: "Anybody" }, { value: "mine", label: "Mine" }, { value: "unowned", label: "Nobody yet" }] },
        ]}
        sorts={[
          { value: "follow_up", label: "Follow-up date" },
          { value: "company", label: "Company" },
          { value: "city", label: "City" },
          { value: "last_contact", label: "Last contact" },
          { value: "created", label: "Date added" },
        ]}
        sort={q.sort ?? "follow_up"}
        direction={q.direction ?? "asc"}
        csvHref={`/api/portal/prospects${qs ? `?${qs}` : ""}`}
      />

      {!list.ok ? (
        <ErrorState title="The sales list could not be read" body={`${list.error} Nothing here means the list is empty.`} />
      ) : (
        <>
          <DataTable
            caption="Sales list"
            rows={list.rows}
            total={list.total}
            columns={columns}
            empty={
              <EmptyState
                title={params.q || params.type || params.owner ? "Nothing matches that filter" : "The sales list is empty"}
                body={params.q || params.type || params.owner ? "Clear the filter to see every prospect." : "Import a spreadsheet or add a prospect below. Each one appears here and on the call list on the day it is due."}
              />
            }
          />
          <Pager page={list.page} pageSize={list.pageSize} total={list.total} hrefFor={(page) => listHref("/portal/prospects", params, { page: String(page) })} />
        </>
      )}

      <div className="portal-sections mt-8 grid gap-8 print:hidden">
        <Panel title="Import a spreadsheet" description="Check the file first: nothing is saved until you import.">
          <ImportProspects />
        </Panel>
        <Panel title="Add a prospect">
          <AddProspect />
        </Panel>
      </div>
    </>
  );
}
