import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { FaqBlock } from "@/components/site/FaqBlock";
import { OfferCta } from "@/components/launch/OfferCta";
import { InsightBody, SourceList } from "@/components/insights/Body";
import { CardGrid, cardCell, SectionHeading } from "@/components/ui/primitives";
import { Section } from "@/components/ui/section";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, blogPostingSchema, breadcrumbSchema, faqSchema } from "@/lib/schema";
import { insightBySlug, insights } from "@/content/insights";

/**
 * A single post.
 *
 * Same discipline as the service pages: the set is a content decision rather
 * than data, so an unknown slug is a 404 instead of an empty shell.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return insights.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = insightBySlug(slug);
  if (!post) return {};
  return buildMetadata({
    title: post.title,
    description: post.description,
    path: `/insights/${post.slug}`,
  });
}

function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function InsightPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = insightBySlug(slug);
  if (!post) notFound();

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Insights", path: "/insights" },
    { name: post.eyebrow, path: `/insights/${post.slug}` },
  ];

  const others = insights.filter((i) => i.slug !== post.slug);

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <JsonLd
        data={blogPostingSchema({
          headline: post.h1,
          description: post.description,
          slug: post.slug,
          datePublished: post.datePublished,
          dateModified: post.dateModified,
          sources: post.sources,
        })}
      />
      <JsonLd data={faqSchema(post.faqs)} />

      <PageHeader eyebrow={post.eyebrow} title={post.h1} lede={post.summary} crumbs={crumbs}>
        <p className="font-sans text-[0.85rem] text-slate-fg-muted">
          Published <time dateTime={post.datePublished}>{longDate(post.datePublished)}</time>
          {post.dateModified !== post.datePublished ? (
            <>
              <span aria-hidden="true" className="px-2">
                /
              </span>
              Updated <time dateTime={post.dateModified}>{longDate(post.dateModified)}</time>
            </>
          ) : null}
        </p>
      </PageHeader>

      <section className="border-b border-limestone-line">
        <Container>
          <div className="py-[clamp(48px,7vw,88px)]">
            <InsightBody blocks={post.body} />
          </div>
        </Container>
      </section>

      {/*
        The sources band is what a post most wants remembered: the whole claim of
        this corpus is that every assertion is traceable to a primary source. It
        was limestone in a run of light sections, and it is the mid page dark
        band now.
      */}
      <Section id="sources" tone="navy">
        <SectionHeading
          onDark
          eyebrow="Sources"
          title="Every claim above, and where to check it"
          lede="Primary sources only. Where something could not be traced to one, the page says so rather than repeating it."
        />
        <SourceList sources={post.sources} onDark />
      </Section>

      {post.faqs.length > 0 ? (
        <section className="border-b border-limestone-line">
          <Container>
            <div className="py-[clamp(48px,7vw,88px)]">
              <FaqBlock faqs={post.faqs} />
            </div>
          </Container>
        </section>
      ) : null}

      <section className="border-b border-limestone-line bg-limestone-sunk">
        <Container>
          <div className="py-[clamp(48px,7vw,88px)]">
            <SectionHeading eyebrow="More analysis" title="Related reading" level="h2" />
            <CardGrid className="mt-8">
              {others.map((other) => (
                <li key={other.slug} className={cardCell}>
                  <Link
                    href={`/insights/${other.slug}`}
                    className="block h-full px-6 py-5 transition-colors hover:bg-limestone"
                  >
                    <span className="font-display text-[1.02rem] leading-[1.4] font-semibold text-slate">
                      {other.h1}
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
