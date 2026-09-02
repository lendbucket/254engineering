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
        {eyebrow ? (
          <p className="text-[11px] font-bold tracking-[0.14em] text-brass-ink uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 font-display text-[clamp(22px,3vw,30px)] leading-[1.15] font-bold tracking-[-0.01em] text-slate">
          {title}
        </h1>
        {lede ? <p className="mt-2 max-w-[70ch] text-[14px] leading-[1.6] text-slate-muted">{lede}</p> : null}
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
    <section
      className={`rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white ${className}`}
    >
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-limestone-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-slate">{title}</h2>
            {description ? <p className="mt-1 text-[13px] leading-[1.55] text-slate-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="px-4 py-4 sm:px-5">{children}</div>
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
    <div className="rounded-[4px] border border-dashed border-limestone-line px-5 py-10 text-center">
      <p className="text-[15px] font-semibold text-slate">{title}</p>
      <p className="mx-auto mt-2 max-w-[52ch] text-[14px] leading-[1.6] text-slate-muted">{body}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** An honest failure. Never a blank screen, never a silent nothing. */
export function ErrorState({ title, body }: { title: string; body: string }) {
  return (
    <div
      role="alert"
      className="rounded-[4px] border border-l-[3px] border-limestone-line border-l-[#b3261e] bg-white px-5 py-4"
    >
      <p className="text-[15px] font-semibold text-slate">{title}</p>
      <p className="mt-1.5 max-w-[62ch] text-[14px] leading-[1.6] text-slate-muted">{body}</p>
    </div>
  );
}

export function Chip({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const tones = {
    neutral: "bg-limestone text-slate-muted border-limestone-line",
    good: "bg-[#e8f3ec] text-[#14522f] border-[#bcdcc7]",
    warn: "bg-[#fdf3e0] text-[#7a4c05] border-[#f0d9a8]",
    bad: "bg-[#fdeceb] text-[#8c1d18] border-[#f3c9c6]",
  } as const;
  return (
    <span
      className={`inline-block rounded-[3px] border px-2 py-0.5 text-[11px] font-bold tracking-[0.06em] uppercase ${tones[tone]}`}
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
  const base =
    "inline-flex min-h-[44px] items-center justify-center rounded-[3px] px-4 text-[14px] font-bold transition-colors";
  return (
    <Link
      href={href}
      className={
        tone === "primary"
          ? `${base} bg-brass text-slate-ink hover:bg-brass-light`
          : `${base} border border-limestone-line text-slate hover:bg-limestone`
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
          <li key={row.id} className="rounded-[4px] border border-limestone-line bg-white p-4">
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
            <tr className="border-b border-limestone-line">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`py-2 pr-4 text-[11px] font-bold tracking-[0.1em] text-slate-muted uppercase ${
                    c.wide ? "hidden xl:table-cell" : ""
                  }`}
                >
                  {c.head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-limestone-line last:border-0 hover:bg-limestone/60">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`py-2.5 pr-4 align-top text-[13.5px] text-slate ${c.wide ? "hidden xl:table-cell" : ""}`}
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
