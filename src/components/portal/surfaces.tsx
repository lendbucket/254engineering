import type { ReactNode } from "react";
import Link from "next/link";

/**
 * The portal's working surfaces.
 *
 * TWO FORM FACTORS, BOTH FIRST CLASS
 * ----------------------------------
 * On a phone this is an app: one column, 44px targets, 16px inputs so iOS does
 * not zoom, nothing hidden behind a hover. On a desktop it is an enterprise
 * tool: dense tables, tight rows, information per square inch.
 *
 * The same components serve both, which is why `Table` renders a real table at
 * the large breakpoint and a stack of cards below it rather than a table with a
 * horizontal scrollbar. A table that scrolls sideways on a phone is the single
 * most common way an "app feel" claim turns out to be false.
 *
 * THE EMPTY STATE IS A DESIGNED SCREEN
 * ------------------------------------
 * Every list takes an `empty`. A blank panel where rows would be reads as a
 * failure, and a person cannot tell "nothing yet" from "it broke" unless the
 * screen says which. So the empty state says what will appear here and what puts
 * it there.
 */

export function PageHead({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="portal-kicker text-[var(--secondary)]">{eyebrow}</p> : null}
        <h1 className="mt-1 font-display text-[clamp(17px,3vw,30px)] leading-[1.15] font-bold tracking-[-0.01em] text-[var(--navy)]">
          {title}
        </h1>
        {lede ? (
          <p className="mt-2 max-w-[70ch] text-[13.5px] leading-[1.6] text-[var(--secondary)]">{lede}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    /*
      THE ACCENT BORDER IS GONE.

      The standards file is explicit: no accent borders, top or left, on cards.
      Every panel carried a 3px navy top rule, which on a screen with six panels
      is six horizontal lines competing with the content and none of them saying
      anything. A card is a card because of its border and its ground.
    */
    <section
      className={`rounded-[var(--radius-card)] border border-[var(--border)] bg-white ${className}`}
    >
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-[var(--panel-padding)] py-3">
          <div className="min-w-0">
            <h2 className="font-display text-[16px] font-bold text-[var(--navy)]">{title}</h2>
            {description ? (
              <p className="mt-1 text-[13.5px] leading-[1.55] text-[var(--secondary)]">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="px-[var(--panel-padding)] py-[var(--panel-padding)]">{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
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
      /*
        A full tinted box, not a card with a red left edge. The standards file
        rules out accent borders and says alerts are tinted boxes, and a tint is
        legible at a glance where a 3px edge is not.
      */
      className="rounded-[var(--radius-card)] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-5 py-4"
    >
      <p className="text-[15px] font-semibold text-[var(--warn-ink)]">{title}</p>
      <p className="mt-1.5 max-w-[62ch] text-[13.5px] leading-[1.6] text-[var(--warn-ink)]">{body}</p>
    </div>
  );
}

export function Chip({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const tones = {
    neutral: "bg-[var(--row-rule)] text-[var(--secondary)] border-[var(--border)]",
    good: "bg-[var(--green-bg)] text-[var(--green)] border-[var(--green-border)]",
    warn: "bg-[var(--warn-bg)] text-[var(--warn-ink)] border-[var(--warn-border)]",
    bad: "bg-[var(--warn-bg)] text-[var(--red)] border-[var(--warn-border)]",
  } as const;
  return (
    <span
      className={`portal-kicker inline-block rounded-[var(--radius-pill)] border px-2 py-0.5 ${tones[tone]}`}
    >
      {label}
    </span>
  );
}

export function ButtonLink({
  href,
  children,
  tone = "primary",
}: {
  href: string;
  children: ReactNode;
  tone?: "primary" | "ghost";
}) {
  /*
    THE PRIMARY BUTTON WAS GOLD ON EVERY SCREEN IN THE PORTAL.

    One component, twenty five screens. The standards file rules gold out twice:
    the primary button is navy with white text, and gold appears only in the
    logo, warnings, pending states and the active nav bar. This single change is
    most of why the portal did not look like the design.
  */
  const base =
    "inline-flex min-h-[var(--tap-target)] items-center justify-center rounded-[var(--radius-control)] px-4 text-[13.5px] font-bold transition-colors";
  return (
    <Link
      href={href}
      className={
        tone === "primary"
          ? `${base} bg-[var(--navy)] text-white hover:bg-[var(--navy-hover)]`
          : `${base} border border-[var(--border-strong)] bg-white text-[var(--navy)] hover:bg-[var(--row-hover)]`
      }
    >
      {children}
    </Link>
  );
}

/**
 * A responsive record list.
 *
 * `columns` drives the desktop table. `card` renders the same row on a phone.
 * Both come from the same data so they cannot disagree about what a row says.
 */
export type Column<T> = {
  key: string;
  head: string;
  cell: (row: T) => ReactNode;
  /** Hide on smaller desktops where the table would get cramped. */
  wide?: boolean;
};

export function RecordTable<T extends { id: string }>({
  rows,
  columns,
  card,
  empty,
  rowHref,
}: {
  rows: T[];
  columns: Column<T>[];
  card: (row: T) => ReactNode;
  empty: ReactNode;
  rowHref?: (row: T) => string;
}) {
  if (rows.length === 0) return <>{empty}</>;

  return (
    <>
      {/* Phone: a stack of cards. No sideways scroll, ever. */}
      <ul className="flex flex-col gap-3 lg:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4">
            {rowHref ? (
              <Link href={rowHref(row)} className="block">
                {card(row)}
              </Link>
            ) : (
              card(row)
            )}
          </li>
        ))}
      </ul>

      {/* Desktop: a dense table. */}
      <div className="hidden lg:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`portal-column-header py-2 pr-4 ${c.wide ? "hidden xl:table-cell" : ""}`}
                >
                  {c.head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[var(--row-rule)] last:border-0 hover:bg-[var(--row-hover)]">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`py-[var(--row-padding-y)] pr-4 align-top text-[13.5px] text-[var(--ink)] ${c.wide ? "hidden xl:table-cell" : ""}`}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
