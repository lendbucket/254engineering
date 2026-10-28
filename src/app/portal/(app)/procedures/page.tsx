import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { procedureText, proceduresFor } from "@/lib/procedures";
import type { Procedure, ProcedureStep } from "@/content/procedures";
import { DataTable, type Column } from "@/components/portal/design";
import { EmptyState, ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { ListControls, Pager, listHref } from "@/components/portal/ListControls";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * PROCEDURES. W4 of Robert's instruction of 2026-10-26: each role gets a
 * Procedures page that renders its workflows from docs/workflows.md as numbered
 * written procedures, so a new hire is trained from the screen. Each takes the
 * number of the workflow it comes from, in the 254-OPS series.
 *
 * Nothing on this page is written here. Every word comes from the workflow map
 * through src/content/procedures.ts, which scripts/emit-procedures.mjs
 * generates and a proof holds to the map, so the screen and the document
 * cannot say two things. A step the map marks as needing SQL, a script or a
 * code edit, or as having no screen, shows that mark in plain words, so a new
 * hire is never told to do something no screen allows.
 *
 * tasks.use is the guard, and the nav item asks the same: every role but
 * read_only holds it, and read_only has no workflow (src/lib/procedures.ts).
 */
export default async function ProceduresPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  if (!actor || !can(actor, "tasks.use")) notFound();
  const params = await searchParams;
  const mine = proceduresFor(actor.role);

  if (params.id) {
    const procedure = mine.find((p) => p.number === params.id);
    return <ProcedureDetail procedure={procedure} back={listHref("/portal/procedures", { ...params, id: undefined }, {})} />;
  }

  const sections = [...new Set(mine.map((p) => p.section))];
  const section = params.section && sections.includes(params.section) ? params.section : "all";
  const q = (params.q ?? "").trim().toLowerCase();
  const sort = params.sort === "title" ? "title" : "number";
  const dir = params.dir === "desc" ? "desc" : "asc";
  const rows = mine
    .filter((p) => section === "all" || p.section === section)
    .filter((p) => q === "" || procedureText(p).includes(q))
    .sort((a, b) => (sort === "title" ? a.title.localeCompare(b.title) : a.number.localeCompare(b.number)) * (dir === "asc" ? 1 : -1));
  const page = Math.max(1, Number(params.page) || 1);
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((p) => ({ ...p, id: p.number }));

  const columns: Column<Procedure & { id: string }>[] = [
    {
      key: "number",
      header: "Procedure",
      cell: (p) => (
        <Link href={listHref("/portal/procedures", params, { id: p.number })} className="font-semibold text-[var(--navy)] underline">
          {p.number}
        </Link>
      ),
    },
    { key: "title", header: "What it covers", cell: (p) => p.title },
    { key: "section", header: "Written for", cell: (p) => p.section },
    { key: "steps", header: "Steps", numeric: true, cell: (p) => String(p.steps.length) },
  ];

  return (
    <>
      <PageHead
        eyebrow="Training"
        title="Procedures"
        lede="The firm's written procedures for your role, numbered 254-OPS. Each one is a workflow from the firm's workflow map: who acts at each step, on which screen, and what happens next."
      />
      <ListControls
        action="/portal/procedures"
        search={params.q ?? ""}
        searchLabel="Search procedure number, title, screen or step"
        filters={
          sections.length > 1
            ? [
                {
                  name: "section",
                  label: "Written for",
                  value: section,
                  options: [{ value: "all", label: "Every role" }, ...sections.map((s) => ({ value: s, label: s }))],
                },
              ]
            : []
        }
        sorts={[
          { value: "number", label: "Procedure number" },
          { value: "title", label: "Title" },
        ]}
        sort={sort}
        direction={dir}
      />
      <DataTable
        caption="Procedures"
        rows={shown}
        total={rows.length}
        columns={columns}
        empty={
          mine.length === 0 ? (
            <EmptyState
              title="No procedures are written for your role yet"
              body="Procedures come from the firm's workflow map, one section per role. Ask the administrator which procedures to follow until your role has its own."
            />
          ) : (
            <EmptyState title="Nothing matches" body="Clear the search or choose every role to see all of your procedures again." />
          )
        }
      />
      <Pager page={page} pageSize={PAGE_SIZE} total={rows.length} hrefFor={(n) => listHref("/portal/procedures", params, { page: String(n) })} />
    </>
  );
}

