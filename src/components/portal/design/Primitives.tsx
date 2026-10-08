import type { ReactNode } from "react";
import { isKnown, money, type Cents } from "@/lib/ops-money";

/**
 * The portal design system, as components.
 *
 * Every colour, radius and size here is a token from src/styles/portal.css,
 * spelled as docs/PORTAL_DESIGN_STANDARDS.md spells it. token-audit fails the
 * build on a raw hex, an off scale font size or an off scale radius in any file
 * it holds to the system.
 *
 * WHY THESE ARE COMPONENTS AND NOT CLASS NAMES IN A STYLESHEET
 * ------------------------------------------------------------
 * Because several of them carry a RULE rather than a look. AbsentFigure is the
 * visual form of "an absent figure is never a zero", which this platform
 * enforces in ops-money and asserts in money-audit. SystemAlert enforces the
 * lead in that names the condition before the consequence. A stylesheet class
 * cannot enforce either; a component can, and can be checked.
 */

// ================================================================= buttons ===

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  /** Renders as a link when given. */
  href?: string;
  className?: string;
};

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] " +
  "min-h-[var(--tap-target)] px-4 text-[14px] transition-colors disabled:opacity-45 " +
  "disabled:cursor-not-allowed";

/**
 * One per view region.
 *
 * That is the standards file's rule and it is worth keeping: a screen with three
 * navy buttons has told the reader nothing about which one it expects them to
 * press, which is the entire job of a primary button.
 */
