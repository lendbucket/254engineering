import { notFound } from "next/navigation";
import { DataTable, type Column } from "@/components/portal/design";
import { ListControls, Pager, listHref } from "@/components/portal/ListControls";
import { PhoneLink } from "@/components/portal/PhoneLink";
import { Chip, EmptyState, PageHead } from "@/components/portal/surfaces";
import { RetryButton } from "@/components/portal/Unreachable";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { mayExport } from "@/lib/list-exports";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { listRooferApplications, type RooferApplicationRow } from "@/lib/ops-roofer-applications";
import { LIST_NOT_LOADED } from "@/lib/outcome-copy";
import { ROOFER_MONTHLY_VOLUME_LABEL, ROOFER_WORK_MIX_LABEL } from "@/lib/roofer-application";
import { RooferApplicationDetail } from "./RooferApplicationDetail";

export const dynamic = "force-dynamic";

/**
 * THE ROOFER PARTNER APPLICATIONS. Robert's request of 2026-11-05.
 *
 * Every application, with every answer one click away on its own page. Built to
 * section 2d from the start: it sorts, filters, searches and pages, it is a
 * table at a desk and cards on a phone, every phone number dials, it exports
 * CSV with the audit row written first, and new applications arrive without a
 * refresh through the portal's live counts, with the waiting count in the tab
 * title. Approve and decline are on each application's page, one click and a
 * reason each.
 */
const PAGE_SIZE = 50;

const STATUS_TONE: Record<RooferApplicationRow["status"], "warn" | "good" | "neutral"> = {
  received: "warn",
  approved: "good",
  declined: "neutral",
};
const STATUS_LABEL: Record<RooferApplicationRow["status"], string> = {
  received: "Waiting for a decision",
  approved: "Approved",
  declined: "Declined",
};

const when = (value: string) =>
  formatInFirmZone(value, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) ?? value;

export default async function RooferApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await currentActor();
  if (!can(actor, "roofers.review")) notFound();

  const params = await searchParams;
  /* One application, every answer and the decision, at ?id= (the shape /portal/files?id= uses). */
  if (params.id) return <RooferApplicationDetail actor={actor} id={params.id} />;

  const status = params.status === "received" || params.status === "approved" || params.status === "declined" || params.status === "all" ? params.status : "received";
  const sort = params.sort === "oldest" || params.sort === "company" ? params.sort : "newest";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const read = await listRooferApplications(actor, { status, q: params.q, sort });
  const rows = read.ok ? read.rows : [];
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const base = { q: params.q, status, sort };

  const columns: Column<RooferApplicationRow>[] = [
    { key: "received", header: "Received", cell: (r) => when(r.createdAt) },
    {
      key: "company",
      header: "Company",
      cell: (r) => (
        <span>
          <span className="font-semibold text-[var(--navy)]">{r.legalName}</span>
          {r.dba ? <span className="block text-[13px] text-[var(--secondary)]">doing business as {r.dba}</span> : null}
        </span>
      ),
    },
    { key: "owner", header: "Owner", cell: (r) => `${r.ownerName}, ${r.ownerTitle}` },
    { key: "phone", header: "Phone", cell: (r) => <PhoneLink phone={r.phone} /> },
    { key: "office", header: "Office", cell: (r) => r.officeCity },
    { key: "work", header: "Work", desktopOnly: true, cell: (r) => `${ROOFER_WORK_MIX_LABEL[r.workMix]}, ${r.crewCount} crew${r.crewCount === 1 ? "" : "s"}` },
    { key: "volume", header: "Expects", desktopOnly: true, cell: (r) => ROOFER_MONTHLY_VOLUME_LABEL[r.monthlyVolume] },
    { key: "certificate", header: "Certificate", desktopOnly: true, cell: (r) => (r.certificatePath ? "Attached" : "Not attached") },
    { key: "status", header: "Status", cell: (r) => <Chip label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} /> },
  ];

  return (
    <>
      <PageHead
        eyebrow="Roofing partners"
        title="Roofer applications"
        lede="Every application from the public form, with every answer and the certificate on its own page. A person reads each one and approves or declines it with a reason; nothing here decides by itself."
      />
      <ListControls
        action="/portal/roofer-applications"
        search={params.q ?? ""}
        searchLabel="Search company, owner, email, phone, city, county or carrier"
        filters={[
          {
            name: "status",
            label: "Show",
            value: status,
            options: [
              { value: "received", label: "Waiting for a decision" },
              { value: "approved", label: "Approved" },
              { value: "declined", label: "Declined" },
              { value: "all", label: "Everything" },
            ],
          },
        ]}
        sorts={[
          { value: "newest", label: "Newest first" },
          { value: "oldest", label: "Oldest first" },
          { value: "company", label: "Company" },
        ]}
        sort={sort}
        direction="desc"
        csvHref={mayExport(actor, "roofers.review") ? listHref("/api/portal/roofer-applications", base, { format: "csv" }) : undefined}
      />

      {!read.ok ? (
        <div role="alert" data-list-not-loaded className="py-6">
          <p className="text-[15px] font-semibold text-[var(--ink)]">{LIST_NOT_LOADED}</p>
          <p className="mt-1 text-[14px] text-[var(--secondary)]">{read.error}</p>
          <div className="mt-4 flex">
            <RetryButton />
          </div>
        </div>
      ) : (
        <>
          <p className="mb-4 text-[14px] text-[var(--secondary)]">
            {rows.length} {rows.length === 1 ? "application" : "applications"}
            {status === "all" ? "" : ` ${STATUS_LABEL[status as RooferApplicationRow["status"]].toLowerCase()}`}
            {params.q ? ", matching the search" : ""}.
          </p>
          <DataTable
            caption="Roofer partner applications"
            columns={columns}
            rows={shown}
            total={rows.length}
            onRowHref={(r) => `/portal/roofer-applications?id=${r.id}`}
            empty={
              <EmptyState
                title={params.q ? "Nothing matches that search" : status === "received" ? "No application is waiting" : "No applications here yet"}
                body={
                  params.q
                    ? "Change the search, or show everything."
                    : "An application arrives here the moment a roofer sends the form at /roofing-partners/apply. It also shows as work due now on the home screen and as a review on the roofer's prospect."
                }
              />
            }
          />
          {rows.length > PAGE_SIZE ? (
            <Pager
              page={page}
              pageSize={PAGE_SIZE}
              total={rows.length}
              hrefFor={(p) => listHref("/portal/roofer-applications", base, { page: String(p) })}
            />
          ) : null}
        </>
      )}
    </>
  );
}
