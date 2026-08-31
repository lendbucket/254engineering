import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Section, SectionHead } from "@/components/ui/section";
import { PageHeader } from "@/components/site/PageHeader";
import { PrelaunchNotice } from "@/components/launch/PrelaunchNotice";
import { OfferCta } from "@/components/launch/OfferCta";
import { FaqBlock } from "@/components/site/FaqBlock";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema, faqSchema } from "@/lib/schema";
import { windstormBySlug, windstormPages } from "@/content/windstorm-program";

export const dynamicParams = false;

export function generateStaticParams() {
  return windstormPages.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = windstormBySlug(slug);
  if (!page) return {};
  return buildMetadata({ title: page.title, description: page.description, path: `/windstorm/${page.slug}` });
}

/**
 * Band rhythm for a variable number of sections.
 *
 * The parity standard is three dark bands of nine, never adjacent and never all
 * stacked at the end. These pages have between four and five sections plus a
 * dark CTA, so the rule is expressed rather than hand placed: every third band
 * is navy, and the last section is forced light so it never sits against the
 * CTA. That keeps the alternation legible at any section count and means adding
 * a section to a page cannot quietly produce two dark bands in a row.
 */
function toneFor(index: number, total: number) {
  if (index === total - 1) return "sunk" as const;
  if (index % 3 === 2) return "navy" as const;
  return index % 3 === 1 ? ("sunk" as const) : ("white" as const);
}

export default async function WindstormClusterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = windstormBySlug(slug);
  if (!page) notFound();

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Windstorm", path: "/windstorm" },
    { name: page.name, path: `/windstorm/${page.slug}` },
  ];

  const siblings = windstormPages.filter((p) => p.slug !== page.slug).slice(0, 3);

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      {/* Only where the questions are real, which is the rule in CLAUDE.md
          section 4. Every question below was written because somebody actually
          asks it, not to earn a rich result. */}
      {page.faqs ? <JsonLd data={faqSchema(page.faqs)} /> : null}

      <PageHeader
        eyebrow="Windstorm program"
        title={page.h1}
        lede={page.summary}
        crumbs={crumbs}
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
                <p
                  key={j}
                  className={`text-[1.02rem] leading-[1.75] ${
                    onDark ? "text-slate-fg/80" : "text-slate-muted"
                  } ${j > 0 ? "mt-6" : ""}`}
                >
                  {p}
                </p>
              ))}
            </div>
          </Section>
        );
      })}

      {/* FaqBlock renders its own eyebrow and heading. A SectionHead above it
          produced two stacked headings that both said Questions. */}
      {page.faqs ? (
        <Section tone="navy">
          <FaqBlock faqs={page.faqs} title="What people ask about this" onDark />
        </Section>
      ) : null}

      <Section>
        <SectionHead
          eyebrow="Elsewhere in the program"
          title="The rest of the windstorm system"
          lede="Each part of this program is decided by a different party, which is why they are separate pages."
        />
        <ul className="mt-8 grid gap-6 sm:grid-cols-3">
          {siblings.map((s) => (
            <li key={s.slug} className="rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white p-6">
              <p className="font-display text-[1.05rem] leading-[1.3] font-bold text-slate">
                <Link href={`/windstorm/${s.slug}`} className="underline underline-offset-4">
                  {s.name}
                </Link>
              </p>
              <p className="mt-3 text-[0.95rem] leading-[1.65] text-slate-muted">{s.question}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-[68ch] text-[1.02rem] leading-[1.75] text-slate-muted">
          The{" "}
          <Link href="/windstorm" className="underline underline-offset-4">
            program overview
          </Link>{" "}
          sets out who decides what, and the{" "}
          <Link href="/services/windstorm-wpi-8" className="underline underline-offset-4">
            windstorm capability page
          </Link>{" "}
          covers what this firm is built to deliver once its registration is issued.
        </p>
      </Section>

      <OfferCta service="Windstorm WPI-8 Certifications" />
    </>
  );
}
