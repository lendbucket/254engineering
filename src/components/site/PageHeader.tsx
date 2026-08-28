import Image from "next/image";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "./Breadcrumbs";
import type { Crumb } from "@/lib/schema";
import type { SurfacePhoto } from "@/content/photos";

/**
 * The masthead every page below the homepage carries.
 *
 * WHY THIS COMPONENT CHANGED RATHER THAN A NEW ONE ARRIVING
 * ---------------------------------------------------------
 * Every interior page already renders this with the same props. Converting it
 * in place propagates the approved v5 language to services, coverage,
 * government, careers, insights, contact, and both detail templates without
 * touching a single call site. A parallel component would have meant editing a
 * dozen pages to say the same thing a different way, and would have left two
 * mastheads that drift.
 *
 * WHAT v5 SETS HERE
 * -----------------
 * v5 is a single landing page and has no interior masthead, so this is derived
 * from its hero rather than copied from a section of it: the same three stop
 * navy gradient, the same Archivo heading with -0.015em tracking, the same gold
 * eyebrow at 12px and 0.14em, and the same hairline closing the band. The
 * heading steps down from the hero's `clamp(34px, 5vw, 56px)` to
 * `clamp(30px, 4.2vw, 46px)`, because an interior page is one level down and
 * the type scale should say so.
 *
 * `text-slate-fg` on the h1 is explicit and must stay. globals.css sets a colour
 * on h1 through h4 at the base layer, and a declaration on the element beats an
 * inherited one, so a heading on a dark band that relies on inheritance renders
 * navy on navy. That shipped once already, on the homepage hero.
 *
 * THE IMAGE IS OPTIONAL AND MOST PAGES DO NOT HAVE ONE
 * ----------------------------------------------------
 * The library is six photographs against seventeen candidate surfaces, and
 * src/content/photos.ts only maps the ones where a genuine match exists. So the
 * no-image masthead is the DEFAULT and it is a finished design. It is not a
 * placeholder waiting for art, and nothing about it should look like a hole.
 *
 * Where an image does exist, it gets its own panel and nothing legible sits on
 * it. The type never overlaps the photograph, so contrast here is a fixed number
 * rather than a function of what happens to be in the picture.
 *
 * The H1 is set here and nowhere else on these pages, which is what keeps the
 * rule that each page has exactly one and that it leads with the page's primary
 * keyword.
 */
export function PageHeader({
  eyebrow,
  title,
  lede,
  crumbs,
  image,
  children,
}: {
  eyebrow?: string;
  title: string;
  lede?: ReactNode;
  crumbs: Crumb[];
  /** Only where a genuinely fitting photograph exists. Absent is the norm. */
  image?: SurfacePhoto;
  /** Anything that belongs directly under the lede, such as the prelaunch notice. */
  children?: ReactNode;
}) {
  return (
    <section className="relative isolate bg-gradient-to-b from-slate via-slate-deep to-slate-abyss">
      <Container>
        <div className="grid items-stretch gap-0 lg:grid-cols-12">
          <div
            className={`py-[clamp(34px,5vw,64px)] ${image ? "lg:col-span-7 lg:pr-14" : "lg:col-span-9"}`}
          >
            <Breadcrumbs crumbs={crumbs} onDark />

            <div className="mt-8 max-w-3xl">
              {eyebrow ? (
                <p className="text-[12px] font-bold tracking-[0.14em] text-brass-light uppercase">
                  {eyebrow}
                </p>
              ) : null}
              <h1
                className={`${eyebrow ? "mt-3" : ""} font-display text-[clamp(30px,4.2vw,46px)] leading-[1.12] font-bold tracking-[-0.015em] text-slate-fg`}
              >
                {title}
              </h1>
              {/* A paragraph, not a div. See the note in ui/section.tsx: two
                  audits and the link map all define a paragraph by its tag. */}
              {lede ? (
                <p className="mt-[18px] max-w-[62ch] text-[clamp(15.5px,1.7vw,17.5px)] leading-[1.7] text-slate-fg-muted">
                  {lede}
                </p>
              ) : null}
            </div>

            {children ? <div className="mt-8 max-w-3xl">{children}</div> : null}
          </div>

          {image ? (
            <div className="relative min-h-[13rem] sm:min-h-[17rem] lg:col-span-5 lg:min-h-0">
              <div className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 lg:left-0 lg:w-[50vw] lg:translate-x-0">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes="(max-width: 1023px) 100vw, 50vw"
                  className="object-cover object-[50%_55%]"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-slate-abyss/30 mix-blend-multiply"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 hidden w-24 bg-gradient-to-r from-slate-deep to-transparent lg:block"
                />
              </div>
            </div>
          ) : null}
        </div>
      </Container>

      {/* The hairline v5 closes every dark band with. */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-white/[0.16]" />
    </section>
  );
}
