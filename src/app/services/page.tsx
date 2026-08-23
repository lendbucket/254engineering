import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { PrelaunchNotice } from "@/components/launch/PrelaunchNotice";
import { OfferCta } from "@/components/launch/OfferCta";
import { CardGrid, cardCell, SectionHeading } from "@/components/ui/primitives";
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
        eyebrow="Service lines"
        title="Engineering services for Texas property and construction"
        lede={`Nine service lines, each ending in a document somebody relies on: a lender, an insurer, a building official, or a court. ${sealedDeliverableSentence()}`}
        crumbs={crumbs}
      >
        <PrelaunchNotice />
      </PageHeader>

      <section className="border-b border-limestone-line">
        <Container>
          <div className="py-14 sm:py-18">
            <CardGrid>
              {services.map((service) => (
                <li key={service.slug} className={cardCell}>
                  <Link
                    href={`/services/${service.slug}`}
                    className="flex h-full flex-col p-7 transition-colors hover:bg-limestone sm:p-8"
                  >
                    <h2 className="text-[1.2rem] leading-[1.35] font-semibold text-slate">
                      {service.name}
                    </h2>
                    <p className="mt-3 flex-1 text-[0.96rem] leading-[1.68] text-slate-muted">
                      {service.summary}
                    </p>
                    <span className="mt-6 font-sans text-[0.82rem] font-semibold tracking-[0.06em] text-brass-ink uppercase">
                      What it involves
                    </span>
                  </Link>
                </li>
              ))}
            </CardGrid>
          </div>
        </Container>
      </section>

      <section className="border-b border-limestone-line bg-limestone-sunk">
        <Container>
          <div className="py-14 sm:py-18">
            <SectionHeading
              eyebrow="How the work is produced"
              title="The same process behind every one of them"
              lede="The service lines differ in what they examine and what they produce. The way the work is carried out does not change between them."
            />
            <ol className="mt-11 grid gap-9 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7">
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
                <li key={item.step}>
                  <span className="font-sans text-[0.8rem] font-semibold tracking-[0.14em] text-brass-ink">
                    {item.step}
                  </span>
                  <span aria-hidden="true" className="mt-3 mb-4 block h-px w-10 bg-brass" />
                  <h3 className="text-[1.05rem] leading-[1.35] font-semibold text-slate">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-[0.93rem] leading-[1.7] text-slate-muted">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      <OfferCta />
    </>
  );
}
