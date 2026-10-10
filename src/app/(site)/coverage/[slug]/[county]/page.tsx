import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/site/PageHeader";
import { Section, SectionHead } from "@/components/ui/section";
import { regionBySlug } from "@/content/regions";
import { COUNTY_SAMPLE } from "@/content/county-sample";

/*
 * THE SAMPLE COASTAL COUNTY PAGE, FOR REVIEW ONLY (run item 24, 2026-10-10).
 * One county, nested under its region at the URL proposed for the ruling. Not
 * indexed, not in the sitemap, and this branch does not merge. Every fact and
 * its source is in src/content/county-sample.ts.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ slug: COUNTY_SAMPLE.regionSlug, county: COUNTY_SAMPLE.slug }];
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: COUNTY_SAMPLE.title,
    description: COUNTY_SAMPLE.description,
    robots: { index: false, follow: false },
  };
}

export default async function CountyPage({ params }: { params: Promise<{ slug: string; county: string }> }) {
  const { slug, county } = await params;
  const region = regionBySlug(slug);
  if (!region || slug !== COUNTY_SAMPLE.regionSlug || county !== COUNTY_SAMPLE.slug) notFound();

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Coverage", path: "/coverage" },
    { name: region.name, path: `/coverage/${region.slug}` },
    { name: COUNTY_SAMPLE.name, path: `/coverage/${region.slug}/${COUNTY_SAMPLE.slug}` },
  ];

  return (
    <>
      <PageHeader eyebrow={region.name} title={COUNTY_SAMPLE.h1} lede={COUNTY_SAMPLE.lede} crumbs={crumbs} />

      <Section id="place">
        <SectionHead eyebrow="The place" title={`Where ${COUNTY_SAMPLE.name} is, and what it has been through`} level="h2" />
        {COUNTY_SAMPLE.place.map((p) => (
          <p key={p} className="mt-5 max-w-[68ch] text-[1rem] leading-[1.7] text-ink">
            {p}
          </p>
        ))}
      </Section>

      <Section id="wind">
        <SectionHead eyebrow="Wind" title="Which windstorm zone applies, and which code" level="h2" />
        {COUNTY_SAMPLE.wind.map((p) => (
          <p key={p} className="mt-5 max-w-[68ch] text-[1rem] leading-[1.7] text-ink">
            {p}
          </p>
        ))}
      </Section>

      <Section id="permitting">
        <SectionHead eyebrow="Permitting" title="Who signs off, and on what" level="h2" />
        {COUNTY_SAMPLE.permitting.map((p) => (
          <p key={p} className="mt-5 max-w-[68ch] text-[1rem] leading-[1.7] text-ink">
            {p}
          </p>
        ))}
        <p className="mt-8 text-[0.95rem] leading-[1.6] text-ink">
          The rest of the region, including its soils, is on the{" "}
          <Link href={`/coverage/${region.slug}`} className="text-link underline underline-offset-2">
            {region.longName} coverage page
          </Link>
          .
        </p>
      </Section>
    </>
  );
}
