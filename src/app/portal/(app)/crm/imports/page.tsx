import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { CRM_SOURCE_DECLS, sourceDecl, sourceRefusal } from "@/config/crm-sources";
import { SOURCE_LABEL, VERTICAL_LABEL, type CrmVertical } from "@/lib/crm-rules";
import { HELD_KEEP, type Verdict } from "@/lib/crm-import-plan";
import { PLACES_LOOKUP_CLOSED, VERDICT_LABEL, getRun, latestRunBySource, listRuns, runRows, type RunRow, type RunSummary } from "@/lib/crm-imports";
import { telLink } from "@/lib/phone-link";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { DataTable, type Column } from "@/components/portal/design";
import { EmptyState, ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { ListControls, Pager, listHref } from "@/components/portal/ListControls";
import { BoughtListForm, ConflictChoice, DismissButton, HeldPhoneForm, PreviewButton, WriteButton } from "./ImportsClient";

export const dynamic = "force-dynamic";

/**
 * THE SALES LIST'S IMPORTS. crm.import (admin and ops_manager), Robert's sales
 * CRM ruling of 2026-11-02, item R2.
 *
 * The sources and why each runs or waits; a bought list through the same
 * dedupe; every run, newest first. Opening a run (?run=) shows its verdicts by
 * kind: new companies, already on the list, need a choice, held with no phone,
 * not imported. A person presses Write; a scheduled run only previews.
 */

const STATUS_LABEL: Record<RunSummary["status"], string> = {
  previewing: "Reading",
  previewed: "Previewed, not written",
  written: "Written",
  failed: "Failed",
  refused: "Refused",
};

const VERDICTS: Verdict[] = ["add", "merge", "conflict", "held", "skip"];

function sourceName(key: string): string {
  return SOURCE_LABEL[key as keyof typeof SOURCE_LABEL] ?? key;
}

export default async function ImportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  if (!actor || !can(actor, "crm.import")) notFound();
  const params = await searchParams;
  if (params.run) return <RunView runId={params.run} params={params} />;

  const latest = await latestRunBySource(actor);
  const runs = await listRuns(actor, {
    page: Number(params.page) || 1,
    pageSize: 25,
    source: params.source ?? "all",
    status: params.status ?? "all",
    direction: params.dir === "asc" ? "asc" : "desc",
    search: params.q,
  });

  type SourceRow = (typeof CRM_SOURCE_DECLS)[number] & { id: string };
  const sourceRows: SourceRow[] = CRM_SOURCE_DECLS.map((d) => ({ ...d, id: d.key }));
  const sourceColumns: Column<SourceRow>[] = [
    { key: "source", header: "Source", cell: (d) => <a href={d.datasetUrl} className="font-semibold text-[var(--navy)] underline" rel="noreferrer" target="_blank">{d.label}</a> },
    { key: "state", header: "State", cell: (d) => (sourceRefusal(d) ? (d.state === "skip" ? "Skipped" : "On hold") : "Ready") },
    { key: "terms", header: "Terms read", cell: (d) => (d.termsReadOn ? (d.termsUrl ? <a href={d.termsUrl} className="text-[var(--navy)] underline" rel="noreferrer" target="_blank">{d.termsReadOn}</a> : d.termsReadOn) : "Not read") },
    { key: "why", header: "Why", cell: (d) => <span className="text-[14px] leading-[1.5]">{d.why}</span>, desktopOnly: true },
    {
      key: "last",
      header: "Last run",
      cell: (d) => {
        const run = latest.ok ? latest.runs.get(d.key) : undefined;
        if (!latest.ok) return "Could not be read";
        if (!run) return "Never";
        return <Link href={`/portal/crm/imports?run=${run.id}`} className="text-[var(--navy)] underline">{formatInFirmZone(run.createdAt)}, {STATUS_LABEL[run.status].toLowerCase()}</Link>;
      },
    },
    { key: "act", header: "Preview", cell: (d) => (sourceRefusal(d) ? <span className="text-[14px] text-[var(--secondary)]">Does not run</span> : <PreviewButton source={d.key} label={d.label} />) },
  ];

  const runColumns: Column<RunSummary>[] = [
    { key: "when", header: "Started", cell: (r) => <Link href={`/portal/crm/imports?run=${r.id}`} className="font-semibold text-[var(--navy)] underline">{formatInFirmZone(r.createdAt)}</Link> },
    { key: "source", header: "Source", cell: (r) => (r.source === "csv" && r.fileName ? `${sourceName(r.source)}: ${r.fileName}` : sourceName(r.source)) },
    { key: "status", header: "Status", cell: (r) => STATUS_LABEL[r.status] },
    { key: "by", header: "Started by", cell: (r) => (r.trigger === "schedule" ? "The daily schedule" : r.requestedBy ?? "A person"), desktopOnly: true },
    { key: "adds", header: "New", numeric: true, cell: (r) => r.adds.toLocaleString("en-US") },
    { key: "merges", header: "On the list", numeric: true, cell: (r) => r.merges.toLocaleString("en-US") },
    { key: "conflicts", header: "Choice", numeric: true, cell: (r) => r.conflicts.toLocaleString("en-US") },
    { key: "held", header: "Held", numeric: true, cell: (r) => r.held.toLocaleString("en-US") },
  ];

  return (
    <>
      <PageHead
        eyebrow="Sales"
        title="Imports"
        lede="Companies from public license and permit files, and lists the firm buys, checked against the sales list before anything is written. The daily schedule only previews; a person presses Write."
      />

      <Panel title="Sources" description="A source runs only when its terms were read on a recorded date and allow storing what it gives.">
        {!latest.ok ? <ErrorState title="The last runs could not be read" body={`${latest.error} This is a failed read, not an empty list.`} /> : null}
        <DataTable caption="Import sources" rows={sourceRows} total={sourceRows.length} columns={sourceColumns} empty={<EmptyState title="No sources are declared" body="The sources live in src/config/crm-sources.ts." />} />
      </Panel>

      <div className="portal-sections mt-8 grid gap-8">
        <Panel title="A bought list" description="Checked against the list first: nothing is written until you press Write on the preview.">
          <BoughtListForm />
        </Panel>

        <Panel title="Runs" description="Every preview, scheduled or by a person, and what was written.">
          <ListControls
            action="/portal/crm/imports"
            search={params.q ?? ""}
            searchLabel="Search bought lists by file name"
            filters={[
              { name: "source", label: "Source", value: params.source ?? "all", options: [{ value: "all", label: "Every source" }, ...CRM_SOURCE_DECLS.map((d) => ({ value: d.key, label: d.label })), { value: "csv", label: "Bought lists" }] },
              { name: "status", label: "Status", value: params.status ?? "all", options: [{ value: "all", label: "Any status" }, ...(Object.keys(STATUS_LABEL) as RunSummary["status"][]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))] },
            ]}
            sorts={[{ value: "created", label: "Date started" }]}
            sort="created"
            direction={params.dir === "asc" ? "asc" : "desc"}
          />
          {!runs.ok ? (
            <ErrorState title="The runs could not be read" body={`${runs.error} This is a failed read, not an empty list.`} />
          ) : (
            <>
              <DataTable
                caption="Import runs"
                rows={runs.rows}
                total={runs.total}
                columns={runColumns}
                empty={<EmptyState title={params.source || params.status || params.q ? "No run matches that filter" : "Nothing has been imported yet"} body={params.source || params.status || params.q ? "Clear the filter to see every run." : "Press Preview now on a ready source, or check a bought list above. Nothing is written until you press Write."} />}
              />
              <Pager page={runs.page} pageSize={runs.pageSize} total={runs.total} hrefFor={(page) => listHref("/portal/crm/imports", params, { page: String(page) })} />
            </>
          )}
        </Panel>
      </div>
    </>
  );
}

