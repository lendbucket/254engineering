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
      className={`text-[12px] font-bold tracking-[0.14em] uppercase ${
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
  "inline-flex items-center justify-center gap-2 rounded-[3px] px-7 py-3.5 text-center font-sans text-[15.5px] font-bold transition-colors duration-150 min-h-[48px]";

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
  /*
   * Gold fill with navy text, on light surfaces as well as dark.
   *
   * The primary tone used to be a navy fill. v5 has exactly one call to action
   * treatment and it is this one, on the hero, on the windstorm band, and on the
   * government card. Keeping a second, quieter primary for interior pages would
   * have meant the most important control on a service page looked less like a
   * control than the same control on the homepage.
   *
   * Gold as a BUTTON FILL is not the thing the standing rule forbids. The rule
   * is that gold is never body text on a light surface, because gold on white
   * measures 2.33:1. Navy on gold is the inverse pairing and clears AA, and
   * contrast-audit measures it on every template.
   */
  primary: "bg-brass text-slate-ink hover:bg-brass-light",
  secondary:
    "border-[1.5px] border-slate/30 bg-transparent text-slate hover:border-slate hover:bg-limestone-sunk",
  onDark: "bg-brass text-slate-ink hover:bg-brass-light",
  onDarkOutline:
    "border-[1.5px] border-white/50 text-slate-fg hover:border-brass hover:text-brass-light",
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
 * The standard section opening.
 *
 * This is now a thin alias over `SectionHead` in ui/section.tsx, which is where
 * the v5 grammar lives. It stays because a dozen call sites import
 * `SectionHeading` and renaming them all would be churn in the middle of a
 * design port, where every unrelated line in a diff costs review attention.
 *
 * New code should import `SectionHead` directly.
 */
export { SectionHead as SectionHeading } from "@/components/ui/section";

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
        text-[16.5px] leading-[1.78] text-slate-muted
        [&_a]:text-slate [&_a]:underline [&_a]:decoration-brass [&_a]:underline-offset-4
        [&_h2]:mt-14 [&_h2]:font-display [&_h2]:text-[26px] [&_h2]:leading-[1.25] [&_h2]:font-bold [&_h2]:tracking-[-0.01em] [&_h2]:text-slate
        [&_h3]:mt-9 [&_h3]:font-display [&_h3]:text-[19px] [&_h3]:leading-[1.35] [&_h3]:font-bold [&_h3]:text-slate
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
 * WHY IT IS A GAP GRID AND NOT A HAIRLINE GRID
 * -------------------------------------------
 * It used to draw one pixel lines by bleeding a container colour through gaps,
 * which put a solid tan rectangle in the unoccupied cell of any short last row.
 * Nine services in a two column grid produced exactly that, a block that read as
 * a card somebody forgot to write.
 *
 * v5 solves it differently and better: real gaps, and every card carries its own
 * border and a 3px navy top rule. A short last row is then genuinely empty.
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
  return <ul className={`grid gap-[18px] ${colClass} ${className}`}>{children}</ul>;
}

/**
 * The classes every direct child of a CardGrid carries.
 *
 * v5 separates cards with a gap and gives each one its own border and a 3px navy
 * top rule, which is why the grid above no longer draws hairlines between cells
 * and this no longer suppresses its own. The note about the tan rectangle in a
 * short last row is resolved by the same change: with a gap there is no
 * container colour showing through, so an unoccupied cell is genuinely empty.
 */
export const cardCell =
  "rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white";

/** A bordered panel on limestone. The only card treatment on the site. */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white p-6 sm:p-7 ${className}`}
    >
      {children}
    </div>
  );
}
