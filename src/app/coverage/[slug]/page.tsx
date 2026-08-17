import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { PrelaunchNotice } from "@/components/launch/PrelaunchNotice";
import { OfferCta } from "@/components/launch/OfferCta";
import { CardGrid, cardCell, Eyebrow, Rule, SectionHeading } from "@/components/ui/primitives";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { regionBySlug, regions } from "@/content/regions";
import { serviceBySlug } from "@/content/services";

export const dynamicParams = false;

export function generateStaticParams() {
  return regions.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const region = regionBySlug(slug);
  if (!region) return {};
  return buildMetadata({
    title: region.title,
    description: region.description,
    path: `/coverage/${region.slug}`,
  });
}

export default async function RegionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const region = regionBySlug(slug);
  if (!region) notFound();

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Coverage", path: "/coverage" },
    { name: region.name, path: `/coverage/${region.slug}` },
  ];

  const otherRegions = regions.filter((r) => r.slug !== region.slug);

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <PageHeader eyebrow="Coverage region" title={region.h1} lede={region.summary} crumbs={crumbs}>
        <PrelaunchNotice />
      </PageHeader>

      <section className="border-b border-limestone-line">
        <Container>
          <div className="grid gap-12 py-14 sm:py-18 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <Eyebrow>Wind</Eyebrow>
              <Rule className="mt-5" />
              <p className="mt-6 text-[0.92rem] leading-[1.65] text-slate-muted">
                What the wind environment requires of a structure in {region.longName}.
              </p>
            </div>
            <div className="lg:col-span-8">
              {region.wind.map((paragraph, i) => (
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
          <div className="grid gap-12 py-14 sm:py-18 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <Eyebrow>Soil</Eyebrow>
              <Rule className="mt-5" />
              <p className="mt-6 text-[0.92rem] leading-[1.65] text-slate-muted">
                What the ground does here, and what a foundation has to be designed against because
                of it.
              </p>
            </div>
            <div className="lg:col-span-8">
              {region.soils.map((paragraph, i) => (
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

      <section className="border-b border-limestone-line">
        <Container>
          <div className="grid gap-12 py-14 sm:py-18 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <Eyebrow>Permitting</Eyebrow>
              <Rule className="mt-5" />
              <p className="mt-6 text-[0.92rem] leading-[1.65] text-slate-muted">
                Who has authority over the work, and what they ask for before they issue.
              </p>
            </div>
            <div className="lg:col-span-8">
              {region.permitting.map((paragraph, i) => (
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
          <div className="py-14 sm:py-18">
            <SectionHeading
              eyebrow="Service emphasis"
              title={`What this region asks for most`}
              lede="All nine service lines are available across the state. These are the ones the conditions above push to the front here."
            />
            <CardGrid className="mt-10">
              {region.emphasis.map((item) => {
                const service = serviceBySlug(item.slug);
                if (!service) return null;
                return (
                  <li key={item.slug} className={cardCell}>
                    <Link
                      href={`/services/${service.slug}`}
                      className="block h-full p-6 transition-colors hover:bg-limestone sm:p-7"
                    >
                      <h3 className="text-[1.08rem] leading-[1.35] font-semibold text-slate">
                        {service.name}
                      </h3>
                      <p className="mt-2.5 text-[0.94rem] leading-[1.65] text-slate-muted">
                        {item.why}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </CardGrid>
          </div>
        </Container>
      </section>

      <section className="border-b border-limestone-line">
        <Container>
          <div className="py-14 sm:py-18">
            <SectionHeading
              eyebrow="Counties"
              title={`The ${region.counties.length} counties in this region`}
              lede={`Population centers include ${region.anchors.join(", ")}. Coverage is the whole list, not the centers.`}
            />
            <ul className="mt-10 grid grid-cols-2 gap-x-8 sm:grid-cols-3 lg:grid-cols-4">
              {region.counties.map((county) => (
                <li
                  key={county}
                  className="border-b border-limestone-line py-2.5 text-[0.94rem] text-slate"
                >
                  {county}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <section className="border-b border-limestone-line bg-limestone-sunk">
        <Container>
          <div className="py-14 sm:py-16">
            <SectionHeading eyebrow="Elsewhere in Texas" title="The other seven regions" />
            <CardGrid cols={3} className="mt-8">
              {otherRegions.map((r) => (
                <li key={r.slug} className={cardCell}>
                  <Link
                    href={`/coverage/${r.slug}`}
                    className="flex h-full items-baseline justify-between gap-4 px-6 py-5 transition-colors hover:bg-limestone"
                  >
                    <span className="font-display text-[1.02rem] font-semibold text-slate">
                      {r.name}
                    </span>
                    <span className="shrink-0 font-sans text-[0.8rem] text-slate-muted">
                      {r.counties.length}
                    </span>
                  </Link>
                </li>
              ))}
            </CardGrid>
          </div>
        </Container>
      </section>

      <OfferCta />
    </>
  );
}
