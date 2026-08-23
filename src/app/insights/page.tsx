import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { OfferCta } from "@/components/launch/OfferCta";
import { Eyebrow } from "@/components/ui/primitives";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { insightsByDate } from "@/content/insights";

/**
 * The insights hub.
 *
 * Deliberately a plain reverse chronological list rather than a card grid. Four
 * posts in a two column grid leaves a visibly empty cell, and more importantly
 * these are documents rather than products: the thing a reader needs from the
 * index is the title, what the piece covers, and when it was written.
 */

export const metadata: Metadata = buildMetadata({
  title: "Engineering Insights for Texas Buyers | 254 Engineering",
  description:
    "Statute and rule backed analysis of Texas engineering procurement, firm registration, and licensure. Read what the law requires, with the primary sources cited.",
  path: "/insights",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Insights", path: "/insights" },
];

function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function InsightsPage() {
  const posts = insightsByDate();

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <PageHeader
        eyebrow="Insights"
        title="Analysis for people who have to get this right"
        lede="Texas regulates engineering closely, and most of what is written about it online either reproduces the statute without explaining it or explains it without citing anything. These pieces do both, and every source is listed and linked."
        crumbs={crumbs}
      />

      <section className="border-b border-limestone-line">
        <Container>
          <div className="py-14 sm:py-18">
            <ul className="max-w-[46rem] divide-y divide-limestone-line border-t border-limestone-line">
              {posts.map((post) => (
                <li key={post.slug} className="py-9">
                  <Eyebrow>{post.eyebrow}</Eyebrow>
                  <h2 className="mt-3 text-[1.4rem] leading-[1.3] font-semibold text-slate sm:text-[1.6rem]">
                    <Link
                      href={`/insights/${post.slug}`}
                      className="transition-colors hover:text-brass-ink"
                    >
                      {post.h1}
                    </Link>
                  </h2>
                  <p className="mt-4 text-[1.01rem] leading-[1.72] text-slate-muted">
                    {post.summary}
                  </p>
                  <p className="mt-4 font-sans text-[0.85rem] text-slate-muted">
                    <time dateTime={post.datePublished}>{longDate(post.datePublished)}</time>
                    <span aria-hidden="true" className="px-2">
                      /
                    </span>
                    {post.sources.length} primary sources cited
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <OfferCta />
    </>
  );
}