function ProcedureDetail({ procedure, back }: { procedure: Procedure | undefined; back: string }) {
  const backLink = (
    <p className="mb-4 text-[14px] print:hidden">
      <Link href={back} className="font-semibold text-[var(--navy)] underline">Back to procedures</Link>
    </p>
  );
  if (!procedure) {
    return (
      <>
        <PageHead eyebrow="Procedures" title="Procedure" />
        {backLink}
        <ErrorState
          title="This procedure could not be opened"
          body="It is not one written for your role, or its number has changed. Go back to the list and open it from there."
        />
      </>
    );
  }
  return (
    <>
      <PageHead eyebrow={`Procedures, written for ${procedure.section}`} title={`${procedure.number} ${procedure.title}`} lede={`From workflow ${procedure.workflow} in the firm's workflow map.`} />
      {backLink}
      <Panel title="Steps">
        <ol className="space-y-6">
          {procedure.steps.map((step) => (
            <StepItem key={step.n} step={step} />
          ))}
        </ol>
      </Panel>
      {procedure.notes.length > 0 ? (
        <Panel title="Notes" className="mt-8">
          {procedure.notes.map((note, i) => (
            <p key={i} className="mt-2 max-w-[70ch] text-[14px] leading-[1.6] text-[var(--ink)]">
              <Inline text={note} />
            </p>
          ))}
        </Panel>
      ) : null}
    </>
  );
}

function StepItem({ step }: { step: ProcedureStep }) {
  const rows: [string, ReactNode][] = [
    ["Who acts", <Inline key="who" text={step.who} />],
    ["Screen", step.routes.length > 0 ? <ScreenLinks key="screen" step={step} /> : <Inline key="screen" text={step.screen} />],
    ["What they see", <Inline key="sees" text={step.sees} />],
    ["What they do", <Inline key="does" text={step.does} />],
    ["What happens next", step.next ? <Inline key="next" text={step.next} /> : "The map records nothing further at this step."],
    ["Who is told", step.told ? <Inline key="told" text={step.told} /> : "Nobody."],
    ["What is recorded", step.record ? <Inline key="record" text={step.record} /> : "Nothing."],
  ];
  return (
    <li className="break-inside-avoid">
      <p className="text-[15px] font-semibold text-[var(--ink)]">Step {step.n}</p>
      {step.marks ? (
        <p className="mt-1 max-w-[70ch] text-[14px] leading-[1.6] font-semibold text-[var(--ink)]">
          <Inline text={step.marks} />
        </p>
      ) : null}
      <dl className="mt-2 divide-y divide-[var(--border)]">
        {rows
          .filter(([, v]) => v !== "")
          .map(([k, v]) => (
            <div key={k} className="grid gap-1 py-2 sm:grid-cols-[170px_1fr] sm:gap-3">
              <dt className="text-[14px] font-semibold text-[var(--ink)]">{k}</dt>
              <dd className="min-w-0 text-[14px] leading-[1.55] break-words text-[var(--secondary)]">{v}</dd>
            </div>
          ))}
      </dl>
    </li>
  );
}

function ScreenLinks({ step }: { step: ProcedureStep }) {
  return (
    <>
      {step.routes.map((route, i) => (
        <span key={route}>
          {i > 0 ? ", " : null}
          <Link href={route} className="font-semibold text-[var(--navy)] underline">
            {route}
          </Link>
        </span>
      ))}
      <span className="block">
        <Inline text={step.screen} />
      </span>
    </>
  );
}

/** The map's inline marks: `code` and **bold**, nothing else. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter((s) => s !== "");
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("`") ? (
          <code key={i} className="text-[13px] break-all">{part.slice(1, -1)}</code>
        ) : part.startsWith("**") ? (
          <strong key={i} className="font-semibold text-[var(--ink)]">{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
