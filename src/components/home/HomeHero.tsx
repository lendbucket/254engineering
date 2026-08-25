import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/primitives";
import { modelSentence } from "@/content/model-copy";

/**
 * The homepage hero.
 *
 * THE SIGNATURE IS THE NUMERAL, AND IT IS NOT IN THIS COMPONENT
 * -------------------------------------------------------------
 * The firm is named for the 254 counties of Texas. That number is the one thing
 * about this brand no competitor can copy and no template arrives with, so it is
 * the element the page is built around rather than a statistic tucked into a
 * sidebar, which is where the previous version put it.
 *
 * It is NOT in this component, and it was. A ghosted 254 sat behind the type
 * panel at 7 percent opacity, and contrast-audit was right to fail it.
 * aria-hidden keeps a decoration out of the accessibility tree, but a sighted
 * reader still sees it, so an automated check treats it as text and measured it
 * at 1.13:1. Raising it to clear 3:1 would have turned a watermark into a shout.
 *
 * It was cut rather than exempted. The number already appears three times in
 * this band: in the wordmark, in the subject of the headline, and in the first
 * figure. The genuinely oversized treatment lives one section down, where it
 * sits on limestone at 11.67:1 and needs no apology. The signature survived. The
 * redundant ghost did not.
 *
 * THE PHOTOGRAPH GETS ITS OWN PANEL, AND THAT IS THE WHOLE ARGUMENT
 * -----------------------------------------------------------------
 * Two versions of this hero put the photograph behind the type. The first had it
 * at 0.30 under a heavy gradient and the band read as flat navy: the picture was
 * paying no rent at all. The second raised it to 0.55 with a weighted scrim,
 * which was better and still not a photograph, because the scrim had to stay
 * near opaque exactly where the headline was.
 *
 * That is not a tuning problem, it is a contradiction. A photograph cannot be
 * both clearly visible behind a headline and guaranteed not to affect that
 * headline's contrast, because they are the same pixels. Every value that made
 * the picture legible made the type worse.
 *
 * So they stop sharing pixels. The type sits on solid navy and its contrast is a
 * fixed, checkable number. The photograph occupies its own panel at full
 * strength, where it is finally a photograph rather than an atmosphere, and
 * nothing legible sits on it. Both halves get to be good at their own job, which
 * is what the split was for.
 *
 * PERFORMANCE
 * -----------
 * `priority` preloads it: it is the LCP element on the site's most important
 * route. `sizes` describes the real layout, a full width band on mobile and half
 * the viewport on desktop, so the browser never fetches the 2400px original to
 * fill a 390px band. The panel has an explicit minimum height at every
 * breakpoint, so there is no layout shift while it loads.
 */
export function HomeHero() {
  return (
    <section className="relative isolate bg-slate-ink">
      <Container>
        <div className="grid items-stretch gap-0 lg:grid-cols-12">
          {/* The type panel. Solid navy, no image beneath it, so contrast here is
              a fixed number rather than a function of the photograph. */}
          <div className="relative overflow-hidden py-20 sm:py-24 lg:col-span-7 lg:py-36 lg:pr-16">
            <div className="relative">
              <p className="font-sans text-[0.72rem] font-semibold tracking-[0.22em] text-brass-light uppercase">
                Veteran owned. Statewide.
              </p>
              <span aria-hidden="true" className="mt-6 block h-px w-20 bg-brass" />

              <h1 className="mt-8 font-display text-[2.6rem] leading-[1.02] font-bold tracking-[-0.02em] text-slate-fg sm:text-[3.9rem] lg:text-[4.4rem]">
                Engineering for
                <br />
                every county
                <br />
                <span className="text-brass-light">in Texas.</span>
              </h1>

              <p className="mt-9 max-w-xl text-[1.08rem] leading-[1.7] text-slate-fg-muted">
                Inspections, sealed letters, certifications, and design, built to one standard from
                the Panhandle to the Rio Grande Valley. {modelSentence()}
              </p>

              <div className="mt-11 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/services" tone="onDark">
                  See the service lines
                </ButtonLink>
                <ButtonLink href="/coverage" tone="onDarkOutline">
                  Coverage across Texas
                </ButtonLink>
              </div>

              <dl className="mt-14 grid grid-cols-3 gap-6 border-t border-slate-fg/20 pt-8 lg:mt-16 lg:gap-8">
                <HeroFigure figure="254" label="Texas counties" />
                <HeroFigure figure="8" label="Coverage regions" />
                <HeroFigure figure="1" label="Standard, statewide" />
              </dl>
            </div>
          </div>

          {/* The photograph. Its own panel, full strength, nothing legible on it.
              It bleeds past the container to the viewport edge, which is what
              stops it reading as an inset picture sitting in a box. */}
          <div className="relative min-h-[15rem] sm:min-h-[20rem] lg:col-span-5 lg:min-h-0">
            <div className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 lg:left-0 lg:w-[50vw] lg:translate-x-0">
              <Image
                src="/photos/plains-storm-sky.jpg"
                alt="An open plain under a heavy grey storm sky."
                fill
                priority
                sizes="(max-width: 1023px) 100vw, 50vw"
                /* The panel is tall and narrow on desktop, so the crop matters. Centred
                   on the cloud alone it reads as abstract weather; pulled down to
                   the horizon it reads as land under sky, which is the scale the
                   band is trying to convey. */
                className="object-cover object-[50%_62%]"
              />
              {/* A restrained navy wash so the photograph belongs to the palette
                  rather than sitting beside it. Nothing legible is on it, so this
                  is a colour decision and not a contrast one. */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-slate-ink/30 mix-blend-multiply"
              />
              {/* Softens the seam where the panel meets the type, so the split
                  reads as one band rather than two boxes. Desktop only: on mobile
                  the photograph is a full width band and has no seam. */}
              <div
                aria-hidden="true"
                className="absolute inset-y-0 left-0 hidden w-24 bg-gradient-to-r from-slate-ink to-transparent lg:block"
              />
            </div>
          </div>
        </div>
      </Container>

      {/* The gold rule that closes the band. */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-brass/60" />
    </section>
  );
}

/**
 * A hero figure.
 *
 * `tabular-nums` so 254, 8, and 1 sit on the same rhythm rather than drifting,
 * which is visible when three of them are in a row.
 */
function HeroFigure({ figure, label }: { figure: string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="block font-display text-[2.1rem] leading-none font-bold tabular-nums text-brass-light lg:text-[2.6rem]">
          {figure}
        </span>
        <span className="mt-3 block font-sans text-[0.72rem] leading-[1.4] font-medium tracking-[0.1em] text-slate-fg-muted uppercase">
          {label}
        </span>
      </dd>
    </div>
  );
}
