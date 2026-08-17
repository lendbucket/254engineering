import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { PrelaunchNotice } from "@/components/launch/PrelaunchNotice";
import { OfferCta } from "@/components/launch/OfferCta";
import { CardGrid, cardCell, SectionHeading } from "@/components/ui/primitives";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { allCounties, regionOfCounty, regions } from "@/content/regions";

export const metadata: Metadata = buildMetadata({
  title: "Engineering Coverage in All 254 Texas Counties",
  description:
    "Coverage across every county in Texas, grouped into eight regions with their own wind zones, soil conditions, and permitting context.",
  path: "/coverage",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Coverage", path: "/coverage" },
];

export default function CoveragePage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <PageHeader
        eyebrow="Coverage"
        title="Engineering coverage in all 254 Texas counties"
        lede="Texas has more counties than any other state and they are not one place. Coverage is stated by region because that is the honest unit: wind zones, soil behavior, and permitting authority change as you cross the state, and a firm serving all of it has to account for that rather than average it."
        crumbs={crumbs}
      >
        <PrelaunchNotice />
      </PageHeader>

      <section className="border-b border-limestone-line">
        <Container>
          <div className="py-14 sm:py-18">
            <SectionHeading
              eyebrow="Eight regions"
              title="Every county belongs to exactly one region"
              lede="The groupings follow the state's regional council boundaries rather than being drawn by feel, because those are the lines that already organize permitting, emergency management, and procurement in Texas."
            />

            <CardGrid className="mt-11">
              {regions.map((region) => (
                <li key={region.slug} className={cardCell}>
                  <Link
                    href={`/coverage/${region.slug}`}
                    className="flex h-full flex-col p-7 transition-colors hover:bg-limestone sm:p-8"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <h2 className="text-[1.2rem] leading-[1.3] font-semibold text-slate">
                        {region.name}
                      </h2>
                      <span className="shrink-0 font-sans text-[0.82rem] text-slate-muted">
                        {region.counties.length} counties
                      </span>
                    </div>
                    <p className="mt-3 flex-1 text-[0.95rem] leading-[1.68] text-slate-muted">
                      {region.summary}
                    </p>
                    <p className="mt-5 font-sans text-[0.86rem] text-slate-muted">
                      {region.anchors.slice(0, 4).join(", ")}
                    </p>
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
              eyebrow="The full list"
              title="All 254 counties, alphabetically"
              lede="Every county in Texas, with the region it belongs to. There are no county pages, deliberately: a page per county would be 254 near-identical documents, which is doorway content and is worth less than nothing to the person reading it."
            />

            <ul className="mt-11 grid gap-x-8 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">
              {allCounties.map((county) => {
                const region = regionOfCounty[county];
                return (
                  <li
                    key={county}
                    className="flex items-baseline justify-between gap-3 border-b border-limestone-line py-2.5"
                  >
                    <span className="text-[0.94rem] text-slate">{county}</span>
                    <Link
                      href={`/coverage/${region.slug}`}
                      className="shrink-0 font-sans text-[0.8rem] text-slate-muted underline decoration-limestone-line underline-offset-4 transition-colors hover:text-slate hover:decoration-brass"
                    >
                      {region.name}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <p className="mt-10 text-[0.92rem] leading-[1.7] text-slate-muted">
              {allCounties.length} counties listed. That number is not a claim typed into a page: it
              is counted from the coverage data at build time, and an audit fails the build if the
              regions ever stop summing to every county in Texas.
            </p>
          </div>
        </Container>
      </section>

      <OfferCta />
    </>
  );
}
