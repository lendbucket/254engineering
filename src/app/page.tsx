import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import {
  ButtonLink,
  CardGrid,
  cardCell,
  Eyebrow,
  Rule,
  SectionHeading,
} from "@/components/ui/primitives";
import { OfferCta } from "@/components/launch/OfferCta";
import { CredentialsStrip } from "@/components/site/CredentialsStrip";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { services } from "@/content/services";
import { regions } from "@/content/regions";
import { business } from "@/config/business";
import {
  modelSentence,
  responsibleChargeCopy,
  specialistsCopy,
} from "@/content/model-copy";

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

      {/* Hero */}
      <section className="border-b border-limestone-line bg-limestone">
        <Container>
          <div className="grid gap-12 py-16 sm:py-20 lg:grid-cols-12 lg:gap-16 lg:py-28">
            <div className="lg:col-span-7">
              <Eyebrow>Veteran owned. Statewide.</Eyebrow>
              <h1 className="mt-4 text-[2.35rem] leading-[1.1] font-semibold text-slate sm:text-[3.1rem] lg:text-[3.4rem]">
                Texas engineering services in all 254 counties
              </h1>
              <p className="mt-7 max-w-xl text-[1.1rem] leading-[1.65] text-slate-muted">
                Inspections, sealed letters, certifications, and design, built to one standard from
                the Panhandle to the Rio Grande Valley. {modelSentence()}
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/services">See the service lines</ButtonLink>
                <ButtonLink href="/coverage" tone="secondary">
                  Coverage across Texas
                </ButtonLink>
              </div>
            </div>

            <div className="lg:col-span-5 lg:pl-8">
              <div className="border-t border-limestone-line pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
                <dl className="space-y-7">
                  <HeroStat
                    figure="254"
                    label="Texas counties"
                    detail="Every county in the state, grouped into eight coverage regions with their own conditions."
                  />
                  <HeroStat
                    figure="8"
                    label="Coverage regions"
                    detail="Wind, soil, and permitting change across Texas. The regions are how the firm accounts for that."
                  />
                  <HeroStat
                    figure="1"
                    label="Standard"
                    detail="One field protocol and one review process, whichever county the work is in."
                  />
                </dl>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* The name */}
      <section className="border-b border-limestone-line bg-limestone-sunk">
        <Container>
          <div className="grid gap-10 py-16 sm:py-20 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <Eyebrow>The name</Eyebrow>
              <Rule className="mt-5" />
            </div>
            <div className="lg:col-span-8">
              <p className="text-[1.22rem] leading-[1.6] font-medium text-slate sm:text-[1.35rem]">
                Texas has 254 counties, more than any other state in the country, and they are not
                one place.
              </p>
              <p className="mt-6 text-[1.02rem] leading-[1.75] text-slate-muted">
                A slab detail that is correct in Lubbock is wrong in Beaumont. A roof that passes
                inspection in Amarillo would not certify in Rockport. The soil, the wind, the frost
                depth, and the building official all change as you cross the state, and most firms
                answer that by working a metro and stopping at the county line. This firm is named
                for the number because it took the opposite position: build the field protocols and
                the review process so that one standard can hold across all 254 of them, and then
                serve every one. The number is the commitment, not the marketing.
              </p>
              <p className="mt-6">
                <Link
                  href="/about"
                  className="font-sans text-[0.96rem] font-semibold text-slate underline decoration-brass/60 underline-offset-[6px] transition-colors hover:decoration-brass"
                >
                  How the firm is built
                </Link>
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Services */}
      <section className="border-b border-limestone-line">
        <Container>
          <div className="py-16 sm:py-20">
            <SectionHeading
              eyebrow="Service lines"
              title="What this firm is built to deliver"
              lede="Nine service lines, each ending in a document somebody relies on: a lender, an insurer, a building official, or a court."
            />
            <CardGrid cols={3} className="mt-12">
              {services.map((s) => (
                <li key={s.slug} className={cardCell}>
                  <Link
                    href={`/services/${s.slug}`}
                    className="group flex h-full flex-col p-7 transition-colors hover:bg-limestone"
                  >
                    <h3 className="text-[1.12rem] leading-[1.35] font-semibold text-slate">
                      {s.name}
                    </h3>
                    <p className="mt-3 flex-1 text-[0.94rem] leading-[1.65] text-slate-muted">
                      {s.summary}
                    </p>
                    <span className="mt-5 font-sans text-[0.82rem] font-semibold tracking-[0.06em] text-brass-ink uppercase">
                      Read more
                    </span>
                  </Link>
                </li>
              ))}
            </CardGrid>
          </div>
        </Container>
      </section>

      {/* Coverage */}
      <section className="border-b border-limestone-line bg-limestone-sunk">
        <Container>
          <div className="py-16 sm:py-20">
            <SectionHeading
              eyebrow="Coverage"
              title="Every county in Texas, grouped into eight regions"
              lede="Coverage is stated by region because that is the honest unit. Wind zones, soil behavior, and permitting authority change across the state, and a firm that serves all of it has to account for that rather than average it."
            />
            <CardGrid className="mt-11">
              {regions.map((r) => (
                <li key={r.slug} className={cardCell}>
                  <Link
                    href={`/coverage/${r.slug}`}
                    className="flex h-full items-baseline justify-between gap-5 px-6 py-5 transition-colors hover:bg-limestone"
                  >
                    <span className="font-display text-[1.08rem] font-semibold text-slate">
                      {r.name}
                    </span>
                    <span className="font-sans text-[0.84rem] text-slate-muted">
                      {r.counties.length} counties
                    </span>
                  </Link>
                </li>
              ))}
            </CardGrid>
            <p className="mt-8">
              <Link
                href="/coverage"
                className="font-sans text-[0.96rem] font-semibold text-slate underline decoration-brass/60 underline-offset-[6px] transition-colors hover:decoration-brass"
              >
                See all 254 counties
              </Link>
            </p>
          </div>
        </Container>
      </section>

      {/* The model */}
      <section className="border-b border-limestone-line">
        <Container>
          <div className="py-16 sm:py-20">
            <SectionHeading
              eyebrow="The model"
              title="Standard field protocols, central engineering review"
              lede="Serving a state this size is an organizational problem before it is a technical one. The answer is to separate the two things that do not scale the same way."
            />
            <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
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
              <ModelPoint
                index="03"
                title="One review process, statewide"
                body={specialistsCopy()}
              />
            </div>
          </div>
        </Container>
      </section>

      {/* Veteran ownership */}
      <section className="border-b border-limestone-line bg-limestone-sunk">
        <Container>
          <div className="grid gap-10 py-16 sm:py-20 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <Eyebrow>Ownership</Eyebrow>
              <Rule className="mt-5" />
            </div>
            <div className="lg:col-span-8">
              <h2 className="text-[1.7rem] leading-[1.25] font-semibold text-slate sm:text-[2rem]">
                A veteran owned firm
              </h2>
              <p className="mt-5 text-[1.02rem] leading-[1.75] text-slate-muted">
                {business.name} is veteran owned. It shows up in the way the firm is organized more
                than in the way it is described: written procedures rather than individual habit,
                work that is checked by someone other than the person who did it, and a bias toward
                showing up where the work is rather than where it is convenient. Those are ordinary
                professional obligations. They are also the ones a state this size punishes a firm
                for treating loosely.
              </p>
              <p className="mt-5 text-[1.02rem] leading-[1.75] text-slate-muted">
                For public sector buyers, the firm maintains its registrations and its capability
                statement on a dedicated page rather than asking a contracting officer to piece it
                together from a brochure.
              </p>
              <p className="mt-7">
                <Link
                  href="/government"
                  className="font-sans text-[0.96rem] font-semibold text-slate underline decoration-brass/60 underline-offset-[6px] transition-colors hover:decoration-brass"
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

function HeroStat({ figure, label, detail }: { figure: string; label: string; detail: string }) {
  return (
    <div>
      <dt className="flex items-baseline gap-3">
        <span className="font-display text-[2.4rem] leading-none font-semibold text-slate">
          {figure}
        </span>
        <span className="font-sans text-[0.72rem] font-semibold tracking-[0.16em] text-brass-ink uppercase">
          {label}
        </span>
      </dt>
      <dd className="mt-2.5 text-[0.92rem] leading-[1.6] text-slate-muted">{detail}</dd>
    </div>
  );
}

function ModelPoint({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <div>
      <span className="font-sans text-[0.8rem] font-semibold tracking-[0.14em] text-brass-ink">
        {index}
      </span>
      <span aria-hidden="true" className="mt-3 mb-4 block h-px w-10 bg-brass" />
      <h3 className="text-[1.1rem] leading-[1.35] font-semibold text-slate">{title}</h3>
      <p className="mt-3 text-[0.94rem] leading-[1.7] text-slate-muted">{body}</p>
    </div>
  );
}
