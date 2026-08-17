import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The small shared pieces every page is built from.
 *
 * They exist as components rather than as repeated class strings for one
 * reason: the brass accent has three values chosen by surface, and an eyebrow
 * written by hand on a slate section is exactly where the wrong one gets picked.
 * See the note at the top of globals.css.
 */

/** The tracked-out label that opens a section. Brass on limestone, brass-light on slate. */
export function Eyebrow({
  children,
  onDark = false,
  className = "",
}: {
  children: ReactNode;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <p
      className={`font-sans text-[0.7rem] font-semibold tracking-[0.18em] uppercase ${
        onDark ? "text-brass-light" : "text-brass-ink"
      } ${className}`}
    >
      {children}
    </p>
  );
}

/** A short brass rule. Used once per section opening, never decoratively. */
export function Rule({ onDark = false, className = "" }: { onDark?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block h-px w-14 ${onDark ? "bg-brass-light" : "bg-brass"} ${className}`}
    />
  );
}

type ButtonTone = "primary" | "secondary" | "onDark" | "onDarkOutline";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-[3px] px-6 py-3.5 text-center font-sans text-[0.94rem] font-semibold tracking-[0.01em] transition-colors duration-150 min-h-[48px]";

/**
 * Four tones, and no way to ask for a fifth by passing classes.
 *
 * The secondary button on a slate section is its own tone rather than the
 * primary tone with `bg-transparent` appended, because appending does not work
 * and fails quietly. Tailwind resolves conflicting utilities by their order in
 * the generated stylesheet, not by their order in the class string, so
 * `bg-brass-light` and a later `bg-transparent` produce whichever the build
 * happened to emit second. The first render of this site shipped a call to
 * action that was brass text on a brass button for exactly that reason.
 */
const buttonTones: Record<ButtonTone, string> = {
  primary: "bg-slate text-slate-fg hover:bg-slate-ink",
  secondary:
    "border border-slate/25 bg-transparent text-slate hover:border-slate/60 hover:bg-limestone-sunk",
  onDark: "bg-brass-light text-slate-ink hover:bg-brass",
  onDarkOutline: "border border-slate-fg/35 text-slate-fg hover:border-slate-fg/70 hover:bg-white/10",
};

/** A link styled as a button. Never a <button>: these all navigate. */
export function ButtonLink({
  href,
  children,
  tone = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  tone?: ButtonTone;
  className?: string;
}) {
  return (
    <Link href={href} className={`${buttonBase} ${buttonTones[tone]} ${className}`}>
      {children}
    </Link>
  );
}

/** The same treatment for a real submit button inside a form. */
export function buttonClass(tone: ButtonTone = "primary"): string {
  return `${buttonBase} ${buttonTones[tone]} disabled:cursor-not-allowed disabled:opacity-60`;
}

/**
 * The standard section opening: eyebrow, heading, and an optional lede.
 *
 * Heading level is a prop because a section heading is an h2 on most pages and
 * an h3 inside a two-level page, and getting that wrong is a real accessibility
 * finding rather than a style one.
 */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  onDark = false,
  level = "h2",
  className = "",
}: {
  eyebrow?: string;
  title: string;
  lede?: ReactNode;
  onDark?: boolean;
  level?: "h2" | "h3";
  className?: string;
}) {
  const Heading = level;
  return (
    <div className={`max-w-3xl ${className}`}>
      {eyebrow ? <Eyebrow onDark={onDark}>{eyebrow}</Eyebrow> : null}
      <Heading
        className={`mt-3 text-[1.85rem] leading-[1.18] font-semibold sm:text-[2.35rem] ${
          onDark ? "text-slate-fg" : "text-slate"
        }`}
      >
        {title}
      </Heading>
      {lede ? (
        <div
          className={`mt-5 text-[1.03rem] leading-[1.7] ${onDark ? "text-slate-fg-muted" : "text-slate-muted"}`}
        >
          {lede}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Long form document typography, for the privacy policy and the terms.
 *
 * Set at the container rather than per element so the two legal documents cannot
 * drift apart typographically, and so adding a paragraph to one of them requires
 * no styling decision. The measure is narrow on purpose: these are documents
 * somebody may actually have to read closely.
 */
export function Prose({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`
        text-[1rem] leading-[1.78] text-slate-muted
        [&_a]:text-slate [&_a]:underline [&_a]:decoration-brass/60 [&_a]:underline-offset-4
        [&_h2]:mt-14 [&_h2]:text-[1.45rem] [&_h2]:leading-[1.3] [&_h2]:font-semibold [&_h2]:text-slate
        [&_h3]:mt-9 [&_h3]:text-[1.12rem] [&_h3]:leading-[1.35] [&_h3]:font-semibold [&_h3]:text-slate
        [&_li]:mt-2.5
        [&_p]:mt-5
        [&_strong]:font-semibold [&_strong]:text-slate
        [&_ul]:mt-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6
        ${className}
      `}
    >
      {children}
    </div>
  );
}

/**
 * The card grid used for services, regions, and every other set of linked cards.
 *
 * WHY IT DRAWS ITS LINES WITH BORDERS RATHER THAN WITH GAPS
 * ---------------------------------------------------------
 * The tidier looking technique is a one pixel gap over a coloured container, so
 * the container shows through as hairlines between the cells. It has one defect
 * and it is visible on any grid whose item count does not fill the last row: the
 * unoccupied cell is not empty, it is a solid block of the line colour. Nine
 * services in a two column grid produced exactly that, a tan rectangle that
 * reads as a card somebody forgot to write.
 *
 * Borders on the cells put the lines where they belong and leave a short last
 * row genuinely empty, which is what a table does and what a reader expects.
 */
export function CardGrid({
  children,
  cols = 2,
  className = "",
}: {
  children: ReactNode;
  cols?: 2 | 3;
  className?: string;
}) {
  const colClass = cols === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2";
  return (
    <ul
      className={`grid overflow-hidden rounded-[3px] border-t border-l border-limestone-line ${colClass} ${className}`}
    >
      {children}
    </ul>
  );
}

/** The classes every direct child of a CardGrid carries. */
export const cardCell = "border-r border-b border-limestone-line bg-limestone-raised";

/** A bordered panel on limestone. The only card treatment on the site. */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[3px] border border-limestone-line bg-limestone-raised p-6 sm:p-7 ${className}`}
    >
      {children}
    </div>
  );
}
