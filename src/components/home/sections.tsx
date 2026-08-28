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

const CREDIBILITY = [
  { icon: StarIcon, label: "Veteran owned" },
  { icon: ShieldCheckIcon, label: "Licensed Texas Professional Engineers in responsible charge" },
  { icon: PinIcon, label: "Serving all 254 Texas counties" },
  { icon: BuildingIcon, label: "SAM registered for government contracting" },
] as const;

export function CredibilityStrip({ samRegistered }: { samRegistered: boolean }) {
  // The SAM claim is a credential and is gated, not printed. See the note in
  // SiteFooter for why.
  const items = CREDIBILITY.filter((c) => samRegistered || !c.label.startsWith("SAM"));

  return (
    <section className="border-b border-[#e5e8ec] bg-white">
      <Container>
        <div className="grid gap-5 py-[clamp(24px,4vw,36px)] sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-8">
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
