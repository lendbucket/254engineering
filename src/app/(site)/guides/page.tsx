import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { OfferCta } from "@/components/launch/OfferCta";
import { Eyebrow } from "@/components/ui/primitives";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { insightsByDate, type Insight } from "@/content/insights";
import { windstormHub, windstormPages } from "@/content/windstorm-program";
import { proximityHub, proximityPages } from "@/content/structural-engineer";

/**
 * The guides index, by topic.
 *
 * AN INDEX, NOT A SECOND ARTICLE SYSTEM. Robert, 22:12 Central 2026-10-29, on
 * article proposal item 1: articles stay /insights posts, and /guides lists
 * them by topic. A second URL scheme for the same kind of page would split the
 * dates emitter, the schema and the audits in two, which is the two homes
 * defect. So nothing here is typed: the topics are each post's own eyebrow, the
 * posts are the insights corpus, and the two program guides are read from the
 * content modules their own hubs render.
 */

export const metadata: Metadata = buildMetadata({
  title: "Texas Engineering Guides by Topic | 254 Engineering",
  description:
    "Every guide and article on Texas engineering, windstorm certification, lending and foundations, grouped by topic with its primary sources. Find yours here.",
  path: "/guides",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Guides", path: "/guides" },
];

/** Posts grouped under their own eyebrow, each topic placed where its newest post sits. */
function byTopic(posts: Insight[]): { topic: string; posts: Insight[] }[] {
  const groups = new Map<string, Insight[]>();
  for (const post of posts) {
    const list = groups.get(post.eyebrow) ?? [];
    list.push(post);
    groups.set(post.eyebrow, list);
  }
  return [...groups.entries()].map(([topic, list]) => ({ topic, posts: list }));
}

const programGuides = [
  {
    topic: "The windstorm program",
    hub: { href: "/windstorm", title: windstormHub.h1, summary: windstormHub.summary },
    pages: windstormPages.map((p) => ({ href: `/windstorm/${p.slug}`, title: p.h1 })),
  },
  {
    topic: "Structural engineers",
    hub: { href: "/structural-engineer", title: proximityHub.h1, summary: proximityHub.summary },
    pages: proximityPages.map((p) => ({ href: `/structural-engineer/${p.slug}`, title: p.h1 })),
  },
];

export default function GuidesPage() {
  const topics = byTopic(insightsByDate());

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <PageHeader
        eyebrow="Guides"
        title="Every guide, by topic"
        lede="The program guides walk a process in the order it runs. The articles answer one question each, with every source listed and linked. Both are grouped here by what they are about."
        crumbs={crumbs}
      />

      <section className="border-b border-limestone-line">
        <Container>
          <div className="grid gap-12 py-[clamp(48px,7vw,88px)] lg:grid-cols-2">
            {programGuides.map((g) => (
              <div key={g.hub.href}>
                <Eyebrow>{g.topic}</Eyebrow>
                <h2 className="mt-3 text-[1.4rem] leading-[1.3] font-semibold text-slate">
                  <Link href={g.hub.href} className="transition-colors hover:text-brass-ink">
                    {g.hub.title}
                  </Link>
                </h2>
                <p className="mt-3 text-[1.01rem] leading-[1.72] text-slate-muted">{g.hub.summary}</p>
                <ul className="mt-5 space-y-2">
                  {g.pages.map((p) => (
                    <li key={p.href}>
                      <Link
                        href={p.href}
                        className="text-[1rem] text-slate underline underline-offset-4 transition-colors hover:text-brass-ink"
                      >
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {topics.map((group) => (
        <section key={group.topic} className="border-b border-limestone-line">
          <Container>
            <div className="py-[clamp(40px,6vw,72px)]">
              <h2 className="text-[1.5rem] leading-[1.3] font-semibold text-slate sm:text-[1.7rem]">
                {group.topic}
              </h2>
              <ul className="mt-6 max-w-[46rem] divide-y divide-limestone-line border-t border-limestone-line">
                {group.posts.map((post) => (
                  <li key={post.slug} className="py-6">
                    <h3 className="text-[1.15rem] leading-[1.35] font-semibold text-slate">
                      <Link href={`/insights/${post.slug}`} className="transition-colors hover:text-brass-ink">
                        {post.h1}
                      </Link>
                    </h3>
                    <p className="mt-2 text-[1.01rem] leading-[1.72] text-slate-muted">{post.summary}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </section>
      ))}

      <OfferCta />
    </>
  );
}