export function PrimaryButton({ children, className = "", href, ...rest }: ButtonProps) {
  const cls =
    `${BUTTON_BASE} bg-[var(--navy)] text-white font-bold hover:bg-[var(--navy-hover)] ` +
    `active:bg-[var(--ink-navy)] active:scale-[0.98] ${className}`;
  return href ? (
    <a href={href} className={cls}>
      {children}
    </a>
  ) : (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = "", href, ...rest }: ButtonProps) {
  const cls =
    `${BUTTON_BASE} bg-white text-[var(--navy)] font-semibold ` +
    `border border-[var(--border-strong)] hover:bg-[var(--row-hover)] ` +
    `active:bg-[var(--canvas)] active:scale-[0.98] ${className}`;
  return href ? (
    <a href={href} className={cls}>
      {children}
    </a>
  ) : (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

/**
 * The toolbar button, which is smaller and is allowed to be.
 *
 * 12.5px with 6 by 12 padding, from the standards file. It sits in a dense
 * toolbar above a table where a 44px control would push the table off the fold.
 * The tap target rule is not waived on mobile: the mobile chrome does not use
 * toolbars, it uses the bottom tab bar, so this component never renders at 390.
 */
export function ToolbarButton({ children, className = "", href, ...rest }: ButtonProps) {
  const cls =
    "inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border " +
    "border-[var(--border-strong)] bg-white px-3 py-1.5 text-[13px] font-semibold " +
    `text-[var(--navy)] hover:bg-[var(--row-hover)] active:bg-[var(--canvas)] ` +
    `disabled:opacity-45 ${className}`;
  return href ? (
    <a href={href} className={cls}>
      {children}
    </a>
  ) : (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

// ================================================================== status ===

/**
 * The five status tones, and what each one means.
 *
 * Named for the STATE rather than the colour, so a component says
 * tone="pending" and cannot accidentally say tone="gold" about something that
 * is not pending. Gold outside a warning or a pending state is the single
 * easiest way to break this palette.
 */
export type StatusTone = "good" | "pending" | "in-motion" | "inert" | "failed";

/*
 * DESIGN V10: "No status colors. No red, green or amber anywhere in the UI.
 * Urgency is shown with weight (bold) and words ... never with color, dots,
 * badges or tinted boxes." The dot and the pill below keep their names and
 * their tone argument so no caller changes, and render a word: failed and
 * pending in bold ink, the rest in secondary. The colour maps they painted
 * with are removed rather than kept unread; git holds what they were.
 */
const URGENT_TONE: Record<StatusTone, boolean> = {
  good: false,
  pending: true,
  "in-motion": false,
  inert: false,
  failed: true,
};

export function StatusDot({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span className={`inline-block text-[13px] ${URGENT_TONE[tone] ? "font-semibold text-[var(--ink)]" : "text-[var(--secondary)]"}`}>
      {label}
    </span>
  );
}

export function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span className={`inline-block text-[13px] ${URGENT_TONE[tone] ? "font-semibold text-[var(--ink)]" : "text-[var(--secondary)]"}`}>
      {children}
    </span>
  );
}

// =================================================================== alert ===

/**
 * The system alert, and the shape of its copy.
 *
 * `condition` is the bold lead in that NAMES what is true. `children` is what
 * follows from it. The two are separate props rather than one blob because the
 * standards file's rule is about the shape of the sentence, and a single prop
 * would let somebody write a paragraph of reassurance and still satisfy the
 * component's type.
 *
 * "Restricted mode." then what is and is not affected. Not "Heads up!".
 */
export function SystemAlert({
  condition,
  children,
  tone = "pending",
}: {
  condition: string;
  children: ReactNode;
  tone?: "pending" | "failed";
}) {
  /*
    V10: "No notices or banners. Status goes in a plain line of text." This was
    an amber tinted box with a warning icon. It is one line now, the condition
    in bold ink and the rest in ink, still announced as an alert or a status.
  */
  return (
    <p role={tone === "failed" ? "alert" : "status"} className="max-w-[72ch] text-[14px] leading-[1.55] text-[var(--ink)]">
      <strong className="font-semibold">{condition}</strong> {children}
    </p>
  );
}

// ============================================================ absent figure ===

/**
 * THE MOST IMPORTANT COMPONENT IN THIS FILE.
 *
 * It is the visual form of a rule the platform already enforces in code: a
 * figure nobody entered and a figure of zero are different facts, absents are
 * excluded from totals, and the exclusion is footnoted.
 *
 * WHY IT CALLS ops-money RATHER THAN DECIDING FOR ITSELF
 * ------------------------------------------------------
 * Because there must be exactly one definition of "absent" in this platform. A
 * view that decided for itself would be a second definition, and the first time
 * the two disagreed the screen and the CSV would show different totals. isKnown
 * and money are the same functions billing, the exports and money-audit use.
 *
 * WHY THE WORDING IS "not set" AND NOT THE DESIGN'S "not recorded"
 * ----------------------------------------------------------------
 * money() has returned "not set" since Phase 5, it appears in the CSV exports
 * and the billing screens, and money-audit asserts on it. Changing the phrase
 * to match the design would be a copy change across surfaces this workstream is
 * not touching, so the design's TREATMENT is adopted, the platform's WORD is
 * kept, and the difference is reported rather than resolved quietly.
 */
export function AbsentChip({ children = "not set" }: { children?: ReactNode }) {
  return (
    <span className="inline-block text-[13px] italic text-[var(--secondary)]">
      {children}
    </span>
  );
}

/** A money figure, or the chip. There is no third rendering. */
export function MoneyFigure({ value, className = "" }: { value: Cents; className?: string }) {
  if (!isKnown(value)) return <AbsentChip>{money(value)}</AbsentChip>;
  return <span className={`tabular-nums ${className}`}>{money(value)}</span>;
}

/**
 * The footnote that has to accompany any total with an absent in it.
 *
 * Returns null when nothing was excluded, so a caller can render it
 * unconditionally and a screen never carries a footnote about nothing.
 */
export function ExclusionNote({ excluded, of }: { excluded: number; of: string }) {
  if (excluded === 0) return null;
  return (
    <p className="mt-2 text-[12px] leading-[1.5] text-[var(--secondary)]">
      {excluded} {excluded === 1 ? "record has" : "records have"} no {of} recorded and{" "}
      {excluded === 1 ? "is" : "are"} excluded from this total.
    </p>
  );
}

// ================================================================== panels ===

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
  /* V10 layout rule 1, as the Panel in surfaces.tsx: a heading over a 2px ink rule, content below, no card. */
  return (
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

/** A KPI. Archivo 24/700, tabular, with its label above and its note below. */
export function Figure({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: "neutral" | "warn" | "bad";
}) {
  /*
    V10's KPI row: "label, value 26/600, change in faint text ... No dividers,
    no color." This was a bordered card with the value in red or gold for a bad
    or warn tone. The tone now only underlines the label's weight; the value is
    ink, unboxed.
  */
  return (
    <div className="py-1">
      <p className={`text-[13px] ${tone === "neutral" ? "text-[var(--secondary)]" : "font-semibold text-[var(--ink)]"}`}>{label}</p>
      <p className="mt-1 text-[26px] leading-[1.1] font-semibold tabular-nums text-[var(--ink)]">{value}</p>
      {note ? <p className="mt-1 text-[12px] leading-[1.5] text-[var(--secondary)]">{note}</p> : null}
    </div>
  );
}
