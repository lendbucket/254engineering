import type { Metadata } from "next";
import { PageHeader } from "@/components/site/PageHeader";
import { sectionPhotos } from "@/content/photos";
import { PrelaunchNotice } from "@/components/launch/PrelaunchNotice";
import { OfferCta } from "@/components/launch/OfferCta";
import { CardGrid } from "@/components/ui/primitives";
import { Section, SectionHead, StatRail } from "@/components/ui/section";
import { regions } from "@/content/regions";
import { ServiceCard } from "@/components/services/ServiceCard";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { services } from "@/content/services";
import { reviewStepCopy, sealedDeliverableSentence } from "@/content/model-copy";

export const metadata: Metadata = buildMetadata({
  title: "Engineering Service Lines in Texas | 254 Engineering",
  description:
    "Nine engineering service lines for Texas property and construction: inspections, sealed letters, certifications, and design. See what each one involves.",
  path: "/services",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Services", path: "/services" },
];

export default function ServicesPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <PageHeader
        image={sectionPhotos.services}
        eyebrow="Service lines"
        title="Engineering services for Texas property and construction"
        lede={`Nine service lines, each ending in a document somebody relies on: a lender, an insurer, a building official, or a court. ${sealedDeliverableSentence()}`}
        crumbs={crumbs}
      >
        <PrelaunchNotice />
      </PageHeader>

      {/*
        The opening statement the grid never had.

        This section was nine cards and nothing else: a list wearing card chrome,
        opening on the first card's own heading. Every homepage section opens
        eyebrow, heading, lede, and that device is most of why the homepage reads
        as composed rather than assembled. The stat rail underneath is the
        homepage's, counting real data rather than stating a number.
      */}
      <Section tone="sunk">
        <SectionHead
          eyebrow="The service lines"
          title="Nine documents, one standard behind each"
          lede="Each line ends in something a lender, an insurer, a building official, or a court has to accept. They differ in what they examine. They do not differ in how the work is carried out."
        />
        <div className="mt-8 border-t border-limestone-line pt-7">
          <StatRail
            onDark={false}
            stats={[
              { figure: services.length, label: "Sealed service lines" },
              { figure: regions.length, label: "Service regions" },
              { figure: 254, label: "Texas counties covered" },
            ]}
          />
        </div>
      </Section>

      {/*
        The process band is navy, matching the homepage's "How It Works".

        This page had one dark band, at the very end, which is the difference
        between rhythm and a list. The homepage carries three in nine sections and
        never puts them all at the bottom. The section that earns the band here is
        the one the page most wants remembered: that the nine lines are nine
        documents produced one way.
      */}
      <Section id="how-produced" tone="navy">
        <SectionHead
          eyebrow="How the work is produced"
          title="The same process behind every one of them"
          lede="The service lines differ in what they examine and what they produce. The way the work is carried out does not change between them."
          onDark
        />
        <ol className="mt-9 flex flex-wrap gap-[clamp(20px,3vw,28px)]">
              {[
                {
                  step: "01",
                  title: "Scope agreed in writing",
                  body: "What is being examined, what will be produced, and what the deliverable will and will not address. Scope disagreements after the fact are almost always scope that was never written down.",
                },
                {
                  step: "02",
                  title: "Field work to a protocol",
                  body: "A technician certified on the written protocol for that service collects the same evidence in the same order, with photographs keyed to locations rather than gathered loose.",
                },
                {
                  step: "03",
                  title: "Engineering review",
                  body: reviewStepCopy(),
                },
                {
                  step: "04",
                  title: "Sealed and delivered",
                  body: "The document is sealed and delivered as a PDF formatted for whoever has to accept it, whether that is a plans examiner, an underwriter, or a loan file.",
                },
        ].map((item) => (
          <li
            key={item.step}
            /* basis, not bare flex-1. See the note in ProcessStep: three of
               these in a wrapping row with a zero basis never reach the wrap
               threshold and hold four columns at every width. */
            className="relative flex flex-1 basis-[240px] flex-col overflow-hidden rounded-[4px] bg-white p-[clamp(22px,2.6vw,30px)]"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-[34px] right-2 font-display text-[132px] leading-none font-extrabold text-limestone-sunk select-none"
            >
              {item.step.replace(/^0/, "")}
            </span>
            <div className="relative">
              <p className="text-[12px] font-bold tracking-[0.12em] text-brass-ink uppercase">
                Step {item.step.replace(/^0/, "")} of 4
              </p>
              <h3 className="mt-2 font-display text-[clamp(19px,2.1vw,23px)] leading-[1.25] font-bold text-slate">
                {item.title}
              </h3>
              <p className="mt-3 text-[15px] leading-[1.7] text-slate-muted">{item.body}</p>
            </div>
          </li>
        ))}
        </ol>
      </Section>

      <Section tone="white">
        <div>
            <CardGrid cols={3}>
              {services.map((service) => (
                <ServiceCard
                  key={service.slug}
                  slug={service.slug}
                  name={service.name}
                  summary={service.summary}
                  heading="h2"
                  cta="What it involves"
                />
              ))}
            </CardGrid>
        </div>
      </Section>

      <OfferCta />
    </>
  );
}
