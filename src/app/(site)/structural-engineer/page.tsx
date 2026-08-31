import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHead } from "@/components/ui/section";
import { ProseParagraph } from "@/components/ui/prose";
import { PageHeader } from "@/components/site/PageHeader";
import { PrelaunchNotice } from "@/components/launch/PrelaunchNotice";
import { OfferCta } from "@/components/launch/OfferCta";
import { FaqBlock } from "@/components/site/FaqBlock";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema, faqSchema } from "@/lib/schema";
import { proximityHub, proximityPages } from "@/content/structural-engineer";

/**
 * The head term page for the highest volume term measured across the three
 * brands: "structural engineer near me", 6,700/mo at KD 0.
 *
 * There is no city and no "near me" anywhere on it, and the reasoning is at the
 * top of src/content/structural-engineer.ts. In short: the searcher does not
 * want the phrase, they want to know whether this is the kind of professional
 * who solves their problem. Proximity is converted by the entity being genuinely
 * local and verifiable, which is what /corpus-christi and the coverage regions
 * carry, rather than by matching a string.
 */

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Structural engineers", path: "/structural-engineer" },
];

export const metadata: Metadata = buildMetadata({
  title: proximityHub.title,
  description: proximityHub.description,
  path: "/structural-engineer",
});

function toneFor(index: number, total: number) {
  if (index === total - 1) return "sunk" as const;
  if (index % 3 === 2) return "navy" as const;
  return index % 3 === 1 ? ("sunk" as const) : ("white" as const);
}

export default function StructuralEngineerPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <JsonLd data={faqSchema(proximityHub.faqs)} />

      <PageHeader
        eyebrow="Working with engineers"
        title={proximityHub.h1}
        lede={proximityHub.summary}
        crumbs={crumbs}
      >
        <PrelaunchNotice />
      </PageHeader>

      {proximityHub.sections.map((section, i) => {
        const tone = toneFor(i, proximityHub.sections.length);
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

      <Section tone="navy">
        <SectionHead
          eyebrow="Going further"
          title="The two questions people ask next"
          lede="Whether the problem in front of you needs an engineer at all, and how to tell a good one from a bad one."
          onDark
        />
        <ul className="mt-8 grid gap-6 lg:grid-cols-2">
          {proximityPages.map((p) => (
            <li
              key={p.slug}
              className="rounded-[4px] border border-white/15 border-t-[3px] border-t-brass bg-white/5 p-6"
            >
              {/*
                A heading, not a paragraph, and that is a measurement decision as
                much as a semantic one. link-map counts a contextual link only
                inside p, li, or dd, so card navigation rendered in a paragraph
                is scored as prose and inflates the contextual count with links
                nobody wrote into a sentence.
              */}
              <h3 className="font-display text-[1.1rem] leading-[1.3] font-bold text-slate-fg">
                <Link href={`/structural-engineer/${p.slug}`} className="underline underline-offset-4">
                  {p.name}
                </Link>
              </h3>
              <p className="mt-3 text-[0.95rem] leading-[1.7] text-slate-fg/80">{p.question}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Wrapped, because FaqBlock renders a bare section with no Container and
          would otherwise sit flush against the viewport edge. */}
      <Section>
        <FaqBlock faqs={proximityHub.faqs} title="Common questions" />
      </Section>

      <Section tone="sunk">
        <SectionHead
          eyebrow="Coverage"
          title="Where the conditions change"
          lede="Texas is not one engineering environment, and the differences are the part that does not travel."
        />
        <div className="mt-8 max-w-[68ch]">
          <p className="text-[1.02rem] leading-[1.75] text-slate-muted">
            Expansive clay behaviour, coastal wind requirements, and rock and caliche near the Hill
            Country are genuinely different problems, and each of the{" "}
            <Link href="/coverage" className="underline underline-offset-4">
              eight coverage regions
            </Link>{" "}
            carries the soil, wind, and permitting conditions that actually apply there. Inside the
            designated coastal counties, construction runs through{" "}
            <Link href="/windstorm" className="underline underline-offset-4">
              a separate windstorm inspection program
            </Link>{" "}
            that has nothing to do with the ordinary building permit.
          </p>
        </div>
      </Section>

      <OfferCta />
    </>
  );
}
