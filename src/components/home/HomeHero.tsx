import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/primitives";
import { CountUp } from "@/components/motion/CountUp";
import { modelSentence } from "@/content/model-copy";

/**
 * The homepage hero, cinematic.
 *
 * WHAT CHANGED FROM THE SPLIT PANEL, AND WHY IT IS SAFE NOW
 * ---------------------------------------------------------
 * The previous hero put the type on solid navy and the photograph in its own
 * panel beside it, because a photograph cannot be both visible behind a headline
 * and guaranteed not to affect that headline's contrast. That was the right call
 * at the time and it was a compromise: the picture never got to be large.
 *
 * What removes the compromise is not a better gradient, it is a measurement.
 * scripts/image-contrast-audit.mjs samples the rendered pixels underneath every
 * line of type in this band and compares against the worst one. So the type can
 * now cross the picture, and whether it is legible is a number this repo checks
 * on every run rather than a thing somebody eyeballed once.
 *
 * The photograph is full bleed and tall. The scrim is a two axis gradient tuned
 * so the lower left, where the type lives, stays deep while the upper right,
 * where the storm is, stays open.
 *
 * THE NUMERAL IS A MONUMENT
 * -------------------------
 * 254 is set at the largest size on the site, in gold, bleeding off the bottom
 * and the right, and it deliberately crosses the boundary between the photograph
 * and the navy below it. It is the one element permitted to break the grid this
 * hard, and it is legible enough to be structure rather than watermark, which is
 * what separates this from the ghosted version that was cut for measuring 1.13:1.
 *
 * It carries `aria-hidden` because the number is already the subject of the H1
 * and the first figure below it.
 *
 * PERFORMANCE
 * -----------
 * `priority` preloads the image: it is the LCP element on the most important
 * route. Nothing in this band fades in on load. The reveals elsewhere on the page
 * are scroll driven and this is above the fold, so animating it would delay the
 * paint it is supposed to be.
 */
export function HomeHero() {
  return (
    <section className="relative isolate flex min-h-[38rem] flex-col justify-end overflow-hidden bg-slate-ink sm:min-h-[44rem] lg:min-h-[92vh]">
      <Image
        src="/photos/plains-storm-sky.jpg"
        alt="An open plain under a heavy grey storm sky."
        fill
        priority
        sizes="100vw"
        className="object-cover object-[55%_42%]"
      />

      {/* Two axis scrim. Deep at the bottom left under the type, open at the top
          right where the storm is. Every value here is answerable to
          image-contrast-audit rather than to taste. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-slate-ink via-slate-ink/75 to-slate-ink/20"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-slate-ink/90 via-slate-ink/35 to-transparent"
      />
      {/*
       * A third scrim, over the type column only.
       *
       * The two above are frame wide and they left the eyebrow at 2.55:1, because
       * the eyebrow sits high in the frame where the vertical gradient is thin and
       * the brightest cloud in the photograph happens to be behind it.
       * image-contrast-audit found that; nobody would have seen it by looking.
       *
       * Darkening the whole frame would have fixed the number and cost the picture
       * the openness the bold direction is for. This one is anchored left and dies
       * out well before the storm, so the type gets its ground and the sky keeps
       * its drama.
       */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-slate-ink via-slate-ink/75 to-transparent lg:w-[68%]"
      />

      {/* The monument. Crosses out of the photograph and off two edges. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-[0.08em] -bottom-[0.22em] font-display text-[9rem] leading-[0.75] font-bold tracking-[-0.04em] text-brass/25 select-none sm:text-[16rem] lg:text-[26rem] xl:text-[32rem]"
      >
        254
      </span>

      <Container className="relative">
        <div className="max-w-4xl pt-28 pb-16 sm:pt-36 sm:pb-20 lg:pb-24">
          <p className="font-sans text-[0.72rem] font-semibold tracking-[0.26em] text-brass-light uppercase">
            Veteran owned. Statewide.
          </p>
          <span aria-hidden="true" className="mt-6 block h-px w-24 bg-brass" />

          <h1 className="mt-9 font-display text-[3rem] leading-[0.94] font-bold tracking-[-0.03em] text-slate-fg sm:text-[4.6rem] lg:text-[6.4rem]">
            Engineering
            <br />
            for every county
            <br />
            <span className="text-brass-light">in Texas.</span>
          </h1>

          <p className="mt-10 max-w-lg text-[1.06rem] leading-[1.7] text-slate-fg-muted">
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
      </Container>

      {/* The figure rail, sitting on the gold rule that closes the band. */}
      <div className="relative border-t border-brass/40 bg-slate-ink/70 backdrop-blur-[2px]">
        <Container>
          <dl className="grid grid-cols-3 divide-x divide-slate-fg/15">
            <HeroFigure figure={254} label="Texas counties" />
            <HeroFigure figure={8} label="Coverage regions" />
            <HeroFigure figure={1} label="Standard, statewide" />
          </dl>
        </Container>
      </div>
    </section>
  );
}

function HeroFigure({ figure, label }: { figure: number; label: string }) {
  return (
    <div className="px-1 py-6 first:pr-4 last:pl-4 sm:px-6 sm:py-8 first:sm:pl-0 last:sm:pr-0">
      <dt className="sr-only">{label}</dt>
      <dd>
        <CountUp
          value={figure}
          className="block font-display text-[2rem] leading-none font-bold tabular-nums text-brass-light sm:text-[3rem]"
        />
        <span className="mt-3 block font-sans text-[0.66rem] leading-[1.4] font-medium tracking-[0.12em] text-slate-fg-muted uppercase sm:text-[0.72rem]">
          {label}
        </span>
      </dd>
    </div>
  );
}
