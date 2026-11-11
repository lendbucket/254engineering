import Link from "next/link";
import { notFound } from "next/navigation";
import { DataTable, type Column } from "@/components/portal/design";
import { ListControls, Pager, listHref } from "@/components/portal/ListControls";
import { PhoneLink } from "@/components/portal/PhoneLink";
import { Chip, EmptyState, PageHead, Panel } from "@/components/portal/surfaces";
import { RetryButton } from "@/components/portal/Unreachable";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { FRANCHISEE_STATUSES, FRANCHISEE_STATUS_LABEL, type FranchiseeStatus } from "@/lib/franchisee-rules";
import { franchiseeDetail, listFranchisees, type FranchiseeRow } from "@/lib/franchisees";
import { mayExport } from "@/lib/list-exports";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { LIST_NOT_LOADED } from "@/lib/outcome-copy";
import { MemberControls, NewFranchiseeForm, OfficeForm, StatusForm, TerritoryControls } from "./FranchiseesClient";

export const dynamic = "force-dynamic";

/**
 * THE FRANCHISEE RECORD (0126). Robert's overnight orders of 2026-11-10,
 * platform item X1: a franchisee holds sales territories and its own people,
 * and has its own office NAP.
 *
 * franchise.manage, which only admin holds. STAFF AND ADMIN ONLY: there is no
 * public page, nothing here offers a franchise, and FR13 stands. Built to
 * section 2d from the start: the list sorts, filters, searches and pages, it is
 * a table at a desk and cards on a phone, every phone number dials, and it
 * exports CSV with the audit row written first. A franchisee is entered by an
 * administrator rather than arriving from outside, so there is no live count.
 */
const PAGE_SIZE = 50;

const STATUS_TONE: Record<FranchiseeStatus, "warn" | "good" | "neutral"> = {
  onboarding: "warn",
  operating: "good",
  ended: "neutral",
};

const when = (value: string) => formatInFirmZone(value, { month: "short", day: "numeric", year: "numeric" }) ?? value;

const officeLine = (r: FranchiseeRow) => (r.office.street ? `${r.office.street}, ${r.office.city} ${r.office.postalCode}` : "No office recorded yet");

export default async function FranchiseesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  if (!can(actor, "franchise.manage")) notFound();
  const params = await searchParams;
  if (params.id) return <FranchiseeView id={params.id} />;

  const status = (FRANCHISEE_STATUSES as readonly string[]).includes(String(params.status)) ? (params.status as FranchiseeStatus) : "all";
  const sort = params.sort === "newest" || params.sort === "oldest" ? params.sort : "name";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const read = await listFranchisees(actor, { status, q: params.q, sort });
  const rows = read.ok ? read.rows : [];
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const base = { q: params.q, status, sort };

  const columns: Column<FranchiseeRow>[] = [
    { key: "name", header: "Franchisee", cell: (r) => <span className="font-semibold text-[var(--navy)]">{r.legalName}</span> },
    { key: "status", header: "Status", cell: (r) => <Chip label={FRANCHISEE_STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} /> },
    {
      key: "territories",
      header: "Territories",
      cell: (r) => (r.territories.length ? r.territories.map((t) => t.name).join(", ") : "None yet"),
    },
    { key: "people", header: "People", cell: (r) => String(r.members) },
    { key: "office", header: "Office", desktopOnly: true, cell: officeLine },
    { key: "phone", header: "Phone", cell: (r) => (r.office.phone ? <PhoneLink phone={r.office.phone} /> : "None yet") },
    { key: "added", header: "Added", desktopOnly: true, cell: (r) => when(r.createdAt) },
  ];

  return (
    <>
      <PageHead
        eyebrow="Franchise"
        title="Franchisees"
        lede="The firm's own record of each franchisee it has an agreement with: its office, the sales territories it holds, and its people. Staff and administrators only; nothing here is public."
      />
      <Panel title="Add a franchisee" className="mb-6">
        <NewFranchiseeForm />
      </Panel>
      <ListControls
        action="/portal/franchisees"
        search={params.q ?? ""}
        searchLabel="Search name, office, phone or territory"
        filters={[
          {
            name: "status",
            label: "Show",
            value: status,
            options: [
              { value: "all", label: "Everything" },
              { value: "onboarding", label: "Onboarding" },
              { value: "operating", label: "Operating" },
              { value: "ended", label: "Ended" },
            ],
          },
        ]}
        sorts={[
          { value: "name", label: "Name" },
          { value: "newest", label: "Newest first" },
          { value: "oldest", label: "Oldest first" },
        ]}
        sort={sort}
        direction="asc"
        csvHref={mayExport(actor, "franchise.manage") ? listHref("/api/portal/franchisees", base, { format: "csv" }) : undefined}
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
            {rows.length} {rows.length === 1 ? "franchisee" : "franchisees"}
            {status === "all" ? "" : `, ${FRANCHISEE_STATUS_LABEL[status].toLowerCase()}`}
            {params.q ? ", matching the search" : ""}.
          </p>
          <DataTable
            caption="Franchisees"
            columns={columns}
            rows={shown}
            total={rows.length}
            onRowHref={(r) => `/portal/franchisees?id=${r.id}`}
            empty={
              <EmptyState
                title={params.q ? "Nothing matches that search" : "No franchisee is on record"}
                body={
                  params.q
                    ? "Change the search, or show everything."
                    : "Add one above by its legal name once its agreement is signed. It starts as onboarding; then give it its office, territories and people."
                }
              />
            }
          />
          {rows.length > PAGE_SIZE ? (
            <Pager page={page} pageSize={PAGE_SIZE} total={rows.length} hrefFor={(p) => listHref("/portal/franchisees", base, { page: String(p) })} />
          ) : null}
        </>
      )}
    </>
  );
}

