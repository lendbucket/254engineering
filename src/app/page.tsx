import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { CardGrid, cardCell, SectionHeading } from "@/components/ui/primitives";
import { OfferCta } from "@/components/launch/OfferCta";
import { HomeHero } from "@/components/home/HomeHero";
import { CredentialsStrip } from "@/components/site/CredentialsStrip";
import { TexasCountyMap } from "@/components/map/TexasCountyMap";
import { RegionKey } from "@/components/map/RegionKey";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { services } from "@/content/services";
import { business } from "@/config/business";
import { responsibleChargeCopy, specialistsCopy } from "@/content/model-copy";

/**
 * The homepage.
 *
 * THE RHYTHM IS THE DESIGN
 * ------------------------
 * Before this pass every section on this page sat on the same pale surface with
 * the same padding, which meant every section weighed the same, which meant the
 * page had no shape. That is most of why it read as a template: not a wrong
 * choice anywhere, an absence of choices everywhere.
 *
 * The page now alternates. Navy hero, light name, light services, NAVY COVERAGE,
 * light model, navy ownership, light credentials, navy call to action. A reader
 * scrolling it feels four distinct movements rather than one long column, and
 * the two navy bands land on the two things this firm actually wants remembered:
 * that it covers the whole state, and who owns it.
 *
 * THE MAP IS THE CENTREPIECE, NOT AN ILLUSTRATION
 * -----------------------------------------------
 * The 254 county map is the most distinctive asset the site owns. It is derived
 * from Census geometry, its region borders are computed from the same county
 * assignment the lists use, and no competitor has one. It gets the full width
 * navy band, gold region borders, and the largest type on the page after the
 * hero.
 */

export const metadata: Metadata = buildMetadata({
  title: "Texas Engineering Services Statewide | 254 Engineering",
  description:
    "A veteran owned Texas engineering firm named for the 254 counties of Texas, built to serve every one of them. See the service lines and the coverage map.",
  path: "/",
});

