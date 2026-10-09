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
  /*
    DESIGN V10: page title 24 to 28 / 600, letter spacing -0.4, in ink; the meta
    line under it in secondary. The eyebrow stays as a plain label, in sentence
    case as written, rather than an uppercase kicker.
  */
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[13px] font-semibold text-[var(--secondary)]">{eyebrow}</p> : null}
        <h1 className="mt-1 text-[26px] leading-[1.2] font-semibold tracking-[-0.4px] text-[var(--ink)]">
          {title}
        </h1>
        {lede ? (
          <p className="mt-2 max-w-[70ch] text-[14px] leading-[1.6] text-[var(--secondary)]">{lede}</p>
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
      DESIGN V10 LAYOUT RULE 1, operator rulings of 2026-10-07: "No boxes.
      Sections are a heading with a 2px ink rule under it, content below,
      separated by whitespace. No cards, no shadows, no rounded panels, no
      tinted backgrounds." This was a bordered white card, and every screen that
      used it was a stack of cards. It is a section now, under the same name, so
      every caller changes at once and none is left behind. A section without a
      title is content under whitespace, nothing more.
    */
    <section className={className}>
      {title ? (
        <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-[var(--ink)] pb-2">
          <h2 className="min-w-0 text-[15px] font-semibold text-[var(--ink)]">{title}</h2>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {title && description ? (
        <p className="mt-3 max-w-[70ch] text-[14px] leading-[1.55] text-[var(--secondary)]">{description}</p>
      ) : null}
      <div className={title ? "mt-4" : ""}>{children}</div>
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
  /* V10: no box, dashed or otherwise. What will appear here, said plainly, where the rows would be. */
  return (
    <div className="py-6">
      <p className="text-[15px] font-semibold text-[var(--ink)]">{title}</p>
      <p className="mt-2 max-w-[62ch] text-[14px] leading-[1.6] text-[var(--secondary)]">{body}</p>
      {action ? <div className="mt-4 flex">{action}</div> : null}
    </div>
  );
}

/**
 * An honest failure. Never a blank screen, never a silent nothing.
 *
 * V10: "No notices or banners" and "No status colors ... Urgency is shown with
 * weight (bold) and words". This was an amber tinted box. It is the same words,
 * in ink, the title bold, still announced to a screen reader as an alert.
 */
export function ErrorState({ title, body }: { title: string; body: string }) {
  return (
    <div role="alert" className="py-2">
      <p className="text-[15px] font-semibold text-[var(--ink)]">{title}</p>
      <p className="mt-1.5 max-w-[62ch] text-[14px] leading-[1.6] text-[var(--ink)]">{body}</p>
    </div>
  );
}

/**
 * A short state word. V10 has no badges and no status colour, so the tone that
 * used to choose a colour now chooses weight: warn and bad are bold ink, good
 * and neutral are secondary. The word itself carries the meaning.
 */
export function Chip({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const urgent = tone === "warn" || tone === "bad";
  return (
    <span className={`inline-block text-[13px] ${urgent ? "font-semibold text-[var(--ink)]" : "text-[var(--secondary)]"}`}>
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
    "inline-flex min-h-[var(--tap-target)] items-center justify-center rounded-[var(--radius-control)] px-4 text-[14px] font-bold transition-colors";
  const className =
    tone === "primary"
      ? `${base} bg-[var(--navy)] text-white hover:bg-[var(--navy-hover)]`
      : `${base} border border-[var(--border-strong)] bg-white text-[var(--navy)] hover:bg-[var(--row-hover)]`;
  /*
    AN API ROUTE IS A DOWNLOAD, NOT A PAGE, SO IT IS A PLAIN ANCHOR. Found
    2026-10-09. A Next <Link> is prefetched as soon as it is in view, and the
    export route writes its audit row before it answers: every administrator
    who opened the dashboard recorded "Exported margin by period" without
    exporting anything, and the prefetch hung, so the page never went quiet.
    A plain anchor is never prefetched. dashboard-speed-audit proves both.
  */
  if (href.startsWith("/api/")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
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
      {/* Phone: rows separated by a 1px rule, V10, not a stack of cards. No sideways scroll, ever. */}
      <ul className="border-t border-[var(--row-rule)] lg:hidden">
        {rows.map((row) => (
          <li key={row.id} className="border-b border-[var(--row-rule)] py-3">
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
                    className={`py-[var(--row-padding-y)] pr-4 align-top text-[14px] text-[var(--ink)] ${c.wide ? "hidden xl:table-cell" : ""}`}
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
