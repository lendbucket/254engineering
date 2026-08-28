import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import {
  BuildingIcon,
  ClipboardCheckIcon,
  ClockIcon,
  DesignIcon,
  ForensicIcon,
  FoundationIcon,
  ManufacturedHomeIcon,
  PinIcon,
  RoofIcon,
  SealedLetterIcon,
  ShieldCheckIcon,
  SolarIcon,
  SpecIcon,
  StarIcon,
  WindIcon,
} from "@/components/ui/icons";

/**
 * The homepage sections, as the approved v5 design composes them.
 *
 * Kept out of page.tsx so that file reads as an outline of the page rather than
 * as two thousand lines of markup. Every one of these is presentation: the copy,
 * the data, and the routes all come from the existing content modules.
 *
 * THE SECTION GRAMMAR, WHICH v5 APPLIES WITHOUT EXCEPTION
 * ------------------------------------------------------
 * Vertical padding `clamp(48px, 7vw, 88px)`. An Archivo 700 heading at
 * `clamp(28px, 3.6vw, 38px)` with -0.01em tracking. A 16px lede at 1.7 line
 * height capped at 62 characters. Cards at 4px radius with a 1px border and a
 * 3px top border, lifting 3px on hover.
 *
 * Backgrounds alternate white, `#F4F5F7`, and the navy gradient, which is what
 * gives the page its rhythm.
 */

/** The shared section heading, so the grammar above cannot drift per section. */
export function SectionHead({
  title,
  lede,
  onDark = false,
}: {
  title: string;
  lede?: string;
  onDark?: boolean;
}) {
  return (
    <div>
      <h2
        className={`font-display text-[clamp(28px,3.6vw,38px)] leading-[1.15] font-bold tracking-[-0.01em] ${
          onDark ? "text-slate-fg" : "text-slate"
        }`}
      >
        {title}
      </h2>
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

export function Section({
  id,
  tone = "white",
  className = "",
  children,
}: {
  id?: string;
  tone?: "white" | "sunk" | "navy" | "deep";
  className?: string;
  children: ReactNode;
}) {
  const bg =
    tone === "sunk"
      ? "bg-limestone"
      : tone === "navy"
        ? "bg-gradient-to-b from-slate to-slate-deep text-slate-fg"
        : tone === "deep"
          ? "bg-slate-deep text-slate-fg"
          : "bg-white";
  return (
    <section id={id} className={`${bg} ${className}`}>
      <Container>
        <div className="py-[clamp(48px,7vw,88px)]">{children}</div>
      </Container>
    </section>
  );
}

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

/* --------------------------------------------------------------------- services */

/**
 * Service slug to icon.
 *
 * The order is v5's, which is also the order of `src/content/services.ts`. A
 * slug with no entry falls back to the sealed letter mark rather than rendering
 * an empty tile, so adding a service line cannot leave a hole on the homepage.
 */
const SERVICE_ICONS: Record<string, typeof RoofIcon> = {
  "roof-inspections": RoofIcon,
  "windstorm-wpi-8": WindIcon,
  "foundation-inspections": FoundationIcon,
  "solar-structural-letters": SolarIcon,
  "manufactured-home-foundation-certifications": ManufacturedHomeIcon,
  "structural-letters": SealedLetterIcon,
  "repair-specifications": SpecIcon,
  "residential-light-commercial-design": DesignIcon,
  "forensic-engineering": ForensicIcon,
};

export function ServiceCard({
  slug,
  name,
  summary,
  tag,
}: {
  slug: string;
  name: string;
  summary: string;
  tag: string;
}) {
  const Icon = SERVICE_ICONS[slug] ?? SealedLetterIcon;
  return (
    <li className="h-full">
      <Link
        href={`/services/${slug}`}
        className="group flex h-full flex-col rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white p-6 transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_10px_24px_rgba(20,49,93,0.14)]"
      >
        <span className="flex items-center justify-between gap-3">
          <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[4px] bg-slate text-slate-fg">
            <Icon size={24} />
          </span>
          <span className="text-[11.5px] font-bold tracking-[0.1em] text-brass-ink uppercase">
            {tag}
          </span>
        </span>
        <span className="mt-4 font-display text-[17px] leading-[1.35] font-semibold text-slate">
          {name}
        </span>
        <span className="mt-2 flex-1 text-[14px] leading-[1.65] text-slate-muted">{summary}</span>
      </Link>
    </li>
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
        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[4px] bg-slate text-slate-fg">
          <Icon size={26} />
        </span>
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
