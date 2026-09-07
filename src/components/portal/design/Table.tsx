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
  /**
   * Hidden below the tablet breakpoint, IN THE TABLE ONLY.
   *
   * The card list still carries it. That is the point of point 4 of the native
   * standard: a card has to hold the same information in reading order, and a
   * column dropped because it did not fit a width is information the phone
   * simply never gets. This flag decides table density, not what a person is
   * allowed to know.
   */
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

  const primary = columns[0];
  const rest = columns.slice(1);

  return (
    <div>
      {/*
        POINT 4 OF THE NATIVE STANDARD: TABLES BECOME CARDS.

        A table that scrolls sideways on a phone is a desktop table on a phone.
        This component used to be exactly that, at min-width 640 inside a
        horizontal scroller, and the desktopOnly flag hid columns to make it
        fit, so a phone lost information rather than gaining a layout.

        Below md there is no table at all. Each row is a card: the first column
        is the heading, because it is the one every caller puts the identifying
        fact in, and every other column follows as a labelled pair in the order
        the columns were declared. Reading order, not fitting order.

        The header row has no card equivalent and does not need one. A column
        header answers "what is this value", and on a card the label is beside
        the value where the question is actually asked.
      */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-3"
          >
            <p className="text-[15px] leading-[1.35] font-bold text-[var(--navy)]">
              {onRowHref ? (
                /*
                  A ROW LINK IS THE TARGET FOR THE WHOLE ROW ON A PHONE, and it
                  was the height of its text. 20px, under the 24px WCAG 2.5.8
                  floor, on every table in the portal that gives its rows a
                  destination. It surfaced on the partners screen because two
                  such links sit close enough together for the spacing
                  exception not to apply, which is the exception doing its job
                  and is not a reason to fix only that screen.
                */
                <a
                  href={onRowHref(row)}
                  className="flex min-h-[var(--tap-target)] items-center"
                >
                  {primary.cell(row)}
                </a>
              ) : (
                primary.cell(row)
              )}
            </p>

            {rest.length > 0 ? (
              <dl className="mt-2 flex flex-col gap-1.5">
                {rest.map((c) => (
                  <div key={c.key} className="flex items-baseline justify-between gap-3">
                    <dt className="portal-column-header shrink-0">{c.header}</dt>
                    <dd
                      /*
                        Numbers align right and prose does not. The first
                        version had it backwards, so a long value like a
                        coverage sentence wrapped ragged left against the card
                        edge while the figures it sat under did not line up at
                        all. justify-between already pushes a short value to
                        the right, so prose only needs to be left aligned for
                        the lines after the first.
                      */
                      /*
                        min-w-0 and a break, because a card row is a flex
                        child and a flex child will not shrink below its
                        content by default. An email address has no space in
                        it, so one long one pushed the whole scrolling region
                        11px wider than the phone on the applications screen,
                        found on 2026-09-07 the first time an audit measured
                        that region rather than the document.

                        Fixed on the shared card rather than on that screen:
                        every table in the portal renders through here, and a
                        reference, an address or an email in any of them would
                        have done the same thing.
                      */
                      className={`min-w-0 break-words text-[13.5px] leading-[1.45] text-[var(--ink)] ${
                        c.numeric ? "tabular-nums text-right" : ""
                      }`}
                    >
                      {c.cell(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </li>
        ))}
      </ul>

      {/*
        The table, at md and up only. It keeps its min-width, which no longer
        forces a sideways scroll because md is 768px and the table is 640.
        .scroll-x stays as the backstop for a caller with more columns than
        that, and it is a deliberate horizontally scrolling component with the
        site's own affordance rules on it, which point 2 allows.
      */}
      <div className="scroll-x hidden md:block">
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
