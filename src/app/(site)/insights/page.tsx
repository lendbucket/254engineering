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
 *
 * THE NEWEST TWELVE IN FULL, THE REST AS A COMPACT LIST. 2026-10-30: at 37
 * posts the full list reached 16,027px at 390 wide, over the 16,000px ceiling
 * mobile-overflow-audit holds public content to, and every post added makes it
 * longer. Every post is still linked from this page, so no post loses its
 * inbound link from the hub; the older ones carry their title and date only.
 */

const FULL_ENTRIES = 12;

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
  const all = insightsByDate();
  const posts = all.slice(0, FULL_ENTRIES);
  const earlier = all.slice(FULL_ENTRIES);

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
          <div className="py-[clamp(48px,7vw,88px)]">
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
            {earlier.length > 0 ? (
              <div className="mt-14 max-w-[46rem]">
                <h2 className="font-display text-[1.25rem] font-semibold text-slate">Earlier pieces</h2>
                <ul className="mt-4 divide-y divide-limestone-line border-t border-limestone-line">
                  {earlier.map((post) => (
                    <li key={post.slug} className="py-4">
                      <Link
                        href={`/insights/${post.slug}`}
                        className="inline-block py-1 text-[1.05rem] leading-[1.4] font-semibold text-slate transition-colors hover:text-brass-ink"
                      >
                        {post.h1}
                      </Link>
                      <p className="mt-1 font-sans text-[0.85rem] text-slate-muted">
                        <time dateTime={post.datePublished}>{longDate(post.datePublished)}</time>
                      </p>
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
