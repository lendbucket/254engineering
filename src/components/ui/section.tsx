import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";

/**
 * The section grammar of the approved v5 design, for every page on the site.
 *
 * WHY THIS MOVED OUT OF components/home
 * -------------------------------------
 * Section 2 built these for the homepage rebuild and left them under `home/`,
 * which was right while exactly one page used them. Propagating the design
 * sitewide from that location would have meant fourteen templates importing
 * their section chrome from a folder named for a different page, and the first
 * person to add a homepage only concern to that file would have changed every
 * page on the site without meaning to.
 *
 * `home/sections.tsx` now holds only what is genuinely homepage specific and
 * imports the grammar from here.
 *
 * THE GRAMMAR, WHICH v5 APPLIES WITHOUT EXCEPTION
 * -----------------------------------------------
 * Vertical padding `clamp(48px, 7vw, 88px)`. An Archivo 700 heading at
 * `clamp(28px, 3.6vw, 38px)` with -0.01em tracking. A 16px lede at 1.7 line
 * height capped at 62 characters. Cards at 4px radius, a 1px border, a 3px top
 * border in navy, lifting 3px on hover. Backgrounds alternate white, limestone,
 * and the navy gradient, and that alternation is what gives a page its rhythm.
 */

export type SectionTone = "white" | "sunk" | "navy" | "deep";

const SECTION_BG: Record<SectionTone, string> = {
  white: "bg-white",
  sunk: "bg-limestone",
  navy: "bg-gradient-to-b from-slate to-slate-deep text-slate-fg",
  deep: "bg-slate-deep text-slate-fg",
};

export function Section({
  id,
  tone = "white",
  className = "",
  children,
}: {
  id?: string;
  tone?: SectionTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`${SECTION_BG[tone]} ${className}`}>
      <Container>
        <div className="py-[clamp(48px,7vw,88px)]">{children}</div>
      </Container>
    </section>
  );
}

/**
 * The shared section heading.
 *
 * `level` is a prop because a section heading is an h2 on most pages and an h3
 * inside a two level page, and getting that wrong is an accessibility finding
 * rather than a style one.
 *
 * `text-slate-fg` on the dark branch is explicit and must stay. globals.css sets
 * a colour on h1 through h4 at the base layer, and a declaration on the element
 * beats an inherited one, so a heading on a dark band that relies on inheriting
 * from its section renders navy on navy. That shipped once already.
 */
export function SectionHead({
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
    <div className={className}>
      {eyebrow ? (
        <p
          className={`text-[12px] font-bold tracking-[0.14em] uppercase ${
            onDark ? "text-brass-light" : "text-brass-ink"
          }`}
        >
          {eyebrow}
        </p>
      ) : null}
      <Heading
        className={`${eyebrow ? "mt-3" : ""} font-display text-[clamp(28px,3.6vw,38px)] leading-[1.15] font-bold tracking-[-0.01em] ${
          onDark ? "text-slate-fg" : "text-slate"
        }`}
      >
        {title}
      </Heading>
      {/*
        A paragraph, not a div, and this is not cosmetic.

        link-map counts a contextual link only inside p, li, or dd, so a link
        written into a section lede rendered as a div is invisible to the one
        measurement the linking pass is judged by. That already happened once:
        adding three links moved the count by two.

        image-contrast-audit then lost the how it works lede for the same reason,
        because its selector is h2 + p. Two audits disagreeing with the page over
        what a paragraph is, from one wrapper element.

        Nothing passed as a lede anywhere on this site contains block markup, so
        a p is valid at every call site.
      */}
      {lede ? (
        <p
          className={`mt-3 max-w-[62ch] text-[16px] leading-[1.7] ${
            onDark ? "text-slate-fg-muted" : "text-slate-muted"
          }`}
        >
          {lede}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The card chrome, as one string rather than as a component.
 *
 * A component would have to accept `<li>`, `<a>`, `<div>`, and `<article>`,
 * because the same treatment is a grid cell on the services hub, a link on the
 * coverage hub, and a static panel on the government page. A class string
 * composes with all of them and cannot quietly become the wrong element.
 */
export const CARD =
  "rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white";

/** The same card, as a link that lifts. */
export const CARD_LINK = `group block h-full ${CARD} transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_10px_24px_rgba(20,49,93,0.14)]`;

/** The navy square an icon sits in. 46px on cards, 52px on the larger panels. */
export function IconTile({
  children,
  size = 46,
  onDark = false,
}: {
  children: ReactNode;
  size?: number;
  onDark?: boolean;
}) {
  return (
    <span
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-[4px] ${
        onDark ? "bg-white/12 text-brass-light" : "bg-slate text-slate-fg"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * The aside v5 sets beside a heading: a gold bar on the leading edge, a tracked
 * label, a bold line, and the explanation.
 *
 * The values are lifted verbatim from the coverage note on the approved
 * homepage, so adopting this component there is a refactor with no rendered
 * difference. That matters: the homepage is signed off, and a shared component
 * that quietly restyles it would put an approved surface back in review.
 */
export function Callout({
  label,
  title,
  children,
  onDark = false,
  className = "",
}: {
  label?: string;
  title?: string;
  children?: ReactNode;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`border-l-4 border-brass px-5 py-[18px] ${
        onDark ? "bg-white/[0.07]" : "bg-limestone"
      } ${className}`}
    >
      {label ? (
        <p
          className={`text-[12px] font-bold tracking-[0.1em] uppercase ${
            onDark ? "text-brass-light" : "text-slate-muted"
          }`}
        >
          {label}
        </p>
      ) : null}
      {title ? (
        <p
          className={`${label ? "mt-1.5" : ""} font-display text-[22px] font-bold ${
            onDark ? "text-slate-fg" : "text-slate"
          }`}
        >
          {title}
        </p>
      ) : null}
      {children ? (
        <div
          className={`${title || label ? "mt-2" : ""} text-[14px] leading-[1.6] ${
            onDark ? "text-slate-fg-muted" : "text-slate-muted"
          }`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The stat rail under the hero band.
 *
 * The figure is a `dd` and the label is the visible half of it, with the `dt`
 * carrying the same words for a screen reader. A bare number in a definition
 * list with no term is a row that announces as nothing.
 */
export function StatRail({
  stats,
  onDark = true,
  className = "",
}: {
  stats: { figure: ReactNode; label: string }[];
  onDark?: boolean;
  className?: string;
}) {
  return (
    <dl className={`flex flex-wrap gap-x-[clamp(28px,6vw,88px)] gap-y-6 ${className}`}>
      {stats.map((s) => (
        <div key={s.label} className="flex items-baseline gap-3">
          <dt className="sr-only">{s.label}</dt>
          <dd className="flex items-baseline gap-3">
            <span
              className={`font-display text-[clamp(28px,3vw,36px)] leading-none font-extrabold tabular-nums ${
                onDark ? "text-slate-fg" : "text-slate"
              }`}
            >
              {s.figure}
            </span>
            <span
              className={`text-[14px] font-semibold ${onDark ? "text-slate-fg-dim" : "text-slate-muted"}`}
            >
              {s.label}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
