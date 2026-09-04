import type { ReactNode } from "react";

/**
 * The table, its header, its hover, and the footer that counts.
 *
 * WHY THE COUNT FOOTER IS PART OF THE COMPONENT AND NOT OPTIONAL
 * --------------------------------------------------------------
 * "Showing 1 to 14 of 14" answers a question a truncated list cannot: whether
 * what is on screen is everything. A table that silently shows the first
 * twenty five of two hundred looks identical to a table showing all twenty
 * five, and somebody makes a decision on the difference. The footer is required
 * by the type rather than passed when remembered.
 *
 * WHY THE EMPTY STATE IS ALSO REQUIRED
 * -------------------------------------
 * Same rule the rest of this repository follows: a blank panel where rows would
 * be reads as a failure, and nobody can tell "nothing yet" from "it broke"
 * unless the screen says which.
 */

export type Column<T> = {
  key: string;
  header: string;
  /** Right aligned, tabular. Use for money, counts and anything compared down a column. */
  numeric?: boolean;
  /** Rendered per row. */
  cell: (row: T) => ReactNode;
  /** Hidden below the tablet breakpoint. A phone gets the card list instead. */
  desktopOnly?: boolean;
};

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  total,
  empty,
  caption,
  onRowHref,
}: {
  columns: Column<T>[];
  rows: T[];
  /** The true total, which may exceed rows.length. That difference is the point. */
  total: number;
  empty: ReactNode;
  caption: string;
  onRowHref?: (row: T) => string;
}) {
  if (rows.length === 0) {
    return <div className="px-1 py-2">{empty}</div>;
  }

  return (
    <div>
      {/*
        Wide by nature, so it scrolls inside its own container rather than
        widening the document. .scroll-x carries the momentum and containment
        rules the site already defines.
      */}
      <div className="scroll-x">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-[var(--border)]">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`portal-column-header pb-2 ${c.numeric ? "text-right" : ""} ${
                    c.desktopOnly ? "hidden md:table-cell" : ""
                  }`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[var(--row-rule)] last:border-0 hover:bg-[var(--row-hover)]"
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`py-[var(--row-padding-y)] pr-3 align-top text-[13.5px] text-[var(--ink)] ${
                      c.numeric ? "text-right tabular-nums" : ""
                    } ${c.desktopOnly ? "hidden md:table-cell" : ""}`}
                  >
                    {onRowHref && c.key === columns[0].key ? (
                      <a href={onRowHref(row)} className="font-semibold text-[var(--navy)] hover:underline">
                        {c.cell(row)}
                      </a>
                    ) : (
                      c.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TableFooter shown={rows.length} total={total} />
    </div>
  );
}

/**
 * The count.
 *
 * Deliberately says nothing about pagination when there is none. The standards
 * file shows "Showing 1 to 14 of 14 · Rows per page: 25", and rendering the rows
 * per page control on a table that fits on one page is a control that does
 * nothing, which is its own small lie.
 */
export function TableFooter({ shown, total }: { shown: number; total: number }) {
  return (
    <p className="mt-3 text-[12px] text-[var(--secondary)]">
      Showing {shown === total ? `all ${total}` : `1 to ${shown} of ${total}`}
      {shown === total ? (total === 1 ? " record" : " records") : ""}
    </p>
  );
}

/**
 * The empty state.
 *
 * `body` says what will appear here and what puts it there. That is the repo's
 * existing rule and it survives the restyle unchanged.
 */
export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border)] px-5 py-10 text-center">
      <p className="text-[15px] font-semibold text-[var(--navy)]">{title}</p>
      <p className="mx-auto mt-2 max-w-[52ch] text-[13.5px] leading-[1.6] text-[var(--secondary)]">{body}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** An honest failure. Never a blank screen, never a silent nothing. */
export function ErrorState({ title, body }: { title: string; body: string }) {
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-card)] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-5 py-4"
    >
      <p className="text-[15px] font-semibold text-[var(--warn-ink)]">{title}</p>
      <p className="mt-1.5 max-w-[62ch] text-[13.5px] leading-[1.6] text-[var(--warn-ink)]">{body}</p>
    </div>
  );
}
