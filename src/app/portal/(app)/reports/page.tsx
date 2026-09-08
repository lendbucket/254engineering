import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { PageHead, Panel, EmptyState } from "@/components/portal/surfaces";
import { SystemAlert } from "@/components/portal/design";
import { REPORTS, formatFigure, periodOf, type Figure } from "@/lib/ops-reports";

export const dynamic = "force-dynamic";

/**
 * The owner reports.
 *
 * A REPORT IS A PERMISSION, AND THE SCREEN ASKS THE SAME GRANT THE MIGRATION
 * SEEDED.
 *
 * Each report is behind its own action, so an owner can give somebody the
 * pipeline without giving them revenue. A role whose grants name none of them
 * gets a 404 rather than an empty page: a screen that renders its chrome and
 * nothing else is an invitation to ask why, and the answer would be that they
 * are not allowed, which the page should not be saying out loud.
 *
 * EVERY FIGURE LINKS TO ITS ROWS.
 *
 * A total nobody can expand is a number somebody has to trust. The brief calls
 * an unexpandable total the defect class, and it is: the arithmetic here is
 * simple enough that the only way it goes wrong is by counting the wrong set,
 * which is exactly what looking at the set would show.
 */

function FigureCell({ figure }: { figure: Figure }) {
  const absent = figure.value === null;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4">
      <p className="portal-kicker text-[var(--secondary)]">{figure.label}</p>

      {/*
        Three states and no fourth. A number, the word none for a real zero, or
        "not computed" when the query could not run. The absent one is styled
        differently on purpose: it must never be mistaken for a figure.
      */}
      <p
        className={`mt-1 font-display text-[26px] leading-none font-bold ${
          absent ? "text-[var(--muted)] italic" : "text-[var(--navy)]"
        }`}
      >
        {formatFigure(figure)}
      </p>

      <p className="mt-2 text-[12px] leading-[1.45] text-[var(--secondary)]">{figure.note}</p>

      {figure.rows ? (
        <Link
          href={figure.rows}
          className="mt-2 inline-flex min-h-[var(--tap-target)] items-center text-[12.5px] font-semibold text-[var(--navy)] underline"
        >
          See the rows
        </Link>
      ) : null}
    </div>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const actor = await currentActor();
  const allowed = REPORTS.filter((r) => can(actor, r.action));
  if (allowed.length === 0) notFound();

  const { period: asked } = await searchParams;
  const period = /^\d{4}-\d{2}$/.test(asked ?? "") ? (asked as string) : periodOf();

  const built = await Promise.all(allowed.map((r) => r.build(period)));

  return (
    <>
      <PageHead
        title="Reports"
        lede={`What the firm did in ${period}. Every figure is a number a query produced, the word none because it found nothing, or an absence because it could not run.`}
      />

      {/*
        Said once, at the top, rather than repeated under every figure: nothing
        seeded is counted, and the exclusion happens in the query.
      */}
      <div className="mb-4">
        <SystemAlert condition="Demonstration records are excluded." tone="pending">
          Every figure below counts real records only. Seeded and probe records are excluded by the
          query rather than hidden by the screen, so a total here and the rows behind it agree.
        </SystemAlert>
      </div>

      {built.map((report) => (
        <Panel key={report.key} title={report.title}>
          {report.unavailable.length > 0 ? (
            <div className="mb-4">
              <SystemAlert condition="Part of this report could not be computed." tone="failed">
                {report.unavailable.join(" ")}
              </SystemAlert>
            </div>
          ) : null}

          {report.sections.length === 0 ? (
            <EmptyState
              title="Nothing to report"
              body="No figure on this report could be computed. The reason is above rather than hidden."
            />
          ) : (
            report.sections.map((section) => (
              <div key={section.title} className="mb-5 last:mb-0">
                <p className="portal-kicker mb-2 text-[var(--secondary)]">{section.title}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {section.figures.map((f) => (
                    <FigureCell key={`${section.title}-${f.label}`} figure={f} />
                  ))}
                </div>
              </div>
            ))
          )}
        </Panel>
      ))}
    </>
  );
}
