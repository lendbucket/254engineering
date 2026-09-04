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
  "min-h-[var(--tap-target)] px-4 text-[13.5px] transition-colors disabled:opacity-45 " +
  "disabled:cursor-not-allowed";

/**
 * One per view region.
 *
 * That is the standards file's rule and it is worth keeping: a screen with three
 * navy buttons has told the reader nothing about which one it expects them to
 * press, which is the entire job of a primary button.
 */
export function PrimaryButton({ children, className = "", href, ...rest }: ButtonProps) {
  const cls = `${BUTTON_BASE} bg-[var(--navy)] text-white font-bold hover:bg-[var(--navy-hover)] ${className}`;
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
    `border border-[var(--border-strong)] hover:bg-[var(--row-hover)] ${className}`;
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
    "border-[var(--border-strong)] bg-white px-3 py-1.5 text-[12.5px] font-semibold " +
    `text-[var(--navy)] hover:bg-[var(--row-hover)] disabled:opacity-45 ${className}`;
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

const DOT_COLOUR: Record<StatusTone, string> = {
  good: "bg-[var(--green)]",
  pending: "bg-[var(--gold)]",
  "in-motion": "bg-[var(--navy)]",
  inert: "bg-[var(--muted)]",
  failed: "bg-[var(--red)]",
};

export function StatusDot({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px] text-[var(--ink)]">
      <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${DOT_COLOUR[tone]}`} aria-hidden="true" />
      {label}
    </span>
  );
}

const PILL_SKIN: Record<StatusTone, string> = {
  good: "bg-[var(--green-bg)] border-[var(--green-border)] text-[var(--green)]",
  pending: "bg-[var(--warn-bg)] border-[var(--warn-border)] text-[var(--warn-ink)]",
  "in-motion": "bg-[var(--row-rule)] border-[var(--border)] text-[var(--navy)]",
  inert: "bg-[var(--row-rule)] border-[var(--border)] text-[var(--secondary)]",
  failed: "bg-[var(--warn-bg)] border-[var(--warn-border)] text-[var(--red)]",
};

export function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 py-0.5 text-[12px] font-semibold ${PILL_SKIN[tone]}`}
    >
      <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${DOT_COLOUR[tone]}`} aria-hidden="true" />
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
  return (
    <div
      role={tone === "failed" ? "alert" : "status"}
      className="flex gap-3 rounded-[var(--radius-card)] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-4 py-3"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`mt-0.5 h-4 w-4 shrink-0 ${tone === "failed" ? "stroke-[var(--red)]" : "stroke-[var(--gold-deep)]"}`}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M12 8v5" />
        <path d="M12 16.5h.01" />
        <circle cx="12" cy="12" r="9" />
      </svg>
      <p className="text-[13.5px] leading-[1.55] text-[var(--warn-ink)]">
        <strong className={tone === "failed" ? "font-bold text-[var(--red)]" : "font-bold"}>
          {condition}
        </strong>{" "}
        {children}
      </p>
    </div>
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
    <span className="inline-block rounded-[var(--radius-chip)] border border-dashed border-[var(--border-strong)] px-1.5 py-px text-[12px] italic text-[var(--muted)]">
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
    <p className="mt-2 text-[12px] leading-[1.5] text-[var(--muted)]">
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
  return (
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
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="px-[var(--panel-padding)] py-[var(--panel-padding)]">{children}</div>
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
  const colour =
    tone === "bad"
      ? "text-[var(--red)]"
      : tone === "warn"
        ? "text-[var(--gold-deep)]"
        : "text-[var(--navy)]";
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white px-4 py-3">
      <p className="portal-column-header">{label}</p>
      <p className={`mt-1 font-display text-[24px] leading-[1.1] font-bold tabular-nums ${colour}`}>
        {value}
      </p>
      {note ? <p className="mt-1 text-[12px] leading-[1.5] text-[var(--secondary)]">{note}</p> : null}
    </div>
  );
}
