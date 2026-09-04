import type { ReactNode } from "react";
import Link from "next/link";
import { AbsentChip } from "./Primitives";

/**
 * A record: breadcrumb, header band, field grid, history.
 *
 * The shape the standards file specifies for every entity screen, so a file, an
 * order, an account and a technician all read the same way and somebody who has
 * learned one has learned them all.
 */

export function Breadcrumb({ trail }: { trail: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--secondary)]">
        {trail.map((step, i) => (
          <li key={step.label} className="flex items-center gap-2">
            {step.href ? (
              <Link href={step.href} className="hover:text-[var(--navy)] hover:underline">
                {step.label}
              </Link>
            ) : (
              <span className="text-[var(--ink)]">{step.label}</span>
            )}
            {i < trail.length - 1 ? <span aria-hidden="true">·</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * The header band.
 *
 * Reference, status, actions. The reference is the biggest thing on the screen
 * because it is what somebody reads out on the phone.
 */
export function RecordHeader({
  reference,
  title,
  status,
  actions,
}: {
  reference: string;
  title?: string;
  status?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white px-[var(--panel-padding)] py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[clamp(20px,2.5vw,30px)] leading-[1.15] font-bold text-[var(--navy)] tabular-nums">
              {reference}
            </h1>
            {status}
          </div>
          {title ? (
            <p className="mt-1.5 max-w-[70ch] text-[13.5px] leading-[1.55] text-[var(--secondary)]">{title}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

/**
 * The labelled field grid.
 *
 * An absent value renders the chip rather than an empty cell. An empty cell in
 * a field grid is indistinguishable from a rendering fault, and somebody
 * eventually reads it as zero, which is the distinction this platform spends
 * three modules protecting.
 */
export function FieldGrid({ fields }: { fields: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((f) => (
        <div key={f.label}>
          <dt className="portal-column-header">{f.label}</dt>
          <dd className="mt-1 text-[13.5px] leading-[1.5] text-[var(--ink)]">
            {f.value === null || f.value === undefined || f.value === "" ? <AbsentChip /> : f.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The history timeline.
 *
 * A dot rail with an actor and a timestamp on every event. The timestamp is
 * explicit rather than relative, because "3 days ago" on a regulatory record is
 * a fact that changes depending on when you read it.
 */
export function Timeline({
  events,
}: {
  events: { id: string; title: string; actor: string | null; at: string; detail?: ReactNode }[];
}) {
  return (
    <ol className="relative">
      {events.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
          <div className="flex flex-col items-center">
            <span
              className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full bg-[var(--navy)]"
              aria-hidden="true"
            />
            {i < events.length - 1 ? (
              <span className="mt-1 w-px flex-1 bg-[var(--border)]" aria-hidden="true" />
            ) : null}
          </div>
          <div className="min-w-0 pb-1">
            <p className="text-[13.5px] leading-[1.5] font-semibold text-[var(--ink)]">{e.title}</p>
            <p className="mt-0.5 text-[12px] text-[var(--secondary)]">
              {e.actor ? `${e.actor} · ` : ""}
              {e.at}
            </p>
            {e.detail ? (
              <div className="mt-1 text-[13.5px] leading-[1.55] text-[var(--secondary)]">{e.detail}</div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * The document sheet.
 *
 * A 760px white page on the canvas, with the letterhead rule the standards file
 * specifies. Used by the evidence binder and by anything that is a DOCUMENT
 * rather than a screen: the distinction matters because a document is something
 * somebody prints and hands to a third party.
 */
export function DocumentSheet({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-center px-[var(--page-gutter)] py-6">
      <article className="w-full max-w-[760px] rounded-[var(--radius-card)] border border-[var(--border)] bg-white px-6 py-8 sm:px-10 sm:py-12 print:border-0 print:px-0">
        {children}
      </article>
    </div>
  );
}

/** The letterhead rule: 2px navy under the head of a document. */
export function SheetLetterhead({ children }: { children: ReactNode }) {
  return <div className="border-b-2 border-[var(--navy)] pb-4">{children}</div>;
}

/**
 * The small print at the foot of a document.
 *
 * Every document this platform produces carries a note saying what it is and
 * what it is not. That predates this design and survives it: the evidence
 * binder's limitations block is the reason a binder cannot be mistaken for an
 * engineering opinion.
 */
export function SheetRecordNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-8 border-t border-[var(--border)] pt-4 text-[12px] leading-[1.6] text-[var(--muted)]">
      {children}
    </p>
  );
}
