import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/primitives";
import { modelSentence } from "@/content/model-copy";

/**
 * The homepage hero.
 *
 * THE SIGNATURE IS THE NUMERAL
 * ----------------------------
 * The firm is named for the 254 counties of Texas. That number is the one thing
 * about this brand no competitor can copy and no template arrives with, so it is
 * the element the page is built around rather than a statistic tucked into a
 * sidebar, which is where the previous version put it.
 *
 * It is set enormous, in the display face, at low opacity, bleeding off the
 * right edge. It reads as a watermark rather than a headline, which is the point:
 * the eye lands on the sentence and then notices what it is sitting on.
 *
 * It carries `aria-hidden` because the number is already in the H1 and in the
 * stats below it. A screen reader announcing "two hundred and fifty four" three
 * times is not accessibility.
 *
 * WHY THE PHOTOGRAPH SITS ON THE NAVY RATHER THAN UNDER A SCRIM
 * -------------------------------------------------------------
 * The obvious construction is the image at full strength with a dark gradient
 * over it. It looks better in isolation and it is a contrast liability: the
 * effective background behind any given word depends on what is in the
 * photograph at that point, so a text colour that passes AA over the storm cloud
 * can fail over the bright horizon, and swapping the photograph silently changes
 * the result.
 *
 * So the navy is the background, the photograph sits on top at low opacity, and
 * the effective background never strays far from #0c1f3d. Off white text on it
 * measures better than 12:1 everywhere in the band. The image is atmosphere; the
 * navy is what the type is actually on.
 *
 * PERFORMANCE
 * -----------
 * `priority` preloads it, because this is the LCP element on the site's most
 * important route. `sizes="100vw"` because it is full bleed at every width, and
 * the explicit fill plus object-cover means no layout shift while it loads.
 */
export function HomeHero() {
  return (
    <section className="relative isolate overflow-hidden bg-slate-ink">
      <Image
        src="/photos/plains-storm-sky.jpg"
        alt="An open plain under a heavy grey storm sky."
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-[0.30]"
      />
      {/* Deepens the left side so the type always has the darkest ground under
          it, and keeps the horizon from competing with the buttons. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-slate-ink via-slate-ink/85 to-slate-ink/45"
      />

      {/* The numeral. Clipped by the section, deliberately: a number that runs
          off the edge reads as bigger than the screen, which is the impression
          wanted. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -bottom-14 font-display text-[13rem] leading-none font-bold text-brass-light/[0.10] select-none sm:-right-10 sm:text-[22rem] lg:-right-16 lg:-bottom-24 lg:text-[32rem]"
      >
        254
      </span>

      <Container className="relative">
        <div className="grid gap-14 py-20 sm:py-28 lg:grid-cols-12 lg:gap-16 lg:py-36">
          <div className="lg:col-span-7">
            <p className="font-sans text-[0.72rem] font-semibold tracking-[0.22em] text-brass-light uppercase">
              Veteran owned. Statewide.
            </p>
            <span aria-hidden="true" className="mt-6 block h-px w-20 bg-brass" />

            <h1 className="mt-8 font-display text-[2.6rem] leading-[1.02] font-bold tracking-[-0.02em] text-slate-fg sm:text-[3.9rem] lg:text-[4.6rem]">
              Engineering for
              <br />
              every county
              <br />
              <span className="text-brass-light">in Texas.</span>
            </h1>

            <p className="mt-9 max-w-xl text-[1.08rem] leading-[1.7] text-slate-fg-muted">
              Inspections, sealed letters, certifications, and design, built to one standard from the
              Panhandle to the Rio Grande Valley. {modelSentence()}
            </p>

            <div className="mt-11 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/services" tone="onDark">
                See the service lines
              </ButtonLink>
              <ButtonLink href="/coverage" tone="onDarkOutline">
                Coverage across Texas
              </ButtonLink>
            </div>
          </div>

          <div className="lg:col-span-5 lg:pl-10">
            <dl className="grid grid-cols-3 gap-6 border-t border-slate-fg/20 pt-8 lg:grid-cols-1 lg:gap-9 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12">
              <HeroFigure figure="254" label="Texas counties" />
              <HeroFigure figure="8" label="Coverage regions" />
              <HeroFigure figure="1" label="Standard, statewide" />
            </dl>
          </div>
        </div>
      </Container>
    </section>
  );
}

/**
 * A hero figure.
 *
 * `tabular-nums` so 254 and 8 and 1 sit on the same rhythm rather than drifting,
 * which is visible when three of them are stacked.
 */
function HeroFigure({ figure, label }: { figure: string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="block font-display text-[2.4rem] leading-none font-bold tabular-nums text-brass-light lg:text-[3.1rem]">
          {figure}
        </span>
        <span className="mt-3 block font-sans text-[0.78rem] leading-[1.4] font-medium tracking-[0.1em] text-slate-fg-muted uppercase">
          {label}
        </span>
      </dd>
    </div>
  );
}