async function FranchiseeView({ id }: { id: string }) {
  const actor = await currentActor();
  const read = await franchiseeDetail(actor, id);
  if (!read.ok) {
    return (
      <>
        <PageHead eyebrow="Franchise" title="Franchisee" lede="This franchisee could not be shown." />
        <div role="alert" className="py-6">
          <p className="text-[15px] font-semibold text-[var(--ink)]">{read.error}</p>
          <p className="mt-3">
            <Link href="/portal/franchisees" className="text-[14px] font-semibold text-[var(--navy)] underline">Back to every franchisee</Link>
          </p>
        </div>
      </>
    );
  }
  const { franchisee: f, people, territoryOptions, personOptions } = read.detail;
  const ended = f.status === "ended";
  return (
    <>
      <PageHead
        eyebrow="Franchisee"
        title={f.legalName}
        lede={`${FRANCHISEE_STATUS_LABEL[f.status]}. Added ${when(f.createdAt)}.${f.endedReason ? ` Ended because ${f.endedReason}.` : ""}`}
      />
      <p className="mb-4">
        <Link href="/portal/franchisees" className="text-[14px] font-semibold text-[var(--navy)] underline print:hidden">Back to every franchisee</Link>
      </p>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="flex flex-col gap-4">
          <Panel title="Territories it holds" description="Sales territories from the territories screen. A territory is held by one franchisee at a time.">
            <TerritoryControls id={f.id} held={f.territories} options={territoryOptions} ended={ended} />
          </Panel>
          <Panel title="Its people" description="Technicians and reps, by their portal accounts. A person belongs to one franchisee at a time.">
            <MemberControls id={f.id} people={people} options={personOptions} ended={ended} />
          </Panel>
        </div>
        <div className="flex flex-col gap-4">
          <Panel title="Office" description="Its own name, address and phone, kept whole or not at all.">
            {f.office.phone ? (
              <p className="mb-3 text-[14px]">
                Dial <PhoneLink phone={f.office.phone} />
              </p>
            ) : null}
            <OfficeForm id={f.id} office={f.office} />
          </Panel>
          <Panel title="Status" description="Onboarding, operating, or ended with a reason. An ended record is kept as it is.">
            <StatusForm id={f.id} status={f.status} />
          </Panel>
        </div>
      </div>
    </>
  );
}