export default function HomePage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }])} />

      <HomeHero />

      {/* The name. The numeral is set as a display element rather than described
          in prose, because the number IS the argument being made. */}
      <section className="border-b border-limestone-line bg-limestone">
        <Container>
          <div className="grid gap-12 py-20 sm:py-24 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <p className="font-sans text-[0.72rem] font-semibold tracking-[0.22em] text-brass-ink uppercase">
                The name
              </p>
              <p
                aria-hidden="true"
                className="mt-6 font-display text-[6.5rem] leading-[0.85] font-bold tracking-[-0.03em] text-slate sm:text-[9rem] lg:text-[10.5rem]"
              >
                254
              </p>
              <span aria-hidden="true" className="mt-8 block h-px w-24 bg-brass" />
              <p className="mt-8 max-w-sm font-display text-[1.35rem] leading-[1.35] font-semibold text-slate sm:text-[1.5rem]">
                Texas has 254 counties, more than any other state, and they are not one place.
              </p>
            </div>

            <div className="lg:col-span-7 lg:pt-24">
              <p className="max-w-xl text-[1.06rem] leading-[1.8] text-slate-muted">
                A slab detail that is correct in Lubbock is wrong in Beaumont. A roof that passes
                inspection in Amarillo would not certify in Rockport. The soil, the wind, the frost
                depth, and the building official all change as you cross the state, and most firms
                answer that by working a metro and stopping at the county line.
              </p>
              <p className="mt-6 max-w-xl text-[1.06rem] leading-[1.8] text-slate-muted">
                This firm is named for the number because it took the opposite position: build the
                field protocols and the review process so that one standard can hold across all 254
                of them, and then serve every one. The number is the commitment, not the marketing.
              </p>
              <p className="mt-9">
                <Link
                  href="/about"
                  className="font-sans text-[0.96rem] font-semibold text-slate underline decoration-brass decoration-2 underline-offset-[6px] transition-colors hover:text-brass-ink"
                >
                  How the firm is built
                </Link>
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Services */}
      <section className="border-b border-limestone-line bg-limestone-sunk">
        <Container>
          <div className="py-20 sm:py-24">
            <SectionHeading
              eyebrow="Service lines"
              title="What this firm is built to deliver"
              lede="Nine service lines, each ending in a document somebody relies on: a lender, an insurer, a building official, or a court."
            />
            <CardGrid cols={3} className="mt-14">
              {services.map((s) => (
                <li key={s.slug} className={cardCell}>
                  <Link
                    href={`/services/${s.slug}`}
                    className="group flex h-full flex-col p-7 transition-colors hover:bg-limestone"
                  >
                    <span
                      aria-hidden="true"
                      className="block h-px w-8 bg-brass transition-all duration-200 group-hover:w-16"
                    />
                    <h3 className="mt-5 font-display text-[1.16rem] leading-[1.3] font-semibold text-slate">
                      {s.name}
                    </h3>
                    <p className="mt-3 flex-1 text-[0.94rem] leading-[1.68] text-slate-muted">
                      {s.summary}
                    </p>
                    <span className="mt-6 font-sans text-[0.78rem] font-semibold tracking-[0.12em] text-brass-ink uppercase">
                      Read more
                    </span>
                  </Link>
                </li>
              ))}
            </CardGrid>
          </div>
        </Container>
      </section>

      {/* Coverage. The band the page is built around. */}
      <section className="bg-slate-ink">
        <Container>
          <div className="py-20 sm:py-28">
            <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-7">
                <TexasCountyMap tone="dark" />
              </div>

              <div className="lg:col-span-5 lg:pt-6">
                <p className="font-sans text-[0.72rem] font-semibold tracking-[0.22em] text-brass-light uppercase">
                  Coverage
                </p>
                <span aria-hidden="true" className="mt-6 block h-px w-20 bg-brass" />
                <h2 className="mt-8 font-display text-[2.1rem] leading-[1.12] font-bold text-slate-fg sm:text-[2.6rem]">
                  Every county in Texas, grouped into eight regions
                </h2>
                <p className="mt-7 text-[1.02rem] leading-[1.75] text-slate-fg-muted">
                  The gold lines are the region borders. They are not drawn: they are the arcs where
                  the counties on either side belong to different regions, computed from the same
                  county assignment the lists are built from.
                </p>

                <RegionKey tone="dark" className="mt-10" />

                <p className="mt-9">
                  <Link
                    href="/coverage"
                    className="font-sans text-[0.96rem] font-semibold text-brass-light underline decoration-brass decoration-2 underline-offset-[6px] transition-colors hover:text-slate-fg"
                  >
                    See all 254 counties
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* The model. A genuine sequence, which is why it is numbered: evidence is
          gathered, then read, then reviewed. */}
      <section className="border-b border-limestone-line bg-limestone">
        <Container>
          <div className="py-20 sm:py-24">
            <SectionHeading
              eyebrow="The model"
              title="Standard field protocols, central engineering review"
              lede="Serving a state this size is an organizational problem before it is a technical one. The answer is to separate the two things that do not scale the same way."
            />
            <div className="mt-14 grid gap-12 sm:grid-cols-3 sm:gap-10">
              <ModelPoint
                index="01"
                title="Field work to a written protocol"
                body="Technicians across Texas work to the same documented inspection procedure, capture the same evidence in the same order, and are certified on that protocol before a first assignment. Consistency in the field is what makes central review possible."
              />
              <ModelPoint
                index="02"
                title="A licensed engineer in responsible charge"
                body={responsibleChargeCopy()}
              />
              <ModelPoint index="03" title="One review process, statewide" body={specialistsCopy()} />
            </div>
          </div>
        </Container>
      </section>

      {/* Ownership. The second navy band. */}
      <section className="bg-slate">
        <Container>
          <div className="grid gap-12 py-20 sm:py-24 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <p className="font-sans text-[0.72rem] font-semibold tracking-[0.22em] text-brass-light uppercase">
                Ownership
              </p>
              <span aria-hidden="true" className="mt-6 block h-px w-20 bg-brass" />
              <h2 className="mt-8 font-display text-[2rem] leading-[1.15] font-bold text-slate-fg sm:text-[2.4rem]">
                A veteran owned firm
              </h2>
            </div>
            <div className="lg:col-span-8 lg:pt-4">
              <p className="text-[1.04rem] leading-[1.8] text-slate-fg-muted">
                {business.name} is veteran owned. It shows up in the way the firm is organized more
                than in the way it is described: written procedures rather than individual habit,
                work that is checked by someone other than the person who did it, and a bias toward
                showing up where the work is rather than where it is convenient. Those are ordinary
                professional obligations. They are also the ones a state this size punishes a firm
                for treating loosely.
              </p>
              <p className="mt-6 text-[1.04rem] leading-[1.8] text-slate-fg-muted">
                For public sector buyers, the firm maintains its registrations and its capability
                statement on a dedicated page rather than asking a contracting officer to piece it
                together from a brochure.
              </p>
              <p className="mt-9">
                <Link
                  href="/government"
                  className="font-sans text-[0.96rem] font-semibold text-brass-light underline decoration-brass decoration-2 underline-offset-[6px] transition-colors hover:text-slate-fg"
                >
                  Government and public sector
                </Link>
              </p>
            </div>
          </div>
        </Container>
      </section>

      <CredentialsStrip />

      <OfferCta />
    </>
  );
}

/**
 * One step of the model.
 *
 * The numeral is set large and in the display face rather than as a small label,
 * because at 01 / 02 / 03 the number is the only thing carrying the fact that
 * these are ordered. Set small it reads as decoration; set large it reads as a
 * sequence.
 */
function ModelPoint({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <div>
      {/* brass-ink, not brass. Gold at #d19a1e measures 2.26:1 on the off white
          and is a rule colour there, never a text colour, however large. */}
      <span className="font-display text-[2.6rem] leading-none font-bold tabular-nums text-brass-ink">
        {index}
      </span>
      <span aria-hidden="true" className="mt-5 mb-6 block h-px w-full bg-limestone-line" />
      <h3 className="font-display text-[1.14rem] leading-[1.35] font-semibold text-slate">
        {title}
      </h3>
      <p className="mt-3 text-[0.94rem] leading-[1.72] text-slate-muted">{body}</p>
    </div>
  );
}
