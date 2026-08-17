import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { FaqBlock } from "@/components/site/FaqBlock";
import { PrelaunchNotice } from "@/components/launch/PrelaunchNotice";
import { OfferCta } from "@/components/launch/OfferCta";
import { CardGrid, cardCell, Eyebrow, Rule, SectionHeading } from "@/components/ui/primitives";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema, faqSchema, serviceSchema } from "@/lib/schema";
import { serviceBySlug, services } from "@/content/services";
import { regions } from "@/content/regions";

/**
 * Every service page is generated at build time and there is no dynamic
 * fallback. The set of services is a business decision, not data, so a request
 * for a slug that is not in the list is a 404 rather than an empty page waiting
 * for content that will never arrive.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  if (!service) return {};
  return buildMetadata({
    title: service.title,
    description: service.description,
    path: `/services/${service.slug}`,
  });
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  if (!service) notFound();

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Services", path: "/services" },
    { name: service.shortName, path: `/services/${service.slug}` },
  ];

  // The regions that named this service in their own emphasis list. Derived
  // rather than authored, so a region that changes its emphasis changes what
  // links here without anybody having to remember this page exists.
  const relevantRegions = regions.filter((r) => r.emphasis.some((e) => e.slug === service.slug));

  const others = services.filter((s) => s.slug !== service.slug).slice(0, 4);

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <JsonLd
        data={serviceSchema({
          name: service.name,
          description: service.summary,
          path: `/services/${service.slug}`,
        })}
      />
      <JsonLd data={faqSchema(service.faqs)} />

      <PageHeader eyebrow="Service line" title={service.h1} lede={service.summary} crumbs={crumbs}>
        <PrelaunchNotice service={service.name} />
      </PageHeader>

      <section className="border-b border-limestone-line">
        <Container>
          <div className="grid gap-12 py-14 sm:py-18 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <Eyebrow>What it is</Eyebrow>
              <Rule className="mt-5" />
            </div>
            <div className="lg:col-span-8">
              {service.what.map((paragraph, i) => (
                <p
                  key={i}
                  className={`text-[1.02rem] leading-[1.75] text-slate-muted ${i > 0 ? "mt-6" : ""}`}
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="border-b border-limestone-line bg-limestone-sunk">
        <Container>
          <div className="grid gap-12 py-14 sm:py-18 lg:grid-cols-2 lg:gap-16">
            <div>
              <SectionHeading eyebrow="Who orders one" title="The people who need this document" />
              <ul className="mt-9 space-y-4">
                {service.whoOrders.map((who) => (
                  <li key={who} className="flex gap-4">
                    <span
                      aria-hidden="true"
                      className="mt-[0.65rem] h-px w-4 shrink-0 bg-brass"
                    />
                    <span className="text-[0.98rem] leading-[1.7] text-slate-muted">{who}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <SectionHeading eyebrow="The deliverable" title="What arrives at the end" />
              <ul className="mt-9 space-y-5">
                {service.deliverable.map((item) => (
                  <li key={item} className="flex gap-4">
                    <span
                      aria-hidden="true"
                      className="mt-[0.65rem] h-px w-4 shrink-0 bg-brass"
                    />
                    <span className="text-[0.98rem] leading-[1.7] text-slate-muted">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-10 rounded-[3px] border border-limestone-line bg-limestone-raised p-6">
                <p className="font-sans text-[0.7rem] font-semibold tracking-[0.18em] text-brass-ink uppercase">
                  Turnaround
                </p>
                <p className="mt-3 text-[0.96rem] leading-[1.7] text-slate-muted">
                  {service.turnaround}
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {relevantRegions.length > 0 ? (
        <section className="border-b border-limestone-line">
          <Container>
            <div className="py-14 sm:py-18">
              <SectionHeading
                eyebrow="Where it matters most"
                title="Regions where this work carries the most weight"
                lede="Coverage is statewide. These are the regions whose conditions put this service near the front, and why."
              />
              <CardGrid className="mt-10">
                {relevantRegions.map((region) => {
                  const reason = region.emphasis.find((e) => e.slug === service.slug)?.why;
                  return (
                    <li key={region.slug} className={cardCell}>
                      <Link
                        href={`/coverage/${region.slug}`}
                        className="block h-full p-6 transition-colors hover:bg-limestone"
                      >
                        <h3 className="text-[1.05rem] font-semibold text-slate">{region.name}</h3>
                        <p className="mt-2 text-[0.92rem] leading-[1.6] text-slate-muted">
                          {reason}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </CardGrid>
            </div>
          </Container>
        </section>
      ) : null}

      <section className="border-b border-limestone-line bg-limestone-sunk">
        <Container>
          <div className="py-14 sm:py-18">
            <FaqBlock faqs={service.faqs} />
          </div>
        </Container>
      </section>

      <section className="border-b border-limestone-line">
        <Container>
          <div className="py-14 sm:py-16">
            <SectionHeading eyebrow="Other service lines" title="Related work" level="h2" />
            <CardGrid className="mt-8">
              {others.map((s) => (
                <li key={s.slug} className={cardCell}>
                  <Link
                    href={`/services/${s.slug}`}
                    className="block h-full px-6 py-5 transition-colors hover:bg-limestone"
                  >
                    <span className="font-display text-[1.02rem] font-semibold text-slate">
                      {s.name}
                    </span>
                  </Link>
                </li>
              ))}
            </CardGrid>
          </div>
        </Container>
      </section>

      <OfferCta service={service.name} />
    </>
  );
}
