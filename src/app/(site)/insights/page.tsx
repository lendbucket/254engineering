import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { OfferCta } from "@/components/launch/OfferCta";
import { InsightEntry } from "@/components/insights/InsightEntry";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { HUB_POSTS_PER_SECTION, postsInSection, sectionsByNewest } from "@/content/insight-sections";

/**
 * The insights hub.
 *
 * Deliberately a plain list rather than a card grid. These are documents rather
 * than products: the thing a reader needs from the index is the title, what the
 * piece covers, and when it was written.
 *
 * GROUPED BY SECTION. Robert's answer 3 of 2026-11-13. Each section shows its
 * newest HUB_POSTS_PER_SECTION posts in full and links to its own page, which
 * lists every post in it, so the hub's height depends on how many sections
 * there are rather than how many posts. It replaces the newest twelve in full
 * and the rest as a compact list (2026-10-30), which still grew with every
 * post. seo-audit asserts every post is linked from this page or from a
 * section page it links.
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

export default function InsightsPage() {
  const sections = sectionsByNewest();

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
            <p className="max-w-[46rem] text-[1.01rem] leading-[1.72] text-slate-muted">
              Grouped by subject, newest first within each.{" "}
              <Link href="/guides" className="underline underline-offset-4">
                The same articles by topic
              </Link>
              , with the windstorm and structural engineer guides beside them.
            </p>
            {sections.map((section) => {
              const all = postsInSection(section.key);
              return (
                <div key={section.key} className="mt-14 max-w-[46rem]">
                  <h2 className="font-display text-[1.5rem] leading-[1.3] font-semibold text-slate sm:text-[1.7rem]">
                    {section.label}
                  </h2>
                  <ul className="mt-4 divide-y divide-limestone-line border-t border-limestone-line">
                    {all.slice(0, HUB_POSTS_PER_SECTION).map((post) => (
                      <InsightEntry key={post.slug} post={post} heading="h3" />
                    ))}
                  </ul>
                  <p className="border-t border-limestone-line pt-5">
                    <Link
                      href={`/insights/section/${section.slug}`}
                      className="inline-block py-2 text-[1.05rem] font-semibold text-slate underline underline-offset-4 transition-colors hover:text-brass-ink"
                    >
                      All {all.length} pieces on {section.label.toLowerCase()}
                    </Link>
                  </p>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      <OfferCta />
    </>
  );
}
