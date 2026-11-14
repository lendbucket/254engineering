import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { boardColumns } from "@/lib/crm-board-rules";
import { STAGE_LABEL, VERTICAL_LABEL } from "@/lib/crm-rules";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { listHref } from "@/components/portal/ListControls";
import { LIST_EXPORT_GRANT } from "@/lib/list-exports";
import { EmptyState, ErrorState, PageHead } from "@/components/portal/surfaces";
import { Board, type BoardColumnView } from "./PipelineClient";
import { PipelineFilters, SavedViews, ViewSwitch, readPipeline } from "./pipeline-shared";

export const dynamic = "force-dynamic";

/**
 * THE STAGE BOARD. crm.use, Robert's sales CRM ruling of 2026-11-02, item R4.
 *
 * A column per stage, each with its whole count and its first fifty cards
 * (the rest are one link away in the list). Drag a card to another column, or
 * use its "Move to" select, and the move is written to the company's history
 * as a stage change. The two customer stages take no drop: a company reaches
 * them by converting and by its first order.
 */
export default async function PipelinePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  if (!actor || !can(actor, "crm.use")) notFound();
  const params = await searchParams;
  const read = await readPipeline(actor, params);

  const lede = can(actor, "crm.assign")
    ? "Every company on the sales list, by stage. Drag a card or use its Move to select."
    : "Your companies and the ones nobody owns yet, by stage. Drag a card or use its Move to select.";

  if (!read.ok) {
    return (
      <>
        <PageHead eyebrow="Sales" title="Pipeline" lede={lede} />
        <ViewSwitch current="board" params={params} />
        <ErrorState title="The pipeline could not be read" body={`${read.error} This is a failed read, not an empty list.`} />
      </>
    );
  }

  const columns: BoardColumnView[] = boardColumns(read.matching).map((c) => ({
    stage: c.stage,
    label: STAGE_LABEL[c.stage],
    count: c.count,
    more: c.more,
    acceptsDrop: c.acceptsDrop,
    cards: c.rows.map((r) => ({
      id: r.id,
      company: r.company,
      verticalLabel: VERTICAL_LABEL[r.vertical],
      score: r.score,
      ownerName: r.ownerName,
      nextAction: r.nextActionAt ? formatInFirmZone(r.nextActionAt) : null,
    })),
  }));

  return (
    <>
      <PageHead eyebrow="Sales" title="Pipeline" lede={`${lede} ${read.matching.length.toLocaleString("en-US")} of ${read.total.toLocaleString("en-US")} companies match.`} />
      <ViewSwitch current="board" params={params} />
      <PipelineFilters
        action="/portal/crm"
        params={params}
        query={read.query}
        csvHref={can(actor, LIST_EXPORT_GRANT) ? listHref("/api/portal/exports", { ...params, page: undefined }, { report: "sales-list" }) : undefined}
      />
      {read.total === 0 ? (
        <EmptyState title="The sales list is empty" body="Companies arrive from Imports, from the sales list's spreadsheet import, or one at a time on the sales list. They appear here at New." />
      ) : read.matching.length === 0 ? (
        <EmptyState title="Nothing matches that filter" body="Clear the filter to see every company you can see." />
      ) : (
        <Board columns={columns} listHref={listHref("/portal/crm/list", { ...params, stage: undefined }, {})} />
      )}
      <SavedViews actor={actor} current="board" params={params} />
    </>
  );
}