async function RunView({ runId, params }: { runId: string; params: Record<string, string | undefined> }) {
  const actor = await currentActor();
  const read = await getRun(actor, runId);
  if (!read.ok) {
    return (
      <>
        <PageHead eyebrow="Sales" title="Import" lede="" />
        <ErrorState title="This import could not be read" body={`${read.error} This is a failed read, not an empty import.`} />
      </>
    );
  }
  if (!read.run) notFound();
  const run = read.run;
  const verdict = (VERDICTS as string[]).includes(params.verdict ?? "") ? (params.verdict as Verdict) : run.conflicts ? "conflict" : "add";
  const rows = await runRows(actor, runId, { verdict, page: Number(params.page) || 1, pageSize: 100, search: params.q, sort: params.sort === "company" ? "company" : "line" });
  const decl = sourceDecl(run.source);
  const title = run.source === "csv" ? `Bought list${run.fileName ? `: ${run.fileName}` : ""}` : decl?.label ?? sourceName(run.source);
  const countOf: Record<Verdict, number> = { add: run.adds, merge: run.merges, conflict: run.conflicts, held: run.held, skip: run.skipped };

  const columns: Column<RunRow>[] = [
    { key: "line", header: "Line", numeric: true, cell: (r) => r.line },
    { key: "company", header: "Company", cell: (r) => <span className="font-semibold text-[var(--ink)]">{"company" in r.payload ? r.payload.company : "No name"}</span> },
    {
      key: "phone",
      header: "Phone",
      cell: (r) => {
        const phone = "phone" in r.payload ? r.payload.phone : null;
        const href = telLink(phone);
        return href ? <a href={href} className="font-semibold text-[var(--navy)] underline">{phone}</a> : phone ?? "None";
      },
    },
    { key: "county", header: "County", cell: (r) => ("county" in r.payload ? r.payload.county ?? "" : ""), desktopOnly: true },
    { key: "vertical", header: "Vertical", cell: (r) => ("vertical" in r.payload && r.payload.vertical ? VERTICAL_LABEL[r.payload.vertical as CrmVertical] : ""), desktopOnly: true },
    { key: "permits", header: "Permits", numeric: true, cell: (r) => ("permitCount" in r.payload && r.payload.permitCount ? `${r.payload.permitCount}${r.payload.lastPermitOn ? `, last ${r.payload.lastPermitOn}` : ""}` : ""), desktopOnly: true },
    { key: "why", header: "Why", cell: (r) => r.reason ?? (r.verdict === "add" ? "New to the list." : "") },
    {
      key: "act",
      header: "Settle",
      cell: (r) => {
        if (r.resolution) return `Settled: ${r.resolution}`;
        if (r.verdict === "held" && (run.status === "previewed" || run.status === "written")) return <HeldPhoneForm rowId={r.id} company={"company" in r.payload ? r.payload.company : "this company"} />;
        if (r.verdict === "conflict" && (run.status === "previewed" || run.status === "written")) return <ConflictChoice rowId={r.id} candidates={r.candidates} />;
        if (r.verdict === "merge" && r.candidates[0]) return `Joins ${r.candidates[0].company}`;
        return r.verdict === "conflict" || r.verdict === "held" ? <DismissButton rowId={r.id} /> : "";
      },
    },
  ];

  return (
    <>
      <PageHead
        eyebrow="Sales imports"
        title={title}
        lede={`${STATUS_LABEL[run.status]}. Started ${formatInFirmZone(run.createdAt)} by ${run.trigger === "schedule" ? "the daily schedule" : run.requestedBy ?? "a person"}${run.writtenAt ? `; written ${formatInFirmZone(run.writtenAt)} by ${run.writtenBy ?? "a person"}` : ""}. ${run.rowsRead.toLocaleString("en-US")} rows read, ${run.records.toLocaleString("en-US")} kept by the filter.${run.termsReadOn ? ` Run under the terms read ${run.termsReadOn}.` : ""}`}
      />
      <p className="mb-4"><Link href="/portal/crm/imports" className="text-[14px] font-semibold text-[var(--navy)] underline">Back to imports</Link></p>

      {run.status === "failed" || run.status === "refused" ? (
        <ErrorState title={run.status === "failed" ? "This import did not finish" : "This source did not run"} body={run.error ?? "No reason was recorded."} />
      ) : null}

      {run.status === "previewed" ? (
        <Panel title="Write this import" description="A person presses Write. Conflicts and held companies wait here for a choice either way.">
          <WriteButton runId={run.id} adds={run.adds} merges={run.merges} waiting={run.conflicts} />
        </Panel>
      ) : null}

      <nav aria-label="Verdicts" className="mt-6 mb-3 flex flex-wrap gap-2">
        {VERDICTS.map((v) => (
          <Link
            key={v}
            href={listHref("/portal/crm/imports", { run: run.id }, { verdict: v })}
            aria-current={v === verdict ? "page" : undefined}
            className={`inline-flex min-h-[44px] items-center rounded-[2px] border px-3 text-[14px] font-semibold ${v === verdict ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[var(--border)] text-[var(--navy)]"}`}
          >
            {VERDICT_LABEL[v]}: {countOf[v].toLocaleString("en-US")}
          </Link>
        ))}
      </nav>

      <form method="get" action="/portal/crm/imports" className="mb-4 flex flex-wrap items-end gap-3" role="search">
        <input type="hidden" name="run" value={run.id} />
        <input type="hidden" name="verdict" value={verdict} />
        <div className="min-w-[240px] flex-[2]">
          <label htmlFor="run-q" className="block text-[13px] font-semibold text-[var(--ink)]">Search by company</label>
          <input id="run-q" name="q" defaultValue={params.q ?? ""} className="mt-1 min-h-[44px] w-full rounded-[2px] border border-[var(--border)] px-3 text-[15px]" />
        </div>
        <div className="min-w-[170px]">
          <label htmlFor="run-sort" className="block text-[13px] font-semibold text-[var(--ink)]">Sort by</label>
          <select id="run-sort" name="sort" defaultValue={params.sort === "company" ? "company" : "line"} className="mt-1 min-h-[44px] w-full rounded-[2px] border border-[var(--border)] px-3 text-[15px]">
            <option value="line">Order in the source</option>
            <option value="company">Company</option>
          </select>
        </div>
        <button type="submit" className="inline-flex min-h-[44px] items-center rounded-[2px] bg-[var(--navy)] px-4 text-[14px] font-bold text-white">Show</button>
      </form>

      {verdict === "held" ? (
        <p className="mb-3 max-w-[75ch] text-[14px] leading-[1.55] text-[var(--secondary)]">
          {run.held > run.heldKept
            ? `The first ${run.heldKept.toLocaleString("en-US")} of ${run.held.toLocaleString("en-US")} held companies are kept here; the rest are read again on the next run of this source. `
            : ""}
          {PLACES_LOOKUP_CLOSED}
        </p>
      ) : null}

      {!rows.ok ? (
        <ErrorState title="This import's rows could not be read" body={`${rows.error} This is a failed read, not an empty list.`} />
      ) : (
        <>
          <DataTable
            caption={`${VERDICT_LABEL[verdict]} in this import`}
            rows={rows.rows}
            total={rows.total}
            columns={columns}
            empty={<EmptyState title={params.q ? "No company matches that search" : `No rows here`} body={params.q ? "Clear the search to see every row of this kind." : `This import has no rows of this kind. ${verdict === "held" && run.held > HELD_KEEP ? "" : "Choose another kind above."}`} />}
          />
          <Pager page={rows.page} pageSize={rows.pageSize} total={rows.total} hrefFor={(page) => listHref("/portal/crm/imports", { run: run.id, verdict, q: params.q, sort: params.sort }, { page: String(page) })} />
        </>
      )}
    </>
  );
}
