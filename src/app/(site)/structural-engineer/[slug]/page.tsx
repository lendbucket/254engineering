import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Section, SectionHead } from "@/components/ui/section";
import { ProseParagraph } from "@/components/ui/prose";
import { PageHeader } from "@/components/site/PageHeader";
import { PrelaunchNotice } from "@/components/launch/PrelaunchNotice";
import { OfferCta } from "@/components/launch/OfferCta";
import { FaqBlock } from "@/components/site/FaqBlock";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema, faqSchema } from "@/lib/schema";
import { proximityBySlug, proximityPages } from "@/content/structural-engineer";

export const dynamicParams = false;

export function generateStaticParams() {
  return proximityPages.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = proximityBySlug(slug);
  if (!page) return {};
  return buildMetadata({
    title: page.title,
    description: page.description,
    path: `/structural-engineer/${page.slug}`,
  });
}

function toneFor(index: number, total: number) {
  if (index === total - 1) return "sunk" as const;
  if (index % 3 === 2) return "navy" as const;
  return index % 3 === 1 ? ("sunk" as const) : ("white" as const);
}

export default async function ProximityClusterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = proximityBySlug(slug);
  if (!page) notFound();

  const sibling = proximityPages.find((p) => p.slug !== page.slug);

  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Structural engineers", path: "/structural-engineer" },
        { name: page.name, path: `/structural-engineer/${page.slug}` },
      ])} />
      {page.faqs ? <JsonLd data={faqSchema(page.faqs)} /> : null}

      <PageHeader
        eyebrow="Working with engineers"
        title={page.h1}
        lede={page.summary}
        crumbs={[
          { name: "Home", path: "/" },
          { name: "Structural engineers", path: "/structural-engineer" },
          { name: page.name, path: `/structural-engineer/${page.slug}` },
        ]}
      >
        <PrelaunchNotice />
      </PageHeader>

      {page.sections.map((section, i) => {
        const tone = toneFor(i, page.sections.length);
        const onDark = tone === "navy";
        return (
          <Section key={section.title} tone={tone}>
            <SectionHead
              eyebrow={section.eyebrow}
              title={section.title}
              lede={section.lede}
              onDark={onDark}
            />
            <div className="mt-8 max-w-[68ch]">
              {section.body.map((p, j) => (
                <ProseParagraph
                  key={j}
                  text={p}
                  className={`text-[1.02rem] leading-[1.75] ${
                    onDark ? "text-slate-fg/80" : "text-slate-muted"
                  } ${j > 0 ? "mt-6" : ""}`}
                />
              ))}
            </div>
          </Section>
        );
      })}

      {page.faqs ? (
        <Section tone="navy">
          <FaqBlock faqs={page.faqs} title="Common questions" onDark />
        </Section>
      ) : null}

      <Section>
        <SectionHead
          eyebrow="Next"
          title="Where this leads"
          lede="The rest of what a property owner needs before engaging anyone."
        />
        <div className="mt-8 max-w-[68ch]">
          <p className="text-[1.02rem] leading-[1.75] text-slate-muted">
            The background to all of this, including how an engineer differs from an inspector and
            what a sealed report will and will not tell you, is on{" "}
            <Link href="/structural-engineer" className="underline underline-offset-4">
              what a structural engineer does
            </Link>
            .
            {sibling ? (
              <>
                {" "}
                The companion question, {sibling.question.toLowerCase().replace(/\?$/, "")}, is
                covered in{" "}
                <Link
                  href={`/structural-engineer/${sibling.slug}`}
                  className="underline underline-offset-4"
                >
                  {sibling.name.toLowerCase()}
                </Link>
                .
              </>
            ) : null}
          </p>
        </div>
      </Section>

      <OfferCta />
    </>
  );
}
