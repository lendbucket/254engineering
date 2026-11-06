import Link from "next/link";
import { regions } from "@/content/regions";
import type { Actor } from "@/lib/ops-authz";
import { companiesFor, savedViewsFor, type SavedView } from "@/lib/crm-pipeline";
import { ACTIVITY_WINDOWS, SCORE_BANDS, crmListSpec, type CrmListRow } from "@/lib/crm-board-rules";
import { CRM_SOURCES, CRM_STAGES, CRM_VERTICALS, SOURCE_LABEL, STAGE_LABEL, VERTICAL_LABEL } from "@/lib/crm-rules";
import { staffListQuery, staffListRows, type StaffListQuery } from "@/lib/staff-lists";
import { ListControls, listHref } from "@/components/portal/ListControls";
import { Panel } from "@/components/portal/surfaces";
import { SaveViewForm, DeleteViewButton } from "./PipelineClient";

/**
 * WHAT THE BOARD AND THE LIST SHARE. Robert's sales CRM ruling of 2026-11-02,
 * item R4: one read (companiesFor, which keeps what this person may see), one
 * set of filters and sorts (crmListSpec), and the person's own saved views. The
 * board at /portal/crm and the list at /portal/crm/list each submit the filter
 * form to themselves, so a filtered view is an address that can be saved,
 * bookmarked and reloaded.
 */

export type PipelineRead =
  | { ok: true; matching: CrmListRow[]; total: number; query: StaffListQuery }
  | { ok: false; error: string };

export async function readPipeline(actor: Actor, params: Record<string, string | undefined>): Promise<PipelineRead> {
  const read = await companiesFor(actor);
  if (!read.ok) return read;
  const spec = crmListSpec(actor.id, Date.now());
  const query = staffListQuery(params, spec);
  return { ok: true, matching: staffListRows(read.rows, query, spec), total: read.rows.length, query };
}

export function PipelineFilters({ action, params, query }: { action: string; params: Record<string, string | undefined>; query: StaffListQuery }) {
  const f = query.filters;
  return (
    <ListControls
      action={action}
      search={params.q ?? ""}
      searchLabel="Search company, person, phone, email, city, county, owner or tag"
      filters={[
        { name: "stage", label: "Stage", value: f.stage ?? "", options: [{ value: "", label: "Every stage" }, ...CRM_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))] },
        { name: "vertical", label: "Vertical", value: f.vertical ?? "", options: [{ value: "", label: "Every vertical" }, ...CRM_VERTICALS.map((v) => ({ value: v, label: VERTICAL_LABEL[v] }))] },
        { name: "territory", label: "Region", value: f.territory ?? "", options: [{ value: "", label: "Every region" }, ...regions.map((r) => ({ value: r.slug, label: r.name }))] },
        { name: "owner", label: "Owner", value: f.owner ?? "", options: [{ value: "", label: "Anybody you can see" }, { value: "mine", label: "Mine" }, { value: "unowned", label: "Nobody yet" }] },
        { name: "source", label: "Source", value: f.source ?? "", options: [{ value: "", label: "Every source" }, ...CRM_SOURCES.map((s) => ({ value: s, label: SOURCE_LABEL[s] }))] },
        { name: "score", label: "Score", value: f.score ?? "", options: [{ value: "", label: "Any score" }, ...SCORE_BANDS.map((b) => ({ value: b.value, label: b.label }))] },
        { name: "activity", label: "Last activity", value: f.activity ?? "", options: [{ value: "", label: "Any time" }, ...ACTIVITY_WINDOWS.map((w) => ({ value: w.value, label: w.label }))] },
      ]}
      sorts={[
        { value: "next", label: "Next action due" },
        { value: "score", label: "Score" },
        { value: "company", label: "Company" },
        { value: "activity", label: "Last activity" },
        { value: "added", label: "Date added" },
      ]}
      sort={query.sort}
      direction={query.ascending ? "asc" : "desc"}
    />
  );
}

/** The two views, as links that keep the current filters. */
export function ViewSwitch({ current, params }: { current: "board" | "list"; params: Record<string, string | undefined> }) {
  const keep = { ...params, page: undefined };
  /* V10, operator ruling 4 of 2026-10-08: the active item is the gold marker only, no fill and no corner, as the portal's own nav. */
  const link = "inline-flex min-h-[44px] items-center border-b-[3px] px-3 text-[14px] font-semibold";
  const on = "border-b-[var(--gold)] text-[var(--ink)]";
  const off = "border-b-transparent text-[var(--navy)] underline";
  return (
    <nav aria-label="Pipeline views" className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
      <Link href={listHref("/portal/crm", keep, {})} aria-current={current === "board" ? "page" : undefined} className={`${link} ${current === "board" ? on : off}`}>
        Stage board
      </Link>
      <Link href={listHref("/portal/crm/list", keep, {})} aria-current={current === "list" ? "page" : undefined} className={`${link} ${current === "list" ? on : off}`}>
        List
      </Link>
      <Link href="/portal/crm/queue" className={`${link} ${off}`}>
        Call queue
      </Link>
    </nav>
  );
}

function viewHref(v: SavedView): string {
  return listHref(v.view === "board" ? "/portal/crm" : "/portal/crm/list", v.query, {});
}

/** The person's saved views, and saving the one on the screen. A failed read says so. */
export async function SavedViews({ actor, current, params }: { actor: Actor; current: "board" | "list"; params: Record<string, string | undefined> }) {
  const views = await savedViewsFor(actor);
  return (
    <Panel className="mt-8 print:hidden" title="Your saved views" description="Only you see these. A view keeps the search, filters and sort, never the page.">
      {!views.ok ? (
        <p role="alert" className="text-[14px] text-[var(--ink)]">{views.error} This is a failed read, not an empty list.</p>
      ) : views.rows.length === 0 ? (
        <p className="text-[14px] text-[var(--ink)]">None yet. Set the filters above, then name and save the view here.</p>
      ) : (
        <ul className="grid gap-2">
          {views.rows.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-x-4 border-b border-[var(--row-rule)] pb-2 text-[14px]">
              <Link href={viewHref(v)} className="inline-flex min-h-[44px] items-center font-semibold text-[var(--navy)] underline">
                {v.name}
              </Link>
              <span className="text-[var(--secondary)]">{v.view === "board" ? "Stage board" : "List"}</span>
              <DeleteViewButton id={v.id} name={v.name} />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4">
        <SaveViewForm view={current} params={params} />
      </div>
    </Panel>
  );
}
