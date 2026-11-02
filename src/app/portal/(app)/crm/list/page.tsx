import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { assignablePeople } from "@/lib/crm-pipeline";
import { type CrmListRow } from "@/lib/crm-board-rules";
import { STAGE_LABEL, VERTICAL_LABEL, territoryFor } from "@/lib/crm-rules";
import { staffListPage, STAFF_LIST_PAGE_SIZE } from "@/lib/staff-lists";
import { telLink } from "@/lib/phone-link";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { DataTable, type Column } from "@/components/portal/design";
import { Pager, listHref } from "@/components/portal/ListControls";
import { EmptyState, ErrorState, PageHead } from "@/components/portal/surfaces";
import { BulkBar, PickRow } from "../PipelineClient";
import { PipelineFilters, SavedViews, ViewSwitch, readPipeline } from "../pipeline-shared";

export const dynamic = "force-dynamic";

/**
 * THE SALES LIST AS A LIST. crm.use, Robert's sales CRM ruling of 2026-11-02,
 * item R4: search, filters (vertical, region, owner, source, stage, score,
 * last activity), sort, fifty to a page with the whole count, saved views, and
 * bulk tag; bulk assign for a sales manager (crm.assign).
 */
export default async function PipelineListPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  if (!actor || !can(actor, "crm.use")) notFound();
  const params = await searchParams;
  const read = await readPipeline(actor, params);
  const canAssign = can(actor, "crm.assign");
  const people = canAssign ? await assignablePeople(actor) : { ok: true as const, rows: [] };

  const lede = canAssign
    ? "Every company on the sales list. Tick companies to tag them or assign them to a rep."
    : "Your companies and the ones nobody owns yet. Tick companies to tag them.";

  if (!read.ok) {
    return (
      <>
        <PageHead eyebrow="Sales" title="Sales list" lede={lede} />
        <ViewSwitch current="list" params={params} />
        <ErrorState title="The sales list could not be read" body={`${read.error} This is a failed read, not an empty list.`} />
      </>
    );
  }

  const page = staffListPage(read.matching, read.query.page);
  const columns: Column<CrmListRow>[] = [
    /* The company first, because on a phone the first column is the card's heading; its tick box sits beside it. */
    {
      key: "company",
      header: "Company",
      cell: (r) => (
        <span className="inline-flex min-h-[44px] items-center gap-3">
          <PickRow id={r.id} company={r.company} />
          <Link href={`/portal/crm/${r.id}`} className="font-semibold text-[var(--navy)] underline">{r.company}</Link>
        </span>
      ),
    },
    { key: "stage", header: "Stage", cell: (r) => STAGE_LABEL[r.stage] },
    { key: "vertical", header: "Vertical", cell: (r) => VERTICAL_LABEL[r.vertical] },
    { key: "score", header: "Score", cell: (r) => String(r.score) },
    {
      key: "phone",
      header: "Phone",
      cell: (r) => {
        const href = telLink(r.phone);
        return href ? <a href={href} className="font-semibold text-[var(--navy)] underline">{r.phone}</a> : r.phone ?? "";
      },
    },
    { key: "region", header: "Region", cell: (r) => (r.county ? `${territoryFor(r.county)?.regionName ?? ""}, ${r.county} County` : ""), desktopOnly: true },
    { key: "owner", header: "Owner", cell: (r) => r.ownerName ?? "Nobody yet", desktopOnly: true },
    { key: "next", header: "Next action", cell: (r) => (r.nextActionAt ? formatInFirmZone(r.nextActionAt) : "Not scheduled"), desktopOnly: true },
    { key: "last", header: "Last activity", cell: (r) => (r.lastActivityAt ? formatInFirmZone(r.lastActivityAt) : "Never"), desktopOnly: true },
    { key: "tags", header: "Tags", cell: (r) => r.tags.join(", "), desktopOnly: true },
  ];

  return (
    <>
      <PageHead eyebrow="Sales" title="Sales list" lede={lede} />
      <ViewSwitch current="list" params={params} />
      <PipelineFilters action="/portal/crm/list" params={params} query={read.query} />
      {!people.ok ? <ErrorState title="Who can be assigned could not be read" body={`${people.error} Assigning is unavailable until it can be read.`} /> : null}
      {read.total === 0 ? (
        <EmptyState title="The sales list is empty" body="Companies arrive from Imports, from the sales list's spreadsheet import, or one at a time on the sales list." />
      ) : read.matching.length === 0 ? (
        <EmptyState title="Nothing matches that filter" body="Clear the filter to see every company you can see." />
      ) : (
        <>
          <BulkBar canAssign={canAssign && people.ok} people={people.ok ? people.rows : []} />
          <DataTable caption="Sales list" rows={page.rows} total={page.total} columns={columns} empty={<EmptyState title="Nothing on this page" body="Go back a page." />} />
          <Pager page={page.page} pageSize={STAFF_LIST_PAGE_SIZE} total={page.total} hrefFor={(n) => listHref("/portal/crm/list", params, { page: String(n) })} />
        </>
      )}
      <SavedViews actor={actor} current="list" params={params} />
    </>
  );
}
