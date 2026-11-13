import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { OfferCta } from "@/components/launch/OfferCta";
import { InsightEntry } from "@/components/insights/InsightEntry";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { INSIGHT_SECTIONS, postsInSection, sectionPageBySlug, sectionsByNewest } from "@/content/insight-sections";

/**
 * One section of the insights corpus, every post in it, newest first.
 *
 * The hub links here from each section (Robert's answer 3 of 2026-11-13), so
 * this page is how a post past the hub's first few stays one click from the
 * hub. The set is the declared sections, so an unknown slug is a 404.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return INSIGHT_SECTIONS.filter((s) => postsInSection(s.key).length > 0).map((s) => ({ section: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  const page = sectionPageBySlug(section);
  if (!page) return {};
  return buildMetadata({
    title: page.title,
    description: page.description,
    path: `/insights/section/${page.slug}`,
  });
}

export default async function InsightSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const page = sectionPageBySlug(section);
  if (!page) notFound();
  const posts = postsInSection(page.key);
  if (posts.length === 0) notFound();
  /* Every other section, so each section page is linked from more than the hub. */
  const others = sectionsByNewest().filter((s) => s.slug !== page.slug);

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Insights", path: "/insights" },
    { name: page.label, path: `/insights/section/${page.slug}` },
  ];

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <PageHeader eyebrow="Insights" title={page.h1} lede={page.lede} crumbs={crumbs} />

      <section className="border-b border-limestone-line">
        <Container>
          <div className="py-[clamp(48px,7vw,88px)]">
            <p className="mb-8 max-w-[46rem] text-[1.01rem] leading-[1.72] text-slate-muted">
              {posts.length} pieces, newest first.{" "}
              <Link href="/insights" className="underline underline-offset-4">
                Every section of the insights index
              </Link>
              .
            </p>
            <ul className="max-w-[46rem] divide-y divide-limestone-line border-t border-limestone-line">
              {posts.map((post) => (
                <InsightEntry key={post.slug} post={post} />
              ))}
            </ul>
            {others.length > 0 ? (
              <div className="mt-14 max-w-[46rem]">
                <h2 className="font-display text-[1.25rem] font-semibold text-slate">Other sections</h2>
                <ul className="mt-4 space-y-2">
                  {others.map((s) => (
                    <li key={s.slug}>
                      <Link
                        href={`/insights/section/${s.slug}`}
                        className="inline-block py-2 text-[1.05rem] text-slate underline underline-offset-4 transition-colors hover:text-brass-ink"
                      >
                        {s.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Container>
      </section>

      <OfferCta />
    </>
  );
}
