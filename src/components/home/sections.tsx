import { Container } from "@/components/ui/Container";
import { IconTile } from "@/components/ui/section";
import {
  BuildingIcon,
  ClipboardCheckIcon,
  ClockIcon,
  PinIcon,
  ShieldCheckIcon,
  StarIcon,
} from "@/components/ui/icons";

/**
 * The homepage sections, as the approved v5 design composes them.
 *
 * Kept out of page.tsx so that file reads as an outline of the page rather than
 * as two thousand lines of markup. Every one of these is presentation: the copy,
 * the data, and the routes all come from the existing content modules.
 *
 * THE SECTION GRAMMAR LIVES IN ui/section.tsx
 * -------------------------------------------
 * `Section`, `SectionHead`, `Callout`, `IconTile`, `StatRail`, and the card
 * chrome were built here for the homepage and moved once the rest of the site
 * adopted them. What stays in this file is what only the homepage does.
 */

/* ------------------------------------------------------------------ credibility */

/*
 * TWO OF THESE FOUR CAME OUT ON 2026-09-17, AND ONLY ONE OF THEM WAS FALSE.
 *
 * "SAM registered for government contracting" claimed a federal registration
 * the firm has never held. "Veteran owned" is true and came out anyway, because
 * an icon tile in a credibility strip is read as a credential, and the ruling is
 * that only a credential the register holds may take that shape. It is now a
 * sentence in prose, where it says the same true thing without borrowing the
 * authority of the row it was sitting in.
 *
 * The two that remain are both checkable: the registration is F-29811 on the
 * board's record, and the coverage claim is asserted by `coverage-audit` against
 * an independent list of all 254 counties.
 */
const CREDIBILITY = [
  { icon: ShieldCheckIcon, label: "Licensed Texas Professional Engineers in responsible charge" },
  { icon: PinIcon, label: "Serving all 254 Texas counties" },
] as const;

export function CredibilityStrip() {
  const items = CREDIBILITY;

  return (
    <section className="border-b border-[#e5e8ec] bg-white">
      <Container>
        {/* Two columns rather than four, because two claims survived the
            credential ruling and a four column grid with two items in it reads
            as a row that lost something. */}
        <div className="grid gap-5 py-[clamp(24px,4vw,36px)] sm:grid-cols-2 lg:gap-x-8">
          {items.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3.5">
              <Icon size={34} className="shrink-0 text-slate" />
              <span className="text-[15px] leading-[1.45] font-semibold text-ink">{label}</span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ how it works */

/**
 * One step of the model.
 *
 * v5 renders these as a selectable list beside a detail panel that auto advances
 * every five seconds. The auto advance is not carried over: it moves content
 * without the reader asking and fights a screen reader. What is carried over is
 * the panel treatment itself, the oversized ghost numeral behind the copy, which
 * is applied to all three at once instead of one at a time.
 *
 * The result needs no client state, which is the right outcome for three
 * paragraphs that never change.
 */
export function ProcessStep({
  n,
  title,
  body,
  icon: Icon,
}: {
  n: string;
  title: string;
  body: string;
  icon: typeof ClipboardCheckIcon;
}) {
  return (
    /* basis, not bare flex-1.
       `flex-1` is `flex: 1 1 0%`, so three of these in a wrapping row have a
       zero basis, never reach the wrap threshold, and hold three columns at any
       width. At 390 that rendered about 90 pixels per card, one word per line,
       with the longest words clipped at the card edge. mobile-audit was green
       throughout because the overflow is inside the card rather than on the
       document, so nothing horizontal scrolled. */
    <div className="relative flex flex-1 basis-[260px] flex-col overflow-hidden rounded-[4px] bg-white p-[clamp(24px,3vw,34px)]">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[38px] right-2 font-display text-[150px] leading-none font-extrabold text-limestone-sunk select-none"
      >
        {n}
      </span>
      <div className="relative">
        <IconTile size={52}>
          <Icon size={26} />
        </IconTile>
        <p className="mt-4 text-[12px] font-bold tracking-[0.12em] text-brass-ink uppercase">
          Step {n} of 3
        </p>
        <h3 className="mt-2 font-display text-[clamp(21px,2.4vw,26px)] leading-[1.2] font-bold text-slate">
          {title}
        </h3>
        <p className="mt-3 max-w-[52ch] text-[15.5px] leading-[1.75] text-slate-muted">{body}</p>
      </div>
    </div>
  );
}

export { ClipboardCheckIcon, ClockIcon, ShieldCheckIcon, StarIcon, BuildingIcon };
