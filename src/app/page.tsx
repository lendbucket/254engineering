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
 * The homepage, at the bolder setting.
 *
 * DENSITY IS THE STRUCTURE
 * ------------------------
 * The previous version alternated navy and light bands, which gave the page a
 * rhythm of colour. It still had one rhythm of INFORMATION: every section held
 * roughly a heading, a lede, and a grid, at roughly the same size, with roughly
 * the same padding.
 *
 * This one alternates density instead, and colour follows it. A spare section
 * carries one sentence at display scale and an enormous amount of air. A dense
 * section carries nine cards or eight regions and a real argument in prose. A
 * reader scrolling gets loud, quiet, loud, quiet, which is how an editorial
 * spread works and is not how a landing page works.
 *
 * WHERE THE GRID IS BROKEN, AND WHY IT IS ONLY THERE
 * --------------------------------------------------
 * Three places, each with a reason:
 *
 *   The name section runs the numeral off the left edge behind the prose, so the
 *   argument about the number is literally sitting on the number.
 *
 *   The gold band runs its statement past the container on the right, which is
 *   what stops a full bleed colour block reading as a button.
 *
 *   The coverage band overlaps the heading onto the map. The map is the subject
 *   and the heading is a label on it rather than a thing above it.
 *
 * Everything else stays on the grid. Breaking it everywhere is the same as not
 * having one, and the effect only reads where it is rare.
 *
 * THE ONE GOLD MOMENT
 * -------------------
 * Gold is a rule and mark colour on light surfaces because it measures 2.26:1 as
 * text there. The exception is a full gold FIELD with navy-ink type on it, which
 * measures 6.53:1, and the page is permitted exactly one. It lands on the
 * commitment sentence, which is the only claim on the page the firm would want
 * remembered word for word.
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

      {/* SPARE. One sentence, the largest type on any light surface, and air. */}
      <section className="border-b border-limestone-line bg-limestone">
        <Container>
          <div className="py-28 sm:py-40 lg:py-52">
            <p
              data-reveal
              className="max-w-5xl font-display text-[2.4rem] leading-[1.06] font-bold tracking-[-0.025em] text-slate sm:text-[3.8rem] lg:text-[5rem]"
            >
              Texas has 254 counties.
              <br />
              <span className="text-slate-muted">They are not one place.</span>
            </p>
          </div>
        </Container>
      </section>

      {/* DENSE, and the grid breaks. The numeral runs off the left edge and the
          prose sits on top of it. */}
      <section className="relative overflow-hidden border-b border-limestone-line bg-limestone-sunk">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[0.24em] -left-[0.06em] font-display text-[14rem] leading-[0.75] font-bold tracking-[-0.04em] text-slate/[0.06] select-none sm:text-[22rem] lg:text-[34rem]"
        >
          254
        </span>

        <Container className="relative">
          <div className="grid gap-12 py-20 sm:py-28 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <p className="font-sans text-[0.72rem] font-semibold tracking-[0.24em] text-brass-ink uppercase">
                The name
              </p>
              <span aria-hidden="true" className="mt-6 block h-px w-20 bg-brass" />
            </div>

            <div data-reveal className="lg:col-span-8">
              <p className="max-w-xl text-[1.06rem] leading-[1.8] text-slate-muted">
                A slab detail that is correct in Lubbock is wrong in Beaumont. A roof that passes
                inspection in Amarillo would not certify in Rockport. The soil, the wind, the frost
                depth, and the building official all change as you cross the state, and most firms
                answer that by working a metro and stopping at the county line.
              </p>
              <p className="mt-6 max-w-xl text-[1.06rem] leading-[1.8] text-slate-muted">
                This firm is named for the number because it took the opposite position: build the
                field protocols and the review process so that one standard can hold across all 254
                of them, and then serve every one.
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

      {/* THE GOLD MOMENT. One per page. Navy-ink on gold measures 6.53:1. */}
      <section className="relative overflow-hidden bg-brass">
        <Container>
          <div className="py-20 sm:py-28">
            {/* Solid, not slate-ink/70. An opacity modifier on a coloured
                field is where contrast quietly dies: 70 percent navy on gold
                measures 3.89:1 and failed. Full navy on gold is 6.53:1, and the
                eyebrow stays subordinate to the statement through size and
                tracking rather than through being faded. */}
            <p className="font-sans text-[0.72rem] font-semibold tracking-[0.24em] text-slate-ink uppercase">
              The commitment
            </p>
            <p
              data-reveal
              className="mt-8 max-w-4xl font-display text-[2rem] leading-[1.1] font-bold tracking-[-0.02em] text-slate-ink sm:text-[3rem] lg:text-[3.8rem]"
            >
              The number is the commitment, not the marketing.
            </p>
          </div>
        </Container>
      </section>

      {/* DENSE. Nine service lines. */}
      <section className="border-b border-limestone-line bg-limestone">
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
                    className="group flex h-full flex-col p-7 transition-colors hover:bg-limestone-sunk"
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

      {/* THE MAP. Navy, full width, heading overlapping onto it, borders drawing
          in as it arrives. */}
      <section className="relative overflow-hidden bg-slate-ink">
        <Container>
          <div className="py-20 sm:py-28">
            <div className="relative grid gap-10 lg:grid-cols-12 lg:gap-0">
              <div className="lg:col-span-7">
                <TexasCountyMap tone="dark" animateBorders />
              </div>

              {/* Overlaps the map on desktop. The heading is a label ON the
                  subject rather than a heading above it. */}
              <div className="lg:col-span-6 lg:col-start-6 lg:self-center lg:pl-4">
                <div className="relative lg:rounded-[3px] lg:bg-slate-ink/85 lg:p-10 lg:backdrop-blur-[2px]">
                  <p className="font-sans text-[0.72rem] font-semibold tracking-[0.24em] text-brass-light uppercase">
                    Coverage
                  </p>
                  <span aria-hidden="true" className="mt-6 block h-px w-20 bg-brass" />
                  <h2
                    data-reveal="soft"
                    className="mt-8 font-display text-[2.1rem] leading-[1.06] font-bold tracking-[-0.02em] text-slate-fg sm:text-[2.9rem]"
                  >
                    Every county,
                    <br />
                    eight regions.
                  </h2>
                  <p className="mt-7 max-w-md text-[1.02rem] leading-[1.75] text-slate-fg-muted">
                    The gold lines are the region borders. They are not drawn: they are the arcs
                    where the counties on either side belong to different regions, computed from the
                    same county assignment the lists are built from.
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
          </div>
        </Container>
      </section>

      {/* DENSE. A real sequence, which is why it is numbered. */}
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

      {/* Ownership. Navy, asymmetric. */}
      <section className="bg-slate">
        <Container>
          <div className="grid gap-12 py-20 sm:py-24 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <p className="font-sans text-[0.72rem] font-semibold tracking-[0.24em] text-brass-light uppercase">
                Ownership
              </p>
              <span aria-hidden="true" className="mt-6 block h-px w-20 bg-brass" />
              <h2
                data-reveal="soft"
                className="mt-8 font-display text-[2.1rem] leading-[1.08] font-bold text-slate-fg sm:text-[2.9rem]"
              >
                A veteran
                <br />
                owned firm
              </h2>
            </div>
            <div data-reveal className="lg:col-span-7 lg:pt-6">
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
 * The numeral is set large and in the display face because at 01 / 02 / 03 the
 * number is the only thing carrying the fact that these are ordered. Set small it
 * reads as decoration; set large it reads as a sequence.
 *
 * brass-ink, not brass. Gold at #d19a1e measures 2.26:1 on the off white and is a
 * rule colour there, never a text colour, however large it is set.
 */
function ModelPoint({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <div data-reveal>
      <span className="font-display text-[3rem] leading-none font-bold tabular-nums text-brass-ink">
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
