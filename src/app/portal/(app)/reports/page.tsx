import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { PageHead, Panel, EmptyState } from "@/components/portal/surfaces";
import { SystemAlert } from "@/components/portal/design";
import { REPORTS, formatFigure, periodOf, type Figure } from "@/lib/ops-reports";
import { isKnown, money } from "@/lib/ops-money";

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
 * EVERY FIGURE OPENS ONTO THE ROWS IT WAS COMPUTED FROM.
 *
 * A total nobody can expand is a number somebody has to trust. The brief calls
 * an unexpandable total the defect class, and it is: the arithmetic here is
 * simple enough that the only way it goes wrong is by counting the wrong set,
 * which is exactly what looking at the set would show.
 *
 * The expansion is the figure's own rows rather than a link to a screen. The
 * first version linked, and most of those links pointed at /portal/orders,
 * which is not a list of orders: that screen deliberately shows only orders
 * that have stopped moving. "See the rows" would have opened a set that did not
 * contain the rows, usually an empty one sitting under a figure reading
 * thousands of dollars. Carrying the rows means there is no second query left
 * to disagree with the first.
 */

/**
 * A row's own contribution, rendered in the figure's units.
 *
 * A row with no amount renders as nothing rather than as a zero, which is the
 * absent-versus-zero rule one level down: the rows under a state count have no
 * value to give, and a 0 beside each would read as an amount somebody could add.
 */
function rowValue(figure: Figure, value: number | null): string {
  if (!isKnown(value)) return "";
  if (figure.kind === "money") return money(value);
  if (figure.kind === "duration") return `${value} ${figure.label.startsWith("oldest") ? "days" : "hours"}`;
  return String(value);
}

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

      {/*
        Rendered even when the set is empty, because "none, and here is the
        empty set" is a different and more trustworthy statement than a figure
        with nothing under it. The one figure with no expansion at all is an
        absent one, where there is no set because the query did not run.
      */}
      {figure.rows ? (
        <details className="mt-2">
          <summary className="inline-flex min-h-[var(--tap-target)] cursor-pointer items-center text-[12.5px] font-semibold text-[var(--navy)] underline">
            {figure.rows.length === 0
              ? "The set is empty"
              : `See the ${figure.rows.length} row${figure.rows.length === 1 ? "" : "s"}`}
          </summary>

          {figure.rows.length === 0 ? (
            <p className="mt-2 text-[12px] leading-[1.45] text-[var(--secondary)]">
              The query ran and matched no record. This figure is that fact rather than a missing one.
            </p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full border-collapse text-[12px]">
                <tbody>
                  {figure.rows.map((row, i) => (
                    <tr key={`${row.label}-${i}`} className="border-t border-[var(--border)]">
                      <td className="py-1 pr-2 align-top font-semibold text-[var(--navy)]">{row.label}</td>
                      <td className="py-1 pr-2 align-top text-[var(--secondary)]">{row.detail}</td>
                      <td className="py-1 text-right align-top tabular-nums text-[var(--navy)]">
                        {rowValue(figure, row.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
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
