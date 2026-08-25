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
 * Every interior page on the site already renders this, with the same four
 * props. Converting it in place propagates the navy direction to services,
 * coverage, government, careers, insights, contact, and both detail templates
 * without touching a single call site. A parallel PageMasthead would have meant
 * editing a dozen pages to say the same thing a different way, and would have
 * left two components that drift.
 *
 * The API is unchanged apart from one optional prop.
 *
 * THE IMAGE IS OPTIONAL AND MOST PAGES DO NOT HAVE ONE
 * ----------------------------------------------------
 * The library is six photographs against seventeen candidate surfaces, and
 * src/content/photos.ts only maps the ones where a genuine match exists. So the
 * no-image masthead is the DEFAULT and it is a finished design: navy, gold rule,
 * display heading. It is not a placeholder waiting for art, and nothing about it
 * should look like a hole.
 *
 * Where an image does exist it uses the construction proven on the homepage
 * hero: its own panel, nothing legible on it, type on solid navy beside it. The
 * type never sits over the photograph, so contrast here is a fixed number rather
 * than a function of what happens to be in the picture.
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
    <section className="relative isolate bg-slate-ink">
      <Container>
        <div className="grid items-stretch gap-0 lg:grid-cols-12">
          <div
            className={`py-12 sm:py-16 ${image ? "lg:col-span-7 lg:py-24 lg:pr-14" : "lg:col-span-9 lg:py-24"}`}
          >
            <Breadcrumbs crumbs={crumbs} onDark />

            <div className="mt-10 max-w-3xl">
              {eyebrow ? (
                <p className="font-sans text-[0.72rem] font-semibold tracking-[0.22em] text-brass-light uppercase">
                  {eyebrow}
                </p>
              ) : null}
              <span aria-hidden="true" className="mt-6 block h-px w-20 bg-brass" />
              <h1 className="mt-8 font-display text-[2.15rem] leading-[1.08] font-bold tracking-[-0.015em] text-slate-fg sm:text-[2.9rem]">
                {title}
              </h1>
              {lede ? (
                <div className="mt-7 text-[1.05rem] leading-[1.7] text-slate-fg-muted">{lede}</div>
              ) : null}
            </div>

            {children ? <div className="mt-9 max-w-3xl">{children}</div> : null}
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
                  className="absolute inset-0 bg-slate-ink/30 mix-blend-multiply"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 hidden w-24 bg-gradient-to-r from-slate-ink to-transparent lg:block"
                />
              </div>
            </div>
          ) : null}
        </div>
      </Container>

      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-brass/60" />
    </section>
  );
}
